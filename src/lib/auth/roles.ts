import type { Application, RiskTier, UserRole } from "@/lib/types";

export interface RoleDefinition {
  id: UserRole;
  label: string;
  level: "Junior" | "Admin";
  approvableTiers: readonly RiskTier[];
  canReject: boolean;
  canEscalate: boolean;
  canOverrideDecision: boolean;
  canDecideEscalated: boolean;
  /** May disclose masked applicant identifiers (SSN) on records the role can act on. */
  canRevealPii: boolean;
}

/** The subset of a record that policy decisions depend on. */
export type PolicySubject = Pick<Application, "status" | "risk">;

export const ROLES: Record<UserRole, RoleDefinition> = {
  TIER1_ANALYST: {
    id: "TIER1_ANALYST",
    label: "Tier-1 Analyst",
    level: "Junior",
    approvableTiers: ["Low", "Medium"],
    canReject: true,
    canEscalate: true,
    canOverrideDecision: false,
    canDecideEscalated: false,
    canRevealPii: true,
  },
  COMPLIANCE_LEAD: {
    id: "COMPLIANCE_LEAD",
    label: "Compliance Lead",
    level: "Admin",
    approvableTiers: ["Low", "Medium", "High"],
    canReject: true,
    canEscalate: true,
    canOverrideDecision: true,
    canDecideEscalated: true,
    canRevealPii: true,
  },
};

export const ROLE_ORDER: readonly UserRole[] = ["TIER1_ANALYST", "COMPLIANCE_LEAD"];

/**
 * Work queue that escalated records are routed to. Holds the assignment until
 * an operator with `canDecideEscalated` takes a decision and claims the record.
 */
export const ESCALATION_QUEUE = "Compliance Lead queue";

export type DecisionAction = "approve" | "reject" | "escalate";

export interface PermissionResult {
  allowed: boolean;
  /** Human-readable reason shown as a tooltip when `allowed` is false. */
  reason?: string;
  /** True when the action would overwrite an existing final decision. */
  override: boolean;
}

const FINAL_STATUSES = new Set<Application["status"]>(["Approved", "Rejected"]);

/**
 * True when the record's checklist and review artifacts are read-only for
 * this role: finalized records unless the role can override, and escalated
 * records unless the role can decide them.
 */
export function isRecordLocked(role: UserRole, app: Pick<Application, "status">): boolean {
  const def = ROLES[role];
  if (FINAL_STATUSES.has(app.status)) return !def.canOverrideDecision;
  if (app.status === "Escalated") return !def.canDecideEscalated;
  return false;
}

/** Whether the role may unmask applicant PII on this record. */
export function evaluateDisclosure(role: UserRole, app: Pick<Application, "status">): PermissionResult {
  if (!ROLES[role].canRevealPii) {
    return { allowed: false, override: false, reason: "Role cannot disclose applicant identifiers." };
  }
  if (isRecordLocked(role, app)) {
    return {
      allowed: false,
      override: false,
      reason: `Record is ${app.status.toLowerCase()} and locked for your role; identifiers stay masked.`,
    };
  }
  return { allowed: true, override: false };
}

export function evaluatePermission(role: UserRole, app: PolicySubject, action: DecisionAction): PermissionResult {
  const def = ROLES[role];
  const isFinal = FINAL_STATUSES.has(app.status);
  const isEscalated = app.status === "Escalated";

  if (isFinal) {
    if (!def.canOverrideDecision) {
      return {
        allowed: false,
        override: false,
        reason: `Decision is final (${app.status}). Only a Compliance Lead may override.`,
      };
    }
    if (action === "escalate") {
      return {
        allowed: false,
        override: false,
        reason: "Finalized applications cannot be escalated.",
      };
    }
  }

  if (isEscalated && action === "escalate") {
    return {
      allowed: false,
      override: false,
      reason: "Application is already escalated.",
    };
  }

  if (isEscalated && !def.canDecideEscalated) {
    return {
      allowed: false,
      override: false,
      reason: "Escalated applications are decided by a Compliance Lead.",
    };
  }

  switch (action) {
    case "approve":
      if (!def.approvableTiers.includes(app.risk.tier)) {
        return {
          allowed: false,
          override: false,
          reason: "High Risk applications require Compliance Lead approval.",
        };
      }
      return { allowed: true, override: isFinal };
    case "reject":
      if (!def.canReject) {
        return { allowed: false, override: false, reason: "Role cannot reject." };
      }
      return { allowed: true, override: isFinal };
    case "escalate":
      if (!def.canEscalate) {
        return { allowed: false, override: false, reason: "Role cannot escalate." };
      }
      return { allowed: true, override: false };
  }
}
