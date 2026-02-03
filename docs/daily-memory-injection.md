# Daily Memory Injection - Seneca-Style Session Continuity

## Overview

Daily Memory Injection brings Clawdbot's Seneca-style memory system to PAI. At every session start, PAI automatically loads recent history entries to provide immediate context continuity, eliminating the "cold start" problem where each session begins with no knowledge of previous work.

## Inspiration: Clawdbot's Seneca

This feature is inspired by Clawdbot's Seneca assistant, which uses daily memory files (`memory/YYYY-MM-DD.md`) to maintain continuity across sessions. Seneca remembers:
- Decisions made in previous sessions
- Lessons learned from failures
- Ongoing work and context
- User preferences and patterns

PAI's implementation adapts this concept to work with our existing History system.

## How It Works

### At Session Start

When you start a new Claude Code session, the `load-daily-memory.ts` hook automatically:

1. **Loads Recent Sessions** (last 2 from `History/Sessions/`)
   - Provides context about recent conversations
   - Remembers what you were working on
   - Recalls decisions and outcomes

2. **Loads Recent Learnings** (last 3 from `History/Learnings/`)
   - Lessons learned from problem-solving
   - Root cause analyses
   - Debugging insights
   - Best practices discovered

3. **Loads Today's Work** (from `History/*/YYYY-MM-DD*`)
   - Ongoing work for the current date
   - Unfinished tasks
   - Work-in-progress notes

### Hook Execution Order

```
SessionStart Event
    ↓
1. load-core-context.ts    → CORE skill (identity, preferences, principles)
    ↓
2. load-daily-memory.ts    → Recent history (sessions, learnings, today)  ← NEW
    ↓
3. initialize-session.ts   → Voice notification, tab title
    ↓
4. capture-all-events.ts   → Event logging
```

### Memory Extraction

The hook intelligently extracts summaries from history files:
- Searches for `## Summary` or `SUMMARY:` sections
- Falls back to first paragraph if no summary exists
- Limits to 800 characters to prevent context overflow
- Preserves formatting and structure

### Output Format

The hook injects a `<system-reminder>` block into the session:

```
<system-reminder>
DAILY MEMORY INJECTION (Auto-loaded at Session Start)

### Recent Sessions
**2026-02-02-SESSION.md** (2/2/2026):
[Summary of session]

### Recent Learnings
**2026-01-21-Learning.md** (1/21/2026):
[Summary of learning]

### Today's Work
**2026-02-03-Feature.md**:
[Summary of today's work]
</system-reminder>
```

## Implementation Details

### File: `.claude/hooks/load-daily-memory.ts`

**Key Features:**
- Recursive directory walking to find recent files
- Intelligent summary extraction with multiple patterns
- Date-based file filtering for "today's work"
- Graceful degradation (skips if History/ doesn't exist)
- Subagent detection (skips for subagent sessions)

**Performance:**
- Fast directory scanning using mtime sorting
- Limited to 2+3+N files (typically 5-10 total)
- Summary extraction capped at 800 chars per file
- Total context injection: ~2-5KB per session

### Configuration: `.claude/settings.json`

```json
"SessionStart": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "${PAI_DIR}/hooks/load-core-context.ts"
      },
      {
        "type": "command",
        "command": "${PAI_DIR}/hooks/load-daily-memory.ts"
      },
      {
        "type": "command",
        "command": "${PAI_DIR}/hooks/initialize-session.ts"
      }
    ]
  }
]
```

## Benefits

### 1. **Session Continuity**
No more "what were we working on yesterday?" - PAI remembers automatically.

### 2. **Reduced Repetition**
PAI doesn't ask questions you already answered in recent sessions.

### 3. **Context Preservation**
Decisions, preferences, and lessons learned persist across sessions.

### 4. **Faster Onboarding**
New sessions start with immediate awareness of recent work.

### 5. **Natural Conversation Flow**
References like "that bug we debugged yesterday" work without explanation.

## Example: Before vs After

### Before Daily Memory Injection

```
User: Let's continue working on the authentication feature
PAI: What authentication feature? Can you provide more context?
User: The one we designed yesterday with JWT tokens
PAI: I don't have context from previous sessions. Can you share the design?
```

### After Daily Memory Injection

```
User: Let's continue working on the authentication feature
PAI: Checking recent history...

     From yesterday's session, I see we designed JWT-based auth with:
     - Access tokens (15 min expiry)
     - Refresh tokens (7 day expiry)
     - HTTP-only cookies for storage

     Ready to implement. Should we start with the token generation logic?
```

## Testing

### Manual Test

Run the hook directly to see output:

```bash
PAI_DIR="${HOME}/Personal_AI_Infrastructure/.claude" \
  .claude/hooks/load-daily-memory.ts
```

Expected output:
```
🧠 Loading recent History for session continuity...
✅ Loaded N recent history entries
<system-reminder>
DAILY MEMORY INJECTION (Auto-loaded at Session Start)
...
</system-reminder>
✅ Daily memory injected into session
```

### Integration Test

Start a new Claude Code session and verify:
1. Session starts without errors
2. Voice notification says "PAI here, ready to go"
3. Tab title shows "PAI Ready"
4. When asked about recent work, PAI has context

### Debug

If memory isn't loading:

```bash
# Check History directory exists
ls -la ~/.claude/History/Sessions/
ls -la ~/.claude/History/Learnings/

# Check hook is executable
ls -la .claude/hooks/load-daily-memory.ts

# Check settings.json configuration
grep -A 10 "SessionStart" .claude/settings.json

# Run hook manually with debug
PAI_DIR="$(pwd)/.claude" .claude/hooks/load-daily-memory.ts 2>&1
```

## Comparison to Clawdbot's Seneca

| Feature | Seneca (Clawdbot) | PAI Daily Memory |
|---------|-------------------|------------------|
| **Memory Storage** | `memory/YYYY-MM-DD.md` (daily files) | `History/Sessions/`, `History/Learnings/` (organized by date) |
| **Memory Injection** | Reads today + yesterday on session start | Reads last 2 sessions + last 3 learnings + today |
| **Multi-Surface** | Same session across Telegram/WhatsApp/Mac | CLI-based (single surface) |
| **Memory Format** | Manual markdown entries | Automatic captures from hooks |
| **Context Window** | Full files injected | Summaries extracted (800 chars max) |
| **Continuity Model** | Persistent session across surfaces | Per-CLI-session with history injection |

## Future Enhancements

### Planned

1. **Smart Context Selection**
   - ML-based relevance scoring for history entries
   - Load only most relevant context, not just most recent

2. **Memory Summarization**
   - Use Claude to generate daily/weekly summaries
   - Compress old history for long-term memory

3. **User-Controlled Memory**
   - CLI commands to add explicit memory entries
   - `pai remember "preference or decision"`

4. **Memory Pruning**
   - Automatic cleanup of outdated context
   - Archive old sessions after N days

5. **Cross-Session State**
   - Persistent TODO lists
   - Ongoing project context files
   - Long-term preferences (separate from daily memory)

### Possible

1. **Multi-Surface Support** (like Seneca)
   - Telegram bot integration
   - WhatsApp interface
   - Shared session state across surfaces

2. **Voice Interface** (like Seneca)
   - Wake word detection
   - Voice input/output
   - Always-on assistant mode

## Related Documentation

- `.claude/skills/CORE/HistorySystem.md` - Overall History system architecture
- `.claude/skills/CORE/HookSystem.md` - Hook system documentation
- `.claude/hooks/load-core-context.ts` - CORE skill loading
- `docs/clawdbot-seneca-inspiration.md` - Original Clawdbot article analysis

## Credits

- **Inspired by**: Clawdbot's Seneca assistant by Peter Steinberger
- **Implementation**: PAI Daily Memory Injection
- **Article**: [My Personal AI Assistant Lives Everywhere: Building with Clawdbot](https://ai.rundatarun.io/Practical+Applications/my-personal-ai-assistant-clawdbot-seneca)

---

**Last Updated**: 2026-02-03
**Version**: 1.0.0
**Status**: Production Ready
