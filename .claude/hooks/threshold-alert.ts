#!/usr/bin/env bun

/**
 * threshold-alert.ts
 *
 * Phase 4: Mid-Session Threshold Alerts
 *
 * Runs periodically (every 30 minutes) to check for urgent patterns
 * that have crossed thresholds. Surfaces high-value automation
 * opportunities mid-session when confidence is very high (90%+).
 *
 * Features:
 * - Deduplication: Won't alert same pattern twice per day
 * - Rate limiting: Max 2 alerts per day
 * - Cooldown: 120 minute minimum between alerts
 *
 * Not invoked directly - would be called by a background process or timer.
 * For now, this is a reference implementation for future activation.
 */

import { checkThresholds, type ThresholdAlert } from '../../tools/threshold-monitor';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const METRICS_DIR = join(process.env.HOME!, '.claude/metrics');
const ALERT_STATE_FILE = join(METRICS_DIR, 'alert-state.json');

interface AlertState {
  lastCheck: string;
  alertedPatterns: string[];
  alertCount: number;
  lastAlertTime: string | null;
}

function loadAlertState(): AlertState {
  if (existsSync(ALERT_STATE_FILE)) {
    return JSON.parse(readFileSync(ALERT_STATE_FILE, 'utf-8'));
  }
  return {
    lastCheck: new Date().toISOString(),
    alertedPatterns: [],
    alertCount: 0,
    lastAlertTime: null
  };
}

function saveAlertState(state: AlertState) {
  if (!existsSync(METRICS_DIR)) {
    mkdirSync(METRICS_DIR, { recursive: true });
  }
  writeFileSync(ALERT_STATE_FILE, JSON.stringify(state, null, 2));
}

export async function checkForUrgentPatterns() {
  const alerts = checkThresholds();
  const urgentAlerts = alerts.filter(a => a.priority === 'urgent');

  if (urgentAlerts.length === 0) {
    return null;
  }

  const state = loadAlertState();
  const now = new Date();
  const today = now.toDateString();
  const lastCheckDay = new Date(state.lastCheck).toDateString();

  // Reset daily counters if new day
  if (today !== lastCheckDay) {
    state.alertedPatterns = [];
    state.alertCount = 0;
  }

  // Check rate limiting
  if (state.alertCount >= 2) {
    return null;  // Max 2 per day
  }

  // Check cooldown
  if (state.lastAlertTime) {
    const minutesSinceLastAlert = (now.getTime() - new Date(state.lastAlertTime).getTime()) / 1000 / 60;
    if (minutesSinceLastAlert < 120) {
      return null;  // 2-hour cooldown
    }
  }

  // Filter to new alerts
  const newAlerts = urgentAlerts.filter(a => !state.alertedPatterns.includes(a.pattern));

  if (newAlerts.length === 0) {
    return null;
  }

  // Surface the top alert
  const topAlert = newAlerts[0];

  console.error('\n' + '━'.repeat(60));
  console.error('🔥 FLYWHEEL ALERT - High-Value Automation Opportunity');
  console.error('━'.repeat(60));
  console.error(`\n${topAlert.suggestion}`);
  console.error(`\nPattern: ${topAlert.pattern}`);
  console.error(`Occurrences: ${topAlert.count}`);
  console.error(`Confidence: ${topAlert.confidence}%`);
  if (topAlert.estimatedSavings) {
    console.error(`Potential savings: ${topAlert.estimatedSavings}`);
  }
  console.error('\nThis pattern crossed the urgency threshold.');
  console.error('Consider building automation now.\n');
  console.error('━'.repeat(60) + '\n');

  // Update state
  state.alertedPatterns.push(topAlert.pattern);
  state.alertCount++;
  state.lastAlertTime = now.toISOString();
  state.lastCheck = now.toISOString();
  saveAlertState(state);

  return topAlert;
}

if (import.meta.main) {
  checkForUrgentPatterns().then(alert => {
    if (!alert) {
      console.log('No urgent patterns detected or cooldown active');
    }
  });
}
