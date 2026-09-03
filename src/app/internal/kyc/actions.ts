"use server";

import { lookupSsn } from "@/lib/data/pii-vault";
import type { UserRole } from "@/lib/types";

const DISCLOSURE_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["TIER1_ANALYST", "COMPLIANCE_LEAD"]);

export interface RevealSsnResult {
  ssn: string;
  disclosedAt: string;
}

export async function revealSsn(applicationId: string, role: UserRole): Promise<RevealSsnResult> {
  if (!DISCLOSURE_ROLES.has(role)) throw new Error("Role is not permitted to view tax identifiers");
  const ssn = lookupSsn(applicationId);
  if (!ssn) throw new Error(`No tax identifier on file for ${applicationId}`);
  return { ssn, disclosedAt: new Date().toISOString() };
}
