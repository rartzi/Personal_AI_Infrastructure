#!/usr/bin/env bun

/**
 * post-tool-use-metrics.ts
 *
 * PostToolUse hook for the self-improvement flywheel.
 * Automatically logs every tool invocation to metrics/YYYY-MM/tool-usage.jsonl
 *
 * This provides the foundation for pattern detection, threshold monitoring,
 * and meta-learning in the flywheel system.
 *
 * Add to settings.json PostToolUse hooks:
 *   {
 *     "type": "command",
 *     "command": "${PAI_DIR}/hooks/post-tool-use-metrics.ts"
 *   }
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface PostToolUseContext {
  tool: string;
  args: any;
  result: any;
  duration?: number;
  sessionId?: string;
  error?: any;
}

interface ToolUsageEntry {
  timestamp: string;
  tool: string;
  duration: number;
  sessionId: string;
  context: {
    fileCount?: number;
    commandType?: string | null;
    hasError?: boolean;
  };
}

/**
 * Extract lightweight context from tool usage
 */
function extractContext(tool: string, args: any, result: any, error: any): ToolUsageEntry['context'] {
  const context: ToolUsageEntry['context'] = {};

  // File operations
  if (tool === 'Read' || tool === 'Edit' || tool === 'Write') {
    context.fileCount = 1;
  }

  // Bash commands
  if (tool === 'Bash' && args?.command) {
    const command = args.command;
    // Extract first word as command type
    context.commandType = command.split(/\s+/)[0] || null;
  }

  // Error tracking
  if (error) {
    context.hasError = true;
  }

  return context;
}

/**
 * Main hook execution
 */
async function main() {
  try {
    // Read context from stdin (Claude Code passes PostToolUse data via stdin)
    const stdin = await Bun.stdin.text();

    if (!stdin) {
      // No data provided, exit silently
      return;
    }

    const context: PostToolUseContext = JSON.parse(stdin);
    const { tool, args, result, duration = 0, sessionId = 'unknown', error } = context;

    // Prepare metrics directory
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthDir = join(process.env.HOME!, '.claude/metrics', `${year}-${month}`);

    if (!existsSync(monthDir)) {
      mkdirSync(monthDir, { recursive: true });
    }

    // Create log entry
    const logEntry: ToolUsageEntry = {
      timestamp: now.toISOString(),
      tool,
      duration,
      sessionId,
      context: extractContext(tool, args, result, error)
    };

    // Append to JSONL
    appendFileSync(
      join(monthDir, 'tool-usage.jsonl'),
      JSON.stringify(logEntry) + '\n'
    );

    // Success - output nothing (PostToolUse hooks should be silent)
  } catch (error) {
    // Silent failure - don't break the tool execution
    // Log to stderr for debugging if needed
    console.error('PostToolUse metrics hook error:', error);
  }
}

main();
