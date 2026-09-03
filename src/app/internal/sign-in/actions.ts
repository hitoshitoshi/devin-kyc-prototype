"use server";

import { redirect } from "next/navigation";
import {
  assertSameOrigin,
  clearSession,
  findIdentity,
  issueSession,
  sandboxIdpEnabled,
} from "@/lib/auth/session";

function safeNext(value: FormDataEntryValue | null): string {
  return typeof value === "string" && value.startsWith("/internal/") && !value.startsWith("/internal/sign-in")
    ? value
    : "/internal/kyc";
}

export async function signIn(formData: FormData): Promise<void> {
  await assertSameOrigin();
  if (!sandboxIdpEnabled()) throw new Error("Sandbox identity provider is disabled");
  const sub = formData.get("sub");
  const identity = typeof sub === "string" ? findIdentity(sub) : undefined;
  if (!identity) throw new Error("Unknown operator identity");
  await issueSession(identity.sub, identity.defaultRole, identity.grants);
  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  await assertSameOrigin();
  await clearSession();
  redirect("/internal/sign-in");
}
