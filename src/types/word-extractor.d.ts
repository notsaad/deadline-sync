declare module 'word-extractor' {
  interface Document {
    getBody(): string;
    getHeaders(): string;
    getFooters(): string;
    getAnnotations(): string;
  }

  class WordExtractor {
    extract(filePath: string): Promise<Document>;
  }

  export default WordExtractor;
}
