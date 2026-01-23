import { chromium, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const SESSION_FILE = path.join(config.paths.sessionDir, 'brightspace-state.json');

export async function sessionExists(): Promise<boolean> {
  return fs.existsSync(SESSION_FILE);
}

export async function loadSession(): Promise<BrowserContext | null> {
  if (!await sessionExists()) {
    return null;
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      storageState: SESSION_FILE,
    });
    return context;
  } catch (error) {
    logger.error(`Failed to load session: ${error}`);
    await browser.close();
    return null;
  }
}

export async function saveSession(context: BrowserContext): Promise<void> {
  const sessionDir = path.dirname(SESSION_FILE);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  await context.storageState({ path: SESSION_FILE });
  logger.info('Session saved successfully');
}

export async function isSessionValid(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();
  try {
    await page.goto(`${config.brightspace.baseUrl}/d2l/home`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const url = page.url();

    if (url.includes('login') || url.includes('adfs') || url.includes('auth')) {
      logger.info('Session expired - redirected to login');
      return false;
    }

    const hasDashboard = await page.locator('.d2l-page-header, .d2l-homepage, [class*="homepage"]').count() > 0;
    return hasDashboard;
  } catch (error) {
    logger.error(`Session validation failed: ${error}`);
    return false;
  } finally {
    await page.close();
  }
}

export async function clearSession(): Promise<void> {
  if (fs.existsSync(SESSION_FILE)) {
    fs.unlinkSync(SESSION_FILE);
    logger.info('Session cleared');
  }
}
