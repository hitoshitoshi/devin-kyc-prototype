"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onToggle: () => void;
  /** Content shown in the always-visible tab strip. */
  tab: ReactNode;
  /** Right-aligned controls in the tab strip. */
  actions?: ReactNode;
  children: ReactNode;
  height?: number;
  className?: string;
}

/** Bottom-anchored expandable panel. Collapsed state renders only the tab strip. */
export function Drawer({ open, onToggle, tab, actions, children, height = 288, className }: DrawerProps) {
  return (
    <section
      className={cn(
        "flex shrink-0 flex-col border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
      style={{ height: open ? height : 32 }}
    >
      <div className="flex h-8 shrink-0 items-center justify-between gap-3 px-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-left text-xs font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronUp className="size-3.5 shrink-0" />}
          {tab}
        </button>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {open && <div className="min-h-0 flex-1 overflow-auto border-t border-zinc-200 dark:border-zinc-800">{children}</div>}
    </section>
  );
}
