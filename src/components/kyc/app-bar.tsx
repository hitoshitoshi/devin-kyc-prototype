"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Sun, Landmark } from "lucide-react";
import { RoleSwitcher } from "@/components/kyc/role-switcher";
import { Button } from "@/components/ui/button";

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("it-theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <Button variant="ghost" size="xs" onClick={toggle} aria-label="Toggle theme" className="px-1.5">
      {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </Button>
  );
}

export function AppBar() {
  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 text-xs">
        <Link href="/internal/kyc" className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
          <span className="flex size-5 items-center justify-center rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Landmark className="size-3" />
          </span>
          Internal Tools
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <span className="font-medium text-zinc-600 dark:text-zinc-400">KYC Review</span>
        <span className="ml-1 rounded border border-zinc-200 px-1 py-px font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          env: sandbox
        </span>
      </div>
      <div className="flex items-center gap-2">
        <RoleSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
