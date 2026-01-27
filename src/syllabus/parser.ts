import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

const wordExtractor = new WordExtractor();

/**
 * Extract text from a syllabus file (PDF, .docx, or .doc)
 */
export async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return extractFromPDF(filePath);
    case '.docx':
      return extractFromDocx(filePath);
    case '.doc':
      return extractFromDoc(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}. Supported types: .pdf, .docx, .doc`);
  }
}

// Keep old function name for backwards compatibility
export const extractTextFromPDF = extractTextFromFile;

async function extractFromPDF(filePath: string): Promise<string> {
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

async function extractFromDocx(filePath: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    logger.info(`Extracted text from DOCX file`);
    return result.value;
  } catch (error) {
    logger.error(`Failed to parse DOCX: ${error}`);
    throw new Error(`Could not parse DOCX file: ${filePath}`);
  }
}

async function extractFromDoc(filePath: string): Promise<string> {
  try {
    const extracted = await wordExtractor.extract(filePath);
    logger.info(`Extracted text from DOC file`);
    return extracted.getBody();
  } catch (error) {
    logger.error(`Failed to parse DOC: ${error}`);
    throw new Error(`Could not parse DOC file: ${filePath}`);
  }
}
