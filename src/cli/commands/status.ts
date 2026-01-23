import { Command } from 'commander';
import { getSyncedReminders } from '../../storage/database.js';
import { sessionExists, loadSession, isSessionValid } from '../../scraper/session.js';
import dayjs from 'dayjs';

export const statusCommand = new Command('status')
  .description('Show sync status')
  .option('--events', 'List all synced events')
  .action(async (options) => {
    // Check session status
    console.log('\n=== Session Status ===');
    if (await sessionExists()) {
      const context = await loadSession();
      if (context) {
        const valid = await isSessionValid(context);
        await context.browser()?.close();
        console.log(`Session: ${valid ? 'Valid' : 'Expired'}`);
      } else {
        console.log('Session: Could not load');
      }
    } else {
      console.log('Session: Not logged in');
    }

    // Get synced reminders
    const reminders = await getSyncedReminders();

    console.log('\n=== Sync Statistics ===');
    console.log(`Total synced: ${reminders.length}`);

    const fromBrightspace = reminders.filter((r) => r.source === 'brightspace').length;
    const fromSyllabus = reminders.filter((r) => r.source === 'syllabus').length;
    console.log(`From Brightspace: ${fromBrightspace}`);
    console.log(`From Syllabus: ${fromSyllabus}`);

    const upcoming = reminders.filter((r) => new Date(r.dueDate) > new Date());
    console.log(`Upcoming: ${upcoming.length}`);

    if (options.events && reminders.length > 0) {
      console.log('\n=== Synced Events ===');
      for (const reminder of reminders.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      )) {
        const due = dayjs(reminder.dueDate).format('MMM D, YYYY');
        const isPast = new Date(reminder.dueDate) < new Date();
        const status = isPast ? '[PAST]' : '';
        console.log(`  ${status} ${due} - ${reminder.courseName}: ${reminder.title}`);
      }
    }

    console.log('');
  });
