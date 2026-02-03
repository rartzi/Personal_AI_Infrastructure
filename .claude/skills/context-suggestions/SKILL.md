---
name: context-suggestions
description: High-value proactive intelligence based on your research, ideas, goals, and work patterns. USE WHEN user says "what should I work on", "suggestions", "what's next", "/suggestions", OR at session start for proactive guidance.
---

# Context-Aware Suggestions - High-Value Personal Intelligence

**Surfaces research threads, unfinished ideas, goals, and build opportunities.**

Evolved from Clawdbot's Seneca to focus on what actually matters:
- "Your TPU research from 6 weeks ago - worth revisiting for new developments"
- "You explored DeepSeek engrams but didn't finish - want to continue?"
- "Pattern detected: You've done 5 research tasks → Build a research skill"

## What This Skill Does

### Tier 1: Personal Intelligence

| Category | What it surfaces | Priority |
|----------|------------------|----------|
| **Research Threads** | Topics researched >2 weeks ago worth revisiting | High/Medium |
| **Unfinished Ideas** | Creative projects started but not completed | High/Medium |
| **Goal Progress** | Explicit goals extracted from sessions | Medium |

### Tier 2: Derived Intelligence (Build Opportunities)

| Trigger | What it suggests | Priority |
|---------|------------------|----------|
| **Pattern-based** | Skills for repeated actions (3+ occurrences) | Medium/High |
| **Gap-based** | Automation for multi-step manual workflows | High |
| **Ambition-based** | Deeper capabilities based on research interests | Medium |

### What's NOT in Default Output

- Git uncommitted/unpushed (use `--git` flag or `/git-status`)
- Stale branches
- Generic error detection without context

## Proactive Execution Pattern

**CRITICAL: PAI is PROACTIVE, not passive.**

When suggestions load at session start:

1. **Analyze against known goals**: Review user's stated goals from recent CAPTURE sections
2. **Rank by strategic value**: Consider:
   - Alignment with user's current focus areas
   - Impact potential (high-leverage vs busy work)
   - Time sensitivity (research updates vs automation that can wait)
   - Effort vs reward (quick wins vs long-term investments)
3. **Recommend top option**: Use AskUserQuestion to present 2-3 highest-value options
4. **Execute immediately**: Once user selects, pursue without further prompting

**Example Interaction:**

```
PAI: Based on your recent work, I recommend:

1. Automate iterative editing workflow (HIGH VALUE)
   - You've done this 27 times manually
   - Would save 10-15 minutes per occurrence
   - Aligns with your automation-first approach

2. Research revival: TPU Architecture (MEDIUM VALUE)
   - 45 days old, likely new developments
   - Connects to your AI infrastructure interests
   - Could inform future decisions

Which would you like me to pursue?
```

**NOT this:**
```
PAI: Here are your suggestions:
- Research revival: Israel-Gaza
- Automate workflow
- Research revival: TPU
- Create comparison skill

What do you want to do?
```

## Usage

### On-Demand (`/suggestions`)

```bash
# High-value suggestions (default)
bun run tools/context-analyzer.ts

# Include git status
bun run tools/context-analyzer.ts --git

# JSON output
bun run tools/context-analyzer.ts --json

# Verbose details
bun run tools/context-analyzer.ts --verbose
```

### Automatic (Session Start)

Suggestions appear automatically when you start Claude Code:
- **Context injection**: Full suggestions available to Claude
- **Proactive recommendation**: Claude analyzes and recommends highest-value options

### Evaluating Against Goals

**Where to find goals:**
- Recent CAPTURE sections in History/Sessions
- Explicit goal statements: "Goal:", "Working toward:", "Building:"
- Repeated work patterns (3+ occurrences = implicit goal to automate)
- Research depth (deep dive = strategic interest)

**Value Ranking Framework:**

| Factor | Weight | Questions |
|--------|--------|-----------|
| **Alignment** | 40% | Does this match user's stated goals or repeated interests? |
| **Impact** | 30% | High-leverage (automation, frameworks) or low-leverage (one-off tasks)? |
| **Urgency** | 20% | Time-sensitive (stale research, blocking issues) or can wait? |
| **Effort/Reward** | 10% | Quick win (90% confidence patterns) or exploratory (research)? |

### Mid-Session Nudges

Contextual connections surface when working on related topics:
- Rate limited: Max 3 nudges per session
- Threshold: Only >80% confidence matches
- Format: "💡 This connects to your [X] research from [date]"

### Monday Brief Integration

Monday mornings include enhanced suggestions:
- Research revival recommendations
- Build opportunities from derived intelligence
- Weekly focus priorities

## Example Output

```
━━━ CONTEXT SUGGESTIONS ━━━

▌ HIGH PRIORITY
  🔬 Research revival: TPU Architecture Analysis
     You researched this 45 days ago - worth revisiting for new developments
     → Check for updates or continue exploring
  🔨 Build opportunity: Automate iterative editing workflow
     You've manually executed this workflow 26 times
     → Create a tool or skill that combines these steps

▌ MEDIUM PRIORITY
  🔬 Research revival: Israel-Gaza War Status
     You researched this 46 days ago - may have new developments
     → Check for updates
  💭 Unfinished: DeepSeek Engram Exploration
     Creative thread from 4 days ago with remaining steps
     → Continue where you left off
  🔨 Build opportunity: Create comparison skill
     Pattern detected across 3 sessions
     → Create skill to standardize this workflow

💡 Type /suggestions for full details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Suggestion Categories

### 🔬 Research Threads

Extracted from: `History/Research/`, sessions with research content

**What makes a suggestion:**
- Topic researched >2 weeks ago (stale)
- Moderate or deep depth (500+ words or multiple headers)
- Has entities (companies, technologies, concepts)

**Example:**
```
Research revival: Google TPU Strategic Advantages
You researched this 45 days ago - worth revisiting for new developments

Context: Google's TPU represents a paradigm-shifting approach to AI hardware...

→ Action: Check for updates or continue exploring
```

### 💭 Unfinished Ideas

Extracted from: `scratchpad/`, sessions with WIP content

**What makes a suggestion:**
- Has explicit "next steps" section
- Status is active or stale (not abandoned)
- Created in last 60 days

**Example:**
```
Unfinished: Art Skill Improvements
Creative thread from 4 days ago with remaining steps

Context: Using Art Skill with AstraZeneca branding...

→ Action: Explore SVG stroke customization options
```

### 🎯 Goals

Extracted from: CAPTURE sections, explicit goal statements

**Patterns detected:**
- "Goal:", "Objective:", "Target:"
- "Working toward", "Building", "Creating"
- Progress indicators (%, step X of Y)

### 🔨 Build Opportunities

#### Pattern-based
- Detects repeated actions across 3+ sessions
- Suggests creating a skill to standardize the workflow

#### Gap-based
- Identifies multi-step manual workflows (Read → Edit → Read)
- Suggests automation to reduce friction

#### Ambition-based
- Matches deep research topics to missing skills
- Suggests capabilities to go deeper on interests

## Integration

### Session Start Hook

`hooks/load-context-suggestions.ts`:
- Runs context-analyzer
- Displays compact output in terminal (stderr)
- Injects full suggestions to Claude context (stdout)

### Mid-Session Hook

`hooks/mid-session-suggestions.ts`:
- Monitors for relevance matches during session
- Injects nudges when current work connects to past work
- Rate limited to 3 per session

### Monday Brief

The monday-brief skill pulls from the same extraction system:
- Research revival in "This Week's Focus"
- Build opportunities in "Suggestions"

## Configuration

Environment variables (optional):

```json
{
  "env": {
    "CONTEXT_RESEARCH_DAYS": "90",
    "CONTEXT_IDEAS_DAYS": "60",
    "CONTEXT_GOALS_DAYS": "30",
    "CONTEXT_NUDGE_THRESHOLD": "80",
    "CONTEXT_NUDGE_LIMIT": "3"
  }
}
```

## Files

| File | Purpose |
|------|---------|
| `tools/suggestion-extractor.ts` | Extracts research, ideas, goals from History |
| `tools/derived-intelligence.ts` | Analyzes patterns, gaps, ambitions |
| `tools/context-analyzer.ts` | Combines extraction + derived, formats output |
| `hooks/load-context-suggestions.ts` | Session start display and injection |
| `hooks/mid-session-suggestions.ts` | Contextual nudges during session |

## Success Stories

### Auto-Diff After Edit (2026-02-03)

**Problem:** Read→Edit→Read verification loop appeared 27x
**Solution:** PostToolUse hook that auto-displays diff after every Edit
**Impact:** Eliminates 3-step workflow, saves 6-7 minutes/day

This was the first automation built from derived intelligence suggestions, validating the proactive intelligence system.

## Philosophy

### High-Value Over Housekeeping

The old system surfaced git status and error keywords. That's noise.

The new system surfaces:
- Things you cared enough to research deeply
- Creative threads you started but didn't finish
- Goals you set for yourself
- Opportunities to build capabilities that accelerate your work

### Proactive, Not Reactive

Rather than waiting for you to ask "what should I work on?", the system:
- Analyzes suggestions against your goals at session start
- Recommends highest-value options with reasoning
- Uses AskUserQuestion for structured decision-making
- Executes immediately once you select
- Nudges when working on related topics
- Provides weekly digest on Mondays

**Key Principle:** PAI is a proactive colleague who filters, analyzes, and recommends - not a passive menu of options.

### Derived Intelligence

The most valuable suggestions aren't just reminders - they're insights:
- "You do this repeatedly → build a skill"
- "You researched this deeply → create a tracker"
- "You do these steps manually → automate them"

---

**Status**: Production ready with proactive execution pattern
**Priority**: High (core PAI intelligence feature)
**Impact**: Transforms PAI from reminder system to proactive colleague
