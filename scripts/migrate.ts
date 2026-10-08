import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Runs before `next build` in production. A no-op locally, where PGlite migrates itself on first use.
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) return console.log("migrate: no DATABASE_URL, skipping (PGlite migrates on start).");
  const client = postgres(url, { prepare: false, max: 1, connection: { TimeZone: "UTC" } });
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await client.end();
  console.log("migrate: database is up to date.");
}
main().catch((e) => { console.error(e); process.exit(1); });
