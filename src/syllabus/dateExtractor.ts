import * as chrono from 'chrono-node';
import { SyllabusDate } from '../types/index.js';

// Assignment-like items that are typically already in Brightspace
const ASSIGNMENT_PATTERNS = [
  /\bassignment\s*\d*/i,
  /\bhomework\s*\d*/i,
  /\bhw\s*\d+/i,
  /\bproblem\s*set\s*\d*/i,
  /\blab\s*(report)?\s*\d*/i,
  /\bworksheet\s*\d*/i,
  /\bexercise\s*\d*/i,
];

// Non-assignment items to keep (exams, readings, etc.)
const NON_ASSIGNMENT_PATTERNS = [
  /\bmidterm/i,
  /\bfinal\s*(exam)?/i,
  /\bexam\s*\d*/i,
  /\btest\s*\d*/i,
  /\bquiz\s*\d*/i,
  /\breading/i,
  /\bpresentation/i,
  /\bproject\s*(proposal|milestone|presentation)/i,
  /\boffice\s*hours/i,
  /\blecture/i,
  /\btutorial/i,
  /\bseminar/i,
];

/**
 * Check if a date item looks like an assignment (which Brightspace handles)
 */
function isAssignmentLike(context: string, suggestedTitle: string): boolean {
  const textToCheck = `${context} ${suggestedTitle}`.toLowerCase();

  // First check if it matches non-assignment patterns (exams, readings, etc.)
  for (const pattern of NON_ASSIGNMENT_PATTERNS) {
    if (pattern.test(textToCheck)) {
      return false; // Keep it - it's not an assignment
    }
  }

  // Then check if it matches assignment patterns
  for (const pattern of ASSIGNMENT_PATTERNS) {
    if (pattern.test(textToCheck)) {
      return true; // Filter it out - it's an assignment
    }
  }

  return false; // Keep items that don't match either (generic deadlines)
}

export function extractDatesFromText(text: string, referenceDate?: Date): SyllabusDate[] {
  const results: SyllabusDate[] = [];
  const ref = referenceDate || new Date();

  // Use chrono-node with forward date preference
  const parsed = chrono.parse(text, ref, { forwardDate: true });

  for (const result of parsed) {
    const context = getContext(text, result.index, 60);
    const suggestedTitle = inferTitle(context);

    // Only include future dates
    if (result.start.date() > new Date()) {
      results.push({
        text: result.text,
        date: result.start.date(),
        context,
        confidence: assessConfidence(context, result),
        suggestedTitle,
      });
    }
  }

  // Also extract dates with academic patterns
  const academicDates = extractAcademicPatterns(text, ref);
  results.push(...academicDates);

  // Deduplicate by date (within same day)
  const deduplicated = deduplicateDates(results);

  // Filter out assignment-like items (Brightspace handles those)
  return deduplicated.filter((date) => !isAssignmentLike(date.context, date.suggestedTitle));
}

function getContext(text: string, index: number, chars: number): string {
  const start = Math.max(0, index - chars);
  const end = Math.min(text.length, index + chars);
  return text.substring(start, end).replace(/\s+/g, ' ').trim();
}

function inferTitle(context: string): string {
  const patterns = [
    /(assignment\s*\d*)/i,
    /(quiz\s*\d*)/i,
    /(midterm\s*(exam)?)/i,
    /(final\s*(exam)?)/i,
    /(project\s*\d*)/i,
    /(essay)/i,
    /(lab\s*\d*)/i,
    /(presentation)/i,
    /(report)/i,
    /(exam\s*\d*)/i,
    /(homework\s*\d*)/i,
    /(test\s*\d*)/i,
  ];

  for (const pattern of patterns) {
    const match = context.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return 'Deadline';
}

function assessConfidence(
  context: string,
  result: chrono.ParsedResult
): 'high' | 'medium' | 'low' {
  const hasAcademicKeyword =
    /assignment|quiz|exam|midterm|final|due|deadline|project|essay|submission|test/i.test(context);
  const hasSpecificTime = result.start.isCertain('hour');

  if (hasAcademicKeyword && hasSpecificTime) return 'high';
  if (hasAcademicKeyword || hasSpecificTime) return 'medium';
  return 'low';
}

function extractAcademicPatterns(text: string, ref: Date): SyllabusDate[] {
  const results: SyllabusDate[] = [];

  // Pattern: "Assignment 1 due: September 15" or "Due: January 20, 2026"
  const duePatterns = [
    /(?:assignment|project|essay|lab|quiz|homework)\s*\d*\s*(?:due|deadline)[:\s]+([A-Za-z]+\s+\d+(?:,?\s*\d{4})?)/gi,
    /due[:\s]+([A-Za-z]+\s+\d+(?:,?\s*\d{4})?)/gi,
    /(?:midterm|final|exam)\s*(?:on|:)\s*([A-Za-z]+\s+\d+(?:,?\s*\d{4})?)/gi,
  ];

  for (const pattern of duePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const dateText = match[1];
      const parsed = chrono.parseDate(dateText, ref, { forwardDate: true });

      if (parsed && parsed > new Date()) {
        results.push({
          text: match[0],
          date: parsed,
          context: getContext(text, match.index, 60),
          confidence: 'high',
          suggestedTitle: inferTitle(match[0]),
        });
      }
    }
  }

  return results;
}

function deduplicateDates(dates: SyllabusDate[]): SyllabusDate[] {
  const seen = new Map<string, SyllabusDate>();

  for (const date of dates) {
    const key = date.date.toDateString();
    const existing = seen.get(key);

    // Keep the one with higher confidence
    if (!existing || getConfidenceScore(date.confidence) > getConfidenceScore(existing.confidence)) {
      seen.set(key, date);
    }
  }

  return Array.from(seen.values());
}

function getConfidenceScore(confidence: string): number {
  switch (confidence) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}
