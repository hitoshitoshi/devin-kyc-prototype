import "server-only";

import { createHmac } from "node:crypto";
import { buildSeedApplications } from "@/lib/data/seed";

/**
 * Server-side stand-in for the PII store. Full tax identifiers never leave the
 * server as part of the application payload; the client only receives
 * `ssnLast4`, and the complete value is disclosed exclusively through the
 * `revealSsn` server action.
 *
 * No identifiers are stored in source: the sandbox derives the leading digits
 * from `PII_VAULT_KEY` so the repository and build artifacts contain only the
 * last four digits that are already shown masked in the UI.
 */
const DEV_KEY = "dev-only-pii-vault-key";

function vaultKey(): string {
  const value = process.env.PII_VAULT_KEY;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PII_VAULT_KEY must be set in production");
  }
  return DEV_KEY;
}

const LAST4_BY_APPLICATION: ReadonlyMap<string, string> = new Map(
  buildSeedApplications(0).map((app) => [app.id, app.applicant.ssnLast4]),
);

/** Area 001–899 excluding 666, group 01–99 — the ranges the SSA actually issues. */
function syntheticPrefix(applicationId: string): { area: string; group: string } {
  const digest = createHmac("sha256", vaultKey()).update(applicationId).digest();
  let area = (digest.readUInt16BE(0) % 898) + 1;
  if (area === 666) area = 667;
  const group = (digest[2] % 99) + 1;
  return { area: String(area).padStart(3, "0"), group: String(group).padStart(2, "0") };
}

export function lookupSsn(applicationId: string): string | undefined {
  const last4 = LAST4_BY_APPLICATION.get(applicationId);
  if (!last4) return undefined;
  const { area, group } = syntheticPrefix(applicationId);
  return `${area}-${group}-${last4}`;
}
