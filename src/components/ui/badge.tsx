import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red" | "violet";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  mono?: boolean;
}

const toneClasses: Record<BadgeTone, { wrap: string; dot: string }> = {
  neutral: {
    wrap: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:border-zinc-700",
    dot: "bg-zinc-400 dark:bg-zinc-500",
  },
  blue: {
    wrap: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
    dot: "bg-sky-500",
  },
  green: {
    wrap: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    dot: "bg-emerald-500",
  },
  amber: {
    wrap: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    dot: "bg-amber-500",
  },
  red: {
    wrap: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    dot: "bg-red-500",
  },
  violet: {
    wrap: "bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
    dot: "bg-violet-500",
  },
};

export function ToneDot({ tone, className }: { tone?: BadgeTone; className?: string }) {
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        tone ? toneClasses[tone].dot : "ring-1 ring-zinc-400 ring-inset",
        className,
      )}
      aria-hidden
    />
  );
}

export function Badge({ tone = "neutral", dot = false, mono = false, className, children, ...props }: BadgeProps) {
  const t = toneClasses[tone];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded border px-1.5 text-[11px] font-medium leading-none whitespace-nowrap",
        mono && "font-mono tracking-tight",
        t.wrap,
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} aria-hidden />}
      {children}
    </span>
  );
}
