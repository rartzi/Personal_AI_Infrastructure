#!/usr/bin/env bun

/**
 * load-daily-memory.ts
 *
 * Automatically loads recent History entries at session start to provide continuity
 * across sessions - similar to how Clawdbot's Seneca reads memory/YYYY-MM-DD.md files.
 *
 * Purpose:
 * - Read last 2 session summaries from History/Sessions/
 * - Read last 3 learning entries from History/Learnings/
 * - Read today's date-specific notes if they exist
 * - Inject as system-reminder for immediate context continuity
 *
 * What gets loaded:
 * 1. Sessions: Recent conversation summaries (last 2 sessions)
 * 2. Learnings: Problem-solving narratives and lessons (last 3 entries)
 * 3. Today's notes: Any work-in-progress for current date
 *
 * Setup:
 * 1. Add this hook to settings.json SessionStart hooks (after load-core-context.ts)
 * 2. Ensure PAI_DIR environment variable is set (defaults to $HOME/.claude)
 * 3. History system must be active (History/ directory exists)
 *
 * How it works:
 * - Runs at the start of every Claude Code session
 * - Skips execution for subagent sessions (they don't need daily memory)
 * - Searches for most recent files in History/Sessions/ and History/Learnings/
 * - Extracts key context (summaries, decisions, lessons learned)
 * - Injects as <system-reminder> which Claude processes automatically
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { PAI_DIR } from './lib/pai-paths';

const HISTORY_DIR = join(PAI_DIR, 'History');

interface HistoryEntry {
  path: string;
  content: string;
  type: 'session' | 'learning' | 'today';
  date: Date;
  filename: string;
}

/**
 * Get most recent files from a directory, sorted by modification time
 */
function getRecentFiles(dir: string, limit: number): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const files: { path: string; mtime: Date }[] = [];

  // Recursively walk directories
  function walk(currentDir: string) {
    try {
      const entries = readdirSync(currentDir);
      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.md')) {
          files.push({ path: fullPath, mtime: stat.mtime });
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  walk(dir);

  // Sort by modification time (newest first) and return top N
  return files
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    .slice(0, limit)
    .map(f => f.path);
}

/**
 * Extract summary section from markdown content
 */
function extractSummary(content: string, maxLength: number = 1000): string {
  // Look for common summary patterns
  const summaryPatterns = [
    /## Summary\n([\s\S]*?)(?=\n##|$)/i,
    /SUMMARY:([\s\S]*?)(?=\nANALYSIS:|$)/i,
    /# Summary\n([\s\S]*?)(?=\n#|$)/i,
  ];

  for (const pattern of summaryPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const summary = match[1].trim();
      return summary.length > maxLength
        ? summary.substring(0, maxLength) + '...'
        : summary;
    }
  }

  // If no summary section found, take first paragraph
  const firstParagraph = content.split('\n\n')[0];
  return firstParagraph.length > maxLength
    ? firstParagraph.substring(0, maxLength) + '...'
    : firstParagraph;
}

/**
 * Load recent history entries
 */
function loadRecentHistory(): HistoryEntry[] {
  const entries: HistoryEntry[] = [];

  // 1. Load last 2 session summaries
  const sessionsDir = join(HISTORY_DIR, 'Sessions');
  const recentSessions = getRecentFiles(sessionsDir, 2);

  for (const sessionPath of recentSessions) {
    try {
      const content = readFileSync(sessionPath, 'utf-8');
      const summary = extractSummary(content, 800);
      entries.push({
        path: sessionPath,
        content: summary,
        type: 'session',
        date: statSync(sessionPath).mtime,
        filename: basename(sessionPath)
      });
    } catch (error) {
      console.error(`⚠️ Could not read session: ${sessionPath}`);
    }
  }

  // 2. Load last 3 learning entries
  const learningsDir = join(HISTORY_DIR, 'Learnings');
  const recentLearnings = getRecentFiles(learningsDir, 3);

  for (const learningPath of recentLearnings) {
    try {
      const content = readFileSync(learningPath, 'utf-8');
      const summary = extractSummary(content, 800);
      entries.push({
        path: learningPath,
        content: summary,
        type: 'learning',
        date: statSync(learningPath).mtime,
        filename: basename(learningPath)
      });
    } catch (error) {
      console.error(`⚠️ Could not read learning: ${learningPath}`);
    }
  }

  // 3. Check for today's date-specific notes
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const yearMonth = todayStr.substring(0, 7); // YYYY-MM

  // Look in common History subdirectories for today's files
  const todaySearchDirs = [
    join(HISTORY_DIR, 'Sessions', yearMonth),
    join(HISTORY_DIR, 'Learnings', yearMonth),
    join(HISTORY_DIR, 'Research', yearMonth),
    join(HISTORY_DIR, 'Decisions', yearMonth),
  ];

  for (const dir of todaySearchDirs) {
    if (!existsSync(dir)) continue;

    try {
      const files = readdirSync(dir);
      for (const file of files) {
        if (file.includes(todayStr) && file.endsWith('.md')) {
          const todayPath = join(dir, file);
          const content = readFileSync(todayPath, 'utf-8');
          const summary = extractSummary(content, 600);
          entries.push({
            path: todayPath,
            content: summary,
            type: 'today',
            date: statSync(todayPath).mtime,
            filename: file
          });
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  return entries;
}

/**
 * Format history entries as markdown
 */
function formatHistoryContext(entries: HistoryEntry[]): string {
  if (entries.length === 0) {
    return 'No recent history entries found.';
  }

  const sections: string[] = [];

  // Group by type
  const sessions = entries.filter(e => e.type === 'session');
  const learnings = entries.filter(e => e.type === 'learning');
  const today = entries.filter(e => e.type === 'today');

  if (sessions.length > 0) {
    sections.push('### Recent Sessions\n');
    for (const entry of sessions) {
      sections.push(`**${entry.filename}** (${entry.date.toLocaleDateString()}):\n${entry.content}\n`);
    }
  }

  if (learnings.length > 0) {
    sections.push('\n### Recent Learnings\n');
    for (const entry of learnings) {
      sections.push(`**${entry.filename}** (${entry.date.toLocaleDateString()}):\n${entry.content}\n`);
    }
  }

  if (today.length > 0) {
    sections.push('\n### Today\'s Work\n');
    for (const entry of today) {
      sections.push(`**${entry.filename}**:\n${entry.content}\n`);
    }
  }

  return sections.join('\n');
}

async function main() {
  try {
    // Check if this is a subagent session - if so, exit silently
    const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
    const isSubagent = claudeProjectDir.includes('/.claude/agents/') ||
                      process.env.CLAUDE_AGENT_TYPE !== undefined;

    if (isSubagent) {
      console.error('🤖 Subagent session - skipping daily memory loading');
      process.exit(0);
    }

    // Check if History directory exists
    if (!existsSync(HISTORY_DIR)) {
      console.error('⚠️ History directory not found - skipping daily memory loading');
      console.error(`   Expected: ${HISTORY_DIR}`);
      process.exit(0);
    }

    console.error('🧠 Loading recent History for session continuity...');

    // Load recent history entries
    const entries = loadRecentHistory();

    if (entries.length === 0) {
      console.error('ℹ️ No recent history entries found');
      process.exit(0);
    }

    console.error(`✅ Loaded ${entries.length} recent history entries`);

    // Format as context
    const historyContext = formatHistoryContext(entries);

    // Output as system-reminder
    const message = `<system-reminder>
DAILY MEMORY INJECTION (Auto-loaded at Session Start)

The following recent history has been loaded to provide session continuity:

${historyContext}

---

This memory provides context from recent work and helps maintain continuity across sessions.
Use this information to remember recent decisions, ongoing work, and lessons learned.
</system-reminder>`;

    // Write to stdout (will be captured by Claude Code)
    console.log(message);

    console.error('✅ Daily memory injected into session');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in load-daily-memory hook:', error);
    process.exit(1);
  }
}

main();
