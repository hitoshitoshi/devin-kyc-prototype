import { Landmark, ShieldCheck, UserRound } from "lucide-react";
import { SANDBOX_IDENTITIES, sandboxIdpEnabled } from "@/lib/auth/session";
import { ROLES } from "@/lib/auth/roles";
import { signIn } from "./actions";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const sandbox = sandboxIdpEnabled();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <header className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 text-xs dark:border-zinc-800">
          <span className="flex size-5 items-center justify-center rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <Landmark className="size-3" />
          </span>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Internal Tools</span>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <span className="font-medium text-zinc-600 dark:text-zinc-400">Sign in</span>
          <span className="ml-auto rounded border border-zinc-200 px-1 py-px font-mono text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            idp: {sandbox ? "sandbox" : "sso"}
          </span>
        </header>

        {!sandbox ? (
          <div className="px-4 py-3" data-testid="sign-in-disabled">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              The sandbox identity provider is disabled in this environment. Sessions are issued only by the
              organisation&apos;s SSO integration; set <span className="font-mono">KYC_SANDBOX_IDP=enabled</span>{" "}
              to run the demo identities on a non-development build.
            </p>
          </div>
        ) : (
          <div className="px-4 py-3">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Select an operator identity. The console issues a signed, HTTP-only session and derives all
              permissions from it; the browser never asserts its own role.
            </p>
            <ul className="mt-3 divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {SANDBOX_IDENTITIES.map((identity) => {
                const role = ROLES[identity.defaultRole];
                const admin = role.level === "Admin";
                return (
                  <li key={identity.sub}>
                    <form action={signIn}>
                      <input type="hidden" name="sub" value={identity.sub} />
                      {next && <input type="hidden" name="next" value={next} />}
                      <button
                        type="submit"
                        data-testid={`sign-in-${identity.sub}`}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                          {admin ? <ShieldCheck className="size-3.5" /> : <UserRound className="size-3.5" />}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">{identity.name}</span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{identity.title}</span>
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">{identity.sub}</span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Sandbox identities carry both role entitlements so the RBAC toggle can be exercised. In production,
              entitlements are mapped from SSO group claims and the switcher only offers granted roles.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
