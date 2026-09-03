"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { useKyc, type DecisionInput } from "@/lib/state/kyc-context";
import { isRecordLocked, useRole, type DecisionAction } from "@/lib/auth/rbac";
import { formatRelative, formatTimestamp, initials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { RiskBadge, StatusBadge } from "@/components/kyc/badges";
import { ApplicantPane } from "@/components/kyc/applicant-pane";
import { DocumentPane } from "@/components/kyc/document-pane";
import { DecisionPane } from "@/components/kyc/decision-pane";
import { DecisionModals } from "@/components/kyc/decision-modals";
import { AuditDrawer } from "@/components/kyc/audit-drawer";

export function ReviewConsole({ id }: { id: string }) {
  const router = useRouter();
  const { applications, eventsFor, viewRecord, decide } = useKyc();
  const { can, role } = useRole();
  const [action, setAction] = useState<DecisionAction | null>(null);

  const app = applications.find((a) => a.id === id);
  const index = applications.findIndex((a) => a.id === id);
  const prev = index > 0 ? applications[index - 1] : null;
  const next = index >= 0 && index < applications.length - 1 ? applications[index + 1] : null;

  const appId = app?.id;
  useEffect(() => {
    if (appId) viewRecord(appId);
  }, [appId, viewRecord]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (typing || action) return;
      if (e.key === "Escape") router.push("/internal/kyc");
      if (e.key === "[" && prev) router.push(`/internal/kyc/${prev.id}`);
      if (e.key === "]" && next) router.push(`/internal/kyc/${next.id}`);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, action, prev, next]);

  const [decisionError, setDecisionError] = useState<string | null>(null);
  const closeModal = useCallback(() => {
    setAction(null);
    setDecisionError(null);
  }, []);

  const confirm = useCallback(
    async (input: DecisionInput) => {
      if (!app) return;
      try {
        if (await decide(app.id, input)) closeModal();
        else setDecisionError("Decision not permitted for your role.");
      } catch (err) {
        setDecisionError(err instanceof Error ? err.message : "Decision could not be authorized.");
      }
    },
    [app, decide, closeModal],
  );

  if (!app) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm">
        <div className="font-mono text-xs text-zinc-500">{id}</div>
        <div>Application not found.</div>
        <Link href="/internal/kyc" className="text-xs underline underline-offset-2">
          ← Back to Queue
        </Link>
      </div>
    );
  }

  const locked = isRecordLocked(role, app);
  const override = action ? can(app, action).override : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          href="/internal/kyc"
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="size-3.5" /> Back to Queue
        </Link>
        <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
        <span className="font-mono text-[13px] font-semibold" data-testid="console-app-id">
          {app.id}
        </span>
        <StatusBadge status={app.status} />
        <RiskBadge tier={app.risk.tier} score={app.risk.score} />
        <span
          className="inline-flex h-5 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 pr-2 pl-0.5 text-[11px] dark:border-zinc-700 dark:bg-zinc-800/60"
          data-testid="assigned-reviewer"
        >
          {app.assignedReviewer ? (
            <>
              <span className="flex size-4 items-center justify-center rounded-full bg-zinc-900 font-mono text-[8px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                {initials(app.assignedReviewer)}
              </span>
              <span className="text-zinc-700 dark:text-zinc-300">{app.assignedReviewer}</span>
            </>
          ) : (
            <>
              <span className="flex size-4 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-700">
                <UserRound className="size-2.5" />
              </span>
              <span className="text-zinc-500 italic">Unassigned</span>
            </>
          )}
        </span>
        <span className="ml-auto hidden items-center gap-3 text-[11px] text-zinc-500 lg:flex">
          <span className="font-mono" title={formatTimestamp(app.submittedAt)} suppressHydrationWarning>
            submitted {formatRelative(app.submittedAt)}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd> queue
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            className="px-1"
            disabled={!prev}
            onClick={() => prev && router.push(`/internal/kyc/${prev.id}`)}
            aria-label="Previous application"
            title="Previous ( [ )"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
            {index + 1}/{applications.length}
          </span>
          <Button
            variant="ghost"
            size="xs"
            className="px-1"
            disabled={!next}
            onClick={() => next && router.push(`/internal/kyc/${next.id}`)}
            aria-label="Next application"
            title="Next ( ] )"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </span>
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)_360px] divide-x divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
        <ApplicantPane app={app} />
        <DocumentPane app={app} locked={locked} />
        <DecisionPane app={app} onAction={setAction} />
      </div>

      <AuditDrawer applicationId={app.id} events={eventsFor(app.id)} />

      <DecisionModals
        app={app}
        action={action}
        override={override}
        onClose={closeModal}
        onConfirm={confirm}
        error={decisionError}
      />
    </div>
  );
}
