import { Command } from 'commander';
import { performInteractiveLogin } from '../../scraper/auth.js';
import { loadSession, isSessionValid, clearSession, sessionExists } from '../../scraper/session.js';
import { logger } from '../../utils/logger.js';

export const loginCommand = new Command('login')
  .description('Log in to Brightspace')
  .option('--status', 'Check if session is valid')
  .option('--clear', 'Clear saved session')
  .action(async (options) => {
    try {
      if (options.clear) {
        await clearSession();
        console.log('Session cleared.');
        return;
      }

      if (options.status) {
        if (!await sessionExists()) {
          console.log('No session found. Run "deadline-sync login" to authenticate.');
          process.exit(1);
        }

        const context = await loadSession();
        if (!context) {
          console.log('Could not load session.');
          process.exit(1);
        }

        const valid = await isSessionValid(context);
        await context.browser()?.close();

        if (valid) {
          console.log('Session is valid.');
          process.exit(0);
        } else {
          console.log('Session expired. Run "deadline-sync login" to refresh.');
          process.exit(2);
        }
      }

      // Perform interactive login
      await performInteractiveLogin();
      process.exit(0);
    } catch (error) {
      logger.error(`Login error: ${error}`);
      console.error(`Error: ${error}`);
      process.exit(1);
    }
  });
