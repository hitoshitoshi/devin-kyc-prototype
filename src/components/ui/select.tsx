"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}

export interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  "aria-label"?: string;
  align?: "start" | "end";
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
}

/** Custom listbox that replaces the native <select> popup with console-styled options. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  "aria-label": ariaLabel,
  align = "start",
  disabled = false,
  className,
  menuClassName,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  const openMenu = useCallback(() => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }, [options, value]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  const commit = (index: number) => {
    const opt = options[index];
    if (opt && opt.value !== value) onChange(opt.value);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
  };

  return (
    <div ref={rootRef} className={cn("relative inline-flex text-xs", className)}>
      <div
        className={cn(
          "inline-flex h-7 items-stretch overflow-hidden rounded border bg-white transition-colors dark:bg-zinc-900",
          open
            ? "border-zinc-400 dark:border-zinc-500"
            : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600",
        )}
      >
        {label && (
          <span className="flex items-center border-r border-zinc-200 bg-zinc-50 px-2 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
            {label}
          </span>
        )}
        <button
          ref={buttonRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => (open ? close() : openMenu())}
          onKeyDown={onButtonKeyDown}
          className="flex items-center gap-1.5 pr-1.5 pl-2 font-medium text-zinc-800 outline-none focus-visible:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-100 dark:focus-visible:bg-zinc-800/60"
        >
          {selected?.icon && <span className="flex shrink-0 items-center text-zinc-500">{selected.icon}</span>}
          <span className="truncate">{selected?.label}</span>
          <ChevronDown className={cn("size-3.5 shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKeyDown}
          className={cn(
            "absolute top-full z-40 mt-1 min-w-full overflow-hidden rounded border border-zinc-200 bg-white p-0.5 shadow-md outline-none dark:border-zinc-700 dark:bg-zinc-900",
            align === "end" ? "right-0" : "left-0",
            menuClassName,
          )}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === value;
            const isActive = i === active;
            return (
              <li
                key={opt.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(i)}
                className={cn(
                  "flex cursor-default items-center gap-2 rounded-[3px] px-2 py-1.5 whitespace-nowrap",
                  isActive && "bg-zinc-100 dark:bg-zinc-800",
                )}
              >
                {opt.icon && <span className="flex shrink-0 items-center text-zinc-500">{opt.icon}</span>}
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className={cn("font-medium", isSelected ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-200")}>
                    {opt.label}
                  </span>
                  {opt.description && <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{opt.description}</span>}
                </span>
                <Check className={cn("size-3.5 shrink-0", isSelected ? "text-zinc-900 dark:text-zinc-50" : "invisible")} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
