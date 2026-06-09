import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso", // libSQL — works for local file: and remote libsql: URLs
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:.data/salesos.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
} satisfies Config;
