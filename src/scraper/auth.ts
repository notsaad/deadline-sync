import { chromium } from 'playwright';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { saveSession } from './session.js';

export async function performInteractiveLogin(): Promise<void> {
  logger.info('Starting interactive login...');
  console.log('\n========================================');
  console.log('  Brightspace Login');
  console.log('========================================\n');
  console.log('A browser window will open.');
  console.log('Please log in to Brightspace and complete 2FA.');
  console.log('The window will close automatically when done.\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${config.brightspace.baseUrl}/d2l/home`);

    // Wait for successful login (user reaches dashboard)
    // This will wait up to 5 minutes for user to complete login + 2FA
    await page.waitForURL('**/d2l/home**', { timeout: 300000 });

    // Give page time to fully load
    await page.waitForLoadState('networkidle');

    // Verify we're actually logged in
    await page.waitForSelector('.d2l-page-header, .d2l-homepage, [class*="homepage"], [class*="course"]', {
      timeout: 10000,
    });

    // Save the session
    await saveSession(context);

    console.log('\nLogin successful! Session saved.\n');
    logger.info('Interactive login completed successfully');
  } catch (error) {
    logger.error(`Login failed: ${error}`);
    throw new Error('Login failed or timed out. Please try again.');
  } finally {
    await browser.close();
  }
}
