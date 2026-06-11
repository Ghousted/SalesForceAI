import { db, DEFAULT_WORKSPACE_ID } from "./client";
import * as t from "./schema";

/**
 * Reset the database to a clean, EMPTY state: every table wiped and just the
 * default workspace row recreated. There is no demo data and no demo account —
 * sign up through the app (`/signup`) to create your account and workspace.
 *
 * Run with `npm run seed`. Destructive (drops all rows) — it's a dev reset.
 */
async function seed() {
  // Child rows before parents (FKs aren't enforced in SQLite, but keep it tidy).
  for (const table of [
    t.sessions, t.invites, t.users, t.agentConfig, t.connectorCredentials,
    t.actions, t.triggerRuns, t.triggerState, t.activities, t.deals,
    t.contacts, t.companies, t.reps, t.workspaces,
  ]) {
    await db.delete(table);
  }

  await db.insert(t.workspaces).values({
    id: DEFAULT_WORKSPACE_ID,
    name: "Default workspace",
    createdAt: new Date().toISOString(),
  });

  console.log(
    `Reset complete — empty default workspace "${DEFAULT_WORKSPACE_ID}" created.\n` +
      `No demo data, no demo account. Sign up at /signup to begin.`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
