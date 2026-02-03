#!/usr/bin/env bun

/**
 * monday-brief-cron.ts
 *
 * Cron wrapper for Monday brief that checks:
 * - If today is Monday
 * - If brief already run today
 * - Executes monday-brief.ts if conditions met
 *
 * Add to crontab:
 *   0 9 * * 1 cd /path/to/PAI && bun run tools/monday-brief-cron.ts
 *
 * Or use launchd on macOS (see tools/com.pai.monday-brief.plist)
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const LOCKFILE = join(tmpdir(), 'pai-monday-brief.lock');
const LOGFILE = join(tmpdir(), 'pai-monday-brief.log');

/**
 * Check if brief already run today
 */
function alreadyRunToday(): boolean {
  if (!existsSync(LOCKFILE)) {
    return false;
  }

  const lockContent = readFileSync(LOCKFILE, 'utf-8');
  const lockDate = new Date(lockContent);
  const today = new Date();

  return (
    lockDate.getFullYear() === today.getFullYear() &&
    lockDate.getMonth() === today.getMonth() &&
    lockDate.getDate() === today.getDate()
  );
}

/**
 * Mark as run today
 */
function markRunToday(): void {
  writeFileSync(LOCKFILE, new Date().toISOString(), 'utf-8');
}

/**
 * Log message
 */
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  console.log(message);

  try {
    const existingLog = existsSync(LOGFILE) ? readFileSync(LOGFILE, 'utf-8') : '';
    writeFileSync(LOGFILE, existingLog + logMessage, 'utf-8');
  } catch (e) {
    // Ignore log write errors
  }
}

/**
 * Main execution
 */
function main() {
  log('Monday brief cron started');

  // Check if today is Monday
  const today = new Date().getDay();
  if (today !== 1) {
    log(`Not Monday (day=${today}), skipping`);
    process.exit(0);
  }

  // Check if already run today
  if (alreadyRunToday()) {
    log('Already run today, skipping');
    process.exit(0);
  }

  log('Conditions met, running Monday brief...');

  try {
    // Run monday-brief.ts
    const scriptPath = join(__dirname, 'monday-brief.ts');
    const output = execSync(`bun run "${scriptPath}"`, {
      cwd: join(PAI_DIR, '..'),
      env: { ...process.env, PAI_DIR },
      encoding: 'utf-8'
    });

    log('Monday brief completed successfully');
    log(`Output: ${output.substring(0, 200)}...`);

    // Mark as run
    markRunToday();
  } catch (error) {
    log(`Monday brief failed: ${error}`);
    process.exit(1);
  }
}

main();
