import { setContactOwner, logEmail } from "@/lib/data/writes";
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
      case "send-email":
        await logEmail(
          String(action.payload.contactId),
          String(action.payload.subject),
          String(action.payload.body),
        );
        break;
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
