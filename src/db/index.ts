import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

// Local dev/demo uses embedded Postgres (PGlite). Swap for Neon/Supabase via drizzle-orm/neon-http in production.
fs.mkdirSync(process.env.PGLITE_DIR ?? "./.data", { recursive: true });
const g = globalThis as unknown as { __db?: ReturnType<typeof drizzle<typeof schema>>; __ready?: Promise<void> };
export const db = (g.__db ??= drizzle(new PGlite(process.env.PGLITE_DIR ?? "./.data/pglite"), { schema }));
export const dbReady = (g.__ready ??= migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") }));
export { schema };
