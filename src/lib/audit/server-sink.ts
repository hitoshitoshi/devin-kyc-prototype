import "server-only";

import { registerAuditSink } from "@/lib/audit/logger";

/**
 * Durable sink for events emitted on the server (e.g. PII disclosures inside
 * server actions). Writes one JSON line per event to stdout, where the
 * platform log pipeline collects it; a production deployment would forward to
 * the compliance event store instead. Registered once per server process.
 */
declare global {
  var __kycServerAuditSink: boolean | undefined;
}

if (!globalThis.__kycServerAuditSink) {
  globalThis.__kycServerAuditSink = true;
  registerAuditSink((event) => {
    process.stdout.write(`${JSON.stringify({ stream: "kyc-audit", ...event })}\n`);
  });
}
