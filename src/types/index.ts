// Core data types used throughout the application

export interface Assignment {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  description?: string;
  dueDate: Date;
  url?: string;
  type: 'assignment' | 'quiz' | 'exam' | 'discussion' | 'reading' | 'other';
  source: 'brightspace' | 'syllabus';
}

export interface Course {
  id: string;
  name: string;
  url: string;
}

export interface SyncedReminder {
  id: string;
  externalId: string;
  title: string;
  courseName: string;
  dueDate: string;
  createdAt: string;
  source: 'brightspace' | 'syllabus';
}

export interface SyllabusDate {
  text: string;
  date: Date;
  context: string;
  confidence: 'high' | 'medium' | 'low';
  suggestedTitle: string;
}

export interface Config {
  brightspace: {
    baseUrl: string;
    sessionTimeout: number;
  };
  reminders: {
    listName: string;
    advanceDays: number;
  };
  paths: {
    dataDir: string;
    sessionDir: string;
    database: string;
  };
}
