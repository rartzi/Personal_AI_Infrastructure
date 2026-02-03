#!/usr/bin/env bun

/**
 * metric-aggregator.ts
 *
 * Phase 2: Metric Aggregation for Self-Improvement Flywheel
 *
 * Processes raw JSONL logs into structured daily summaries:
 * - Tool usage counts
 * - Session tracking
 * - Time/verification/error metrics from manual logging
 * - Sequence pattern detection (Read→Edit→Read, etc.)
 * - High-frequency tool identification
 *
 * Usage:
 *   bun run tools/metric-aggregator.ts              # Aggregate yesterday
 *   bun run tools/metric-aggregator.ts --date 2026-02-03
 *   bun run tools/metric-aggregator.ts --period 7   # Last 7 days
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const HOME = process.env.HOME!;
const METRICS_DIR = join(HOME, '.claude/metrics');

// Types
export interface DailySummary {
  date: string;
  toolUsage: Record<string, number>;
  totalToolCalls: number;
  sessionCount: number;

  // From manual metrics
  timeEstimates: {
    saved: number;      // minutes
    sources: string[];  // what reported savings
  };

  verificationsSaved: number;
  errorsPrevented: number;

  // Pattern signals
  sameToolSequences: Array<{
    pattern: string;     // "Read→Edit→Read"
    count: number;
    confidence: number;
  }>;

  highFrequencyTools: Array<{
    tool: string;
    count: number;
    avgPerSession: number;
  }>;
}

interface ToolUsageEntry {
  timestamp: string;
  tool: string;
  duration: number;
  sessionId: string;
  context: any;
}

interface ManualMetricEntry {
  timestamp: string;
  source: string;
  metric: string;
  value: number | string;
  metadata?: any;
}

/**
 * Parse tool usage JSONL for a specific date
 */
function parseToolUsage(monthDir: string, targetDate: string): {
  toolUsage: Record<string, number>;
  sessions: Set<string>;
  toolSequences: string[][];
} {
  const toolUsagePath = join(monthDir, 'tool-usage.jsonl');

  const toolUsage: Record<string, number> = {};
  const sessions = new Set<string>();
  const toolSequences: string[][] = [];
  let currentSession: string[] = [];
  let lastSessionId = '';

  if (!existsSync(toolUsagePath)) {
    return { toolUsage, sessions, toolSequences };
  }

  const lines = readFileSync(toolUsagePath, 'utf-8').split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const entry: ToolUsageEntry = JSON.parse(line);
      const entryDate = entry.timestamp.split('T')[0];

      // Only process entries for target date
      if (entryDate !== targetDate) continue;

      // Skip entries with missing tool name
      if (!entry.tool) continue;

      // Count usage
      toolUsage[entry.tool] = (toolUsage[entry.tool] || 0) + 1;
      sessions.add(entry.sessionId);

      // Track sequences per session
      if (entry.sessionId !== lastSessionId && currentSession.length > 0) {
        toolSequences.push([...currentSession]);
        currentSession = [];
      }
      currentSession.push(entry.tool);
      lastSessionId = entry.sessionId;
    } catch (e) {
      // Skip malformed lines
      console.error(`Skipping malformed tool usage line: ${e}`);
    }
  }

  // Add final sequence
  if (currentSession.length > 0) {
    toolSequences.push(currentSession);
  }

  return { toolUsage, sessions, toolSequences };
}

/**
 * Parse manual metrics JSONL for a specific date
 */
function parseManualMetrics(monthDir: string, targetDate: string): {
  timeSaved: number;
  verificationsSaved: number;
  errorsPrevented: number;
  timeSources: string[];
} {
  const manualMetricsPath = join(monthDir, 'manual-metrics.jsonl');

  let timeSaved = 0;
  let verificationsSaved = 0;
  let errorsPrevented = 0;
  const timeSources: string[] = [];

  if (!existsSync(manualMetricsPath)) {
    return { timeSaved, verificationsSaved, errorsPrevented, timeSources };
  }

  const lines = readFileSync(manualMetricsPath, 'utf-8').split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const entry: ManualMetricEntry = JSON.parse(line);
      const entryDate = entry.timestamp.split('T')[0];

      if (entryDate !== targetDate) continue;

      if (entry.metric === 'time-saved') {
        timeSaved += parseFloat(entry.value as string) || 0;
        timeSources.push(entry.source);
      } else if (entry.metric === 'verification-saved') {
        verificationsSaved += parseInt(entry.value as string) || 0;
      } else if (entry.metric === 'errors-prevented') {
        errorsPrevented += parseInt(entry.value as string) || 0;
      }
    } catch (e) {
      console.error(`Skipping malformed manual metric line: ${e}`);
    }
  }

  return { timeSaved, verificationsSaved, errorsPrevented, timeSources };
}

/**
 * Detect repeated tool sequences
 */
function detectSequences(toolSequences: string[][]): Array<{
  pattern: string;
  count: number;
  confidence: number;
}> {
  const sequencePatterns: Record<string, number> = {};

  // Look for 3-tool sequences
  for (const seq of toolSequences) {
    for (let i = 0; i < seq.length - 2; i++) {
      const pattern = `${seq[i]}→${seq[i+1]}→${seq[i+2]}`;
      sequencePatterns[pattern] = (sequencePatterns[pattern] || 0) + 1;
    }
  }

  // Only return sequences that appear 2+ times
  const detected = Object.entries(sequencePatterns)
    .filter(([_, count]) => count >= 2)
    .map(([pattern, count]) => ({
      pattern,
      count,
      confidence: Math.min(95, 50 + count * 10)
    }))
    .sort((a, b) => b.count - a.count);

  return detected;
}

/**
 * Identify high-frequency tools
 */
function identifyHighFrequencyTools(
  toolUsage: Record<string, number>,
  sessionCount: number
): Array<{
  tool: string;
  count: number;
  avgPerSession: number;
}> {
  if (sessionCount === 0) return [];

  const highFreq = Object.entries(toolUsage)
    .map(([tool, count]) => ({
      tool,
      count,
      avgPerSession: count / sessionCount
    }))
    .filter(t => t.avgPerSession >= 5)  // 5+ uses per session
    .sort((a, b) => b.avgPerSession - a.avgPerSession);

  return highFreq;
}

/**
 * Aggregate metrics for a specific date
 */
export function aggregateDay(date: Date): DailySummary {
  const dateStr = date.toISOString().split('T')[0];
  const [year, month] = dateStr.split('-');
  const monthDir = join(METRICS_DIR, `${year}-${month}`);

  console.error(`📊 Aggregating metrics for ${dateStr}...`);

  // Parse tool usage
  const { toolUsage, sessions, toolSequences } = parseToolUsage(monthDir, dateStr);

  // Parse manual metrics
  const { timeSaved, verificationsSaved, errorsPrevented, timeSources } =
    parseManualMetrics(monthDir, dateStr);

  // Detect patterns
  const sequences = detectSequences(toolSequences);
  const highFreqTools = identifyHighFrequencyTools(toolUsage, sessions.size);

  const summary: DailySummary = {
    date: dateStr,
    toolUsage,
    totalToolCalls: Object.values(toolUsage).reduce((a, b) => a + b, 0),
    sessionCount: sessions.size,
    timeEstimates: {
      saved: timeSaved,
      sources: [...new Set(timeSources)]
    },
    verificationsSaved,
    errorsPrevented,
    sameToolSequences: sequences,
    highFrequencyTools: highFreqTools
  };

  // Save summary
  const summaryDir = join(monthDir, 'daily-summaries');
  if (!existsSync(summaryDir)) {
    mkdirSync(summaryDir, { recursive: true });
  }

  const summaryPath = join(summaryDir, `${dateStr}.json`);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.error(`✓ Summary saved to ${summaryPath}`);
  console.error(`  Tools used: ${Object.keys(toolUsage).length} types, ${summary.totalToolCalls} total calls`);
  console.error(`  Sessions: ${summary.sessionCount}`);
  if (sequences.length > 0) {
    console.error(`  Sequences detected: ${sequences.length}`);
  }
  if (highFreqTools.length > 0) {
    console.error(`  High-frequency tools: ${highFreqTools.length}`);
  }

  return summary;
}

/**
 * Aggregate last N days
 */
export function aggregatePeriod(days: number = 7): DailySummary[] {
  const summaries: DailySummary[] = [];

  console.error(`\n📅 Aggregating last ${days} days...\n`);

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    try {
      const summary = aggregateDay(date);
      summaries.push(summary);
    } catch (e) {
      console.error(`⚠️  No data for ${date.toISOString().split('T')[0]}: ${e}`);
    }
  }

  console.error(`\n✅ Aggregated ${summaries.length} days\n`);

  return summaries;
}

/**
 * CLI execution
 */
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage:');
    console.log('  bun run tools/metric-aggregator.ts              # Aggregate yesterday');
    console.log('  bun run tools/metric-aggregator.ts --date YYYY-MM-DD');
    console.log('  bun run tools/metric-aggregator.ts --period N   # Last N days');
    console.log('  bun run tools/metric-aggregator.ts --today      # Aggregate today');
    process.exit(0);
  }

  const dateArg = args.indexOf('--date');
  const periodArg = args.indexOf('--period');
  const todayArg = args.includes('--today');

  if (periodArg !== -1) {
    const days = parseInt(args[periodArg + 1]) || 7;
    const summaries = aggregatePeriod(days);

    // Output summary stats
    console.log('\n=== AGGREGATION SUMMARY ===\n');
    for (const s of summaries) {
      console.log(`${s.date}: ${s.totalToolCalls} tools across ${s.sessionCount} sessions`);
      if (s.sameToolSequences.length > 0) {
        console.log(`  Sequences: ${s.sameToolSequences.map(sq => `${sq.pattern} (${sq.count}x)`).join(', ')}`);
      }
    }
  } else if (dateArg !== -1) {
    const dateStr = args[dateArg + 1];
    const date = new Date(dateStr);
    aggregateDay(date);
  } else if (todayArg) {
    aggregateDay(new Date());
  } else {
    // Default: aggregate yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    aggregateDay(yesterday);
  }
}

if (import.meta.main) {
  main();
}
