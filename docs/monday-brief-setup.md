# Monday Brief Setup Guide

## Overview

The Monday Brief system provides proactive Monday morning system health checks and weekly work summaries, inspired by Clawdbot's Seneca assistant.

## What You Get

Every Monday at 9 AM (or on demand), you receive:

1. **System Health Check**
   - Disk usage and free space
   - Memory availability
   - CPU usage
   - Git repository status

2. **Weekly Work Summary**
   - Total sessions from past 7 days
   - Recent learnings captured
   - Key highlights and accomplishments

3. **This Week's Context**
   - Priorities for the week
   - Carried-over items

4. **Automatic Notifications**
   - Terminal output
   - Voice notification (if server running)
   - Saved to History/Briefs/

## Installation

### 1. Manual Test

First, test the Monday brief manually:

```bash
# Run from project root
bun run tools/monday-brief.ts --force

# With options
bun run tools/monday-brief.ts --force --silent  # No notifications
```

Expected output:
```
🌅 Generating Monday Brief...
📊 Checking system health...
📚 Loading weekly history...
✍️  Generating brief...
💾 Saving to History/Briefs/...
✅ Saved: .claude/History/Briefs/2026-02-03_monday-brief.md

[Full brief displayed]

✅ Monday brief complete!
```

### 2. Automated Scheduling (macOS)

**Option A: launchd (Recommended for macOS)**

```bash
# 1. Copy plist to LaunchAgents
cp tools/com.pai.monday-brief.plist ~/Library/LaunchAgents/

# 2. Edit paths in plist to match your system
#    Update:
#    - /Users/kjzc236/.bun/bin/bun → your bun path
#    - Project paths
#    - Environment variables (DA, DA_VOICE_ID)

# 3. Load the launch agent
launchctl load ~/Library/LaunchAgents/com.pai.monday-brief.plist

# 4. Verify it's loaded
launchctl list | grep pai

# 5. Test immediately (don't wait for Monday)
launchctl start com.pai.monday-brief
```

**Option B: cron (Alternative)**

```bash
# 1. Edit crontab
crontab -e

# 2. Add this line (adjust paths):
0 9 * * 1 cd /path/to/PAI && /path/to/bun run tools/monday-brief-cron.ts

# Example:
0 9 * * 1 cd /Users/kjzc236/workrelated/odsp/innovation_group/external/Personal_AI_Infrastructure && /Users/kjzc236/.bun/bin/bun run tools/monday-brief-cron.ts

# 3. Save and exit

# 4. Verify crontab
crontab -l
```

### 3. Configuration

Environment variables (set in `.claude/settings.json` or shell profile):

```json
{
  "env": {
    "PAI_DIR": "/full/path/to/project/.claude",
    "DA": "PAI",
    "DA_VOICE_ID": "your-elevenlabs-voice-id"
  }
}
```

## Usage

### Manual Trigger

Run any time with:

```bash
# Normal run (checks if Monday)
bun run tools/monday-brief.ts

# Force run even if not Monday
bun run tools/monday-brief.ts --force

# Silent mode (no notifications)
bun run tools/monday-brief.ts --force --silent
```

### Automatic Trigger

Once configured, the brief runs automatically:
- **When**: Every Monday at 9 AM
- **Where**: Terminal (if session active) + Voice notification + History file
- **Output**: `.claude/History/Briefs/YYYY-MM-DD_monday-brief.md`

### Check Brief History

```bash
# List all past briefs
ls -lt .claude/History/Briefs/

# Read a specific brief
cat .claude/History/Briefs/2026-02-03_monday-brief.md
```

## Troubleshooting

### Brief Not Running Automatically

**For launchd:**

```bash
# Check if loaded
launchctl list | grep pai

# Check logs
cat /tmp/pai-monday-brief.log
cat /tmp/pai-monday-brief-error.log

# Reload if needed
launchctl unload ~/Library/LaunchAgents/com.pai.monday-brief.plist
launchctl load ~/Library/LaunchAgents/com.pai.monday-brief.plist

# Test manually
launchctl start com.pai.monday-brief
```

**For cron:**

```bash
# Verify cron entry
crontab -l | grep monday

# Check cron logs (macOS)
log show --predicate 'process == "cron"' --last 1h

# Test cron wrapper manually
bun run tools/monday-brief-cron.ts
```

### No Notifications

1. **Check voice server is running:**
   ```bash
   curl http://localhost:8888/health
   ```

2. **Check environment variables:**
   ```bash
   echo $DA_VOICE_ID
   echo $DA
   ```

3. **Test notification directly:**
   ```bash
   curl -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"title":"Test","message":"Testing notifications","voice_enabled":true}'
   ```

### Empty or Incorrect Data

1. **Check History directory exists:**
   ```bash
   ls -la .claude/History/Sessions/
   ls -la .claude/History/Learnings/
   ```

2. **Check date range:**
   - Brief shows last 7 days only
   - Sessions must have mtime within past week

3. **Run with debug:**
   ```bash
   DEBUG=1 bun run tools/monday-brief.ts --force
   ```

### Permission Issues

```bash
# Make scripts executable
chmod +x tools/monday-brief.ts
chmod +x tools/monday-brief-cron.ts

# Check plist permissions
chmod 644 ~/Library/LaunchAgents/com.pai.monday-brief.plist
```

## Customization

### Change Schedule

**launchd (edit plist):**

```xml
<key>StartCalendarInterval</key>
<dict>
    <key>Weekday</key>
    <integer>1</integer>  <!-- Monday -->
    <key>Hour</key>
    <integer>9</integer>  <!-- 9 AM -->
    <key>Minute</key>
    <integer>0</integer>
</dict>
```

**cron:**

```bash
# Format: minute hour day-of-month month day-of-week
0 9 * * 1  # Monday 9 AM
0 8 * * 1  # Monday 8 AM
0 9 * * 5  # Friday 9 AM (weekly wrap-up)
```

### Add Custom Sections

Edit `tools/monday-brief.ts`, function `generateBrief()`:

```typescript
// Add after "THIS WEEK" section
brief += `## 🎯 CUSTOM SECTION\n\n`;
brief += `Your custom content here\n\n`;
brief += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
```

### Change Notification Message

Edit `tools/monday-brief.ts`, function `sendNotification()`:

```typescript
const message = 'Your custom notification message';
```

## Integration with PAI

### Ask PAI for Monday Brief

Add to PAI's skill system:

```
User: "Give me the Monday brief"
PAI: [Runs bun run tools/monday-brief.ts --force]
```

### Auto-Load in Sessions

The daily memory injection already loads recent briefs from History/Briefs/ automatically.

### Voice Trigger

If using voice interface:

```
User: "Hey PAI, Monday brief"
PAI: [Runs monday-brief.ts, speaks summary]
```

## File Locations

| File | Purpose | Location |
|------|---------|----------|
| Main script | Brief generation | `tools/monday-brief.ts` |
| Cron wrapper | Automated execution | `tools/monday-brief-cron.ts` |
| launchd plist | macOS scheduling | `tools/com.pai.monday-brief.plist` |
| Brief output | Saved briefs | `.claude/History/Briefs/YYYY-MM-DD_monday-brief.md` |
| Logs | Execution logs | `/tmp/pai-monday-brief.log` |
| Lock file | Prevents duplicates | `/tmp/pai-monday-brief.lock` |

## Example Output

```markdown
# Monday Brief - Monday, February 3, 2026

🌅 Good Monday Morning!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🖥️ SYSTEM HEALTH

**Mac Status:**
  ✅ Disk: 434Gi free (96%)
  ✅ Memory: 8 GB available
  ✅ CPU: 12.3% usage

**Git Status:**
  ✓ On branch: main
  ✓ Working directory: clean
  ↑ 2 commits ahead of origin

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📊 LAST WEEK'S ACTIVITY (Jan 27 - Feb 2)

**Sessions:** 15 total

Recent sessions:
  • Daily Memory Injection Implementation
  • Monday Brief System Design
  • History System Documentation

**Learnings:** 4 captured

Key learnings:
  • PAI vs Vanilla Claude Code Setup
  • Clawdbot Seneca Memory System
  • Git Worktree Isolation Pattern
  • Hook Execution Order Debugging

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 KEY HIGHLIGHTS

**Recent Work:**
Implemented Seneca-style daily memory injection providing
automatic session continuity through recent History loading.

**Latest Learning:**
Understanding how Clawdbot's Seneca uses daily memory files
to maintain context across sessions and surfaces.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📝 THIS WEEK

**Priorities:**
  1. Review and build on last week's progress
  2. Address any carried-over items
  3. Plan new features or improvements

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Have a productive week! 🚀

---

*Generated by PAI Monday Brief System*
*Inspired by Clawdbot's Seneca*
```

## Next Steps

After setup:

1. **Test manually** - Run with `--force` to verify output
2. **Wait for Monday** - Let it run automatically
3. **Check History/Briefs/** - Review saved briefs
4. **Customize** - Adjust schedule, sections, notifications
5. **Integrate with PAI** - Add skill trigger for voice/text commands

---

**Status**: Production ready
**Platform**: macOS (tested), Linux (compatible with cron)
**Dependencies**: bun, PAI History system, optional voice server
