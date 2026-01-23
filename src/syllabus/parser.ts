import pdf from 'pdf-parse';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdf(dataBuffer);
    logger.info(`Extracted ${data.numpages} pages from PDF`);
    return data.text;
  } catch (error) {
    logger.error(`Failed to parse PDF: ${error}`);
    throw new Error(`Could not parse PDF file: ${filePath}`);
  }
}
