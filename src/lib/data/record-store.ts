import "server-only";

import { buildSeedApplications } from "@/lib/data/seed";
import type { RecordSnapshot } from "@/lib/data/records";
import type { RiskScore } from "@/lib/types";

/**
 * Server-authoritative disposition state for each application. The browser
 * holds a working copy for rendering, but status transitions are committed
 * here first, so a client cannot present a record as Pending to sidestep the
 * controls on escalated or finalized cases.
 *
 * In-memory for the prototype (kept on `globalThis` so it survives dev-server
 * module reloads); a deployment swaps this for the case-management database.
 */
export interface RecordState extends RecordSnapshot {
  risk: RiskScore;
  /** 0 for the seeded disposition; incremented on every commit. */
  revision: number;
}

declare global {
  var __kycRecordStore: Map<string, RecordState> | undefined;
}

function store(): Map<string, RecordState> {
  if (!globalThis.__kycRecordStore) {
    globalThis.__kycRecordStore = new Map(
      buildSeedApplications(0).map((app) => [
        app.id,
        {
          id: app.id,
          risk: app.risk,
          status: app.status,
          assignedReviewer: app.assignedReviewer,
          decision: app.decision,
          revision: 0,
        },
      ]),
    );
  }
  return globalThis.__kycRecordStore;
}

export function getRecord(id: string): RecordState | undefined {
  return store().get(id);
}

/**
 * Dispositions committed since seeding, for hydrating clients. Unchanged
 * records are omitted so the client keeps its own seeded copy (whose relative
 * timestamps are anchored to render time).
 */
export function snapshotRecords(): RecordSnapshot[] {
  return [...store().values()]
    .filter((record) => record.revision > 0)
    .map(({ id, status, assignedReviewer, decision }) => ({ id, status, assignedReviewer, decision }));
}

export function commitRecord(next: Omit<RecordState, "revision">): RecordState {
  const committed = { ...next, revision: (store().get(next.id)?.revision ?? 0) + 1 };
  store().set(next.id, committed);
  return committed;
}
