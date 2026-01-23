import { execSync } from 'child_process';
import dayjs from 'dayjs';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { Assignment } from '../types/index.js';

function escapeForAppleScript(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

function formatDateForAppleScript(date: Date): string {
  return dayjs(date).format('MMMM D, YYYY [at] h:mm A');
}

export function ensureListExists(listName: string): void {
  const script = `
    tell application "Reminders"
      if not (exists list "${listName}") then
        make new list with properties {name:"${listName}"}
      end if
    end tell
  `;

  try {
    execSync(`osascript -e '${script}'`, { encoding: 'utf8' });
    logger.info(`Ensured "${listName}" list exists`);
  } catch (error) {
    logger.error(`Failed to create list: ${error}`);
    throw error;
  }
}

export function createReminder(assignment: Assignment): void {
  const listName = config.reminders.listName;
  const title = `${assignment.courseName}: ${assignment.title}`;
  const notes = assignment.description || `Due: ${assignment.dueDate.toLocaleDateString()}`;

  const dueDate = assignment.dueDate;
  const remindDate = dayjs(dueDate)
    .subtract(config.reminders.advanceDays, 'day')
    .toDate();

  const now = new Date();
  const actualRemindDate = remindDate < now ? now : remindDate;

  const escapedTitle = escapeForAppleScript(title);
  const escapedNotes = escapeForAppleScript(notes);
  const dueDateStr = formatDateForAppleScript(dueDate);
  const remindDateStr = formatDateForAppleScript(actualRemindDate);

  const script = `
    tell application "Reminders"
      tell list "${listName}"
        make new reminder with properties {name:"${escapedTitle}", body:"${escapedNotes}", due date:date "${dueDateStr}", remind me date:date "${remindDateStr}"}
      end tell
    end tell
  `;

  try {
    execSync(`osascript -e '${script}'`, { encoding: 'utf8' });
    logger.info(`Created reminder: ${title}`);
  } catch (error) {
    logger.error(`Failed to create reminder "${title}": ${error}`);
    throw error;
  }
}

export function getExistingReminders(listName: string): string[] {
  const script = `
    tell application "Reminders"
      if exists list "${listName}" then
        return name of reminders of list "${listName}"
      else
        return {}
      end if
    end tell
  `;

  try {
    const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8' });
    if (!result.trim()) return [];
    return result.trim().split(', ');
  } catch (error) {
    logger.warn(`Failed to get existing reminders: ${error}`);
    return [];
  }
}
