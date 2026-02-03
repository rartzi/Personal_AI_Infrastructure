# Self-Improvement Flywheel

**Version:** 1.0
**Status:** Production
**Last Updated:** 2026-02-03

---

## Product Requirements Document (PRD)

### Overview

The Self-Improvement Flywheel is a reactive pattern detection system that automatically identifies automation opportunities by monitoring tool usage and detecting repetitive workflows.

### Problem Statement

Users repeat workflows manually without realizing they're doing the same sequence of actions multiple times:
- Same bash commands run 10+ times per day
- Same edit patterns across multiple files
- Same task creation workflows repeated
- No visibility into these patterns until too late

### Solution

An automated metric collection and analysis system that:
1. **Collects** metrics on every tool call (Bash, Edit, Read, etc.)
2. **Aggregates** daily summaries with sequence detection
3. **Monitors** thresholds to detect urgent patterns
4. **Surfaces** automation opportunities at three tiers

### User Stories

**As a developer, I want to:**
- See when I've repeated the same workflow 5+ times today
- Get alerted mid-session when urgent patterns emerge
- Track my tool usage patterns over time
- Discover automation opportunities automatically

### Success Metrics

- **Detection Rate**: 95%+ of repetitive patterns detected
- **Timeliness**: Urgent patterns surfaced within 30 minutes
- **Accuracy**: < 5% false positives
- **Actionability**: 80%+ of suggestions lead to automations

### Requirements

**Functional:**
- Collect metrics on all tool calls (Bash, Edit, Read, Write, Task, etc.)
- Detect same-tool sequences (e.g., Bash→Bash→Bash)
- Aggregate daily summaries with statistics
- Monitor three threshold levels (urgent/high/strategic)
- Surface at appropriate times (mid-session/session-start/weekly)

**Non-Functional:**
- Low overhead (< 50ms per tool call)
- Reliable collection (no dropped metrics)
- Privacy-preserving (all local)
- Scalable (handles 1000+ calls/day)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│           Self-Improvement Flywheel (5 Phases)          │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┬──────────┐
        ▼                   ▼                   ▼          ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│   Phase 1    │    │   Phase 2    │    │   Phase 3    │  │
│  Collection  │───▶│ Aggregation  │───▶│  Monitoring  │  │
└──────────────┘    └──────────────┘    └──────────────┘  │
                                                 │          │
                    ┌────────────────────────────┘          │
                    ▼                                       ▼
            ┌──────────────┐                      ┌──────────────┐
            │   Phase 4    │                      │   Phase 5    │
            │ Mid-Session  │                      │Session Start │
            │   Alerts     │                      │ Suggestions  │
            └──────────────┘                      └──────────────┘
```

### Phase 1: Metric Collection

**File:** `.claude/hooks/capture-all-events.ts`

**Purpose:** Capture every tool call in real-time

**Hook Type:** `PostToolUse`

**Data Collected:**
```typescript
interface ToolEvent {
  timestamp: string;
  tool: string;           // Bash, Edit, Read, etc.
  session_id: string;
  result_summary: string;
  error: string | null;
}
```

**Output Location:**
- `~/.claude/metrics/YYYY-MM/raw-tool-calls/YYYY-MM-DD_HHMMSS.jsonl`

**Performance:**
- < 20ms per event
- Async writes (non-blocking)
- Automatic rotation (daily)

### Phase 2: Metric Aggregation

**File:** `tools/metric-aggregator.ts`

**Purpose:** Aggregate raw metrics into daily summaries with pattern detection

**Runs:** Daily via launchd/cron at midnight

**Input:**
- Raw JSONL files from Phase 1

**Output:**
```typescript
interface DailySummary {
  date: string;
  totalToolCalls: number;
  sessionCount: number;
  toolFrequency: Record<string, number>;
  sameToolSequences: SequencePattern[];  // Bash→Bash→Bash
  highFrequencyTools: ToolStats[];       // 10+ per session
}
```

**Sequence Detection:**
- Detects consecutive uses of same tool
- Minimum length: 3
- Example: Bash→Bash→Bash, Edit→Edit→Edit

**Output Location:**
- `~/.claude/metrics/YYYY-MM/daily-summaries/YYYY-MM-DD.json`

### Phase 3: Threshold Monitoring

**File:** `tools/threshold-monitor.ts`

**Purpose:** Check aggregated metrics against thresholds

**Thresholds:**
```typescript
const thresholds = {
  urgent: {
    sameDayOccurrences: 5,    // 5+ times today
    minConfidence: 90,         // 90%+ confidence
    weeklyOccurrences: 15      // 15+ times this week
  },
  high: {
    sameDayOccurrences: 3,     // 3+ times today
    minConfidence: 80,         // 80%+ confidence
    weeklyOccurrences: 10      // 10+ times this week
  },
  strategic: {
    monthlyOccurrences: 20,    // 20+ times this month
    minConfidence: 70          // 70%+ confidence
  }
};
```

**Output:**
```typescript
interface ThresholdAlert {
  priority: 'urgent' | 'high' | 'strategic';
  pattern: string;              // "Bash→Bash→Bash"
  count: number;                // 35
  confidence: number;           // 95
  suggestion: string;
  estimatedSavings: string;     // "~70 minutes/day"
  evidence: string[];           // ["35 occurrences today"]
}
```

### Phase 4: Mid-Session Alerts

**File:** `.claude/hooks/threshold-alert.ts`

**Purpose:** Surface URGENT patterns mid-session (every 30 minutes)

**Trigger:** Could be invoked by timer or background process

**Behavior:**
- Checks for urgent alerts (90%+ confidence)
- Rate limited: Max 2 per day
- Cooldown: 120 minutes between alerts
- Deduplication: Won't alert same pattern twice per day

**Output:**
```
🔥 FLYWHEEL ALERT - REACTIVE Suggestion

📊 Bash→Bash→Bash

Bash→Bash→Bash appeared 35 times today. Consider automation.

Occurrences: 35
Confidence: 95%
Impact: ~70 minutes/day

This pattern crossed the urgency threshold.
Consider taking action now.
```

### Phase 5: Session Start Suggestions

**File:** `tools/context-analyzer.ts` (calls threshold-monitor)

**Purpose:** Show high/medium priority patterns at session start

**Trigger:** Runs automatically via `load-context-suggestions.ts` hook

**Output:** Markdown formatted suggestions including metric-driven patterns

---

## Data Flow

```
1. Tool Call (Bash, Edit, etc.)
        ↓
2. PostToolUse Hook (capture-all-events.ts)
        ↓
3. Raw JSONL file (~/.claude/metrics/YYYY-MM/raw-tool-calls/)
        ↓
4. Daily Aggregation (metric-aggregator.ts) @ midnight
        ↓
5. Daily Summary JSON (~/.claude/metrics/YYYY-MM/daily-summaries/)
        ↓
6. Threshold Check (threshold-monitor.ts)
        ↓
7. Surfacing (threshold-alert.ts + context-analyzer.ts)
        ↓
8. User sees suggestions
```

### Storage Structure

```
~/.claude/metrics/
├── 2026-02/
│   ├── raw-tool-calls/
│   │   ├── 2026-02-03_140000.jsonl
│   │   ├── 2026-02-03_150000.jsonl
│   │   └── ...
│   └── daily-summaries/
│       ├── 2026-02-03.json
│       └── ...
├── 2026-01/
│   └── ...
└── config.json  # Threshold configuration
```

### Dependencies

**Internal:**
- Claude Code hooks system
- PAI directory structure

**External:**
- Node.js fs module
- Bun runtime

**No network dependencies** - 100% local processing

---

## Usage

### Manual Commands

**Aggregate today's metrics:**
```bash
bun run tools/metric-aggregator.ts
```

**Aggregate last 7 days:**
```bash
bun run tools/metric-aggregator.ts --days 7
```

**Check thresholds:**
```bash
bun run tools/threshold-monitor.ts
```

**Verbose output:**
```bash
bun run tools/threshold-monitor.ts --verbose
```

**JSON output:**
```bash
bun run tools/threshold-monitor.ts --json
```

### Automatic Operation

**Metric Collection:**
- Happens automatically on every tool call
- No user action needed
- Check raw files: `ls ~/.claude/metrics/*/raw-tool-calls/`

**Daily Aggregation:**
- Runs automatically at midnight via launchd
- Can run manually: `bun run tools/metric-aggregator.ts`

**Threshold Monitoring:**
- Integrated into context-analyzer (session start)
- Can run manually: `bun run tools/threshold-monitor.ts`

### Reading Summaries

**View today's summary:**
```bash
cat ~/.claude/metrics/2026-02/daily-summaries/2026-02-03.json | jq
```

**Key metrics:**
```bash
# Total tool calls today
cat ~/.claude/metrics/2026-02/daily-summaries/2026-02-03.json | jq '.totalToolCalls'

# Same-tool sequences
cat ~/.claude/metrics/2026-02/daily-summaries/2026-02-03.json | jq '.sameToolSequences'

# High-frequency tools
cat ~/.claude/metrics/2026-02/daily-summaries/2026-02-03.json | jq '.highFrequencyTools'
```

### Configuration

**Adjust thresholds:**

Create `~/.claude/metrics/config.json`:
```json
{
  "thresholds": {
    "urgent": {
      "sameDayOccurrences": 5,
      "minConfidence": 90,
      "weeklyOccurrences": 15
    },
    "high": {
      "sameDayOccurrences": 3,
      "minConfidence": 80,
      "weeklyOccurrences": 10
    },
    "strategic": {
      "monthlyOccurrences": 20,
      "minConfidence": 70
    }
  }
}
```

**Disable mid-session alerts:**

Remove from `~/.claude/hooks.json` or set cooldown to very high value.

---

## Deployment

### Prerequisites

**PAI Installation:**
- PAI installed at `~/.claude/`
- Hooks system functional
- Bun runtime installed

**Verify:**
```bash
ls ~/.claude/hooks/
cat ~/.claude/hooks.json
```

### Installation Steps

#### Step 1: Create Metrics Directory

```bash
mkdir -p ~/.claude/metrics
chmod 755 ~/.claude/metrics
```

#### Step 2: Install Phase 1 (Collection)

**Copy hook:**
```bash
cp .claude/hooks/capture-all-events.ts ~/.claude/hooks/
chmod +x ~/.claude/hooks/capture-all-events.ts
```

**Register hook in `~/.claude/hooks.json`:**
```json
{
  "PostToolUse": [
    {
      "name": "capture-all-events",
      "script": "capture-all-events.ts",
      "outputMode": "compact"
    }
  ]
}
```

**Test:**
```bash
# Start Claude Code session
# Run any tool (e.g., Read a file)
# Check for metrics
ls ~/.claude/metrics/*/raw-tool-calls/
```

#### Step 3: Install Phase 2 (Aggregation)

**Copy aggregator:**
```bash
cp tools/metric-aggregator.ts ~/.claude/../tools/
chmod +x ~/.claude/../tools/metric-aggregator.ts
```

**Test manually:**
```bash
bun run ~/.claude/../tools/metric-aggregator.ts
```

**Setup automatic daily aggregation:**

**On macOS (launchd):**
```bash
# Create plist file
cat > ~/Library/LaunchAgents/com.pai.metric-aggregator.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pai.metric-aggregator</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/bun</string>
        <string>run</string>
        <string>/Users/YOUR_USERNAME/.claude/../tools/metric-aggregator.ts</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>0</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/metric-aggregator.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/metric-aggregator.error.log</string>
</dict>
</plist>
EOF

# Load the job
launchctl load ~/Library/LaunchAgents/com.pai.metric-aggregator.plist
```

**On Linux (cron):**
```bash
# Add to crontab
crontab -e

# Add this line:
0 0 * * * cd ~/.claude/../tools && /usr/local/bin/bun run metric-aggregator.ts >> /tmp/metric-aggregator.log 2>&1
```

#### Step 4: Install Phase 3 (Monitoring)

**Copy threshold monitor:**
```bash
cp tools/threshold-monitor.ts ~/.claude/../tools/
chmod +x ~/.claude/../tools/threshold-monitor.ts
```

**Test:**
```bash
bun run ~/.claude/../tools/threshold-monitor.ts
```

#### Step 5: Install Phase 4 (Mid-Session Alerts)

**Copy alert hook:**
```bash
cp .claude/hooks/threshold-alert.ts ~/.claude/hooks/
chmod +x ~/.claude/hooks/threshold-alert.ts
```

**Note:** This is a reference implementation. For production:
- Set up a background process to call it every 30 minutes
- Or integrate into your existing timer system

**Test manually:**
```bash
cd ~/.claude/hooks
bun run threshold-alert.ts
```

#### Step 6: Phase 5 Already Integrated

Phase 5 is part of context-analyzer.ts which calls threshold-monitor automatically.

**Verify:**
```bash
# Start new session
# Should see metric-driven patterns in suggestions
```

### Verification

**Check collection is working:**
```bash
# Use Claude for 5 minutes
# Then check:
ls -l ~/.claude/metrics/*/raw-tool-calls/*.jsonl
wc -l ~/.claude/metrics/*/raw-tool-calls/*.jsonl
```

**Check aggregation is working:**
```bash
bun run tools/metric-aggregator.ts
ls ~/.claude/metrics/*/daily-summaries/*.json
```

**Check threshold monitoring:**
```bash
bun run tools/threshold-monitor.ts
# Should show detected patterns
```

### Troubleshooting

**Issue: No metrics being collected**

**Check:**
```bash
# Verify hook is registered
cat ~/.claude/hooks.json | grep capture-all-events

# Check hook file exists
ls ~/.claude/hooks/capture-all-events.ts

# Check metrics directory
ls -la ~/.claude/metrics/
```

**Issue: Aggregation not running**

**Check launchd (macOS):**
```bash
launchctl list | grep metric-aggregator
cat /tmp/metric-aggregator.log
cat /tmp/metric-aggregator.error.log
```

**Check cron (Linux):**
```bash
crontab -l | grep metric
cat /tmp/metric-aggregator.log
```

**Issue: No patterns detected**

**Check:**
```bash
# Verify you have enough data
cat ~/.claude/metrics/*/daily-summaries/*.json | jq '.totalToolCalls'

# Run threshold monitor with verbose
bun run tools/threshold-monitor.ts --verbose
```

### Maintenance

**Disk space management:**

Metrics files grow over time. Clean old data:
```bash
# Remove raw files older than 90 days
find ~/.claude/metrics -name "*.jsonl" -mtime +90 -delete

# Keep daily summaries (they're small)
```

**Performance tuning:**

If collection overhead is high:
- Check disk I/O (SSD recommended)
- Reduce write frequency (batch writes)
- Archive old raw files

### Uninstallation

**Remove files:**
```bash
rm ~/.claude/hooks/capture-all-events.ts
rm ~/.claude/../tools/metric-aggregator.ts
rm ~/.claude/../tools/threshold-monitor.ts
rm ~/.claude/hooks/threshold-alert.ts
rm -rf ~/.claude/metrics/
```

**Remove hook registration:**

Edit `~/.claude/hooks.json` and remove `capture-all-events`.

**Remove launchd job (macOS):**
```bash
launchctl unload ~/Library/LaunchAgents/com.pai.metric-aggregator.plist
rm ~/Library/LaunchAgents/com.pai.metric-aggregator.plist
```

**Remove cron job (Linux):**
```bash
crontab -e
# Delete the metric-aggregator line
```

---

## API Reference

### metric-aggregator.ts

```typescript
// Aggregate a specific day
export function aggregateDay(date: Date): DailySummary;

// Aggregate last N days
export function aggregatePeriod(days: number): DailySummary[];
```

### threshold-monitor.ts

```typescript
// Check all thresholds
export function checkThresholds(): ThresholdAlert[];

// Get alerts by priority
const urgent = checkThresholds().filter(a => a.priority === 'urgent');
```

---

## Performance

**Collection Overhead:**
- Per tool call: < 20ms
- Async writes: Non-blocking
- Impact: < 0.1% of session time

**Aggregation Performance:**
- 1000 tool calls: ~2 seconds
- Daily summary: < 5 seconds
- Memory: < 50MB peak

**Storage:**
- Raw files: ~1KB per 10 calls
- Daily summary: ~5-10KB
- Monthly: ~150-300KB

---

## Privacy & Security

**Data Handling:**
- All processing local
- No external API calls
- No PII collection (only tool names and timestamps)

**Sensitive Data:**
- Tool parameters NOT logged
- File paths NOT logged
- Only tool name and success/failure

---

## Version History

**v1.0 (2026-02-03):**
- Initial release
- Complete 5-phase flywheel
- Reactive pattern detection
- Three-tier surfacing

---

## License

Part of Personal AI Infrastructure (PAI)
