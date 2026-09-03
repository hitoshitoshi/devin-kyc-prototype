import type { AuditEvent } from "@/lib/types";

/** Metadata keys that carry personal data and are never included in exports. */
const REDACTED_KEYS: ReadonlySet<string> = new Set(["ip", "ipAddress", "email", "phone", "ssn"]);

export interface ExportedAuditEvent extends Omit<AuditEvent, "metadata"> {
  metadata: Record<string, unknown>;
  /** Dot-paths of the metadata values that were replaced with the redaction marker. */
  redactedFields: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Recursively replaces personal-data keys at any depth, recording each path. */
function redact(value: unknown, path: string, redactedFields: string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => redact(item, `${path}[${index}]`, redactedFields));
  }
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (REDACTED_KEYS.has(key)) {
      redactedFields.push(childPath);
      out[key] = "[redacted]";
    } else {
      out[key] = redact(child, childPath, redactedFields);
    }
  }
  return out;
}

/**
 * Data-minimized view of the ledger for export off the console. Personal data
 * in metadata — at any nesting depth — is replaced with a marker and the
 * removed paths are listed so the export remains self-describing for
 * downstream reviewers.
 */
export function minimizeForExport(events: readonly AuditEvent[]): ExportedAuditEvent[] {
  return events.map((event) => {
    const redactedFields: string[] = [];
    const metadata = redact(event.metadata, "", redactedFields) as Record<string, unknown>;
    return { ...event, metadata, redactedFields };
  });
}
