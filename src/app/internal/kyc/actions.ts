"use server";

import "@/lib/audit/server-sink";
import { logAuditEvent } from "@/lib/audit/logger";
import { ESCALATION_QUEUE, evaluateDisclosure, evaluatePermission } from "@/lib/auth/roles";
import { issueSession, operatorName, requireSession } from "@/lib/auth/session";
import { lookupSsn } from "@/lib/data/pii-vault";
import { commitRecord, getRecord } from "@/lib/data/record-store";
import type { RecordSnapshot } from "@/lib/data/records";
import type { ApplicationStatus, AuditEvent, RejectionReasonCode, UserRole } from "@/lib/types";

export interface RevealSsnResult {
  ssn: string;
  /** The `PII_UNMASKED` event recorded on the server before disclosure. */
  event: AuditEvent;
}

/**
 * Discloses the full tax identifier to the signed-in operator. Authority comes
 * from the session and the record's server-side disposition, never from the
 * caller, and the disclosure is written to the audit stream before the value
 * is returned so it cannot go unrecorded if the client fails afterwards.
 */
export async function revealSsn(applicationId: string): Promise<RevealSsnResult> {
  const session = await requireSession();
  const record = getRecord(applicationId);
  if (!record) throw new Error(`Unknown application ${applicationId}`);
  const disclosure = evaluateDisclosure(session.role, record);
  if (!disclosure.allowed) throw new Error(disclosure.reason ?? "Disclosure not permitted for this role");
  const ssn = lookupSsn(applicationId);
  if (!ssn) throw new Error(`No tax identifier on file for ${applicationId}`);
  const event = logAuditEvent("PII_UNMASKED", operatorName(session), session.role, {
    applicationId,
    field: "ssn",
    justification: "manual-review",
    operator: session.sub,
  });
  return { ssn, event };
}

export interface BeginReviewResult {
  record: RecordSnapshot;
  /** The `STATUS_UPDATED` event, when this call performed the transition. */
  event: AuditEvent | null;
}

/**
 * Moves a Pending record to Under Review and assigns it to the operator on
 * their first review action. Idempotent: a record that is already past
 * Pending is returned unchanged with no event.
 */
export async function beginReview(applicationId: string): Promise<BeginReviewResult> {
  const session = await requireSession();
  const record = getRecord(applicationId);
  if (!record) throw new Error(`Unknown application ${applicationId}`);
  if (record.status !== "Pending") return { record: snapshot(record), event: null };
  const committed = commitRecord({
    ...record,
    status: "Under Review",
    assignedReviewer: record.assignedReviewer ?? operatorName(session),
  });
  const event = logAuditEvent("STATUS_UPDATED", operatorName(session), session.role, {
    applicationId: committed.id,
    from: "Pending",
    to: committed.status,
    trigger: "auto:first-review-action",
    operator: session.sub,
  });
  return { record: snapshot(committed), event };
}

function snapshot({ id, status, assignedReviewer, decision }: RecordSnapshot): RecordSnapshot {
  return { id, status, assignedReviewer, decision };
}

export interface DecisionRequest {
  applicationId: string;
  status: Extract<ApplicationStatus, "Approved" | "Rejected" | "Escalated">;
  reasonCode?: RejectionReasonCode;
}

export interface CommittedDecision {
  /** The record as committed on the server. */
  record: RecordSnapshot;
  /** The `STATUS_UPDATED` event recorded for the committed transition. */
  event: AuditEvent;
}

/**
 * Authorizes and commits a decision in one server-side step. Role and actor
 * come from the session; the current status and risk tier come from the
 * server-side record store — so a forged client can neither approve High risk
 * as Tier-1 nor present an escalated or finalized record as Pending. The
 * `STATUS_UPDATED` event is emitted only after the record has been committed.
 */
export async function commitDecision(request: DecisionRequest): Promise<CommittedDecision> {
  const session = await requireSession();
  const record = getRecord(request.applicationId);
  if (!record) throw new Error(`Unknown application ${request.applicationId}`);
  if (request.status === "Rejected" && !request.reasonCode) throw new Error("Rejection requires a reason code");

  const action = request.status === "Approved" ? "approve" : request.status === "Rejected" ? "reject" : "escalate";
  const permission = evaluatePermission(session.role, record, action);
  if (!permission.allowed) throw new Error(permission.reason ?? "Decision not permitted for this role");

  const decidedBy = operatorName(session);
  const routedTo = request.status === "Escalated" ? ESCALATION_QUEUE : null;
  const from = record.status;
  const committed = commitRecord({
    ...record,
    status: request.status,
    assignedReviewer: routedTo ?? (from === "Escalated" ? decidedBy : (record.assignedReviewer ?? decidedBy)),
    decision: {
      outcome: request.status,
      decidedBy,
      role: session.role,
      decidedAt: new Date().toISOString(),
      reasonCode: request.reasonCode,
      override: permission.override,
    },
  });
  const event = logAuditEvent("STATUS_UPDATED", decidedBy, session.role, {
    applicationId: committed.id,
    from,
    to: committed.status,
    ...(request.reasonCode ? { reasonCode: request.reasonCode } : {}),
    ...(permission.override ? { override: true } : {}),
    ...(routedTo ? { reassignedFrom: record.assignedReviewer, reassignedTo: routedTo } : {}),
    riskTier: committed.risk.tier,
    operator: session.sub,
  });
  return { record: snapshot(committed), event };
}

/**
 * Re-issues the session with a different active role. Only roles the identity
 * provider granted to this operator are accepted.
 */
export async function switchRole(role: UserRole): Promise<UserRole> {
  const session = await requireSession();
  if (!session.grants.includes(role)) throw new Error("Role not granted to this operator");
  if (session.role === role) return role;
  const next = await issueSession(session.sub, role, session.grants);
  return next.role;
}
