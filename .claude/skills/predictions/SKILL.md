---
name: predictions
description: View forward-looking predictive suggestions only. USE WHEN user says "show predictions", "what will I need", "forecast", "/predictions", OR wants to see goal-based, trajectory, tool-health, and opportunity-cost predictions without reactive patterns.
---

# Predictions - Forward-Looking Intelligence

**See what the prediction layer forecasts you'll need.**

Shows ONLY predictive suggestions (🔮) without reactive patterns (📊) - useful for strategic planning and understanding future needs.

## What This Skill Does

When invoked, displays:
1. **Goal-Based Predictions**
   - Capabilities needed to achieve stated goals
   - "democratize AI" → documentation generator
   - "build platform" → architecture templates

2. **Trajectory Forecasts**
   - Accelerating patterns → predicted bottlenecks
   - "Edit usage 3x/week growth" → automation needed soon
   - 1-2 week lookahead with bottleneck risk scores

3. **Tool Health Deprecations**
   - Unused tools → archive recommendations
   - Decay scoring with grace periods
   - Zombie detection (never used)

4. **Opportunity Cost Realignments**
   - Time allocation mismatches
   - "Building 18% vs 56% expected" → refocus needed
   - Strategic deficit/excess warnings

## Workflow

### When User Invokes

**User says:**
- "What does the prediction layer suggest?"
- "Show me future needs"
- "/predictions"
- "What will I need to build?"
- "Forecast my bottlenecks"

**You run:**
```bash
bun run ${PAI_DIR}/../tools/test-predictions.ts
```

**Then present:**
- Results from all 4 prediction engines
- Orchestrated and ranked by strategic value
- Only forward-looking (no reactive patterns)
- Clear timeframes (immediate/1-2 weeks/1 month/3+ months)

### Output Format

```
🔮 PREDICTIVE INTELLIGENCE

Generated: 2026-02-03 4:45 PM
Engines: 4 active | Suggestions: 6 total

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 STRATEGIC RANKING (Top 5)

1. Realign building time
   Type: REALIGNMENT (Opportunity Cost)
   Priority: HIGH | Confidence: 80%
   Strategic Value: 433

   Finding:
   • Spending 18% on building, expected 56%
   • Deficit: 38% (CRITICAL)
   • Telos Alignment: 0.95x

   Recommendation:
   REFOCUS: You're building 38% less than expected for a 95%
   builder. Block dedicated build time or eliminate distractions.

   Impact: +15 hours/week building capacity
   Timeframe: Immediate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. Archive content-generation skill
   Type: DEPRECATION (Tool Health)
   Priority: MEDIUM | Confidence: 100%
   Strategic Value: 225

   Finding:
   • Skill unused for 999 days
   • Decay score: 100% (zombie)
   • Status: Never used

   Recommendation:
   Archive this skill to declutter your system.

   Impact: Cleaner tool inventory
   Timeframe: Immediate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. [Additional predictions...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 PREDICTION BREAKDOWN

By Type:
  Goal-based:    0 (no goals in profile)
  Trajectory:    0 (system stable)
  Deprecation:   3 (zombie tools detected)
  Realignment:   3 (time allocation issues)

By Priority:
  Critical:      0
  High:          1 (building deficit)
  Medium:        5
  Low:           0

By Timeframe:
  Immediate:     6
  1-2 weeks:     0
  1 month:       0
  3+ months:     0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 KEY INSIGHTS

Forward-Looking Findings:
  • Your time allocation doesn't match identity
  • 3 tools need archival to reduce clutter
  • No bottlenecks forecasted (system stable)
  • No new capabilities predicted (add goals to unlock)

Recommendations:
  1. Address building time deficit first
  2. Archive unused tools
  3. Add goals to telos.json for goal-based predictions
```

## Implementation

### Step 1: Run Test Suite

```typescript
import { execSync } from 'child_process';

const output = execSync('bun run ${PAI_DIR}/../tools/test-predictions.ts', {
  encoding: 'utf-8'
});
```

### Step 2: Parse Results

```typescript
// Extract prediction counts by type
const lines = output.split('\n');
const goalBased = lines.find(l => l.includes('Goal-based:'));
const trajectory = lines.find(l => l.includes('Trajectory:'));
const toolHealth = lines.find(l => l.includes('Tool health:'));
const opportunityCost = lines.find(l => l.includes('Opportunity cost:'));
```

### Step 3: Get Orchestrated Suggestions

```typescript
import { orchestratePredictions } from './prediction-orchestrator';
import { predictFromGoals } from './goal-predictor';
import { forecastTrajectories } from './trajectory-forecaster';
import { monitorToolHealth } from './tool-health-monitor';
import { analyzeOpportunityCost } from './opportunity-cost-analyzer';
import { loadTelos } from './telos-extractor';
import { aggregatePeriod } from './metric-aggregator';

const telos = loadTelos();
const summaries = aggregatePeriod(30);

const predictions = orchestratePredictions(
  predictFromGoals(telos),
  forecastTrajectories(summaries),
  monitorToolHealth(),
  analyzeOpportunityCost(summaries, telos),
  telos
);

// predictions is sorted by strategic value
```

### Step 4: Format for User

Present in clear sections:
- Strategic ranking (top 5)
- Breakdown by type/priority/timeframe
- Key insights and recommendations
- Actionable next steps

## Advanced Usage

### Filter by Type

```
User: "Show only goal-based predictions"

You: [Run predictions with filter]
     const goalOnly = predictions.filter(p => p.type === 'goal-based');
```

### Filter by Timeframe

```
User: "What do I need immediately?"

You: [Run predictions with filter]
     const immediate = predictions.filter(p => p.timeframe === 'immediate');
```

### Filter by Priority

```
User: "Show only critical predictions"

You: [Run predictions with filter]
     const critical = predictions.filter(p => p.priority === 'critical');
```

## Integration

**With /flywheel:**
- Flywheel shows reactive + predictive together
- This skill shows ONLY predictive (forward-looking)

**With /my-telos:**
- My-telos explains WHY predictions have certain alignments
- This skill shows WHAT predictions exist

**With /suggestions:**
- Suggestions includes predictions + context-aware intelligence
- This skill focuses ONLY on prediction layer output

**With threshold-monitor:**
- Threshold-monitor is the underlying engine
- This skill is a filtered view (predictive only)

## Comparison

### /suggestions vs /predictions

**/suggestions (comprehensive):**
- Research threads (from History)
- Unfinished ideas (from History)
- Goals (from History)
- Reactive patterns (from metrics)
- Predictive suggestions (from prediction layer)

**/predictions (forward-looking only):**
- Goal-based predictions
- Trajectory forecasts
- Tool health deprecations
- Opportunity cost realignments

**When to use /predictions:**
- Strategic planning ("what will I need in 2 weeks?")
- Tool lifecycle management ("what should I archive?")
- Time allocation analysis ("am I focused on the right work?")

**When to use /suggestions:**
- Daily work planning ("what should I work on today?")
- Context from past work
- Comprehensive view of all opportunities

## Deployment

**Files needed:**
```bash
.claude/skills/predictions/SKILL.md  # This file

# Dependencies (must exist):
tools/goal-predictor.ts
tools/trajectory-forecaster.ts
tools/tool-health-monitor.ts
tools/opportunity-cost-analyzer.ts
tools/prediction-orchestrator.ts
tools/telos-extractor.ts
tools/metric-aggregator.ts
```

**Deploy:**
```bash
# Copy skill
cp -r .claude/skills/predictions TARGET/.claude/skills/

# Ensure all prediction tools exist
ls TARGET/tools/{goal-predictor,trajectory-forecaster,tool-health-monitor,opportunity-cost-analyzer,prediction-orchestrator}.ts
```

**No hook registration needed** - user-invoked only.

## Troubleshooting

**Issue: All predictions show 0**

**This is NORMAL for a stable system.**

Predictions only appear when:
- Goals exist in telos → goal-based predictions
- Patterns are accelerating → trajectory forecasts
- Tools are unused → deprecation warnings
- Time allocation is misaligned → realignment suggestions

**Issue: Goal-based always 0**

**Cause:** No goals in telos profile

**Fix:**
```bash
# Add goals to telos.json
cat >> ~/.claude/telos.json <<EOF
{
  "recentGoals": [
    { "goal": "democratize AI capabilities", "date": "2026-02-03" },
    { "goal": "build research platform", "date": "2026-02-03" }
  ]
}
EOF

# Re-run
bun run tools/predictions.ts
```

**Issue: Trajectory always 0**

**Cause:** Need at least 7 days of metric data

**Check:**
```bash
ls ~/.claude/metrics/*/daily-summaries/*.json | wc -l
# Need 7+ files
```

## Use Cases

### Use Case 1: Strategic Planning

```
User: "I'm planning next quarter - what capabilities will I need?"

You: [Invoke /predictions]

"Based on your goals and trajectory, you'll need:
  1. Documentation generator (for democratize goal)
  2. Research platform infrastructure (accelerating Read usage)
  3. No urgent needs detected - system is stable"
```

### Use Case 2: Tool Lifecycle

```
User: "What tools should I archive or update?"

You: [Invoke /predictions]

"The tool health monitor detected:
  • content-generation: Zombie (100% decay) - Archive
  • old-scraper: Deprecated (85% decay) - Consider archiving
  • research-helper: Declining (60% decay) - Monitor"
```

### Use Case 3: Time Allocation Check

```
User: "Am I spending time on the right things?"

You: [Invoke /predictions]

"Opportunity cost analysis shows:
  • Building deficit: 38% (CRITICAL)
  • Other excess: 26% (HIGH)
  Recommendation: REFOCUS - Block dedicated build time"
```

## Related Skills

- **/flywheel** - Full pattern status (reactive + predictive)
- **/my-telos** - Your identity profile and alignment scores
- **/suggestions** - Comprehensive suggestions (context + patterns + predictions)
- **/monday-brief** - Weekly strategic summary

---

## Testing Commands

```bash
# Test all engines individually
bun run tools/goal-predictor.ts
bun run tools/trajectory-forecaster.ts
bun run tools/tool-health-monitor.ts
bun run tools/opportunity-cost-analyzer.ts

# Test orchestration
bun run tools/test-predictions.ts

# Test integration
bun run tools/threshold-monitor.ts | grep "Predictive:"
```

---

**Status:** Ready for implementation
**Priority:** Medium (diagnostic tool for strategic planning)
**Benefit:** Clear view of forward-looking intelligence without reactive noise
