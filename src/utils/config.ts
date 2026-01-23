import path from 'path';
import { fileURLToPath } from 'url';
import { Config } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

export const config: Config = {
  brightspace: {
    baseUrl: 'https://uottawa.brightspace.com',
    sessionTimeout: 24 * 60 * 60 * 1000,
  },
  reminders: {
    listName: 'School',
    advanceDays: 5,
  },
  paths: {
    dataDir: path.join(projectRoot, 'data'),
    sessionDir: path.join(projectRoot, 'data', 'session'),
    database: path.join(projectRoot, 'data', 'sync.db'),
  },
};
