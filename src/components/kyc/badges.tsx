import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { ApplicationStatus, PrimaryFlag, RiskTier } from "@/lib/types";

const STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  Pending: "neutral",
  "Under Review": "blue",
  Approved: "green",
  Rejected: "red",
  Escalated: "amber",
};

export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot className={className}>
      {status}
    </Badge>
  );
}

const RISK_TONE: Record<RiskTier, BadgeTone> = {
  Low: "green",
  Medium: "amber",
  High: "red",
};

export function RiskBadge({
  tier,
  score,
  className,
}: {
  tier: RiskTier;
  score?: number;
  className?: string;
}) {
  return (
    <Badge tone={RISK_TONE[tier]} className={className}>
      {score !== undefined && <span className="font-mono tabular-nums">{score}/100</span>}
      <span>{tier}</span>
    </Badge>
  );
}

const CRITICAL_FLAGS: ReadonlySet<PrimaryFlag> = new Set([
  "PEP Hit",
  "Sanctions Match",
  "Synthetic ID Suspected",
]);

export function FlagBadge({ flag }: { flag: PrimaryFlag }) {
  if (flag === "Clean") return <Badge tone="green" dot>Clean</Badge>;
  return (
    <Badge tone={CRITICAL_FLAGS.has(flag) ? "red" : "neutral"} dot>
      {flag}
    </Badge>
  );
}
