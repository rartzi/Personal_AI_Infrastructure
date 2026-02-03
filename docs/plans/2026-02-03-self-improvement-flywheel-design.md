# Self-Improvement Flywheel - Architecture Design

**Date:** 2026-02-03
**Status:** Approved for implementation
**Author:** PAI + User brainstorming session

## Executive Summary

This document describes PAI's self-improvement flywheel - an automated system that generates research ideas, builds tools from usage patterns, verifies their effectiveness, and creates new improvement ideas from that learning. The flywheel accelerates over time through meta-learning that tunes suggestion quality based on outcomes.

**Core cycle:** Generate ideas → Build tools → Verify effectiveness → Learn → Generate better ideas

## Design Decisions

### Verification Approach: Automated Metrics
- Track usage frequency (how often tools are called)
- Measure time saved (reported by tools with rich context)
- Count errors prevented (quality improvements)
- Objective, data-driven feedback into intelligence system

### Feedback Strategies: Multi-Layered Learning
1. **Pattern extrapolation** - Success with workflow X → find similar workflows to automate
2. **Capability building** - Tool X works well → what adjacent capabilities would enhance it?
3. **Meta-learning** - Tool X succeeded because of properties P, Q, R → prioritize future ideas with those properties

All three strategies work together for comprehensive improvement.

### Instrumentation: Hybrid Approach
- **Automatic baseline** - PostToolUse hook logs all tool invocations transparently
- **Optional richness** - Tools can add custom metrics where valuable
- Zero maintenance burden, evolutionary sophistication

### Execution Cadence: Threshold-Based
Three-tier surfacing matched to urgency:
- **Urgent (90%+ confidence)** - 5+ same-day occurrences → mid-session interrupt
- **High priority (80%+ confidence)** - 10+ same-week occurrences → next session start
- **Strategic (70%+ confidence)** - 20+ monthly occurrences → Monday brief

Balances immediate action on high-value patterns with comprehensive strategic review.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER WORKS IN PAI                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  METRIC COLLECTION     │
         │  - PostToolUse hook    │
         │  - Auto JSONL logging  │
         │  - Optional rich data  │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │  ANALYSIS ENGINE       │
         │  - Daily aggregation   │
         │  - Pattern detection   │
         │  - Threshold monitor   │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │  INTELLIGENCE DB       │
         │  - Daily summaries     │
         │  - Derived suggestions │
         │  - Meta-learnings      │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │  SURFACING LAYER       │
         │  - Urgent: Mid-session │
         │  - High: Session start │
         │  - Strategic: Monday   │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │  USER ACTS             │
         │  - Accepts suggestion  │
         │  - Builds automation   │
         │  - Or defers/rejects   │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │  OUTCOME TRACKING      │
         │  - Log decision        │
         │  - Track tool usage    │
         │  - Measure impact      │
         └────────┬───────────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │  META-LEARNING         │
         │  - Tune confidence     │
         │  - Refine thresholds   │
         │  - Improve suggestions │
         └────────┬───────────────┘
                  │
                  └──────────► FEEDS BACK TO ANALYSIS ENGINE
                              (Flywheel accelerates)
```

## Layer 1: Metric Collection

### Directory Structure

```
.claude/
  metrics/
    YYYY-MM/
      tool-usage.jsonl       # Automatic hook tracking
      manual-metrics.jsonl   # Rich instrumentation
      daily-summaries/       # Aggregated data
        YYYY-MM-DD.json
    learnings/
      suggestion-outcomes.jsonl  # What got built, did it work?
    config.json              # Thresholds, meta-learning params
    alert-state.json         # Mid-session alert dedup
```

### Automatic Tracking (PostToolUse Hook)

Modify `.claude/hooks/post-tool-use.ts`:

```typescript
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export async function postToolUse(context) {
  const { tool, args, duration, sessionId } = context;

  // Log to metrics
  const now = new Date();
  const monthDir = join(process.env.HOME!, '.claude/metrics',
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  if (!existsSync(monthDir)) {
    mkdirSync(monthDir, { recursive: true });
  }

  const logEntry = {
    timestamp: now.toISOString(),
    tool,
    duration,
    sessionId,
    context: {
      fileCount: tool === 'Read' || tool === 'Edit' ? 1 : 0,
      commandType: tool === 'Bash' ? args.command?.split(' ')[0] : null
    }
  };

  appendFileSync(
    join(monthDir, 'tool-usage.jsonl'),
    JSON.stringify(logEntry) + '\n'
  );

  // Existing hook behavior continues...
}
```

**Performance:** <1ms overhead per tool call, append-only JSONL

### Manual Rich Metrics

Create `tools/metric-logger.ts`:

```typescript
export interface MetricEntry {
  timestamp: string;
  source: string;        // 'auto-diff-hook', 'research-skill', etc.
  metric: string;        // 'verification-saved', 'time-saved', 'errors-prevented'
  value: number | string;
  metadata?: Record<string, any>;
}

export function logMetric(
  source: string,
  metric: string,
  value: number | string,
  metadata?: Record<string, any>
) {
  const now = new Date();
  const monthDir = join(process.env.HOME!, '.claude/metrics',
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  if (!existsSync(monthDir)) {
    mkdirSync(monthDir, { recursive: true });
  }

  const entry: MetricEntry = {
    timestamp: now.toISOString(),
    source,
    metric,
    value,
    metadata
  };

  appendFileSync(
    join(monthDir, 'manual-metrics.jsonl'),
    JSON.stringify(entry) + '\n'
  );
}
```

**Usage example:**
```typescript
// In auto-diff-after-edit hook
logMetric('auto-diff-hook', 'verification-saved', 1, {
  file: filePath,
  linesChanged: diff.length
});
```

### Outcome Tracking

```typescript
export function logSuggestionOutcome(
  suggestionId: string,
  action: 'accepted' | 'rejected' | 'deferred',
  outcome?: {
    built: boolean;
    usageCount?: number;
    userFeedback?: string;
  }
) {
  const entry = {
    timestamp: new Date().toISOString(),
    suggestionId,
    action,
    outcome
  };

  appendFileSync(
    join(process.env.HOME!, '.claude/metrics/learnings/suggestion-outcomes.jsonl'),
    JSON.stringify(entry) + '\n'
  );
}
```

## Layer 2: Analysis Engine

### Metric Aggregator

Create `tools/metric-aggregator.ts` that produces daily summaries:

```typescript
interface DailySummary {
  date: string;
  toolUsage: Record<string, number>;      // tool name -> count
  totalToolCalls: number;
  sessionCount: number;

  timeEstimates: {
    saved: number;      // minutes
    sources: string[];
  };

  verificationsSaved: number;
  errorsPrevented: number;

  sameToolSequences: Array<{
    pattern: string;     // "Read->Edit->Read"
    count: number;
    confidence: number;
  }>;

  highFrequencyTools: Array<{
    tool: string;
    count: number;
    avgPerSession: number;
  }>;
}

export function aggregateDay(date: Date): DailySummary;
export function aggregatePeriod(days: number = 7): DailySummary[];
```

**Runs:** End of day (23:30 scheduled) or on-demand

### Enhanced Pattern Detector

Extend existing `tools/derived-intelligence.ts`:

```typescript
export function analyzePatternsFromMetrics(summaries: DailySummary[]): DerivedSuggestion[] {
  // Analyze repeated sequences (gap-based suggestions)
  // Analyze high-frequency tools (capability-building suggestions)
  // Apply meta-learning confidence adjustments
}
```

### Meta-Learner

Create `tools/meta-learner.ts`:

```typescript
interface MetaLearningRecord {
  suggestionType: 'pattern' | 'gap' | 'ambition';
  confidence: number;
  wasActedOn: boolean;
  outcome?: {
    built: boolean;
    usageCount: number;
  };
  properties: {
    frequency?: number;
    complexity?: 'low' | 'medium' | 'high';
  };
}

export function analyzeMetaLearnings(): {
  confidenceAdjustments: Record<string, number>;
  successPatterns: string[];
  insights: string[];
}
```

**Learns:**
- Do gap-based or pattern-based suggestions work better?
- What occurrence frequency correlates with high tool usage?
- Which suggestion properties predict success?

**Tunes:**
- Confidence scores based on historical accuracy
- Thresholds to reduce false positives
- Suggestion prioritization

### Threshold Monitor

Create `tools/threshold-monitor.ts`:

```typescript
export interface ThresholdAlert {
  priority: 'urgent' | 'high' | 'strategic';
  pattern: string;
  count: number;
  confidence: number;
  suggestion: string;
  estimatedSavings?: string;
}

export function checkThresholds(): ThresholdAlert[] {
  // Check same-day patterns (urgent)
  // Check weekly patterns (high)
  // Check monthly patterns (strategic)
}
```

**Thresholds:**
- Urgent: 5+ same-day, 90%+ confidence OR 15+ same-week, 95%+ confidence
- High: 3+ same-day, 80%+ confidence OR 10+ same-week, 85%+ confidence
- Strategic: 20+ monthly, 70%+ confidence

## Layer 3: Surfacing

### Mid-Session Nudges (Urgent)

Create `hooks/threshold-alert.ts`:

```typescript
export async function checkForUrgentPatterns() {
  const alerts = checkThresholds();
  const urgentAlerts = alerts.filter(a => a.priority === 'urgent');

  // Deduplicate (don't alert same pattern twice per day)
  const newAlerts = filterNewAlerts(urgentAlerts);

  if (newAlerts.length > 0) {
    const topAlert = newAlerts[0];

    console.error('\n' + '━'.repeat(60));
    console.error('🔥 FLYWHEEL ALERT - High-Value Automation Opportunity');
    console.error('━'.repeat(60));
    console.error(`\n${topAlert.suggestion}`);
    console.error(`Pattern: ${topAlert.pattern}`);
    console.error(`Occurrences: ${topAlert.count}`);
    console.error(`Confidence: ${topAlert.confidence}%`);
    console.error('━'.repeat(60) + '\n');

    return { type: 'flywheel_urgent_alert', alert: topAlert };
  }
}

// Run every 30 minutes during session
setInterval(checkForUrgentPatterns, 30 * 60 * 1000);
```

### Session Start Enhancement

Enhance `hooks/load-context-suggestions.ts`:

```typescript
import { checkThresholds } from '../tools/threshold-monitor';
import { aggregatePeriod } from '../tools/metric-aggregator';
import { analyzePatternsFromMetrics } from '../tools/derived-intelligence';

// Load existing suggestions
const existingSuggestions = loadContextSuggestions();

// Add metric-driven suggestions
const alerts = checkThresholds();
const highPriorityAlerts = alerts.filter(a => a.priority === 'high');
const weeklySummaries = aggregatePeriod(7);
const metricPatterns = analyzePatternsFromMetrics(weeklySummaries);

// Combine and output to Claude's context
const combinedSuggestions = {
  ...existingSuggestions,
  metricDriven: {
    alerts: highPriorityAlerts,
    patterns: metricPatterns
  }
};
```

### Monday Brief Integration

Enhance `.claude/skills/monday-brief/SKILL.md`:

```typescript
import { aggregatePeriod } from '../../tools/metric-aggregator';
import { analyzePatternsFromMetrics } from '../../tools/derived-intelligence';
import { analyzeMetaLearnings } from '../../tools/meta-learner';

// Generate weekly metrics section
const weeklySummaries = aggregatePeriod(7);
const metricSection = generateMetricSection(weeklySummaries);
const learningSection = generateLearningSection(analyzeMetaLearnings());

// Add to Monday brief
```

### Proactive Action Pattern

When surfacing suggestions, PAI:
1. Ranks by strategic value (alignment, impact, urgency, effort/reward)
2. Presents top 2-3 options via AskUserQuestion
3. Leads with recommendation and reasoning
4. Executes immediately once user selects

```typescript
const ranked = rankByStrategicValue(alerts, userGoals);

await AskUserQuestion({
  questions: [{
    question: "High-value automation opportunities detected. Which should I pursue?",
    header: "Flywheel",
    options: ranked.map(alert => ({
      label: alert.pattern,
      description: `${alert.suggestion} | ${alert.confidence}% | ${alert.estimatedSavings}`
    }))
  }]
});
```

## Configuration

`.claude/metrics/config.json`:

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
  },
  "alerting": {
    "maxPerDay": 2,
    "cooldownMinutes": 120,
    "enableMidSessionNudges": true
  },
  "metaLearning": {
    "enabled": true,
    "minSamplesForLearning": 5,
    "confidenceAdjustmentRange": [-10, 15]
  },
  "aggregation": {
    "dailySchedule": "23:30",
    "weeklySchedule": "Sunday 23:00"
  }
}
```

## Example Scenarios

### Scenario 1: Auto-diff After Edit (Success Pattern)

**Day 1-3:** User does Read→Edit→Read verification loop
- PostToolUse logs each call automatically
- Pattern appears 12 times across 3 days
- Below threshold (need 15 for urgent), continues monitoring

**Day 4:** Pattern hits 17 occurrences
- Threshold monitor detects urgent pattern
- Mid-session nudge: "🔥 Read→Edit→Read appeared 17 times this week. Confidence: 95%. Create automation?"
- User accepts via AskUserQuestion
- PAI builds auto-diff-after-edit hook

**Post-build:**
- Hook uses `logMetric('auto-diff-hook', 'verification-saved', 1)` after each edit
- After 2 weeks: 27 verifications saved
- `logSuggestionOutcome` captures success
- Meta-learner notes: "gap-based, 17 occurrences, 95% confidence → high usage"

**Week 4:** Meta-learning kicks in
- Future gap-based suggestions get +10 confidence boost
- Threshold lowered from 15 to 12 for gap patterns
- Flywheel accelerates - catches patterns earlier

### Scenario 2: Research Skill Pattern (Pattern Extrapolation)

**Week 1-2:** User does 8 research tasks via Task tool
- Metrics: Task tool called 45 times
- Manual metrics: `logMetric('research', 'time-saved', 60, {sources: 8})`
- Pattern detector: research is high-frequency activity

**Monday Brief:**
- "Task tool used 45 times (7.5/session) for research. Build opportunity: Create dedicated research skill"
- User defers (Research skill already exists)
- Outcome logged as 'rejected'

**Meta-learning:**
- "Ambition-based suggestion rejected (skill exists)"
- Refines detection: check existing skills before suggesting
- Future suggestions filtered against existing capabilities

### Scenario 3: Capability Building (Enhancement)

**Month 1:** Context-suggestions skill working well
- Metrics: accessed 12x/week
- High usage triggers capability-building analysis

**Pattern detector:**
- "Context-suggestions has high usage (12x/week)"
- "Adjacent capabilities: mid-session nudges, priority ranking"
- Suggestion: "Enhance context-suggestions with real-time nudges"
- Surfaced at next session start (high priority)

**User acts:**
- Accepts suggestion
- Builds mid-session-suggestions.ts hook
- Successful tool → enhancement opportunity → more value

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Implement PostToolUse metric logging
- [ ] Create metric-logger.ts utility
- [ ] Set up .claude/metrics/ directory structure
- [ ] Test: Verify metrics capture during normal session

### Phase 2: Aggregation (Week 1-2)
- [ ] Build metric-aggregator.ts
- [ ] Implement daily summary generation
- [ ] Create scheduled aggregation
- [ ] Test: Generate summaries for last 7 days

### Phase 3: Analysis (Week 2-3)
- [ ] Enhance derived-intelligence.ts with metric input
- [ ] Build threshold-monitor.ts
- [ ] Implement pattern detection from summaries
- [ ] Test: Detect known patterns

### Phase 4: Surfacing (Week 3-4)
- [ ] Create threshold-alert.ts hook (mid-session)
- [ ] Enhance load-context-suggestions.ts (session start)
- [ ] Integrate with monday-brief skill
- [ ] Test: Verify three-tier surfacing

### Phase 5: Feedback Loop (Week 4-5)
- [ ] Implement suggestion outcome tracking
- [ ] Build meta-learner.ts
- [ ] Wire outcomes back to confidence tuning
- [ ] Test: Track suggestion → action → outcome

### Phase 6: Refinement (Week 5+)
- [ ] Tune thresholds based on real usage
- [ ] Add rich instrumentation to existing tools
- [ ] Enhance meta-learning algorithms
- [ ] Monitor flywheel effectiveness metrics

## Success Metrics

**Track these to verify the flywheel works:**

- **Suggestion quality**: >60% acceptance rate, minimize false positives
- **Tool effectiveness**: 10+ uses/week average for built tools
- **Flywheel acceleration**: Decreasing pattern detection time over months
- **Meta-learning**: Improving confidence calibration month-over-month

## Key Files

```
.claude/
  metrics/
    YYYY-MM/
      tool-usage.jsonl           # Automatic hook tracking
      manual-metrics.jsonl       # Rich instrumentation
      daily-summaries/YYYY-MM-DD.json
    learnings/
      suggestion-outcomes.jsonl  # Feedback loop data
    config.json                  # Thresholds & settings
    alert-state.json            # Mid-session dedup

  hooks/
    post-tool-use.ts            # ENHANCED: Logs metrics
    threshold-alert.ts          # NEW: Mid-session nudges
    load-context-suggestions.ts # ENHANCED: Metric-driven

  tools/
    metric-logger.ts            # NEW: Manual instrumentation
    metric-aggregator.ts        # NEW: Daily summaries
    threshold-monitor.ts        # NEW: Pattern detection
    meta-learner.ts            # NEW: Outcome analysis
    suggestion-extractor.ts     # EXISTING
    derived-intelligence.ts     # ENHANCED: Metric input
    context-analyzer.ts         # ENHANCED: Flywheel data
```

## The Complete Flywheel

1. **Generate Ideas**
   - Existing: Research threads, unfinished ideas, goals
   - NEW: Patterns from metric aggregation

2. **Build Tools**
   - User acts on high-confidence suggestions
   - Tools/hooks/skills created with instrumentation

3. **Verify Effectiveness**
   - Automatic usage tracking via PostToolUse
   - Optional rich metrics (time saved, errors prevented)
   - Aggregated into daily summaries

4. **Generate New Ideas** (Flywheel closes)
   - Pattern extrapolation: "Tool X works → find similar"
   - Capability building: "Tool X succeeds → enhance it"
   - Meta-learning: "Tool X properties → prioritize similar"

5. **Accelerate**
   - Confidence scores improve via meta-learning
   - Thresholds tune to reduce noise
   - Detection happens faster
   - PAI becomes proactively intelligent

---

**Status:** Ready for Phase 1 implementation
**Branch:** feature/self-improvement-flywheel
**Next:** Implement PostToolUse metric logging and metric-logger utility
