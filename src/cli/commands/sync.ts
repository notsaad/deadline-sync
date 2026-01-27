import { Command } from 'commander';
import { BrightspaceScraper } from '../../scraper/brightspace.js';
import { createReminder, ensureListExists } from '../../reminders/apple.js';
import {
  isAlreadySynced,
  markAsSynced,
  logSyncStart,
  logSyncComplete,
  logSyncError,
} from '../../storage/database.js';
import { config } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { Assignment } from '../../types/index.js';

export const syncCommand = new Command('sync')
  .description('Sync Brightspace deadlines to Apple Reminders')
  .option('--dry-run', 'Show what would be synced without creating reminders')
  .action(async (options) => {
    const logId = await logSyncStart();
    let remindersCreated = 0;

    try {
      console.log('Starting sync...\n');

      const scraper = new BrightspaceScraper();
      await scraper.initialize();

      // Get all courses
      console.log('Fetching courses...');
      const courses = await scraper.getCourses();
      console.log(`Found ${courses.length} courses\n`);

      if (courses.length === 0) {
        console.log('No courses found. Make sure you are enrolled in courses.');
        await scraper.close();
        await logSyncComplete(logId, 0);
        return;
      }

      // Collect all assignments
      const allAssignments: Assignment[] = [];
      for (const course of courses) {
        console.log(`Checking ${course.name}...`);
        const assignments = await scraper.getAssignments(course);
        allAssignments.push(...assignments);
      }

      await scraper.close();

      // Filter out already synced
      const newAssignments: Assignment[] = [];
      for (const a of allAssignments) {
        if (!(await isAlreadySynced(a.id))) {
          newAssignments.push(a);
        }
      }

      console.log(`\nFound ${allAssignments.length} total assignments`);
      console.log(`${newAssignments.length} new assignments to sync\n`);

      if (newAssignments.length === 0) {
        console.log('Nothing new to sync!');
        await logSyncComplete(logId, 0);
        return;
      }

      if (options.dryRun) {
        console.log('DRY RUN - Would create these reminders:\n');
        for (const assignment of newAssignments) {
          const remindDate = new Date(assignment.dueDate);
          remindDate.setDate(remindDate.getDate() - config.reminders.advanceDays);

          const typeLabel = assignment.type.charAt(0).toUpperCase() + assignment.type.slice(1);
          console.log(`  ${assignment.courseName} - ${typeLabel} - ${assignment.title}`);
          console.log(`    Due: ${assignment.dueDate.toLocaleDateString()} at ${assignment.dueDate.toLocaleTimeString()}`);
          console.log(`    Remind: ${remindDate.toLocaleDateString()} (${config.reminders.advanceDays} days before)`);
          console.log('');
        }
        console.log(`Total: ${newAssignments.length} reminders would be created in "${config.reminders.listName}" list`);
        return;
      }

      // Create reminders
      ensureListExists(config.reminders.listName);

      for (const assignment of newAssignments) {
        try {
          createReminder(assignment);
          await markAsSynced(assignment);
          remindersCreated++;
          console.log(`Created: ${assignment.courseName} - ${assignment.title}`);
        } catch (error) {
          logger.error(`Failed to create reminder: ${error}`);
          console.error(`Failed: ${assignment.title}`);
        }
      }

      console.log(`\nSync complete! Created ${remindersCreated} reminders.`);
      await logSyncComplete(logId, remindersCreated);
    } catch (error) {
      logger.error(`Sync failed: ${error}`);
      await logSyncError(logId, String(error));

      if (
        String(error).includes('session expired') ||
        String(error).includes('No session') ||
        String(error).includes('Session expired')
      ) {
        console.error('\nSession expired. Please run "deadline-sync login" to refresh.');
        process.exit(2);
      }

      console.error(`\nSync failed: ${error}`);
      process.exit(1);
    }
  });
