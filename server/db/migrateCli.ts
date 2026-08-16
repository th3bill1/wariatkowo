import "dotenv/config";
import { openDatabase } from "./database";

const database = openDatabase();
const rows = database.raw
  .prepare(
    "SELECT name, applied_at FROM wariatkowo_schema_migrations ORDER BY name",
  )
  .all() as Array<{ name: string; applied_at: string }>;

console.log(`Database is current (${rows.length} migrations):`);
for (const row of rows) console.log(`- ${row.name} (${row.applied_at})`);
database.close();
