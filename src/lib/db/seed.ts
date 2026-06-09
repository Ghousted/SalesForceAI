import { db, DEFAULT_WORKSPACE_ID } from "./client";
import * as t from "./schema";
import { SYNTHETIC_SNAPSHOT } from "../data/synthetic";

/**
 * Seed the database with the synthetic Ayala pack so a fresh install has demo
 * data. Idempotent — clears the workspace first. Run with `npm run seed`.
 */
async function seed() {
  const ws = DEFAULT_WORKSPACE_ID;
  const s = SYNTHETIC_SNAPSHOT;

  // Clear (single-workspace dev — wipe and reload).
  for (const table of [
    t.activities, t.deals, t.contacts, t.companies, t.reps, t.workspaces,
  ]) {
    await db.delete(table);
  }

  await db.insert(t.workspaces).values({
    id: ws,
    name: "Apex Human — Demo",
    createdAt: new Date().toISOString(),
  });

  await db.insert(t.reps).values(
    s.reps.map((r) => ({ id: r.id, workspaceId: ws, name: r.name, role: r.role })),
  );

  await db.insert(t.companies).values(
    s.companies.map((c) => ({
      id: c.id, workspaceId: ws, name: c.name,
      industry: c.industry, location: c.location, notes: c.notes ?? null,
    })),
  );

  await db.insert(t.contacts).values(
    s.contacts.map((c) => ({
      id: c.id, workspaceId: ws, firstName: c.firstName, lastName: c.lastName,
      title: c.title, companyId: c.companyId, email: c.email, phone: c.phone,
      persona: c.persona, ownerRepId: c.ownerRepId,
    })),
  );

  await db.insert(t.deals).values(
    s.deals.map((d) => ({
      id: d.id, workspaceId: ws, name: d.name, contactId: d.contactId,
      companyId: d.companyId, stage: d.stage, amount: d.amount,
      property: d.property, expectedCloseDate: d.expectedCloseDate,
      ownerRepId: d.ownerRepId, repConfidence: d.repConfidence,
    })),
  );

  await db.insert(t.activities).values(
    s.activities.map((a) => ({
      id: a.id, workspaceId: ws, contactId: a.contactId, dealId: a.dealId ?? null,
      type: a.type, timestamp: a.timestamp, direction: a.direction ?? null,
      subject: a.subject, body: a.body,
    })),
  );

  console.log(
    `Seeded workspace "${ws}": ${s.reps.length} reps, ${s.companies.length} companies, ` +
      `${s.contacts.length} contacts, ${s.deals.length} deals, ${s.activities.length} activities.`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
