import "server-only";

import { cookies, headers } from "next/headers";
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

/**
 * The sandbox IdP lets anyone pick an identity, so it is only available in
 * development unless a deployment opts in explicitly (`KYC_SANDBOX_IDP=enabled`).
 * A production build without the opt-in has no way to mint a session.
 */
export function sandboxIdpEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.KYC_SANDBOX_IDP === "enabled";
}

export function findIdentity(sub: string): OperatorIdentity | undefined {
  return SANDBOX_IDENTITIES.find((i) => i.sub === sub);
}

/**
 * Rejects state-changing requests whose `Origin` does not match the serving
 * host, independent of cookie `SameSite` behaviour and framework defaults.
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || !host || originHost !== host) throw new Error("Cross-origin request rejected");
}

/** Display name recorded as the audit actor for a session. */
export function operatorName(session: SessionClaims): string {
  return findIdentity(session.sub)?.name ?? session.sub;
}

export async function getSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** For server actions: same-origin check plus a verified session. */
export async function requireSession(): Promise<SessionClaims> {
  await assertSameOrigin();
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
