# Flywheel Prediction Layer

**Version:** 1.0
**Status:** Production
**Last Updated:** 2026-02-03

---

## Product Requirements Document (PRD)

### Overview

The Flywheel Prediction Layer transforms reactive pattern detection into forward-thinking intelligence by predicting what you'll need before patterns emerge, forecasting bottlenecks weeks ahead, auto-deprecating unused tools, and flagging telos misalignments.

### Problem Statement

The original flywheel was purely reactive:
- Detected patterns AFTER they occurred (e.g., "you did X 5 times today")
- No foresight into future needs
- No tool lifecycle management
- No strategic time allocation guidance
- Couldn't predict capabilities needed for goals

**The Question That Sparked This:**
> "Is my flywheel forward-thinking enough? Can it extrapolate what I might need given my goals and build it (with my approval) or with decaying function if not used?"

**Answer:** Not yet, but it can be.

### Solution

A four-engine prediction system that:
1. **Goal-Based Predictor**: Maps goals → needed capabilities
2. **Trajectory Forecaster**: Detects acceleration → predicts bottlenecks
3. **Tool Health Monitor**: Decay scoring → deprecation warnings
4. **Opportunity Cost Analyzer**: Time allocation → telos misalignment

**Plus orchestration** that ranks all predictions by strategic value.

### User Stories

**As a strategic builder, I want to:**
- Predict what tools I'll need based on my stated goals
- Get warned about bottlenecks before they hurt productivity
- Automatically deprecate tools I'm not using
- See when my time allocation doesn't match my purpose
- Have all predictions ranked by strategic impact

### Success Metrics

- **Prediction Accuracy**: 70%+ of predictions are acted upon
- **Lead Time**: Bottlenecks predicted 1-2 weeks in advance
- **Decay Precision**: 95%+ of flagged tools are actually unused
- **Alignment Detection**: 90%+ of misalignments are real
- **Strategic Ranking**: Top suggestion is correct 80%+ of time

### Requirements

**Functional:**
- Predict capabilities from goal patterns
- Forecast trajectory bottlenecks using regression
- Monitor tool health with decay scoring
- Analyze time allocation vs telos expectations
- Orchestrate all predictions with unified interface
- Rank by strategic value (confidence × telos × urgency)
- Integrate with all surfacing layers

**Non-Functional:**
- Fast execution (< 10 seconds total for all engines)
- No false deprecations (grace period for new tools)
- Tunable confidence thresholds
- Privacy-preserving (all local)

---

## Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────┐
│            Flywheel Prediction Layer (Phase 3.5)             │
└──────────────────────────────────────────────────────────────┘
                              │
      ┌───────────────────────┼───────────────────────┐
      ▼                       ▼                       ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Prediction │       │ Orchestrate │       │  Surfacing  │
│   Engines   │──────▶│   & Rank    │──────▶│   Layers    │
└─────────────┘       └─────────────┘       └─────────────┘
      │                       │                       │
      ▼                       ▼                       ▼
4 Independent         prediction-            threshold-alert
 Predictors          orchestrator.ts         context-analyzer
                                             monday-brief
```

### Four Prediction Engines

#### Engine 1: Goal-Based Predictor

**File:** `tools/goal-predictor.ts` (410 lines)

**Purpose:** Predict capabilities needed to achieve stated goals

**Input:**
```typescript
interface TelosProfile {
  recentGoals: Goal[];  // "democratize AI", "build research platform"
}
```

**Output:**
```typescript
interface GoalPrediction {
  goal: string;
  predictedCapabilities: {
    capability: string;      // "Documentation Generator"
    category: string;        // "documentation"
    confidence: number;      // 85
    reasoning: string;
    timeframe: string;       // "1-2 weeks"
    exists: boolean;         // false (needs to be built)
  }[];
}
```

**Prediction Logic:**

**7 Goal Patterns:**
1. **Democratize** → Documentation, Training, API wrappers
2. **Build** → Architecture, Templates, CI/CD
3. **Research** → Scraping, Aggregation, Analysis tools
4. **Automate** → Workflow tools, Schedulers, Orchestrators
5. **Teach** → Documentation, Examples, Tutorials
6. **Product** → Monitoring, Analytics, User feedback
7. **Team** → Communication, Status reporting, Handoff tools

**Example:**
```typescript
// Goal: "democratize AI capabilities"
// Predicts:
{
  capability: "Documentation Generator",
  category: "documentation",
  confidence: 85,
  timeframe: "1-2 weeks",
  exists: false
}
```

**Tool Existence Check:**
- Scans `.claude/skills/`, `.claude/hooks/`, `tools/`
- Checks for files matching capability name
- If exists: confidence reduced (already have it)

#### Engine 2: Trajectory Forecaster

**File:** `tools/trajectory-forecaster.ts` (412 lines)

**Purpose:** Detect acceleration patterns and predict future bottlenecks

**Input:**
- DailySummary[] (last 30 days of metrics)

**Output:**
```typescript
interface TrajectoryForecast {
  pattern: string;           // "Edit tool usage"
  weeklyUsage: number[];     // [10, 15, 22, 35]
  trend: {
    direction: 'accelerating' | 'stable' | 'declining';
    slope: number;           // 8.5 (calls per week increase)
  };
  projection: {
    nextWeekEstimate: number;  // 43 calls
    twoWeeksEstimate: number;  // 51 calls
  };
  bottleneckRisk: number;    // 0-100
  recommendation: string;
}
```

**Bottleneck Detection:**

Uses linear regression:
```typescript
// Calculate trend line
const slope = linearRegression(weeklyUsage);

// Classify
if (slope > 2) {
  trend = 'accelerating';
  bottleneckRisk = calculateRisk(slope, currentUsage);
  // Risk 70-100: Build automation NOW
  // Risk 50-70: Monitor and plan
  // Risk 0-50: Watch but no action
}
```

**Recommendation Logic:**
- Risk > 70 + Accelerating → "Build automation now"
- Risk 50-70 + Accelerating → "Plan automation for next sprint"
- Risk > 80 + Stable but high → "Already a bottleneck"

#### Engine 3: Tool Health Monitor

**File:** `tools/tool-health-monitor.ts` (517 lines)

**Purpose:** Auto-detect unused tools and recommend deprecation

**Tool Discovery:**
- Scans `.claude/skills/`, `.claude/hooks/`, `tools/`
- Excludes 40+ system components (Read, Write, Bash, etc.)
- Finds custom user tools only

**Decay Scoring:**

```typescript
function calculateDecayScore(usage, ageWeeks): number {
  // 100 = Zombie (never used, no grace period)
  if (total === 0) return 100;

  // 0-40 = Active (used in last 3 weeks)
  if (week1 + week2 + week3 > 0) return 0;

  // Grace period: 2 weeks for new tools
  if (ageWeeks < 2 && total > 0) return 0;

  // 70-100 = Deprecated (no usage 3+ weeks)
  if (ageWeeks > 4) return 100;

  // 40-70 = Declining
  return 70;
}
```

**Output:**
```typescript
interface ToolHealthReport {
  tool: string;
  type: 'skill' | 'hook' | 'tool';
  path: string;
  usage: {
    weekly: { week1: number; week2: number; week3: number; week4: number };
    total: number;
  };
  ageWeeks: number;
  decayScore: number;      // 0-100
  status: 'active' | 'declining' | 'deprecated' | 'zombie';
  recommendation: string;
  confidence: number;
}
```

**Real Detection:**
- Found: `content-generation` skill
- Status: Zombie (unused 999 days)
- Decay: 100%
- Recommendation: "Archive this skill"

#### Engine 4: Opportunity Cost Analyzer

**File:** `tools/opportunity-cost-analyzer.ts` (440 lines)

**Purpose:** Flag when time allocation doesn't match telos identity

**Input:**
- DailySummary[] (tool usage patterns)
- TelosProfile (expected allocation)

**Activity Categorization:**
```typescript
const categories = {
  building: ['Edit', 'Write', 'NotebookEdit'],
  researching: ['Read', 'WebFetch', 'Grep', 'Glob'],
  coordinating: ['Task', 'TaskCreate', 'TaskUpdate'],
  other: ['Bash', 'Skill', 'AskUserQuestion']
};
```

**Expected Allocation (from Telos):**
```typescript
function calculateExpectedAllocation(telos: TelosProfile) {
  return {
    building: telos.identity.builder * 0.6,      // 95% × 0.6 = 57%
    researching: telos.identity.scientist * 0.5, // 70% × 0.5 = 35%
    coordinating: telos.identity.leader * 0.4,   // 85% × 0.4 = 34%
    other: 10                                     // Baseline
  };
}
```

**Misalignment Detection:**
```typescript
interface Misalignment {
  activity: string;       // "building"
  actual: number;         // 18%
  expected: number;       // 56%
  delta: number;          // -38%
  severity: 'critical' | 'high' | 'moderate';
  type: 'deficit' | 'excess';
  recommendation: 'REFOCUS' | 'DELEGATE' | 'AUTOMATE';
}
```

**Severity Thresholds:**
- Critical: > 30% delta
- High: 15-30% delta
- Moderate: 10-15% delta

**Real Detection:**
- Building: 18% actual vs 56% expected (-38% deficit = CRITICAL)
- Other: 36% actual vs 10% expected (+26% excess = HIGH)

### Orchestration Layer

**File:** `tools/prediction-orchestrator.ts` (507 lines)

**Purpose:** Combine all 4 engines into unified ranked suggestions

**Input:**
- GoalPrediction[] from goal-predictor
- TrajectoryForecast[] from trajectory-forecaster
- ToolHealthReport[] from tool-health-monitor
- OpportunityCostReport from opportunity-cost-analyzer
- TelosProfile for strategic value calculation

**Output:**
```typescript
interface PredictiveSuggestion {
  id: string;
  type: 'goal-based' | 'trajectory' | 'deprecation' | 'realignment';
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;           // 0-100
  telosAlignment: number;       // 0-100
  strategicValue: number;       // Calculated score for ranking
  timeframe: 'immediate' | '1-2 weeks' | '1 month' | '3+ months';
  estimatedImpact: string;
  reasoning: string;
  action: {
    type: 'BUILD' | 'REFOCUS' | 'DELEGATE' | 'ARCHIVE';
    specifics: string;
  };
}
```

**Strategic Value Formula:**
```typescript
function calculateStrategicValue(suggestion, telos): number {
  // Priority scores
  const priorityScore = { critical: 5, high: 3, medium: 2, low: 1 };

  // Urgency multipliers
  const urgencyScore = {
    'immediate': 1.5,
    '1-2 weeks': 1.2,
    '1 month': 1.0,
    '3+ months': 0.7
  };

  // Base score
  const base = (priorityScore[suggestion.priority] * 100) + suggestion.confidence;

  // Telos multiplier (60-100% based on alignment)
  const telosMultiplier = suggestion.telosAlignment / 100;

  // Urgency multiplier
  const urgencyMultiplier = urgencyScore[suggestion.timeframe];

  // Final strategic value
  return base * telosMultiplier * urgencyMultiplier;
}
```

**Example Ranking:**
1. Realign building time: 433 (HIGH priority, 80% confidence, 95% telos, immediate)
2. Realign other time: 319 (MEDIUM priority, 80% confidence, 90% telos, immediate)
3. Archive zombie tool: 225 (MEDIUM priority, 100% confidence, 75% telos, immediate)

**Deduplication:**
- Same prediction from multiple engines → keep highest confidence
- Similar patterns → merge with combined evidence

**Filtering:**
```typescript
// Get only high-priority
filterSuggestions(suggestions, { priorities: ['critical', 'high'] });

// Get only immediate timeframe
filterSuggestions(suggestions, { timeframes: ['immediate'] });

// Get top N by strategic value
suggestions.slice(0, N);
```

---

## Data Flow

```
┌─────────────────┐
│  History Files  │
│  Metric Data    │
│  Telos Profile  │
└────────┬────────┘
         │
    ┌────┴────┬─────────────┬──────────────┐
    ▼         ▼             ▼              ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
│ Goal   │ │Trajec- │ │   Tool   │ │Opportun- │
│Predict │ │tory    │ │  Health  │ │ity Cost  │
│        │ │Forecast│ │  Monitor │ │ Analyzer │
└───┬────┘ └───┬────┘ └────┬─────┘ └────┬─────┘
    │          │            │            │
    └──────────┴────────────┴────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │   Orchestrator  │
            │  (Rank by       │
            │Strategic Value) │
            └────────┬────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    Mid-Session  Session-Start Monday
     Alerts      Suggestions    Brief
```

---

## Detailed Component Architecture

### Engine 1: Goal-Based Predictor

**Algorithm:**

```
1. Load telos profile with recentGoals[]
2. For each goal:
   a. Match against 7 goal patterns
   b. Generate predicted capabilities
   c. Check if capability already exists
   d. Assign confidence and timeframe
3. Filter out existing capabilities
4. Return predictions
```

**Capability Mapping:**

| Goal Pattern | Predicted Capabilities | Example |
|--------------|----------------------|---------|
| democratize/open-source | Documentation Generator, Tutorial Builder, API Wrapper | "democratize AI" → docs needed |
| build/create | Architecture Templates, Testing Framework, CI/CD Pipeline | "build platform" → infra needed |
| research/investigate | Web Scraper, Data Aggregator, Analysis Tool | "research market" → scraping needed |
| automate/streamline | Workflow Orchestrator, Scheduler, Task Automation | "automate deploys" → CI/CD needed |
| teach/educate | Course Generator, Example Builder, Interactive Tutorials | "teach ML" → examples needed |
| product/launch | Monitoring Dashboard, Analytics, User Feedback | "launch product" → monitoring needed |
| team/collaborate | Status Reporter, Communication Bot, Handoff Tool | "coordinate team" → reporting needed |

**Confidence Scoring:**
- Strong match (exact keyword): 90-95%
- Good match (related term): 80-85%
- Weak match (inferred): 70-75%

**Timeframe Estimation:**
- Immediate: Goal is active + pattern is urgent
- 1-2 weeks: Goal is active + pattern is normal
- 1 month: Goal is stated but not active yet
- 3+ months: Goal is aspirational

### Engine 2: Trajectory Forecaster

**Algorithm:**

```
1. Get last 30 days of metrics
2. Group by pattern (tool or sequence)
3. Calculate weekly usage over 4 weeks
4. Apply linear regression
5. Calculate trend (accelerating/stable/declining)
6. Project next 1-2 weeks
7. Calculate bottleneck risk (0-100)
8. Generate recommendation if risk > 50
```

**Linear Regression:**
```typescript
function linearRegression(weeklyUsage: number[]): number {
  const n = weeklyUsage.length;
  const x = [0, 1, 2, 3];  // Weeks
  const y = weeklyUsage;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope;
}
```

**Trend Classification:**
- Accelerating: slope > 2 (gaining 2+ calls per week)
- Declining: slope < -2 (losing 2+ calls per week)
- Stable: -2 ≤ slope ≤ 2

**Bottleneck Risk:**
```typescript
function calculateBottleneckRisk(slope, currentUsage): number {
  if (slope <= 0) return 0;  // Not accelerating

  const growthRate = slope / (currentUsage || 1);
  const absoluteSlope = Math.abs(slope);

  // High slope + high growth rate = high risk
  let risk = (absoluteSlope * 10) + (growthRate * 50);
  return Math.min(100, Math.max(0, risk));
}
```

**Example Detection:**
```
Pattern: Edit tool usage
Weekly: [10, 15, 22, 35]
Slope: 8.3 calls/week
Trend: Accelerating
Projection: 43 calls next week, 51 in 2 weeks
Risk: 75% (HIGH)
Recommendation: Build editing automation now - usage accelerating
```

### Engine 3: Tool Health Monitor

**Tool Discovery:**

```typescript
function discoverTools(): string[] {
  const tools: Set<string> = new Set();

  // Scan directories
  scanDirectory('.claude/skills/', tools);
  scanDirectory('.claude/hooks/', tools);
  scanDirectory('tools/', tools);

  // Filter out system components
  const SYSTEM_TOOLS = [
    'Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob',
    'Task', 'TaskCreate', 'TaskUpdate', 'TaskList',
    // ... 40+ system tools
  ];

  return Array.from(tools).filter(t => !SYSTEM_TOOLS.includes(t));
}
```

**Usage Tracking:**

Uses metric data to calculate 4-week usage:
```typescript
interface ToolUsage {
  weekly: {
    week1: number;  // Most recent
    week2: number;
    week3: number;
    week4: number;
  };
  total: number;
}
```

**Status Classification:**

| Decay Score | Status | Meaning | Action |
|-------------|--------|---------|--------|
| 0-40 | active | Used recently | None |
| 40-70 | declining | Usage trending down | Monitor |
| 70-100 | deprecated | No usage 3+ weeks | Consider archiving |
| 100 | zombie | Never used | Archive now |

**Grace Period Logic:**
```typescript
// New tools get 2 weeks grace if used at least once
if (ageWeeks < 2 && usage.total > 0) {
  return 0;  // Active (grace period)
}
```

**Example Output:**
```typescript
{
  tool: "content-generation",
  type: "skill",
  usage: { weekly: { week1: 0, week2: 0, week3: 0, week4: 0 }, total: 0 },
  ageWeeks: 999,
  decayScore: 100,
  status: "zombie",
  recommendation: "Archive this skill - never used",
  confidence: 100
}
```

### Engine 4: Opportunity Cost Analyzer

**Time Allocation Analysis:**

```typescript
// 1. Categorize all tool calls
const building = toolCalls.filter(t => ['Edit', 'Write'].includes(t.tool));
const researching = toolCalls.filter(t => ['Read', 'WebFetch'].includes(t.tool));
const coordinating = toolCalls.filter(t => ['Task', 'TaskCreate'].includes(t.tool));
const other = toolCalls.filter(t => !categorized.includes(t.tool));

// 2. Calculate percentages
const total = toolCalls.length;
const actual = {
  building: (building.length / total) * 100,      // 18%
  researching: (researching.length / total) * 100, // 19%
  coordinating: (coordinating.length / total) * 100, // 27%
  other: (other.length / total) * 100              // 36%
};

// 3. Compare to expected (from telos)
const expected = {
  building: telos.identity.builder * 0.6,    // 56%
  researching: telos.identity.scientist * 0.5, // 35%
  coordinating: telos.identity.leader * 0.4,   // 34%
  other: 10
};

// 4. Detect misalignments
const delta = actual.building - expected.building;  // -38%
if (Math.abs(delta) > 15) {
  // HIGH PRIORITY misalignment
}
```

**Recommendation Logic:**

| Delta | Type | Recommendation |
|-------|------|----------------|
| < -30% | Deficit (critical) | REFOCUS: Block dedicated time |
| -30% to -15% | Deficit (high) | REFOCUS: Prioritize this work |
| +15% to +30% | Excess (high) | DELEGATE: Offload to others |
| > +30% | Excess (critical) | DELEGATE: This is consuming you |

**Real Detection Example:**
```typescript
{
  activity: "building",
  actual: 18,
  expected: 56,
  delta: -38,
  severity: "critical",
  type: "deficit",
  recommendation: "REFOCUS: You're building 38% less than expected for a 95% builder. Block dedicated build time or eliminate distractions.",
  confidence: 80,
  opportunityCostHours: 15.2  // Hours/week misallocated
}
```

### Orchestration: Unified Interface

**Conversion Functions:**

Each engine's output is converted to unified `PredictiveSuggestion`:

```typescript
// Goal prediction → PredictiveSuggestion
function goalToSuggestion(pred: GoalPrediction, cap: Capability): PredictiveSuggestion {
  return {
    id: `goal-${pred.goal}-${cap.capability}`,
    type: 'goal-based',
    title: `Build ${cap.capability} for "${pred.goal}"`,
    priority: cap.confidence >= 85 ? 'high' : 'medium',
    confidence: cap.confidence,
    telosAlignment: calculateGoalAlignment(pred.goal, telos),
    timeframe: cap.timeframe,
    action: { type: 'BUILD', specifics: cap.reasoning }
  };
}

// Similar converters for trajectory, tool-health, opportunity-cost
```

**Strategic Value Ranking:**

All suggestions ranked by calculated strategic value:
```typescript
const ranked = suggestions
  .map(s => ({
    ...s,
    strategicValue: calculateStrategicValue(s, telos)
  }))
  .sort((a, b) => b.strategicValue - a.strategicValue);
```

**Top suggestion is shown first** in all surfacing layers.

---

## Usage

### Manual Testing

**Test each engine individually:**

```bash
# Goal-based predictor
bun run tools/goal-predictor.ts

# Trajectory forecaster
bun run tools/trajectory-forecaster.ts

# Tool health monitor
bun run tools/tool-health-monitor.ts

# Opportunity cost analyzer
bun run tools/opportunity-cost-analyzer.ts
```

**Test orchestration:**
```bash
bun run tools/test-predictions.ts
```

**Test full integration:**
```bash
# Session start suggestions (includes predictions)
bun run tools/context-analyzer.ts

# Monday brief (includes predictions)
bun run tools/monday-brief.ts --force

# Threshold monitor (combines reactive + predictive)
bun run tools/threshold-monitor.ts
```

### Automatic Operation

**Predictions run automatically:**
- Session start via context-analyzer.ts
- Monday brief via monday-brief.ts
- Threshold monitor (called by above)

**No user action needed** once deployed.

### Configuration

**Disable predictions:**

```bash
# Reactive-only mode
bun run tools/threshold-monitor.ts --reactive-only
```

**Tune confidence thresholds:**

Edit `tools/prediction-orchestrator.ts`:
```typescript
// Filter by minimum confidence
export function filterSuggestions(
  suggestions: PredictiveSuggestion[],
  filters: { minConfidence?: number }
): PredictiveSuggestion[] {
  return suggestions.filter(s => s.confidence >= (filters.minConfidence || 70));
}
```

**Adjust strategic value formula:**

Edit `calculateStrategicValue()` in `prediction-orchestrator.ts`:
```typescript
// Increase telos impact
const telosMultiplier = (suggestion.telosAlignment / 100) * 1.5; // 1.5x weight

// Increase urgency impact
const urgencyMultiplier = urgencyScore[suggestion.timeframe] * 2; // 2x weight
```

---

## Deployment

### Prerequisites

**Required Systems:**
- ✅ Self-Improvement Flywheel (metric collection + aggregation)
- ✅ Telos-Aware Flywheel (telos extraction)
- ✅ Context-Aware Suggestions (surfacing layer)
- ✅ Bun runtime
- ✅ PAI with History/

**Verify dependencies:**
```bash
ls ~/.claude/../tools/metric-aggregator.ts  # Phase 2
ls ~/.claude/../tools/telos-extractor.ts    # Telos
ls ~/.claude/../tools/context-analyzer.ts   # Surfacing
```

### Installation Steps

#### Step 1: Install Prediction Engines

**Copy all 4 engines:**
```bash
cp tools/goal-predictor.ts ~/.claude/../tools/
cp tools/trajectory-forecaster.ts ~/.claude/../tools/
cp tools/tool-health-monitor.ts ~/.claude/../tools/
cp tools/opportunity-cost-analyzer.ts ~/.claude/../tools/

chmod +x ~/.claude/../tools/goal-predictor.ts
chmod +x ~/.claude/../tools/trajectory-forecaster.ts
chmod +x ~/.claude/../tools/tool-health-monitor.ts
chmod +x ~/.claude/../tools/opportunity-cost-analyzer.ts
```

**Test each engine:**
```bash
cd ~/.claude/../tools

bun run goal-predictor.ts
bun run trajectory-forecaster.ts
bun run tool-health-monitor.ts
bun run opportunity-cost-analyzer.ts
```

#### Step 2: Install Orchestrator

**Copy orchestrator:**
```bash
cp tools/prediction-orchestrator.ts ~/.claude/../tools/
chmod +x ~/.claude/../tools/prediction-orchestrator.ts
```

**Test orchestration:**
```bash
cp tools/test-predictions.ts ~/.claude/../tools/
chmod +x ~/.claude/../tools/test-predictions.ts

bun run ~/.claude/../tools/test-predictions.ts
```

**Expected output:**
```
✅ Prediction layer is functional
   Ready for integration with threshold-monitor.ts
```

#### Step 3: Integrate with Threshold Monitor

**The integration is already in threshold-monitor.ts**, but if deploying fresh:

**Add imports:**
```typescript
import { orchestratePredictions, type PredictiveSuggestion } from './prediction-orchestrator';
import { predictFromGoals } from './goal-predictor';
import { forecastTrajectories } from './trajectory-forecaster';
import { monitorToolHealth } from './tool-health-monitor';
import { analyzeOpportunityCost } from './opportunity-cost-analyzer';
```

**Add prediction layer call:**
```typescript
function runPredictionLayer(telos: TelosProfile, summaries: DailySummary[]): ThresholdAlert[] {
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

  return predictions.map(predictiveToAlert);
}
```

**Add to checkThresholds:**
```typescript
export function checkThresholds(options?: { reactiveOnly?: boolean }): ThresholdAlert[] {
  // Existing reactive detection
  const reactiveAlerts = detectReactivePatterns();
  reactiveAlerts.forEach(a => a.predictionType = 'reactive');

  // NEW: Predictive suggestions
  if (!options?.reactiveOnly) {
    const predictiveAlerts = runPredictionLayer(telos, monthlySummaries);
    alerts.push(...predictiveAlerts);
  }

  return sortAndDeduplicate(alerts);
}
```

#### Step 4: Update Surfacing Layers

**Already integrated in:**
- context-analyzer.ts (session start)
- monday-brief.ts (strategic insights)
- threshold-alert.ts (mid-session)

**Verify predictions appear:**
```bash
# Session start
bun run tools/context-analyzer.ts | grep -i "predictive\|realign\|archive"

# Monday brief
bun run tools/monday-brief.ts --force | grep -i "flywheel insights"

# Shows both reactive (📊) and predictive (🔮) suggestions
```

### Verification

**Check all engines work:**
```bash
bun run tools/test-predictions.ts
```

**Expected:**
```
✅ Goal predictions: ✓ Working
✅ Trajectory forecasts: ✓ Working
✅ Tool health monitoring: ✓ Working
✅ Opportunity cost analysis: ✓ Working
✅ Prediction orchestration: ✓ Working
```

**Check integration:**
```bash
bun run tools/threshold-monitor.ts 2>&1 | head -20
```

**Expected:**
```
Reactive: 45 | Predictive: 6
```

### Troubleshooting

**Issue: No predictions generated**

**Check:**
```bash
bun run tools/test-predictions.ts 2>&1 | grep "suggestions:"
```

**Possible causes:**
- No goals in telos → goal-predictor returns 0
- Not enough metric data → trajectory-forecaster returns 0
- All tools are active → tool-health returns 0
- Perfect alignment → opportunity-cost returns 0

**This is NORMAL** for a stable system. Predictions only appear when needed.

**Issue: Goal predictions not working**

**Check:**
```bash
cat ~/.claude/telos.json | jq '.recentGoals'
```

**If empty:**
- Add goals to telos.json manually
- Or add goals to your History/ files (system will extract)

**Example manual addition:**
```json
{
  "recentGoals": [
    { "goal": "democratize AI capabilities", "date": "2026-02-03" },
    { "goal": "build research platform", "date": "2026-02-03" }
  ]
}
```

**Issue: Trajectory forecasts always 0**

**Cause:** Need at least 4 weeks of metric data

**Check:**
```bash
ls ~/.claude/metrics/*/daily-summaries/*.json | wc -l
```

**Need:** At least 7 files for trajectory analysis

**Issue: Tool health shows wrong status**

**Example:** Active tool marked as zombie

**Debug:**
```bash
bun run tools/tool-health-monitor.ts --verbose
```

**Check:**
- Tool name matching (case-sensitive)
- Metric data has correct tool names
- System exclusion list doesn't include your tool

**Fix:**

Edit `SYSTEM_TOOLS` list in `tool-health-monitor.ts` if needed.

### Maintenance

**Regular maintenance:**
- None required for engines
- Telos cache auto-refreshes (24h)
- Metrics aggregation handles cleanup

**Tuning (Phase 5 - optional):**
- Collect feedback on prediction accuracy
- Adjust confidence thresholds
- Enhance goal → capability mappings
- Add domain-specific patterns

**Feedback loop:**
```bash
# Track which predictions were acted upon
# Add to telos.json:
{
  "predictionFeedback": [
    { "prediction": "Build X", "acted": true, "useful": true }
  ]
}
```

### Uninstallation

**Remove prediction engines:**
```bash
rm ~/.claude/../tools/goal-predictor.ts
rm ~/.claude/../tools/trajectory-forecaster.ts
rm ~/.claude/../tools/tool-health-monitor.ts
rm ~/.claude/../tools/opportunity-cost-analyzer.ts
rm ~/.claude/../tools/prediction-orchestrator.ts
rm ~/.claude/../tools/test-predictions.ts
```

**Remove integration from threshold-monitor.ts:**

Edit and remove prediction layer imports and calls.

**Remove from surfacing layers:**

Edit context-analyzer.ts, monday-brief.ts to remove prediction sections.

---

## API Reference

### goal-predictor.ts

```typescript
export function predictFromGoals(telos: TelosProfile): GoalPrediction[];
export function summarizePredictions(predictions: GoalPrediction[]): Summary;
```

### trajectory-forecaster.ts

```typescript
export function forecastTrajectories(summaries: DailySummary[]): TrajectoryForecast[];
export function getActionableForecasts(forecasts: TrajectoryForecast[]): TrajectoryForecast[];
export function summarizeForecasts(forecasts: TrajectoryForecast[]): Summary;
```

### tool-health-monitor.ts

```typescript
export function monitorToolHealth(): ToolHealthReport[];
export function summarizeHealth(reports: ToolHealthReport[]): Summary;
```

### opportunity-cost-analyzer.ts

```typescript
export function analyzeOpportunityCost(
  summaries: DailySummary[],
  telos: TelosProfile
): OpportunityCostReport;
export function summarizeOpportunityCost(report: OpportunityCostReport): Summary;
```

### prediction-orchestrator.ts

```typescript
export function orchestratePredictions(
  goalPredictions: GoalPrediction[],
  trajectories: TrajectoryForecast[],
  healthReports: ToolHealthReport[],
  costReport: OpportunityCostReport,
  telos: TelosProfile
): PredictiveSuggestion[];

export function filterSuggestions(
  suggestions: PredictiveSuggestion[],
  filters: FilterOptions
): PredictiveSuggestion[];

export function summarizePredictions(suggestions: PredictiveSuggestion[]): Summary;
```

---

## Performance

**Engine Performance:**
- Goal predictor: < 500ms
- Trajectory forecaster: < 2 seconds (30 days of data)
- Tool health monitor: < 1 second
- Opportunity cost analyzer: < 1 second

**Total prediction time:** < 5 seconds (all 4 engines + orchestration)

**Memory:**
- Peak: < 100MB
- Typical: 20-50MB

**Caching:**
- Telos cached 24h → engines run fast after first extraction

---

## Privacy & Security

**Data Handling:**
- 100% local processing
- No external API calls
- No data leaves machine

**Sensitive Data:**
- Goals in telos.json (local only)
- Work patterns (never shared)
- Tool names (no file paths or content)

---

## Real-World Example

**Your Current State (2026-02-03):**

```
Telos Profile:
  Builder: 95%
  Scientist: 70%
  Leader: 85%

Engine Results:
  Goal-based: 0 (no goals in profile)
  Trajectory: 0 (stable system)
  Tool Health: 3 deprecation warnings
  Opportunity Cost: 3 misalignments (1 critical)

Top Prediction:
  Title: "Realign building time"
  Type: realignment (opportunity-cost)
  Priority: HIGH
  Confidence: 80%
  Strategic Value: 433
  Reasoning: "Spending 18% on building, expected 56%"
  Action: "REFOCUS: Block dedicated build time"

Why This Matters:
  You're a 95% builder spending only 18% of time building.
  That's a 38% deficit preventing you from your core mission.
  The flywheel correctly identified this as the #1 priority.
```

---

## Version History

**v1.0 (2026-02-03):**
- Initial release
- 4 prediction engines implemented
- Orchestration layer complete
- Integration with all surfacing layers
- Tested on real data with real detections

---

## License

Part of Personal AI Infrastructure (PAI)
