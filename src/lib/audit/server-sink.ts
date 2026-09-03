import "server-only";

import { registerAuditSink } from "@/lib/audit/logger";
import type { AuditEvent } from "@/lib/types";

/**
 * Server-side audit store for events emitted in server actions (PII
 * disclosures, committed decisions). Each event is appended to an in-process
 * log — kept on `globalThis` so it survives dev-server module reloads — and
 * written as one JSON line to stdout for the platform log pipeline. A
 * production deployment forwards to the compliance event store instead; the
 * retained log is what hydrates the client ledger on every page load, so a
 * refreshed ledger reflects the transitions that actually happened.
 */
declare global {
  var __kycServerAuditLog: AuditEvent[] | undefined;
}

const log: AuditEvent[] = (globalThis.__kycServerAuditLog ??= []);

// Registered per module instance: the logger's sink list reloads with it.
registerAuditSink((event) => {
  log.push(event);
  process.stdout.write(`${JSON.stringify({ stream: "kyc-audit", ...event })}\n`);
});

/** Every event recorded on the server in this process, oldest first. */
export function serverAuditEvents(): readonly AuditEvent[] {
  return log;
}
