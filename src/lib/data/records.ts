import type { Application, ApplicationStatus, Decision } from "@/lib/types";

/** Server-authoritative disposition of a record, as shipped to the client. */
export interface RecordSnapshot {
  id: string;
  status: ApplicationStatus;
  assignedReviewer: string | null;
  decision?: Decision;
}

/** Overlays the authoritative disposition onto seeded applications. */
export function applySnapshots(applications: Application[], snapshots: readonly RecordSnapshot[]): Application[] {
  const byId = new Map(snapshots.map((s) => [s.id, s]));
  return applications.map((app) => {
    const snap = byId.get(app.id);
    return snap ? { ...app, status: snap.status, assignedReviewer: snap.assignedReviewer, decision: snap.decision } : app;
  });
}
