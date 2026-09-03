"use client";

import { useParams } from "next/navigation";
import { ShieldCheck, UserRound } from "lucide-react";
import { ROLES, ROLE_ORDER, useRole } from "@/lib/auth/rbac";
import type { UserRole } from "@/lib/types";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function RoleSwitcher() {
  const { role, definition, setRole } = useRole();
  const params = useParams<{ id?: string }>();
  const isAdmin = definition.level === "Admin";

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "hidden items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium sm:inline-flex",
          isAdmin
            ? "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
            : "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
        )}
      >
        {isAdmin ? <ShieldCheck className="size-3" /> : <UserRound className="size-3" />}
        {definition.actor}
      </span>
      <Select
        aria-label="Active role"
        label="Role"
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole, params?.id)}
      >
        {ROLE_ORDER.map((r) => (
          <option key={r} value={r}>
            {ROLES[r].label} ({ROLES[r].level})
          </option>
        ))}
      </Select>
    </div>
  );
}
