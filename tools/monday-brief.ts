#!/usr/bin/env bun

/**
 * monday-brief.ts
 *
 * Generates proactive Monday morning system health check and weekly work summary.
 * Inspired by Clawdbot's Seneca assistant.
 *
 * Features:
 * - System health check (disk, memory, CPU, git)
 * - Weekly history summary (sessions, learnings, decisions)
 * - Key highlights and accomplishments
 * - This week's priorities and carried-over work
 * - Voice + visual notifications
 * - Saves to History/Briefs/
 *
 * Usage:
 *   bun run tools/monday-brief.ts           # Normal run
 *   bun run tools/monday-brief.ts --force   # Force even if not Monday
 *   bun run tools/monday-brief.ts --silent  # No notifications
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { checkThresholds, type ThresholdAlert } from './threshold-monitor';

// Configuration
const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const HISTORY_DIR = join(PAI_DIR, 'History');
const BRIEFS_DIR = join(HISTORY_DIR, 'Briefs');
const VOICE_SERVER = 'http://localhost:8888';

interface HistoryEntry {
  path: string;
  content: string;
  type: 'session' | 'learning';
  date: Date;
  filename: string;
}

interface SystemHealth {
  disk: { free: string; percent: string; status: string };
  memory: { available: string; status: string };
  cpu: { usage: string; status: string };
  git: { branch: string; status: string; ahead: number };
}

interface WeeklySummary {
  sessions: HistoryEntry[];
  learnings: HistoryEntry[];
  totalSessions: number;
  totalLearnings: number;
  dateRange: { start: string; end: string };
}

/**
 * Get system health information
 */
function getSystemHealth(): SystemHealth {
  const health: SystemHealth = {
    disk: { free: 'unknown', percent: '0%', status: '❓' },
    memory: { available: 'unknown', status: '❓' },
    cpu: { usage: 'unknown', status: '❓' },
    git: { branch: 'unknown', status: 'unknown', ahead: 0 }
  };

  try {
    // Disk usage
    const dfOutput = execSync('df -h / | tail -1', { encoding: 'utf-8' });
    const dfParts = dfOutput.trim().split(/\s+/);
    const diskUsed = parseInt(dfParts[4]);
    const diskFree = dfParts[3];
    health.disk.free = diskFree;
    health.disk.percent = `${100 - diskUsed}%`;
    health.disk.status = diskUsed < 80 ? '✅' : diskUsed < 90 ? '⚠️' : '❌';
  } catch (e) {
    console.error('Could not get disk info:', e);
  }

  try {
    // Memory info (macOS)
    const vmOutput = execSync('vm_stat | grep "Pages free"', { encoding: 'utf-8' });
    const pagesFree = parseInt(vmOutput.match(/\d+/)?.[0] || '0');
    const gbFree = Math.round((pagesFree * 4096) / (1024 * 1024 * 1024));
    health.memory.available = `${gbFree} GB`;
    health.memory.status = gbFree > 4 ? '✅' : gbFree > 2 ? '⚠️' : '❌';
  } catch (e) {
    console.error('Could not get memory info:', e);
  }

  try {
    // CPU usage (macOS)
    const topOutput = execSync('top -l 1 | grep "CPU usage"', { encoding: 'utf-8' });
    const cpuMatch = topOutput.match(/(\d+\.\d+)% user/);
    const cpuUsage = cpuMatch ? cpuMatch[1] : '0';
    health.cpu.usage = `${cpuUsage}%`;
    health.cpu.status = parseFloat(cpuUsage) < 50 ? '✅' : parseFloat(cpuUsage) < 80 ? '⚠️' : '❌';
  } catch (e) {
    console.error('Could not get CPU info:', e);
  }

  try {
    // Git status
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    const gitStatus = execSync('git status --short', { encoding: 'utf-8' }).trim();
    const gitAhead = execSync('git rev-list --count @{u}..HEAD 2>/dev/null || echo "0"', { encoding: 'utf-8' }).trim();

    health.git.branch = gitBranch;
    health.git.status = gitStatus === '' ? 'clean' : 'uncommitted changes';
    health.git.ahead = parseInt(gitAhead);
  } catch (e) {
    console.error('Could not get git info:', e);
  }

  return health;
}

/**
 * Get recent files from directory within date range
 */
function getRecentFiles(dir: string, daysBack: number = 7): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const cutoffDate = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
  const files: { path: string; mtime: Date }[] = [];

  function walk(currentDir: string) {
    try {
      const entries = readdirSync(currentDir);
      for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.md') && stat.mtime.getTime() > cutoffDate) {
          files.push({ path: fullPath, mtime: stat.mtime });
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  walk(dir);

  return files
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    .map(f => f.path);
}

/**
 * Extract summary from markdown content
 */
function extractSummary(content: string, maxLength: number = 500): string {
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

  const firstParagraph = content.split('\n\n')[0];
  return firstParagraph.length > maxLength
    ? firstParagraph.substring(0, maxLength) + '...'
    : firstParagraph;
}

/**
 * Load weekly history summary
 */
function getWeeklySummary(): WeeklySummary {
  const summary: WeeklySummary = {
    sessions: [],
    learnings: [],
    totalSessions: 0,
    totalLearnings: 0,
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      end: new Date().toLocaleDateString()
    }
  };

  // Load sessions from past 7 days
  const sessionsDir = join(HISTORY_DIR, 'Sessions');
  const recentSessions = getRecentFiles(sessionsDir, 7);
  summary.totalSessions = recentSessions.length;

  for (const sessionPath of recentSessions.slice(0, 5)) {
    try {
      const content = readFileSync(sessionPath, 'utf-8');
      const stat = statSync(sessionPath);
      summary.sessions.push({
        path: sessionPath,
        content: extractSummary(content),
        type: 'session',
        date: stat.mtime,
        filename: basename(sessionPath)
      });
    } catch (error) {
      console.error(`Could not read session: ${sessionPath}`);
    }
  }

  // Load learnings from past 7 days
  const learningsDir = join(HISTORY_DIR, 'Learnings');
  const recentLearnings = getRecentFiles(learningsDir, 7);
  summary.totalLearnings = recentLearnings.length;

  for (const learningPath of recentLearnings) {
    try {
      const content = readFileSync(learningPath, 'utf-8');
      const stat = statSync(learningPath);
      summary.learnings.push({
        path: learningPath,
        content: extractSummary(content),
        type: 'learning',
        date: stat.mtime,
        filename: basename(learningPath)
      });
    } catch (error) {
      console.error(`Could not read learning: ${learningPath}`);
    }
  }

  return summary;
}

/**
 * Generate Monday brief markdown
 */
function generateBrief(health: SystemHealth, summary: WeeklySummary, alerts: ThresholdAlert[]): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let brief = `# Monday Brief - ${today}\n\n`;
  brief += `🌅 Good Monday Morning!\n\n`;
  brief += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // System Health
  brief += `## 🖥️ SYSTEM HEALTH\n\n`;
  brief += `**Mac Status:**\n`;
  brief += `  ${health.disk.status} Disk: ${health.disk.free} free (${health.disk.percent})\n`;
  brief += `  ${health.memory.status} Memory: ${health.memory.available} available\n`;
  brief += `  ${health.cpu.status} CPU: ${health.cpu.usage} usage\n\n`;
  brief += `**Git Status:**\n`;
  brief += `  ✓ On branch: ${health.git.branch}\n`;
  brief += `  ✓ Working directory: ${health.git.status}\n`;
  if (health.git.ahead > 0) {
    brief += `  ↑ ${health.git.ahead} commit${health.git.ahead > 1 ? 's' : ''} ahead of origin\n`;
  }
  brief += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Weekly Activity
  brief += `## 📊 LAST WEEK'S ACTIVITY (${summary.dateRange.start} - ${summary.dateRange.end})\n\n`;
  brief += `**Sessions:** ${summary.totalSessions} total\n`;
  if (summary.sessions.length > 0) {
    brief += `\nRecent sessions:\n`;
    for (const session of summary.sessions.slice(0, 3)) {
      brief += `  • ${session.filename.replace(/_SESSION.*\.md$/, '').replace(/-/g, '/')}\n`;
    }
  }
  brief += `\n**Learnings:** ${summary.totalLearnings} captured\n`;
  if (summary.learnings.length > 0) {
    brief += `\nKey learnings:\n`;
    for (const learning of summary.learnings) {
      const title = learning.filename.replace(/\.md$/, '').replace(/_/g, ' ').replace(/-/g, ' ');
      brief += `  • ${title}\n`;
    }
  }
  brief += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Highlights
  if (summary.sessions.length > 0 || summary.learnings.length > 0) {
    brief += `## 🎯 KEY HIGHLIGHTS\n\n`;

    if (summary.sessions.length > 0) {
      const firstSession = summary.sessions[0];
      brief += `**Recent Work:**\n${firstSession.content}\n\n`;
    }

    if (summary.learnings.length > 0) {
      const firstLearning = summary.learnings[0];
      brief += `**Latest Learning:**\n${firstLearning.content}\n\n`;
    }

    brief += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  // Flywheel Insights (Reactive + Predictive)
  if (alerts.length > 0) {
    const reactiveAlerts = alerts.filter(a => a.predictionType === 'reactive');
    const predictiveAlerts = alerts.filter(a => a.predictionType === 'predictive');
    const strategicAlerts = alerts.filter(a => a.priority === 'strategic');

    if (strategicAlerts.length > 0) {
      brief += `## 🔮 FLYWHEEL INSIGHTS\n\n`;

      // Show predictive first (forward-looking)
      if (predictiveAlerts.length > 0) {
        brief += `**Predictive Suggestions** (Forward-Looking):\n`;
        for (const alert of predictiveAlerts.slice(0, 3)) {
          brief += `  🔮 ${alert.pattern}\n`;
          brief += `     ${alert.suggestion}\n`;
          if (alert.telosNote) {
            brief += `     📍 ${alert.telosNote}\n`;
          }
          brief += `\n`;
        }
      }

      // Then reactive patterns
      if (reactiveAlerts.filter(a => a.priority === 'strategic').length > 0) {
        brief += `**Pattern Detections** (Last 30 Days):\n`;
        for (const alert of reactiveAlerts.filter(a => a.priority === 'strategic').slice(0, 3)) {
          brief += `  📊 ${alert.pattern}\n`;
          brief += `     Count: ${alert.count} | Confidence: ${alert.confidence}%\n`;
          if (alert.telosNote) {
            brief += `     📍 ${alert.telosNote}\n`;
          }
          brief += `\n`;
        }
      }

      brief += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }
  }

  // This Week
  brief += `## 📝 THIS WEEK\n\n`;
  brief += `**Priorities:**\n`;
  brief += `  1. Review and build on last week's progress\n`;
  brief += `  2. Address any carried-over items\n`;
  brief += `  3. Plan new features or improvements\n\n`;
  brief += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Footer
  brief += `Have a productive week! 🚀\n\n`;
  brief += `---\n\n`;
  brief += `*Generated by PAI Monday Brief System*\n`;
  brief += `*Inspired by Clawdbot's Seneca*\n`;

  return brief;
}

/**
 * Send notification to voice server
 */
async function sendNotification(message: string): Promise<void> {
  try {
    const voiceId = process.env.DA_VOICE_ID || 'default-voice-id';
    const daName = process.env.DA || 'PAI';

    const response = await fetch(`${VOICE_SERVER}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${daName} Monday Brief`,
        message,
        voice_enabled: true,
        priority: 'high',
        voice_id: voiceId
      })
    });

    if (!response.ok) {
      console.error(`Notification failed: ${response.status}`);
    }
  } catch (error) {
    // Silently fail if voice server isn't running
    console.error('Voice server not available:', error);
  }
}

/**
 * Save brief to History/Briefs/
 */
function saveBrief(brief: string): string {
  if (!existsSync(BRIEFS_DIR)) {
    mkdirSync(BRIEFS_DIR, { recursive: true });
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `${today}_monday-brief.md`;
  const filepath = join(BRIEFS_DIR, filename);

  writeFileSync(filepath, brief, 'utf-8');
  return filepath;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const forceRun = args.includes('--force');
  const silent = args.includes('--silent');

  // Check if today is Monday (unless forced)
  if (!forceRun) {
    const today = new Date().getDay();
    if (today !== 1) {
      console.log('ℹ️  Not Monday. Use --force to run anyway.');
      process.exit(0);
    }
  }

  console.log('🌅 Generating Monday Brief...\n');

  // Gather information
  console.log('📊 Checking system health...');
  const health = getSystemHealth();

  console.log('📚 Loading weekly history...');
  const summary = getWeeklySummary();

  console.log('🔮 Checking flywheel insights...');
  const alerts = checkThresholds();
  console.log(`   Found ${alerts.length} patterns (${alerts.filter(a => a.predictionType === 'predictive').length} predictive)`);

  console.log('✍️  Generating brief...');
  const brief = generateBrief(health, summary, alerts);

  // Save to file
  console.log('💾 Saving to History/Briefs/...');
  const filepath = saveBrief(brief);
  console.log(`✅ Saved: ${filepath}\n`);

  // Output brief
  console.log(brief);

  // Send notification
  if (!silent) {
    console.log('📢 Sending notification...');
    await sendNotification('Your Monday brief is ready! Check terminal for details.');
  }

  console.log('\n✅ Monday brief complete!');
}

main();
