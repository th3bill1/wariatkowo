import Database, {
  type Database as BetterSqliteDatabase,
} from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  DatabaseClient,
  DatabaseRunResult,
  DatabaseStatement,
} from "./types";
import { applyMigrations } from "./migrations";

function normalizeValues(values: unknown[]): unknown[] {
  return values.map((value) => (value === undefined ? null : value));
}

class SqliteStatement implements DatabaseStatement {
  constructor(
    private readonly owner: SqliteDatabase,
    readonly sql: string,
    readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): DatabaseStatement {
    return new SqliteStatement(this.owner, this.sql, normalizeValues(values));
  }

  async first<T>(): Promise<T | null> {
    const statement = this.owner.raw.prepare(this.sql);
    const row = statement.get(...this.values) as T | undefined;
    return row ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    const statement = this.owner.raw.prepare(this.sql);
    return { results: statement.all(...this.values) as T[] };
  }

  async run(): Promise<DatabaseRunResult> {
    return this.runSync();
  }

  runSync(): DatabaseRunResult {
    const result = this.owner.raw.prepare(this.sql).run(...this.values);
    return {
      success: true,
      meta: {
        changes: result.changes,
        lastRowId: result.lastInsertRowid,
      },
    };
  }

  belongsTo(owner: SqliteDatabase): boolean {
    return this.owner === owner;
  }
}

export class SqliteDatabase implements DatabaseClient {
  readonly raw: BetterSqliteDatabase;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.raw = new Database(path);
    this.raw.pragma("foreign_keys = ON");
    this.raw.pragma("journal_mode = WAL");
    this.raw.pragma("busy_timeout = 5000");
  }

  prepare(sql: string): DatabaseStatement {
    return new SqliteStatement(this, sql);
  }

  async batch(statements: DatabaseStatement[]): Promise<DatabaseRunResult[]> {
    const transaction = this.raw.transaction(() =>
      statements.map((statement) => {
        if (
          !(statement instanceof SqliteStatement) ||
          !statement.belongsTo(this)
        ) {
          throw new Error("Cannot execute a statement from another database.");
        }
        return statement.runSync();
      }),
    );
    return transaction();
  }

  close(): void {
    this.raw.close();
  }
}

export function databasePathFromEnv(): string {
  return resolve(process.env.DATABASE_PATH ?? "data/wariatkowo.db");
}

export function openDatabase(
  options: { migrate?: boolean } = {},
): SqliteDatabase {
  const database = new SqliteDatabase(databasePathFromEnv());
  if (options.migrate !== false) {
    applyMigrations(database.raw);
  }
  return database;
}
