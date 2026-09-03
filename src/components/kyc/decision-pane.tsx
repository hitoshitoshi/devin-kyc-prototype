"use client";

import { useState } from "react";
import { ArrowUpRight, Check, CornerDownLeft, MessageSquareText, X } from "lucide-react";
import type { Application } from "@/lib/types";
import { useKyc } from "@/lib/state/kyc-context";
import { ROLES, useRole, type DecisionAction } from "@/lib/auth/rbac";
import { cn, formatTimestamp, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { PaneHeader } from "@/components/kyc/applicant-pane";

export function DecisionPane({ app, onAction }: { app: Application; onAction: (action: DecisionAction) => void }) {
  const { addNote } = useKyc();
  const { can, role } = useRole();
  const [draft, setDraft] = useState("");

  const approve = can(app, "approve");
  const reject = can(app, "reject");
  const escalate = can(app, "escalate");
  const isFinal = app.status === "Approved" || app.status === "Rejected";

  const submitNote = () => {
    if (!draft.trim()) return;
    addNote(app.id, draft);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-col">
      <PaneHeader title="Decisioning" meta={<Badge mono>{ROLES[role].label}</Badge>} />

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {app.decision && (
          <div
            className={cn(
              "mb-3 rounded border px-2.5 py-2 text-xs",
              app.decision.outcome === "Approved" && "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
              app.decision.outcome === "Rejected" && "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30",
              app.decision.outcome === "Escalated" && "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
            )}
            data-testid="decision-summary"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {app.decision.outcome}
                {app.decision.override && <span className="ml-1.5 font-normal text-zinc-500">(override)</span>}
              </span>
              <span className="font-mono text-[10px] text-zinc-500">{formatTimestamp(app.decision.decidedAt)}</span>
            </div>
            <div className="mt-0.5 text-zinc-600 dark:text-zinc-400">
              by {app.decision.decidedBy} · {ROLES[app.decision.role].label}
            </div>
            {app.decision.reasonCode && (
              <div className="mt-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">reason: {app.decision.reasonCode}</div>
            )}
          </div>
        )}

        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Internal notes</h3>
          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{app.notes.length}</span>
        </div>
        {app.notes.length === 0 ? (
          <div className="flex items-center gap-2 rounded border border-dashed border-zinc-200 px-2.5 py-3 text-xs text-zinc-500 dark:border-zinc-800">
            <MessageSquareText className="size-3.5" /> No analyst notes yet.
          </div>
        ) : (
          <ol className="space-y-2" data-testid="notes-list">
            {app.notes.map((n) => (
              <li key={n.id} className="rounded border border-zinc-200 px-2.5 py-2 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-zinc-100 font-mono text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {initials(n.author)}
                    </span>
                    <span className="truncate text-xs font-medium">{n.author}</span>
                    <span className="truncate text-[11px] text-zinc-500">
                      {n.role === "SYSTEM" ? "System" : ROLES[n.role].label}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-zinc-500">{formatTimestamp(n.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs leading-snug text-zinc-800 dark:text-zinc-200">{n.body}</p>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submitNote();
              }
            }}
            rows={3}
            placeholder="Add an internal note…"
            aria-label="Add internal note"
            data-testid="note-input"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Kbd>Ctrl</Kbd>
              <span>+</span>
              <Kbd>
                <CornerDownLeft className="size-2.5" />
              </Kbd>
              to submit
            </span>
            <Button size="xs" variant="secondary" onClick={submitNote} disabled={!draft.trim()} data-testid="note-submit">
              Add note
            </Button>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500">
          <span>{isFinal ? "Decision recorded" : "Disposition"}</span>
          {approve.override && <span className="text-violet-700 dark:text-violet-300">Compliance Lead override enabled</span>}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Tooltip content={approve.allowed ? undefined : approve.reason} align="start" className="w-full">
            <Button
              variant="success"
              size="md"
              className="w-full"
              disabled={!approve.allowed}
              onClick={() => onAction("approve")}
              data-testid="action-approve"
            >
              <Check className="size-3.5" /> Approve
            </Button>
          </Tooltip>
          <Tooltip content={reject.allowed ? undefined : reject.reason} className="w-full">
            <Button
              variant="danger"
              size="md"
              className="w-full"
              disabled={!reject.allowed}
              onClick={() => onAction("reject")}
              data-testid="action-reject"
            >
              <X className="size-3.5" /> Reject
            </Button>
          </Tooltip>
          <Tooltip content={escalate.allowed ? undefined : escalate.reason} align="end" className="w-full">
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              disabled={!escalate.allowed}
              onClick={() => onAction("escalate")}
              data-testid="action-escalate"
            >
              <ArrowUpRight className="size-3.5" /> Escalate
            </Button>
          </Tooltip>
        </div>
        {!approve.allowed && approve.reason && (
          <p className="mt-1.5 text-[11px] leading-snug text-zinc-500" data-testid="approve-hint">
            {approve.reason}
          </p>
        )}
      </div>
    </div>
  );
}
