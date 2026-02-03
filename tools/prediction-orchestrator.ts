#!/usr/bin/env bun

/**
 * prediction-orchestrator.ts
 *
 * Phase 3.5: Prediction Orchestration
 *
 * Combines all prediction sources (goals, trajectories, tool health,
 * opportunity costs) into a unified ranked list of suggestions.
 * Applies strategic value ranking based on priority, confidence,
 * telos alignment, and estimated impact.
 *
 * Key Features:
 * - Unified suggestion interface across all prediction types
 * - Strategic value ranking (priority × confidence × alignment)
 * - Deduplication of similar suggestions
 * - Actionable output ready for surfacing layer
 */

import { type GoalPrediction } from './goal-predictor';
import { type TrajectoryForecast } from './trajectory-forecaster';
import { type ToolHealthReport } from './tool-health-monitor';
import { type OpportunityCostReport } from './opportunity-cost-analyzer';
import { type TelosProfile } from './telos-extractor';

export interface PredictiveSuggestion {
  id: string;
  type: 'goal-based' | 'trajectory' | 'deprecation' | 'realignment';
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;  // 0-100
  title: string;
  description: string;
  reasoning: string;
  estimatedImpact: string;
  timeframe: 'immediate' | '1-2 weeks' | '1 month' | '3+ months';
  action: {
    type: 'build' | 'deprecate' | 'delegate' | 'refocus' | 'monitor';
    specifics: string;
  };
  telosAlignment: number;  // 0-100 (how well this aligns with user's purpose)
  strategicValue: number;  // Calculated score for ranking
}

/**
 * Convert goal predictions to unified suggestions
 */
function goalPredictionsToSuggestions(
  goalPredictions: GoalPrediction[],
  telos: TelosProfile
): PredictiveSuggestion[] {
  const suggestions: PredictiveSuggestion[] = [];

  for (const goalPred of goalPredictions) {
    for (const need of goalPred.predictedNeeds) {
      if (!need.exists && need.confidence >= 70) {
        // Calculate telos alignment based on capability category
        let telosAlignment = 70;  // Base
        if (need.category === 'automation' && telos.identity.builder > 80) {
          telosAlignment = 90;
        } else if (need.category === 'research' && telos.identity.scientist > 80) {
          telosAlignment = 85;
        } else if (need.category === 'coordination' && telos.identity.leader > 80) {
          telosAlignment = 85;
        }

        const priority = need.timeframe === 'immediate' ? 'critical' :
                        need.timeframe === '1-2 weeks' ? 'high' : 'medium';

        suggestions.push({
          id: `goal-${slugify(need.capability)}`,
          type: 'goal-based',
          priority,
          confidence: need.confidence,
          title: `Build ${need.capability}`,
          description: `Your goal "${goalPred.goal}" implies you'll need this capability`,
          reasoning: need.reasoning,
          estimatedImpact: `Directly supports stated goal. Prevents future bottleneck.`,
          timeframe: need.timeframe,
          action: {
            type: 'build',
            specifics: `Create ${need.capability} before you hit the need`
          },
          telosAlignment,
          strategicValue: 0  // Calculated later
        });
      }
    }
  }

  return suggestions;
}

/**
 * Convert trajectory forecasts to unified suggestions
 */
function trajectoriesToSuggestions(
  trajectories: TrajectoryForecast[],
  telos: TelosProfile
): PredictiveSuggestion[] {
  const suggestions: PredictiveSuggestion[] = [];

  for (const trajectory of trajectories) {
    if (trajectory.recommendation === 'build_now') {
      // Calculate telos alignment based on pattern
      let telosAlignment = 60;  // Base
      if (trajectory.pattern.includes('Edit') || trajectory.pattern.includes('Write')) {
        telosAlignment = Math.min(100, 60 + telos.identity.builder * 0.4);
      } else if (trajectory.pattern.includes('Task')) {
        telosAlignment = Math.min(100, 60 + telos.identity.leader * 0.3);
      }

      suggestions.push({
        id: `trajectory-${slugify(trajectory.pattern)}`,
        type: 'trajectory',
        priority: trajectory.priority,
        confidence: trajectory.bottleneckRisk,
        title: `Automate ${trajectory.pattern}`,
        description: `Pattern accelerating rapidly - will bottleneck in 1-2 weeks`,
        reasoning: trajectory.reasoning,
        estimatedImpact: `Prevent pain before it hits. Save ${trajectory.projectedUsage} manual repetitions next week.`,
        timeframe: 'immediate',
        action: {
          type: 'build',
          specifics: `Create automation for ${trajectory.pattern} pattern NOW before bottleneck`
        },
        telosAlignment,
        strategicValue: 0  // Calculated later
      });
    }
  }

  return suggestions;
}

/**
 * Convert tool health reports to unified suggestions
 */
function toolHealthToSuggestions(
  healthReports: ToolHealthReport[]
): PredictiveSuggestion[] {
  const suggestions: PredictiveSuggestion[] = [];

  for (const report of healthReports) {
    if (report.status === 'deprecated' || report.status === 'zombie') {
      const daysSince = report.daysSinceUse !== null ? report.daysSinceUse : 999;

      suggestions.push({
        id: `deprecate-${slugify(report.toolName)}`,
        type: 'deprecation',
        priority: report.status === 'zombie' ? 'medium' : 'low',
        confidence: report.decayScore,
        title: `Archive ${report.toolName}`,
        description: `${report.toolType} unused for ${daysSince} days`,
        reasoning: report.recommendation,
        estimatedImpact: `Reduce clutter, improve system clarity`,
        timeframe: '1 month',
        action: {
          type: 'deprecate',
          specifics: `Move to .claude/History/deprecated/ with documentation`
        },
        telosAlignment: 75,  // Cleanliness aligns with all identities
        strategicValue: 0  // Calculated later
      });
    }
  }

  return suggestions;
}

/**
 * Convert opportunity cost misalignments to unified suggestions
 */
function opportunityCostToSuggestions(
  costReport: OpportunityCostReport,
  telos: TelosProfile
): PredictiveSuggestion[] {
  const suggestions: PredictiveSuggestion[] = [];

  for (const misalignment of costReport.misalignments) {
    if (misalignment.priority !== 'low') {
      // Telos alignment is HIGH when suggestion helps realign with identity
      const telosAlignment = Math.abs(misalignment.delta) > 20 ? 95 : 80;

      const actionType: PredictiveSuggestion['action']['type'] =
        misalignment.recommendation.startsWith('DELEGATE') ? 'delegate' :
        misalignment.recommendation.startsWith('AUTOMATE') ? 'build' :
        misalignment.recommendation.startsWith('REFOCUS') ? 'refocus' :
        'monitor';

      suggestions.push({
        id: `realign-${slugify(misalignment.activity)}`,
        type: 'realignment',
        priority: misalignment.priority === 'high' ? 'high' : 'medium',
        confidence: 80,  // High confidence in telos-based analysis
        title: `Realign ${misalignment.activity} time`,
        description: `Spending ${misalignment.actualTime.toFixed(0)}% on ${misalignment.activity}, expected ${misalignment.expectedTime.toFixed(0)}%`,
        reasoning: misalignment.opportunityCost,
        estimatedImpact: misalignment.recommendation,
        timeframe: '1-2 weeks',
        action: {
          type: actionType,
          specifics: misalignment.recommendation
        },
        telosAlignment,
        strategicValue: 0  // Calculated later
      });
    }
  }

  return suggestions;
}

/**
 * Calculate strategic value for ranking
 */
function calculateStrategicValue(suggestion: PredictiveSuggestion, telos: TelosProfile): number {
  // Strategic value formula:
  // Base = (priority_score × 100) + confidence
  // Multiplied by telos_alignment factor
  // Multiplied by urgency factor

  const priorityScore = {
    critical: 5,
    high: 3,
    medium: 2,
    low: 1
  };

  const urgencyScore = {
    'immediate': 1.5,
    '1-2 weeks': 1.2,
    '1 month': 1.0,
    '3+ months': 0.7
  };

  const base = (priorityScore[suggestion.priority] * 100) + suggestion.confidence;
  const telosMultiplier = suggestion.telosAlignment / 100;
  const urgencyMultiplier = urgencyScore[suggestion.timeframe];

  return base * telosMultiplier * urgencyMultiplier;
}

/**
 * Main orchestration function
 */
export function orchestratePredictions(
  goalPredictions: GoalPrediction[],
  trajectories: TrajectoryForecast[],
  toolHealth: ToolHealthReport[],
  opportunityCost: OpportunityCostReport,
  telos: TelosProfile
): PredictiveSuggestion[] {
  console.error('🎯 Orchestrating predictions from all sources...\n');

  // Convert all sources to unified format
  const goalSuggestions = goalPredictionsToSuggestions(goalPredictions, telos);
  const trajectorySuggestions = trajectoriesToSuggestions(trajectories, telos);
  const healthSuggestions = toolHealthToSuggestions(toolHealth);
  const costSuggestions = opportunityCostToSuggestions(opportunityCost, telos);

  console.error(`  Goal-based: ${goalSuggestions.length}`);
  console.error(`  Trajectory: ${trajectorySuggestions.length}`);
  console.error(`  Tool health: ${healthSuggestions.length}`);
  console.error(`  Opportunity cost: ${costSuggestions.length}\n`);

  // Combine all suggestions
  const allSuggestions = [
    ...goalSuggestions,
    ...trajectorySuggestions,
    ...healthSuggestions,
    ...costSuggestions
  ];

  if (allSuggestions.length === 0) {
    return [];
  }

  // Calculate strategic value for each
  for (const suggestion of allSuggestions) {
    suggestion.strategicValue = calculateStrategicValue(suggestion, telos);
  }

  // Sort by strategic value (highest first)
  allSuggestions.sort((a, b) => b.strategicValue - a.strategicValue);

  // Deduplicate similar suggestions (if any)
  const deduplicated = deduplicateSuggestions(allSuggestions);

  console.error(`✓ Orchestrated ${deduplicated.length} unique suggestions\n`);

  return deduplicated;
}

/**
 * Deduplicate similar suggestions
 */
function deduplicateSuggestions(suggestions: PredictiveSuggestion[]): PredictiveSuggestion[] {
  // Simple deduplication by ID
  const seen = new Set<string>();
  const unique: PredictiveSuggestion[] = [];

  for (const suggestion of suggestions) {
    if (!seen.has(suggestion.id)) {
      seen.add(suggestion.id);
      unique.push(suggestion);
    }
  }

  return unique;
}

/**
 * Filter suggestions by criteria
 */
export function filterSuggestions(
  suggestions: PredictiveSuggestion[],
  options: {
    minConfidence?: number;
    priorities?: PredictiveSuggestion['priority'][];
    types?: PredictiveSuggestion['type'][];
    timeframes?: PredictiveSuggestion['timeframe'][];
  }
): PredictiveSuggestion[] {
  return suggestions.filter(s => {
    if (options.minConfidence && s.confidence < options.minConfidence) return false;
    if (options.priorities && !options.priorities.includes(s.priority)) return false;
    if (options.types && !options.types.includes(s.type)) return false;
    if (options.timeframes && !options.timeframes.includes(s.timeframe)) return false;
    return true;
  });
}

/**
 * Get top N suggestions
 */
export function getTopSuggestions(
  suggestions: PredictiveSuggestion[],
  count: number
): PredictiveSuggestion[] {
  return suggestions.slice(0, count);
}

/**
 * Utility: Convert string to slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get summary statistics
 */
export function summarizePredictions(suggestions: PredictiveSuggestion[]): {
  total: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  byAction: Record<string, number>;
  avgConfidence: number;
  avgTelosAlignment: number;
  topSuggestion: PredictiveSuggestion | null;
} {
  const byType: Record<string, number> = {
    'goal-based': 0,
    'trajectory': 0,
    'deprecation': 0,
    'realignment': 0
  };

  const byPriority: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  const byAction: Record<string, number> = {
    build: 0,
    deprecate: 0,
    delegate: 0,
    refocus: 0,
    monitor: 0
  };

  let totalConfidence = 0;
  let totalAlignment = 0;

  for (const suggestion of suggestions) {
    byType[suggestion.type]++;
    byPriority[suggestion.priority]++;
    byAction[suggestion.action.type]++;
    totalConfidence += suggestion.confidence;
    totalAlignment += suggestion.telosAlignment;
  }

  return {
    total: suggestions.length,
    byType,
    byPriority,
    byAction,
    avgConfidence: suggestions.length > 0 ? totalConfidence / suggestions.length : 0,
    avgTelosAlignment: suggestions.length > 0 ? totalAlignment / suggestions.length : 0,
    topSuggestion: suggestions.length > 0 ? suggestions[0] : null
  };
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const { loadTelos } = await import('./telos-extractor');
  const { predictFromGoals } = await import('./goal-predictor');
  const { aggregatePeriod } = await import('./metric-aggregator');
  const { forecastTrajectories } = await import('./trajectory-forecaster');
  const { monitorToolHealth } = await import('./tool-health-monitor');
  const { analyzeOpportunityCost } = await import('./opportunity-cost-analyzer');

  console.log('\n🎯 PREDICTION ORCHESTRATOR\n');
  console.log('Combining all prediction sources...\n');

  // Load data
  const telos = loadTelos();
  const summaries = aggregatePeriod(30);

  console.log('Running prediction engines...\n');

  // Run all prediction engines
  const goalPredictions = predictFromGoals(telos);
  const trajectories = forecastTrajectories(summaries);
  const toolHealth = monitorToolHealth();
  const opportunityCost = analyzeOpportunityCost(summaries, telos);

  // Orchestrate
  const suggestions = orchestratePredictions(
    goalPredictions,
    trajectories,
    toolHealth,
    opportunityCost,
    telos
  );

  if (suggestions.length === 0) {
    console.log('✓ No actionable predictions');
    console.log('  System is running smoothly\n');
    process.exit(0);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📋 UNIFIED SUGGESTION LIST (${suggestions.length} total)\n`);

  // Show top 10 suggestions
  const topSuggestions = getTopSuggestions(suggestions, 10);

  for (let i = 0; i < topSuggestions.length; i++) {
    const s = topSuggestions[i];
    const emoji = s.priority === 'critical' ? '🔴' :
                 s.priority === 'high' ? '🟡' : '🟢';

    const typeLabel = s.type === 'goal-based' ? '🎯' :
                     s.type === 'trajectory' ? '📈' :
                     s.type === 'deprecation' ? '🗑️' : '⚖️';

    console.log(`${i + 1}. ${emoji} ${typeLabel} ${s.title}`);
    console.log(`   Type: ${s.type} | Priority: ${s.priority} | Confidence: ${s.confidence}%`);
    console.log(`   Timeframe: ${s.timeframe} | Telos alignment: ${s.telosAlignment}%`);
    console.log(`   Strategic value: ${s.strategicValue.toFixed(0)}`);
    console.log(`   ${s.description}`);
    console.log(`   ${s.reasoning}`);
    console.log(`   Action: ${s.action.type.toUpperCase()} - ${s.action.specifics}\n`);
  }

  // Summary
  const summary = summarizePredictions(suggestions);
  console.log(`${'═'.repeat(70)}`);
  console.log(`\n📊 SUMMARY\n`);
  console.log(`Total suggestions: ${summary.total}`);
  console.log(`\nBy Type:`);
  for (const [type, count] of Object.entries(summary.byType)) {
    if (count > 0) {
      console.log(`  ${type}: ${count}`);
    }
  }
  console.log(`\nBy Priority:`);
  for (const [priority, count] of Object.entries(summary.byPriority)) {
    if (count > 0) {
      console.log(`  ${priority}: ${count}`);
    }
  }
  console.log(`\nBy Action:`);
  for (const [action, count] of Object.entries(summary.byAction)) {
    if (count > 0) {
      console.log(`  ${action}: ${count}`);
    }
  }
  console.log(`\nAvg confidence: ${summary.avgConfidence.toFixed(1)}%`);
  console.log(`Avg telos alignment: ${summary.avgTelosAlignment.toFixed(1)}%`);

  if (summary.topSuggestion) {
    console.log(`\n🏆 Top Recommendation:`);
    console.log(`   ${summary.topSuggestion.title}`);
    console.log(`   Strategic value: ${summary.topSuggestion.strategicValue.toFixed(0)}`);
  }

  console.log(`\n${'═'.repeat(70)}\n`);
}
