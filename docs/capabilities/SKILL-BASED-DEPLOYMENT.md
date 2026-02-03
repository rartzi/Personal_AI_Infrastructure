# Skill-Based Deployment Guide

**Easy deployment via .claude/skills/ directory**

---

## Overview

YES, the intelligence system CAN be deployed as PAI skills for easier installation and discoverability.

### Current State

**Already Skills:**
- ✅ `/suggestions` (context-suggestions)
- ✅ `/monday-brief` (monday-brief)

**Newly Created Skills:**
- ✅ `/flywheel` (pattern viewer)
- ✅ `/my-telos` (identity viewer)
- ✅ `/predictions` (forward-looking only)

**Automatic Background Systems:**
- Hooks (capture-all-events, load-context-suggestions, threshold-alert)
- Tools (metric-aggregator, threshold-monitor, etc.)

---

## Hybrid Architecture (Recommended)

### What Runs Automatically (Hooks)

**PostToolUse Hook:**
```
capture-all-events.ts
  └─> Collects metrics on every tool call
      Writes to: ~/.claude/metrics/raw-tool-calls/
```

**SessionStart Hook:**
```
load-context-suggestions.ts
  └─> Shows suggestions at session start
      Calls: context-analyzer.ts
```

**Daily Cron:**
```
metric-aggregator.ts
  └─> Aggregates daily summaries at midnight
      Writes to: ~/.claude/metrics/daily-summaries/
```

### What Users Invoke (Skills)

**Manual check skills:**
- `/suggestions` - Full context-aware intelligence
- `/flywheel` - Current pattern status (reactive + predictive)
- `/my-telos` - Identity profile and alignment
- `/predictions` - Forward-looking only (no reactive patterns)
- `/monday-brief` - Weekly summary

---

## Deployment: Skill-First Approach

### Step 1: Deploy Core Skills

**Copy skills directory:**
```bash
# Copy all 5 intelligence skills
cp -r .claude/skills/context-suggestions TARGET/.claude/skills/
cp -r .claude/skills/flywheel TARGET/.claude/skills/
cp -r .claude/skills/my-telos TARGET/.claude/skills/
cp -r .claude/skills/predictions TARGET/.claude/skills/
cp -r .claude/skills/monday-brief TARGET/.claude/skills/
```

**Result:** User can now invoke `/suggestions`, `/flywheel`, etc.

### Step 2: Deploy Tools (Backend)

**Skills need these tools to work:**
```bash
# Create tools directory
mkdir -p TARGET/tools

# Core extraction & analysis
cp tools/suggestion-extractor.ts TARGET/tools/
cp tools/derived-intelligence.ts TARGET/tools/
cp tools/context-analyzer.ts TARGET/tools/

# Metric system
cp tools/metric-aggregator.ts TARGET/tools/
cp tools/threshold-monitor.ts TARGET/tools/

# Telos system
cp tools/telos-extractor.ts TARGET/tools/

# Prediction engines
cp tools/goal-predictor.ts TARGET/tools/
cp tools/trajectory-forecaster.ts TARGET/tools/
cp tools/tool-health-monitor.ts TARGET/tools/
cp tools/opportunity-cost-analyzer.ts TARGET/tools/
cp tools/prediction-orchestrator.ts TARGET/tools/

# Test suite
cp tools/test-predictions.ts TARGET/tools/
cp tools/monday-brief.ts TARGET/tools/

# Make executable
chmod +x TARGET/tools/*.ts
```

### Step 3: Deploy Hooks (Automatic Operation)

**Copy hooks:**
```bash
cp .claude/hooks/capture-all-events.ts TARGET/.claude/hooks/
cp .claude/hooks/load-context-suggestions.ts TARGET/.claude/hooks/
cp .claude/hooks/threshold-alert.ts TARGET/.claude/hooks/

chmod +x TARGET/.claude/hooks/*.ts
```

**Register in `TARGET/.claude/hooks.json`:**
```json
{
  "PostToolUse": [
    {
      "name": "capture-all-events",
      "script": "capture-all-events.ts",
      "outputMode": "compact"
    }
  ],
  "SessionStart": [
    {
      "name": "load-context-suggestions",
      "script": "load-context-suggestions.ts",
      "outputMode": "compact"
    }
  ]
}
```

### Step 4: Setup Daily Aggregation

**macOS (launchd):**
```bash
cat > ~/Library/LaunchAgents/com.pai.metric-aggregator.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pai.metric-aggregator</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/bun</string>
        <string>run</string>
        <string>TARGET_PATH/tools/metric-aggregator.ts</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>0</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
PLIST

launchctl load ~/Library/LaunchAgents/com.pai.metric-aggregator.plist
```

**Linux (cron):**
```bash
crontab -e
# Add: 0 0 * * * /usr/local/bin/bun run TARGET_PATH/tools/metric-aggregator.ts
```

---

## What Each Skill Provides

### /suggestions (Comprehensive View)

**What it shows:**
- Research threads from History
- Unfinished ideas from History
- Goals from History
- Reactive patterns from metrics
- Predictive suggestions from prediction layer

**When to use:** Daily planning, "what should I work on today?"

**Backend:** context-analyzer.ts (calls everything)

### /flywheel (Pattern Status)

**What it shows:**
- Reactive patterns (what you've been doing)
- Predictive suggestions (what you'll need)
- Telos alignment for each pattern
- Strategic value rankings

**When to use:** Mid-session check, "show current patterns"

**Backend:** threshold-monitor.ts (reactive + predictive)

### /my-telos (Identity Profile)

**What it shows:**
- Builder/Scientist/Leader scores
- Values (autonomy/impact/learning)
- Recent goals and focus areas
- Expected vs actual time allocation
- How alignment affects scoring

**When to use:** Understanding suggestions, "why does system suggest X?"

**Backend:** telos-extractor.ts + opportunity-cost-analyzer.ts

### /predictions (Forward-Looking Only)

**What it shows:**
- Goal-based predictions (capabilities for goals)
- Trajectory forecasts (bottleneck warnings)
- Tool health deprecations (unused tools)
- Opportunity cost realignments (time misalignment)

**When to use:** Strategic planning, "what will I need in 2 weeks?"

**Backend:** test-predictions.ts or filtered threshold-monitor.ts

### /monday-brief (Weekly Summary)

**What it shows:**
- System health (disk/memory/CPU/git)
- Last week's activity (sessions/learnings)
- Key highlights
- Flywheel insights (strategic patterns)
- This week's priorities

**When to use:** Monday mornings, "weekly summary"

**Backend:** monday-brief.ts (calls threshold-monitor for insights)

---

## Deployment Packages

### Package 1: Skills Only (User-Invoked)

**What you get:**
- All 5 skills in `.claude/skills/`
- User can invoke manually anytime

**What you DON'T get:**
- Automatic session start suggestions
- Automatic metric collection
- Mid-session alerts

**Who needs this:**
- Users who prefer manual control
- Deployments without hooks support
- Testing before full deployment

**Install:**
```bash
cp -r .claude/skills/{context-suggestions,flywheel,my-telos,predictions,monday-brief} TARGET/.claude/skills/
cp tools/*.ts TARGET/tools/
```

### Package 2: Full System (Automatic + Manual)

**What you get:**
- All 5 skills (manual invocation)
- 3 hooks (automatic operation)
- Daily aggregation (cron/launchd)

**Who needs this:**
- Production deployments
- Want automatic AND manual access
- Full intelligence system

**Install:**
```bash
# Skills
cp -r .claude/skills/{context-suggestions,flywheel,my-telos,predictions,monday-brief} TARGET/.claude/skills/

# Tools
cp tools/*.ts TARGET/tools/

# Hooks
cp .claude/hooks/{capture-all-events,load-context-suggestions,threshold-alert}.ts TARGET/.claude/hooks/

# Register hooks + setup cron
```

### Package 3: Minimal (Suggestions Only)

**What you get:**
- Just context-suggestions skill
- Research/idea/goal extraction from History

**What you DON'T get:**
- Metric-driven pattern detection
- Predictive suggestions
- Telos awareness

**Who needs this:**
- Minimum intelligence system
- Quick deployment (5 minutes)
- Testing proof-of-concept

**Install:**
```bash
cp -r .claude/skills/context-suggestions TARGET/.claude/skills/
cp tools/{suggestion-extractor,derived-intelligence,context-analyzer}.ts TARGET/tools/
```

---

## Skill Deployment: One-Liner

### Deploy All Skills

```bash
rsync -av .claude/skills/{context-suggestions,flywheel,my-telos,predictions,monday-brief} TARGET/.claude/skills/ && \
rsync -av tools/*.ts TARGET/tools/ && \
echo "✅ All skills deployed. Tools backend copied. Setup hooks separately."
```

### Deploy Just User-Facing Skills (No Hooks)

```bash
# No hooks = no automatic operation
# Skills work on-demand only

rsync -av .claude/skills/{context-suggestions,flywheel,my-telos,predictions,monday-brief} TARGET/.claude/skills/ && \
rsync -av tools/*.ts TARGET/tools/ && \
echo "✅ Skills deployed (manual invocation only)"
```

---

## Skill Invocation Examples

### From User

```
User: "What should I work on?"
      → Triggers: context-suggestions skill
      → Shows: Research + Ideas + Goals + Patterns + Predictions

User: "Show flywheel patterns"
      → Triggers: flywheel skill
      → Shows: Reactive patterns + Predictive suggestions

User: "What's my identity?"
      → Triggers: my-telos skill
      → Shows: Builder 95%, alignment scores, time allocation

User: "What will I need to build?"
      → Triggers: predictions skill
      → Shows: Only forward-looking predictions

User: "Give me the Monday brief"
      → Triggers: monday-brief skill
      → Shows: Weekly summary + system health + flywheel insights
```

### From Slash Commands

```
/suggestions
/flywheel
/my-telos
/predictions
/monday-brief
```

---

## Skill Dependencies

```
context-suggestions
  ├─ suggestion-extractor.ts (required)
  ├─ derived-intelligence.ts (required)
  ├─ context-analyzer.ts (required)
  └─ threshold-monitor.ts (optional - for metric patterns)

flywheel
  ├─ threshold-monitor.ts (required)
  ├─ metric-aggregator.ts (required - data source)
  ├─ telos-extractor.ts (required)
  └─ prediction-orchestrator.ts (required)

my-telos
  ├─ telos-extractor.ts (required)
  ├─ opportunity-cost-analyzer.ts (optional - for time allocation)
  └─ metric-aggregator.ts (optional - for time allocation)

predictions
  ├─ goal-predictor.ts (required)
  ├─ trajectory-forecaster.ts (required)
  ├─ tool-health-monitor.ts (required)
  ├─ opportunity-cost-analyzer.ts (required)
  ├─ prediction-orchestrator.ts (required)
  ├─ telos-extractor.ts (required)
  └─ metric-aggregator.ts (required - data source)

monday-brief
  ├─ monday-brief.ts (required)
  └─ threshold-monitor.ts (optional - for flywheel insights)
```

---

## Verification Checklist

### After Deployment

**Test each skill:**
```bash
# In Claude Code session:
/suggestions
/flywheel
/my-telos
/predictions
/monday-brief
```

**Check backend tools:**
```bash
cd TARGET/tools
bun run context-analyzer.ts
bun run threshold-monitor.ts
bun run telos-extractor.ts
bun run test-predictions.ts
```

**Check hooks (if deployed):**
```bash
# Start new session
# Should see automatic suggestions at start

# Check metrics collection
ls TARGET/.claude/metrics/*/raw-tool-calls/*.jsonl
```

---

## Skill-Based vs Hook-Based

### Skill-Based (User-Invoked)

**Pros:**
- ✅ Easier deployment (copy .claude/skills/)
- ✅ More discoverable (shows in skill list)
- ✅ User controls timing
- ✅ No background processes needed

**Cons:**
- ❌ Not automatic (user must invoke)
- ❌ May forget to check
- ❌ Manual metric aggregation needed

### Hook-Based (Automatic)

**Pros:**
- ✅ Automatic operation (no user action)
- ✅ Real-time collection
- ✅ Proactive suggestions
- ✅ Mid-session alerts

**Cons:**
- ❌ Harder deployment (hooks + cron)
- ❌ Less obvious it's running
- ❌ Requires hooks support

### Hybrid (Recommended)

**Best of both worlds:**
- Hooks run automatically (proactive)
- Skills available for manual check (reactive)
- User gets suggestions without asking
- User can check status anytime

---

## Quick Deployment Commands

### Deploy Everything

```bash
#!/bin/bash
# deploy-intelligence-skills.sh

SOURCE="${HOME}/Personal_AI_Infrastructure"
TARGET="$1"  # e.g., /Users/newuser/.claude

# Skills
rsync -av ${SOURCE}/.claude/skills/{context-suggestions,flywheel,my-telos,predictions,monday-brief} \
  ${TARGET}/skills/

# Tools
rsync -av ${SOURCE}/tools/*.ts ${TARGET}/../tools/

# Hooks (optional - comment out for skills-only)
rsync -av ${SOURCE}/.claude/hooks/{capture-all-events,load-context-suggestions,threshold-alert}.ts \
  ${TARGET}/hooks/

chmod +x ${TARGET}/../tools/*.ts
chmod +x ${TARGET}/hooks/*.ts

echo "✅ Deployed to ${TARGET}"
echo ""
echo "Skills available:"
echo "  /suggestions, /flywheel, /my-telos, /predictions, /monday-brief"
echo ""
echo "Next: Register hooks in ${TARGET}/hooks.json (if not already done)"
```

### Deploy Skills-Only (No Hooks)

```bash
# Just skills + tools, no automatic operation
rsync -av .claude/skills/{context-suggestions,flywheel,my-telos,predictions,monday-brief} TARGET/.claude/skills/
rsync -av tools/*.ts TARGET/tools/

echo "Skills deployed. User can invoke manually via /<skill-name>"
```

---

## Directory Structure After Deployment

```
TARGET/.claude/
├── skills/
│   ├── context-suggestions/
│   │   └── SKILL.md
│   ├── flywheel/
│   │   └── SKILL.md
│   ├── my-telos/
│   │   └── SKILL.md
│   ├── predictions/
│   │   └── SKILL.md
│   └── monday-brief/
│       └── SKILL.md
│
├── hooks/
│   ├── capture-all-events.ts        (optional)
│   ├── load-context-suggestions.ts  (optional)
│   └── threshold-alert.ts           (optional)
│
└── hooks.json  (if hooks deployed)

TARGET/tools/
├── suggestion-extractor.ts
├── derived-intelligence.ts
├── context-analyzer.ts
├── metric-aggregator.ts
├── threshold-monitor.ts
├── telos-extractor.ts
├── goal-predictor.ts
├── trajectory-forecaster.ts
├── tool-health-monitor.ts
├── opportunity-cost-analyzer.ts
├── prediction-orchestrator.ts
├── test-predictions.ts
└── monday-brief.ts
```

---

## User Experience After Deployment

### With Skills Only

```
User starts session
  └─> No automatic suggestions

User: "/suggestions"
  └─> Shows: Research + Ideas + Patterns + Predictions

User: "/flywheel"
  └─> Shows: Current patterns and automation opportunities

User: "/my-telos"
  └─> Shows: Identity profile and alignment scores
```

### With Skills + Hooks

```
User starts session
  └─> Automatic suggestions appear (via load-context-suggestions hook)
  └─> Metrics collected in background (via capture-all-events hook)

User: "/flywheel" (optional - can check anytime)
  └─> Shows: Updated patterns since session start

30 minutes later
  └─> Mid-session alert if urgent pattern detected (via threshold-alert hook)

Next day at midnight
  └─> Metrics aggregated automatically (via cron/launchd)

Monday morning
  └─> User invokes /monday-brief
  └─> Shows: Weekly summary + flywheel insights
```

---

## Comparison: Deployment Approaches

| Approach | Skills | Tools | Hooks | Cron | Automatic | Manual | Deployment Time |
|----------|--------|-------|-------|------|-----------|--------|----------------|
| **Skills-only** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | 10 min |
| **Skills + Hooks** | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ | 20 min |
| **Full System** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 30-60 min |

**Recommendation:** Full System (get everything)

---

## Testing After Deployment

### Verify Skills

```bash
# In Claude Code on TARGET machine:
/suggestions
/flywheel
/my-telos
/predictions
/monday-brief

# All should work
```

### Verify Tools

```bash
cd TARGET/tools

bun run suggestion-extractor.ts    # Should show: Research/Ideas/Goals count
bun run context-analyzer.ts        # Should show: Markdown suggestions
bun run threshold-monitor.ts       # Should show: Reactive + Predictive counts
bun run telos-extractor.ts         # Should show: Identity scores
bun run test-predictions.ts        # Should show: All engines status
```

### Verify Hooks (if deployed)

```bash
# Start new session in TARGET PAI
# Should see automatic suggestions at start

# Run a few commands
# Check metrics collected:
ls TARGET/.claude/metrics/*/raw-tool-calls/*.jsonl
```

### Verify Cron/Launchd (if deployed)

```bash
# macOS
launchctl list | grep metric-aggregator

# Linux
crontab -l | grep metric-aggregator

# Check it ran
cat /tmp/metric-aggregator.log
```

---

## Troubleshooting

### Skills Not Showing in List

**Check:**
```bash
ls TARGET/.claude/skills/
cat TARGET/.claude/settings.json | grep skills
```

**Fix:** Ensure skills directory structure is correct.

### Skill Invoked But Errors

**Check backend tools:**
```bash
# Test the tool that skill calls
bun run TARGET/tools/threshold-monitor.ts

# Check for TypeScript errors
```

### Hooks Not Running

**Check registration:**
```bash
cat TARGET/.claude/hooks.json
```

**Check hook exists:**
```bash
ls TARGET/.claude/hooks/capture-all-events.ts
```

**Test manually:**
```bash
cd TARGET/.claude/hooks
bun run capture-all-events.ts --test
```

---

## Migration: Hooks to Skills

If you have the system deployed with hooks and want to make it skill-accessible:

**Just add the skills** - hooks and skills can coexist:

```bash
# Add skills for manual access
cp -r .claude/skills/{flywheel,my-telos,predictions} TARGET/.claude/skills/

# Keep existing hooks for automatic operation
# Now you have both!
```

---

## Summary: Best Deployment Strategy

**For New PAI Installations:**

```
Day 1: Deploy Skills + Tools
  → User can invoke /suggestions, /flywheel, etc.
  → Everything works manually

Day 2: Add Hooks (Optional)
  → Automatic suggestions at session start
  → Automatic metric collection
  → Skills still work for manual checks

Day 3: Add Cron (Optional)
  → Automatic daily aggregation
  → No manual aggregation needed

Result: Fully automatic intelligence with manual override
```

**Minimum Viable:** Skills + Tools (10 min deploy)
**Recommended:** Skills + Tools + Hooks (20 min deploy)
**Complete:** Skills + Tools + Hooks + Cron (30-60 min deploy)

---

## License

Part of Personal AI Infrastructure (PAI)
