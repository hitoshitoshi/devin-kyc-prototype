"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { useKyc } from "@/lib/state/kyc-context";
import { useRole } from "@/lib/auth/rbac";
import type { Application, ApplicationStatus, RiskTier } from "@/lib/types";
import { cn, formatRelative, formatTimestamp, initials, normalize } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FlagBadge, RiskBadge, StatusBadge } from "@/components/kyc/badges";

type RiskFilter = "All" | RiskTier;
type StatusFilter = "All" | ApplicationStatus;
type SortKey = "submittedAt" | "score" | "status";

const RISK_OPTIONS: RiskFilter[] = ["All", "Low", "Medium", "High"];
const STATUS_OPTIONS: StatusFilter[] = ["All", "Pending", "Under Review", "Approved", "Rejected", "Escalated"];
const STATUS_RANK: Record<ApplicationStatus, number> = {
  Escalated: 0,
  Pending: 1,
  "Under Review": 2,
  Approved: 3,
  Rejected: 4,
};

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "amber" | "red" }) {
  return (
    <div className="flex min-w-[132px] flex-col gap-0.5 border-r border-zinc-200 py-2 pr-5 pl-0 last:border-r-0 dark:border-zinc-800">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
      <span
        className={cn(
          "font-mono text-lg leading-none font-semibold tabular-nums",
          tone === "amber" && value > 0 && "text-amber-600 dark:text-amber-400",
          tone === "red" && value > 0 && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function QueueView() {
  const router = useRouter();
  const { applications, metrics } = useKyc();
  const { definition } = useRole();
  const now = useNow();

  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState<RiskFilter>("All");
  const [status, setStatus] = useState<StatusFilter>("All");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "submittedAt", dir: "desc" });
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "Escape" && target === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const rows = useMemo(() => {
    const q = normalize(query);
    const filtered = applications.filter((a) => {
      if (risk !== "All" && a.risk.tier !== risk) return false;
      if (status !== "All" && a.status !== status) return false;
      if (!q) return true;
      return (
        normalize(a.applicant.legalName).includes(q) ||
        normalize(a.applicant.email).includes(q) ||
        normalize(a.id).includes(q)
      );
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "score":
          return (a.risk.score - b.risk.score) * dir;
        case "status":
          return (STATUS_RANK[a.status] - STATUS_RANK[b.status]) * dir;
        case "submittedAt":
        default:
          return a.submittedAt.localeCompare(b.submittedAt) * dir;
      }
    });
  }, [applications, query, risk, status, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort.key === k ? (
      sort.dir === "asc" ? (
        <ArrowUp className="ml-1 inline size-3" />
      ) : (
        <ArrowDown className="ml-1 inline size-3" />
      )
    ) : null;

  const open = (app: Application) => router.push(`/internal/kyc/${app.id}`);
  const hasFilters = query || risk !== "All" || status !== "All";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-zinc-200 bg-white px-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-end justify-between gap-6 pt-4 pb-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight">KYC Compliance Queue</h1>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Acting as <span className="font-medium text-zinc-700 dark:text-zinc-300">{definition.label}</span> ·{" "}
              {definition.approvableTiers.length === 3
                ? "unrestricted approval authority"
                : `approval limited to ${definition.approvableTiers.join(" / ")} risk`}
            </p>
          </div>
          <div className="flex gap-5">
            <Metric label="Total Pending" value={metrics.totalPending} />
            <Metric label="Requires Action" value={metrics.requiresAction} tone="amber" />
            <Metric label="High Risk" value={metrics.highRisk} tone="red" />
            <Metric label="Escalated" value={metrics.escalated} tone="amber" />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-5 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="relative w-80">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, or application ID"
            className="pr-14 pl-7"
            aria-label="Search applications"
          />
          <div className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2">
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="pointer-events-auto rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <Kbd>/</Kbd>
            )}
          </div>
        </div>
        <Select label="Risk" value={risk} onChange={(e) => setRisk(e.target.value as RiskFilter)} aria-label="Filter by risk tier">
          {RISK_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status">
          {STATUS_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRisk("All");
              setStatus("All");
            }}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
          >
            Reset
          </button>
        )}
        <span className="ml-auto font-mono text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
          {rows.length} / {applications.length} records
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-white dark:bg-zinc-900">
        <Table>
          <THead>
            <tr>
              <TH className="w-[120px]">App ID</TH>
              <TH>Applicant</TH>
              <TH className="w-[140px] cursor-pointer select-none" onClick={() => toggleSort("score")}>
                Risk <SortIcon k="score" />
              </TH>
              <TH className="w-[190px]">Primary Flag</TH>
              <TH className="w-[110px] cursor-pointer select-none" onClick={() => toggleSort("submittedAt")}>
                Submitted <SortIcon k="submittedAt" />
              </TH>
              <TH className="w-[180px]">Assigned Reviewer</TH>
              <TH className="w-[130px] cursor-pointer select-none" onClick={() => toggleSort("status")}>
                Status <SortIcon k="status" />
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((app) => (
              <TR
                key={app.id}
                interactive
                tabIndex={0}
                role="link"
                onClick={() => open(app)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") open(app);
                }}
                data-testid={`queue-row-${app.id}`}
              >
                <TD className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{app.id}</TD>
                <TD>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded bg-zinc-100 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {initials(app.applicant.legalName)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
                      <span className="truncate font-medium">{app.applicant.legalName}</span>
                      <span className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{app.applicant.email}</span>
                    </div>
                  </div>
                </TD>
                <TD>
                  <RiskBadge tier={app.risk.tier} score={app.risk.score} />
                </TD>
                <TD>
                  <FlagBadge flag={app.risk.primaryFlag} />
                </TD>
                <TD
                  className="text-xs text-zinc-600 dark:text-zinc-400"
                  title={formatTimestamp(app.submittedAt)}
                  suppressHydrationWarning
                >
                  {formatRelative(app.submittedAt, now)}
                </TD>
                <TD className="text-xs">
                  {app.assignedReviewer ? (
                    <span className="text-zinc-700 dark:text-zinc-300">{app.assignedReviewer}</span>
                  ) : (
                    <span className="text-zinc-400 italic dark:text-zinc-500">Unassigned</span>
                  )}
                </TD>
                <TD>
                  <StatusBadge status={app.status} />
                </TD>
              </TR>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-zinc-500">
                  No applications match the current filters.
                </td>
              </tr>
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
