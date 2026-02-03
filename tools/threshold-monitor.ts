#!/usr/bin/env bun

/**
 * threshold-monitor.ts
 *
 * Phase 3: Threshold Monitoring for Self-Improvement Flywheel
 *
 * Monitors aggregated metrics against configured thresholds to detect
 * high-value automation opportunities that warrant user notification.
 *
 * Urgency Levels:
 * - URGENT (90%+ confidence): 5+ same-day OR 15+ weekly → mid-session interrupt
 * - HIGH (80%+ confidence): 3+ same-day OR 10+ weekly → next session start
 * - STRATEGIC (70%+ confidence): 20+ monthly → Monday brief
 *
 * Usage:
 *   bun run tools/threshold-monitor.ts              # Check today
 *   bun run tools/threshold-monitor.ts --verbose    # Show all detections
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { aggregateDay, aggregatePeriod, type DailySummary } from './metric-aggregator';

const HOME = process.env.HOME!;
const METRICS_DIR = join(HOME, '.claude/metrics');
const CONFIG_PATH = join(METRICS_DIR, 'config.json');

// Types
export interface ThresholdAlert {
  priority: 'urgent' | 'high' | 'strategic';
  pattern: string;
  count: number;
  confidence: number;
  suggestion: string;
  estimatedSavings?: string;
  evidence: string[];
}

interface ThresholdConfig {
  thresholds: {
    urgent: { sameDayOccurrences: number; minConfidence: number; weeklyOccurrences: number };
    high: { sameDayOccurrences: number; minConfidence: number; weeklyOccurrences: number };
    strategic: { monthlyOccurrences: number; minConfidence: number };
  };
}

/**
 * Load threshold configuration
 */
function loadConfig(): ThresholdConfig {
  if (!existsSync(CONFIG_PATH)) {
    // Default config
    return {
      thresholds: {
        urgent: { sameDayOccurrences: 5, minConfidence: 90, weeklyOccurrences: 15 },
        high: { sameDayOccurrences: 3, minConfidence: 80, weeklyOccurrences: 10 },
        strategic: { monthlyOccurrences: 20, minConfidence: 70 }
      }
    };
  }

  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}

/**
 * Check today's metrics against same-day thresholds
 */
function checkSameDayThresholds(today: DailySummary, config: ThresholdConfig): ThresholdAlert[] {
  const alerts: ThresholdAlert[] = [];

  // Check sequences
  for (const seq of today.sameToolSequences) {
    // Urgent: 5+ occurrences, 90%+ confidence
    if (seq.count >= config.thresholds.urgent.sameDayOccurrences &&
        seq.confidence >= config.thresholds.urgent.minConfidence) {
      alerts.push({
        priority: 'urgent',
        pattern: seq.pattern,
        count: seq.count,
        confidence: seq.confidence,
        suggestion: `You've done ${seq.pattern} ${seq.count} times today. Automate this workflow?`,
        estimatedSavings: `~${seq.count * 2} minutes/day`,
        evidence: [`${seq.count} occurrences today`]
      });
    }
    // High: 3+ occurrences, 80%+ confidence
    else if (seq.count >= config.thresholds.high.sameDayOccurrences &&
             seq.confidence >= config.thresholds.high.minConfidence) {
      alerts.push({
        priority: 'high',
        pattern: seq.pattern,
        count: seq.count,
        confidence: seq.confidence,
        suggestion: `${seq.pattern} appeared ${seq.count} times today. Consider automation.`,
        estimatedSavings: `Potential for time savings`,
        evidence: [`${seq.count} occurrences today`]
      });
    }
  }

  // Check high-frequency tools
  for (const tool of today.highFrequencyTools) {
    if (tool.avgPerSession >= 10) {
      alerts.push({
        priority: 'high',
        pattern: `${tool.tool} high-frequency`,
        count: tool.count,
        confidence: 85,
        suggestion: `${tool.tool} used ${tool.count} times today. Consider enhancing this workflow.`,
        estimatedSavings: 'Potential for significant automation',
        evidence: [`${tool.count} calls across ${today.sessionCount} sessions`]
      });
    }
  }

  return alerts;
}

/**
 * Check weekly metrics against weekly thresholds
 */
function checkWeeklyThresholds(summaries: DailySummary[], config: ThresholdConfig): ThresholdAlert[] {
  const alerts: ThresholdAlert[] = [];

  // Aggregate sequences across week
  const weeklySequences: Record<string, number> = {};
  const sequenceDays: Record<string, number> = {};

  for (const summary of summaries) {
    for (const seq of summary.sameToolSequences) {
      weeklySequences[seq.pattern] = (weeklySequences[seq.pattern] || 0) + seq.count;
      sequenceDays[seq.pattern] = (sequenceDays[seq.pattern] || 0) + 1;
    }
  }

  // Check thresholds
  for (const [pattern, count] of Object.entries(weeklySequences)) {
    const days = sequenceDays[pattern];

    // Urgent: 15+ weekly, 95% confidence
    if (count >= config.thresholds.urgent.weeklyOccurrences) {
      alerts.push({
        priority: 'urgent',
        pattern,
        count,
        confidence: 95,
        suggestion: `${pattern} appeared ${count} times this week across ${days} days. This needs automation NOW.`,
        estimatedSavings: `~${count * 2} minutes/week`,
        evidence: [`${count} occurrences over ${days} days`]
      });
    }
    // High: 10+ weekly, 85% confidence
    else if (count >= config.thresholds.high.weeklyOccurrences) {
      alerts.push({
        priority: 'high',
        pattern,
        count,
        confidence: 85,
        suggestion: `${pattern} appeared ${count} times this week. Build automation?`,
        estimatedSavings: `~${count * 2} minutes/week`,
        evidence: [`${count} occurrences over ${days} days`]
      });
    }
  }

  return alerts;
}

/**
 * Check monthly metrics against strategic thresholds
 */
function checkMonthlyThresholds(summaries: DailySummary[], config: ThresholdConfig): ThresholdAlert[] {
  const alerts: ThresholdAlert[] = [];

  // Aggregate sequences across month
  const monthlySequences: Record<string, number> = {};

  for (const summary of summaries) {
    for (const seq of summary.sameToolSequences) {
      monthlySequences[seq.pattern] = (monthlySequences[seq.pattern] || 0) + seq.count;
    }
  }

  // Check strategic threshold
  for (const [pattern, count] of Object.entries(monthlySequences)) {
    if (count >= config.thresholds.strategic.monthlyOccurrences) {
      alerts.push({
        priority: 'strategic',
        pattern,
        count,
        confidence: 75,
        suggestion: `${pattern} appeared ${count} times this month. Strategic automation opportunity.`,
        estimatedSavings: `~${count * 2} minutes/month`,
        evidence: [`${count} occurrences this month`]
      });
    }
  }

  return alerts;
}

/**
 * Main threshold check - combines all timeframes
 */
export function checkThresholds(): ThresholdAlert[] {
  const config = loadConfig();
  const alerts: ThresholdAlert[] = [];

  try {
    // Check today
    const today = aggregateDay(new Date());
    alerts.push(...checkSameDayThresholds(today, config));

    // Check last 7 days for weekly patterns
    const weeklySummaries = aggregatePeriod(7);
    alerts.push(...checkWeeklyThresholds(weeklySummaries, config));

    // Check last 30 days for strategic patterns
    const monthlySummaries = aggregatePeriod(30);
    alerts.push(...checkMonthlyThresholds(monthlySummaries, config));
  } catch (e) {
    console.error(`Error checking thresholds: ${e}`);
  }

  // Sort by priority then confidence
  const priorityOrder = { urgent: 0, high: 1, strategic: 2 };
  alerts.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.confidence - a.confidence;
  });

  // Deduplicate - if same pattern appears at multiple priorities, keep highest
  const seen = new Set<string>();
  const deduplicated = alerts.filter(alert => {
    if (seen.has(alert.pattern)) return false;
    seen.add(alert.pattern);
    return true;
  });

  return deduplicated;
}

/**
 * CLI execution
 */
function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.error('🔍 Checking thresholds...\n');

  const alerts = checkThresholds();

  if (alerts.length === 0) {
    console.log('✅ No patterns have crossed alert thresholds');
    return;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('THRESHOLD ALERTS');
  console.log(`${'='.repeat(60)}\n`);

  const urgent = alerts.filter(a => a.priority === 'urgent');
  const high = alerts.filter(a => a.priority === 'high');
  const strategic = alerts.filter(a => a.priority === 'strategic');

  if (urgent.length > 0) {
    console.log('🔴 URGENT (Immediate Action Recommended)\n');
    for (const alert of urgent) {
      console.log(`Pattern: ${alert.pattern}`);
      console.log(`Count: ${alert.count} | Confidence: ${alert.confidence}%`);
      console.log(`Suggestion: ${alert.suggestion}`);
      if (alert.estimatedSavings) {
        console.log(`Savings: ${alert.estimatedSavings}`);
      }
      if (verbose) {
        console.log(`Evidence: ${alert.evidence.join(', ')}`);
      }
      console.log();
    }
  }

  if (high.length > 0) {
    console.log('🟡 HIGH PRIORITY (Next Session)\n');
    for (const alert of high) {
      console.log(`Pattern: ${alert.pattern}`);
      console.log(`Count: ${alert.count} | Confidence: ${alert.confidence}%`);
      console.log(`Suggestion: ${alert.suggestion}`);
      if (verbose) {
        console.log(`Evidence: ${alert.evidence.join(', ')}`);
      }
      console.log();
    }
  }

  if (strategic.length > 0 && verbose) {
    console.log('🟢 STRATEGIC (Monday Brief)\n');
    for (const alert of strategic) {
      console.log(`Pattern: ${alert.pattern}`);
      console.log(`Count: ${alert.count} | Confidence: ${alert.confidence}%`);
      console.log(`Suggestion: ${alert.suggestion}`);
      console.log();
    }
  }

  console.log(`${'='.repeat(60)}\n`);
  console.log(`Total alerts: ${alerts.length} (${urgent.length} urgent, ${high.length} high, ${strategic.length} strategic)`);
}

if (import.meta.main) {
  main();
}
