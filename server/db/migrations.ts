import type { Database } from "better-sqlite3";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_TABLE = "wariatkowo_schema_migrations";

export function migrationsDirectory(): string {
  return resolve(process.env.MIGRATIONS_PATH ?? "migrations");
}

export function listMigrationFiles(): string[] {
  return readdirSync(migrationsDirectory())
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort((first, second) => first.localeCompare(second));
}

export function applyMigrations(database: Database): string[] {
  database.exec(
    `CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );

  const applied = new Map(
    database
      .prepare(`SELECT name, checksum FROM ${MIGRATION_TABLE}`)
      .all()
      .map((row) => {
        const migration = row as { name: string; checksum: string };
        return [migration.name, migration.checksum] as const;
      }),
  );
  const newlyApplied: string[] = [];

  for (const name of listMigrationFiles()) {
    const sql = readFileSync(resolve(migrationsDirectory(), name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existingChecksum = applied.get(name);
    if (existingChecksum) {
      if (existingChecksum !== checksum) {
        throw new Error(`Migration ${name} changed after it was applied.`);
      }
      continue;
    }

    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(sql);
      database
        .prepare(
          `INSERT INTO ${MIGRATION_TABLE} (name, checksum, applied_at) VALUES (?, ?, ?)`,
        )
        .run(name, checksum, new Date().toISOString());
      database.exec("COMMIT");
      newlyApplied.push(name);
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  database.pragma("foreign_keys = ON");
  return newlyApplied;
}

export function recordAllMigrations(database: Database): void {
  database.exec(
    `CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );
  const insert = database.prepare(
    `INSERT OR IGNORE INTO ${MIGRATION_TABLE} (name, checksum, applied_at) VALUES (?, ?, ?)`,
  );
  const transaction = database.transaction(() => {
    for (const name of listMigrationFiles()) {
      const sql = readFileSync(resolve(migrationsDirectory(), name), "utf8");
      insert.run(
        name,
        createHash("sha256").update(sql).digest("hex"),
        new Date().toISOString(),
      );
    }
  });
  transaction();
}
