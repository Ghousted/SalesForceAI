import { activeSource } from "./source";
import { hubspotSetContactOwner } from "./hubspot";
import { invalidateSnapshot } from "./spine";
import { SYNTHETIC_SNAPSHOT } from "./synthetic";

/**
 * The write side of the data spine — the only place agents' actions mutate the
 * system of record. Dispatches by active source: HubSpot in live mode, the
 * in-memory pack in synthetic mode (so automation is demoable offline too).
 * Every successful write invalidates the read cache.
 */

export async function setContactOwner(
  contactId: string,
  ownerId: string,
): Promise<void> {
  if (activeSource() === "hubspot") {
    await hubspotSetContactOwner(contactId, ownerId);
    invalidateSnapshot();
  } else {
    const c = SYNTHETIC_SNAPSHOT.contacts.find((x) => x.id === contactId);
    if (!c) throw new Error(`No synthetic contact ${contactId}`);
    c.ownerRepId = ownerId;
  }
}
