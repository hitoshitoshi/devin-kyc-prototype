import type { UserRole } from "@/lib/types";

/**
 * Signed session token shared by the Edge middleware (verify) and server
 * actions (issue). Uses Web Crypto only so it runs in both runtimes.
 *
 * Payload is base64url(JSON) + "." + base64url(HMAC-SHA256(payload)).
 */
export const SESSION_COOKIE = "kyc_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
/** Tolerated clock difference between the issuing and verifying runtime. */
const CLOCK_SKEW_SECONDS = 60;

export interface SessionClaims {
  /** Stable subject identifier for the signed-in operator. */
  sub: string;
  /** Currently active role; must be one of `grants`. */
  role: UserRole;
  /** Roles the identity provider has entitled this operator to assume. */
  grants: readonly UserRole[];
  iat: number;
  exp: number;
}

const DEV_SECRET = "dev-only-kyc-session-secret-do-not-use-in-production";

function secret(): string {
  const value = process.env.KYC_SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("KYC_SESSION_SECRET must be set in production");
  }
  return DEV_SECRET;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signingKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(claims)));
  const mac = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(mac))}`;
}

const ROLE_VALUES: ReadonlySet<string> = new Set<UserRole>(["TIER1_ANALYST", "COMPLIANCE_LEAD"]);

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && ROLE_VALUES.has(value);
}

function isClaims(value: unknown): value is SessionClaims {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sub === "string" &&
    isUserRole(v.role) &&
    Array.isArray(v.grants) &&
    v.grants.every(isUserRole) &&
    v.grants.includes(v.role) &&
    typeof v.iat === "number" &&
    typeof v.exp === "number"
  );
}

/**
 * Returns the claims when the token is well-formed, authentic, currently
 * valid and was issued with a lifetime no longer than `SESSION_TTL_SECONDS`.
 */
export async function verifySession(token: string | undefined, now = Date.now()): Promise<SessionClaims | null> {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await signingKey(), fromBase64Url(mac), encoder.encode(payload));
    if (!valid) return null;
    const claims: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (!isClaims(claims)) return null;
    const nowSeconds = Math.floor(now / 1000);
    if (claims.iat > nowSeconds + CLOCK_SKEW_SECONDS) return null;
    if (claims.exp <= claims.iat || claims.exp - claims.iat > SESSION_TTL_SECONDS) return null;
    if (claims.exp <= nowSeconds) return null;
    return claims;
  } catch {
    return null;
  }
}
