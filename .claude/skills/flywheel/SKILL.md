---
name: flywheel
description: View current flywheel patterns and automation opportunities. USE WHEN user says "show patterns", "flywheel status", "what patterns", "/flywheel", OR needs to see reactive and predictive suggestions with metrics.
---

# Flywheel - Pattern Status Viewer

**Manual access to your self-improvement flywheel insights.**

Shows both reactive patterns (what you've been doing) and predictive suggestions (what you'll need).

## What This Skill Does

When invoked, displays:
1. **Reactive Patterns** (📊)
   - Same-tool sequences detected today/this week
   - High-frequency tool usage
   - Confidence and occurrence counts

2. **Predictive Suggestions** (🔮)
   - Goal-based capability predictions
   - Trajectory bottleneck forecasts
   - Tool health deprecation warnings
   - Opportunity cost misalignments

3. **Telos Alignment**
   - Your current identity profile
   - Alignment multipliers for each pattern
   - Purpose-driven recommendations

## Workflow

### When User Invokes

**User says:**
- "Show me the flywheel patterns"
- "What automation opportunities exist?"
- "/flywheel"
- "Show current patterns"
- "Flywheel status"

**You run:**
```bash
bun run ${PAI_DIR}/../tools/threshold-monitor.ts
```

**Then format and present:**
- Group by priority (urgent/high/strategic)
- Show reactive vs predictive counts
- Highlight top 3-5 suggestions
- Explain telos alignment for key patterns

### Output Format

```
🔄 FLYWHEEL STATUS

Your Identity: Builder 95%, Scientist 70%, Leader 85%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 REACTIVE PATTERNS (45 detected)

Urgent (7):
  • Bash→Bash→Bash: 35 times today
    Confidence: 95% | Telos: 1.0x | Impact: ~70 min/day

  • TaskCreate→TaskCreate→TaskCreate: 16 times today
    Confidence: 95% | Telos: 1.34x | Impact: ~32 min/day
    This aligns with your builder identity - automate!

High Priority (18):
  • [Show top 3-5]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔮 PREDICTIVE SUGGESTIONS (6 generated)

High Priority:
  • Realign building time
    You're spending 18% on building, expected 56%
    Strategic Value: 433 | Confidence: 80%
    Action: REFOCUS - Block dedicated build time

  • Archive content-generation skill
    Unused for 999 days | Decay: 100%
    Strategic Value: 225 | Confidence: 100%
    Action: Archive to declutter system

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 TOP RECOMMENDATIONS:

1. Realign building time (Strategic Value: 433)
2. Automate Bash sequences (35 occurrences)
3. Automate task workflows (32 occurrences)
```

## Implementation

### Step 1: Run Threshold Monitor

```bash
# Get all alerts
const output = execSync('bun run ${PAI_DIR}/../tools/threshold-monitor.ts', {
  encoding: 'utf-8',
  cwd: join(PAI_DIR, '..')
});
```

### Step 2: Parse Output

```typescript
// Count reactive vs predictive
const lines = output.split('\n');
const summaryLine = lines.find(l => l.includes('Reactive:'));
// Parse: "Reactive: 45 | Predictive: 6"
```

### Step 3: Format for User

Present in clear, structured format:
- Identity profile at top
- Reactive patterns (grouped by priority)
- Predictive suggestions (grouped by priority)
- Top 3-5 recommendations by strategic value

### Step 4: Explain Context

For high-priority items, explain:
- Why this pattern matters (telos alignment)
- What the strategic value means
- What action to take next
- Estimated time savings or impact

## Integration

**With threshold-alert.ts:**
- Threshold alert runs automatically mid-session (urgent only)
- This skill shows ALL patterns on-demand (urgent + high + strategic)

**With context-analyzer.ts:**
- Context analyzer runs automatically at session start
- This skill is manual check anytime during session

**With monday-brief:**
- Monday brief shows weekly strategic view
- This skill shows current day/week tactical view

## Examples

### Example 1: Check Current Status

```
User: "Show me the flywheel status"

You: [Invoke flywheel skill]
     [Run threshold-monitor.ts]
     [Format output]

"Your flywheel detected 45 reactive patterns and 6 predictive
suggestions. Your top priority is realigning building time -
you're spending only 18% vs 56% expected for a 95% builder."
```

### Example 2: After Making Changes

```
User: "I just built 3 new automation tools - check the flywheel"

You: [Invoke flywheel skill]
     [Show updated patterns]

"Great! I see your automation reduced Bash→Bash sequences
from 35 to 12 times today. Your building time is now 24%
(still below 56% expected, but improving)."
```

## Deployment

**This is just a skill wrapper** around existing tools.

**Deploy:**
```bash
# Copy skill
cp -r .claude/skills/flywheel TARGET/.claude/skills/

# Ensure threshold-monitor.ts exists
ls TARGET/tools/threshold-monitor.ts

# Test
# In Claude: /flywheel
```

**Dependencies:**
- threshold-monitor.ts must be deployed
- metric-aggregator.ts must be deployed
- Metrics must be collected (capture-all-events hook)

---

## Troubleshooting

**Issue: No patterns shown**

Likely cause: No metrics collected yet

**Fix:**
```bash
# Check metrics exist
ls ~/.claude/metrics/*/raw-tool-calls/*.jsonl

# If empty: Use system for a day to collect data
```

**Issue: Predictions always 0**

Likely causes:
- No goals in telos profile
- Stable system (no acceleration detected)
- All tools are healthy
- Perfect time alignment

**This is normal** for a stable system.

---

## Related Skills

- **/suggestions** - High-value context from History
- **/monday-brief** - Weekly strategic summary
- **/my-telos** - View identity profile
- **/predictions** - View just predictive suggestions

---

**Status:** Ready for implementation
**Priority:** Medium (nice-to-have for manual access)
