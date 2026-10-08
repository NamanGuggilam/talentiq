import path from "node:path";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// With DATABASE_URL set (production) we talk to hosted Postgres; migrations run at build time (scripts/migrate.ts).
// Without it, local dev and tests use embedded Postgres (PGlite) on disk and migrate on first use.
type DB = PgliteDatabase<typeof schema>;
const g = globalThis as unknown as { __db?: DB; __ready?: Promise<void> };

function connect(): { db: DB; ready: Promise<void> } {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 15, connection: { TimeZone: "UTC" } });
    return { db: drizzlePg(client, { schema }) as unknown as DB, ready: Promise.resolve() };
  }
  const dir = process.env.PGLITE_DIR ?? "./.data/pglite";
  if (dir !== "memory://") fs.mkdirSync(path.dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  // Embedded Postgres needs a clean shutdown, or the data directory can be left unreadable.
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.once(sig, () => void client.close().finally(() => process.exit(0)));
  const db = drizzlePglite(client, { schema });
  // Columns are `timestamp` read and written as UTC, so the database clock must be UTC too or now() drifts from the app.
  const ready = client.exec("set time zone 'UTC'").then(() => migratePglite(db, { migrationsFolder: path.join(process.cwd(), "drizzle") }));
  return { db, ready };
}

// Opened on first use, not on import: build and dev tooling load this module in side processes that must not
// open (and lock) the local data directory.
function instance(): DB {
  if (!g.__db) {
    const c = connect();
    g.__db = c.db;
    g.__ready = c.ready;
  }
  return g.__db;
}

export const db = new Proxy({} as DB, {
  get(_, prop) {
    const target = instance();
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
/** Resolves once the schema is in place. Await it before the first query in any entry point. */
export const dbReady: PromiseLike<void> = { then: (onOk, onErr) => (instance(), g.__ready!).then(onOk, onErr) };
export { schema };
