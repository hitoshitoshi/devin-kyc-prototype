import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content?: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "center" | "start" | "end";
  className?: string;
}

/**
 * CSS-only hover/focus tooltip. Wraps children in an inline-flex span so it
 * also works around disabled buttons, which do not emit pointer events.
 */
export function Tooltip({ content, children, side = "top", align = "center", className }: TooltipProps) {
  if (!content) return <>{children}</>;
  return (
    <span className={cn("group/tt relative inline-flex", className)} tabIndex={-1}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-40 w-max max-w-[240px] rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] leading-snug font-normal text-zinc-100 opacity-0 shadow-sm transition-opacity",
          "group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
          "dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "start" && "left-0",
          align === "end" && "right-0",
        )}
      >
        {content}
      </span>
    </span>
  );
}
