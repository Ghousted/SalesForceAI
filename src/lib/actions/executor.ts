import { setContactOwner, logEmail } from "@/lib/data/writes";
import { deliverEmail } from "@/lib/email/send";
import { updateAction } from "./store";
import type { AgentAction } from "./types";

/**
 * Executes an approved (or auto) action against the system of record, routing
 * by kind to the gated write layer. Marks the action executed/failed and never
 * throws — a failed write is recorded on the action, not propagated.
 */
export async function executeAction(action: AgentAction): Promise<AgentAction> {
  try {
    switch (action.kind) {
      case "assign-owner":
        await setContactOwner(action.target.id, String(action.payload.ownerId));
        break;
      case "send-email": {
        const subject = String(action.payload.subject);
        const body = String(action.payload.body);
        // Actually send (Resend, redirected to the sandbox address if set);
        // then record it on the contact's HubSpot timeline.
        await deliverEmail({ toEmail: String(action.payload.toEmail ?? ""), subject, body });
        await logEmail(String(action.payload.contactId), subject, body);
        break;
      }
      default:
        throw new Error(`No executor for action kind "${action.kind}"`);
    }
    return (
      updateAction(action.id, {
        status: "executed",
        resolvedAt: new Date().toISOString(),
      }) ?? action
    );
  } catch (err) {
    return (
      updateAction(action.id, {
        status: "failed",
        resolvedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      }) ?? action
    );
  }
}
