import type { AuditEvent } from "@/lib/types";

/** Metadata keys that carry personal data and are never included in exports. */
const REDACTED_KEYS: ReadonlySet<string> = new Set(["ip", "ipAddress", "email", "phone", "ssn"]);

export interface ExportedAuditEvent extends Omit<AuditEvent, "metadata"> {
  metadata: Record<string, unknown>;
  redactedFields: string[];
}

/**
 * Data-minimized view of the ledger for export off the console. Personal data
 * in metadata is replaced with a marker and the removed keys are listed so the
 * export remains self-describing for downstream reviewers.
 */
export function minimizeForExport(events: readonly AuditEvent[]): ExportedAuditEvent[] {
  return events.map((event) => {
    const redactedFields: string[] = [];
    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event.metadata)) {
      if (REDACTED_KEYS.has(key)) {
        redactedFields.push(key);
        metadata[key] = "[redacted]";
      } else {
        metadata[key] = value;
      }
    }
    return { ...event, metadata, redactedFields };
  });
}
