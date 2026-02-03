# Integrated Deployment Guide - PAI Intelligence System

**Version:** 1.0
**Last Updated:** 2026-02-03

---

## Architecture Reality Check

### What You Actually Have

**TWO INTEGRATED SYSTEMS:**

#### System 1: Context-Aware Suggestions (Independent)
- Extracts research/ideas/goals from History
- Derives build opportunities
- Can deploy standalone

#### System 2: Enhanced Self-Improvement Flywheel (Integrated)
- **Layer 1 (Base):** Reactive pattern detection
  - Metric collection
  - Daily aggregation
  - Threshold monitoring
- **Layer 2 (Enhancement):** Telos-aware scoring
  - Identity extraction
  - Purpose-aligned confidence adjustment
- **Layer 3 (Enhancement):** Predictive engines
  - Goal-based predictor
  - Trajectory forecaster
  - Tool health monitor
  - Opportunity cost analyzer

**CRITICAL INSIGHT:**

Telos-Aware and Prediction Layer are NOT standalone capabilities. They're enhancement layers that make the base flywheel purpose-driven and forward-thinking.

Deploying them separately would be like:
- Installing a turbocharger without an engine
- Adding AI to a product that doesn't exist yet
- Building a roof before the walls

---

## Deployment Strategy

### Recommended Approach: 2-System Deployment

```
┌─────────────────────────────────────────────────────────┐
│               Fresh PAI Installation                     │
└─────────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │    System 1      │    │    System 2      │
    │                  │    │                  │
    │  Context-Aware   │    │    Enhanced      │
    │   Suggestions    │    │  Self-Improve    │
    │                  │    │    Flywheel      │
    │  (Standalone)    │    │   (Integrated)   │
    └──────────────────┘    └──────────────────┘
            │                        │
            │                        │
            ▼                        ▼
    Research/Ideas/           Reactive Detection
    Build Opportunities       + Telos-Aware
                             + Predictive
```

---

## System 1: Context-Aware Suggestions

### Quick Deploy

**Files needed:**
```bash
tools/suggestion-extractor.ts
tools/derived-intelligence.ts
tools/context-analyzer.ts
.claude/hooks/load-context-suggestions.ts
.claude/skills/context-suggestions/
```

**Install:**
```bash
# Copy all 5 files/directories to target PAI
# Register load-context-suggestions hook
# Done - no other dependencies
```

**See:** `01-Context-Aware-Suggestions-System.md` for details.

---

## System 2: Enhanced Self-Improvement Flywheel

### Complete Integrated Deployment

This is ONE system with 3 integrated layers. Deploy all together.

### Layer 1: Reactive Detection (Base System)

**Purpose:** Detect repetitive patterns after they occur

**Files needed:**
```bash
# Phase 1: Collection
.claude/hooks/capture-all-events.ts

# Phase 2: Aggregation
tools/metric-aggregator.ts

# Phase 3: Threshold monitoring
tools/threshold-monitor.ts

# Phase 4-5: Surfacing
.claude/hooks/threshold-alert.ts
tools/context-analyzer.ts (enhanced)
tools/monday-brief.ts (enhanced)
```

**Deploy:**
```bash
# 1. Install collection hook
cp .claude/hooks/capture-all-events.ts TARGET/.claude/hooks/
# Register in hooks.json under PostToolUse

# 2. Install aggregator
cp tools/metric-aggregator.ts TARGET/tools/
# Setup daily cron/launchd job

# 3. Install threshold monitor
cp tools/threshold-monitor.ts TARGET/tools/
```

**Verify Layer 1:**
```bash
bun run tools/threshold-monitor.ts --reactive-only
# Should show: "Reactive: X | Predictive: 0"
```

### Layer 2: Telos-Aware Enhancement

**Purpose:** Add purpose-driven scoring to all suggestions

**Files needed:**
```bash
tools/telos-extractor.ts
```

**Deploy:**
```bash
# Install telos extractor
cp tools/telos-extractor.ts TARGET/tools/

# Test extraction
bun run TARGET/tools/telos-extractor.ts
```

**Verify Layer 2:**
```bash
bun run tools/threshold-monitor.ts --reactive-only
# Should show: "Telos Alignment: X.XXx" in alerts
```

**CRITICAL:** Telos is already integrated into threshold-monitor.ts. If deploying to fresh PAI, the threshold-monitor.ts you copy MUST include telos imports and calls.

### Layer 3: Predictive Enhancement

**Purpose:** Add forward-thinking predictions to suggestions

**Files needed:**
```bash
tools/goal-predictor.ts
tools/trajectory-forecaster.ts
tools/tool-health-monitor.ts
tools/opportunity-cost-analyzer.ts
tools/prediction-orchestrator.ts
tools/test-predictions.ts  # For validation
```

**Deploy:**
```bash
# Install all 4 engines
cp tools/goal-predictor.ts TARGET/tools/
cp tools/trajectory-forecaster.ts TARGET/tools/
cp tools/tool-health-monitor.ts TARGET/tools/
cp tools/opportunity-cost-analyzer.ts TARGET/tools/

# Install orchestrator
cp tools/prediction-orchestrator.ts TARGET/tools/

# Install test suite
cp tools/test-predictions.ts TARGET/tools/
```

**Verify Layer 3:**
```bash
# Test all engines
bun run TARGET/tools/test-predictions.ts

# Test full integration
bun run TARGET/tools/threshold-monitor.ts
# Should show: "Reactive: X | Predictive: Y"
```

**CRITICAL:** Prediction layer is already integrated into threshold-monitor.ts. The threshold-monitor.ts file you copy MUST include prediction imports and the `runPredictionLayer()` function.

---

## Complete Integrated Deployment

### One-Shot Deployment (Recommended)

**Deploy both systems together:**

```bash
#!/bin/bash
# deploy-pai-intelligence.sh

TARGET_PAI="$1"  # e.g., /Users/newuser/.claude

# Verify target
if [ ! -d "$TARGET_PAI" ]; then
  echo "Error: Target PAI not found at $TARGET_PAI"
  exit 1
fi

# System 1: Context-Aware Suggestions
echo "📦 Deploying System 1: Context-Aware Suggestions..."
cp tools/suggestion-extractor.ts "$TARGET_PAI/../tools/"
cp tools/derived-intelligence.ts "$TARGET_PAI/../tools/"
cp tools/context-analyzer.ts "$TARGET_PAI/../tools/"
cp .claude/hooks/load-context-suggestions.ts "$TARGET_PAI/hooks/"
cp -r .claude/skills/context-suggestions "$TARGET_PAI/skills/"

# System 2: Enhanced Flywheel (All 3 Layers)
echo "📦 Deploying System 2: Enhanced Flywheel..."

# Layer 1: Reactive
cp .claude/hooks/capture-all-events.ts "$TARGET_PAI/hooks/"
cp tools/metric-aggregator.ts "$TARGET_PAI/../tools/"
cp tools/threshold-monitor.ts "$TARGET_PAI/../tools/"
cp .claude/hooks/threshold-alert.ts "$TARGET_PAI/hooks/"
cp tools/monday-brief.ts "$TARGET_PAI/../tools/"

# Layer 2: Telos
cp tools/telos-extractor.ts "$TARGET_PAI/../tools/"

# Layer 3: Predictive
cp tools/goal-predictor.ts "$TARGET_PAI/../tools/"
cp tools/trajectory-forecaster.ts "$TARGET_PAI/../tools/"
cp tools/tool-health-monitor.ts "$TARGET_PAI/../tools/"
cp tools/opportunity-cost-analyzer.ts "$TARGET_PAI/../tools/"
cp tools/prediction-orchestrator.ts "$TARGET_PAI/../tools/"
cp tools/test-predictions.ts "$TARGET_PAI/../tools/"

# Make executable
chmod +x "$TARGET_PAI/../tools/"*.ts
chmod +x "$TARGET_PAI/hooks/"*.ts

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Register hooks in $TARGET_PAI/hooks.json"
echo "2. Setup daily aggregation (launchd/cron)"
echo "3. Run: bun run $TARGET_PAI/../tools/test-predictions.ts"
```

### Hook Registration

**Edit `TARGET/.claude/hooks.json`:**

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

### Verification

**Complete verification:**
```bash
cd TARGET/.claude/../tools

# Test System 1
bun run suggestion-extractor.ts
bun run context-analyzer.ts

# Test System 2 - Layer 1 (Reactive)
bun run metric-aggregator.ts
bun run threshold-monitor.ts --reactive-only

# Test System 2 - Layer 2 (Telos)
bun run telos-extractor.ts
cat TARGET/.claude/telos.json

# Test System 2 - Layer 3 (Predictive)
bun run test-predictions.ts

# Test Full Integration
bun run threshold-monitor.ts
# Should show: "Reactive: X | Predictive: Y"

# Test End-to-End
bun run context-analyzer.ts
bun run monday-brief.ts --force
```

---

## File Checklist

### System 1: Context-Aware Suggestions (5 files)

- [ ] `tools/suggestion-extractor.ts`
- [ ] `tools/derived-intelligence.ts`
- [ ] `tools/context-analyzer.ts`
- [ ] `.claude/hooks/load-context-suggestions.ts`
- [ ] `.claude/skills/context-suggestions/SKILL.md`

### System 2: Enhanced Flywheel (13 files)

**Base (Reactive) - 5 files:**
- [ ] `.claude/hooks/capture-all-events.ts`
- [ ] `tools/metric-aggregator.ts`
- [ ] `tools/threshold-monitor.ts`
- [ ] `.claude/hooks/threshold-alert.ts`
- [ ] `tools/monday-brief.ts`

**Enhancement: Telos - 1 file:**
- [ ] `tools/telos-extractor.ts`

**Enhancement: Predictive - 6 files:**
- [ ] `tools/goal-predictor.ts`
- [ ] `tools/trajectory-forecaster.ts`
- [ ] `tools/tool-health-monitor.ts`
- [ ] `tools/opportunity-cost-analyzer.ts`
- [ ] `tools/prediction-orchestrator.ts`
- [ ] `tools/test-predictions.ts`

**Documentation - 1 file:**
- [ ] `.claude/skills/monday-brief/SKILL.md`

---

## Dependencies Required

### System 1: Context-Aware

- ✅ PAI with History/ directory
- ✅ Bun runtime
- ✅ Node.js fs module
- ❌ No other PAI systems needed

### System 2: Enhanced Flywheel

**Layer 1 (Reactive):**
- ✅ PAI with hooks system
- ✅ Bun runtime
- ✅ Cron or launchd (for daily aggregation)
- ❌ No other PAI systems needed

**Layer 2 (Telos):**
- ✅ Layer 1 deployed
- ✅ History/ directory with sessions
- ✅ Telos integrated into threshold-monitor.ts

**Layer 3 (Predictive):**
- ✅ Layer 1 deployed (needs metrics)
- ✅ Layer 2 deployed (needs telos)
- ✅ Prediction calls integrated into threshold-monitor.ts

**CRITICAL:** You cannot deploy Layer 3 without Layer 1 + 2. You cannot deploy Layer 2 without Layer 1.

---

## Integration Points

### Where Systems Talk to Each Other

**context-analyzer.ts calls threshold-monitor.ts:**
```typescript
// context-analyzer.ts line 210
const { checkThresholds } = await import('./threshold-monitor');
metricAlerts = checkThresholds(); // Gets reactive + predictive
```

**threshold-monitor.ts calls all layers:**
```typescript
// Layer 1: Reactive detection (built-in)
const sameDayAlerts = checkSameDayThresholds(today, config, telos);

// Layer 2: Telos applied to reactive (built-in)
const telosMultiplier = calculateTelosAlignment(seq.pattern, telos);
const telosAdjustedConfidence = baseConfidence * telosMultiplier;

// Layer 3: Predictive called explicitly
const predictiveAlerts = runPredictionLayer(telos, monthlySummaries);

// Combined
return [...reactiveAlerts, ...predictiveAlerts];
```

**monday-brief.ts calls threshold-monitor.ts:**
```typescript
// monday-brief.ts line 395
const alerts = checkThresholds();  // Gets everything (reactive + telos + predictive)
```

### Data Dependencies

```
System 1 (Context-Aware)
  Reads: History/Sessions/, History/Research/
  Writes: None (read-only)
  Needs: Nothing from System 2

System 2 (Enhanced Flywheel)
  Layer 1 (Reactive):
    Reads: ~/.claude/metrics/raw-tool-calls/
    Writes: ~/.claude/metrics/daily-summaries/
    Needs: Nothing from System 1

  Layer 2 (Telos):
    Reads: History/Sessions/, History/Research/
    Writes: ~/.claude/telos.json (cache)
    Needs: Layer 1 metrics

  Layer 3 (Predictive):
    Reads: Metrics (from Layer 1), Telos (from Layer 2)
    Writes: None (generates predictions on-demand)
    Needs: Layer 1 + Layer 2
```

---

## Simplified Deployment

### Deploy System 1 Only (Minimum)

**Who needs this:**
- Want high-value suggestions from History
- Don't need metric-based automation detection
- Quick setup (5 minutes)

**What you get:**
- Research revival suggestions
- Unfinished idea tracking
- Goal progress
- Pattern-based build opportunities

**What you DON'T get:**
- Real-time pattern detection
- Metric-driven automation opportunities
- Predictive suggestions
- Tool health monitoring

**Install:**
```bash
# Copy 5 files from System 1 checklist
# Register load-context-suggestions hook
# Done
```

### Deploy System 2 Only (Advanced)

**Who needs this:**
- Want metric-driven automation detection
- Want forward-thinking predictions
- Need purpose-aligned suggestions
- Full intelligence system

**What you get:**
- Everything from System 1 (threshold-monitor calls it)
- Reactive pattern detection (5+ times today = alert)
- Telos-aware confidence scoring
- Predictive suggestions (goals, trajectories, tool health, opportunity cost)
- Strategic value ranking

**What you DON'T get:**
- Context-Aware still recommended for research/idea extraction

**Install:**
```bash
# Copy 13 files from System 2 checklist
# Register capture-all-events hook (PostToolUse)
# Setup daily aggregation cron/launchd
# All 3 layers work together automatically
```

### Deploy Both Systems (Recommended)

**Who needs this:**
- Want complete intelligence system
- Best of both worlds

**What you get:**
- Context-based intelligence (research/ideas/goals)
- Metric-based automation detection
- Purpose-driven scoring
- Forward-thinking predictions
- Comprehensive surfacing at all tiers

**Install:**
```bash
# Deploy System 1 (5 files)
# Deploy System 2 (13 files)
# Total: 18 files
# Setup hooks + cron
```

---

## The Real Architecture

### How It Actually Works

```
SESSION START:
  ↓
load-context-suggestions.ts (hook)
  ↓
context-analyzer.ts
  │
  ├─> suggestion-extractor.ts (System 1)
  │   └─> Returns: research/ideas/goals
  │
  ├─> derived-intelligence.ts (System 1)
  │   └─> Returns: pattern-based build opportunities
  │
  └─> threshold-monitor.ts (System 2)
      │
      ├─> telos-extractor.ts (Layer 2)
      │   └─> Returns: identity profile
      │
      ├─> Reactive Detection (Layer 1)
      │   ├─> aggregateDay()
      │   ├─> checkSameDayThresholds()
      │   └─> Apply telos multipliers (Layer 2)
      │
      └─> Predictive Detection (Layer 3)
          ├─> goal-predictor.ts
          ├─> trajectory-forecaster.ts
          ├─> tool-health-monitor.ts
          ├─> opportunity-cost-analyzer.ts
          ├─> prediction-orchestrator.ts
          └─> Returns: ranked predictions

  ↓
Combined suggestions (System 1 + System 2)
  ↓
User sees: Research + Ideas + Goals + Reactive Patterns + Predictions
```

### The Key Insight

**System 2 is not 3 separate systems** - it's one system with 3 integrated layers:

```
Base System: Self-Improvement Flywheel
  ├─ WITH telos-aware scoring (Layer 2)
  └─ WITH predictive engines (Layer 3)

Result: Enhanced Flywheel (one integrated capability)
```

**You deploy it as one unit** because:
- threshold-monitor.ts imports telos-extractor
- threshold-monitor.ts imports prediction-orchestrator
- They're tightly coupled by design
- Separating them breaks functionality

---

## Deployment Reality: What Actually Happens

### Step-by-Step for Fresh PAI

**Day 1: Deploy Base Intelligence**

```bash
# Deploy System 1 (Context-Aware)
# Result: Get research/idea suggestions from History

# Test
bun run context-analyzer.ts
# Shows: Research revival, unfinished ideas, goals
```

**Day 2: Add Reactive Detection**

```bash
# Deploy System 2 - Layer 1 (Reactive)
# Result: Start collecting metrics

# After 1 day of usage:
bun run metric-aggregator.ts
bun run threshold-monitor.ts --reactive-only
# Shows: "Bash→Bash→Bash: 10 times today"
```

**Day 3: Add Purpose-Awareness**

```bash
# Telos is ALREADY in threshold-monitor.ts
# Just need enough History for extraction

# Test
bun run telos-extractor.ts
# Shows: Builder 95%, Scientist 70%, Leader 85%

# Now threshold-monitor shows:
# "This aligns with your builder identity - automate"
```

**Day 4: Add Forward-Thinking**

```bash
# Predictions are ALREADY in threshold-monitor.ts
# Just need the engine files deployed

# Test
bun run test-predictions.ts

# Now threshold-monitor shows:
# Reactive: 45 | Predictive: 6
```

### Why This Order Matters

1. **Context-Aware first** → Get immediate value from existing History
2. **Reactive detection next** → Need 1 day to collect metrics
3. **Telos-aware next** → Need 10-20 sessions for accurate identity
4. **Predictive last** → Need metrics + telos to predict

---

## Maintenance

### System 1: Context-Aware

**Maintenance:** None
**Updates:** Add new detection patterns as needed

### System 2: Enhanced Flywheel

**Regular:**
- Metrics collected automatically
- Telos cache refreshes automatically (24h)
- Predictions generated on-demand

**Periodic (optional):**
- Review telos accuracy monthly
- Tune thresholds based on feedback
- Enhance goal → capability mappings

---

## Summary for Deployment Team

### If Someone Asks: "How many capabilities?"

**Answer: 2 main systems**

1. **Context-Aware Suggestions** (independent)
2. **Enhanced Self-Improvement Flywheel** (integrated: reactive + telos + predictive)

### If Someone Asks: "Can I deploy just the prediction layer?"

**Answer: NO**

The prediction layer needs:
- Metrics from reactive detection
- Telos from identity extraction
- Both are part of the flywheel base system

You must deploy the complete Enhanced Flywheel (all 3 layers together).

### If Someone Asks: "What's the minimum deployment?"

**Answer: System 1 only** (Context-Aware Suggestions)

- 5 files
- No cron/launchd needed
- Works immediately
- Provides research/idea/goal tracking

But you lose:
- Metric-driven automation detection
- Real-time pattern monitoring
- Predictive suggestions
- Tool health monitoring

### If Someone Asks: "What's the recommended deployment?"

**Answer: Both systems** (Complete Intelligence System)

- 18 files total
- Hooks + cron/launchd setup
- 30-60 minute deployment
- Complete forward-thinking intelligence

---

## Documentation Structure

**Individual Docs (for deep-dive):**
- `01-Context-Aware-Suggestions-System.md` - Deep dive into extraction
- `02-Self-Improvement-Flywheel.md` - Deep dive into reactive detection
- `03-Telos-Aware-Flywheel.md` - Deep dive into purpose alignment
- `04-Flywheel-Prediction-Layer.md` - Deep dive into forward-thinking

**This Doc (for deployment):**
- Shows the integrated reality
- Explains dependencies
- Provides deployment strategy
- Clarifies what's standalone vs enhancement

---

## The Truth

You built:
- **1 independent system** (Context-Aware)
- **1 base system** (Reactive Flywheel)
- **2 enhancement layers** that transform the base into something forward-thinking

Marketing might call this "4 capabilities."
Engineering calls this "2 systems, one enhanced with 2 layers."

You're an engineer. Deploy as 2 integrated systems. 🎯

---

## License

Part of Personal AI Infrastructure (PAI)
