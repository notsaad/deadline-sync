import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { syncCommand } from './commands/sync.js';
import { syllabusCommand } from './commands/syllabus.js';
import { statusCommand } from './commands/status.js';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('deadline-sync')
    .description('Sync Brightspace deadlines to Apple Reminders')
    .version('1.0.0');

  program.addCommand(loginCommand);
  program.addCommand(syncCommand);
  program.addCommand(syllabusCommand);
  program.addCommand(statusCommand);

  return program;
}
