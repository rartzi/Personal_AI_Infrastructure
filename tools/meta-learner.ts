#!/usr/bin/env bun

/**
 * meta-learner.ts
 *
 * Phase 5: Meta-Learning for Self-Improvement Flywheel
 *
 * Analyzes suggestion outcomes to improve future suggestions:
 * - Which types of suggestions get acted on?
 * - What confidence levels predict success?
 * - Which properties correlate with high tool usage?
 *
 * Tunes the flywheel to get better over time.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const METRICS_DIR = join(process.env.HOME!, '.claude/metrics');
const OUTCOMES_PATH = join(METRICS_DIR, 'learnings/suggestion-outcomes.jsonl');

export interface MetaLearningInsights {
  confidenceAdjustments: Record<string, number>;
  successPatterns: string[];
  insights: string[];
}

export function analyzeMetaLearnings(): MetaLearningInsights {
  if (!existsSync(OUTCOMES_PATH)) {
    return {
      confidenceAdjustments: {},
      successPatterns: [],
      insights: ['Insufficient data for meta-learning (need 5+ outcomes)']
    };
  }

  const lines = readFileSync(OUTCOMES_PATH, 'utf-8').split('\n').filter(Boolean);
  if (lines.length < 5) {
    return {
      confidenceAdjustments: {},
      successPatterns: [],
      insights: [`Only ${lines.length} outcomes recorded, need 5+ for learning`]
    };
  }

  const records = lines.map(line => JSON.parse(line));
  const accepted = records.filter(r => r.action === 'accepted');
  const insights: string[] = [];
  const successPatterns: string[] = [];

  // Analyze acceptance rate by type
  const gapAccepted = accepted.filter(r => r.suggestionType === 'gap').length;
  const patternAccepted = accepted.filter(r => r.suggestionType === 'pattern').length;
  const gapTotal = records.filter(r => r.suggestionType === 'gap').length;
  const patternTotal = records.filter(r => r.suggestionType === 'pattern').length;

  if (gapTotal > 0 && patternTotal > 0) {
    const gapRate = gapAccepted / gapTotal;
    const patternRate = patternAccepted / patternTotal;

    if (gapRate > patternRate * 1.3) {
      successPatterns.push('gap-based-superior');
      insights.push(`Gap-based suggestions have ${Math.round(gapRate * 100)}% acceptance vs ${Math.round(patternRate * 100)}% for patterns`);
    }
  }

  // Analyze high-usage builds
  const highUsage = accepted.filter(r => r.outcome?.usageCount && r.outcome.usageCount >= 10);
  if (highUsage.length >= 2) {
    successPatterns.push('builds-get-used');
    insights.push(`${highUsage.length} suggestions led to tools used 10+ times`);
  }

  const confidenceAdjustments: Record<string, number> = {};
  if (successPatterns.includes('gap-based-superior')) {
    confidenceAdjustments['gap'] = 10;
    confidenceAdjustments['pattern'] = -5;
  }

  return { confidenceAdjustments, successPatterns, insights };
}

if (import.meta.main) {
  const results = analyzeMetaLearnings();
  console.log('\n🧠 Meta-Learning Analysis\n');
  console.log('Insights:');
  results.insights.forEach(i => console.log(`  - ${i}`));
  if (results.successPatterns.length > 0) {
    console.log('\nSuccess Patterns:');
    results.successPatterns.forEach(p => console.log(`  - ${p}`));
  }
  if (Object.keys(results.confidenceAdjustments).length > 0) {
    console.log('\nConfidence Adjustments:');
    Object.entries(results.confidenceAdjustments).forEach(([type, adj]) =>
      console.log(`  ${type}: ${adj > 0 ? '+' : ''}${adj}`)
    );
  }
}
