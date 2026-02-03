#!/usr/bin/env bun

/**
 * derived-intelligence.ts
 *
 * Analyzes work patterns to suggest NEW capabilities:
 * - Pattern-based: Skills/tools for repeated actions
 * - Gap-based: Automation for manual friction
 * - Ambition-based: Capabilities to go deeper on interests
 *
 * This is the "proactive intelligence" layer that suggests
 * what you SHOULD build based on how you work.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const HISTORY_DIR = join(PAI_DIR, 'History');
const SKILLS_DIR = join(PAI_DIR, 'skills');

// Types
export interface DerivedSuggestion {
  type: 'pattern' | 'gap' | 'ambition';
  confidence: number; // 0-100
  title: string;
  description: string;
  reasoning: string;
  suggestedAction: string;
  evidence: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface DerivedResult {
  timestamp: Date;
  patterns: DerivedSuggestion[];
  gaps: DerivedSuggestion[];
  ambitions: DerivedSuggestion[];
}

/**
 * Get existing skill names
 */
function getExistingSkills(): string[] {
  if (!existsSync(SKILLS_DIR)) return [];

  try {
    const entries = readdirSync(SKILLS_DIR);
    return entries.filter(e => {
      const skillPath = join(SKILLS_DIR, e);
      return statSync(skillPath).isDirectory() ||
             e.endsWith('.md');
    }).map(e => e.replace('.md', '').toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Get recent session files
 */
function getRecentSessions(daysBack: number = 30): Array<{ path: string; content: string; date: Date }> {
  const sessionsDir = join(HISTORY_DIR, 'Sessions');
  if (!existsSync(sessionsDir)) return [];

  const cutoffDate = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
  const sessions: Array<{ path: string; content: string; date: Date }> = [];

  function walk(dir: string) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.md') && stat.mtime.getTime() > cutoffDate) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            sessions.push({ path: fullPath, content, date: stat.mtime });
          } catch {}
        }
      }
    } catch {}
  }

  walk(sessionsDir);
  return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Analyze patterns - repeated actions that could become skills
 */
export function analyzePatterns(sessions: Array<{ path: string; content: string; date: Date }>): DerivedSuggestion[] {
  const suggestions: DerivedSuggestion[] = [];

  // Track action patterns
  const actionCounts: Record<string, { count: number; sessions: string[]; examples: string[] }> = {};

  // Patterns to detect
  const actionPatterns: Array<{ pattern: RegExp; category: string; description: string }> = [
    {
      pattern: /(?:research|investigate|analyze|study)\s+(?:about\s+)?([a-z\s]+)/gi,
      category: 'research',
      description: 'Research tasks'
    },
    {
      pattern: /(?:create|generate|build)\s+(?:a\s+)?(?:presentation|pptx|slides)/gi,
      category: 'presentations',
      description: 'Presentation creation'
    },
    {
      pattern: /(?:extract|summarize|analyze)\s+(?:from\s+)?(?:url|website|article|content)/gi,
      category: 'content-extraction',
      description: 'Content extraction from web'
    },
    {
      pattern: /(?:format|style|convert)\s+(?:as\s+)?(?:story|narrative|blog)/gi,
      category: 'story-formatting',
      description: 'Story/narrative formatting'
    },
    {
      pattern: /(?:compare|contrast|evaluate)\s+(?:between\s+)?([a-z\s]+)/gi,
      category: 'comparison',
      description: 'Comparison analysis'
    },
    {
      pattern: /(?:diagram|visualize|chart|graph)\s+(?:the\s+)?([a-z\s]+)/gi,
      category: 'visualization',
      description: 'Data visualization'
    },
    {
      pattern: /(?:review|audit|check)\s+(?:the\s+)?(?:code|security|performance)/gi,
      category: 'code-review',
      description: 'Code review tasks'
    },
  ];

  for (const session of sessions) {
    const content = session.content.toLowerCase();

    for (const { pattern, category, description } of actionPatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        if (!actionCounts[category]) {
          actionCounts[category] = { count: 0, sessions: [], examples: [] };
        }
        actionCounts[category].count++;
        actionCounts[category].sessions.push(basename(session.path));
        if (actionCounts[category].examples.length < 3) {
          actionCounts[category].examples.push(matches[0]);
        }
      }
    }
  }

  // Generate suggestions for patterns appearing 3+ times
  const existingSkills = getExistingSkills();

  for (const [category, data] of Object.entries(actionCounts)) {
    if (data.count >= 3) {
      // Check if skill already exists
      const hasSkill = existingSkills.some(s =>
        s.includes(category) || category.includes(s)
      );

      if (!hasSkill) {
        const confidence = Math.min(95, 50 + (data.count * 10));

        suggestions.push({
          type: 'pattern',
          confidence,
          title: `Create ${category} skill`,
          description: `You've done ${category} tasks ${data.count} times in recent sessions`,
          reasoning: `Pattern detected across ${data.sessions.length} sessions. Examples: ${data.examples.slice(0, 2).join(', ')}`,
          suggestedAction: `Create a ${category} skill to standardize and accelerate this workflow`,
          evidence: data.sessions.slice(0, 5),
          priority: data.count >= 5 ? 'high' : 'medium'
        });
      }
    }
  }

  return suggestions;
}

/**
 * Analyze gaps - manual multi-step workflows that could be automated
 */
export function analyzeGaps(sessions: Array<{ path: string; content: string; date: Date }>): DerivedSuggestion[] {
  const suggestions: DerivedSuggestion[] = [];

  // Track tool sequences
  const toolSequences: Record<string, { count: number; sessions: string[] }> = {};

  // Common manual workflows to detect
  const workflowPatterns: Array<{ tools: string[]; name: string; automation: string }> = [
    {
      tools: ['WebFetch', 'Read', 'Write'],
      name: 'web-to-file',
      automation: 'Fetch web content and save to structured file'
    },
    {
      tools: ['Read', 'Edit', 'Read'],
      name: 'iterative-editing',
      automation: 'Multi-pass file editing workflow'
    },
    {
      tools: ['Grep', 'Read', 'Edit'],
      name: 'find-and-fix',
      automation: 'Search, review, and fix pattern'
    },
    {
      tools: ['Task', 'Task', 'Task'],
      name: 'parallel-research',
      automation: 'Multi-agent parallel research'
    },
  ];

  for (const session of sessions) {
    // Extract tool usage from session
    const toolMatches = session.content.match(/## Tools Used\s+([\s\S]*?)(?=\n##|$)/);
    if (toolMatches) {
      const toolsSection = toolMatches[1];
      const usedTools = toolsSection.match(/- (\w+)/g)?.map(t => t.replace('- ', '')) || [];

      // Check for workflow patterns
      for (const { tools, name, automation } of workflowPatterns) {
        const hasWorkflow = tools.every(t => usedTools.includes(t));
        if (hasWorkflow) {
          if (!toolSequences[name]) {
            toolSequences[name] = { count: 0, sessions: [] };
          }
          toolSequences[name].count++;
          toolSequences[name].sessions.push(basename(session.path));
        }
      }
    }
  }

  // Generate suggestions for repeated workflows
  for (const [workflow, data] of Object.entries(toolSequences)) {
    if (data.count >= 2) {
      const confidence = Math.min(90, 40 + (data.count * 15));

      suggestions.push({
        type: 'gap',
        confidence,
        title: `Automate ${workflow.replace(/-/g, ' ')} workflow`,
        description: `You've manually executed this workflow ${data.count} times`,
        reasoning: `Repeated manual steps detected. This could be a single command or skill.`,
        suggestedAction: `Create a tool or skill that combines these steps into one action`,
        evidence: data.sessions.slice(0, 5),
        priority: data.count >= 4 ? 'high' : 'medium'
      });
    }
  }

  return suggestions;
}

/**
 * Analyze ambitions - research topics that could become deeper capabilities
 */
export function analyzeAmbitions(sessions: Array<{ path: string; content: string; date: Date }>): DerivedSuggestion[] {
  const suggestions: DerivedSuggestion[] = [];
  const existingSkills = getExistingSkills();

  // Track research topics
  const topicDepth: Record<string, { sessions: number; totalWords: number; entities: string[] }> = {};

  // Extract topics from research content
  const topicPatterns = [
    /(?:researching|studying|analyzing|investigating)\s+([a-z\s]+?)(?:\.|,|\n)/gi,
    /(?:TPU|GPU|LLM|AI|ML|hardware|chip|model)\s+(?:architecture|strategy|analysis|design)/gi,
    /(?:industry|market|competitive)\s+(?:analysis|research|landscape)/gi,
  ];

  for (const session of sessions) {
    const content = session.content;
    const wordCount = content.split(/\s+/).length;

    for (const pattern of topicPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const topic = match.toLowerCase().trim();
          if (topic.length > 5) {
            if (!topicDepth[topic]) {
              topicDepth[topic] = { sessions: 0, totalWords: 0, entities: [] };
            }
            topicDepth[topic].sessions++;
            topicDepth[topic].totalWords += wordCount;
          }
        }
      }
    }
  }

  // Check History/Research for deep dives
  const researchDir = join(HISTORY_DIR, 'Research');
  if (existsSync(researchDir)) {
    try {
      const walkResearch = (dir: string) => {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            walkResearch(fullPath);
          } else if (entry.endsWith('.md')) {
            try {
              const content = readFileSync(fullPath, 'utf-8');
              const title = entry.replace('.md', '').replace(/^\d{4}-\d{2}-\d{2}[-_]?/, '');

              if (!topicDepth[title.toLowerCase()]) {
                topicDepth[title.toLowerCase()] = { sessions: 0, totalWords: 0, entities: [] };
              }
              topicDepth[title.toLowerCase()].sessions++;
              topicDepth[title.toLowerCase()].totalWords += content.split(/\s+/).length;
            } catch {}
          }
        }
      };
      walkResearch(researchDir);
    } catch {}
  }

  // Generate ambition-based suggestions for deep research
  for (const [topic, data] of Object.entries(topicDepth)) {
    const isDeep = data.totalWords > 2000 || data.sessions >= 2;

    if (isDeep) {
      // Check if related skill exists
      const topicWords = topic.split(/\s+/);
      const hasRelatedSkill = existingSkills.some(s =>
        topicWords.some(w => w.length > 4 && s.includes(w))
      );

      if (!hasRelatedSkill) {
        const confidence = Math.min(85, 30 + Math.floor(data.totalWords / 100) + (data.sessions * 10));

        // Generate skill name from topic
        const skillName = topic
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .substring(0, 30);

        suggestions.push({
          type: 'ambition',
          confidence,
          title: `Build ${skillName} tracker/analyzer`,
          description: `You've invested significant effort researching ${topic}`,
          reasoning: `${data.totalWords} words across ${data.sessions} sessions suggests deep interest`,
          suggestedAction: `Create a skill to systematically track ${topic} - news, developments, analysis`,
          evidence: [`${data.sessions} sessions`, `${data.totalWords} words researched`],
          priority: data.totalWords > 3000 ? 'high' : 'medium'
        });
      }
    }
  }

  return suggestions;
}

/**
 * Main analysis function
 */
export function analyzeAll(): DerivedResult {
  const sessions = getRecentSessions(30);

  return {
    timestamp: new Date(),
    patterns: analyzePatterns(sessions),
    gaps: analyzeGaps(sessions),
    ambitions: analyzeAmbitions(sessions)
  };
}

/**
 * Get top suggestions prioritized by impact
 */
export function getTopSuggestions(limit: number = 3): DerivedSuggestion[] {
  const result = analyzeAll();

  // Combine all suggestions
  const all = [
    ...result.patterns,
    ...result.gaps,
    ...result.ambitions
  ];

  // Sort by priority then confidence
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  all.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.confidence - a.confidence;
  });

  return all.slice(0, limit);
}

/**
 * NEW: Analyze patterns from metric summaries (Phase 3 integration)
 */
export function analyzePatternsFromMetrics(summaries: any[]): DerivedSuggestion[] {
  const suggestions: DerivedSuggestion[] = [];

  // Aggregate sequences across period
  const totalSequences: Record<string, number> = {};
  const toolFrequency: Record<string, { total: number; sessions: number }> = {};

  for (const summary of summaries) {
    for (const seq of (summary.sameToolSequences || [])) {
      totalSequences[seq.pattern] = (totalSequences[seq.pattern] || 0) + seq.count;
    }

    for (const tool of (summary.highFrequencyTools || [])) {
      if (!toolFrequency[tool.tool]) {
        toolFrequency[tool.tool] = { total: 0, sessions: 0 };
      }
      toolFrequency[tool.tool].total += tool.count;
      toolFrequency[tool.tool].sessions += summary.sessionCount;
    }
  }

  // Gap-based: repeated sequences
  for (const [pattern, count] of Object.entries(totalSequences)) {
    if (count >= 5) {
      suggestions.push({
        type: 'gap',
        confidence: Math.min(90, 40 + count * 8),
        title: `Automate ${pattern} workflow`,
        description: `This sequence appeared ${count} times recently`,
        reasoning: 'Metric-driven gap detection',
        suggestedAction: `Build automation for ${pattern} pattern`,
        evidence: [`${count} occurrences`],
        priority: count >= 10 ? 'high' : 'medium'
      });
    }
  }

  // Pattern-based: high-frequency tools
  for (const [tool, data] of Object.entries(toolFrequency)) {
    const avg = data.total / data.sessions;
    if (avg >= 8) {
      suggestions.push({
        type: 'pattern',
        confidence: 85,
        title: `Enhance ${tool} workflow`,
        description: `${tool} used ${data.total} times (${avg.toFixed(1)}/session)`,
        reasoning: 'High-frequency tool suggests enhancement opportunity',
        suggestedAction: `Build wrapper or automation around ${tool}`,
        evidence: [`${data.total} calls`],
        priority: avg >= 15 ? 'high' : 'medium'
      });
    }
  }

  return suggestions;
}

// CLI execution
if (import.meta.main) {
  const result = analyzeAll();

  console.log('\n=== DERIVED INTELLIGENCE ===\n');

  console.log('Pattern-based Suggestions:');
  for (const s of result.patterns) {
    console.log(`  [${s.confidence}%] ${s.title}`);
    console.log(`    ${s.reasoning}`);
  }

  console.log('\nGap-based Suggestions:');
  for (const s of result.gaps) {
    console.log(`  [${s.confidence}%] ${s.title}`);
    console.log(`    ${s.reasoning}`);
  }

  console.log('\nAmbition-based Suggestions:');
  for (const s of result.ambitions) {
    console.log(`  [${s.confidence}%] ${s.title}`);
    console.log(`    ${s.reasoning}`);
  }

  console.log('\n--- Top 3 Suggestions ---');
  const top = getTopSuggestions(3);
  for (const s of top) {
    console.log(`\n[${s.type.toUpperCase()}] ${s.title}`);
    console.log(`  ${s.description}`);
    console.log(`  Action: ${s.suggestedAction}`);
  }
}
