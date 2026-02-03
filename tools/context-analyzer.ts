#!/usr/bin/env bun

/**
 * context-analyzer.ts
 *
 * Analyzes History to provide context-aware suggestions based on work patterns.
 * Inspired by Clawdbot's Seneca proactive intelligence.
 *
 * Analyzes:
 * - Failed attempts → Suggest alternatives
 * - Incomplete work → Remind to finish
 * - Similar past issues → Reference solutions
 * - Repeated patterns → Suggest automation
 * - Git state → Suggest commits/pushes
 * - Stale branches → Suggest cleanup
 *
 * Usage:
 *   bun run tools/context-analyzer.ts           # Analyze and suggest
 *   bun run tools/context-analyzer.ts --json    # JSON output
 *   bun run tools/context-analyzer.ts --verbose # Detailed analysis
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const HISTORY_DIR = join(PAI_DIR, 'History');

interface Suggestion {
  type: 'failed_attempt' | 'incomplete_work' | 'similar_issue' | 'automation' | 'git_action' | 'cleanup';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
  context?: string;
  references?: string[];
}

interface AnalysisResult {
  timestamp: Date;
  suggestions: Suggestion[];
  patterns: {
    recentFailures: string[];
    incompleteWork: string[];
    repeatedTasks: string[];
  };
  gitState: {
    branch: string;
    uncommittedChanges: boolean;
    unpushedCommits: number;
    staleBranches: string[];
  };
}

/**
 * Get git repository state
 */
function analyzeGitState() {
  const state = {
    branch: 'unknown',
    uncommittedChanges: false,
    unpushedCommits: 0,
    staleBranches: [] as string[]
  };

  try {
    state.branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    const gitStatus = execSync('git status --short', { encoding: 'utf-8' }).trim();
    state.uncommittedChanges = gitStatus !== '';

    const unpushed = execSync('git rev-list --count @{u}..HEAD 2>/dev/null || echo "0"', { encoding: 'utf-8' }).trim();
    state.unpushedCommits = parseInt(unpushed);

    // Check for stale local branches (no activity in 30 days)
    const branches = execSync('git for-each-ref --sort=-committerdate refs/heads/ --format="%(refname:short)|%(committerdate:relative)"', { encoding: 'utf-8' })
      .trim()
      .split('\n');

    const currentBranch = state.branch;
    for (const branchLine of branches) {
      const [branch, lastActivity] = branchLine.split('|');
      if (branch !== currentBranch && branch !== 'main' && branch !== 'master') {
        if (lastActivity.includes('month') || lastActivity.includes('year')) {
          state.staleBranches.push(`${branch} (${lastActivity})`);
        }
      }
    }
  } catch (e) {
    console.error('Could not analyze git state:', e);
  }

  return state;
}

/**
 * Get recent History files
 */
function getRecentFiles(dir: string, daysBack: number = 7): Array<{ path: string; mtime: Date; content: string }> {
  if (!existsSync(dir)) return [];

  const cutoffDate = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
  const files: Array<{ path: string; mtime: Date; content: string }> = [];

  function walk(currentDir: string) {
    try {
      const entries = readdirSync(currentDir);
      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.md') && stat.mtime.getTime() > cutoffDate) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            files.push({ path: fullPath, mtime: stat.mtime, content });
          } catch (e) {
            // Skip files we can't read
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  walk(dir);
  return files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

/**
 * Analyze sessions for failed attempts
 */
function detectFailedAttempts(sessions: Array<{ path: string; mtime: Date; content: string }>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const failureKeywords = ['error', 'failed', 'didn\'t work', 'unsuccessful', 'exception', 'bug', 'issue', 'problem'];

  for (const session of sessions.slice(0, 5)) {
    const lowerContent = session.content.toLowerCase();
    const hasFailure = failureKeywords.some(keyword => lowerContent.includes(keyword));

    if (hasFailure) {
      // Extract context around failure
      const lines = session.content.split('\n');
      const failureContext = lines.find(line =>
        failureKeywords.some(keyword => line.toLowerCase().includes(keyword))
      ) || 'Failed attempt detected';

      suggestions.push({
        type: 'failed_attempt',
        priority: 'high',
        title: 'Recent failure detected',
        description: `You encountered issues recently. Consider trying an alternative approach.`,
        context: failureContext.substring(0, 200),
        references: [basename(session.path)],
        action: 'Review the session and try a different strategy'
      });
    }
  }

  return suggestions;
}

/**
 * Analyze for incomplete work
 */
function detectIncompleteWork(sessions: Array<{ path: string; mtime: Date; content: string }>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const incompleteKeywords = ['todo', 'wip', 'in progress', 'unfinished', 'continue', 'next:', 'remaining'];

  for (const session of sessions.slice(0, 3)) {
    const lowerContent = session.content.toLowerCase();
    const hasIncomplete = incompleteKeywords.some(keyword => lowerContent.includes(keyword));

    if (hasIncomplete) {
      // Extract TODO items
      const lines = session.content.split('\n');
      const todoLines = lines.filter(line =>
        incompleteKeywords.some(keyword => line.toLowerCase().includes(keyword))
      );

      if (todoLines.length > 0) {
        suggestions.push({
          type: 'incomplete_work',
          priority: 'medium',
          title: 'Unfinished work from recent session',
          description: `You have incomplete work from ${session.mtime.toLocaleDateString()}`,
          context: todoLines[0].substring(0, 200),
          references: [basename(session.path)],
          action: 'Continue where you left off'
        });
      }
    }
  }

  return suggestions;
}

/**
 * Analyze for repeated tasks that could be automated
 */
function detectRepeatedPatterns(sessions: Array<{ path: string; mtime: Date; content: string }>): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Look for repeated command patterns
  const commandCounts: { [key: string]: number } = {};
  const commandPatterns = [
    /git (add|commit|push|pull|status)/gi,
    /npm (install|run|test|build)/gi,
    /bun (run|install|test)/gi,
    /docker (build|run|ps|logs)/gi,
  ];

  for (const session of sessions.slice(0, 10)) {
    for (const pattern of commandPatterns) {
      const matches = session.content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const normalized = match.toLowerCase();
          commandCounts[normalized] = (commandCounts[normalized] || 0) + 1;
        }
      }
    }
  }

  // Find repeated commands (appeared 3+ times)
  for (const [command, count] of Object.entries(commandCounts)) {
    if (count >= 3) {
      suggestions.push({
        type: 'automation',
        priority: 'low',
        title: `Repeated task: ${command}`,
        description: `You've run "${command}" ${count} times in recent sessions`,
        action: `Consider creating a script or alias to automate this`,
        context: `Usage pattern detected across multiple sessions`
      });
    }
  }

  return suggestions;
}

/**
 * Analyze for similar past issues
 */
function detectSimilarIssues(
  sessions: Array<{ path: string; mtime: Date; content: string }>,
  learnings: Array<{ path: string; mtime: Date; content: string }>
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Extract recent problem descriptions
  const recentProblems = sessions.slice(0, 3).map(s => {
    const lines = s.content.split('\n');
    return {
      session: s,
      keywords: extractKeywords(s.content)
    };
  });

  // Check if any learnings address similar issues
  for (const problem of recentProblems) {
    for (const learning of learnings) {
      const learningKeywords = extractKeywords(learning.content);
      const overlap = problem.keywords.filter(k => learningKeywords.includes(k));

      if (overlap.length >= 2) {
        suggestions.push({
          type: 'similar_issue',
          priority: 'high',
          title: 'Similar issue solved before',
          description: `Your current work resembles a past issue documented in learnings`,
          references: [basename(learning.path), basename(problem.session.path)],
          action: `Review ${basename(learning.path)} for potential solutions`,
          context: `Matching keywords: ${overlap.slice(0, 3).join(', ')}`
        });
      }
    }
  }

  return suggestions;
}

/**
 * Extract meaningful keywords from content
 */
function extractKeywords(content: string): string[] {
  const words = content.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4); // Only words 5+ chars

  // Count frequency
  const freq: { [key: string]: number } = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // Return top keywords (appeared 2+ times)
  return Object.entries(freq)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Generate git-related suggestions
 */
function generateGitSuggestions(gitState: AnalysisResult['gitState']): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (gitState.uncommittedChanges) {
    suggestions.push({
      type: 'git_action',
      priority: 'medium',
      title: 'Uncommitted changes detected',
      description: `You have uncommitted changes on branch ${gitState.branch}`,
      action: 'Review and commit your changes: git status && git add . && git commit',
      context: 'Uncommitted work could be lost'
    });
  }

  if (gitState.unpushedCommits > 0) {
    suggestions.push({
      type: 'git_action',
      priority: 'medium',
      title: `${gitState.unpushedCommits} unpushed commits`,
      description: `You have ${gitState.unpushedCommits} commit${gitState.unpushedCommits > 1 ? 's' : ''} not pushed to remote`,
      action: 'Push your commits: git push',
      context: 'Share your work and back it up remotely'
    });
  }

  if (gitState.staleBranches.length > 0) {
    suggestions.push({
      type: 'cleanup',
      priority: 'low',
      title: `${gitState.staleBranches.length} stale branches`,
      description: 'You have old branches that may need cleanup',
      action: `Review and delete: ${gitState.staleBranches.slice(0, 3).join(', ')}`,
      context: 'Keep repository tidy by removing old branches'
    });
  }

  return suggestions;
}

/**
 * Main analysis function
 */
function analyzeContext(): AnalysisResult {
  console.error('🔍 Analyzing recent History for context...\n');

  // Load recent sessions and learnings
  const sessions = getRecentFiles(join(HISTORY_DIR, 'Sessions'), 14); // 2 weeks
  const learnings = getRecentFiles(join(HISTORY_DIR, 'Learnings'), 30); // 1 month

  console.error(`📊 Found ${sessions.length} recent sessions, ${learnings.length} learnings\n`);

  // Analyze git state
  const gitState = analyzeGitState();

  // Generate suggestions
  const suggestions: Suggestion[] = [
    ...detectFailedAttempts(sessions),
    ...detectIncompleteWork(sessions),
    ...detectRepeatedPatterns(sessions),
    ...detectSimilarIssues(sessions, learnings),
    ...generateGitSuggestions(gitState)
  ];

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    timestamp: new Date(),
    suggestions,
    patterns: {
      recentFailures: detectFailedAttempts(sessions).map(s => s.context || ''),
      incompleteWork: detectIncompleteWork(sessions).map(s => s.context || ''),
      repeatedTasks: detectRepeatedPatterns(sessions).map(s => s.title)
    },
    gitState
  };
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
    output += `You're in good shape:\n`;
    output += `- No recent failures detected\n`;
    output += `- No incomplete work flagged\n`;
    output += `- Git state is clean\n\n`;
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
  output += `💡 **Pro Tip:** These suggestions are based on your recent work patterns.\n`;
  output += `The more you use PAI, the smarter these suggestions become!\n`;

  return output;
}

/**
 * Format a single suggestion
 */
function formatSuggestion(s: Suggestion): string {
  let output = `### ${s.title}\n\n`;
  output += `**${s.description}**\n\n`;

  if (s.context) {
    output += `*Context:* ${s.context}\n\n`;
  }

  if (s.action) {
    output += `📝 *Suggested Action:* ${s.action}\n\n`;
  }

  if (s.references && s.references.length > 0) {
    output += `📂 *References:* ${s.references.join(', ')}\n\n`;
  }

  output += `---\n\n`;
  return output;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const verbose = args.includes('--verbose');

  try {
    const result = analyzeContext();

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      const markdown = formatSuggestionsMarkdown(result);
      console.log(markdown);

      if (verbose) {
        console.error('\n📊 Analysis Details:\n');
        console.error(`- Recent failures: ${result.patterns.recentFailures.length}`);
        console.error(`- Incomplete work items: ${result.patterns.incompleteWork.length}`);
        console.error(`- Repeated tasks: ${result.patterns.repeatedTasks.length}`);
        console.error(`- Git uncommitted: ${result.gitState.uncommittedChanges}`);
        console.error(`- Git unpushed: ${result.gitState.unpushedCommits}`);
        console.error(`- Stale branches: ${result.gitState.staleBranches.length}\n`);
      }

      console.error(`\n✅ Generated ${result.suggestions.length} suggestions`);
    }
  } catch (error) {
    console.error('❌ Error analyzing context:', error);
    process.exit(1);
  }
}

main();
