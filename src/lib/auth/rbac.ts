"use client";

import { createContext, useContext } from "react";
import type { Application, UserRole } from "@/lib/types";
import type { DecisionAction, PermissionResult, RoleDefinition } from "@/lib/auth/roles";

export {
  ESCALATION_QUEUE,
  ROLES,
  ROLE_ORDER,
  evaluatePermission,
  isRecordLocked,
  type DecisionAction,
  type PermissionResult,
  type RoleDefinition,
} from "@/lib/auth/roles";

export interface RoleContextValue {
  role: UserRole;
  definition: RoleDefinition;
  /** Display name of the signed-in operator; independent of the active role. */
  actor: string;
  /** Requests a role change; resolves to the role the server granted. */
  setRole: (role: UserRole, applicationId?: string) => Promise<UserRole>;
  /** Roles the signed-in operator is entitled to assume. */
  grants: readonly UserRole[];
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
