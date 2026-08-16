import "dotenv/config";
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { databasePathFromEnv } from "./database";
import { recordAllMigrations } from "./migrations";

const exportArgument = process.argv[2];
if (!exportArgument) {
  console.error(
    "Usage: npm run db:import -- path/to/d1-export.sql [target.db]",
  );
  process.exit(1);
}

const exportPath = resolve(exportArgument);
const targetPath = resolve(process.argv[3] ?? databasePathFromEnv());
if (!existsSync(exportPath)) {
  console.error(`D1 export not found: ${exportPath}`);
  process.exit(1);
}

mkdirSync(dirname(targetPath), { recursive: true });
const database = new Database(targetPath);
try {
  const existingTables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as Array<{ name: string }>;
  if (existingTables.length > 0) {
    throw new Error(
      `Target database is not empty (${existingTables.map((row) => row.name).join(", ")}). Import into a new file.`,
    );
  }

  database.exec(readFileSync(exportPath, "utf8"));
  const requiredTables = [
    "tasks",
    "shopping_items",
    "shopping_products",
    "household_members",
    "sessions",
    "task_completion_events",
    "calendar_events",
  ];
  const importedTables = new Set(
    (
      database
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>
    ).map((row) => row.name),
  );
  const missing = requiredTables.filter((table) => !importedTables.has(table));
  if (missing.length) {
    throw new Error(
      `The export is missing required tables: ${missing.join(", ")}`,
    );
  }

  recordAllMigrations(database);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");

  console.log(`Imported D1 SQL into ${targetPath}`);
  for (const table of [
    "household_members",
    "tasks",
    "task_completion_events",
    "shopping_items",
    "shopping_products",
    "calendar_events",
  ]) {
    const row = database
      .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
      .get() as {
      count: number;
    };
    console.log(`- ${table}: ${row.count}`);
  }
} finally {
  database.close();
}
