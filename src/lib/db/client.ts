import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

/**
 * The libSQL/Drizzle client. Local dev uses a file (zero infra); deploy points
 * `DATABASE_URL` at Turso (libsql://…) with `DATABASE_AUTH_TOKEN`. Same driver
 * for both.
 */

const url = process.env.DATABASE_URL ?? "file:.data/salesos.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
export { schema };

/** Whether a real database is configured (always true locally via the file). */
export function dbConfigured(): boolean {
  return Boolean(url);
}

/** The single workspace for Phase A (multi-tenant comes later). */
export const DEFAULT_WORKSPACE_ID =
  process.env.WORKSPACE_ID ?? "ws_default";
