import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { KycProvider } from "@/lib/state/kyc-context";
import { AppBar } from "@/components/kyc/app-bar";

export const dynamic = "force-dynamic";

export default async function KycLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/internal/sign-in");

  return (
    <KycProvider seedAnchor={Date.now()} session={{ role: session.role, grants: session.grants }}>
      <div className="flex h-screen flex-col overflow-hidden">
        <AppBar />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </KycProvider>
  );
}
