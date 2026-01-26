import { Command } from 'commander';
import { getDatabase } from '../../storage/database.js';
import { logger } from '../../utils/logger.js';
import * as readline from 'readline';

async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Type "RESET" to confirm: ', (answer) => {
      rl.close();
      resolve(answer === 'RESET');
    });
  });
}

export const resetCommand = new Command('reset')
  .description('Reset the duplicate tracking database (DESTRUCTIVE)')
  .option('--force', 'Skip confirmation prompt')
  .action(async (options) => {
    console.log('\n========================================');
    console.log('         WARNING: DESTRUCTIVE ACTION');
    console.log('========================================\n');
    console.log('This command will clear ALL sync tracking data.\n');
    console.log('Consequences:');
    console.log('  - The next sync will re-create ALL reminders');
    console.log('  - You may end up with DUPLICATE reminders in Apple Reminders');
    console.log('  - This does NOT delete existing reminders from Apple Reminders\n');
    console.log('Use this only if you:');
    console.log('  - Manually deleted all reminders from Apple Reminders');
    console.log('  - Want to start fresh with a clean sync\n');

    if (!options.force) {
      const confirmed = await confirmReset();
      if (!confirmed) {
        console.log('\nReset cancelled.');
        return;
      }
    }

    try {
      const database = await getDatabase();

      // Clear synced reminders
      database.run('DELETE FROM synced_reminders');

      // Clear sync logs
      database.run('DELETE FROM sync_logs');

      // Save changes
      const data = database.export();
      const fs = await import('fs');
      const { config } = await import('../../utils/config.js');
      fs.writeFileSync(config.paths.database, Buffer.from(data));

      console.log('\nSync tracking database has been reset.');
      console.log('The next sync will create reminders for all found assignments.');
      logger.info('Database reset completed');
    } catch (error) {
      logger.error(`Reset failed: ${error}`);
      console.error(`\nReset failed: ${error}`);
      process.exit(1);
    }
  });
