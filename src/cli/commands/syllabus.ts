import { Command } from 'commander';
import { extractTextFromPDF } from '../../syllabus/parser.js';
import { extractDatesFromText } from '../../syllabus/dateExtractor.js';
import { reviewExtractedDates } from '../../syllabus/reviewer.js';
import { createReminder, ensureListExists } from '../../reminders/apple.js';
import { isAlreadySynced, markAsSynced } from '../../storage/database.js';
import { BrightspaceScraper } from '../../scraper/brightspace.js';
import { config } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs';

export const syllabusCommand = new Command('syllabus').description(
  'Parse syllabus PDFs for dates'
);

syllabusCommand
  .command('fetch')
  .description('Find and download syllabi from Brightspace courses')
  .option('--parse', 'Also parse downloaded syllabi for dates')
  .option('--dry-run', 'Show what would be synced without creating reminders')
  .action(async (options) => {
    try {
      console.log('Connecting to Brightspace...\n');

      const scraper = new BrightspaceScraper();
      await scraper.initialize();

      // Get all courses
      console.log('Fetching courses...');
      const courses = await scraper.getCourses();
      console.log(`Found ${courses.length} courses\n`);

      if (courses.length === 0) {
        console.log('No courses found.');
        await scraper.close();
        return;
      }

      const downloadedSyllabi: { course: string; path: string }[] = [];

      // Find syllabi for each course
      for (const course of courses) {
        console.log(`Searching for syllabus in ${course.name}...`);
        const syllabusPath = await scraper.findSyllabus(course);

        if (syllabusPath) {
          console.log(`  Found: ${syllabusPath}`);
          downloadedSyllabi.push({ course: course.name, path: syllabusPath });
        } else {
          console.log(`  No syllabus found`);
        }
      }

      await scraper.close();

      console.log(`\nDownloaded ${downloadedSyllabi.length} syllabi`);

      if (downloadedSyllabi.length === 0) {
        return;
      }

      // Optionally parse the syllabi
      if (options.parse) {
        console.log('\nParsing syllabi for dates...\n');

        for (const { course, path: syllabusPath } of downloadedSyllabi) {
          console.log(`\n--- ${course} ---`);

          try {
            const text = await extractTextFromPDF(syllabusPath);
            const dates = extractDatesFromText(text);

            if (dates.length === 0) {
              console.log('No dates found in this syllabus.');
              continue;
            }

            console.log(`Found ${dates.length} potential dates (exams, readings, etc.)`);

            // Interactive review
            const confirmed = await reviewExtractedDates(dates, course);

            if (confirmed.length === 0) {
              console.log('No dates confirmed for import.');
              continue;
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
              continue;
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
              continue;
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

            console.log(`Created ${created} reminders from ${course} syllabus.`);
          } catch (error) {
            console.error(`Error parsing ${course} syllabus: ${error}`);
          }
        }
      } else {
        console.log('\nTo parse these syllabi for dates, run:');
        for (const { course, path: syllabusPath } of downloadedSyllabi) {
          console.log(`  deadline-sync syllabus add "${syllabusPath}" -c "${course}"`);
        }
        console.log('\nOr re-run with --parse to process all at once.');
      }
    } catch (error) {
      logger.error(`Syllabus fetch failed: ${error}`);

      if (
        String(error).includes('session expired') ||
        String(error).includes('No session') ||
        String(error).includes('Session expired')
      ) {
        console.error('\nSession expired. Please run "deadline-sync login" to refresh.');
        process.exit(2);
      }

      console.error(`Error: ${error}`);
      process.exit(1);
    }
  });

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
