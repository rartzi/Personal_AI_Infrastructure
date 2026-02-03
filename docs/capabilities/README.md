# PAI Capabilities Documentation

Complete deployment guides for all major PAI capabilities.

---

## Capabilities Index

### 1. Context-Aware Suggestions System
**File:** `01-Context-Aware-Suggestions-System.md`

**What it does:** Extracts research threads, unfinished ideas, goals, and build opportunities from your work history.

**Status:** Production
**Dependencies:** History system
**Lines of Code:** ~1,200

### 2. Self-Improvement Flywheel
**File:** `02-Self-Improvement-Flywheel.md`

**What it does:** Reactive pattern detection - collects metrics, detects repetitive workflows, surfaces automation opportunities.

**Status:** Production
**Dependencies:** Claude Code hooks
**Lines of Code:** ~1,500
**Phases:** 5 (Collection → Aggregation → Monitoring → Mid-Session → Session-Start)

### 3. Telos-Aware Flywheel
**File:** `03-Telos-Aware-Flywheel.md`

**What it does:** Purpose-driven enhancement layer - extracts identity, adjusts confidence scores based on alignment.

**Status:** Production
**Dependencies:** History system, Self-Improvement Flywheel
**Lines of Code:** ~800
**Integration:** Applied throughout all flywheel suggestions

### 4. Flywheel Prediction Layer
**File:** `04-Flywheel-Prediction-Layer.md`

**What it does:** Forward-thinking intelligence - predicts needs from goals, forecasts bottlenecks, auto-deprecates tools, flags misalignments.

**Status:** Production
**Dependencies:** Self-Improvement Flywheel, Telos-Aware Flywheel
**Lines of Code:** ~2,500
**Engines:** 4 (Goal-Based, Trajectory, Tool-Health, Opportunity-Cost)

---

## Quick Deployment Guide

### Prerequisites

For a fresh PAI installation, deploy in this order:

1. **PAI Core** (base system with History/)
2. **Context-Aware Suggestions** (independent)
3. **Self-Improvement Flywheel** (Phases 1-5)
4. **Telos-Aware Enhancement** (layer on top of #3)
5. **Prediction Layer** (requires #3 + #4)

### Deployment Order

```
Step 1: Install PAI Core
        └─> History system functional

Step 2: Context-Aware Suggestions (independent)
        └─> Session-start suggestions working

Step 3: Self-Improvement Flywheel
        Phase 1: Metric collection hook
        Phase 2: Daily aggregation
        Phase 3: Threshold monitoring
        Phase 4: Mid-session alerts
        Phase 5: Session-start integration
        └─> Reactive pattern detection working

Step 4: Telos-Aware Enhancement
        └─> All suggestions now purpose-aligned

Step 5: Prediction Layer
        Engine 1: Goal-based predictor
        Engine 2: Trajectory forecaster
        Engine 3: Tool health monitor
        Engine 4: Opportunity cost analyzer
        Orchestration: Unified ranking
        └─> Forward-thinking predictions working
```

### Verification Checklist

After full deployment:

```bash
# ✅ Context suggestions
bun run tools/context-analyzer.ts

# ✅ Self-improvement (reactive)
bun run tools/threshold-monitor.ts --reactive-only

# ✅ Telos extraction
cat ~/.claude/telos.json

# ✅ Prediction layer (all engines)
bun run tools/test-predictions.ts

# ✅ Full integration (reactive + predictive)
bun run tools/threshold-monitor.ts
```

---

## Dependency Graph

```
┌────────────────────────────────────────────┐
│              PAI Core                      │
│  (History/, hooks system, Claude Code)     │
└──────────────┬─────────────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐  ┌──────────────────────────┐
│  Context-    │  │  Self-Improvement        │
│  Aware       │  │  Flywheel                │
│ Suggestions  │  │  (Phases 1-5)            │
└──────────────┘  └───────────┬──────────────┘
                              │
                   ┌──────────┴──────────┐
                   ▼                     ▼
            ┌─────────────┐     ┌─────────────┐
            │   Telos-    │     │ Prediction  │
            │   Aware     │────▶│   Layer     │
            │   Layer     │     │ (4 engines) │
            └─────────────┘     └─────────────┘
```

**Legend:**
- **Independent:** Context-Aware Suggestions
- **Foundation:** Self-Improvement Flywheel
- **Enhancement Layer:** Telos-Aware (enhances Self-Improvement)
- **Enhancement Layer:** Prediction Layer (adds forward-thinking)

---

## System Integration Map

```
Component                     Uses These Systems
─────────────────────────────────────────────────────
context-analyzer.ts          • Context-Aware Suggestions
                            • Threshold-Monitor (reactive + predictive)

threshold-monitor.ts         • Self-Improvement Flywheel (metrics)
                            • Telos-Aware (alignment)
                            • Prediction Layer (all 4 engines)

monday-brief.ts             • Context-Aware Suggestions
                            • Threshold-Monitor (for flywheel insights)

threshold-alert.ts          • Threshold-Monitor
                            • Displays both reactive + predictive

load-context-suggestions.ts • Context-Analyzer
                            • Auto-runs at session start
```

---

## Total System Stats

**Combined Statistics:**

| Metric | Value |
|--------|-------|
| Total files created | 15+ |
| Total lines of code | ~6,000 |
| Total commits | ~20 |
| Development time | 1 day |
| Deployment time | 30-60 minutes |

**Component Breakdown:**

| Capability | LOC | Files | Dependencies |
|------------|-----|-------|--------------|
| Context-Aware | 1,200 | 3 | History/ |
| Self-Improvement | 1,500 | 5 | Hooks, Metrics |
| Telos-Aware | 800 | 1 | History/, Metrics |
| Prediction Layer | 2,500 | 6 | All above |
| **Total** | **6,000** | **15** | **Integrated** |

---

## Support

**Issues:**
- Check individual capability doc for troubleshooting
- Run test scripts to isolate problems
- Review logs in `/tmp/*.log`

**Questions:**
- PRD: What and why
- Architecture: How it works
- Usage: How to use it
- Deployment: How to install it

**Contributing:**
- Each capability doc has extension points
- Add custom patterns, adjust thresholds
- Share improvements with community

---

## License

Part of Personal AI Infrastructure (PAI)

---

**Each capability has a complete deployment guide with PRD, Architecture, Usage, and Deployment sections.**
