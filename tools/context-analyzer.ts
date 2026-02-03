#!/usr/bin/env bun

/**
 * context-analyzer.ts
 *
 * HIGH-VALUE CONTEXT ANALYZER
 *
 * Surfaces personally meaningful intelligence:
 * - Research threads worth revisiting
 * - Unfinished creative ideas
 * - Goals and progress
 * - Derived suggestions for new capabilities
 *
 * Git status is available via --git flag but NOT in default output.
 *
 * Usage:
 *   bun run tools/context-analyzer.ts           # High-value suggestions
 *   bun run tools/context-analyzer.ts --git     # Include git status
 *   bun run tools/context-analyzer.ts --json    # JSON output
 *   bun run tools/context-analyzer.ts --verbose # Detailed analysis
 */

import { execSync } from 'child_process';
import { extractAll, type ExtractedItem, type ExtractionResult } from './suggestion-extractor';
import { analyzeAll, getTopSuggestions, type DerivedSuggestion, type DerivedResult } from './derived-intelligence';

// Types
interface Suggestion {
  type: 'research' | 'idea' | 'goal' | 'build' | 'git_action';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
  context?: string;
  references?: string[];
  confidence?: number;
}

interface AnalysisResult {
  timestamp: Date;
  suggestions: Suggestion[];
  extracted: ExtractionResult;
  derived: DerivedResult;
  gitState?: {
    branch: string;
    uncommittedChanges: boolean;
    unpushedCommits: number;
  };
}

/**
 * Get git repository state (only when requested)
 */
function analyzeGitState() {
  const state = {
    branch: 'unknown',
    uncommittedChanges: false,
    unpushedCommits: 0
  };

  try {
    state.branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    const gitStatus = execSync('git status --short', { encoding: 'utf-8' }).trim();
    state.uncommittedChanges = gitStatus !== '';

    const unpushed = execSync('git rev-list --count @{u}..HEAD 2>/dev/null || echo "0"', { encoding: 'utf-8' }).trim();
    state.unpushedCommits = parseInt(unpushed);
  } catch (e) {
    // Git not available or not a repo
  }

  return state;
}

/**
 * Convert extracted items to suggestions
 */
function extractedToSuggestions(extracted: ExtractionResult): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Research threads - prioritize stale ones for revival
  const staleResearch = extracted.research
    .filter(r => r.status === 'stale' && r.depth !== 'shallow')
    .slice(0, 2);

  for (const r of staleResearch) {
    suggestions.push({
      type: 'research',
      priority: r.depth === 'deep' ? 'high' : 'medium',
      title: `Research revival: ${r.topic}`,
      description: `You researched this ${r.ageDays} days ago - worth revisiting for new developments`,
      action: 'Check for updates or continue exploring',
      context: r.summary.substring(0, 150),
      references: [r.sourcePath.split('/').slice(-2).join('/')]
    });
  }

  // Unfinished ideas - prioritize active/stale with next steps
  const unfinishedIdeas = extracted.ideas
    .filter(i => i.status !== 'abandoned' && i.nextSteps && i.nextSteps.length > 0)
    .slice(0, 2);

  for (const i of unfinishedIdeas) {
    suggestions.push({
      type: 'idea',
      priority: i.status === 'active' ? 'high' : 'medium',
      title: `Unfinished: ${i.topic}`,
      description: `Creative thread from ${i.ageDays} days ago with remaining steps`,
      action: i.nextSteps?.[0] || 'Continue where you left off',
      context: i.summary.substring(0, 150),
      references: [i.sourcePath.split('/').slice(-2).join('/')]
    });
  }

  // Goals - show active goals
  const activeGoals = extracted.goals
    .filter(g => g.status === 'active')
    .slice(0, 2);

  for (const g of activeGoals) {
    suggestions.push({
      type: 'goal',
      priority: 'medium',
      title: `Goal: ${g.topic.substring(0, 60)}`,
      description: g.summary,
      action: g.nextSteps?.[0] || 'Continue working toward this goal',
      references: [g.sourcePath.split('/').slice(-2).join('/')]
    });
  }

  return suggestions;
}

/**
 * Convert derived suggestions to main suggestions
 */
function derivedToSuggestions(derived: DerivedResult): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Get top derived suggestions
  const topDerived = [
    ...derived.patterns.slice(0, 1),
    ...derived.gaps.slice(0, 1),
    ...derived.ambitions.slice(0, 1)
  ].sort((a, b) => b.confidence - a.confidence).slice(0, 2);

  for (const d of topDerived) {
    suggestions.push({
      type: 'build',
      priority: d.priority,
      title: `Build opportunity: ${d.title}`,
      description: d.description,
      action: d.suggestedAction,
      context: d.reasoning,
      confidence: d.confidence,
      references: d.evidence
    });
  }

  return suggestions;
}

/**
 * Generate git suggestions (only when --git flag)
 */
function gitToSuggestions(gitState: AnalysisResult['gitState']): Suggestion[] {
  if (!gitState) return [];
  const suggestions: Suggestion[] = [];

  if (gitState.uncommittedChanges) {
    suggestions.push({
      type: 'git_action',
      priority: 'low',
      title: 'Uncommitted changes',
      description: `Changes on branch ${gitState.branch}`,
      action: 'git status && git add . && git commit'
    });
  }

  if (gitState.unpushedCommits > 0) {
    suggestions.push({
      type: 'git_action',
      priority: 'low',
      title: `${gitState.unpushedCommits} unpushed commits`,
      description: 'Local commits not on remote',
      action: 'git push'
    });
  }

  return suggestions;
}

/**
 * Main analysis function
 */
function analyzeContext(includeGit: boolean = false): AnalysisResult {
  console.error('🧠 Analyzing context for high-value suggestions...\n');

  // Extract personal intelligence
  const extracted = extractAll();
  console.error(`📚 Found ${extracted.research.length} research threads, ${extracted.ideas.length} ideas, ${extracted.goals.length} goals\n`);

  // Analyze for derived suggestions
  const derived = analyzeAll();
  const derivedCount = derived.patterns.length + derived.gaps.length + derived.ambitions.length;
  console.error(`💡 Generated ${derivedCount} build opportunities\n`);

  // NEW: Check metric-driven thresholds (Phase 3)
  let metricAlerts: any[] = [];
  try {
    // Dynamic import is async, so we'll catch it or use require
    const thresholdModule = require('./threshold-monitor.ts');
    if (thresholdModule && thresholdModule.checkThresholds) {
      metricAlerts = thresholdModule.checkThresholds().filter(a => a.priority === 'high' || a.priority === 'urgent');
      if (metricAlerts.length > 0) {
        console.error(`📊 Detected ${metricAlerts.length} metric-driven patterns\n`);
      }
    }
  } catch (e) {
    // Threshold monitor not available yet - skip silently
  }

  // Convert to suggestions
  const suggestions: Suggestion[] = [
    ...extractedToSuggestions(extracted),
    ...derivedToSuggestions(derived),
    ...metricAlerts.map(alert => ({
      type: 'build' as const,
      priority: alert.priority === 'urgent' ? 'high' as const : 'medium' as const,
      title: `Metric-driven: ${alert.pattern}`,
      description: alert.suggestion,
      action: 'Build automation for this pattern',
      confidence: alert.confidence,
      references: alert.evidence
    }))
  ];

  // Optionally include git
  let gitState;
  if (includeGit) {
    gitState = analyzeGitState();
    suggestions.push(...gitToSuggestions(gitState));
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    timestamp: new Date(),
    suggestions,
    extracted,
    derived,
    gitState
  };
}

/**
 * Format a single suggestion
 */
function formatSuggestion(s: Suggestion): string {
  const icons: Record<string, string> = {
    research: '🔬',
    idea: '💭',
    goal: '🎯',
    build: '🔨',
    git_action: '📦'
  };

  let output = `### ${icons[s.type] || '📌'} ${s.title}\n\n`;
  output += `**${s.description}**\n\n`;

  if (s.context) {
    output += `*${s.context}*\n\n`;
  }

  if (s.action) {
    output += `→ **Action:** ${s.action}\n\n`;
  }

  if (s.confidence) {
    output += `*Confidence: ${s.confidence}%*\n\n`;
  }

  if (s.references && s.references.length > 0) {
    output += `📂 ${s.references.slice(0, 2).join(', ')}\n\n`;
  }

  output += `---\n\n`;
  return output;
}

/**
 * Format suggestions as markdown
 */
function formatSuggestionsMarkdown(result: AnalysisResult): string {
  let output = `# Context-Aware Suggestions\n\n`;
  output += `Generated: ${result.timestamp.toLocaleString()}\n\n`;
  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (result.suggestions.length === 0) {
    output += `✅ **All clear!** No immediate suggestions.\n\n`;
    output += `Your research is current, ideas are progressing, and no new build opportunities detected.\n\n`;
    return output;
  }

  // Group by priority
  const high = result.suggestions.filter(s => s.priority === 'high');
  const medium = result.suggestions.filter(s => s.priority === 'medium');
  const low = result.suggestions.filter(s => s.priority === 'low');

  if (high.length > 0) {
    output += `## 🔴 High Priority\n\n`;
    for (const suggestion of high) {
      output += formatSuggestion(suggestion);
    }
  }

  if (medium.length > 0) {
    output += `## 🟡 Medium Priority\n\n`;
    for (const suggestion of medium) {
      output += formatSuggestion(suggestion);
    }
  }

  if (low.length > 0) {
    output += `## 🟢 Low Priority\n\n`;
    for (const suggestion of low) {
      output += formatSuggestion(suggestion);
    }
  }

  output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  output += `💡 These suggestions surface your research, ideas, and build opportunities.\n`;
  output += `Use \`/suggestions --git\` to include git status.\n`;

  return output;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const verbose = args.includes('--verbose');
  const includeGit = args.includes('--git');

  try {
    const result = analyzeContext(includeGit);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const markdown = formatSuggestionsMarkdown(result);
      console.log(markdown);

      if (verbose) {
        console.error('\n📊 Analysis Details:\n');
        console.error(`- Research threads: ${result.extracted.research.length}`);
        console.error(`- Unfinished ideas: ${result.extracted.ideas.length}`);
        console.error(`- Goals tracked: ${result.extracted.goals.length}`);
        console.error(`- Pattern suggestions: ${result.derived.patterns.length}`);
        console.error(`- Gap suggestions: ${result.derived.gaps.length}`);
        console.error(`- Ambition suggestions: ${result.derived.ambitions.length}`);
        if (result.gitState) {
          console.error(`- Git uncommitted: ${result.gitState.uncommittedChanges}`);
          console.error(`- Git unpushed: ${result.gitState.unpushedCommits}`);
        }
      }

      console.error(`\n✅ Generated ${result.suggestions.length} high-value suggestions`);
    }
  } catch (error) {
    console.error('❌ Error analyzing context:', error);
    process.exit(1);
  }
}

main();
