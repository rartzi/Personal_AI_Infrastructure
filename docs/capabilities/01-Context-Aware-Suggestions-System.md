# Context-Aware Suggestions System

**Version:** 1.0
**Status:** Production
**Last Updated:** 2026-02-03

---

## Product Requirements Document (PRD)

### Overview

The Context-Aware Suggestions System provides high-value proactive intelligence by extracting research threads, unfinished creative ideas, goals, and build opportunities from your work history.

### Problem Statement

Users have valuable context scattered across their work history that gets lost over time:
- Research threads explored weeks ago that are now stale
- Creative ideas started but never finished
- Goals tracked but not actively pursued
- Patterns that could be automated but aren't visible

### Solution

An automated intelligence system that:
1. **Extracts** meaningful content from History/ files
2. **Analyzes** patterns to derive build opportunities
3. **Surfaces** high-value suggestions at the right time
4. **Prioritizes** based on staleness, completeness, and impact

### User Stories

**As a knowledge worker, I want to:**
- Be reminded of research I did weeks ago when it becomes relevant again
- See unfinished creative ideas with clear next steps
- Track progress toward my goals automatically
- Discover automation opportunities from my work patterns

### Success Metrics

- **Relevance**: 80%+ of surfaced suggestions are actionable
- **Timing**: Suggestions appear within 24 hours of becoming relevant
- **Coverage**: 90%+ of stale research/ideas are detected
- **Engagement**: Users act on 30%+ of high-priority suggestions

### Requirements

**Functional:**
- Extract research threads with topic, summary, status, age
- Identify unfinished ideas with next steps
- Track goals and progress indicators
- Derive build opportunities from usage patterns
- Prioritize by staleness and impact
- Surface at session start and in Monday briefs

**Non-Functional:**
- Fast extraction (< 5 seconds for 100 sessions)
- Low false positive rate (< 10%)
- No external dependencies
- Privacy-preserving (all local processing)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│            Context-Aware Suggestions System             │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Extraction  │    │  Derivation  │    │   Surfacing  │
│    Layer     │    │    Layer     │    │    Layer     │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ suggestion-  │    │  derived-    │    │  context-    │
│ extractor.ts │    │ intelligence │    │ analyzer.ts  │
│              │    │      .ts     │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Component Details

#### 1. Extraction Layer (`suggestion-extractor.ts`)

**Purpose:** Extract structured intelligence from unstructured History files

**Inputs:**
- `History/Sessions/*.md` - Session summaries
- `History/Research/*.md` - Research documents
- `History/Learnings/*.md` - Learning documents

**Outputs:**
```typescript
interface ExtractionResult {
  research: ResearchThread[];  // Detected research threads
  ideas: CreativeIdea[];       // Unfinished creative ideas
  goals: GoalEntry[];          // Tracked goals
}
```

**Key Functions:**
- `extractAll()` - Main entry point
- `extractResearch()` - Find research threads
- `extractIdeas()` - Find creative ideas
- `extractGoals()` - Find goal statements

**Detection Patterns:**
- Research: "researched X", "investigated Y", "explored Z"
- Ideas: "idea:", "concept:", "what if", "TODO:"
- Goals: "goal:", "objective:", "aim to", "want to"

#### 2. Derivation Layer (`derived-intelligence.ts`)

**Purpose:** Derive actionable build opportunities from patterns

**Inputs:**
- Extracted items from suggestion-extractor
- User work patterns (from sessions)

**Outputs:**
```typescript
interface DerivedSuggestion {
  type: 'pattern' | 'gap' | 'ambition';
  title: string;
  description: string;
  confidence: number;
  suggestedAction: string;
  evidence: string[];
}
```

**Derivation Types:**
- **Patterns**: Repeated workflows → automation opportunity
- **Gaps**: Missing capabilities → build suggestion
- **Ambitions**: Stated goals → required tooling

#### 3. Surfacing Layer (`context-analyzer.ts`)

**Purpose:** Format and deliver suggestions at the right time

**Inputs:**
- Extracted items from suggestion-extractor
- Derived suggestions from derived-intelligence
- Metric alerts from threshold-monitor

**Outputs:**
- Markdown formatted suggestions
- Prioritized by high/medium/low
- Grouped by type (research/idea/goal/build)

**Integration Points:**
- Session start via `load-context-suggestions.ts` hook
- Monday briefs via `monday-brief.ts`
- Manual invocation via `/suggestions` command

### Data Flow

```
1. History Files (.md)
        ↓
2. Extraction (suggestion-extractor.ts)
        ↓
3. Analysis (derived-intelligence.ts)
        ↓
4. Formatting (context-analyzer.ts)
        ↓
5. Surfacing (hooks + skills)
        ↓
6. User sees suggestions
```

### Dependencies

**Internal:**
- History system (must exist)
- Monday brief system (optional integration)

**External:**
- Node.js fs module
- TypeScript

**No network dependencies** - 100% local processing

---

## Usage

### Basic Usage

**View suggestions:**
```bash
bun run tools/context-analyzer.ts
```

**Include git status:**
```bash
bun run tools/context-analyzer.ts --git
```

**JSON output:**
```bash
bun run tools/context-analyzer.ts --json
```

**Verbose mode:**
```bash
bun run tools/context-analyzer.ts --verbose
```

### Skill Usage

**Via skill:**
```
User: "What should I work on?"
Claude: [Invokes context-suggestions skill]
```

**Via slash command:**
```
/suggestions
```

### Output Format

**Markdown Output:**
```markdown
# Context-Aware Suggestions

## 🔴 High Priority

### 🔬 Research revival: TPU Architecture Analysis
**You researched this 46 days ago - worth revisiting**
→ **Action:** Check for updates or continue exploring

### 🔨 Build opportunity: Automate iterative editing workflow
**You've manually executed this workflow 30 times**
→ **Action:** Create a tool or skill that combines these steps
```

**Priority Levels:**
- 🔴 **High**: Stale research (30+ days), frequent patterns (5+ times)
- 🟡 **Medium**: Unfinished ideas with next steps, moderate patterns
- 🟢 **Low**: Git actions, general reminders

### Automatic Surfacing

**Session Start:**
- Automatically runs via `load-context-suggestions.ts` hook
- Shows compact terminal view + full context for Claude
- Filters to high/medium priorities only

**Monday Brief:**
- Included in Monday morning system health check
- Shows research revival and build opportunities sections

### Configuration

**Staleness Thresholds:**

Edit `tools/suggestion-extractor.ts`:
```typescript
const STALE_THRESHOLD_DAYS = 30;  // When research becomes stale
const SHALLOW_THRESHOLD = 200;     // Min chars for "deep" research
```

**Priority Thresholds:**

Edit `tools/context-analyzer.ts`:
```typescript
// Research older than X days = high priority
const staleResearch = extracted.research
  .filter(r => r.status === 'stale' && r.ageDays > 30);
```

---

## Deployment

### Prerequisites

**PAI Installation:**
- PAI installed at `~/.claude/`
- History system active
- Bun runtime installed

**Verify PAI:**
```bash
ls ~/.claude/History/
# Should show: Sessions/, Research/, Learnings/, etc.
```

### Installation Steps

#### Step 1: Copy Files

**Required files:**
```bash
# Create tools directory if needed
mkdir -p ~/.claude/../tools

# Copy extraction and analysis tools
cp tools/suggestion-extractor.ts ~/.claude/../tools/
cp tools/derived-intelligence.ts ~/.claude/../tools/
cp tools/context-analyzer.ts ~/.claude/../tools/

# Make executable
chmod +x ~/.claude/../tools/suggestion-extractor.ts
chmod +x ~/.claude/../tools/derived-intelligence.ts
chmod +x ~/.claude/../tools/context-analyzer.ts
```

#### Step 2: Install Hook

**Session start hook:**
```bash
# Copy hook
cp .claude/hooks/load-context-suggestions.ts ~/.claude/hooks/

# Verify hooks.json
cat ~/.claude/hooks.json
```

**Ensure hook is registered:**
```json
{
  "SessionStart": [
    {
      "name": "load-context-suggestions",
      "script": "load-context-suggestions.ts",
      "outputMode": "compact"
    }
  ]
}
```

#### Step 3: Install Skill

**Context suggestions skill:**
```bash
# Copy skill
cp -r .claude/skills/context-suggestions ~/.claude/skills/

# Verify
ls ~/.claude/skills/context-suggestions/
# Should show: SKILL.md
```

#### Step 4: Verify Installation

**Test extraction:**
```bash
cd ~/.claude/../tools
bun run suggestion-extractor.ts
```

**Expected output:**
```
📚 Extracted:
  - Research threads: X
  - Creative ideas: Y
  - Goals: Z
```

**Test full analysis:**
```bash
bun run context-analyzer.ts
```

**Expected output:**
- Markdown formatted suggestions
- Grouped by priority
- Shows detected patterns

**Test session start:**
```bash
# Start new Claude Code session
# Should see compact suggestions at start
```

### Configuration

**Default paths:**

Edit `tools/context-analyzer.ts`:
```typescript
const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME, '.claude');
const HISTORY_DIR = join(PAI_DIR, 'History');
```

**Custom History location:**
```bash
export PAI_DIR="/custom/path/.claude"
bun run tools/context-analyzer.ts
```

### Troubleshooting

**Issue: No suggestions found**

**Check:**
```bash
# Verify History exists
ls ~/.claude/History/Sessions/

# Check last modified
ls -lt ~/.claude/History/Sessions/ | head -5

# Run with verbose
bun run tools/context-analyzer.ts --verbose
```

**Issue: Hook not running at session start**

**Check:**
```bash
# Verify hook registration
cat ~/.claude/hooks.json | grep context-suggestions

# Check hook file exists
ls ~/.claude/hooks/load-context-suggestions.ts

# Test hook manually
cd ~/.claude/hooks
bun run load-context-suggestions.ts
```

**Issue: Extraction errors**

**Check:**
```bash
# Test extraction directly
cd ~/.claude/../tools
bun run suggestion-extractor.ts 2>&1 | tee extraction.log

# Check for TypeScript errors
cat extraction.log | grep -i error
```

### Maintenance

**Regular maintenance:**
- None required - runs automatically
- History grows naturally with usage
- Extraction is stateless (no database)

**Optional tuning:**
- Adjust staleness thresholds (30 days default)
- Modify priority levels (high/medium/low)
- Customize detection patterns

### Uninstallation

**Remove files:**
```bash
rm ~/.claude/../tools/suggestion-extractor.ts
rm ~/.claude/../tools/derived-intelligence.ts
rm ~/.claude/../tools/context-analyzer.ts
rm ~/.claude/hooks/load-context-suggestions.ts
rm -r ~/.claude/skills/context-suggestions
```

**Remove hook registration:**

Edit `~/.claude/hooks.json` and remove the `load-context-suggestions` entry.

---

## Integration Examples

### With Monday Brief

**Already integrated** - Monday brief automatically includes:
- Research revival section
- Build opportunities section

### With Custom Skills

**Create a reminder skill:**
```typescript
// In your skill
import { extractAll } from './tools/suggestion-extractor';

const extracted = extractAll();
const staleResearch = extracted.research.filter(r => r.status === 'stale');

console.log(`You have ${staleResearch.length} stale research threads`);
```

### With Metrics System

**Already integrated** - Context analyzer includes metric-driven patterns from threshold-monitor.

---

## API Reference

### suggestion-extractor.ts

```typescript
// Extract all intelligence
export function extractAll(): ExtractionResult;

// Extract specific types
export function extractResearch(files: string[]): ResearchThread[];
export function extractIdeas(files: string[]): CreativeIdea[];
export function extractGoals(files: string[]): GoalEntry[];
```

### derived-intelligence.ts

```typescript
// Analyze and derive suggestions
export function analyzeAll(): DerivedResult;

// Get top N suggestions
export function getTopSuggestions(n: number): DerivedSuggestion[];
```

### context-analyzer.ts

```typescript
// Main analysis (async if using threshold-monitor)
export async function analyzeContext(includeGit?: boolean): Promise<AnalysisResult>;

// Format for display
export function formatSuggestionsMarkdown(result: AnalysisResult): string;
```

---

## Performance

**Benchmarks** (on ~100 History files):
- Extraction: ~2 seconds
- Derivation: ~500ms
- Full analysis: ~3 seconds total

**Scaling:**
- Linear with number of History files
- No memory issues up to 1000+ files
- Caching available via telos-extractor (24h)

---

## Privacy & Security

**Data Handling:**
- 100% local processing
- No external API calls
- No data leaves your machine
- History files never modified

**Sensitive Data:**
- System respects .gitignore patterns
- No credential scanning
- User controls what's in History/

---

## Version History

**v1.0 (2026-02-03):**
- Initial release
- Extraction layer complete
- Derivation layer complete
- Session start integration
- Monday brief integration

---

## Support & Contributing

**Issues:**
- Report in PAI repository
- Include: extraction.log, context-analyzer output

**Enhancements:**
- Add new detection patterns in suggestion-extractor.ts
- Customize derivation logic in derived-intelligence.ts
- Adjust surfacing in context-analyzer.ts

---

## License

Part of Personal AI Infrastructure (PAI)
