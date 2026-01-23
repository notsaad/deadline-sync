import initSqlJs, { Database } from 'sql.js';
import { randomUUID } from 'crypto';
import { config } from '../utils/config.js';
import { SyncedReminder, Assignment } from '../types/index.js';
import fs from 'fs';
import path from 'path';

let db: Database | null = null;

async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs();

  const dataDir = path.dirname(config.paths.database);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let database: Database;
  if (fs.existsSync(config.paths.database)) {
    const fileBuffer = fs.readFileSync(config.paths.database);
    database = new SQL.Database(fileBuffer);
  } else {
    database = new SQL.Database();
  }

  initializeSchema(database);
  return database;
}

function initializeSchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS synced_reminders (
      id TEXT PRIMARY KEY,
      external_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      course_name TEXT NOT NULL,
      due_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      reminders_created INTEGER DEFAULT 0,
      error_message TEXT
    )
  `);

  saveDatabase(database);
}

function saveDatabase(database: Database): void {
  const data = database.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.paths.database, buffer);
}

export async function getDatabase(): Promise<Database> {
  if (db) return db;
  db = await initDatabase();
  return db;
}

export async function isAlreadySynced(externalId: string): Promise<boolean> {
  const database = await getDatabase();
  const result = database.exec(
    `SELECT 1 FROM synced_reminders WHERE external_id = '${externalId.replace(/'/g, "''")}'`
  );
  return result.length > 0 && result[0].values.length > 0;
}

export async function markAsSynced(assignment: Assignment): Promise<void> {
  const database = await getDatabase();
  const id = randomUUID();
  const externalId = assignment.id.replace(/'/g, "''");
  const title = assignment.title.replace(/'/g, "''");
  const courseName = assignment.courseName.replace(/'/g, "''");

  database.run(`
    INSERT INTO synced_reminders (id, external_id, title, course_name, due_date, created_at, source)
    VALUES ('${id}', '${externalId}', '${title}', '${courseName}', '${assignment.dueDate.toISOString()}', '${new Date().toISOString()}', '${assignment.source}')
  `);

  saveDatabase(database);
}

export async function getSyncedReminders(): Promise<SyncedReminder[]> {
  const database = await getDatabase();
  const result = database.exec('SELECT * FROM synced_reminders ORDER BY due_date ASC');

  if (result.length === 0) return [];

  const columns = result[0].columns;
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return {
      id: obj.id as string,
      externalId: obj.external_id as string,
      title: obj.title as string,
      courseName: obj.course_name as string,
      dueDate: obj.due_date as string,
      createdAt: obj.created_at as string,
      source: obj.source as 'brightspace' | 'syllabus',
    };
  });
}

export async function logSyncStart(): Promise<number> {
  const database = await getDatabase();
  database.run(`
    INSERT INTO sync_logs (started_at, status) VALUES ('${new Date().toISOString()}', 'in_progress')
  `);
  saveDatabase(database);

  const result = database.exec('SELECT last_insert_rowid()');
  return Number(result[0].values[0][0]);
}

export async function logSyncComplete(logId: number, remindersCreated: number): Promise<void> {
  const database = await getDatabase();
  database.run(`
    UPDATE sync_logs SET completed_at = '${new Date().toISOString()}', status = 'success', reminders_created = ${remindersCreated} WHERE id = ${logId}
  `);
  saveDatabase(database);
}

export async function logSyncError(logId: number, error: string): Promise<void> {
  const database = await getDatabase();
  const escapedError = error.replace(/'/g, "''");
  database.run(`
    UPDATE sync_logs SET completed_at = '${new Date().toISOString()}', status = 'failed', error_message = '${escapedError}' WHERE id = ${logId}
  `);
  saveDatabase(database);
}
