import { createContext, useContext } from "react";
import type { Application, RiskTier, UserRole } from "@/lib/types";

export interface RoleDefinition {
  id: UserRole;
  label: string;
  level: "Junior" | "Admin";
  /** Display name of the seeded operator acting under this role. */
  actor: string;
  approvableTiers: readonly RiskTier[];
  canReject: boolean;
  canEscalate: boolean;
  canOverrideDecision: boolean;
  canDecideEscalated: boolean;
}

export const ROLES: Record<UserRole, RoleDefinition> = {
  TIER1_ANALYST: {
    id: "TIER1_ANALYST",
    label: "Tier-1 Analyst",
    level: "Junior",
    actor: "Priya Natarajan",
    approvableTiers: ["Low", "Medium"],
    canReject: true,
    canEscalate: true,
    canOverrideDecision: false,
    canDecideEscalated: false,
  },
  COMPLIANCE_LEAD: {
    id: "COMPLIANCE_LEAD",
    label: "Compliance Lead",
    level: "Admin",
    actor: "Marcus Ellison",
    approvableTiers: ["Low", "Medium", "High"],
    canReject: true,
    canEscalate: true,
    canOverrideDecision: true,
    canDecideEscalated: true,
  },
};

export const ROLE_ORDER: readonly UserRole[] = ["TIER1_ANALYST", "COMPLIANCE_LEAD"];

export type DecisionAction = "approve" | "reject" | "escalate";

export interface PermissionResult {
  allowed: boolean;
  /** Human-readable reason shown as a tooltip when `allowed` is false. */
  reason?: string;
  /** True when the action would overwrite an existing final decision. */
  override: boolean;
}

const FINAL_STATUSES = new Set<Application["status"]>(["Approved", "Rejected"]);

export function evaluatePermission(
  role: UserRole,
  app: Application,
  action: DecisionAction,
): PermissionResult {
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

export interface RoleContextValue {
  role: UserRole;
  definition: RoleDefinition;
  actor: string;
  setRole: (role: UserRole, applicationId?: string) => void;
  can: (app: Application, action: DecisionAction) => PermissionResult;
}

export const RoleContext = createContext<RoleContextValue | null>(null);

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within <KycProvider>");
  }
  return ctx;
}
