#!/usr/bin/env bun

/**
 * trajectory-forecaster.ts
 *
 * Phase 3.5: Trajectory Forecasting
 *
 * Analyzes tool usage patterns over time to detect acceleration trends
 * and predict bottlenecks before they happen. Uses linear regression to
 * project future usage and assess bottleneck risk.
 *
 * Key Features:
 * - Weekly pattern analysis (last 4 weeks)
 * - Linear regression for trend detection
 * - Bottleneck risk scoring (0-100)
 * - Proactive recommendations (build_now, monitor, defer)
 */

import { type DailySummary } from './metric-aggregator';

export interface TrajectoryForecast {
  pattern: string;
  currentUsage: number[];  // Last 4 weeks
  trend: 'accelerating' | 'stable' | 'declining';
  trendSlope: number;  // Growth rate per week
  projectedUsage: number;  // Next week prediction
  bottleneckRisk: number;  // 0-100
  recommendation: 'build_now' | 'monitor' | 'defer';
  reasoning: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Group daily summaries into weekly buckets
 */
function groupByWeek(summaries: DailySummary[]): Map<number, DailySummary[]> {
  const weeks = new Map<number, DailySummary[]>();

  // Sort by date (oldest first)
  const sorted = [...summaries].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const summary of sorted) {
    const date = new Date(summary.date);
    const weekNum = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));

    if (!weeks.has(weekNum)) {
      weeks.set(weekNum, []);
    }
    weeks.get(weekNum)!.push(summary);
  }

  return weeks;
}

/**
 * Extract patterns from weekly data
 */
interface PatternUsage {
  name: string;
  usageByWeek: number[];  // Last 4 weeks
}

function extractPatterns(weeklyData: Map<number, DailySummary[]>): PatternUsage[] {
  const patterns = new Map<string, number[]>();

  // Get last 4 weeks
  const weeks = Array.from(weeklyData.keys()).sort((a, b) => b - a).slice(0, 4);

  for (const weekNum of weeks.reverse()) {  // Oldest to newest
    const weekSummaries = weeklyData.get(weekNum) || [];

    // Aggregate tool usage for this week
    const weekToolUsage: Record<string, number> = {};

    for (const summary of weekSummaries) {
      for (const [tool, count] of Object.entries(summary.toolUsage)) {
        weekToolUsage[tool] = (weekToolUsage[tool] || 0) + count;
      }

      // Also track sequences
      if (summary.sameToolSequences) {
        for (const seq of summary.sameToolSequences) {
          const patternName = seq.pattern;
          weekToolUsage[patternName] = (weekToolUsage[patternName] || 0) + seq.count;
        }
      }
    }

    // Update patterns
    for (const [pattern, count] of Object.entries(weekToolUsage)) {
      if (!patterns.has(pattern)) {
        patterns.set(pattern, [0, 0, 0, 0]);
      }
      const weekIndex = weeks.length - weeks.indexOf(weekNum) - 1;
      patterns.get(pattern)![weekIndex] = count;
    }
  }

  return Array.from(patterns.entries()).map(([name, usage]) => ({
    name,
    usageByWeek: usage
  }));
}

/**
 * Calculate trend using simple linear regression
 */
function calculateTrend(weeklyUsage: number[]): {
  direction: 'accelerating' | 'stable' | 'declining';
  slope: number;
} {
  const n = weeklyUsage.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = weeklyUsage;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Classify trend
  if (slope > 2) return { direction: 'accelerating', slope };
  if (slope < -2) return { direction: 'declining', slope };
  return { direction: 'stable', slope };
}

/**
 * Project next week's usage
 */
function projectNextWeek(weeklyUsage: number[], trendSlope: number): number {
  const lastWeek = weeklyUsage[weeklyUsage.length - 1];
  return Math.max(0, Math.round(lastWeek + trendSlope));
}

/**
 * Assess bottleneck risk based on volume, growth, and acceleration
 */
function assessBottleneckRisk(weeklyUsage: number[], projection: number): number {
  const currentWeek = weeklyUsage[weeklyUsage.length - 1];
  const growthRate = weeklyUsage.length > 1 && weeklyUsage[0] > 0
    ? currentWeek / weeklyUsage[0]
    : 1;

  let risk = 0;

  // Volume risk (absolute projected usage)
  if (projection > 20) risk += 40;
  else if (projection > 15) risk += 30;
  else if (projection > 10) risk += 20;
  else if (projection > 5) risk += 10;

  // Growth rate risk (how much it's growing)
  if (growthRate > 4) risk += 35;
  else if (growthRate > 3) risk += 30;
  else if (growthRate > 2) risk += 20;
  else if (growthRate > 1.5) risk += 10;

  // Acceleration risk (is growth speeding up?)
  if (weeklyUsage.length >= 3) {
    const recent = weeklyUsage.slice(-2);
    const older = weeklyUsage.slice(0, -2);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length || 1;

    if (recentAvg > olderAvg * 2.5) risk += 25;
    else if (recentAvg > olderAvg * 2) risk += 20;
    else if (recentAvg > olderAvg * 1.5) risk += 10;
  }

  return Math.min(100, risk);
}

/**
 * Generate recommendation and reasoning
 */
function generateRecommendation(
  pattern: string,
  trend: ReturnType<typeof calculateTrend>,
  projection: number,
  bottleneckRisk: number,
  currentWeek: number
): {
  recommendation: TrajectoryForecast['recommendation'];
  reasoning: string;
  priority: TrajectoryForecast['priority'];
} {
  if (trend.direction === 'accelerating' && bottleneckRisk >= 70) {
    return {
      recommendation: 'build_now',
      reasoning: `Pattern accelerating rapidly (${trend.slope.toFixed(1)}x/week). Current: ${currentWeek}, projected: ${projection} next week. Build automation NOW to prevent bottleneck.`,
      priority: 'critical'
    };
  }

  if (trend.direction === 'accelerating' && bottleneckRisk >= 50) {
    return {
      recommendation: 'build_now',
      reasoning: `Strong acceleration detected (${trend.slope.toFixed(1)}x/week). Projected: ${projection} next week. Build soon to stay ahead.`,
      priority: 'high'
    };
  }

  if (trend.direction === 'accelerating' && bottleneckRisk >= 30) {
    return {
      recommendation: 'monitor',
      reasoning: `Moderate growth trend (${trend.slope.toFixed(1)}x/week). Will likely hit threshold in 2-3 weeks. Monitor closely.`,
      priority: 'medium'
    };
  }

  if (trend.direction === 'stable' && currentWeek > 10) {
    return {
      recommendation: 'monitor',
      reasoning: `High stable usage (${currentWeek}/week). Not growing but volume is significant. Consider automation.`,
      priority: 'medium'
    };
  }

  return {
    recommendation: 'defer',
    reasoning: trend.direction === 'declining'
      ? `Usage declining. Not a priority for automation.`
      : `Stable or low usage. Monitor but no immediate action needed.`,
    priority: 'low'
  };
}

/**
 * Main forecasting function
 */
export function forecastTrajectories(summaries: DailySummary[]): TrajectoryForecast[] {
  if (summaries.length < 7) {
    // Need at least a week of data
    return [];
  }

  const forecasts: TrajectoryForecast[] = [];

  // Group by week
  const weeklyData = groupByWeek(summaries);

  if (weeklyData.size < 2) {
    // Need at least 2 weeks for trend
    return [];
  }

  // Extract patterns
  const patterns = extractPatterns(weeklyData);

  for (const pattern of patterns) {
    const { usageByWeek } = pattern;

    // Skip patterns with no usage
    if (usageByWeek.every(v => v === 0)) continue;

    // Calculate trend
    const trend = calculateTrend(usageByWeek);
    const projection = projectNextWeek(usageByWeek, trend.slope);
    const bottleneckRisk = assessBottleneckRisk(usageByWeek, projection);

    const currentWeek = usageByWeek[usageByWeek.length - 1];
    const { recommendation, reasoning, priority } = generateRecommendation(
      pattern.name,
      trend,
      projection,
      bottleneckRisk,
      currentWeek
    );

    forecasts.push({
      pattern: pattern.name,
      currentUsage: usageByWeek,
      trend: trend.direction,
      trendSlope: trend.slope,
      projectedUsage: projection,
      bottleneckRisk,
      recommendation,
      reasoning,
      priority
    });
  }

  // Sort by priority and risk
  return forecasts.sort((a, b) => {
    const priorityScore = { critical: 4, high: 3, medium: 2, low: 1 };
    const aScore = priorityScore[a.priority] * 100 + a.bottleneckRisk;
    const bScore = priorityScore[b.priority] * 100 + b.bottleneckRisk;
    return bScore - aScore;
  });
}

/**
 * Filter to actionable forecasts only
 */
export function getActionableForecasts(forecasts: TrajectoryForecast[]): TrajectoryForecast[] {
  return forecasts.filter(f => f.recommendation !== 'defer');
}

/**
 * Get summary statistics
 */
export function summarizeForecasts(forecasts: TrajectoryForecast[]): {
  total: number;
  byRecommendation: Record<string, number>;
  byTrend: Record<string, number>;
  avgBottleneckRisk: number;
  criticalPatterns: string[];
} {
  const byRecommendation: Record<string, number> = {
    build_now: 0,
    monitor: 0,
    defer: 0
  };

  const byTrend: Record<string, number> = {
    accelerating: 0,
    stable: 0,
    declining: 0
  };

  let totalRisk = 0;
  const criticalPatterns: string[] = [];

  for (const forecast of forecasts) {
    byRecommendation[forecast.recommendation]++;
    byTrend[forecast.trend]++;
    totalRisk += forecast.bottleneckRisk;

    if (forecast.priority === 'critical') {
      criticalPatterns.push(forecast.pattern);
    }
  }

  return {
    total: forecasts.length,
    byRecommendation,
    byTrend,
    avgBottleneckRisk: forecasts.length > 0 ? totalRisk / forecasts.length : 0,
    criticalPatterns
  };
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const { aggregatePeriod } = await import('./metric-aggregator');

  console.log('\n📈 TRAJECTORY FORECASTING\n');
  console.log('Analyzing last 30 days of usage patterns...\n');

  const summaries = aggregatePeriod(30);

  if (summaries.length === 0) {
    console.log('⚠️  No metric data available');
    console.log('   Run some sessions to generate metrics first\n');
    process.exit(0);
  }

  console.log(`Found ${summaries.length} days of metrics\n`);

  const forecasts = forecastTrajectories(summaries);
  const actionable = getActionableForecasts(forecasts);

  if (actionable.length === 0) {
    console.log('✓ No patterns requiring action detected');
    console.log('  All patterns are stable or declining\n');
  } else {
    console.log(`⚡ Found ${actionable.length} actionable patterns:\n`);

    for (const forecast of actionable) {
      const urgency = forecast.priority === 'critical' ? '🔴' :
                     forecast.priority === 'high' ? '🟡' : '🟢';

      console.log(`\n${urgency} ${forecast.pattern}`);
      console.log(`   Trend: ${forecast.trend} (${forecast.trendSlope > 0 ? '+' : ''}${forecast.trendSlope.toFixed(1)}x/week)`);
      console.log(`   Current: [${forecast.currentUsage.join(', ')}] → Projected: ${forecast.projectedUsage}`);
      console.log(`   Risk: ${forecast.bottleneckRisk}%`);
      console.log(`   Recommendation: ${forecast.recommendation.toUpperCase()}`);
      console.log(`   ${forecast.reasoning}`);
    }

    // Summary
    const summary = summarizeForecasts(forecasts);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`\n📊 SUMMARY\n`);
    console.log(`Total patterns analyzed: ${summary.total}`);
    console.log(`\nBy Recommendation:`);
    for (const [rec, count] of Object.entries(summary.byRecommendation)) {
      if (count > 0) {
        console.log(`  ${rec}: ${count}`);
      }
    }
    console.log(`\nBy Trend:`);
    for (const [trend, count] of Object.entries(summary.byTrend)) {
      if (count > 0) {
        console.log(`  ${trend}: ${count}`);
      }
    }
    console.log(`\nAverage Bottleneck Risk: ${summary.avgBottleneckRisk.toFixed(1)}%`);

    if (summary.criticalPatterns.length > 0) {
      console.log(`\n🚨 Critical Patterns:`);
      summary.criticalPatterns.forEach(p => console.log(`  • ${p}`));
    }
    console.log();
  }
}
