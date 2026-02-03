#!/usr/bin/env bun

/**
 * threshold-monitor.ts
 *
 * Phase 3-4: Threshold Monitoring + Prediction Layer Integration
 *
 * Monitors aggregated metrics against configured thresholds to detect
 * high-value automation opportunities. NOW ENHANCED with prediction layer
 * for proactive suggestions before patterns emerge.
 *
 * TWO DETECTION MODES:
 * 1. REACTIVE: Detects patterns after they occur (original behavior)
 * 2. PREDICTIVE: Forecasts needs from goals and trajectories (Phase 3.5)
 *
 * Urgency Levels:
 * - URGENT (90%+ confidence): 5+ same-day OR 15+ weekly → mid-session interrupt
 * - HIGH (80%+ confidence): 3+ same-day OR 10+ weekly → next session start
 * - STRATEGIC (70%+ confidence): 20+ monthly → Monday brief
 *
 * Usage:
 *   bun run tools/threshold-monitor.ts              # Check today
 *   bun run tools/threshold-monitor.ts --verbose    # Show all detections
 *   bun run tools/threshold-monitor.ts --reactive-only  # Disable predictions
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { aggregateDay, aggregatePeriod, type DailySummary } from './metric-aggregator';
import { loadTelos, calculateTelosAlignment, type TelosProfile } from './telos-extractor';
import { predictFromGoals } from './goal-predictor';
import { forecastTrajectories } from './trajectory-forecaster';
import { monitorToolHealth } from './tool-health-monitor';
import { analyzeOpportunityCost } from './opportunity-cost-analyzer';
import { orchestratePredictions, type PredictiveSuggestion } from './prediction-orchestrator';

const HOME = process.env.HOME!;
const METRICS_DIR = join(HOME, '.claude/metrics');
const CONFIG_PATH = join(METRICS_DIR, 'config.json');

// Types
export interface ThresholdAlert {
  priority: 'urgent' | 'high' | 'strategic';
  pattern: string;
  count: number;
  confidence: number;
  telosAlignment?: number;      // Telos multiplier applied
  telosAdjustedConfidence?: number;  // Final confidence after telos
  suggestion: string;
  estimatedSavings?: string;
  evidence: string[];
  telosNote?: string;          // Why this matters for telos

  // NEW: Prediction layer fields
  predictionType?: 'reactive' | 'predictive';
  predictionSource?: 'goal-based' | 'trajectory' | 'deprecation' | 'realignment';
  predictionDetails?: PredictiveSuggestion;
}

interface ThresholdConfig {
  thresholds: {
    urgent: { sameDayOccurrences: number; minConfidence: number; weeklyOccurrences: number };
    high: { sameDayOccurrences: number; minConfidence: number; weeklyOccurrences: number };
    strategic: { monthlyOccurrences: number; minConfidence: number };
  };
}

/**
 * Get user's highest identity score
 */
function getHighestIdentity(telos: TelosProfile): string {
  const identities = Object.entries(telos.identity);
  const highest = identities.reduce((max, curr) =>
    curr[1] > max[1] ? curr : max
  );
  return highest[0];
}

/**
 * Generate telos-aware suggestion text
 */
function generateTelosSuggestion(
  pattern: string,
  count: number,
  telos: TelosProfile,
  telosMultiplier: number
): { suggestion: string; telosNote: string } {
  const highestIdentity = getHighestIdentity(telos);

  if (telosMultiplier > 1.2) {
    // High alignment - emphasize acceleration toward purpose
    return {
      suggestion: `You've done ${pattern} ${count} times today. This aligns with your ${highestIdentity} identity - automate to accelerate your mission.`,
      telosNote: `Strong alignment with ${highestIdentity} work (${telosMultiplier.toFixed(2)}x multiplier)`
    };
  } else if (telosMultiplier < 0.8) {
    // Low alignment - question the activity
    return {
      suggestion: `${pattern} appeared ${count} times but doesn't align with your ${highestIdentity} focus. Should this be delegated or eliminated?`,
      telosNote: `Low alignment with your ${highestIdentity} identity (${telosMultiplier.toFixed(2)}x multiplier)`
    };
  } else {
    // Neutral - standard automation suggestion
    return {
      suggestion: `${pattern} appeared ${count} times today. Consider automation.`,
      telosNote: `Moderate alignment with your work (${telosMultiplier.toFixed(2)}x multiplier)`
    };
  }
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
 * Check today's metrics against same-day thresholds (TELOS-AWARE)
 */
function checkSameDayThresholds(today: DailySummary, config: ThresholdConfig, telos: TelosProfile): ThresholdAlert[] {
  const alerts: ThresholdAlert[] = [];

  // Check sequences with telos alignment
  for (const seq of today.sameToolSequences) {
    const baseConfidence = seq.confidence;
    const telosMultiplier = calculateTelosAlignment(seq.pattern, telos);
    const telosAdjustedConfidence = Math.min(95, baseConfidence * telosMultiplier);

    // Generate telos-aware suggestion
    const { suggestion, telosNote } = generateTelosSuggestion(seq.pattern, seq.count, telos, telosMultiplier);

    // Urgent: telos-adjusted confidence >= 90
    if (seq.count >= config.thresholds.urgent.sameDayOccurrences &&
        telosAdjustedConfidence >= config.thresholds.urgent.minConfidence) {
      alerts.push({
        priority: 'urgent',
        pattern: seq.pattern,
        count: seq.count,
        confidence: baseConfidence,
        telosAlignment: telosMultiplier,
        telosAdjustedConfidence,
        suggestion,
        telosNote,
        estimatedSavings: `~${seq.count * 2} minutes/day`,
        evidence: [`${seq.count} occurrences today`]
      });
    }
    // High: telos-adjusted confidence >= 80
    else if (seq.count >= config.thresholds.high.sameDayOccurrences &&
             telosAdjustedConfidence >= config.thresholds.high.minConfidence) {
      alerts.push({
        priority: 'high',
        pattern: seq.pattern,
        count: seq.count,
        confidence: baseConfidence,
        telosAlignment: telosMultiplier,
        telosAdjustedConfidence,
        suggestion,
        telosNote,
        estimatedSavings: `Potential for time savings`,
        evidence: [`${seq.count} occurrences today`]
      });
    }
    // NEW: Misalignment warning (low telos multiplier but high frequency)
    else if (seq.count >= 5 && telosMultiplier < 0.8) {
      alerts.push({
        priority: 'high',
        pattern: seq.pattern,
        count: seq.count,
        confidence: baseConfidence,
        telosAlignment: telosMultiplier,
        telosAdjustedConfidence,
        suggestion: `⚠️ ${seq.pattern} appeared ${seq.count} times but has low telos-alignment. Consider delegating or eliminating this work.`,
        telosNote: `This pattern doesn't align with your ${getHighestIdentity(telos)} identity`,
        estimatedSavings: null,
        evidence: [`${seq.count} occurrences, ${telosMultiplier.toFixed(2)}x telos multiplier`]
      });
    }
  }

  // Check high-frequency tools with telos awareness
  for (const tool of today.highFrequencyTools) {
    if (tool.avgPerSession >= 10) {
      const pattern = `${tool.tool} high-frequency`;
      const telosMultiplier = calculateTelosAlignment(tool.tool, telos);
      const telosAdjustedConfidence = Math.min(95, 85 * telosMultiplier);
      const { suggestion, telosNote } = generateTelosSuggestion(tool.tool, tool.count, telos, telosMultiplier);

      alerts.push({
        priority: telosAdjustedConfidence >= 90 ? 'urgent' : 'high',
        pattern,
        count: tool.count,
        confidence: 85,
        telosAlignment: telosMultiplier,
        telosAdjustedConfidence,
        suggestion: `${tool.tool} used ${tool.count} times today. ${telosNote}`,
        telosNote,
        estimatedSavings: 'Potential for significant automation',
        evidence: [`${tool.count} calls across ${today.sessionCount} sessions`]
      });
    }
  }

  return alerts;
}

/**
 * Check weekly metrics against weekly thresholds (TELOS-AWARE)
 */
function checkWeeklyThresholds(summaries: DailySummary[], config: ThresholdConfig, telos: TelosProfile): ThresholdAlert[] {
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

  // Check thresholds with telos awareness
  for (const [pattern, count] of Object.entries(weeklySequences)) {
    const days = sequenceDays[pattern];
    const baseConfidence = count >= 15 ? 95 : 85;
    const telosMultiplier = calculateTelosAlignment(pattern, telos);
    const telosAdjustedConfidence = Math.min(95, baseConfidence * telosMultiplier);
    const { suggestion, telosNote } = generateTelosSuggestion(pattern, count, telos, telosMultiplier);

    // Urgent: 15+ weekly with high telos-adjusted confidence
    if (count >= config.thresholds.urgent.weeklyOccurrences &&
        telosAdjustedConfidence >= config.thresholds.urgent.minConfidence) {
      alerts.push({
        priority: 'urgent',
        pattern,
        count,
        confidence: baseConfidence,
        telosAlignment: telosMultiplier,
        telosAdjustedConfidence,
        suggestion: `${pattern} appeared ${count} times this week. ${telosNote}`,
        telosNote,
        estimatedSavings: `~${count * 2} minutes/week`,
        evidence: [`${count} occurrences over ${days} days`]
      });
    }
    // High: 10+ weekly with moderate telos-adjusted confidence
    else if (count >= config.thresholds.high.weeklyOccurrences &&
             telosAdjustedConfidence >= config.thresholds.high.minConfidence) {
      alerts.push({
        priority: 'high',
        pattern,
        count,
        confidence: baseConfidence,
        telosAlignment: telosMultiplier,
        telosAdjustedConfidence,
        suggestion,
        telosNote,
        estimatedSavings: `~${count * 2} minutes/week`,
        evidence: [`${count} occurrences over ${days} days`]
      });
    }
  }

  return alerts;
}

/**
 * Check monthly metrics against strategic thresholds (TELOS-AWARE)
 */
function checkMonthlyThresholds(summaries: DailySummary[], config: ThresholdConfig, telos: TelosProfile): ThresholdAlert[] {
  const alerts: ThresholdAlert[] = [];

  // Aggregate sequences across month
  const monthlySequences: Record<string, number> = {};

  for (const summary of summaries) {
    for (const seq of summary.sameToolSequences) {
      monthlySequences[seq.pattern] = (monthlySequences[seq.pattern] || 0) + seq.count;
    }
  }

  // Check strategic threshold with telos
  for (const [pattern, count] of Object.entries(monthlySequences)) {
    if (count >= config.thresholds.strategic.monthlyOccurrences) {
      const telosMultiplier = calculateTelosAlignment(pattern, telos);
      const telosAdjustedConfidence = Math.min(90, 75 * telosMultiplier);
      const { suggestion, telosNote } = generateTelosSuggestion(pattern, count, telos, telosMultiplier);

      alerts.push({
        priority: 'strategic',
        pattern,
        count,
        confidence: 75,
        telosAlignment: telosMultiplier,
        telosAdjustedConfidence,
        suggestion,
        telosNote,
        estimatedSavings: `~${count * 2} minutes/month`,
        evidence: [`${count} occurrences this month`]
      });
    }
  }

  return alerts;
}

/**
 * Convert PredictiveSuggestion to ThresholdAlert format
 */
function predictiveToAlert(prediction: PredictiveSuggestion): ThresholdAlert {
  // Map prediction priority to alert priority
  const alertPriority: ThresholdAlert['priority'] =
    prediction.priority === 'critical' ? 'urgent' :
    prediction.priority === 'high' ? 'high' : 'strategic';

  return {
    priority: alertPriority,
    pattern: prediction.title,
    count: 0,  // Predictions don't have occurrence counts
    confidence: prediction.confidence,
    telosAlignment: prediction.telosAlignment / 100,  // Convert to multiplier
    telosAdjustedConfidence: prediction.confidence * (prediction.telosAlignment / 100),
    suggestion: prediction.description,
    estimatedSavings: prediction.estimatedImpact,
    evidence: [
      `Type: ${prediction.type}`,
      `Timeframe: ${prediction.timeframe}`,
      prediction.reasoning
    ],
    telosNote: `Strategic value: ${prediction.strategicValue.toFixed(0)}`,
    predictionType: 'predictive',
    predictionSource: prediction.type,
    predictionDetails: prediction
  };
}

/**
 * Run prediction layer and convert to alerts
 */
function runPredictionLayer(telos: TelosProfile, summaries: DailySummary[]): ThresholdAlert[] {
  try {
    console.error('🔮 Running prediction layer...\n');

    // Run all prediction engines
    const goalPredictions = predictFromGoals(telos);
    const trajectories = forecastTrajectories(summaries);
    const toolHealth = monitorToolHealth();
    const opportunityCost = analyzeOpportunityCost(summaries, telos);

    // Orchestrate predictions
    const predictions = orchestratePredictions(
      goalPredictions,
      trajectories,
      toolHealth,
      opportunityCost,
      telos
    );

    console.error(`   Generated ${predictions.length} predictions\n`);

    // Convert to alerts
    return predictions.map(predictiveToAlert);
  } catch (e) {
    console.error(`⚠️  Prediction layer error: ${e}\n`);
    return [];
  }
}

/**
 * Main threshold check - combines REACTIVE and PREDICTIVE detection
 */
export function checkThresholds(options?: { reactiveOnly?: boolean }): ThresholdAlert[] {
  const config = loadConfig();
  const telos = loadTelos(24);  // Cache for 24 hours
  const alerts: ThresholdAlert[] = [];

  console.error(`🎯 Using telos profile: ${getHighestIdentity(telos)} (${telos.identity[getHighestIdentity(telos) as keyof typeof telos.identity]}%)\n`);

  try {
    // REACTIVE DETECTION (original behavior)
    console.error('📊 Running reactive pattern detection...\n');

    // Check today with telos awareness
    const today = aggregateDay(new Date());
    const sameDayAlerts = checkSameDayThresholds(today, config, telos);
    sameDayAlerts.forEach(a => a.predictionType = 'reactive');
    alerts.push(...sameDayAlerts);

    // Check last 7 days for weekly patterns
    const weeklySummaries = aggregatePeriod(7);
    const weeklyAlerts = checkWeeklyThresholds(weeklySummaries, config, telos);
    weeklyAlerts.forEach(a => a.predictionType = 'reactive');
    alerts.push(...weeklyAlerts);

    // Check last 30 days for strategic patterns
    const monthlySummaries = aggregatePeriod(30);
    const monthlyAlerts = checkMonthlyThresholds(monthlySummaries, config, telos);
    monthlyAlerts.forEach(a => a.predictionType = 'reactive');
    alerts.push(...monthlyAlerts);

    console.error(`   Detected ${alerts.length} reactive patterns\n`);

    // PREDICTIVE DETECTION (Phase 3.5 - NEW)
    if (!options?.reactiveOnly) {
      const predictiveAlerts = runPredictionLayer(telos, monthlySummaries);
      alerts.push(...predictiveAlerts);
    }
  } catch (e) {
    console.error(`Error checking thresholds: ${e}`);
  }

  // Sort by priority then confidence
  const priorityOrder = { urgent: 0, high: 1, strategic: 2 };
  alerts.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return (b.telosAdjustedConfidence || b.confidence) - (a.telosAdjustedConfidence || a.confidence);
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
  const reactiveOnly = args.includes('--reactive-only');

  console.error('🔍 Checking thresholds...\n');

  const alerts = checkThresholds({ reactiveOnly });

  if (alerts.length === 0) {
    console.log('✅ No patterns have crossed alert thresholds');
    return;
  }

  const reactiveCount = alerts.filter(a => a.predictionType === 'reactive').length;
  const predictiveCount = alerts.filter(a => a.predictionType === 'predictive').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log('THRESHOLD ALERTS');
  console.log(`Reactive: ${reactiveCount} | Predictive: ${predictiveCount}`);
  console.log(`${'='.repeat(60)}\n`);

  const urgent = alerts.filter(a => a.priority === 'urgent');
  const high = alerts.filter(a => a.priority === 'high');
  const strategic = alerts.filter(a => a.priority === 'strategic');

  if (urgent.length > 0) {
    console.log('🔴 URGENT (Immediate Action Recommended)\n');
    for (const alert of urgent) {
      const badge = alert.predictionType === 'predictive' ? '🔮' : '📊';
      console.log(`${badge} ${alert.pattern}`);
      if (alert.predictionType === 'predictive') {
        console.log(`Type: PREDICTIVE (${alert.predictionSource})`);
      }
      if (alert.count > 0) {
        console.log(`Count: ${alert.count} | Base: ${alert.confidence}% | Telos-Adjusted: ${alert.telosAdjustedConfidence?.toFixed(0)}%`);
      } else {
        console.log(`Confidence: ${alert.confidence}%`);
      }
      if (alert.telosAlignment) {
        console.log(`Telos Alignment: ${alert.telosAlignment.toFixed(2)}x`);
      }
      console.log(`Suggestion: ${alert.suggestion}`);
      if (alert.telosNote) {
        console.log(`📍 ${alert.telosNote}`);
      }
      if (alert.estimatedSavings) {
        console.log(`Impact: ${alert.estimatedSavings}`);
      }
      if (verbose && alert.evidence) {
        console.log(`Evidence: ${alert.evidence.join(', ')}`);
      }
      console.log();
    }
  }

  if (high.length > 0) {
    console.log('🟡 HIGH PRIORITY (Next Session)\n');
    for (const alert of high) {
      const badge = alert.predictionType === 'predictive' ? '🔮' : '📊';
      console.log(`${badge} ${alert.pattern}`);
      if (alert.predictionType === 'predictive') {
        console.log(`Type: PREDICTIVE (${alert.predictionSource})`);
      }
      if (alert.count > 0) {
        console.log(`Count: ${alert.count} | Base: ${alert.confidence}% | Telos-Adjusted: ${alert.telosAdjustedConfidence?.toFixed(0)}%`);
      } else {
        console.log(`Confidence: ${alert.confidence}%`);
      }
      if (alert.telosAlignment) {
        console.log(`Telos Alignment: ${alert.telosAlignment.toFixed(2)}x`);
      }
      console.log(`Suggestion: ${alert.suggestion}`);
      if (alert.telosNote && verbose) {
        console.log(`📍 ${alert.telosNote}`);
      }
      if (verbose && alert.evidence) {
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
