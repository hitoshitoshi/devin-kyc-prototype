import "server-only";

import { cookies } from "next/headers";
import type { UserRole } from "@/lib/types";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
  type SessionClaims,
} from "@/lib/auth/session-token";

/**
 * Sandbox identity provider. In production these records come from SSO
 * group claims; the console only ever trusts the signed session cookie.
 */
export interface OperatorIdentity {
  sub: string;
  name: string;
  title: string;
  defaultRole: UserRole;
  /** Roles this operator may assume via the header switcher. */
  grants: readonly UserRole[];
}

export const SANDBOX_IDENTITIES: readonly OperatorIdentity[] = [
  {
    sub: "priya.natarajan",
    name: "Priya Natarajan",
    title: "KYC Analyst · Tier-1",
    defaultRole: "TIER1_ANALYST",
    grants: ["TIER1_ANALYST", "COMPLIANCE_LEAD"],
  },
  {
    sub: "marcus.ellison",
    name: "Marcus Ellison",
    title: "Compliance Lead",
    defaultRole: "COMPLIANCE_LEAD",
    grants: ["TIER1_ANALYST", "COMPLIANCE_LEAD"],
  },
];

export function findIdentity(sub: string): OperatorIdentity | undefined {
  return SANDBOX_IDENTITIES.find((i) => i.sub === sub);
}

/** Display name recorded as the audit actor for a session. */
export function operatorName(session: SessionClaims): string {
  return findIdentity(session.sub)?.name ?? session.sub;
}

export async function getSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

export async function issueSession(sub: string, role: UserRole, grants: readonly UserRole[]): Promise<SessionClaims> {
  const iat = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = { sub, role, grants, iat, exp: iat + SESSION_TTL_SECONDS };
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(claims), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return claims;
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
