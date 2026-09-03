# KYC Review Console

An internal tool for compliance analysts to work a queue of KYC applications: inspect applicant data and identity documents, run a verification checklist, leave notes, and approve, reject or escalate each case. Every action is written to a per-record audit ledger.

Built with Next.js 15 (App Router), TypeScript and Tailwind CSS. This is a prototype: applicants, documents, risk scores and the sign-in identities are seeded/simulated, and all state lives in memory.

## What it does

- **Queue** (`/internal/kyc`) — 12 seeded applications with risk tier, primary flag, status and assignee. Search across name / email / App ID (`/` to focus), filter by risk and status, sort columns, click a row to open it.
- **Review console** (`/internal/kyc/[id]`) — three panes:
  - *Applicant*: identity, address, income, screening result. SSN is masked (`•••-••-4819`); **Reveal** fetches it from the server and logs `PII_UNMASKED`.
  - *Document*: mock passport / driver licence, OCR-vs-profile comparison, verification checklist. An expired document cannot be marked valid.
  - *Decision*: notes, **Approve** / **Reject** (requires a reason code) / **Escalate**, each behind a confirmation.
- **Audit ledger** — drawer at the bottom listing every event for the record (`VIEWED_RECORD`, `PII_UNMASKED`, `CHECKLIST_UPDATED`, `NOTE_ADDED`, `STATUS_UPDATED`, …) with actor, role, timestamp and metadata. **Copy JSON** exports it with IP/contact fields redacted.
- **Roles** — switch between *Tier-1 Analyst* and *Compliance Lead* in the header.
  - Tier-1 can approve Low/Medium risk, reject and escalate; **Approve** is disabled on High risk. Escalated records are read-only for Tier-1.
  - Compliance Lead can decide any tier, decide escalated cases and override prior decisions.
- **Security model** — sign-in issues a signed, HTTP-only session cookie; middleware guards `/internal/*`; decisions and SSN reveals are authorized on the server from that session, never from the browser.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it redirects to the sign-in page. Pick an identity (Priya Natarajan → Tier-1, Marcus Ellison → Compliance Lead; both can switch roles) and you land in the queue.

Suggested walkthrough:

1. Press `/`, type `volkov` — the queue filters to one row. Open it.
2. Click **Reveal** on the SSN and watch `PII_UNMASKED` appear in the ledger.
3. Tick checklist items and add a note. A *Pending* record moves to *Under Review*.
4. Open `APP-7F3A21` (High risk) as Tier-1: **Approve** is disabled. Switch to Compliance Lead in the header — it enables.
5. **Reject** a record (choose a reason code, confirm) or **Escalate** one and reopen it as Tier-1 to see it locked.
6. Open the ledger drawer and **Copy JSON**.

State (statuses, notes, ledger) persists across navigation and page reloads, and resets when the dev server restarts.

Checks:

```bash
npm run lint
npm run build
```

## Configuration (optional)

| Variable | Purpose |
| --- | --- |
| `KYC_SESSION_SECRET` | HMAC key for the session cookie. Dev fallback when unset; required in production. |
| `PII_VAULT_KEY` | Key the sandbox vault derives synthetic SSNs from. Same rule. |
| `KYC_SANDBOX_IDP` | The pick-an-identity sign-in is dev-only. Set to `enabled` to allow it on a production build. |

## Layout

```
src/
├── app/internal/sign-in/   sandbox sign-in page + actions
├── app/internal/kyc/       queue, review console, server actions (reveal / review / decide / switch role)
├── components/kyc/         queue and review-console panes
├── components/ui/          primitives (Table, Modal, Drawer, Badge, Select, …)
├── lib/auth/               session cookie, role table + permission checks
├── lib/audit/              audit event logger, sinks, export redaction
├── lib/data/               seed applicants, server-side record store, PII vault
├── lib/state/              client state provider
└── middleware.ts           /internal/* route guard
```
