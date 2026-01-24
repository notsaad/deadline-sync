import { BrowserContext, Page } from 'playwright';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { Assignment, Course } from '../types/index.js';
import { loadSession, isSessionValid } from './session.js';
import { createHash } from 'crypto';

export class BrightspaceScraper {
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.context = await loadSession();
    if (!this.context) {
      throw new Error('No session found. Please run "deadline-sync login" first.');
    }

    if (!await isSessionValid(this.context)) {
      await this.context.browser()?.close();
      throw new Error('Session expired. Please run "deadline-sync login" to refresh.');
    }

    this.page = await this.context.newPage();
  }

  private async ensurePage(): Promise<Page> {
    // Check if page is still usable
    if (this.page) {
      try {
        // Simple check to see if page is still valid
        await this.page.evaluate(() => true);
        return this.page;
      } catch {
        // Page is closed or crashed, recreate it
        logger.warn('Page was closed, recreating...');
      }
    }

    if (!this.context) {
      throw new Error('Context not initialized');
    }

    this.page = await this.context.newPage();
    return this.page;
  }

  async close(): Promise<void> {
    try {
      if (this.page) await this.page.close();
    } catch {
      // Page might already be closed
    }
    try {
      if (this.context) await this.context.browser()?.close();
    } catch {
      // Browser might already be closed
    }
  }

  async getCourses(): Promise<Course[]> {
    const page = await this.ensurePage();

    // Navigate to the enrollments page with "current" filter for active courses only
    await page.goto(`${config.brightspace.baseUrl}/d2l/le/manageCourses/widget/myCourses/6605/PinnedCourses`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // Give page time to load dynamic content
    await page.waitForTimeout(3000);

    const courses: Course[] = [];

    // Try to get courses from the pinned/current courses widget
    const courseSelectors = [
      '.d2l-card',
      '.course-card',
      '[class*="course-card"]',
      'd2l-enrollment-card',
      '[class*="enrollment"]',
      '.d2l-datalist-item',
    ];

    for (const selector of courseSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length === 0) continue;

        for (const element of elements) {
          try {
            const linkEl = element.locator('a').first();
            const href = await linkEl.getAttribute('href');
            const text = await element.textContent();

            if (href && text) {
              const idMatch = href.match(/\/d2l\/(?:home|le\/content)\/(\d+)/);
              if (idMatch) {
                const id = idMatch[1];
                const name = text.trim().split('\n')[0].trim();

                if (name && !courses.some(c => c.id === id)) {
                  courses.push({
                    id,
                    name,
                    url: `${config.brightspace.baseUrl}${href}`,
                  });
                }
              }
            }
          } catch {
            // Skip elements that don't match expected structure
          }
        }

        if (courses.length > 0) break;
      } catch {
        // Try next selector
      }
    }

    // Fallback: try the homepage My Courses widget
    if (courses.length === 0) {
      await page.goto(`${config.brightspace.baseUrl}/d2l/home`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(3000);

      // Look for course cards on homepage (typically shows current courses)
      try {
        const cards = await page.locator('.d2l-card, [class*="course-card"], d2l-card').all();
        for (const card of cards) {
          try {
            const linkEl = card.locator('a').first();
            const href = await linkEl.getAttribute('href');
            const text = await card.textContent();

            if (href && text) {
              const idMatch = href.match(/\/d2l\/(?:home|le\/content)\/(\d+)/);
              if (idMatch) {
                const id = idMatch[1];
                const name = text.trim().split('\n')[0].trim();

                // Filter by current semester indicators
                if (name && !courses.some(c => c.id === id) && this.isCurrentSemester(name)) {
                  courses.push({
                    id,
                    name,
                    url: `${config.brightspace.baseUrl}${href}`,
                  });
                }
              }
            }
          } catch {
            // Skip
          }
        }
      } catch {
        // Ignore
      }
    }

    // If still no courses, try all course links but filter by semester
    if (courses.length === 0) {
      try {
        const courseLinks = await page.locator('a[href*="/d2l/home/"]').all();
        for (const link of courseLinks) {
          const href = await link.getAttribute('href');
          const text = await link.textContent();
          const idMatch = href?.match(/\/d2l\/home\/(\d+)/);

          if (idMatch && text) {
            const id = idMatch[1];
            const name = text.trim();
            if (!courses.some(c => c.id === id) && this.isCurrentSemester(name)) {
              courses.push({
                id,
                name,
                url: `${config.brightspace.baseUrl}${href}`,
              });
            }
          }
        }
      } catch {
        // Ignore
      }
    }

    logger.info(`Found ${courses.length} current semester courses`);
    return courses;
  }

  private isCurrentSemester(courseName: string): boolean {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    // Determine current semester based on month
    // Fall: Sept-Dec (8-11), Winter: Jan-Apr (0-3), Summer: May-Aug (4-7)
    let currentTerms: string[] = [];

    if (month >= 0 && month <= 3) {
      // Winter semester (Jan-Apr)
      currentTerms = [
        `Winter ${year}`, `W${year}`, `WIN ${year}`, `W${String(year).slice(2)}`,
        `${year}W`, `${year} Winter`, `Winter${year}`, `Hiver ${year}`,
      ];
    } else if (month >= 4 && month <= 7) {
      // Summer semester (May-Aug)
      currentTerms = [
        `Summer ${year}`, `S${year}`, `SUM ${year}`, `S${String(year).slice(2)}`,
        `${year}S`, `${year} Summer`, `Summer${year}`, `Été ${year}`,
        `Spring ${year}`, `SP${year}`,
      ];
    } else {
      // Fall semester (Sept-Dec)
      currentTerms = [
        `Fall ${year}`, `F${year}`, `FAL ${year}`, `F${String(year).slice(2)}`,
        `${year}F`, `${year} Fall`, `Fall${year}`, `Automne ${year}`,
        `Autumn ${year}`, `A${year}`,
      ];
    }

    // Also include courses without semester indicators (might be ongoing)
    const upperName = courseName.toUpperCase();

    // Check if course name contains current semester
    for (const term of currentTerms) {
      if (upperName.includes(term.toUpperCase())) {
        return true;
      }
    }

    // Check for year without semester (ongoing courses)
    if (upperName.includes(String(year))) {
      return true;
    }

    // If no year/semester found, include it (might be a current course without labeling)
    const hasOldYear = /20[0-2][0-9]/.test(courseName) && !courseName.includes(String(year));
    return !hasOldYear;
  }

  async getAssignments(course: Course): Promise<Assignment[]> {
    const assignments: Assignment[] = [];
    const ELEMENT_TIMEOUT = 5000; // 5 second timeout for element operations

    // Try assignments/dropbox page
    try {
      const page = await this.ensurePage();
      await page.goto(
        `${config.brightspace.baseUrl}/d2l/lms/dropbox/user/folders_list.d2l?ou=${course.id}`,
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );
      await page.waitForTimeout(2000);

      const rows = await page.locator('table tbody tr, .d2l-table tbody tr, .d_ich').all();

      for (const row of rows) {
        try {
          const titleLocator = row.locator('a, .d2l-link, .d2l-heading').first();
          // Check if element exists before getting text
          if (await titleLocator.count() === 0) continue;
          const title = await titleLocator.textContent({ timeout: ELEMENT_TIMEOUT });

          // Look for date in various places
          let dateText = '';
          const dateSelectors = ['.d2l-dates', '[class*="date"]', 'td:nth-child(2)', 'td:nth-child(3)'];

          for (const dateSel of dateSelectors) {
            try {
              const dateLocator = row.locator(dateSel).first();
              if (await dateLocator.count() === 0) continue;
              dateText = (await dateLocator.textContent({ timeout: ELEMENT_TIMEOUT })) || '';
              if (dateText && this.parseDate(dateText)) break;
            } catch {
              // Try next
            }
          }

          if (title && dateText) {
            const dueDate = this.parseDate(dateText);
            if (dueDate && dueDate > new Date()) {
              const id = this.generateId(course.id, title, dueDate);
              if (!assignments.some(a => a.id === id)) {
                assignments.push({
                  id,
                  courseId: course.id,
                  courseName: course.name,
                  title: title.trim(),
                  dueDate,
                  type: 'assignment',
                  source: 'brightspace',
                });
              }
            }
          }
        } catch {
          // Skip rows that don't match expected structure
        }
      }
    } catch (error) {
      logger.warn(`Could not fetch assignments for ${course.name}: ${error}`);
    }

    // Try quizzes page
    try {
      const page = await this.ensurePage();
      await page.goto(
        `${config.brightspace.baseUrl}/d2l/lms/quizzing/user/quizzes_list.d2l?ou=${course.id}`,
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );
      await page.waitForTimeout(2000);

      const rows = await page.locator('table tbody tr, .d2l-table tbody tr').all();

      for (const row of rows) {
        try {
          const titleLocator = row.locator('a, .d2l-link').first();
          if (await titleLocator.count() === 0) continue;
          const title = await titleLocator.textContent({ timeout: ELEMENT_TIMEOUT });

          let dateText = '';
          const cells = await row.locator('td').all();
          for (const cell of cells) {
            try {
              const text = await cell.textContent({ timeout: ELEMENT_TIMEOUT });
              if (text && this.parseDate(text)) {
                dateText = text;
                break;
              }
            } catch {
              // Skip this cell
            }
          }

          if (title && dateText) {
            const dueDate = this.parseDate(dateText);
            if (dueDate && dueDate > new Date()) {
              const id = this.generateId(course.id, title, dueDate);
              if (!assignments.some(a => a.id === id)) {
                assignments.push({
                  id,
                  courseId: course.id,
                  courseName: course.name,
                  title: title.trim(),
                  dueDate,
                  type: 'quiz',
                  source: 'brightspace',
                });
              }
            }
          }
        } catch {
          // Skip rows that don't match expected structure
        }
      }
    } catch (error) {
      logger.warn(`Could not fetch quizzes for ${course.name}: ${error}`);
    }

    // Try calendar/upcoming page
    try {
      const page = await this.ensurePage();
      await page.goto(
        `${config.brightspace.baseUrl}/d2l/le/calendar/${course.id}`,
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );
      await page.waitForTimeout(2000);

      const events = await page.locator('.d2l-calendar-event, [class*="event"]').all();

      for (const event of events) {
        try {
          const title = await event.textContent({ timeout: ELEMENT_TIMEOUT });
          const dateAttr = await event.getAttribute('data-date', { timeout: ELEMENT_TIMEOUT });

          if (title && dateAttr) {
            const dueDate = new Date(dateAttr);
            if (!isNaN(dueDate.getTime()) && dueDate > new Date()) {
              const id = this.generateId(course.id, title, dueDate);
              if (!assignments.some(a => a.id === id)) {
                assignments.push({
                  id,
                  courseId: course.id,
                  courseName: course.name,
                  title: title.trim(),
                  dueDate,
                  type: 'other',
                  source: 'brightspace',
                });
              }
            }
          }
        } catch {
          // Skip
        }
      }
    } catch {
      // Calendar page might not exist or be accessible
    }

    logger.info(`Found ${assignments.length} upcoming items in ${course.name}`);
    return assignments;
  }

  private parseDate(dateText: string): Date | null {
    const cleanText = dateText.trim();

    // Try direct parsing
    const date = new Date(cleanText);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Common date patterns
    const patterns = [
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})(?:\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      /(\d{4})-(\d{2})-(\d{2})/,
    ];

    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match) {
        const parsed = new Date(cleanText);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    // Handle relative dates
    const daysMatch = cleanText.match(/(\d+)\s*days?/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      return futureDate;
    }

    return null;
  }

  private generateId(courseId: string, title: string, dueDate: Date): string {
    const hash = createHash('sha256');
    hash.update(`${courseId}-${title.trim().toLowerCase()}-${dueDate.toISOString().split('T')[0]}`);
    return hash.digest('hex').substring(0, 16);
  }
}
