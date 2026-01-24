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
    // Use domcontentloaded instead of networkidle - Brightspace is slow
    await page.goto(`${config.brightspace.baseUrl}/d2l/home`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Wait a bit for any redirects to happen
    await page.waitForTimeout(2000);

    const url = page.url();

    // Check if redirected to login
    if (url.includes('login') || url.includes('adfs') || url.includes('auth') || url.includes('idp')) {
      logger.info('Session expired - redirected to login');
      return false;
    }

    // If we're still on brightspace domain with d2l path, session is valid
    if (url.includes('brightspace.com/d2l')) {
      logger.info('Session is valid');
      return true;
    }

    // Fallback: check for dashboard elements
    try {
      await page.waitForSelector('.d2l-page-header, .d2l-homepage, [class*="homepage"], [class*="course"]', {
        timeout: 10000,
      });
      return true;
    } catch {
      // If no dashboard elements found, check URL again
      return page.url().includes('brightspace.com/d2l');
    }
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
