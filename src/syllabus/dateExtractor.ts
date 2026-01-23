import * as chrono from 'chrono-node';
import { SyllabusDate } from '../types/index.js';

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
  return deduplicateDates(results);
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
