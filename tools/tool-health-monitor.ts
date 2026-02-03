#!/usr/bin/env bun

/**
 * tool-health-monitor.ts
 *
 * Phase 3.5: Tool Health Monitoring
 *
 * Tracks usage of all custom tools/hooks/skills and identifies unused
 * capabilities for deprecation. Implements decay function based on
 * weekly usage patterns with grace periods for new tools.
 *
 * Key Features:
 * - Discovers all custom tools (excluding system components)
 * - Tracks weekly usage for last 30 days
 * - Calculates decay score (0-100, higher = more deprecated)
 * - Grace period for new tools (< 2 weeks old)
 * - Status classification (active, declining, deprecated, zombie)
 * - Generates actionable recommendations
 */

import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const PAI_DIR = join(process.env.HOME!, '.claude');
const METRICS_DIR = join(PAI_DIR, 'metrics');

export interface CustomTool {
  name: string;
  type: 'skill' | 'hook' | 'tool' | 'command';
  path: string;
  created: Date;
  ageWeeks: number;
}

export interface ToolHealthReport {
  toolName: string;
  toolType: 'skill' | 'hook' | 'tool' | 'command';
  created: Date;
  ageWeeks: number;
  lastUsed: Date | null;
  daysSinceUse: number | null;
  usagePattern: {
    week1: number;  // Most recent week
    week2: number;
    week3: number;
    week4: number;
  };
  totalUses: number;
  decayScore: number;  // 0-100 (100 = fully deprecated)
  status: 'active' | 'declining' | 'deprecated' | 'zombie';
  recommendation: string;
}

/**
 * System tools to exclude from health monitoring
 */
const SYSTEM_SKILLS = [
  'CORE', 'Art', 'Fabric', 'Research', 'Mneme', 'BrightData',
  'context-suggestions', 'monday-brief', 'Observability',
  'StoryExplanation', 'Prompting', 'CreateCLI', 'Createskill',
  'AlexHormoziPitch', 'ask-gemini', 'image-generator', 'pptx',
  'az-brand-guidelines', 'aixplore-article-writer', 'Ffuf',
  'superpowers', 'elements-of-style', 'superpowers-developing-for-claude-code',
  'superpowers-lab'
];

const SYSTEM_HOOKS = [
  'post-tool-use-metrics', 'threshold-alert', 'load-context-suggestions',
  'load-core-context', 'load-daily-memory', 'initialize-session',
  'capture-all-events', 'capture-session-summary', 'capture-tool-output',
  'stop-hook', 'subagent-stop-hook', 'update-documentation',
  'context-compression-hook', 'self-test', 'validate-protected',
  'validate-docs', 'update-tab-titles', 'mid-session-suggestions'
];

const SYSTEM_TOOLS = [
  'telos-extractor', 'threshold-monitor', 'metric-aggregator',
  'metric-logger', 'context-analyzer', 'derived-intelligence',
  'suggestion-extractor', 'meta-learner', 'monday-brief',
  'monday-brief-cron', 'goal-predictor', 'trajectory-forecaster',
  'test-predictions', 'tool-health-monitor'  // Exclude self
];

/**
 * Discover all custom tools in the system
 */
function discoverCustomTools(): CustomTool[] {
  const tools: CustomTool[] = [];
  const now = Date.now();

  // 1. Scan skills directory
  const skillsDir = join(PAI_DIR, 'skills');
  if (existsSync(skillsDir)) {
    const skills = readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .filter(d => !SYSTEM_SKILLS.includes(d.name));

    for (const skill of skills) {
      const skillPath = join(skillsDir, skill.name);
      try {
        const stat = statSync(skillPath);
        const ageMs = now - stat.birthtime.getTime();
        const ageWeeks = Math.floor(ageMs / (7 * 24 * 60 * 60 * 1000));

        tools.push({
          name: skill.name,
          type: 'skill',
          path: skillPath,
          created: stat.birthtime,
          ageWeeks
        });
      } catch (err) {
        // Skip if can't stat
      }
    }
  }

  // 2. Scan hooks directory
  const hooksDir = join(PAI_DIR, 'hooks');
  if (existsSync(hooksDir)) {
    const hooks = readdirSync(hooksDir)
      .filter(f => f.endsWith('.ts'))
      .map(f => f.replace('.ts', ''))
      .filter(h => !SYSTEM_HOOKS.includes(h));

    for (const hook of hooks) {
      const hookPath = join(hooksDir, hook + '.ts');
      try {
        const stat = statSync(hookPath);
        const ageMs = now - stat.birthtime.getTime();
        const ageWeeks = Math.floor(ageMs / (7 * 24 * 60 * 60 * 1000));

        tools.push({
          name: hook,
          type: 'hook',
          path: hookPath,
          created: stat.birthtime,
          ageWeeks
        });
      } catch (err) {
        // Skip if can't stat
      }
    }
  }

  // 3. Scan tools directory
  const toolsDir = join(process.cwd(), 'tools');
  if (existsSync(toolsDir)) {
    const customTools = readdirSync(toolsDir)
      .filter(f => f.endsWith('.ts'))
      .map(f => f.replace('.ts', ''))
      .filter(t => !SYSTEM_TOOLS.includes(t));

    for (const tool of customTools) {
      const toolPath = join(toolsDir, tool + '.ts');
      try {
        const stat = statSync(toolPath);
        const ageMs = now - stat.birthtime.getTime();
        const ageWeeks = Math.floor(ageMs / (7 * 24 * 60 * 60 * 1000));

        tools.push({
          name: tool,
          type: 'tool',
          path: toolPath,
          created: stat.birthtime,
          ageWeeks
        });
      } catch (err) {
        // Skip if can't stat
      }
    }
  }

  return tools;
}

/**
 * Get weekly usage data for a tool from metrics JSONL
 */
function getToolUsage(toolName: string, toolType: string): {
  lastUsed: Date | null;
  weekly: { week1: number; week2: number; week3: number; week4: number };
  total: number;
} {
  const usage = {
    lastUsed: null as Date | null,
    weekly: { week1: 0, week2: 0, week3: 0, week4: 0 },
    total: 0
  };

  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  // Get monthly metric files
  const months = getRecentMonths(2);  // Last 2 months

  for (const month of months) {
    const metricsFile = join(METRICS_DIR, month, 'tool-usage.jsonl');
    if (!existsSync(metricsFile)) continue;

    try {
      const lines = readFileSync(metricsFile, 'utf-8').split('\n').filter(Boolean);

      for (const line of lines) {
        const entry = JSON.parse(line);
        const timestamp = new Date(entry.timestamp);
        const ageMs = now - timestamp.getTime();
        const weekNum = Math.floor(ageMs / oneWeek);

        // Check if this entry matches our tool
        let matches = false;

        if (toolType === 'skill' && entry.tool === 'Skill') {
          // Check if skill name appears in tool_input
          const skillArg = entry.context?.skillName || '';
          if (skillArg.toLowerCase().includes(toolName.toLowerCase())) {
            matches = true;
          }
        } else if (toolType === 'hook') {
          // Hooks are harder to track - would need hook execution logs
          // For now, approximate by checking Bash calls to hook file
          if (entry.tool === 'Bash' && entry.context?.commandType === 'bun') {
            // Check if command includes hook name
            // This is a rough approximation
          }
        } else if (toolType === 'tool') {
          // Tools invoked via Bash
          if (entry.tool === 'Bash' && entry.context?.commandType === 'bun') {
            // Check if command includes tool name
          }
        }

        if (matches) {
          usage.total++;

          if (!usage.lastUsed || timestamp > usage.lastUsed) {
            usage.lastUsed = timestamp;
          }

          // Bucket by week
          if (weekNum === 0) usage.weekly.week1++;
          else if (weekNum === 1) usage.weekly.week2++;
          else if (weekNum === 2) usage.weekly.week3++;
          else if (weekNum === 3) usage.weekly.week4++;
        }
      }
    } catch (err) {
      // Skip if can't parse
    }
  }

  return usage;
}

/**
 * Get recent month directories (YYYY-MM format)
 */
function getRecentMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
  }

  return months;
}

/**
 * Calculate decay score based on usage pattern and age
 */
function calculateDecayScore(
  usage: ReturnType<typeof getToolUsage>,
  ageWeeks: number
): number {
  // Decay factors:
  // 1. Recent usage (last 3 weeks)
  // 2. Usage trend (increasing vs declining)
  // 3. Age of tool (newer tools get grace period)

  const recentUse = usage.weekly.week1 + usage.weekly.week2 + usage.weekly.week3;

  // No recent usage = high decay
  if (recentUse === 0) {
    // Zombie: Never used (no grace period for zombies)
    if (usage.total === 0) return 100;

    // Grace period for new tools (< 2 weeks old) that were used before
    if (ageWeeks < 2) return 0;

    // Strong evidence of abandonment
    if (ageWeeks > 4) return 100;

    return 70; // Likely deprecated
  }

  // Calculate usage trend
  const weeks = [usage.weekly.week4, usage.weekly.week3, usage.weekly.week2, usage.weekly.week1];
  const firstHalf = weeks.slice(0, 2).reduce((a, b) => a + b, 0);
  const secondHalf = weeks.slice(2).reduce((a, b) => a + b, 0);

  // Declining usage (first half > second half)
  if (firstHalf > secondHalf * 2 && secondHalf < 3) {
    return 50; // Declining
  }

  // Stable or growing usage
  return 0; // Active
}

/**
 * Determine status from decay score
 */
function determineStatus(
  decayScore: number,
  usage: ReturnType<typeof getToolUsage>
): ToolHealthReport['status'] {
  if (usage.total === 0) return 'zombie';  // Created but never used
  if (decayScore >= 70) return 'deprecated';
  if (decayScore >= 40) return 'declining';
  return 'active';
}

/**
 * Generate recommendation
 */
function generateRecommendation(
  status: ToolHealthReport['status'],
  usage: ReturnType<typeof getToolUsage>,
  tool: CustomTool
): string {
  const daysSinceUse = usage.lastUsed
    ? Math.floor((Date.now() - usage.lastUsed.getTime()) / (24 * 60 * 60 * 1000))
    : null;

  if (status === 'zombie') {
    return `ARCHIVE: ${tool.type} created ${tool.ageWeeks} weeks ago but never used. Remove to reduce clutter.`;
  }

  if (status === 'deprecated') {
    return `DEPRECATE: No usage in last 3 weeks (last used: ${daysSinceUse} days ago). Archive with documentation or explain why keeping.`;
  }

  if (status === 'declining') {
    const weeks = [usage.weekly.week4, usage.weekly.week3, usage.weekly.week2, usage.weekly.week1];
    const trend = weeks[0] > weeks[3] ? 'declining' : 'stable';
    return `MONITOR: Usage ${trend}. May become deprecated soon. Consider if still needed.`;
  }

  return `ACTIVE: ${tool.type} is healthy and being used regularly (${usage.total} uses in 30 days).`;
}

/**
 * Main health monitoring function
 */
export function monitorToolHealth(): ToolHealthReport[] {
  const reports: ToolHealthReport[] = [];

  console.error('🏥 Discovering custom tools...\n');

  // Discover all custom tools
  const tools = discoverCustomTools();

  console.error(`Found ${tools.length} custom tools to analyze\n`);

  for (const tool of tools) {
    // Get usage data
    const usage = getToolUsage(tool.name, tool.type);
    const decayScore = calculateDecayScore(usage, tool.ageWeeks);
    const status = determineStatus(decayScore, usage);

    const daysSinceUse = usage.lastUsed
      ? Math.floor((Date.now() - usage.lastUsed.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    reports.push({
      toolName: tool.name,
      toolType: tool.type,
      created: tool.created,
      ageWeeks: tool.ageWeeks,
      lastUsed: usage.lastUsed,
      daysSinceUse,
      usagePattern: usage.weekly,
      totalUses: usage.total,
      decayScore,
      status,
      recommendation: generateRecommendation(status, usage, tool)
    });
  }

  // Sort by decay score (most deprecated first)
  return reports.sort((a, b) => b.decayScore - a.decayScore);
}

/**
 * Get summary statistics
 */
export function summarizeHealth(reports: ToolHealthReport[]): {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  needsAction: number;
  avgDecayScore: number;
} {
  const byStatus: Record<string, number> = {
    active: 0,
    declining: 0,
    deprecated: 0,
    zombie: 0
  };

  const byType: Record<string, number> = {
    skill: 0,
    hook: 0,
    tool: 0,
    command: 0
  };

  let totalDecay = 0;
  let needsAction = 0;

  for (const report of reports) {
    byStatus[report.status]++;
    byType[report.toolType]++;
    totalDecay += report.decayScore;

    if (report.status === 'deprecated' || report.status === 'zombie') {
      needsAction++;
    }
  }

  return {
    total: reports.length,
    byStatus,
    byType,
    needsAction,
    avgDecayScore: reports.length > 0 ? totalDecay / reports.length : 0
  };
}

/**
 * CLI interface
 */
if (import.meta.main) {
  console.log('\n🏥 TOOL HEALTH MONITORING\n');
  console.log('Analyzing custom tools/hooks/skills...\n');

  const reports = monitorToolHealth();

  if (reports.length === 0) {
    console.log('✓ No custom tools found');
    console.log('  All tools are system components\n');
    process.exit(0);
  }

  const summary = summarizeHealth(reports);

  console.log(`\n📊 HEALTH SUMMARY\n`);
  console.log(`Total custom tools: ${summary.total}`);
  console.log(`\nBy Status:`);
  for (const [status, count] of Object.entries(summary.byStatus)) {
    if (count > 0) {
      const emoji = status === 'active' ? '✅' :
                   status === 'declining' ? '⚠️' :
                   status === 'deprecated' ? '🔴' : '💀';
      console.log(`  ${emoji} ${status}: ${count}`);
    }
  }

  console.log(`\nBy Type:`);
  for (const [type, count] of Object.entries(summary.byType)) {
    if (count > 0) {
      console.log(`  ${type}: ${count}`);
    }
  }

  console.log(`\nAverage Decay Score: ${summary.avgDecayScore.toFixed(1)}%`);
  console.log(`Tools needing action: ${summary.needsAction}\n`);

  if (summary.needsAction > 0) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('⚠️  TOOLS NEEDING ACTION\n');

    const actionable = reports.filter(
      r => r.status === 'deprecated' || r.status === 'zombie'
    );

    for (const report of actionable) {
      const emoji = report.status === 'zombie' ? '💀' : '🔴';
      console.log(`${emoji} ${report.toolName} (${report.toolType})`);
      console.log(`   Age: ${report.ageWeeks} weeks`);
      console.log(`   Last used: ${report.daysSinceUse !== null ? report.daysSinceUse + ' days ago' : 'never'}`);
      console.log(`   Usage: [${report.usagePattern.week4}, ${report.usagePattern.week3}, ${report.usagePattern.week2}, ${report.usagePattern.week1}] (weeks 4-1)`);
      console.log(`   Total: ${report.totalUses} uses`);
      console.log(`   Decay: ${report.decayScore}%`);
      console.log(`   ${report.recommendation}\n`);
    }
  }

  // Show declining tools as well
  const declining = reports.filter(r => r.status === 'declining');
  if (declining.length > 0) {
    console.log(`${'═'.repeat(60)}`);
    console.log('⚠️  DECLINING TOOLS (Monitor)\n');

    for (const report of declining) {
      console.log(`⚠️  ${report.toolName} (${report.toolType})`);
      console.log(`   Usage: [${report.usagePattern.week4}, ${report.usagePattern.week3}, ${report.usagePattern.week2}, ${report.usagePattern.week1}]`);
      console.log(`   ${report.recommendation}\n`);
    }
  }

  console.log('═'.repeat(60) + '\n');
}
