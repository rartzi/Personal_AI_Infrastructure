---
name: my-telos
description: View your identity profile and purpose alignment scores. USE WHEN user says "show my telos", "what's my identity", "my profile", "/my-telos", OR needs to understand their builder/scientist/leader scores.
---

# My Telos - Identity Profile Viewer

**See your extracted identity and how it influences suggestions.**

Shows your builder/scientist/leader scores, values, goals, and how the system uses this for purpose-driven recommendations.

## What This Skill Does

When invoked, displays:
1. **Identity Profile**
   - Builder score (0-100)
   - Scientist score (0-100)
   - Leader score (0-100)
   - Extracted from your work history

2. **Values**
   - Autonomy preference
   - Impact focus
   - Learning orientation

3. **Goals & Focus**
   - Recent goals (last 30 days)
   - Current focus areas
   - Active pursuits

4. **How It's Used**
   - Alignment multipliers explained
   - Impact on confidence scores
   - Expected time allocations
   - Example pattern scoring

## Workflow

### When User Invokes

**User says:**
- "What's my telos profile?"
- "Show my identity scores"
- "/my-telos"
- "What does the system think I am?"
- "Show my builder/scientist/leader scores"

**You run:**
```bash
bun run ${PAI_DIR}/../tools/telos-extractor.ts
cat ~/.claude/telos.json
```

**Then format and present:**
- Identity visualization
- Explanation of what each score means
- How it affects suggestions
- Expected time allocation
- Recent goals and focus areas

### Output Format

```
🎯 YOUR TELOS PROFILE

Last updated: 2 hours ago
Extracted from: 127 History files (last 30 days)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 IDENTITY SCORES

Builder:    95% ████████████████████  (Very High)
Scientist:  70% ██████████████        (High)
Leader:     85% █████████████████     (High)

Primary Identity: BUILDER

What this means:
  • You create tools, features, and infrastructure
  • Building is your core strength and focus
  • Expected to spend 56% of time on building work

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💎 YOUR VALUES

Autonomy:  85% █████████████████
Impact:    90% ██████████████████
Learning:  75% ███████████████

Value Interpretation:
  • High autonomy: Prefer independent work
  • High impact: Focus on scale and reach
  • High learning: Value knowledge acquisition

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 RECENT GOALS & FOCUS

Goals (last 30 days):
  • [None detected in History]
  → Add goals to unlock goal-based predictions

Current Focus Areas:
  • AI infrastructure
  • Automation systems
  • Self-improvement tools

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 HOW TELOS AFFECTS SUGGESTIONS

Alignment Multipliers:
  • Edit/Write patterns: 1.48x boost (builder work)
  • Read/Research patterns: 1.0x neutral
  • Task/Coordination: 0.5x penalty (leader work, but not primary)

Example Pattern Scoring:

Pattern: Edit→Edit→Edit (13 times today)
  Base confidence: 85%
  Telos multiplier: 1.48x (strong builder alignment)
  Adjusted confidence: 95%
  Message: "This aligns with your builder identity -
           automate to accelerate your mission"

Pattern: Task→Task→Task (8 times today)
  Base confidence: 85%
  Telos multiplier: 0.5x (coordination, not your focus)
  Adjusted confidence: 42%
  Message: "Low alignment with builder identity -
           should this be delegated?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 EXPECTED TIME ALLOCATION

Based on your identity, you should spend:
  Building:      56% (95% × 0.6)
  Researching:   35% (70% × 0.5)
  Coordinating:  34% (85% × 0.4)
  Other:         10% (baseline)

Actual allocation (last 30 days):
  Building:      18% ⚠️  (-38% deficit)
  Researching:   19% ✅ (close enough)
  Coordinating:  27% ✅ (close enough)
  Other:         36% ❌ (+26% excess)

Top Recommendation:
  REFOCUS on building work (38% deficit is critical)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 UNDERSTANDING YOUR PROFILE

Builder 95%:
  → You excel at creating tools and infrastructure
  → Automation, architecture, and implementation are natural
  → Spend majority of time building to maximize impact

Scientist 70%:
  → Strong research and investigation skills
  → Good at exploring new technologies
  → Use research to inform building (not as primary activity)

Leader 85%:
  → Capable of coordination and delegation
  → Can lead teams and projects when needed
  → But shouldn't be primary activity (conflicts with builder focus)

The Tension:
  You're strong in all three, but focusing on coordination
  or excessive research pulls you away from your builder core.
  The flywheel detects this and recommends realignment.
```

## Implementation

### Step 1: Extract Telos

```typescript
import { loadTelos } from './telos-extractor';

const telos = loadTelos(24); // 24-hour cache
```

### Step 2: Get Time Allocation

```typescript
import { analyzeOpportunityCost } from './opportunity-cost-analyzer';
import { aggregatePeriod } from './metric-aggregator';

const summaries = aggregatePeriod(30);
const costReport = analyzeOpportunityCost(summaries, telos);
```

### Step 3: Format Profile

Present in visual format:
- Bar charts for identity scores (████████)
- Percentage breakdowns
- Expected vs actual allocations
- Key insights and recommendations

### Step 4: Explain Impact

For each identity dimension, explain:
- What this score means
- How it affects suggestions
- Expected time allocation
- Example pattern scoring

## Advanced Usage

**Check specific pattern alignment:**
```typescript
import { calculateTelosAlignment } from './telos-extractor';

const pattern = "Edit→Edit→Edit";
const multiplier = calculateTelosAlignment(pattern, telos);
// Returns: 1.48 (strong builder alignment)
```

**Force refresh (ignore cache):**
```bash
rm ~/.claude/telos.json
bun run tools/telos-extractor.ts
```

## Integration

**With flywheel skill:**
- Flywheel shows patterns + telos alignment
- This skill explains WHY patterns have certain alignments

**With opportunity-cost-analyzer:**
- This skill shows expected vs actual allocation
- Explains deficit/excess calculations

**With context-suggestions:**
- Context suggestions use telos for prioritization
- This skill shows the underlying profile

## Deployment

**Files needed:**
```bash
.claude/skills/my-telos/SKILL.md  # This file
tools/telos-extractor.ts          # Must exist
tools/opportunity-cost-analyzer.ts # Optional (for time allocation)
tools/metric-aggregator.ts        # Optional (for time allocation)
```

**Deploy:**
```bash
# Just copy the skill
cp -r .claude/skills/my-telos TARGET/.claude/skills/

# Ensure telos-extractor exists
ls TARGET/tools/telos-extractor.ts
```

**No hook registration needed** - this is user-invoked only.

## Troubleshooting

**Issue: Identity scores seem wrong**

**Check:**
```bash
# Review extraction
bun run tools/telos-extractor.ts --verbose

# Check History content
rg -i "built|created|implemented" ~/.claude/History/Sessions/ | wc -l
```

**Tune detection patterns** in telos-extractor.ts if needed.

**Issue: No goals shown**

**Normal** - Goals are optional.

**To add goals:**
- Add to History files: "Goal: democratize AI"
- Or manually add to telos.json

**Issue: Cache is stale**

```bash
# Force refresh
rm ~/.claude/telos.json
bun run tools/telos-extractor.ts
```

## Use Cases

### Use Case 1: Understanding Suggestions

```
User: "Why does the system keep suggesting I automate Task work?"

You: [Invoke /my-telos]

"Looking at your telos profile, you're 95% builder but only 40%
leader. Task patterns have 0.5x telos multiplier (low alignment).
The system is suggesting delegation, not automation, because this
work doesn't align with your core builder identity."
```

### Use Case 2: Career Reflection

```
User: "What does my work history say about me?"

You: [Invoke /my-telos]

"Your identity is 95% builder, 70% scientist, 85% leader. You're
primarily a creator who leverages research and can coordinate when
needed. The system expects you to spend 56% of time building to
maximize your impact."
```

### Use Case 3: Time Allocation Check

```
User: "Am I spending time on the right things?"

You: [Invoke /my-telos]

"Your telos profile shows a 38% building deficit. You're spending
only 18% of time on building work vs 56% expected. The 'other'
category is consuming 36% of your time. Consider blocking dedicated
build time or delegating non-building work."
```

## Related Skills

- **/flywheel** - See current patterns and automation opportunities
- **/predictions** - View just forward-looking predictions
- **/suggestions** - Context-aware suggestions from History
- **/monday-brief** - Weekly strategic summary

---

**Status:** Ready for implementation
**Priority:** Low (diagnostic/explanatory tool)
**Benefit:** Helps users understand the "why" behind suggestions
