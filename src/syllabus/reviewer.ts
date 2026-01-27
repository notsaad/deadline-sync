import inquirer from 'inquirer';
import { SyllabusDate, Assignment } from '../types/index.js';
import { createHash } from 'crypto';

export async function reviewExtractedDates(
  dates: SyllabusDate[],
  courseName: string
): Promise<Assignment[]> {
  if (dates.length === 0) {
    console.log('\nNo dates found in syllabus.\n');
    return [];
  }

  console.log(`\nFound ${dates.length} potential dates in syllabus for ${courseName}:\n`);

  const confirmed: Assignment[] = [];

  for (const extracted of dates) {
    console.log('─'.repeat(60));
    console.log(`Date: ${extracted.date.toLocaleDateString()} at ${extracted.date.toLocaleTimeString()}`);
    console.log(`Found: "${extracted.text}"`);
    console.log(`Context: ...${extracted.context}...`);
    console.log(`Confidence: ${extracted.confidence}`);

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'include',
        message: 'Add this to reminders?',
        default: extracted.confidence === 'high',
      },
      {
        type: 'input',
        name: 'title',
        message: 'Reminder title:',
        default: extracted.suggestedTitle,
        when: (ans) => ans.include,
      },
      {
        type: 'list',
        name: 'type',
        message: 'Type:',
        choices: ['exam', 'quiz', 'reading', 'assignment', 'other'],
        default: 'assignment',
        when: (ans) => ans.include,
      },
    ]);

    if (answers.include) {
      const id = createHash('sha256')
        .update(`syllabus-${courseName}-${extracted.date.toISOString()}`)
        .digest('hex')
        .substring(0, 16);

      confirmed.push({
        id,
        courseId: 'syllabus',
        courseName,
        title: answers.title,
        dueDate: extracted.date,
        type: answers.type,
        source: 'syllabus',
      });
    }
  }

  console.log(`\nConfirmed ${confirmed.length} events for reminders.\n`);
  return confirmed;
}
