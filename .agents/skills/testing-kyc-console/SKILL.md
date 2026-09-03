---
name: testing-kyc-console
description: How to run and browser-test the KYC Review Console (Next.js) in devin-kyc-prototype — dev server pitfalls, seed records, and stable selectors/test IDs.
---

# Testing the KYC Review Console

## Run
- `cd /home/ubuntu/repos/devin-kyc-prototype && npm run dev -- -p 3000`; app at http://localhost:3000 (redirects to `/internal/kyc`, then to `/internal/sign-in?next=...` until a session cookie exists).
- Sign-in is a sandbox IdP: click `data-testid="sign-in-priya.natarajan"` (starts as Tier-1) or `sign-in-marcus.ellison` (starts as Compliance Lead). Both identities are granted both roles, so the header role switcher works either way. Sign out via the header `aria-label="Sign out"` button. No env vars needed in dev (`KYC_SESSION_SECRET` / `PII_VAULT_KEY` have dev fallbacks).
- State is in-memory seed data (12 applicants) and resets on hard refresh; the session cookie (`kyc_session`, 8h) persists.
- If the page renders but nothing is interactive (search `/` does nothing, chunk 404s for `main-app.js`/`page.js`, or "Attempted import error" in the console), the `.next` dir is likely stale from a previous branch. Fix: kill the dev server, `rm -rf .next`, restart. Confirm hydration by checking the Next.js dev badge appears bottom-left and the search input responds.

## Useful seed records
- `APP-7F3A21` Daniel Okonkwo — High risk, Pending, SSN last-4 `4819` (use for RBAC + SSN reveal + checklist). Full SSNs are derived server-side from `PII_VAULT_KEY`; assert the `\d{3}-\d{2}-4819` shape, not a fixed value.
- `APP-E8C412` Robert Hale — document expired 2024-02-27: `checklist-expirationValid` is disabled with "Document expired …".
- `APP-6B2F58` Fatima Al-Rashid — Medium, Pending (Tier-1 can approve/reject).
- `APP-E8C412` Robert Hale, `APP-9E04F7` Marcus Whitfield — Medium, Pending (spare records for escalate/approve).
- `APP-B31D6E` Aleksandr Volkov — email `a.volkov.1984@yandex.com` (good search target).

## Selectors / test IDs
- Queue: `input[aria-label="Search applications"]`, `select[aria-label="Filter by risk tier"]`, `select[aria-label="Filter by status"]`, rows `data-testid="queue-row-<APP-ID>"`.
- Header role: custom listbox `button[aria-label="Active role"]` (role=combobox) → options in `ul[role=listbox]`. Switching calls the `switchRole` server action (brief disabled state), the actor chip always shows the signed-in operator (Priya Natarajan or Marcus Ellison) regardless of active role — all audit events carry that operator as `actor` with the role as separate metadata.
- Detail: `console-app-id`, `ssn-value`, `ssn-reveal`, `checklist-tamperCheckPassed|facialMatchVerified|expirationValid`, `action-approve|reject|escalate`, `confirm-approve|reject|escalate`, `reject-continue`.
- Audit drawer: `audit-drawer-tab` (collapsed at 32px; click to expand to 280px), rows `audit-row-<ACTION>`. Metadata column is truncated on screen — full JSON is in the `<code title="...">` attribute. *Copy JSON* writes a minimized export (`ip` → `[redacted]`, `redactedFields` array) and appends `LEDGER_EXPORTED` only after the clipboard write resolves (headless/insecure contexts without clipboard permission log nothing).

## Gotchas
- `VIEWED_RECORD` is deduped only within a 2s window per (app, role); re-opening a record later legitimately adds another one.
- Escalating/rejecting/approving as Tier-1 makes the decision final for that role (buttons disabled, checklist read-only) — use a fresh Pending record per decision type.
- Escalate reassigns the record to `Compliance Lead queue`; the `STATUS_UPDATED` event carries `reassignedTo`. Escalated records are read-only (checklist disabled, SSN *Reveal* disabled with a tooltip) for Tier-1; a Compliance Lead deciding one becomes its assignee.
- Decisions go through the `commitDecision` server action, which reads the record's current status from the server-side store (`src/lib/data/record-store.ts`, in-memory on `globalThis` — restarting the dev server resets dispositions; a page reload does not) and commits before emitting. Confirm buttons show `Authorizing…` and are disabled while in flight. (`PII_UNMASKED` and `STATUS_UPDATED` are emitted server-side and appear in the ledger once the action resolves — allow a short delay before asserting). A denied decision shows a red `role=alert` banner inside the modal instead of closing it.
- Hovering with a single `mouse_move` sometimes doesn't trigger the CSS `group-hover` tooltip; nudge the mouse a few px and re-hover.

## Devin Secrets Needed
None.
