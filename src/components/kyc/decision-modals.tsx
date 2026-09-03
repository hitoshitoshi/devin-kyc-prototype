"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Application, RejectionReasonCode } from "@/lib/types";
import type { DecisionAction } from "@/lib/auth/rbac";
import type { DecisionInput } from "@/lib/state/kyc-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";
import { RiskBadge, StatusBadge } from "@/components/kyc/badges";

const REASON_CODES: { code: RejectionReasonCode; label: string; description: string }[] = [
  { code: "EXPIRED_DOCUMENT", label: "Expired document", description: "Identity document past its expiration date." },
  { code: "UNREADABLE_SCAN", label: "Unreadable scan", description: "Image quality insufficient for OCR or manual review." },
  { code: "SUSPECTED_FRAUD", label: "Suspected fraud", description: "Tampering, synthetic identity, or inconsistent attributes." },
  { code: "SANCTIONS_LIST", label: "Sanctions list", description: "Confirmed match on OFAC / UN / EU sanctions lists." },
];

interface Props {
  app: Application;
  action: DecisionAction | null;
  override: boolean;
  onClose: () => void;
  onConfirm: (input: DecisionInput) => void;
}

function Summary({ app }: { app: Application }) {
  const completed = Object.values(app.checklist).filter(Boolean).length;
  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center justify-between">
        <span className="font-mono">{app.id}</span>
        <div className="flex gap-1.5">
          <RiskBadge tier={app.risk.tier} score={app.risk.score} />
          <StatusBadge status={app.status} />
        </div>
      </div>
      <div className="mt-1 font-medium">{app.applicant.legalName}</div>
      <div className="text-zinc-500">{app.risk.primaryFlag} · checklist {completed}/3</div>
    </div>
  );
}

export function DecisionModals({ app, action, override, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState<RejectionReasonCode | null>(null);
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"input" | "confirm">("input");

  useEffect(() => {
    if (action) {
      setReason(null);
      setNote("");
      setStep(action === "reject" ? "input" : "confirm");
    }
  }, [action]);

  const incomplete = Object.values(app.checklist).filter(Boolean).length < 3;

  if (action === "approve") {
    return (
      <Modal
        open
        onClose={onClose}
        title={override ? "Override and approve application" : "Confirm approval"}
        description="This commits the decision and writes a STATUS_UPDATED event to the audit ledger."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="success" onClick={() => onConfirm({ status: "Approved", note })} data-testid="confirm-approve">
              {override ? "Override & approve" : "Approve application"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Summary app={app} />
          {incomplete && (
            <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              Verification checklist is incomplete. Approval will be recorded with the current checklist state.
            </div>
          )}
          {override && (
            <div className="flex items-start gap-2 rounded border border-violet-200 bg-violet-50 px-2.5 py-2 text-xs text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              You are overriding a prior <span className="font-semibold">{app.status}</span> decision. The override flag is recorded in the ledger.
            </div>
          )}
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional decision note" aria-label="Decision note" />
        </div>
      </Modal>
    );
  }

  if (action === "escalate") {
    return (
      <Modal
        open
        onClose={onClose}
        title="Escalate for senior review"
        description="Moves the application to the Compliance Lead queue. Tier-1 actions are frozen until disposition."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => onConfirm({ status: "Escalated", note })} data-testid="confirm-escalate">
              Escalate
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Summary app={app} />
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Escalation rationale (recommended)"
            aria-label="Escalation rationale"
          />
        </div>
      </Modal>
    );
  }

  if (action === "reject") {
    if (step === "input") {
      return (
        <Modal
          open
          onClose={onClose}
          title="Reject application"
          description="Select a structured reason code. Free-text context is optional."
          footer={
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" disabled={!reason} onClick={() => setStep("confirm")} data-testid="reject-continue">
                Continue
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <div role="radiogroup" aria-label="Rejection reason" className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {REASON_CODES.map((r) => {
                const selected = reason === r.code;
                return (
                  <button
                    key={r.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setReason(r.code)}
                    data-testid={`reason-${r.code}`}
                    className={cn(
                      "flex w-full items-start gap-2.5 px-2.5 py-2 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                      selected && "bg-zinc-100 dark:bg-zinc-800",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-[3px] flex size-3 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-400",
                      )}
                    >
                      {selected && <span className="size-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{r.label}</span>
                        <span className="font-mono text-[10px] text-zinc-500">{r.code}</span>
                      </span>
                      <span className="text-[11px] text-zinc-500">{r.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional context for the applicant record" aria-label="Rejection note" />
          </div>
        </Modal>
      );
    }
    return (
      <Modal
        open
        onClose={onClose}
        title={override ? "Override and reject application" : "Confirm rejection"}
        description="This commits the decision and writes a STATUS_UPDATED event to the audit ledger."
        footer={
          <>
            <Button variant="ghost" onClick={() => setStep("input")}>
              Back
            </Button>
            <Button
              variant="danger"
              onClick={() => reason && onConfirm({ status: "Rejected", reasonCode: reason, note })}
              data-testid="confirm-reject"
            >
              {override ? "Override & reject" : "Reject application"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Summary app={app} />
          <div className="rounded border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            Reason code: <span className="font-mono font-semibold">{reason}</span>
            {note.trim() && <div className="mt-1 text-red-800/80 dark:text-red-200/80">&ldquo;{note.trim()}&rdquo;</div>}
          </div>
        </div>
      </Modal>
    );
  }

  return null;
}
