#!/usr/bin/env bun

/**
 * suggestion-extractor.ts
 *
 * Extracts high-value intelligence from History:
 * - Research threads worth revisiting
 * - Unfinished creative ideas
 * - Goals and progress tracking
 *
 * This replaces the low-value git-focused suggestions with
 * personally meaningful content.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';

const PAI_DIR = process.env.PAI_DIR || join(process.env.HOME!, '.claude');
const HISTORY_DIR = join(PAI_DIR, 'History');

// Types
export interface ExtractedItem {
  type: 'research' | 'idea' | 'goal';
  topic: string;
  summary: string;
  date: Date;
  ageDays: number;
  depth: 'shallow' | 'moderate' | 'deep';
  status: 'active' | 'stale' | 'abandoned';
  sourcePath: string;
  entities: string[];
  nextSteps?: string[];
}

export interface ExtractionResult {
  timestamp: Date;
  research: ExtractedItem[];
  ideas: ExtractedItem[];
  goals: ExtractedItem[];
}

/**
 * Calculate depth based on content characteristics
 */
function calculateDepth(content: string): 'shallow' | 'moderate' | 'deep' {
  const wordCount = content.split(/\s+/).length;
  const hasHeaders = (content.match(/^#{1,3}\s/gm) || []).length;
  const hasSources = content.toLowerCase().includes('source') ||
                     content.toLowerCase().includes('reference') ||
                     content.includes('http');

  if (wordCount > 2000 || (hasHeaders > 5 && hasSources)) return 'deep';
  if (wordCount > 500 || hasHeaders > 2) return 'moderate';
  return 'shallow';
}

/**
 * Extract key entities (companies, technologies, people) from content
 */
function extractEntities(content: string): string[] {
  const entities: Set<string> = new Set();

  // Technology patterns
  const techPatterns = [
    /\b(TPU|GPU|NVIDIA|AMD|Intel|Google|OpenAI|Anthropic|Microsoft|Apple)\b/gi,
    /\b(TypeScript|Python|JavaScript|Rust|Go)\b/g,
    /\b(Claude|GPT|Gemini|LLaMA|DeepSeek)\b/gi,
    /\b(AI|ML|LLM|NLP|API)\b/g,
  ];

  for (const pattern of techPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(m => entities.add(m));
    }
  }

  return Array.from(entities).slice(0, 10);
}

/**
 * Extract next steps from content
 */
function extractNextSteps(content: string): string[] {
  const nextSteps: string[] = [];
  const lines = content.split('\n');

  let inNextSection = false;
  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Detect next steps section
    if (lowerLine.includes('next step') || lowerLine.includes('next:') ||
        lowerLine.includes('todo') || lowerLine.includes('to explore')) {
      inNextSection = true;
      continue;
    }

    // Capture bullet points in next section
    if (inNextSection && line.match(/^[\s]*[-*•]\s/)) {
      const step = line.replace(/^[\s]*[-*•]\s/, '').trim();
      if (step.length > 5 && step.length < 200) {
        nextSteps.push(step);
      }
    }

    // End section on new header
    if (inNextSection && line.match(/^#{1,3}\s/)) {
      inNextSection = false;
    }
  }

  return nextSteps.slice(0, 5);
}

/**
 * Extract topic from filename or content
 */
function extractTopic(filePath: string, content: string): string {
  const filename = basename(filePath, '.md');

  // Try to get from first H1 header
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Clean up filename
  // Remove date prefix like "2025-12-18_" or "2026-01-30-"
  let topic = filename.replace(/^\d{4}-\d{2}-\d{2}[-_]?/, '');
  // Remove SESSION suffix
  topic = topic.replace(/_SESSION.*$/, '');
  // Convert dashes/underscores to spaces
  topic = topic.replace(/[-_]/g, ' ');
  // Title case
  topic = topic.replace(/\b\w/g, c => c.toUpperCase());

  return topic || 'Untitled';
}

/**
 * Extract summary from content
 */
function extractSummary(content: string): string {
  // Try executive summary
  const execMatch = content.match(/## Executive Summary\s+(.+?)(?=\n#|\n\n\n)/s);
  if (execMatch) {
    return execMatch[1].trim().substring(0, 300);
  }

  // Try overview section
  const overviewMatch = content.match(/## (?:Overview|Summary)\s+(.+?)(?=\n#|\n\n\n)/s);
  if (overviewMatch) {
    return overviewMatch[1].trim().substring(0, 300);
  }

  // Fall back to first substantial paragraph
  const paragraphs = content.split(/\n\n+/);
  for (const p of paragraphs) {
    const cleaned = p.replace(/^#+\s.*$/gm, '').trim();
    if (cleaned.length > 50 && !cleaned.startsWith('---') && !cleaned.startsWith('```')) {
      return cleaned.substring(0, 300);
    }
  }

  return 'No summary available';
}

/**
 * Get files from directory recursively
 */
function getFiles(dir: string, daysBack: number = 90): Array<{ path: string; mtime: Date; content: string }> {
  if (!existsSync(dir)) return [];

  const cutoffDate = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
  const files: Array<{ path: string; mtime: Date; content: string }> = [];

  function walk(currentDir: string) {
    try {
      const entries = readdirSync(currentDir);
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;

        const fullPath = join(currentDir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (entry.endsWith('.md') && stat.mtime.getTime() > cutoffDate) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            files.push({ path: fullPath, mtime: stat.mtime, content });
          } catch (e) {
            // Skip unreadable files
          }
        }
      }
    } catch (error) {
      // Skip unreadable directories
    }
  }

  walk(dir);
  return files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

/**
 * Extract research threads from History/Research and sessions
 */
export function extractResearch(daysBack: number = 90): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  const now = Date.now();

  // Primary: History/Research directory
  const researchFiles = getFiles(join(HISTORY_DIR, 'Research'), daysBack);

  for (const file of researchFiles) {
    // Skip README files
    if (basename(file.path).toLowerCase() === 'readme.md') continue;

    const ageDays = Math.floor((now - file.mtime.getTime()) / (1000 * 60 * 60 * 24));

    items.push({
      type: 'research',
      topic: extractTopic(file.path, file.content),
      summary: extractSummary(file.content),
      date: file.mtime,
      ageDays,
      depth: calculateDepth(file.content),
      status: ageDays > 30 ? 'stale' : 'active',
      sourcePath: file.path,
      entities: extractEntities(file.content),
      nextSteps: extractNextSteps(file.content)
    });
  }

  // Secondary: Sessions with research-like content
  const sessionFiles = getFiles(join(HISTORY_DIR, 'Sessions'), daysBack);

  for (const file of sessionFiles) {
    const lowerContent = file.content.toLowerCase();

    // Look for research indicators
    const isResearch = lowerContent.includes('research') ||
                       lowerContent.includes('investigation') ||
                       lowerContent.includes('analysis') ||
                       (lowerContent.includes('sources') && lowerContent.includes('findings'));

    if (isResearch && calculateDepth(file.content) !== 'shallow') {
      const ageDays = Math.floor((now - file.mtime.getTime()) / (1000 * 60 * 60 * 24));

      // Avoid duplicates by checking topic similarity
      const topic = extractTopic(file.path, file.content);
      const isDuplicate = items.some(i =>
        i.topic.toLowerCase().includes(topic.toLowerCase().split(' ')[0])
      );

      if (!isDuplicate) {
        items.push({
          type: 'research',
          topic,
          summary: extractSummary(file.content),
          date: file.mtime,
          ageDays,
          depth: calculateDepth(file.content),
          status: ageDays > 30 ? 'stale' : 'active',
          sourcePath: file.path,
          entities: extractEntities(file.content),
          nextSteps: extractNextSteps(file.content)
        });
      }
    }
  }

  return items;
}

/**
 * Extract unfinished ideas from sessions and scratchpad
 */
export function extractIdeas(daysBack: number = 60): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  const now = Date.now();
  const PAI_ROOT = dirname(PAI_DIR);

  // Check scratchpad for unfinished work
  const scratchpadDir = join(PAI_ROOT, 'scratchpad');
  if (existsSync(scratchpadDir)) {
    const scratchFiles = getFiles(scratchpadDir, daysBack);

    for (const file of scratchFiles) {
      const ageDays = Math.floor((now - file.mtime.getTime()) / (1000 * 60 * 60 * 24));

      // Scratchpad files are inherently "unfinished" if not deleted
      items.push({
        type: 'idea',
        topic: extractTopic(file.path, file.content),
        summary: extractSummary(file.content),
        date: file.mtime,
        ageDays,
        depth: calculateDepth(file.content),
        status: ageDays > 14 ? 'abandoned' : (ageDays > 7 ? 'stale' : 'active'),
        sourcePath: file.path,
        entities: extractEntities(file.content),
        nextSteps: extractNextSteps(file.content)
      });
    }
  }

  // Check sessions for WIP/exploring content
  const sessionFiles = getFiles(join(HISTORY_DIR, 'Sessions'), daysBack);

  const ideaKeywords = ['exploring', 'idea', 'experiment', 'prototype', 'draft', 'wip', 'trying'];

  for (const file of sessionFiles) {
    const lowerContent = file.content.toLowerCase();
    const hasIdeaKeywords = ideaKeywords.some(kw => lowerContent.includes(kw));
    const hasNextSteps = extractNextSteps(file.content).length > 0;

    if (hasIdeaKeywords || hasNextSteps) {
      const ageDays = Math.floor((now - file.mtime.getTime()) / (1000 * 60 * 60 * 24));

      const topic = extractTopic(file.path, file.content);
      const isDuplicate = items.some(i =>
        i.topic.toLowerCase() === topic.toLowerCase()
      );

      if (!isDuplicate && hasNextSteps) {
        items.push({
          type: 'idea',
          topic,
          summary: extractSummary(file.content),
          date: file.mtime,
          ageDays,
          depth: calculateDepth(file.content),
          status: ageDays > 14 ? 'abandoned' : (ageDays > 7 ? 'stale' : 'active'),
          sourcePath: file.path,
          entities: extractEntities(file.content),
          nextSteps: extractNextSteps(file.content)
        });
      }
    }
  }

  return items;
}

/**
 * Extract goals from sessions
 */
export function extractGoals(daysBack: number = 30): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  const now = Date.now();

  const sessionFiles = getFiles(join(HISTORY_DIR, 'Sessions'), daysBack);

  const goalPatterns = [
    /(?:goal|objective|target|aim):\s*(.+)/gi,
    /(?:working toward|building|creating|implementing):\s*(.+)/gi,
    /(?:i want to|need to|planning to)\s+(.+)/gi,
  ];

  const progressPatterns = [
    /(\d+)%\s*(?:complete|done|finished)/gi,
    /(?:step|phase)\s*(\d+)\s*(?:of|\/)\s*(\d+)/gi,
  ];

  for (const file of sessionFiles) {
    const content = file.content;
    const goals: string[] = [];

    // Extract explicit goals
    for (const pattern of goalPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const goal = match[1].trim();
        if (goal.length > 10 && goal.length < 200) {
          goals.push(goal);
        }
      }
    }

    // Check CAPTURE section for goals
    const captureMatch = content.match(/CAPTURE:\s*(.+?)(?=\n[A-Z]+:|$)/s);
    if (captureMatch) {
      const captureContent = captureMatch[1];
      if (captureContent.toLowerCase().includes('goal') ||
          captureContent.toLowerCase().includes('objective')) {
        goals.push(captureContent.trim().substring(0, 200));
      }
    }

    if (goals.length > 0) {
      const ageDays = Math.floor((now - file.mtime.getTime()) / (1000 * 60 * 60 * 24));

      // Check for progress indicators
      let progressNote = '';
      for (const pattern of progressPatterns) {
        const match = content.match(pattern);
        if (match) {
          progressNote = match[0];
          break;
        }
      }

      items.push({
        type: 'goal',
        topic: goals[0],
        summary: progressNote || `Goal from ${file.mtime.toLocaleDateString()}`,
        date: file.mtime,
        ageDays,
        depth: 'moderate',
        status: ageDays > 14 ? 'stale' : 'active',
        sourcePath: file.path,
        entities: extractEntities(content),
        nextSteps: extractNextSteps(content)
      });
    }
  }

  // Deduplicate similar goals
  const uniqueGoals: ExtractedItem[] = [];
  for (const goal of items) {
    const isDuplicate = uniqueGoals.some(g => {
      const similarity = goal.topic.toLowerCase().split(' ')
        .filter(w => g.topic.toLowerCase().includes(w)).length;
      return similarity > 2;
    });
    if (!isDuplicate) {
      uniqueGoals.push(goal);
    }
  }

  return uniqueGoals;
}

/**
 * Main extraction function
 */
export function extractAll(): ExtractionResult {
  return {
    timestamp: new Date(),
    research: extractResearch(),
    ideas: extractIdeas(),
    goals: extractGoals()
  };
}

// CLI execution
if (import.meta.main) {
  const result = extractAll();

  console.log('\n=== EXTRACTION RESULTS ===\n');

  console.log(`Research Threads: ${result.research.length}`);
  for (const r of result.research.slice(0, 5)) {
    console.log(`  - ${r.topic} (${r.ageDays} days ago, ${r.depth})`);
  }

  console.log(`\nUnfinished Ideas: ${result.ideas.length}`);
  for (const i of result.ideas.slice(0, 5)) {
    console.log(`  - ${i.topic} (${i.status})`);
  }

  console.log(`\nGoals: ${result.goals.length}`);
  for (const g of result.goals.slice(0, 5)) {
    console.log(`  - ${g.topic}`);
  }
}
