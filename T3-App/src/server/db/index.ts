import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

/**
 * The BD Web Content SDK needs NO database. This template ships example
 * tRPC/DB bits behind `DATABASE_URL`, which is now optional — so an
 * unconfigured clone boots and renders BD content instead of crashing.
 *
 * When `DATABASE_URL` is unset, `db` is a proxy that throws only if you actually
 * touch it (use those example DB features), with a message telling you what to
 * do — never at import/boot time.
 */
function createDb(): PostgresJsDatabase<typeof schema> {
  if (!env.DATABASE_URL) {
    return new Proxy({} as PostgresJsDatabase<typeof schema>, {
      get() {
        throw new Error(
          "DATABASE_URL is not set. The BD Web Content SDK needs no database; " +
            "set DATABASE_URL only if you use this starter's example DB features.",
        );
      },
    });
  }
  const conn = globalForDb.conn ?? postgres(env.DATABASE_URL);
  if (env.NODE_ENV !== "production") globalForDb.conn = conn;
  return drizzle(conn, { schema });
}

export const db = createDb();
