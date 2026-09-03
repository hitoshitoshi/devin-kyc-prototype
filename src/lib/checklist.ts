import type { Application, ChecklistKey } from "@/lib/types";
import { formatDate, isExpired } from "@/lib/utils";

export interface ChecklistConstraint {
  allowed: boolean;
  /** Shown next to the control when `allowed` is false. */
  reason?: string;
}

/**
 * Invariants a checklist item must satisfy before it can be marked complete.
 * Enforced by the state layer and mirrored by the control so the UI never
 * offers a toggle the reducer would refuse.
 */
export function checklistConstraint(app: Application, key: ChecklistKey): ChecklistConstraint {
  if (key === "expirationValid" && isExpired(app.document.expiresOn)) {
    return { allowed: false, reason: `Document expired ${formatDate(app.document.expiresOn)}` };
  }
  return { allowed: true };
}
