#!/usr/bin/env bun

/**
 * load-context-suggestions.ts
 *
 * SessionStart hook that provides HIGH-VALUE context-aware suggestions:
 * - Research threads worth revisiting
 * - Unfinished creative ideas
 * - Goals and progress tracking
 * - Build opportunities (patterns, gaps, ambitions)
 *
 * NO MORE GIT NOISE in default output.
 *
 * Terminal Output: Uses process.stderr for user visibility
 * Context Injection: Uses process.stdout for Claude's context
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const CONTEXT_ANALYZER = join(PAI_DIR, '../tools/context-analyzer.ts');

// ANSI color codes for terminal
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Format a suggestion for terminal display (compact)
 */
function formatTerminalSuggestion(line: string): string {
  // Detect priority and format with colors
  if (line.includes('High Priority')) {
    return `${colors.red}${colors.bold}▌ HIGH PRIORITY${colors.reset}`;
  }
  if (line.includes('Medium Priority')) {
    return `${colors.yellow}${colors.bold}▌ MEDIUM PRIORITY${colors.reset}`;
  }
  if (line.includes('Low Priority')) {
    return `${colors.green}${colors.bold}▌ LOW PRIORITY${colors.reset}`;
  }

  // Format suggestion titles with icons
  if (line.includes('### 🔬')) {
    return `${colors.cyan}  🔬 ${line.replace('### 🔬 ', '')}${colors.reset}`;
  }
  if (line.includes('### 💭')) {
    return `${colors.magenta}  💭 ${line.replace('### 💭 ', '')}${colors.reset}`;
  }
  if (line.includes('### 🎯')) {
    return `${colors.blue}  🎯 ${line.replace('### 🎯 ', '')}${colors.reset}`;
  }
  if (line.includes('### 🔨')) {
    return `${colors.yellow}  🔨 ${line.replace('### 🔨 ', '')}${colors.reset}`;
  }

  // Format actions
  if (line.startsWith('→ **Action:**')) {
    return `${colors.dim}     → ${line.replace('→ **Action:** ', '')}${colors.reset}`;
  }

  return null;
}

/**
 * Parse and display suggestions in terminal
 */
function displayInTerminal(markdown: string) {
  const lines = markdown.split('\n');
  let displayLines: string[] = [];
  let inSuggestion = false;

  for (const line of lines) {
    const formatted = formatTerminalSuggestion(line);
    if (formatted) {
      displayLines.push(formatted);
      inSuggestion = true;
    } else if (line.startsWith('**') && inSuggestion && !line.includes('---')) {
      // Description line
      const desc = line.replace(/\*\*/g, '').substring(0, 80);
      displayLines.push(`${colors.dim}     ${desc}${colors.reset}`);
    }
  }

  // Output to stderr (visible to user in terminal)
  if (displayLines.length > 0) {
    console.error('');
    console.error(`${colors.bold}━━━ CONTEXT SUGGESTIONS ━━━${colors.reset}`);
    console.error('');
    for (const line of displayLines) {
      console.error(line);
    }
    console.error('');
    console.error(`${colors.dim}💡 Type /suggestions for full details${colors.reset}`);
    console.error(`${colors.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.error('');
  }
}

async function main() {
  try {
    // Check if this is a subagent session - if so, exit silently
    const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
    const isSubagent = claudeProjectDir.includes('/.claude/agents/') ||
                      process.env.CLAUDE_AGENT_TYPE !== undefined;

    if (isSubagent) {
      process.exit(0);
    }

    // Check if context analyzer exists
    if (!existsSync(CONTEXT_ANALYZER)) {
      console.error('⚠️ Context analyzer not found - skipping suggestions');
      process.exit(0);
    }

    // Run context analyzer
    const suggestions = execSync(`bun run "${CONTEXT_ANALYZER}"`, {
      encoding: 'utf-8',
      cwd: join(PAI_DIR, '..'),
      stdio: ['pipe', 'pipe', 'pipe'] // Capture stderr too
    });

    // Check if we have suggestions
    const hasHigh = suggestions.includes('High Priority');
    const hasMedium = suggestions.includes('Medium Priority');

    if (!hasHigh && !hasMedium) {
      console.error('✅ All clear - no high-priority suggestions');
      process.exit(0);
    }

    // Display compact version in terminal
    displayInTerminal(suggestions);

    // Output full suggestions to stdout for Claude's context
    const message = `<system-reminder>
CONTEXT-AWARE SUGGESTIONS (Proactive Guidance)

${suggestions}

---

These suggestions are automatically generated based on your recent work patterns.
Consider them as you plan your session. High-priority items need immediate attention.
</system-reminder>`;

    console.log(message);
    process.exit(0);
  } catch (error) {
    // Don't fail session start on error
    console.error('⚠️ Context suggestions unavailable');
    process.exit(0);
  }
}

main();
