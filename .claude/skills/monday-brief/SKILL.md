---
name: monday-brief
description: Proactive Monday morning system health check and weekly work summary. USE WHEN user says "Monday brief", "weekly summary", "system status", OR it's Monday morning and user wants proactive update.
---

# Monday Brief - Proactive Weekly Summary

**Auto-runs Monday mornings at 9 AM. Manual trigger: "Give me the Monday brief"**

Inspired by Clawdbot's Seneca assistant, which provides proactive Monday morning briefs about system health and weekly activity.

## What This Skill Does

Generates a comprehensive Monday morning brief containing:

1. **System Health Check**
   - Mac system status (CPU, memory, disk)
   - Git repository status
   - Running processes/services

2. **Weekly Work Summary**
   - Sessions from past 7 days
   - Learnings captured this week
   - Key decisions made
   - Projects worked on

3. **This Week's Context**
   - Unfinished work carried over
   - Open questions to resolve
   - Suggested priorities

## Workflow

### Manual Trigger

When user says:
- "Give me the Monday brief"
- "What's my weekly summary?"
- "Monday morning update"
- "System health and weekly work"

### Automatic Trigger

Runs automatically via cron:
- **When**: Monday mornings at 9 AM
- **How**: `monday-brief-cron.ts` script
- **Output**: Terminal notification + saved to History/

## Implementation

### 1. System Health Check

```bash
# Mac system info
df -h / | tail -1  # Disk usage
vm_stat | grep "Pages free"  # Memory
top -l 1 | grep "CPU usage"  # CPU

# Git status
git status --short --branch

# Running services (if applicable)
docker ps  # If Docker is used
```

### 2. Weekly History Summary

```typescript
// Load sessions from past 7 days
const sessionsDir = join(PAI_DIR, 'History/Sessions');
const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

// Filter sessions by mtime > oneWeekAgo
// Extract summaries
// Count by project/topic
```

### 3. Learning Highlights

```typescript
// Load learnings from past 7 days
const learningsDir = join(PAI_DIR, 'History/Learnings');

// Extract key lessons
// Highlight debugging insights
// Note patterns discovered
```

### 4. Format Output

```markdown
# Monday Brief - [Date]

## 🖥️ System Health
- Mac: ✅ Healthy (72% disk free, 16GB memory)
- Git: ✅ Clean working directory on main
- Services: ✅ All running

## 📊 Last Week's Work
- 12 sessions recorded
- 3 learnings captured
- 2 projects worked on:
  - Daily Memory Injection (completed)
  - Monday Brief System (in progress)

## 🎯 Key Highlights
- Implemented Seneca-style memory system
- Fixed cross-session context continuity
- Documented daily memory injection

## 📝 This Week
- Complete Monday brief feature
- Test proactive scheduling
- Consider voice interface integration

## ❓ Open Questions
- Should we add multi-surface access?
- Voice interface priority?
```

## Files

### Core Script: `tools/monday-brief.ts`

Main logic for generating the brief.

### Cron Runner: `tools/monday-brief-cron.ts`

Handles automatic Monday morning execution:
- Checks if today is Monday
- Checks if already run today
- Generates brief
- Sends notification
- Saves to History/

### Notification: Voice + Visual

```typescript
// Send to voice server
await fetch('http://localhost:8888/notify', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Monday Brief Ready',
    message: 'Your weekly summary is ready.',
    voice_enabled: true,
    priority: 'high'
  })
});
```

## Cron Configuration

Add to system crontab:

```bash
# Monday Brief - Runs every Monday at 9 AM
0 9 * * 1 cd /path/to/PAI && bun run tools/monday-brief-cron.ts

# Alternative: Use launchd on macOS
# See tools/com.pai.monday-brief.plist
```

## Output Destinations

1. **Terminal Notification** - If session is active
2. **Voice Notification** - If voice server is running
3. **History File** - `History/Briefs/YYYY-MM-DD_monday-brief.md`
4. **Return to User** - Full brief as response

## Manual Usage

```bash
# Run manually
bun run tools/monday-brief.ts

# Force even if not Monday
bun run tools/monday-brief.ts --force

# Skip notifications (just generate report)
bun run tools/monday-brief.ts --silent
```

## Configuration

Environment variables (set in settings.json):

```json
{
  "env": {
    "MONDAY_BRIEF_TIME": "09:00",
    "MONDAY_BRIEF_ENABLED": "true",
    "MONDAY_BRIEF_VOICE": "true"
  }
}
```

## Integration Points

- **Daily Memory Injection**: Uses same History scanning logic
- **Context-Aware Suggestions**: Pulls research revival and build opportunities
- **Voice System**: Sends notifications via localhost:8888
- **History System**: Saves briefs to History/Briefs/
- **Notification System**: Terminal + voice output

### High-Value Intelligence Integration

Monday brief now includes output from the context-suggestions system:

```typescript
import { extractAll } from './suggestion-extractor';
import { getTopSuggestions } from './derived-intelligence';

// In Monday brief generation:
const extracted = extractAll();
const derived = getTopSuggestions(2);

// Add to brief:
// - Research Revival: extracted.research.filter(r => r.status === 'stale')
// - Unfinished Ideas: extracted.ideas.filter(i => i.nextSteps?.length > 0)
// - Build Opportunities: derived suggestions
```

## Example Output

```
🌅 Good Monday Morning!

📅 Monday Brief - February 3, 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🖥️ SYSTEM HEALTH

Mac Status:
  ✅ Disk: 520 GB free (72%)
  ✅ Memory: 16 GB available
  ✅ CPU: 12% usage (normal)

Git Status:
  ✅ On branch: main
  ✅ Working directory clean
  ↑ 2 commits ahead of origin

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 LAST WEEK'S ACTIVITY (Jan 27 - Feb 2)

Sessions: 15 total
  - 8 on Daily Memory Injection
  - 4 on History System
  - 3 on General Work

Learnings: 4 captured
  - PAI vs Vanilla Claude Code Setup
  - Clawdbot Seneca Memory System
  - Git Worktree Isolation Pattern
  - Hook Execution Order Debugging

Major Accomplishments:
  ✅ Implemented daily memory injection
  ✅ Added session continuity
  ✅ Documented thoroughly
  ✅ Merged to main

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 KEY DECISIONS

• Use Seneca-style memory files for continuity
• Hook execution order: core → memory → init
• Summary extraction capped at 800 chars
• Graceful degradation if History/ missing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 THIS WEEK

Priorities:
  1. Complete Monday brief feature
  2. Test proactive scheduling
  3. Consider voice interface

Carried Over:
  • Multi-surface access exploration
  • Smart context selection enhancement
  • ML-based relevance scoring

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔬 RESEARCH REVIVAL

Topics worth revisiting:
  • TPU Architecture Analysis (45 days ago)
    - New developments in AI hardware space
  • Israel-Gaza War Status (46 days ago)
    - Situation may have evolved

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔨 BUILD OPPORTUNITIES

Based on your work patterns:
  • Automate iterative editing workflow
    - You've done this manually 26 times
  • Create comparison skill
    - Pattern detected across 3 sessions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 SUGGESTIONS

• Test the daily memory injection in production
• Document learnings from this week
• Consider proactive task scheduling

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Have a productive week! 🚀
```

## Future Enhancements

1. **Weekly Goals Tracking**
   - Set goals Monday morning
   - Review progress Friday afternoon

2. **Trend Analysis**
   - Compare this week vs last week
   - Identify productivity patterns
   - Suggest optimizations

3. **Integration with Calendar**
   - Pull upcoming meetings
   - Show week's schedule
   - Suggest time blocking

4. **Smart Prioritization**
   - ML-based priority suggestions
   - Deadline awareness
   - Dependency tracking

5. **Team Context**
   - Pull from shared project status
   - Show team updates
   - Coordinate handoffs

## Related Skills

- **system-health-monitor** - Detailed system diagnostics
- **weekly-summary** - Generic weekly summary (any day)
- **History System** - Source of session/learning data

## Troubleshooting

### Brief Not Running Automatically

1. Check crontab: `crontab -l | grep monday-brief`
2. Check logs: `cat /tmp/monday-brief.log`
3. Verify cron service: `launchctl list | grep cron`

### No Notifications

1. Check voice server: `curl http://localhost:8888/health`
2. Check environment: `echo $DA_VOICE_ID`
3. Test manually: `bun run tools/monday-brief.ts`

### Empty Brief

1. Check History exists: `ls -la .claude/History/Sessions/`
2. Check date range: Brief only shows last 7 days
3. Run with debug: `DEBUG=1 bun run tools/monday-brief.ts`

---

**Status**: Ready for implementation
**Priority**: High (completes Seneca parity)
**Effort**: Medium (2-3 hours)
