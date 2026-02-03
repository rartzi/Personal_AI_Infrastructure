#!/usr/bin/env bun

/**
 * load-context-suggestions.ts
 *
 * SessionStart hook that analyzes recent History and provides context-aware
 * suggestions based on work patterns. Inspired by Clawdbot's Seneca proactive intelligence.
 *
 * Provides:
 * - Failed attempt detection → Try alternatives
 * - Incomplete work reminders → Continue where left off
 * - Similar issue references → Leverage past solutions
 * - Automation opportunities → Improve workflow
 * - Git state awareness → Commit, push, cleanup
 *
 * Setup:
 * 1. Add to SessionStart hooks in settings.json (after load-daily-memory.ts)
 * 2. Suggestions appear in session start output
 * 3. High-priority items flagged for immediate attention
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const CONTEXT_ANALYZER = join(PAI_DIR, '../tools/context-analyzer.ts');

async function main() {
  try {
    // Check if this is a subagent session - if so, exit silently
    const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
    const isSubagent = claudeProjectDir.includes('/.claude/agents/') ||
                      process.env.CLAUDE_AGENT_TYPE !== undefined;

    if (isSubagent) {
      console.error('🤖 Subagent session - skipping context suggestions');
      process.exit(0);
    }

    // Check if context analyzer exists
    if (!existsSync(CONTEXT_ANALYZER)) {
      console.error('⚠️ Context analyzer not found - skipping suggestions');
      process.exit(0);
    }

    console.error('💡 Analyzing context for suggestions...');

    // Run context analyzer
    const suggestions = execSync(`bun run "${CONTEXT_ANALYZER}"`, {
      encoding: 'utf-8',
      cwd: join(PAI_DIR, '..')
    });

    // Extract priority counts for summary
    const highCount = (suggestions.match(/## 🔴 High Priority/g) || []).length;
    const mediumCount = (suggestions.match(/## 🟡 Medium Priority/g) || []).length;
    const lowCount = (suggestions.match(/## 🟢 Low Priority/g) || []).length;
    const totalCount = highCount + mediumCount + lowCount;

    if (totalCount === 0) {
      console.error('✅ All clear - no suggestions at this time');
      process.exit(0);
    }

    console.error(`✅ Generated ${totalCount} suggestions (${highCount} high, ${mediumCount} medium, ${lowCount} low priority)`);

    // Output as system-reminder
    const message = `<system-reminder>
CONTEXT-AWARE SUGGESTIONS (Proactive Guidance)

${suggestions}

---

These suggestions are automatically generated based on your recent work patterns.
Consider them as you plan your session. High-priority items need immediate attention.
</system-reminder>`;

    // Write to stdout (will be captured by Claude Code)
    console.log(message);

    console.error('✅ Context suggestions injected into session');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error loading context suggestions:', error);
    // Don't fail session start on error
    process.exit(0);
  }
}

main();
