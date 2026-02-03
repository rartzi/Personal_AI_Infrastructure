# Flywheel Prediction Layer - Phase 3.5 Architecture

**Date:** 2026-02-03
**Status:** Design - Ready for Implementation
**Author:** PAI + User collaborative design
**Extends:** Self-Improvement Flywheel (2026-02-03-self-improvement-flywheel-design.md)

## Executive Summary

This document extends the self-improvement flywheel with a **Prediction Layer** that makes it truly forward-thinking. Instead of only reacting to observed patterns, the flywheel will:

1. **Predict future needs** from goals and trajectory
2. **Suggest tools proactively** before patterns emerge (with approval)
3. **Monitor tool health** and auto-deprecate unused capabilities
4. **Analyze opportunity costs** and flag misaligned work
5. **Forecast bottlenecks** before they become painful

**Core Principle:** Build what you'll need next week, not what you needed last week.

---

## The Problem

### Current Flywheel is Reactive

**What it does well:**
- Detects patterns after 5-20 occurrences
- Scores patterns with telos alignment
- Learns from outcomes via meta-learning

**What it misses:**
- **Late intervention:** By the time you've done something 15 times, the pain is already real
- **Goal blindness:** Extracts goals but doesn't use them to predict needs
- **No trajectory analysis:** Can't see "Edit calls increasing 2x per week → will bottleneck soon"
- **Tool accumulation:** Builds tools but never cleans up unused ones
- **Opportunity cost invisibility:** Doesn't flag misaligned work (spending time on non-builder tasks)

### Example: Late Detection

```
Week 1: User deploys manually 2 times
Week 2: User deploys manually 5 times (trend accelerating)
Week 3: User deploys manually 12 times (pain increasing)
Week 4: User deploys manually 23 times → THRESHOLD HIT → suggests automation

PROBLEM: User suffered through 42 manual deployments before getting help.

BETTER: Detect trend in Week 2, predict Week 4 pain, offer to build NOW.
```

---

## Solution: Phase 3.5 Prediction Layer

Insert new phase between **Phase 3 (Analyze)** and **Phase 4 (Surface)**:

```
Phase 1: Collect Metrics
   ↓
Phase 2: Aggregate Data
   ↓
Phase 3: Analyze Patterns (existing - reactive detection)
   ↓
Phase 3.5: PREDICT Future Needs (NEW - proactive prediction)
   ├─ Goal-based prediction: "Your goals imply you'll need X"
   ├─ Trajectory forecasting: "X is accelerating → will bottleneck in 2 weeks"
   ├─ Tool health monitoring: "Tool Y unused for 21 days → deprecate?"
   ├─ Opportunity cost analysis: "Spending 40% on research but 95% builder"
   └─ Speculative suggestions: "Build X now before you need it? (80% confidence)"
   ↓
Phase 4: Surface Insights (enhanced with predictions)
   ↓
Phase 5: Act & Build
```

---

## Architecture Components

### Component 1: Goal-Based Predictor

**Purpose:** Map goals to predicted capability needs

**Input:**
- Telos profile with recent goals
- Current tool inventory
- Domain knowledge of goal → capability mappings

**Output:**
```typescript
interface GoalPrediction {
  goal: string;
  predictedNeeds: Array<{
    capability: string;
    reasoning: string;
    confidence: number;  // 0-100
    timeframe: 'immediate' | '1-2 weeks' | '1 month' | '3+ months';
    exists: boolean;  // Does this tool already exist?
  }>;
}
```

**Logic:**
```typescript
// tools/goal-predictor.ts
export function predictFromGoals(telos: TelosProfile): GoalPrediction[] {
  const predictions: GoalPrediction[] = [];

  for (const goalEntry of telos.recentGoals) {
    const goal = goalEntry.goal.toLowerCase();
    const needs: GoalPrediction['predictedNeeds'] = [];

    // Pattern matching for common goal types
    if (goal.includes('democratize') || goal.includes('open source')) {
      needs.push({
        capability: 'Documentation Generator',
        reasoning: 'Democratization requires excellent docs for adoption',
        confidence: 85,
        timeframe: '1-2 weeks',
        exists: checkToolExists('documentation-generator')
      });

      needs.push({
        capability: 'Example Repository Builder',
        reasoning: 'Users need working examples to get started',
        confidence: 80,
        timeframe: '1 month',
        exists: checkToolExists('example-builder')
      });

      needs.push({
        capability: 'One-Click Deployment',
        reasoning: 'Lower barrier to entry for non-technical users',
        confidence: 90,
        timeframe: 'immediate',
        exists: checkToolExists('deployment-automation')
      });
    }

    if (goal.includes('build') || goal.includes('create')) {
      needs.push({
        capability: 'Boilerplate Generator',
        reasoning: 'Builders need fast project scaffolding',
        confidence: 75,
        timeframe: '1-2 weeks',
        exists: checkToolExists('boilerplate-generator')
      });

      needs.push({
        capability: 'Testing Automation',
        reasoning: 'Quality matters for sustainable building',
        confidence: 70,
        timeframe: '1 month',
        exists: checkToolExists('test-automation')
      });
    }

    if (goal.includes('research') || goal.includes('learn')) {
      needs.push({
        capability: 'Knowledge Extraction Pipeline',
        reasoning: 'Systematic research requires structured extraction',
        confidence: 85,
        timeframe: 'immediate',
        exists: checkToolExists('research-pipeline')
      });
    }

    // Filter to only missing capabilities with high confidence
    const missingHighConfidence = needs.filter(n => !n.exists && n.confidence >= 70);

    if (missingHighConfidence.length > 0) {
      predictions.push({
        goal: goalEntry.goal,
        predictedNeeds: missingHighConfidence
      });
    }
  }

  return predictions;
}

function checkToolExists(toolId: string): boolean {
  // Check if tool/skill/hook already exists
  const skillsDir = join(PAI_DIR, 'skills');
  const toolsDir = join(PAI_DIR, 'tools');
  const hooksDir = join(PAI_DIR, 'hooks');

  // Simple check - can be enhanced with registry
  const patterns = [
    join(skillsDir, `**/*${toolId}*`),
    join(toolsDir, `${toolId}.ts`),
    join(hooksDir, `${toolId}.ts`)
  ];

  for (const pattern of patterns) {
    if (glob.sync(pattern).length > 0) return true;
  }

  return false;
}
```

**Example Output:**
```json
{
  "goal": "Democratize AI for non-technical users",
  "predictedNeeds": [
    {
      "capability": "One-Click Deployment",
      "reasoning": "Lower barrier to entry for non-technical users",
      "confidence": 90,
      "timeframe": "immediate",
      "exists": false
    },
    {
      "capability": "Documentation Generator",
      "reasoning": "Democratization requires excellent docs for adoption",
      "confidence": 85,
      "timeframe": "1-2 weeks",
      "exists": false
    }
  ]
}
```

---

### Component 2: Trajectory Forecaster

**Purpose:** Detect accelerating patterns and predict bottlenecks

**Input:**
- Last 4 weeks of tool usage data
- Pattern detection results

**Output:**
```typescript
interface TrajectoryForecast {
  pattern: string;
  currentUsage: number[];  // Last 4 weeks
  trend: 'accelerating' | 'stable' | 'declining';
  projectedUsage: number;  // Next week prediction
  bottleneckRisk: number;  // 0-100
  recommendation: 'build_now' | 'monitor' | 'defer';
  reasoning: string;
}
```

**Logic:**
```typescript
// tools/trajectory-forecaster.ts
export function forecastTrajectories(summaries: DailySummary[]): TrajectoryForecast[] {
  const forecasts: TrajectoryForecast[] = [];

  // Group by week
  const weeklyData = groupByWeek(summaries);

  // Analyze each pattern
  const patterns = extractPatterns(weeklyData);

  for (const pattern of patterns) {
    const weeklyUsage = pattern.usageByWeek; // [week1, week2, week3, week4]

    // Calculate trend using linear regression
    const trend = calculateTrend(weeklyUsage);
    const projection = projectNextWeek(weeklyUsage, trend);

    // Determine if intervention needed
    const currentWeek = weeklyUsage[weeklyUsage.length - 1];
    const bottleneckRisk = assessBottleneckRisk(weeklyUsage, projection);

    let recommendation: TrajectoryForecast['recommendation'];
    let reasoning: string;

    if (trend === 'accelerating' && bottleneckRisk > 70) {
      recommendation = 'build_now';
      reasoning = `Usage growing ${trend.slope.toFixed(1)}x per week. Projected to hit ${projection} next week (current threshold: 15). Build now to prevent pain.`;
    } else if (trend === 'accelerating' && bottleneckRisk > 40) {
      recommendation = 'monitor';
      reasoning = `Moderate growth trend. Will likely hit threshold in 2-3 weeks. Keep monitoring.`;
    } else {
      recommendation = 'defer';
      reasoning = `Stable or declining usage. Not a priority.`;
    }

    forecasts.push({
      pattern: pattern.name,
      currentUsage: weeklyUsage,
      trend: trend.direction,
      projectedUsage: projection,
      bottleneckRisk,
      recommendation,
      reasoning
    });
  }

  return forecasts.filter(f => f.recommendation !== 'defer');
}

function calculateTrend(weeklyUsage: number[]): { direction: 'accelerating' | 'stable' | 'declining', slope: number } {
  // Simple linear regression
  const n = weeklyUsage.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = weeklyUsage;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  if (slope > 2) return { direction: 'accelerating', slope };
  if (slope < -2) return { direction: 'declining', slope };
  return { direction: 'stable', slope };
}

function projectNextWeek(weeklyUsage: number[], trend: ReturnType<typeof calculateTrend>): number {
  const lastWeek = weeklyUsage[weeklyUsage.length - 1];
  return Math.max(0, Math.round(lastWeek + trend.slope));
}

function assessBottleneckRisk(weeklyUsage: number[], projection: number): number {
  // Risk based on:
  // 1. Absolute projected volume
  // 2. Growth rate
  // 3. Proximity to pain threshold (15+ = high pain)

  const currentWeek = weeklyUsage[weeklyUsage.length - 1];
  const growthRate = weeklyUsage.length > 1 ? currentWeek / weeklyUsage[0] : 1;

  let risk = 0;

  // Volume risk
  if (projection > 20) risk += 40;
  else if (projection > 15) risk += 30;
  else if (projection > 10) risk += 20;

  // Growth rate risk
  if (growthRate > 3) risk += 30;
  else if (growthRate > 2) risk += 20;

  // Acceleration risk
  if (weeklyUsage.length >= 3) {
    const recent = weeklyUsage.slice(-2);
    const older = weeklyUsage.slice(0, -2);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    if (recentAvg > olderAvg * 2) risk += 30;
  }

  return Math.min(100, risk);
}
```

**Example Output:**
```json
{
  "pattern": "Bash→git→commit",
  "currentUsage": [2, 5, 12, 23],
  "trend": "accelerating",
  "projectedUsage": 38,
  "bottleneckRisk": 85,
  "recommendation": "build_now",
  "reasoning": "Usage growing 7.0x per week. Projected to hit 38 next week (current threshold: 15). Build now to prevent pain."
}
```

---

### Component 3: Tool Health Monitor

**Purpose:** Track tool usage and flag unused capabilities for deprecation

**Input:**
- Inventory of all custom tools/hooks/skills
- Usage metrics for last 30 days

**Output:**
```typescript
interface ToolHealthReport {
  toolName: string;
  toolType: 'skill' | 'hook' | 'tool' | 'command';
  created: Date;
  lastUsed: Date | null;
  usagePattern: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  totalUses: number;
  decayScore: number;  // 0-100 (100 = fully deprecated)
  status: 'active' | 'declining' | 'deprecated' | 'zombie';
  recommendation: string;
}
```

**Logic:**
```typescript
// tools/tool-health-monitor.ts
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

export function monitorToolHealth(): ToolHealthReport[] {
  const reports: ToolHealthReport[] = [];

  // Discover all custom tools
  const tools = discoverCustomTools();

  // Get usage data for last 30 days
  const usageData = loadUsageMetrics(30);

  for (const tool of tools) {
    const usage = getToolUsage(tool.name, usageData);
    const decayScore = calculateDecayScore(usage, tool.created);
    const status = determineStatus(decayScore, usage);

    reports.push({
      toolName: tool.name,
      toolType: tool.type,
      created: tool.created,
      lastUsed: usage.lastUsed,
      usagePattern: usage.weekly,
      totalUses: usage.total,
      decayScore,
      status,
      recommendation: generateRecommendation(status, decayScore, usage, tool)
    });
  }

  // Sort by decay score (most deprecated first)
  return reports.sort((a, b) => b.decayScore - a.decayScore);
}

interface CustomTool {
  name: string;
  type: 'skill' | 'hook' | 'tool' | 'command';
  path: string;
  created: Date;
}

function discoverCustomTools(): CustomTool[] {
  const tools: CustomTool[] = [];

  // Scan skills directory
  const skillsDir = join(PAI_DIR, 'skills');
  if (existsSync(skillsDir)) {
    const skills = readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .filter(d => !['CORE', 'Art', 'Fabric'].includes(d.name)); // Exclude system skills

    for (const skill of skills) {
      const skillPath = join(skillsDir, skill.name);
      const stat = statSync(skillPath);
      tools.push({
        name: skill.name,
        type: 'skill',
        path: skillPath,
        created: stat.birthtime
      });
    }
  }

  // Scan hooks directory
  const hooksDir = join(PAI_DIR, 'hooks');
  if (existsSync(hooksDir)) {
    const hooks = readdirSync(hooksDir)
      .filter(f => f.endsWith('.ts'))
      .filter(f => !['post-tool-use-metrics.ts', 'threshold-alert.ts'].includes(f)); // Exclude system hooks

    for (const hook of hooks) {
      const hookPath = join(hooksDir, hook);
      const stat = statSync(hookPath);
      tools.push({
        name: hook.replace('.ts', ''),
        type: 'hook',
        path: hookPath,
        created: stat.birthtime
      });
    }
  }

  // Scan tools directory
  const toolsDir = join(PAI_DIR, 'tools');
  if (existsSync(toolsDir)) {
    const customTools = readdirSync(toolsDir)
      .filter(f => f.endsWith('.ts'))
      .filter(f => !['telos-extractor.ts', 'threshold-monitor.ts', 'metric-aggregator.ts'].includes(f)); // Exclude flywheel tools

    for (const tool of customTools) {
      const toolPath = join(toolsDir, tool);
      const stat = statSync(toolPath);
      tools.push({
        name: tool.replace('.ts', ''),
        type: 'tool',
        path: toolPath,
        created: stat.birthtime
      });
    }
  }

  return tools;
}

function getToolUsage(toolName: string, usageData: any): {
  lastUsed: Date | null;
  weekly: { week1: number; week2: number; week3: number; week4: number };
  total: number;
} {
  // Extract usage counts from metrics data
  // This would integrate with existing metric-aggregator

  // For skills: count Skill tool invocations with matching skill name
  // For hooks: count hook execution events
  // For tools: count Bash invocations with tool name

  // Simplified implementation - would need real metric parsing
  const usage = {
    lastUsed: null as Date | null,
    weekly: { week1: 0, week2: 0, week3: 0, week4: 0 },
    total: 0
  };

  // Parse usage from JSONL metrics
  // TODO: Implement metric parsing

  return usage;
}

function calculateDecayScore(usage: ReturnType<typeof getToolUsage>, created: Date): number {
  const now = new Date();
  const ageWeeks = Math.floor((now.getTime() - created.getTime()) / (7 * 24 * 60 * 60 * 1000));

  // Decay factors:
  // 1. Recent usage (last 3 weeks)
  // 2. Usage trend (increasing vs declining)
  // 3. Age of tool (newer tools get grace period)

  const recentUse = usage.weekly.week2 + usage.weekly.week3 + usage.weekly.week4;

  // No recent usage = high decay
  if (recentUse === 0) {
    // Grace period for new tools (< 2 weeks old)
    if (ageWeeks < 2) return 0;

    // Strong evidence of abandonment
    if (ageWeeks > 4) return 100;

    return 70; // Likely deprecated
  }

  // Calculate usage trend
  const weeks = [usage.weekly.week1, usage.weekly.week2, usage.weekly.week3, usage.weekly.week4];
  const firstHalf = weeks.slice(0, 2).reduce((a, b) => a + b, 0);
  const secondHalf = weeks.slice(2).reduce((a, b) => a + b, 0);

  // Declining usage
  if (firstHalf > secondHalf * 2) {
    return 50; // Declining
  }

  // Stable or growing usage
  return 0; // Active
}

function determineStatus(decayScore: number, usage: ReturnType<typeof getToolUsage>): ToolHealthReport['status'] {
  if (decayScore >= 100) return 'zombie';  // Created but never used
  if (decayScore >= 70) return 'deprecated';
  if (decayScore >= 40) return 'declining';
  return 'active';
}

function generateRecommendation(
  status: ToolHealthReport['status'],
  decayScore: number,
  usage: ReturnType<typeof getToolUsage>,
  tool: CustomTool
): string {
  if (status === 'zombie') {
    return `ARCHIVE: Tool created but never used. Remove to reduce clutter.`;
  }

  if (status === 'deprecated') {
    const daysSinceUse = usage.lastUsed
      ? Math.floor((Date.now() - usage.lastUsed.getTime()) / (24 * 60 * 60 * 1000))
      : 'never';
    return `DEPRECATE: No usage in last 3 weeks (last used: ${daysSinceUse} days ago). Archive or document why keeping.`;
  }

  if (status === 'declining') {
    return `MONITOR: Usage declining. May become deprecated soon. Consider if still needed.`;
  }

  return `ACTIVE: Tool is healthy and being used regularly.`;
}
```

**Example Output:**
```json
[
  {
    "toolName": "old-research-pipeline",
    "toolType": "skill",
    "created": "2025-11-15T10:00:00Z",
    "lastUsed": "2025-12-01T14:30:00Z",
    "usagePattern": { "week1": 3, "week2": 0, "week3": 0, "week4": 0 },
    "totalUses": 3,
    "decayScore": 100,
    "status": "deprecated",
    "recommendation": "DEPRECATE: No usage in last 3 weeks (last used: 63 days ago). Archive or document why keeping."
  },
  {
    "toolName": "auto-diff-after-edit",
    "toolType": "hook",
    "created": "2026-01-15T10:00:00Z",
    "lastUsed": "2026-02-03T12:00:00Z",
    "usagePattern": { "week1": 12, "week2": 15, "week3": 18, "week4": 21 },
    "totalUses": 66,
    "decayScore": 0,
    "status": "active",
    "recommendation": "ACTIVE: Tool is healthy and being used regularly."
  }
]
```

---

### Component 4: Opportunity Cost Analyzer

**Purpose:** Flag when you're spending time on activities misaligned with your telos

**Input:**
- Weekly tool usage breakdown
- Telos identity profile

**Output:**
```typescript
interface OpportunityCostReport {
  timeAllocation: {
    building: number;      // % of tool calls
    researching: number;
    coordinating: number;
    other: number;
  };
  telosAlignment: {
    builder: number;       // Your identity score
    scientist: number;
    leader: number;
  };
  misalignments: Array<{
    activity: string;
    actualTime: number;    // % of time spent
    expectedTime: number;  // % based on telos
    delta: number;         // Difference
    opportunityCost: string;
    recommendation: string;
  }>;
}
```

**Logic:**
```typescript
// tools/opportunity-cost-analyzer.ts
export function analyzeOpportunityCost(
  summaries: DailySummary[],
  telos: TelosProfile
): OpportunityCostReport {

  // Categorize tool usage by activity type
  const allocation = categorizeActivities(summaries);

  // Compare to telos expectations
  const expected = calculateExpectedAllocation(telos);

  // Find misalignments
  const misalignments: OpportunityCostReport['misalignments'] = [];

  for (const [activity, actualPct] of Object.entries(allocation)) {
    const expectedPct = expected[activity] || 0;
    const delta = actualPct - expectedPct;

    // Flag significant misalignments (>15% difference)
    if (Math.abs(delta) > 15) {
      misalignments.push({
        activity,
        actualTime: actualPct,
        expectedTime: expectedPct,
        delta,
        opportunityCost: calculateOpportunityCost(activity, delta, telos),
        recommendation: generateAlignmentRecommendation(activity, delta, telos)
      });
    }
  }

  return {
    timeAllocation: allocation,
    telosAlignment: {
      builder: telos.identity.builder,
      scientist: telos.identity.scientist,
      leader: telos.identity.leader
    },
    misalignments
  };
}

function categorizeActivities(summaries: DailySummary[]): Record<string, number> {
  let totalCalls = 0;
  const counts = {
    building: 0,
    researching: 0,
    coordinating: 0,
    other: 0
  };

  for (const summary of summaries) {
    for (const [tool, count] of Object.entries(summary.toolUsage)) {
      totalCalls += count;

      // Building: Edit, Write, NotebookEdit
      if (['Edit', 'Write', 'NotebookEdit'].includes(tool)) {
        counts.building += count;
      }
      // Researching: Read, WebFetch, Grep, Task (with research context)
      else if (['Read', 'WebFetch', 'Grep'].includes(tool)) {
        counts.researching += count;
      }
      // Coordinating: Task, TaskCreate, TaskUpdate
      else if (['Task', 'TaskCreate', 'TaskUpdate'].includes(tool)) {
        counts.coordinating += count;
      }
      // Other
      else {
        counts.other += count;
      }
    }
  }

  // Convert to percentages
  return {
    building: (counts.building / totalCalls) * 100,
    researching: (counts.researching / totalCalls) * 100,
    coordinating: (counts.coordinating / totalCalls) * 100,
    other: (counts.other / totalCalls) * 100
  };
}

function calculateExpectedAllocation(telos: TelosProfile): Record<string, number> {
  // Expected allocation based on identity
  // Builder should spend ~60% building, Scientist ~50% researching, etc.

  return {
    building: telos.identity.builder * 0.6,        // 95 * 0.6 = 57%
    researching: telos.identity.scientist * 0.5,   // 70 * 0.5 = 35%
    coordinating: telos.identity.leader * 0.4,     // 85 * 0.4 = 34%
    other: 10  // Base level for misc activities
  };
}

function calculateOpportunityCost(activity: string, delta: number, telos: TelosProfile): string {
  if (delta > 0) {
    // Over-indexing on this activity
    if (activity === 'researching' && telos.identity.builder > 90) {
      return `${delta.toFixed(0)}% of time on research could be building time. At current pace, that's ~${Math.floor(delta * 0.4)} hours per week not building.`;
    }
    if (activity === 'coordinating' && telos.identity.builder > 90) {
      return `${delta.toFixed(0)}% of time coordinating instead of building. Consider delegation patterns.`;
    }
  } else {
    // Under-indexing on this activity
    if (activity === 'building' && telos.identity.builder > 90) {
      return `Only ${Math.abs(delta).toFixed(0)}% of expected building time. Your builder identity suggests you should be coding more.`;
    }
  }

  return `${Math.abs(delta).toFixed(0)}% misalignment with telos.`;
}

function generateAlignmentRecommendation(activity: string, delta: number, telos: TelosProfile): string {
  if (delta > 15) {
    // Over-indexing
    if (activity === 'researching') {
      return `DELEGATE: You're spending ${delta.toFixed(0)}% more time researching than your telos suggests. Consider using parallel research agents to free up builder time.`;
    }
    if (activity === 'coordinating') {
      return `AUTOMATE: High coordination overhead. Build workflow automation to reduce manual orchestration.`;
    }
  } else if (delta < -15) {
    // Under-indexing
    if (activity === 'building' && telos.identity.builder > 90) {
      return `REFOCUS: You're building ${Math.abs(delta).toFixed(0)}% less than expected. Block dedicated build time or eliminate distractions.`;
    }
  }

  return `Monitor this alignment.`;
}
```

**Example Output:**
```json
{
  "timeAllocation": {
    "building": 35,
    "researching": 45,
    "coordinating": 15,
    "other": 5
  },
  "telosAlignment": {
    "builder": 95,
    "scientist": 70,
    "leader": 85
  },
  "misalignments": [
    {
      "activity": "researching",
      "actualTime": 45,
      "expectedTime": 35,
      "delta": 10,
      "opportunityCost": "10% of time on research could be building time. At current pace, that's ~4 hours per week not building.",
      "recommendation": "DELEGATE: You're spending 10% more time researching than your telos suggests. Consider using parallel research agents to free up builder time."
    },
    {
      "activity": "building",
      "actualTime": 35,
      "expectedTime": 57,
      "delta": -22,
      "opportunityCost": "Only 22% of expected building time. Your builder identity suggests you should be coding more.",
      "recommendation": "REFOCUS: You're building 22% less than expected. Block dedicated build time or eliminate distractions."
    }
  ]
}
```

---

### Component 5: Prediction Orchestrator

**Purpose:** Combine all prediction sources and rank suggestions

**Input:**
- Goal predictions
- Trajectory forecasts
- Tool health reports
- Opportunity cost analysis

**Output:**
```typescript
interface PredictiveSuggestion {
  id: string;
  type: 'goal-based' | 'trajectory' | 'deprecation' | 'realignment';
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  title: string;
  description: string;
  reasoning: string;
  estimatedImpact: string;
  timeframe: 'immediate' | '1-2 weeks' | '1 month';
  action: {
    type: 'build' | 'deprecate' | 'delegate' | 'refocus';
    specifics: string;
  };
}
```

**Logic:**
```typescript
// tools/prediction-orchestrator.ts
export function orchestratePredictions(
  goalPredictions: GoalPrediction[],
  trajectories: TrajectoryForecast[],
  toolHealth: ToolHealthReport[],
  opportunityCost: OpportunityCostReport,
  telos: TelosProfile
): PredictiveSuggestion[] {

  const suggestions: PredictiveSuggestion[] = [];

  // 1. Goal-based predictions
  for (const goalPred of goalPredictions) {
    for (const need of goalPred.predictedNeeds) {
      if (need.confidence >= 75 && !need.exists) {
        suggestions.push({
          id: `goal-${slugify(need.capability)}`,
          type: 'goal-based',
          priority: need.timeframe === 'immediate' ? 'critical' : 'high',
          confidence: need.confidence,
          title: `Build ${need.capability}`,
          description: `Your goal "${goalPred.goal}" implies you'll need this capability`,
          reasoning: need.reasoning,
          estimatedImpact: `Directly supports your stated goal. Prevents future bottleneck.`,
          timeframe: need.timeframe,
          action: {
            type: 'build',
            specifics: `Create ${need.capability} tool/skill before you hit the need`
          }
        });
      }
    }
  }

  // 2. Trajectory forecasts
  for (const trajectory of trajectories) {
    if (trajectory.recommendation === 'build_now') {
      suggestions.push({
        id: `trajectory-${slugify(trajectory.pattern)}`,
        type: 'trajectory',
        priority: trajectory.bottleneckRisk > 80 ? 'critical' : 'high',
        confidence: trajectory.bottleneckRisk,
        title: `Automate ${trajectory.pattern}`,
        description: `Pattern accelerating rapidly - will bottleneck in 1-2 weeks`,
        reasoning: trajectory.reasoning,
        estimatedImpact: `Prevent pain before it hits. Save ${trajectory.projectedUsage} manual repetitions next week.`,
        timeframe: 'immediate',
        action: {
          type: 'build',
          specifics: `Create automation for ${trajectory.pattern} pattern NOW before bottleneck`
        }
      });
    }
  }

  // 3. Tool deprecation
  for (const tool of toolHealth) {
    if (tool.status === 'deprecated' || tool.status === 'zombie') {
      suggestions.push({
        id: `deprecate-${slugify(tool.toolName)}`,
        type: 'deprecation',
        priority: 'low',
        confidence: tool.decayScore,
        title: `Archive ${tool.toolName}`,
        description: `Tool unused for ${Math.floor((Date.now() - (tool.lastUsed?.getTime() || 0)) / (24*60*60*1000))} days`,
        reasoning: tool.recommendation,
        estimatedImpact: `Reduce clutter, improve system clarity`,
        timeframe: '1 month',
        action: {
          type: 'deprecate',
          specifics: `Move to .claude/History/deprecated/ with documentation of why built and why deprecated`
        }
      });
    }
  }

  // 4. Opportunity cost realignment
  for (const misalignment of opportunityCost.misalignments) {
    if (Math.abs(misalignment.delta) > 20) {
      suggestions.push({
        id: `realign-${slugify(misalignment.activity)}`,
        type: 'realignment',
        priority: 'high',
        confidence: 80,
        title: `Realign ${misalignment.activity} time`,
        description: `Spending ${misalignment.actualTime.toFixed(0)}% on ${misalignment.activity}, expected ${misalignment.expectedTime.toFixed(0)}%`,
        reasoning: misalignment.opportunityCost,
        estimatedImpact: misalignment.recommendation,
        timeframe: '1-2 weeks',
        action: {
          type: misalignment.recommendation.startsWith('DELEGATE') ? 'delegate' : 'refocus',
          specifics: misalignment.recommendation
        }
      });
    }
  }

  // Rank by priority and confidence
  return suggestions.sort((a, b) => {
    const priorityScore = { critical: 4, high: 3, medium: 2, low: 1 };
    const aScore = priorityScore[a.priority] * a.confidence;
    const bScore = priorityScore[b.priority] * b.confidence;
    return bScore - aScore;
  });
}
```

---

## Integration with Existing Flywheel

### Enhanced threshold-monitor.ts

```typescript
// tools/threshold-monitor.ts (ENHANCED)
import { orchestratePredictions } from './prediction-orchestrator';
import { predictFromGoals } from './goal-predictor';
import { forecastTrajectories } from './trajectory-forecaster';
import { monitorToolHealth } from './tool-health-monitor';
import { analyzeOpportunityCost } from './opportunity-cost-analyzer';
import { loadTelos } from './telos-extractor';

export interface ThresholdAlert {
  // Existing fields
  priority: 'urgent' | 'high' | 'strategic';
  pattern: string;
  count: number;
  confidence: number;
  suggestion: string;
  estimatedSavings?: string;

  // NEW: Prediction source
  predictionType?: 'reactive' | 'predictive';
  predictionDetails?: PredictiveSuggestion;
}

export function checkThresholds(): ThresholdAlert[] {
  const alerts: ThresholdAlert[] = [];

  // 1. EXISTING: Reactive pattern detection
  const reactiveAlerts = detectReactivePatterns();
  alerts.push(...reactiveAlerts);

  // 2. NEW: Predictive suggestions
  const telos = loadTelos();
  const summaries = aggregatePeriod(30);

  const goalPredictions = predictFromGoals(telos);
  const trajectories = forecastTrajectories(summaries);
  const toolHealth = monitorToolHealth();
  const opportunityCost = analyzeOpportunityCost(summaries, telos);

  const predictions = orchestratePredictions(
    goalPredictions,
    trajectories,
    toolHealth,
    opportunityCost,
    telos
  );

  // Convert predictions to alerts
  for (const pred of predictions) {
    alerts.push({
      priority: pred.priority === 'critical' ? 'urgent' : pred.priority,
      pattern: pred.title,
      count: 0, // Predictive, not based on count
      confidence: pred.confidence,
      suggestion: pred.description,
      estimatedSavings: pred.estimatedImpact,
      predictionType: 'predictive',
      predictionDetails: pred
    });
  }

  return alerts;
}
```

### Enhanced Surfacing

Predictions get surfaced through the three-tier system:

**Urgent (Mid-Session):**
- Critical predictions (90%+ confidence, immediate timeframe)
- Trajectory-based "build now before bottleneck" alerts

**High (Session Start):**
- High-confidence goal predictions (80%+)
- Trajectory forecasts with 2-week timeframe
- Major opportunity cost misalignments

**Strategic (Monday Brief):**
- Medium-confidence predictions
- Tool deprecation suggestions
- Long-term goal → capability mappings

---

## Example Scenarios

### Scenario 1: Goal-Based Prediction

**Input:**
- User has goal: "Democratize AI for non-technical users"
- No deployment automation exists yet
- User has deployed manually 2 times

**Traditional Flywheel:**
- Waits for 15 deployments
- Then suggests automation
- User suffered through 15 manual deployments

**Enhanced Flywheel:**
- **Week 1:** Sees goal in telos
- **Week 1:** Predicts: "You'll need one-click deployment" (90% confidence)
- **Week 1:** Surfaces: "Build deployment automation NOW before you need it?"
- **Result:** User builds it proactively, never suffers manual deployment pain

---

### Scenario 2: Trajectory Forecasting

**Input:**
- Week 1: User does manual git commits 3 times
- Week 2: User does manual git commits 8 times
- Week 3: User does manual git commits 17 times

**Traditional Flywheel:**
- Week 3: Hits threshold (15)
- Suggests automation after 28 manual commits

**Enhanced Flywheel:**
- **Week 2:** Detects acceleration (3 → 8 = 2.7x growth)
- **Week 2:** Projects Week 3 = ~21 commits
- **Week 2:** Surfaces: "Git commits accelerating. Will bottleneck next week. Build automation NOW?" (85% confidence)
- **Result:** User builds before Week 3 pain, saves 17+ manual commits

---

### Scenario 3: Tool Deprecation

**Input:**
- User built "legacy-research-pipeline" 3 months ago
- Used it 5 times in first week
- Zero usage in last 60 days

**Traditional Flywheel:**
- No action (doesn't track tool health)
- Tool sits unused, cluttering system

**Enhanced Flywheel:**
- **Monthly:** Health monitor detects zero usage
- **Monthly:** Calculates decay score = 100
- **Monday Brief:** "Archive legacy-research-pipeline? Unused for 60 days."
- **Result:** User archives old tool, system stays clean

---

### Scenario 4: Opportunity Cost

**Input:**
- User is 95% Builder identity
- Week analysis: 45% researching, 35% building, 20% other
- Expected: 57% building, 35% researching

**Traditional Flywheel:**
- No visibility into misalignment
- User continues over-indexing on research

**Enhanced Flywheel:**
- **Weekly:** Opportunity cost analyzer detects 22% building deficit
- **Session Start:** "You're building 22% less than your builder identity suggests. Spending 10% extra on research. Consider delegating research to parallel agents?"
- **Result:** User delegates research, refocuses on building

---

## Implementation Plan

### Phase 0: Foundation (Week 1)
- [ ] Create prediction infrastructure directory structure
- [ ] Implement goal-predictor.ts (basic capability mapping)
- [ ] Implement trajectory-forecaster.ts (trend detection)
- [ ] Test: Run predictions on historical data

### Phase 1: Tool Health (Week 2)
- [ ] Implement tool-health-monitor.ts
- [ ] Build tool discovery system
- [ ] Integrate with metrics for usage tracking
- [ ] Test: Identify deprecated tools in current system

### Phase 2: Opportunity Cost (Week 2-3)
- [ ] Implement opportunity-cost-analyzer.ts
- [ ] Build activity categorization
- [ ] Create alignment scoring
- [ ] Test: Analyze last month's work patterns

### Phase 3: Orchestration (Week 3)
- [ ] Implement prediction-orchestrator.ts
- [ ] Combine all prediction sources
- [ ] Rank by strategic value
- [ ] Test: Generate unified suggestion list

### Phase 4: Integration (Week 4)
- [ ] Enhance threshold-monitor.ts with predictions
- [ ] Update surfacing hooks (threshold-alert, load-context-suggestions, monday-brief)
- [ ] Add prediction type differentiation in UI
- [ ] Test: Full end-to-end prediction flow

### Phase 5: Tuning (Week 5+)
- [ ] Collect feedback on prediction accuracy
- [ ] Tune confidence thresholds
- [ ] Enhance goal → capability mappings
- [ ] Add domain-specific prediction patterns

---

## Success Metrics

**Prediction Accuracy:**
- >70% of proactive suggestions are accepted
- <20% false positives (suggestions that never become relevant)

**Time Savings:**
- Average 50% reduction in manual repetitions before automation
- Proactive builds prevent pain before threshold

**System Health:**
- Tool inventory stays clean (<5% deprecated tools)
- Time allocation within 15% of telos expectations

**User Experience:**
- Predictions feel helpful, not annoying
- High confidence (90%+) predictions are rarely wrong
- Clear reasoning builds trust in system

---

## Key Files

```
.claude/
  tools/
    # Existing flywheel
    telos-extractor.ts
    metric-aggregator.ts
    threshold-monitor.ts          # ENHANCED

    # NEW: Prediction Layer
    goal-predictor.ts
    trajectory-forecaster.ts
    tool-health-monitor.ts
    opportunity-cost-analyzer.ts
    prediction-orchestrator.ts

  hooks/
    threshold-alert.ts             # ENHANCED with predictions
    load-context-suggestions.ts    # ENHANCED with predictions

  skills/
    monday-brief/SKILL.md          # ENHANCED with prediction section
```

---

## The Complete Enhanced Flywheel

```
USER WORKS
   ↓
Phase 1: COLLECT METRICS (automatic PostToolUse)
   ↓
Phase 2: AGGREGATE DATA (daily summaries)
   ↓
Phase 3: ANALYZE PATTERNS (detect reactive patterns)
   ↓
Phase 3.5: PREDICT FUTURE NEEDS (NEW)
   ├─ Goal-based: "Your goals imply X"
   ├─ Trajectory: "X accelerating → bottleneck in 2 weeks"
   ├─ Tool health: "Y unused → deprecate?"
   ├─ Opportunity cost: "Misaligned with telos"
   └─ Orchestrate: Rank all predictions by strategic value
   ↓
Phase 4: SURFACE INSIGHTS
   ├─ Urgent: Critical predictions + reactive high-confidence
   ├─ High: Goal predictions + trajectories + reactive patterns
   └─ Strategic: All suggestions, tool health, opportunity costs
   ↓
Phase 5: ACT & BUILD
   ↓
OUTCOME TRACKING (Did it work? Was it used?)
   ↓
META-LEARNING (Tune prediction algorithms)
   ↓
FEEDS BACK TO PHASE 3.5 (Predictions get smarter)
```

---

**Status:** Ready for implementation
**Next Step:** Implement Phase 0 (prediction infrastructure)
**Expected Impact:** 50% reduction in manual repetitions, proactive capability building, clean tool inventory, telos-aligned time allocation
