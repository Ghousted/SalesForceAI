import { setContactOwner, logEmail, updateDeal, logActivity } from "@/lib/data/writes";
import { deliverEmail } from "@/lib/email/send";
import type { ActivityType, DealStage } from "@/lib/data/types";
import { updateAction } from "./store";
import type { AgentAction } from "./types";

/**
 * Executes an approved (or auto) action against the system of record, routing
 * by kind to the gated write layer. Marks the action executed/failed and never
 * throws — a failed write is recorded on the action, not propagated.
 *
 * Everything an agent does to the record is attributed: timeline rows written
 * here carry `actorId = action.agentId` so the CRM shows who (which agent) did
 * what.
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
        // then record it on the contact's timeline, attributed to the agent.
        await deliverEmail({ toEmail: String(action.payload.toEmail ?? ""), subject, body });
        await logEmail(String(action.payload.contactId), subject, body, action.agentId);
        break;
      }
      case "update-stage": {
        const stage = String(action.payload.stage) as DealStage;
        await updateDeal(action.target.id, { stage });
        // Leave an attributed trace on the timeline so the correction is visible.
        const contactId = action.payload.contactId ? String(action.payload.contactId) : "";
        if (contactId) {
          await logActivity({
            contactId,
            dealId: action.target.id,
            type: "note",
            subject: `Stage corrected to "${stage}"`,
            body: action.detail,
            actorId: action.agentId,
          });
        }
        break;
      }
      case "log-activity": {
        await logActivity({
          contactId: String(action.payload.contactId),
          dealId: action.payload.dealId ? String(action.payload.dealId) : undefined,
          type: String(action.payload.type ?? "note") as ActivityType,
          subject: String(action.payload.subject ?? action.title),
          body: String(action.payload.body ?? ""),
          direction: action.payload.direction as "inbound" | "outbound" | undefined,
          actorId: action.agentId,
        });
        break;
      }
      default:
        throw new Error(`No executor for action kind "${action.kind}"`);
    }
    return (
      (await updateAction(action.id, {
        status: "executed",
        resolvedAt: new Date().toISOString(),
      })) ?? action
    );
  } catch (err) {
    return (
      (await updateAction(action.id, {
        status: "failed",
        resolvedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      })) ?? action
    );
  }
}
