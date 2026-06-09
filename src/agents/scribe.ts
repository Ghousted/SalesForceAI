import { buildDossier, getRep } from "@/lib/data/spine";
import { getLLM } from "@/lib/llm/provider";
import { addAction } from "@/lib/actions/store";
import { autonomyFor } from "@/lib/actions/policy";
import type { AgentAction } from "@/lib/actions/types";
import type { AgentRunResult } from "./types";

/**
 * Scribe — "writes the thank-you note for you to approve." (After, Rep.)
 *
 * Drafts a short follow-up email grounded in the prospect's last interaction,
 * then queues a `send-email` action. That action is **always gated** (the
 * policy forces send-email to "ask"), so nothing reaches a prospect without the
 * rep's tap — this is the human-owns-the-close guardrail at the outbound edge.
 */

export interface ScribeDraft {
  contactId: string;
  prospectName: string;
  toEmail: string;
  subject: string;
  body: string;
  basedOn: string;
  actionId: string;
  actionStatus: AgentAction["status"];
}

/** Parse "Subject: ...\n\n<body>" from the model, with a safe fallback. */
function splitDraft(raw: string, fallbackSubject: string): { subject: string; body: string } {
  const text = raw.trim();
  const m = text.match(/^subject:\s*(.+)/i);
  if (m) {
    const subject = m[1].trim();
    const body = text.slice(text.indexOf("\n") + 1).trim();
    return { subject, body: body || text };
  }
  return { subject: fallbackSubject, body: text };
}

export async function runScribe(contactId: string): Promise<AgentRunResult<ScribeDraft>> {
  const dossier = buildDossier(contactId);
  if (!dossier) throw new Error(`Scribe: no contact ${contactId}`);

  const { contact, company, deal, activities } = dossier;
  const prospectName = `${contact.firstName} ${contact.lastName}`.trim();
  const repName = getRep(contact.ownerRepId)?.name ?? "the team";

  // Anchor the note to the most recent meaningful interaction.
  const last = activities.at(-1);
  const lastInbound = activities.filter((a) => a.direction === "inbound").at(-1);
  const anchor = lastInbound ?? last;
  const basedOn = anchor
    ? `${anchor.type} — "${anchor.subject}"`
    : "your recent conversation";

  const facts = [
    `From: ${repName}. To: ${prospectName}${contact.title ? `, ${contact.title}` : ""}${company ? ` at ${company.name}` : ""}.`,
    deal ? `Deal in play: ${deal.property} (${deal.name}).` : "",
    anchor ? `Last interaction (${anchor.type}): "${anchor.subject}" — ${anchor.body}` : "",
    lastInbound ? `They are awaiting a reply to: "${lastInbound.subject}".` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const llm = getLLM();
  const raw = await llm.complete({
    agent: "scribe",
    system:
      "You are Scribe, drafting a short, warm follow-up email FROM the rep TO the prospect after their last interaction. " +
      "First line must be 'Subject: <subject>', then a blank line, then 3–5 sentences of body. " +
      "Reference the actual last interaction, address any open question, and sign off as the rep by name. " +
      "Use the real names given — never placeholders like [Name]. Plain text only.",
    user: facts,
    grounding: dossier,
  });

  const fallbackSubject = deal
    ? `Following up on ${deal.property}`
    : `Great connecting, ${contact.firstName}`;
  const { subject, body } = splitDraft(raw, fallbackSubject);

  const action = addAction({
    agentId: "scribe",
    kind: "send-email",
    title: `Send follow-up to ${prospectName}`,
    detail: `To: ${contact.email || "(no email on file)"}\nSubject: ${subject}\n\n${body}`,
    target: { kind: "contact", id: contact.id, label: prospectName },
    payload: { subject, body, toEmail: contact.email, contactId: contact.id },
    autonomy: autonomyFor("scribe", "send-email"), // always "ask"
    status: "proposed",
  });

  return {
    agentId: "scribe",
    headline: `Drafted a follow-up to ${prospectName}`,
    data: {
      contactId: contact.id,
      prospectName,
      toEmail: contact.email,
      subject,
      body,
      basedOn,
      actionId: action.id,
      actionStatus: action.status,
    },
    evidence: [{ kind: "contact", id: contact.id, label: prospectName }],
    requiresApproval: "Sends an email to the prospect — needs your approval.",
  };
}
