"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Application } from "@/lib/types";
import { useKyc } from "@/lib/state/kyc-context";
import { cn, formatDateLong, formatSsn, formatTimestamp, formatUsd, maskSsn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PaneHeader({ title, meta, children }: { title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-200 px-3 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-700 uppercase dark:text-zinc-300">{title}</h2>
        {meta}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children, mono, className }: { label: string; children: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[112px_1fr] items-start gap-3 border-b border-zinc-100 py-[7px] last:border-b-0 dark:border-zinc-800/60", className)}>
      <dt className="pt-px text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={cn("min-w-0 text-[13px] leading-snug text-zinc-900 dark:text-zinc-100", mono && "font-mono text-xs")}>{children}</dd>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mt-4 mb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase first:mt-0 dark:text-zinc-400">{children}</div>;
}

export function ApplicantPane({ app }: { app: Application }) {
  const { revealSsn } = useKyc();
  const [ssn, setSsn] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const revealed = ssn !== null;
  const { applicant } = app;
  const screening = applicant.screening;
  const screeningClear = !screening.pep && !screening.sanctions && !screening.adverseMedia;

  const toggleReveal = async () => {
    if (revealed) {
      setSsn(null);
      return;
    }
    setPending(true);
    try {
      setSsn(await revealSsn(app.id));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col">
      <PaneHeader title="Applicant" meta={<Badge mono>{app.applicant.country}</Badge>} />
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        <SectionLabel>Identity</SectionLabel>
        <dl>
          <Row label="Legal name">
            <span className="font-medium">{applicant.legalName}</span>
          </Row>
          <Row label="Date of birth" mono>
            {applicant.dateOfBirth}
            <span className="ml-2 text-zinc-400">{formatDateLong(applicant.dateOfBirth)}</span>
          </Row>
          <Row label="Tax ID / SSN">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn("font-mono text-xs tabular-nums", revealed && "text-red-700 dark:text-red-400")}
                data-testid="ssn-value"
              >
                {ssn ? formatSsn(ssn) : maskSsn(applicant.ssnLast4)}
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={toggleReveal}
                disabled={pending}
                aria-pressed={revealed}
                className="-my-1 text-[11px]"
                data-testid="ssn-reveal"
              >
                {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {revealed ? "Mask" : "Reveal"}
              </Button>
            </div>
            {revealed && (
              <div className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">Access logged to audit ledger (PII_UNMASKED)</div>
            )}
          </Row>
          <Row label="Nationality" mono>
            {applicant.nationality}
          </Row>
        </dl>

        <SectionLabel>Contact & Residence</SectionLabel>
        <dl>
          <Row label="Email" mono>
            <span className="block truncate" title={applicant.email}>
              {applicant.email}
            </span>
          </Row>
          <Row label="Phone" mono>
            {applicant.phone}
          </Row>
          <Row label="Address">
            <div>{applicant.address.line1}</div>
            {applicant.address.line2 && <div>{applicant.address.line2}</div>}
            <div>
              {applicant.address.city}, {applicant.address.region} <span className="font-mono text-xs">{applicant.address.postalCode}</span>
            </div>
          </Row>
          <Row label="Country" mono>
            {applicant.country}
          </Row>
          <Row label="Session IP" mono>
            {applicant.ipAddress}
          </Row>
        </dl>

        <SectionLabel>Financial Profile</SectionLabel>
        <dl>
          <Row label="Stated income" mono>
            {formatUsd(applicant.statedIncomeUsd)} <span className="text-zinc-400">/ yr</span>
          </Row>
          <Row label="Occupation">{applicant.occupation}</Row>
          <Row label="Product">
            {app.product} <span className="text-zinc-400">· {app.channel}</span>
          </Row>
        </dl>

        <SectionLabel>Screening</SectionLabel>
        <div
          className={cn(
            "rounded border px-2.5 py-2 text-xs",
            screeningClear
              ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30"
              : "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30",
          )}
        >
          <div className="flex items-center gap-1.5 font-medium">
            {screeningClear ? (
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="size-3.5 text-red-600 dark:text-red-400" />
            )}
            {screeningClear ? "No PEP / sanctions / adverse media hits" : "Screening hit — enhanced due diligence required"}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <ScreeningChip label="PEP" hit={screening.pep} />
            <ScreeningChip label="Sanctions" hit={screening.sanctions} />
            <ScreeningChip label="Adverse media" hit={screening.adverseMedia} />
          </div>
          {screening.matchedList && (
            <div className="mt-2 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">list: {screening.matchedList}</div>
          )}
          <div className="mt-1.5 font-mono text-[10px] text-zinc-500">screened {formatTimestamp(screening.screenedAt)}</div>
        </div>

        <SectionLabel>Risk factors</SectionLabel>
        <ul className="space-y-1">
          {app.risk.factors.map((f) => (
            <li key={f} className="flex gap-2 text-xs leading-snug text-zinc-700 dark:text-zinc-300">
              <span className="mt-[6px] size-1 shrink-0 rounded-full bg-zinc-400" />
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-2 font-mono text-[10px] text-zinc-500">model {app.risk.modelVersion}</div>
      </div>
    </div>
  );
}

function ScreeningChip({ label, hit }: { label: string; hit: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded border px-1.5 py-1 text-[11px]",
        hit
          ? "border-red-200 bg-white text-red-700 dark:border-red-900 dark:bg-zinc-900 dark:text-red-300"
          : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
      )}
    >
      <span>{label}</span>
      <span className="font-mono font-semibold">{hit ? "HIT" : "CLR"}</span>
    </div>
  );
}
