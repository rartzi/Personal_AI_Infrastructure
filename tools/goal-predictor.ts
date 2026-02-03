#!/usr/bin/env bun

/**
 * goal-predictor.ts
 *
 * Phase 3.5: Goal-Based Prediction
 *
 * Maps user goals to predicted capability needs using domain knowledge.
 * Analyzes telos profile to predict what tools/skills/automations will be
 * needed in the future based on stated goals.
 *
 * Key Features:
 * - Pattern matching for common goal types
 * - Confidence scoring based on goal-capability correlation
 * - Checks existing tool inventory to avoid duplication
 * - Timeframe estimation (immediate, 1-2 weeks, 1 month, 3+ months)
 */

import { type TelosProfile } from './telos-extractor';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

const PAI_DIR = join(process.env.HOME!, '.claude');

export interface GoalPrediction {
  goal: string;
  goalAge: number;  // weeks old
  predictedNeeds: Array<{
    capability: string;
    reasoning: string;
    confidence: number;  // 0-100
    timeframe: 'immediate' | '1-2 weeks' | '1 month' | '3+ months';
    exists: boolean;
    category: 'automation' | 'documentation' | 'deployment' | 'testing' | 'research' | 'coordination';
  }>;
}

/**
 * Check if a tool/skill/hook already exists
 */
function checkToolExists(toolId: string): boolean {
  const skillsDir = join(PAI_DIR, 'skills');
  const toolsDir = join(process.cwd(), 'tools');
  const hooksDir = join(PAI_DIR, 'hooks');

  // Normalize tool ID for matching
  const normalizedId = toolId.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Check skills
  if (existsSync(skillsDir)) {
    const skills = readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name.toLowerCase());

    if (skills.some(s => s.includes(normalizedId) || normalizedId.includes(s))) {
      return true;
    }
  }

  // Check tools
  if (existsSync(toolsDir)) {
    const tools = readdirSync(toolsDir)
      .filter(f => f.endsWith('.ts'))
      .map(f => f.replace('.ts', '').toLowerCase());

    if (tools.some(t => t.includes(normalizedId) || normalizedId.includes(t))) {
      return true;
    }
  }

  // Check hooks
  if (existsSync(hooksDir)) {
    const hooks = readdirSync(hooksDir)
      .filter(f => f.endsWith('.ts'))
      .map(f => f.replace('.ts', '').toLowerCase());

    if (hooks.some(h => h.includes(normalizedId) || normalizedId.includes(h))) {
      return true;
    }
  }

  return false;
}

/**
 * Predict capabilities needed from a single goal
 */
function predictFromGoal(goalEntry: TelosProfile['recentGoals'][0], telos: TelosProfile): GoalPrediction['predictedNeeds'] {
  const goal = goalEntry.goal.toLowerCase();
  const needs: GoalPrediction['predictedNeeds'] = [];

  // Pattern 1: Democratization / Open Source / Sharing
  if (goal.match(/democratiz|open.?source|share|publish|distribute/)) {
    needs.push({
      capability: 'Documentation Generator',
      reasoning: 'Democratization requires excellent documentation for adoption',
      confidence: 85,
      timeframe: '1-2 weeks',
      exists: checkToolExists('documentation-generator'),
      category: 'documentation'
    });

    needs.push({
      capability: 'Example Repository Builder',
      reasoning: 'Users need working examples to get started quickly',
      confidence: 80,
      timeframe: '1 month',
      exists: checkToolExists('example-builder'),
      category: 'documentation'
    });

    needs.push({
      capability: 'One-Click Deployment',
      reasoning: 'Lower barrier to entry for non-technical users',
      confidence: 90,
      timeframe: 'immediate',
      exists: checkToolExists('deployment-automation'),
      category: 'deployment'
    });

    // If high builder identity, also predict package automation
    if (telos.identity.builder > 85) {
      needs.push({
        capability: 'Package Publishing Automation',
        reasoning: 'Builders distribute packages frequently',
        confidence: 75,
        timeframe: '1-2 weeks',
        exists: checkToolExists('package-publisher'),
        category: 'automation'
      });
    }
  }

  // Pattern 2: Building / Creating / Development
  if (goal.match(/build|create|develop|implement|code/)) {
    needs.push({
      capability: 'Boilerplate Generator',
      reasoning: 'Builders need fast project scaffolding',
      confidence: 75,
      timeframe: '1-2 weeks',
      exists: checkToolExists('boilerplate-generator'),
      category: 'automation'
    });

    needs.push({
      capability: 'Testing Automation',
      reasoning: 'Quality matters for sustainable building',
      confidence: 70,
      timeframe: '1 month',
      exists: checkToolExists('test-automation'),
      category: 'testing'
    });

    // If high autonomy value, predict CI/CD
    if (telos.values.autonomy > 90) {
      needs.push({
        capability: 'CI/CD Pipeline',
        reasoning: 'Autonomy requires automated validation and deployment',
        confidence: 80,
        timeframe: '1-2 weeks',
        exists: checkToolExists('ci-cd'),
        category: 'deployment'
      });
    }
  }

  // Pattern 3: Research / Learning / Investigation
  if (goal.match(/research|learn|investigate|study|understand/)) {
    needs.push({
      capability: 'Knowledge Extraction Pipeline',
      reasoning: 'Systematic research requires structured extraction',
      confidence: 85,
      timeframe: 'immediate',
      exists: checkToolExists('research-pipeline'),
      category: 'research'
    });

    needs.push({
      capability: 'Research Summary Generator',
      reasoning: 'Convert research into actionable insights',
      confidence: 75,
      timeframe: '1-2 weeks',
      exists: checkToolExists('research-summarizer'),
      category: 'research'
    });

    // If low scientist identity, predict delegation
    if (telos.identity.scientist < 75 && telos.identity.builder > 85) {
      needs.push({
        capability: 'Research Agent Delegation',
        reasoning: 'Non-scientists should delegate research to parallel agents',
        confidence: 90,
        timeframe: 'immediate',
        exists: checkToolExists('research-delegation'),
        category: 'coordination'
      });
    }
  }

  // Pattern 4: Automation / Efficiency / Scale
  if (goal.match(/automate|efficient|scale|optimize|faster/)) {
    needs.push({
      capability: 'Workflow Automation Framework',
      reasoning: 'Scaling requires systematic workflow automation',
      confidence: 85,
      timeframe: 'immediate',
      exists: checkToolExists('workflow-automation'),
      category: 'automation'
    });

    needs.push({
      capability: 'Parallel Agent Orchestration',
      reasoning: 'Scale through parallelization not serialization',
      confidence: 80,
      timeframe: '1-2 weeks',
      exists: checkToolExists('agent-orchestration'),
      category: 'coordination'
    });
  }

  // Pattern 5: Teaching / Education / Tutorial
  if (goal.match(/teach|educat|tutorial|course|train/)) {
    needs.push({
      capability: 'Interactive Tutorial Builder',
      reasoning: 'Teaching requires hands-on learning experiences',
      confidence: 80,
      timeframe: '1 month',
      exists: checkToolExists('tutorial-builder'),
      category: 'documentation'
    });

    needs.push({
      capability: 'Video Documentation Tool',
      reasoning: 'Education benefits from multiple media formats',
      confidence: 70,
      timeframe: '3+ months',
      exists: checkToolExists('video-docs'),
      category: 'documentation'
    });
  }

  // Pattern 6: Product / Launch / Business
  if (goal.match(/product|launch|business|revenue|commercial/)) {
    needs.push({
      capability: 'Landing Page Generator',
      reasoning: 'Products need professional landing pages',
      confidence: 75,
      timeframe: '1-2 weeks',
      exists: checkToolExists('landing-page-generator'),
      category: 'automation'
    });

    needs.push({
      capability: 'Analytics Dashboard',
      reasoning: 'Business decisions require data visibility',
      confidence: 80,
      timeframe: '1 month',
      exists: checkToolExists('analytics-dashboard'),
      category: 'automation'
    });
  }

  // Pattern 7: Team / Collaboration / Organization
  if (goal.match(/team|collaborat|organization|manage|coordinate/)) {
    needs.push({
      capability: 'Team Documentation System',
      reasoning: 'Teams need centralized knowledge sharing',
      confidence: 75,
      timeframe: '1-2 weeks',
      exists: checkToolExists('team-docs'),
      category: 'documentation'
    });

    // If high leader identity
    if (telos.identity.leader > 80) {
      needs.push({
        capability: 'Multi-Agent Coordination',
        reasoning: 'Leaders orchestrate parallel work streams',
        confidence: 85,
        timeframe: 'immediate',
        exists: checkToolExists('multi-agent-coordination'),
        category: 'coordination'
      });
    }
  }

  return needs;
}

/**
 * Main prediction function
 */
export function predictFromGoals(telos: TelosProfile): GoalPrediction[] {
  const predictions: GoalPrediction[] = [];

  for (const goalEntry of telos.recentGoals) {
    const predictedNeeds = predictFromGoal(goalEntry, telos);

    // Filter to only missing capabilities with sufficient confidence
    const missingHighConfidence = predictedNeeds.filter(
      n => !n.exists && n.confidence >= 70
    );

    if (missingHighConfidence.length > 0) {
      predictions.push({
        goal: goalEntry.goal,
        goalAge: goalEntry.ageWeeks,
        predictedNeeds: missingHighConfidence
      });
    }
  }

  // Sort by goal recency (newer goals are more relevant)
  return predictions.sort((a, b) => a.goalAge - b.goalAge);
}

/**
 * Get summary statistics
 */
export function summarizePredictions(predictions: GoalPrediction[]): {
  totalCapabilities: number;
  byTimeframe: Record<string, number>;
  byCategory: Record<string, number>;
  highestConfidence: GoalPrediction['predictedNeeds'][0] | null;
} {
  const allNeeds = predictions.flatMap(p => p.predictedNeeds);

  const byTimeframe: Record<string, number> = {
    'immediate': 0,
    '1-2 weeks': 0,
    '1 month': 0,
    '3+ months': 0
  };

  const byCategory: Record<string, number> = {};

  for (const need of allNeeds) {
    byTimeframe[need.timeframe]++;
    byCategory[need.category] = (byCategory[need.category] || 0) + 1;
  }

  const highestConfidence = allNeeds.length > 0
    ? allNeeds.reduce((max, need) => need.confidence > max.confidence ? need : max)
    : null;

  return {
    totalCapabilities: allNeeds.length,
    byTimeframe,
    byCategory,
    highestConfidence
  };
}

/**
 * CLI interface
 */
if (import.meta.main) {
  const { loadTelos } = await import('./telos-extractor');
  const telos = loadTelos();

  console.log('\n🔮 GOAL-BASED PREDICTIONS\n');
  console.log(`Analyzing ${telos.recentGoals.length} recent goals...\n`);

  const predictions = predictFromGoals(telos);

  if (predictions.length === 0) {
    console.log('✓ No missing capabilities predicted');
    console.log('  All predicted needs already exist or confidence too low\n');
  } else {
    console.log(`📊 Found ${predictions.length} goals with predicted needs:\n`);

    for (const pred of predictions) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`Goal: ${pred.goal}`);
      console.log(`Age: ${pred.goalAge} weeks old`);
      console.log(`\nPredicted Capabilities (${pred.predictedNeeds.length}):\n`);

      for (const need of pred.predictedNeeds) {
        const urgency = need.timeframe === 'immediate' ? '🔴' :
                       need.timeframe === '1-2 weeks' ? '🟡' : '🟢';
        console.log(`${urgency} ${need.capability} (${need.confidence}% confidence)`);
        console.log(`   Timeframe: ${need.timeframe}`);
        console.log(`   Category: ${need.category}`);
        console.log(`   Reasoning: ${need.reasoning}\n`);
      }
    }

    // Summary
    const summary = summarizePredictions(predictions);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`\n📈 SUMMARY\n`);
    console.log(`Total predicted capabilities: ${summary.totalCapabilities}`);
    console.log(`\nBy Timeframe:`);
    for (const [timeframe, count] of Object.entries(summary.byTimeframe)) {
      if (count > 0) {
        console.log(`  ${timeframe}: ${count}`);
      }
    }
    console.log(`\nBy Category:`);
    for (const [category, count] of Object.entries(summary.byCategory)) {
      console.log(`  ${category}: ${count}`);
    }

    if (summary.highestConfidence) {
      console.log(`\n🎯 Highest Confidence: ${summary.highestConfidence.capability} (${summary.highestConfidence.confidence}%)`);
    }
    console.log();
  }
}
