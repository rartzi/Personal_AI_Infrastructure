#!/usr/bin/env bun

/**
 * opportunity-cost-analyzer.ts
 *
 * Phase 3.5: Opportunity Cost Analysis
 *
 * Analyzes time allocation across different activity types and compares
 * to telos expectations. Flags misalignments where actual time spent
 * differs significantly from identity-based expectations.
 *
 * Key Features:
 * - Categorizes tool usage by activity type (building, researching, coordinating)
 * - Calculates expected allocation based on telos identity
 * - Detects misalignments >15%
 * - Quantifies opportunity cost in hours
 * - Generates realignment recommendations
 */

import { type DailySummary } from './metric-aggregator';
import { type TelosProfile } from './telos-extractor';

export interface ActivityAllocation {
  building: number;      // % of tool calls
  researching: number;   // % of tool calls
  coordinating: number;  // % of tool calls
  other: number;         // % of tool calls
}

export interface TelosExpectations {
  building: number;      // Expected % based on builder identity
  researching: number;   // Expected % based on scientist identity
  coordinating: number;  // Expected % based on leader identity
  other: number;         // Base level for misc
}

export interface Misalignment {
  activity: string;
  actualTime: number;      // % of time spent
  expectedTime: number;    // % based on telos
  delta: number;           // Difference (positive = over-indexing)
  opportunityCost: string; // Human-readable impact
  recommendation: string;  // Action to take
  priority: 'high' | 'medium' | 'low';
}

export interface OpportunityCostReport {
  timeAllocation: ActivityAllocation;
  telosExpectations: TelosExpectations;
  misalignments: Misalignment[];
  totalToolCalls: number;
  periodDays: number;
}

/**
 * Categorize tool usage by activity type
 */
function categorizeActivities(summaries: DailySummary[]): {
  allocation: ActivityAllocation;
  totalCalls: number;
} {
  let totalCalls = 0;
  const counts = {
    building: 0,
    researching: 0,
    coordinating: 0,
    other: 0
  };

  for (const summary of summaries) {
    for (const [tool, count] of Object.entries(summary.toolUsage)) {
      totalCalls += count;

      // Building: Edit, Write, NotebookEdit
      if (['Edit', 'Write', 'NotebookEdit'].includes(tool)) {
        counts.building += count;
      }
      // Researching: Read, WebFetch, Grep, WebSearch
      else if (['Read', 'WebFetch', 'Grep', 'WebSearch'].includes(tool)) {
        counts.researching += count;
      }
      // Coordinating: Task, TaskCreate, TaskUpdate, TaskList, TaskGet
      else if (['Task', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet'].includes(tool)) {
        counts.coordinating += count;
      }
      // Other: Bash, Glob, Skill, etc.
      else {
        counts.other += count;
      }
    }
  }

  // Avoid division by zero
  if (totalCalls === 0) {
    return {
      allocation: { building: 0, researching: 0, coordinating: 0, other: 0 },
      totalCalls: 0
    };
  }

  // Convert to percentages
  const allocation: ActivityAllocation = {
    building: (counts.building / totalCalls) * 100,
    researching: (counts.researching / totalCalls) * 100,
    coordinating: (counts.coordinating / totalCalls) * 100,
    other: (counts.other / totalCalls) * 100
  };

  return { allocation, totalCalls };
}

/**
 * Calculate expected time allocation based on telos identity
 */
function calculateExpectedAllocation(telos: TelosProfile): TelosExpectations {
  // Expected allocation formulas based on identity scores:
  // - Builder should spend ~60% building (95 * 0.6 = 57%)
  // - Scientist should spend ~50% researching (70 * 0.5 = 35%)
  // - Leader should spend ~40% coordinating (85 * 0.4 = 34%)
  // - Base 10% for misc activities

  const expectations: TelosExpectations = {
    building: telos.identity.builder * 0.6,
    researching: telos.identity.scientist * 0.5,
    coordinating: telos.identity.leader * 0.4,
    other: 10
  };

  // Normalize to ensure percentages don't exceed 100%
  const total = expectations.building + expectations.researching + expectations.coordinating + expectations.other;

  if (total > 100) {
    // Scale down proportionally
    const scale = 100 / total;
    expectations.building *= scale;
    expectations.researching *= scale;
    expectations.coordinating *= scale;
    expectations.other *= scale;
  }

  return expectations;
}

/**
 * Calculate opportunity cost in hours per week
 */
function calculateOpportunityCostHours(
  deltaPct: number,
  totalCalls: number,
  periodDays: number
): number {
  // Rough approximation: assume 100 tool calls = ~4 hours of work
  // This is a heuristic - can be tuned based on actual data
  const hoursPerWeek = (totalCalls / periodDays) * 7 * (4 / 100);
  return (deltaPct / 100) * hoursPerWeek;
}

/**
 * Generate opportunity cost description
 */
function describeOpportunityCost(
  activity: string,
  delta: number,
  telos: TelosProfile,
  totalCalls: number,
  periodDays: number
): string {
  const hoursLost = calculateOpportunityCostHours(Math.abs(delta), totalCalls, periodDays);

  if (delta > 0) {
    // Over-indexing on this activity
    if (activity === 'researching' && telos.identity.builder > 90) {
      return `${delta.toFixed(0)}% over-allocation on research. That's ~${hoursLost.toFixed(1)} hours/week that could be building time.`;
    }
    if (activity === 'coordinating' && telos.identity.builder > 90) {
      return `${delta.toFixed(0)}% over-allocation on coordination. ~${hoursLost.toFixed(1)} hours/week spent orchestrating instead of building.`;
    }
    if (activity === 'researching' && telos.identity.scientist < 75) {
      return `${delta.toFixed(0)}% over-allocation on research despite low scientist identity. Consider delegation.`;
    }
  } else {
    // Under-indexing on this activity
    if (activity === 'building' && telos.identity.builder > 90) {
      return `${Math.abs(delta).toFixed(0)}% under-allocation on building. Your ${telos.identity.builder}% builder identity suggests you should be coding more.`;
    }
    if (activity === 'researching' && telos.identity.scientist > 80) {
      return `${Math.abs(delta).toFixed(0)}% under-allocation on research despite ${telos.identity.scientist}% scientist identity.`;
    }
  }

  return `${Math.abs(delta).toFixed(0)}% ${delta > 0 ? 'over' : 'under'}-allocation on ${activity}.`;
}

/**
 * Generate realignment recommendation
 */
function generateRecommendation(
  activity: string,
  delta: number,
  telos: TelosProfile
): { recommendation: string; priority: Misalignment['priority'] } {
  if (delta > 20) {
    // Significant over-indexing
    if (activity === 'researching') {
      return {
        recommendation: `DELEGATE: You're spending ${delta.toFixed(0)}% more time researching than your telos suggests. Use parallel research agents to free up time for higher-value work.`,
        priority: 'high'
      };
    }
    if (activity === 'coordinating') {
      return {
        recommendation: `AUTOMATE: High coordination overhead (${delta.toFixed(0)}% over). Build workflow automation to reduce manual orchestration.`,
        priority: 'high'
      };
    }
    return {
      recommendation: `REBALANCE: Significantly over-allocated on ${activity}. Review if this aligns with goals.`,
      priority: 'medium'
    };
  } else if (delta < -20) {
    // Significant under-indexing
    if (activity === 'building' && telos.identity.builder > 90) {
      return {
        recommendation: `REFOCUS: You're building ${Math.abs(delta).toFixed(0)}% less than expected for a ${telos.identity.builder}% builder. Block dedicated build time or eliminate distractions.`,
        priority: 'high'
      };
    }
    if (activity === 'researching' && telos.identity.scientist > 80) {
      return {
        recommendation: `PRIORITIZE: Under-investing in research despite high scientist identity. Schedule dedicated research time.`,
        priority: 'medium'
      };
    }
    return {
      recommendation: `INCREASE: Consider spending more time on ${activity} to match your identity.`,
      priority: 'low'
    };
  } else if (Math.abs(delta) > 15) {
    // Moderate misalignment
    return {
      recommendation: `MONITOR: Moderate ${delta > 0 ? 'over' : 'under'}-allocation on ${activity}. Watch for trends.`,
      priority: 'medium'
    };
  }

  return {
    recommendation: `ALIGNED: Time allocation matches telos expectations.`,
    priority: 'low'
  };
}

/**
 * Main analysis function
 */
export function analyzeOpportunityCost(
  summaries: DailySummary[],
  telos: TelosProfile
): OpportunityCostReport {
  // Categorize activities
  const { allocation, totalCalls } = categorizeActivities(summaries);

  // Calculate expected allocation
  const expected = calculateExpectedAllocation(telos);

  // Find misalignments
  const misalignments: Misalignment[] = [];

  for (const activity of ['building', 'researching', 'coordinating', 'other'] as const) {
    const actualPct = allocation[activity];
    const expectedPct = expected[activity];
    const delta = actualPct - expectedPct;

    // Flag significant misalignments (>15% difference)
    if (Math.abs(delta) > 15) {
      const opportunityCost = describeOpportunityCost(
        activity,
        delta,
        telos,
        totalCalls,
        summaries.length
      );

      const { recommendation, priority } = generateRecommendation(
        activity,
        delta,
        telos
      );

      misalignments.push({
        activity,
        actualTime: actualPct,
        expectedTime: expectedPct,
        delta,
        opportunityCost,
        recommendation,
        priority
      });
    }
  }

  // Sort by priority and magnitude
  misalignments.sort((a, b) => {
    const priorityScore = { high: 3, medium: 2, low: 1 };
    const aScore = priorityScore[a.priority] * 100 + Math.abs(a.delta);
    const bScore = priorityScore[b.priority] * 100 + Math.abs(b.delta);
    return bScore - aScore;
  });

  return {
    timeAllocation: allocation,
    telosExpectations: expected,
    misalignments,
    totalToolCalls: totalCalls,
    periodDays: summaries.length
  };
}

/**
 * Get summary statistics
 */
export function summarizeOpportunityCost(report: OpportunityCostReport): {
  totalMisalignments: number;
  highPriority: number;
  avgDelta: number;
  mostMisaligned: string | null;
} {
  const highPriority = report.misalignments.filter(m => m.priority === 'high').length;

  const avgDelta = report.misalignments.length > 0
    ? report.misalignments.reduce((sum, m) => sum + Math.abs(m.delta), 0) / report.misalignments.length
    : 0;

  const mostMisaligned = report.misalignments.length > 0
    ? report.misalignments[0].activity
    : null;

  return {
    totalMisalignments: report.misalignments.length,
    highPriority,
    avgDelta,
    mostMisaligned
  };
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const { loadTelos } = await import('./telos-extractor');
  const { aggregatePeriod } = await import('./metric-aggregator');

  console.log('\n💰 OPPORTUNITY COST ANALYSIS\n');
  console.log('Analyzing time allocation vs telos expectations...\n');

  const telos = loadTelos();
  const summaries = aggregatePeriod(30);

  if (summaries.length === 0) {
    console.log('⚠️  No metric data available');
    console.log('   Run some sessions to generate metrics first\n');
    process.exit(0);
  }

  console.log(`Analyzing ${summaries.length} days of work...\n`);

  const report = analyzeOpportunityCost(summaries, telos);

  console.log('📊 TIME ALLOCATION\n');
  console.log(`Building:     ${report.timeAllocation.building.toFixed(1)}%`);
  console.log(`Researching:  ${report.timeAllocation.researching.toFixed(1)}%`);
  console.log(`Coordinating: ${report.timeAllocation.coordinating.toFixed(1)}%`);
  console.log(`Other:        ${report.timeAllocation.other.toFixed(1)}%`);

  console.log(`\n🎯 TELOS EXPECTATIONS\n`);
  console.log(`Building:     ${report.telosExpectations.building.toFixed(1)}% (${telos.identity.builder}% builder)`);
  console.log(`Researching:  ${report.telosExpectations.researching.toFixed(1)}% (${telos.identity.scientist}% scientist)`);
  console.log(`Coordinating: ${report.telosExpectations.coordinating.toFixed(1)}% (${telos.identity.leader}% leader)`);
  console.log(`Other:        ${report.telosExpectations.other.toFixed(1)}%`);

  if (report.misalignments.length === 0) {
    console.log(`\n✅ WELL ALIGNED\n`);
    console.log(`Time allocation matches telos expectations.`);
    console.log(`No significant misalignments detected.\n`);
  } else {
    console.log(`\n⚠️  MISALIGNMENTS DETECTED\n`);

    for (const misalignment of report.misalignments) {
      const emoji = misalignment.priority === 'high' ? '🔴' :
                   misalignment.priority === 'medium' ? '🟡' : '🟢';

      const direction = misalignment.delta > 0 ? '↑' : '↓';

      console.log(`${emoji} ${misalignment.activity.toUpperCase()} ${direction}`);
      console.log(`   Actual: ${misalignment.actualTime.toFixed(1)}% | Expected: ${misalignment.expectedTime.toFixed(1)}%`);
      console.log(`   Delta: ${misalignment.delta > 0 ? '+' : ''}${misalignment.delta.toFixed(1)}%`);
      console.log(`   ${misalignment.opportunityCost}`);
      console.log(`   ${misalignment.recommendation}\n`);
    }

    // Summary
    const summary = summarizeOpportunityCost(report);
    console.log(`${'═'.repeat(60)}`);
    console.log(`\n📈 SUMMARY\n`);
    console.log(`Total misalignments: ${summary.totalMisalignments}`);
    console.log(`High priority: ${summary.highPriority}`);
    console.log(`Average delta: ${summary.avgDelta.toFixed(1)}%`);
    if (summary.mostMisaligned) {
      console.log(`Most misaligned: ${summary.mostMisaligned}`);
    }
    console.log();
  }

  console.log('═'.repeat(60) + '\n');
}
