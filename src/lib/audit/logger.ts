import type { AuditAction, AuditEvent, UserRole } from "@/lib/types";

/**
 * Audit sink contract. The KYC context registers an in-memory sink; a
 * production deployment would register an HTTP/Kafka sink alongside it.
 */
export type AuditSink = (event: AuditEvent) => void;

const sinks = new Set<AuditSink>();
// Events emitted before any sink is attached are held here so nothing is
// dropped during mount ordering; they replay into the first sink registered.
let pending: AuditEvent[] = [];
let sequence = 0;

export function registerAuditSink(sink: AuditSink): () => void {
  sinks.add(sink);
  if (pending.length) {
    const backlog = pending;
    pending = [];
    backlog.forEach(sink);
  }
  return () => {
    sinks.delete(sink);
  };
}

export interface AuditMetadata extends Record<string, unknown> {
  applicationId?: string;
}

/**
 * Creates an immutable, typed audit event and fans it out to every sink.
 * `metadata.applicationId` is promoted to the top-level record so ledgers
 * can be scoped per application without inspecting the payload.
 */
export function logAuditEvent(
  action: AuditAction,
  actor: string,
  role: UserRole | "SYSTEM",
  metadata: AuditMetadata,
): AuditEvent {
  const { applicationId, ...rest } = metadata;
  const event: AuditEvent = Object.freeze({
    id: `EVT-${Date.now().toString(36).toUpperCase()}-${(++sequence).toString(36).toUpperCase().padStart(3, "0")}`,
    timestamp: new Date().toISOString(),
    actor,
    role,
    action,
    applicationId,
    metadata: rest,
  });
  if (sinks.size === 0) pending.push(event);
  else sinks.forEach((sink) => sink(event));
  return event;
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  APPLICATION_SUBMITTED: "Application submitted",
  RISK_SCORED: "Risk scored",
  VIEWED_RECORD: "Record viewed",
  PII_UNMASKED: "PII unmasked",
  CHECKLIST_UPDATED: "Checklist updated",
  NOTE_ADDED: "Note added",
  STATUS_UPDATED: "Status updated",
  ROLE_SWITCHED: "Role switched",
};
