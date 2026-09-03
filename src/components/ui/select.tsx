import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, children, ...props },
  ref,
) {
  return (
    <label className={cn("inline-flex h-7 items-stretch overflow-hidden rounded border border-zinc-200 bg-white text-xs dark:border-zinc-700 dark:bg-zinc-900", className)}>
      {label && (
        <span className="flex items-center border-r border-zinc-200 bg-zinc-50 px-2 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
          {label}
        </span>
      )}
      <span className="relative flex items-center">
        <select
          ref={ref}
          className="h-full appearance-none bg-transparent pr-6 pl-2 font-medium text-zinc-800 outline-none dark:text-zinc-100"
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 size-3.5 text-zinc-400" />
      </span>
    </label>
  );
});
