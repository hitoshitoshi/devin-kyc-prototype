"use server";

import { issueSession, requireSession } from "@/lib/auth/session";
import { lookupSsn } from "@/lib/data/pii-vault";
import type { UserRole } from "@/lib/types";

export interface RevealSsnResult {
  ssn: string;
  disclosedAt: string;
}

/**
 * Discloses the full tax identifier for the signed-in operator. Authority
 * comes from the session cookie, never from the caller.
 */
export async function revealSsn(applicationId: string): Promise<RevealSsnResult> {
  await requireSession();
  const ssn = lookupSsn(applicationId);
  if (!ssn) throw new Error(`No tax identifier on file for ${applicationId}`);
  return { ssn, disclosedAt: new Date().toISOString() };
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
