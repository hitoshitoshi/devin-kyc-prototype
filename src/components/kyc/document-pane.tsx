"use client";

import { Check, CircleAlert, CircleCheck, Square, SquareCheck } from "lucide-react";
import type { Application, ChecklistKey } from "@/lib/types";
import { useKyc } from "@/lib/state/kyc-context";
import { cn, formatDate, isExpired, normalize } from "@/lib/utils";
import { checklistConstraint } from "@/lib/checklist";
import { Badge } from "@/components/ui/badge";
import { IdentityCard } from "@/components/kyc/identity-card";
import { PaneHeader } from "@/components/kyc/applicant-pane";

const CHECKLIST_ITEMS: { key: ChecklistKey; label: string; hint: string }[] = [
  { key: "tamperCheckPassed", label: "Document tamper check passed", hint: "Hologram, font kerning and edge analysis" },
  { key: "facialMatchVerified", label: "Facial match verified", hint: "Selfie liveness vs. document portrait" },
  { key: "expirationValid", label: "Expiration date valid", hint: "Document must be unexpired at time of review" },
];

interface CompareRow {
  field: string;
  submitted: string;
  extracted: string;
  match: boolean;
}

function buildComparison(app: Application): CompareRow[] {
  const { applicant, document: doc } = app;
  const submittedAddress = `${applicant.address.line1}${applicant.address.line2 ? " " + applicant.address.line2 : ""}, ${applicant.address.city}, ${applicant.address.region} ${applicant.address.postalCode}`;
  const rows: CompareRow[] = [
    {
      field: "Full name",
      submitted: applicant.legalName,
      extracted: doc.ocr.fullName,
      match: normalize(applicant.legalName) === normalize(doc.ocr.fullName),
    },
    {
      field: "Date of birth",
      submitted: applicant.dateOfBirth,
      extracted: doc.ocr.dateOfBirth,
      match: applicant.dateOfBirth === doc.ocr.dateOfBirth,
    },
    {
      field: "Document no.",
      submitted: doc.documentNumber,
      extracted: doc.ocr.documentNumber,
      match: doc.documentNumber.replace(/\s/g, "") === doc.ocr.documentNumber.replace(/\s/g, ""),
    },
    {
      field: "Expiry",
      submitted: doc.expiresOn,
      extracted: doc.ocr.expiresOn,
      match: doc.expiresOn === doc.ocr.expiresOn,
    },
  ];
  if (doc.ocr.addressLine) {
    rows.push({
      field: "Address",
      submitted: submittedAddress,
      extracted: doc.ocr.addressLine,
      match: normalize(submittedAddress).replace(/[,#]/g, "") === normalize(doc.ocr.addressLine).replace(/[,#]/g, ""),
    });
  }
  return rows;
}

export function DocumentPane({ app, locked }: { app: Application; locked: boolean }) {
  const { toggleChecklist } = useKyc();
  const rows = buildComparison(app);
  const mismatches = rows.filter((r) => !r.match).length;
  const expired = isExpired(app.document.expiresOn);
  const completed = Object.values(app.checklist).filter(Boolean).length;

  return (
    <div className="flex min-h-0 flex-col">
      <PaneHeader
        title="Document Inspection"
        meta={
          <Badge mono>
            {app.document.type === "PASSPORT" ? "PASSPORT" : "DRIVER LICENSE"} · {app.document.issuingCountry}
          </Badge>
        }
      >
        <span className="font-mono text-[11px] text-zinc-500">
          OCR conf. {(app.document.ocr.confidence * 100).toFixed(0)}%
        </span>
      </PaneHeader>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex items-start justify-center border-b border-zinc-200 bg-zinc-100/70 px-6 py-6 dark:border-zinc-800 dark:bg-zinc-950/60">
          <IdentityCard document={app.document} applicant={app.applicant} />
        </div>

        <div className="px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">OCR extraction vs. submitted profile</h3>
            <Badge tone={mismatches ? "amber" : "green"} dot>
              {mismatches ? `${mismatches} mismatch${mismatches > 1 ? "es" : ""}` : "All fields match"}
            </Badge>
          </div>
          <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
            <div className="grid grid-cols-[110px_1fr_1fr_88px] bg-zinc-50 text-[11px] font-medium text-zinc-500 uppercase dark:bg-zinc-900 dark:text-zinc-400">
              <div className="px-2.5 py-1.5">Field</div>
              <div className="px-2.5 py-1.5">Submitted</div>
              <div className="px-2.5 py-1.5">Extracted (OCR)</div>
              <div className="px-2.5 py-1.5 text-right">Result</div>
            </div>
            {rows.map((r) => (
              <div
                key={r.field}
                className="grid grid-cols-[110px_1fr_1fr_88px] items-center border-t border-zinc-200 text-xs dark:border-zinc-800"
                data-testid={`ocr-row-${r.field.toLowerCase().replace(/[^a-z]/g, "-")}`}
              >
                <div className="px-2.5 py-1.5 text-zinc-500 dark:text-zinc-400">{r.field}</div>
                <div className="px-2.5 py-1.5">
                  <Chip value={r.submitted} tone="neutral" />
                </div>
                <div className="px-2.5 py-1.5">
                  <Chip value={r.extracted} tone={r.match ? "neutral" : "amber"} />
                </div>
                <div className="flex justify-end px-2.5 py-1.5">
                  {r.match ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <CircleCheck className="size-3.5" /> Match
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                      <CircleAlert className="size-3.5" /> Mismatch
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px] text-zinc-500">
            <span>issued {formatDate(app.document.issuedOn)}</span>
            <span className={cn(expired && "text-red-600 dark:text-red-400")}>
              expires {formatDate(app.document.expiresOn)}
              {expired && " (EXPIRED)"}
            </span>
            <span>{app.document.issuingAuthority}</span>
          </div>
        </div>

        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Verification checklist</h3>
            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
              {completed}/{CHECKLIST_ITEMS.length} complete
            </span>
          </div>
          <ul className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {CHECKLIST_ITEMS.map((item) => {
              const checked = app.checklist[item.key];
              const constraint = checklistConstraint(app, item.key);
              const blocked = !checked && !constraint.allowed;
              const warn = item.key === "expirationValid" && checked && expired;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-disabled={blocked || undefined}
                    disabled={locked || blocked}
                    title={blocked ? constraint.reason : undefined}
                    onClick={() => toggleChecklist(app.id, item.key)}
                    data-testid={`checklist-${item.key}`}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-xs transition-colors",
                      "hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:hover:bg-zinc-800/50",
                    )}
                  >
                    {checked ? (
                      <SquareCheck className="size-4 shrink-0 text-zinc-900 dark:text-zinc-100" />
                    ) : (
                      <Square className="size-4 shrink-0 text-zinc-400" />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn("font-medium", checked ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300")}>
                        {item.label}
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.hint}</span>
                    </span>
                    {(warn || blocked) && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                        <CircleAlert className="size-3" /> {blocked ? constraint.reason : "Document is expired"}
                      </span>
                    )}
                    {checked && !warn && <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {locked && <p className="mt-1.5 text-[11px] text-zinc-500">Checklist is read-only: decision is final for your role.</p>}
        </div>
      </div>
    </div>
  );
}

function Chip({ value, tone }: { value: string; tone: "neutral" | "amber" }) {
  return (
    <span
      className={cn(
        "inline-block max-w-full truncate rounded border px-1.5 py-0.5 font-mono text-[11px] leading-tight",
        tone === "amber"
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200",
      )}
      title={value}
    >
      {value}
    </span>
  );
}
