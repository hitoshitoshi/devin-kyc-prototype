import type { ReactNode } from "react";
import { KycProvider } from "@/lib/state/kyc-context";
import { AppBar } from "@/components/kyc/app-bar";

export const dynamic = "force-dynamic";

export default function KycLayout({ children }: { children: ReactNode }) {
  return (
    <KycProvider seedAnchor={Date.now()}>
      <div className="flex h-screen flex-col overflow-hidden">
        <AppBar />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </KycProvider>
  );
}
