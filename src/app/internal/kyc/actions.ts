"use server";

import "@/lib/audit/server-sink";
import { logAuditEvent } from "@/lib/audit/logger";
import { ESCALATION_QUEUE, evaluatePermission } from "@/lib/auth/roles";
import { issueSession, operatorName, requireSession } from "@/lib/auth/session";
import { lookupSsn } from "@/lib/data/pii-vault";
import { buildSeedApplications } from "@/lib/data/seed";
import type { ApplicationStatus, AuditEvent, RejectionReasonCode, UserRole } from "@/lib/types";

export interface RevealSsnResult {
  ssn: string;
  /** The `PII_UNMASKED` event recorded on the server before disclosure. */
  event: AuditEvent;
}

/**
 * Discloses the full tax identifier for the signed-in operator. Authority
 * comes from the session cookie, never from the caller, and the disclosure is
 * written to the audit stream before the value is returned so it cannot go
 * unrecorded if the client navigates away or fails.
 */
export async function revealSsn(applicationId: string): Promise<RevealSsnResult> {
  const session = await requireSession();
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

export interface DecisionRequest {
  applicationId: string;
  status: Extract<ApplicationStatus, "Approved" | "Rejected" | "Escalated">;
  /**
   * Status the operator is deciding from. The prototype keeps review state in
   * the browser session, so this is echoed by the client; a deployment with a
   * record store reads it server-side instead.
   */
  currentStatus: ApplicationStatus;
  reasonCode?: RejectionReasonCode;
}

export interface DecisionAuthorization {
  decidedBy: string;
  role: UserRole;
  decidedAt: string;
  override: boolean;
  /** Reviewer the record is routed to, when the decision reassigns it. */
  routedTo: string | null;
  /** The `STATUS_UPDATED` event recorded on the server. */
  event: AuditEvent;
}

const RECORDS: ReadonlyMap<string, ReturnType<typeof buildSeedApplications>[number]> = new Map(
  buildSeedApplications(0).map((app) => [app.id, app]),
);

/**
 * Authorizes a decision against the signed-in operator's role and the
 * server-known risk profile of the record, then records `STATUS_UPDATED`.
 * The browser never supplies the actor or role; a forged client cannot
 * approve High risk as Tier-1, decide an escalated case, or override a final
 * decision without the role the session actually carries.
 */
export async function authorizeDecision(request: DecisionRequest): Promise<DecisionAuthorization> {
  const session = await requireSession();
  const record = RECORDS.get(request.applicationId);
  if (!record) throw new Error(`Unknown application ${request.applicationId}`);
  if (request.status === "Rejected" && !request.reasonCode) throw new Error("Rejection requires a reason code");

  const action = request.status === "Approved" ? "approve" : request.status === "Rejected" ? "reject" : "escalate";
  const permission = evaluatePermission(session.role, { ...record, status: request.currentStatus }, action);
  if (!permission.allowed) throw new Error(permission.reason ?? "Decision not permitted for this role");

  const decidedBy = operatorName(session);
  const routedTo = request.status === "Escalated" ? ESCALATION_QUEUE : null;
  const event = logAuditEvent("STATUS_UPDATED", decidedBy, session.role, {
    applicationId: record.id,
    from: request.currentStatus,
    to: request.status,
    ...(request.reasonCode ? { reasonCode: request.reasonCode } : {}),
    ...(permission.override ? { override: true } : {}),
    ...(routedTo ? { reassignedTo: routedTo } : {}),
    riskTier: record.risk.tier,
    operator: session.sub,
  });
  return {
    decidedBy,
    role: session.role,
    decidedAt: event.timestamp,
    override: permission.override,
    routedTo,
    event,
  };
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
