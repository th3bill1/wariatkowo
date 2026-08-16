export type DatabaseRunResult = {
  success: boolean;
  meta: {
    changes: number;
    lastRowId: number | bigint;
  };
};

export interface DatabaseStatement {
  bind(...values: unknown[]): DatabaseStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<DatabaseRunResult>;
}

export interface DatabaseClient {
  prepare(sql: string): DatabaseStatement;
  batch(statements: DatabaseStatement[]): Promise<DatabaseRunResult[]>;
  close(): void;
}
