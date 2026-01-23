declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: unknown[]): void;
    exec(sql: string): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export default function initSqlJs(): Promise<SqlJsStatic>;
}

declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    text: string;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }

  function pdf(dataBuffer: Buffer): Promise<PDFData>;
  export = pdf;
}
