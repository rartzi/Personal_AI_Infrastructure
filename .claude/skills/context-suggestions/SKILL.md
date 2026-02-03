---
name: context-suggestions
description: Proactive context-aware suggestions based on work patterns. USE WHEN user says "what should I work on", "suggestions", "what's next", OR at session start for proactive guidance.
---

# Context-Aware Suggestions - Seneca-Style Intelligence

**Automatically analyzes your History to suggest next steps based on patterns.**

Inspired by Clawdbot's Seneca, which proactively suggests actions based on context:
- "You tried approach X yesterday and it failed - want to try Y?"
- "This is similar to the bug we fixed last week"
- "You have uncommitted changes that should be pushed"

## What This Skill Does

Analyzes recent History to provide intelligent suggestions:

### 1. **Failed Attempt Detection** 🔴 High Priority
- Scans recent sessions for error keywords
- Identifies unsuccessful approaches
- Suggests trying alternatives
- References specific sessions where failures occurred

### 2. **Incomplete Work Tracking** 🟡 Medium Priority
- Finds TODOs and WIP items
- Reminds about unfinished tasks
- Provides context about what was left incomplete
- Suggests continuing where you left off

### 3. **Similar Issue Recognition** 🔴 High Priority
- Matches current work to past learnings
- Identifies solved problems that apply now
- References relevant learning documentation
- Prevents re-solving known issues

### 4. **Automation Opportunities** 🟢 Low Priority
- Detects repeated command patterns
- Suggests creating scripts or aliases
- Identifies manual tasks that could be automated
- Tracks command frequency across sessions

### 5. **Git State Monitoring** 🟡 Medium Priority
- Detects uncommitted changes
- Flags unpushed commits
- Identifies stale branches
- Suggests cleanup actions

### 6. **Pattern Analysis** 🟢 Low Priority
- Identifies recurring themes
- Spots productivity bottlenecks
- Suggests workflow improvements
- Tracks tool usage patterns

## Usage

### Manual Trigger

```bash
# Generate suggestions
bun run tools/context-analyzer.ts

# JSON output for programmatic use
bun run tools/context-analyzer.ts --json

# Verbose analysis details
bun run tools/context-analyzer.ts --verbose
```

### Automatic (Session Start)

The context analyzer can be added to SessionStart hooks to provide suggestions automatically when you start working.

### PAI Skill Trigger

Ask PAI:
- "What should I work on next?"
- "Give me suggestions"
- "What's my context?"
- "Analyze my recent work"

## Output Format

```markdown
# Context-Aware Suggestions

Generated: [timestamp]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔴 High Priority

### Recent failure detected
You encountered issues recently. Consider trying an alternative approach.

Context: Error: Connection timeout after 30s

📝 Suggested Action: Review the session and try a different strategy
📂 References: 2026-02-02-session.md

---

## 🟡 Medium Priority

### Uncommitted changes detected
You have uncommitted changes on branch feature/new-ui

Context: Uncommitted work could be lost

📝 Suggested Action: Review and commit your changes

---

## 🟢 Low Priority

### Repeated task: npm test
You've run "npm test" 5 times in recent sessions

📝 Suggested Action: Consider adding to pre-commit hook

---
```

## Analysis Scope

| Data Source | Lookback Period | Purpose |
|-------------|-----------------|---------|
| **Sessions** | 14 days | Recent work patterns, failures, incomplete tasks |
| **Learnings** | 30 days | Past solutions, documented patterns |
| **Git State** | Current | Uncommitted changes, unpushed commits, stale branches |
| **Commands** | 10 recent sessions | Repeated patterns for automation |

## Priority Levels

**🔴 High Priority (Act Now):**
- Recent failures requiring attention
- Similar past issues with documented solutions
- Critical git state (uncommitted work at risk)

**🟡 Medium Priority (Soon):**
- Incomplete work from recent sessions
- Unpushed commits
- Git cleanup needed

**🟢 Low Priority (When Convenient):**
- Automation opportunities
- Pattern improvements
- Workflow optimizations

## Integration

### Session Start Hook

Add to `.claude/hooks/load-context-suggestions.ts`:

```typescript
// Run context analyzer and inject suggestions
const suggestions = execSync('bun run tools/context-analyzer.ts', { encoding: 'utf-8' });

console.log(`<system-reminder>
CONTEXT-AWARE SUGGESTIONS (Proactive Guidance)

${suggestions}

These suggestions are based on your recent work patterns.
Consider them as you plan your session.
</system-reminder>`);
```

### Daily Brief Integration

Monday brief already includes some context analysis. Context-aware suggestions add real-time, session-specific guidance.

### Voice Notification

When high-priority suggestions exist:
```typescript
if (highPrioritySuggestions.length > 0) {
  await sendNotification('Important Context',
    `You have ${highPrioritySuggestions.length} high-priority suggestions`);
}
```

## Example Scenarios

### Scenario 1: Failed Deployment

**Recent Work:** Deployment failed with timeout error

**Suggestion Generated:**
```
🔴 High Priority: Recent failure detected
You encountered deployment timeout yesterday.

Suggested Action: Try increasing timeout or checking network
References: 2026-02-02-deployment-attempt.md
```

### Scenario 2: Incomplete Feature

**Recent Work:** Started authentication feature, left TODO comments

**Suggestion Generated:**
```
🟡 Medium Priority: Unfinished work from recent session
You have incomplete authentication work from 2/1/2026

Context: TODO: Add password hashing, TODO: Implement refresh tokens

Suggested Action: Continue where you left off
```

### Scenario 3: Solved Before

**Current Work:** Debugging CORS issue

**Suggestion Generated:**
```
🔴 High Priority: Similar issue solved before
Your current CORS problem resembles past issue from Jan 15

References: 2026-01-15_CORS-Resolution-Learning.md

Suggested Action: Review learning for solution pattern
Matching keywords: cors, headers, preflight
```

### Scenario 4: Repeated Commands

**Pattern Detected:** Running `git status && git diff && git add .` frequently

**Suggestion Generated:**
```
🟢 Low Priority: Repeated task: git workflow
You've run this git sequence 7 times recently

Suggested Action: Create alias: alias gsa='git status && git diff && git add .'
```

## Configuration

Environment variables (optional):

```json
{
  "env": {
    "CONTEXT_ANALYSIS_DAYS": "14",
    "CONTEXT_LEARNING_DAYS": "30",
    "CONTEXT_MIN_PATTERN_COUNT": "3"
  }
}
```

## Benefits

### Prevents Wasted Effort
- Don't re-solve problems you've already solved
- Avoid repeating failed approaches
- Remember unfinished work

### Increases Productivity
- Proactive reminders about incomplete tasks
- Automation suggestions for repeated work
- Git hygiene reminders

### Builds on Past Success
- Leverages documented learnings
- Connects current work to past solutions
- Creates knowledge continuity

### Feels Like Seneca
- Proactive intelligence, not reactive
- Context-aware, not stateless
- Colleague-like suggestions

## Future Enhancements

### Planned

1. **ML-Based Relevance Scoring**
   - Smarter pattern matching
   - Better suggestion prioritization
   - Context similarity scoring

2. **Time-of-Day Patterns**
   - Morning: Focus work suggestions
   - Afternoon: Review and cleanup
   - Evening: Planning and documentation

3. **Project Context**
   - Per-project suggestion history
   - Project-specific patterns
   - Cross-project learning

4. **Collaboration Hints**
   - "John solved this last week"
   - "Team discussion about this topic"
   - "Similar PR recently merged"

### Possible

1. **Calendar Integration**
   - Deadline awareness
   - Meeting-aware suggestions
   - Time blocking recommendations

2. **External Tool Integration**
   - Jira ticket status
   - GitHub PR suggestions
   - Slack thread references

## Troubleshooting

### No Suggestions Generated

**Cause:** Limited History data

**Solution:** Use PAI more! Suggestions improve with richer History.

### Irrelevant Suggestions

**Cause:** Keyword matching too broad

**Solution:** Adjust `CONTEXT_MIN_PATTERN_COUNT` to require stronger patterns.

### Too Many Suggestions

**Cause:** Very active History

**Solution:** Reduce `CONTEXT_ANALYSIS_DAYS` to focus on more recent work.

## Related Skills

- **monday-brief** - Weekly summaries
- **daily-memory-injection** - Session continuity
- **system-health-monitor** - System state awareness

---

**Status**: Production ready
**Priority**: High value (Seneca parity feature)
**Impact**: Transforms PAI from reactive to proactive
