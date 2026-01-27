import { Command } from 'commander';
import { extractTextFromPDF } from '../../syllabus/parser.js';
import { extractDatesFromText } from '../../syllabus/dateExtractor.js';
import { reviewExtractedDates } from '../../syllabus/reviewer.js';
import { createReminder, ensureListExists } from '../../reminders/apple.js';
import { isAlreadySynced, markAsSynced } from '../../storage/database.js';
import { config } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs';

export const syllabusCommand = new Command('syllabus').description(
  'Parse syllabus PDFs for dates'
);

syllabusCommand
  .command('add <file>')
  .description('Add dates from a syllabus PDF')
  .requiredOption('-c, --course <name>', 'Course name')
  .option('--dry-run', 'Show what would be synced without creating reminders')
  .action(async (file, options) => {
    try {
      if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        process.exit(1);
      }

      console.log(`\nParsing syllabus: ${file}`);
      console.log(`Course: ${options.course}\n`);

      // Extract text from PDF
      const text = await extractTextFromPDF(file);

      // Extract dates
      const dates = extractDatesFromText(text);

      // Interactive review
      const confirmed = await reviewExtractedDates(dates, options.course);

      if (confirmed.length === 0) {
        console.log('No dates confirmed for import.');
        return;
      }

      // Filter already synced
      const newEvents = [];
      for (const a of confirmed) {
        if (!(await isAlreadySynced(a.id))) {
          newEvents.push(a);
        }
      }

      if (newEvents.length === 0) {
        console.log('All confirmed dates are already synced.');
        return;
      }

      if (options.dryRun) {
        console.log('\nDRY RUN - Would create these reminders:\n');
        for (const event of newEvents) {
          const remindDate = new Date(event.dueDate);
          remindDate.setDate(remindDate.getDate() - config.reminders.advanceDays);

          console.log(`  [${event.type.toUpperCase()}] ${event.title}`);
          console.log(`    Course: ${event.courseName}`);
          console.log(`    Due: ${event.dueDate.toLocaleDateString()} at ${event.dueDate.toLocaleTimeString()}`);
          console.log(`    Remind: ${remindDate.toLocaleDateString()} (${config.reminders.advanceDays} days before)`);
          console.log('');
        }
        console.log(`Total: ${newEvents.length} reminders would be created in "${config.reminders.listName}" list`);
        return;
      }

      // Create reminders
      ensureListExists(config.reminders.listName);

      let created = 0;
      for (const event of newEvents) {
        try {
          createReminder(event);
          await markAsSynced(event);
          created++;
          console.log(`Created: ${event.title}`);
        } catch (error) {
          console.error(`Failed: ${event.title}`);
        }
      }

      console.log(`\nCreated ${created} reminders from syllabus.`);
    } catch (error) {
      logger.error(`Syllabus parsing failed: ${error}`);
      console.error(`Error: ${error}`);
      process.exit(1);
    }
  });
