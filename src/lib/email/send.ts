/**
 * Real email delivery via Resend — behind the same approval gate as everything
 * else (a send-email action only runs after a human taps Approve).
 *
 * Safety guardrails (so a real prospect is never emailed by accident):
 *   - No `RESEND_API_KEY`        → no send at all; Scribe just logs to HubSpot.
 *   - `EMAIL_OVERRIDE_TO` set     → SANDBOX: every send is redirected to that one
 *                                   address (your inbox), whatever contact it was for.
 *   - Real prospect address       → used ONLY if `EMAIL_ALLOW_REAL=true` AND no
 *                                   override is set. Off by default.
 */

export interface DeliveryResult {
  sent: boolean;
  recipient?: string;
  skippedReason?: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Resolve where a send would actually go, given the guardrails. */
function resolveRecipient(toEmail: string): { recipient?: string; sandbox: boolean } {
  const override = process.env.EMAIL_OVERRIDE_TO?.trim();
  if (override) return { recipient: override, sandbox: true };
  if (process.env.EMAIL_ALLOW_REAL === "true" && toEmail)
    return { recipient: toEmail, sandbox: false };
  return { recipient: undefined, sandbox: false };
}

/** Human-readable note shown on the draft so the rep sees where it'll go. */
export function describeDelivery(toEmail: string): string {
  if (!emailConfigured())
    return "No email provider configured — Approve will log this to the HubSpot timeline only (no send).";
  const { recipient, sandbox } = resolveRecipient(toEmail);
  if (!recipient)
    return "Sending is blocked — set EMAIL_OVERRIDE_TO (sandbox) or EMAIL_ALLOW_REAL=true. Will log to HubSpot only.";
  if (sandbox)
    return `SANDBOX: Approve will email ${recipient} (redirected from ${toEmail || "no address"}), and log to HubSpot.`;
  return `Approve will email ${recipient} for real, and log to HubSpot.`;
}

export async function deliverEmail(args: {
  toEmail: string;
  subject: string;
  body: string;
}): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, skippedReason: "no email provider" };

  const { recipient, sandbox } = resolveRecipient(args.toEmail);
  if (!recipient)
    return {
      sent: false,
      skippedReason:
        "send blocked — set EMAIL_OVERRIDE_TO (sandbox) or EMAIL_ALLOW_REAL=true",
    };

  const from = process.env.EMAIL_FROM?.trim() || "Sales OS <onboarding@resend.dev>";
  const subject = sandbox
    ? `[Sales OS test → ${args.toEmail || "no address"}] ${args.subject}`
    : args.subject;
  const text = sandbox
    ? `— Sales OS sandbox send · intended recipient: ${args.toEmail || "(none)"} —\n\n${args.body}`
    : args.body;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: recipient, subject, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
  return { sent: true, recipient };
}
