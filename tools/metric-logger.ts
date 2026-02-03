#!/usr/bin/env bun

/**
 * metric-logger.ts
 *
 * Manual rich metric instrumentation for the self-improvement flywheel.
 *
 * Tools and hooks can call logMetric() to report:
 * - Time saved (minutes)
 * - Verification steps eliminated
 * - Errors prevented
 * - Any custom metrics
 *
 * Metrics are logged to .claude/metrics/YYYY-MM/manual-metrics.jsonl
 *
 * Usage:
 *   import { logMetric } from './tools/metric-logger';
 *   logMetric('auto-diff-hook', 'verification-saved', 1, { file: 'foo.ts', linesChanged: 15 });
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface MetricEntry {
  timestamp: string;
  source: string;        // 'auto-diff-hook', 'research-skill', 'build-validator', etc.
  metric: string;        // 'verification-saved', 'time-saved', 'errors-prevented', etc.
  value: number | string;
  metadata?: Record<string, any>;
}

/**
 * Log a rich metric for the self-improvement flywheel
 *
 * @param source - The tool/hook/skill reporting the metric
 * @param metric - The metric name (time-saved, verification-saved, errors-prevented, etc.)
 * @param value - The metric value (number or string)
 * @param metadata - Optional additional context
 *
 * @example
 * logMetric('auto-diff-hook', 'verification-saved', 1, {
 *   file: filePath,
 *   linesChanged: 15
 * });
 *
 * @example
 * logMetric('research-skill', 'time-saved', 45, {
 *   sources: 5,
 *   pagesProcessed: 12
 * });
 */
export function logMetric(
  source: string,
  metric: string,
  value: number | string,
  metadata?: Record<string, any>
): void {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthDir = join(process.env.HOME!, '.claude/metrics', `${year}-${month}`);

    // Create directory if needed
    if (!existsSync(monthDir)) {
      mkdirSync(monthDir, { recursive: true });
    }

    const entry: MetricEntry = {
      timestamp: now.toISOString(),
      source,
      metric,
      value,
      metadata
    };

    // Append to JSONL (one JSON object per line)
    appendFileSync(
      join(monthDir, 'manual-metrics.jsonl'),
      JSON.stringify(entry) + '\n'
    );
  } catch (error) {
    // Silent failure - don't break tools if logging fails
    console.error('Failed to log metric:', error);
  }
}

/**
 * Log a suggestion outcome for meta-learning
 *
 * @param suggestionId - Unique identifier for the suggestion
 * @param action - What the user did (accepted, rejected, deferred)
 * @param outcome - Optional outcome data (was it built? usage count? feedback?)
 *
 * @example
 * logSuggestionOutcome('gap-read-edit-read-2026-02-03', 'accepted', {
 *   built: true,
 *   usageCount: 27,
 *   userFeedback: 'Very helpful, saves time every session'
 * });
 */
export function logSuggestionOutcome(
  suggestionId: string,
  action: 'accepted' | 'rejected' | 'deferred',
  outcome?: {
    built?: boolean;
    usageCount?: number;
    timesSaved?: number;
    userFeedback?: string;
  }
): void {
  try {
    const learningsDir = join(process.env.HOME!, '.claude/metrics/learnings');

    if (!existsSync(learningsDir)) {
      mkdirSync(learningsDir, { recursive: true });
    }

    const entry = {
      timestamp: new Date().toISOString(),
      suggestionId,
      action,
      outcome
    };

    appendFileSync(
      join(learningsDir, 'suggestion-outcomes.jsonl'),
      JSON.stringify(entry) + '\n'
    );
  } catch (error) {
    console.error('Failed to log suggestion outcome:', error);
  }
}

/**
 * Helper to generate suggestion IDs
 */
export function generateSuggestionId(type: string, pattern: string): string {
  const date = new Date().toISOString().split('T')[0];
  const normalized = pattern.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${type}-${normalized}-${date}`;
}

// CLI execution for testing
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Usage: bun run tools/metric-logger.ts <source> <metric> <value> [metadata-json]');
    console.log('');
    console.log('Examples:');
    console.log('  bun run tools/metric-logger.ts auto-diff-hook verification-saved 1');
    console.log('  bun run tools/metric-logger.ts research-skill time-saved 45 \'{"sources":5}\'');
    process.exit(1);
  }

  const [source, metric, value, metadataJson] = args;
  const metadata = metadataJson ? JSON.parse(metadataJson) : undefined;
  const numValue = parseFloat(value);

  logMetric(source, metric, isNaN(numValue) ? value : numValue, metadata);
  console.log(`✓ Logged metric: ${source} - ${metric} = ${value}`);
}
