"use client";

import { useMemo, useState } from "react";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Copy, ScrollText } from "lucide-react";
import type { AuditAction, AuditEvent } from "@/lib/types";
import { AUDIT_ACTION_LABELS } from "@/lib/audit/logger";
import { ROLES } from "@/lib/auth/rbac";
import { useKyc } from "@/lib/state/kyc-context";
import { cn, formatTimestamp } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";

const ACTION_TONE: Record<AuditAction, BadgeTone> = {
  APPLICATION_SUBMITTED: "neutral",
  RISK_SCORED: "neutral",
  VIEWED_RECORD: "neutral",
  PII_UNMASKED: "red",
  CHECKLIST_UPDATED: "blue",
  NOTE_ADDED: "blue",
  STATUS_UPDATED: "amber",
  ROLE_SWITCHED: "violet",
  LEDGER_EXPORTED: "red",
};

export function AuditDrawer({ applicationId, events }: { applicationId: string; events: AuditEvent[] }) {
  const { serializeLedger, recordLedgerExport } = useKyc();
  const [open, setOpen] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);
  const [copied, setCopied] = useState(false);

  const ordered = useMemo(() => (newestFirst ? [...events].reverse() : events), [events, newestFirst]);
  const last = events[events.length - 1];

  const copy = async () => {
    const { json, eventCount } = serializeLedger(applicationId);
    try {
      await navigator.clipboard.writeText(json);
      recordLedgerExport(applicationId, eventCount);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Drawer
      open={open}
      onToggle={() => setOpen((o) => !o)}
      height={280}
      tab={
        <span className="flex min-w-0 items-center gap-2" data-testid="audit-drawer-tab">
          <ScrollText className="size-3.5 shrink-0 text-zinc-500" />
          <span>Compliance Audit Ledger</span>
          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
          {last && !open && (
            <span className="hidden min-w-0 items-center gap-1.5 truncate font-mono text-[11px] text-zinc-500 md:flex">
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              last {last.action} by {last.actor} @ {formatTimestamp(last.timestamp)}
            </span>
          )}
        </span>
      }
      actions={
        open && (
          <>
            <Button variant="ghost" size="xs" onClick={() => setNewestFirst((v) => !v)} className="text-[11px]">
              {newestFirst ? <ArrowDownWideNarrow className="size-3" /> : <ArrowUpWideNarrow className="size-3" />}
              {newestFirst ? "Newest first" : "Oldest first"}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={copy}
              className="text-[11px]"
              title="Copies a data-minimized export (IPs and contact fields redacted); the export itself is logged."
            >
              <Copy className="size-3" />
              {copied ? "Copied" : "Copy JSON"}
            </Button>
          </>
        )
      }
    >
      <table className="w-full border-collapse text-left text-xs" data-testid="audit-table">
        <thead className="sticky top-0 z-10 bg-zinc-50 text-[10px] font-medium tracking-wide text-zinc-500 uppercase dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="h-7 border-b border-zinc-200 px-3 font-medium dark:border-zinc-800">Timestamp</th>
            <th className="h-7 border-b border-zinc-200 px-3 font-medium dark:border-zinc-800">Actor</th>
            <th className="h-7 border-b border-zinc-200 px-3 font-medium dark:border-zinc-800">Role</th>
            <th className="h-7 border-b border-zinc-200 px-3 font-medium dark:border-zinc-800">Event</th>
            <th className="h-7 border-b border-zinc-200 px-3 font-medium dark:border-zinc-800">Metadata</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {ordered.map((e) => (
            <tr key={e.id} className="h-8 hover:bg-zinc-50 dark:hover:bg-zinc-800/40" data-testid={`audit-row-${e.action}`}>
              <td className="px-3 font-mono text-[11px] whitespace-nowrap text-zinc-600 tabular-nums dark:text-zinc-400">
                {formatTimestamp(e.timestamp)}
              </td>
              <td className="px-3 whitespace-nowrap">
                <span className={cn(e.role === "SYSTEM" && "font-mono text-zinc-500")}>{e.actor}</span>
              </td>
              <td className="px-3 whitespace-nowrap text-zinc-500">{e.role === "SYSTEM" ? "System" : ROLES[e.role].label}</td>
              <td className="px-3 whitespace-nowrap">
                <Badge tone={ACTION_TONE[e.action]} mono title={AUDIT_ACTION_LABELS[e.action]}>
                  {e.action}
                </Badge>
              </td>
              <td className="max-w-0 px-3">
                <code className="block truncate font-mono text-[11px] text-zinc-600 dark:text-zinc-400" title={JSON.stringify(e.metadata)}>
                  {JSON.stringify(e.metadata)}
                </code>
              </td>
            </tr>
          ))}
          {ordered.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-zinc-500">
                No events recorded for this application.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Drawer>
  );
}
