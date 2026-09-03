# KYC Review Console — Internal Tools Chassis

A production-grade, high-density KYC review console for compliance operations, built on Next.js 15 (App Router), TypeScript and Tailwind CSS. It is the canonical proof of concept for replacing low-code platforms (Power Apps, Retool-style builders) with a custom React stack that is owned, typed, auditable and reusable.

- Queue: `/internal/kyc` (root `/` redirects here)
- Review console: `/internal/kyc/[id]`

## 1. System architecture — the "Chassis" pattern

The KYC tool is a thin feature layer on top of a reusable chassis. Any future internal tool (fraud disputes, chargebacks, vendor onboarding) inherits the same four layers and only supplies its own domain types, seed/data adapter and panes.

```
src/
├── lib/
│   ├── types.ts              Domain contracts: Application, Applicant, RiskScore, AuditEvent, UserRole …
│   ├── auth/roles.ts         Role table + evaluatePermission() (React-free, importable from server code)
│   ├── auth/rbac.ts          useRole() hook / RoleContext for client components
│   ├── auth/session-token.ts Signed (HMAC-SHA256) session claims — shared by middleware and server actions
│   ├── auth/session.ts       server-only: cookie issue/verify + sandbox identity provider
│   ├── audit/logger.ts       logAuditEvent(action, actor, role, metadata) → deep-frozen event → sinks
│   ├── audit/export.ts       Data-minimised ledger export (PII keys redacted at any depth, listed as `redactedFields`)
│   ├── data/record-store.ts  Server-authoritative disposition store (status / assignee / decision); in-memory here
│   ├── checklist.ts          Checklist invariants (e.g. expired document cannot be marked valid)
│   ├── state/kyc-context.tsx <KycProvider> — session state that survives client navigation
│   ├── data/seed.ts          12 realistic applicants (risk tiers, flags, statuses, notes, decisions)
│   └── data/pii-vault.ts     server-only: full tax IDs derived from PII_VAULT_KEY — never in source or client
├── middleware.ts             Route guard: /internal/* requires a valid session cookie
├── components/
│   ├── ui/                   Primitives: Table, Modal, Drawer, Badge, Button, Input, Select, Tooltip, Kbd
│   └── kyc/                  Feature panes: queue, applicant, document, decisioning, audit drawer
└── app/internal/
    ├── sign-in/              Sandbox IdP page + signIn/signOut server actions
    └── kyc/                  Route layer (layout reads the session and wraps everything in <KycProvider>)
```

| Layer | Responsibility | Why it matters |
| --- | --- | --- |
| **Auth / Session** (`middleware.ts`, `lib/auth/session*.ts`) | `/internal/*` is gated by Edge middleware that verifies an HTTP-only, HMAC-signed session cookie (`KYC_SESSION_SECRET`). The cookie carries `sub`, the active `role` and the operator's `grants`. Server actions (`revealSsn`, `commitDecision`, `switchRole`) re-verify the cookie and never trust a role sent by the browser; the header switcher only offers granted roles and the server re-issues the cookie on change. | The browser cannot self-assign Compliance Lead. The sandbox IdP (`/internal/sign-in`) is the seam where SSO group claims plug in. |
| **RBAC** (`lib/auth/roles.ts`, `lib/auth/rbac.ts`) | Declarative role table (`approvableTiers`, `canOverrideDecision`, `canDecideEscalated`) and a single `evaluatePermission(role, app, action)` that returns `{ allowed, reason, override }`. The UI never hard-codes rules; it renders the permission result (disabled state + tooltip text). | Policy lives in one typed file that compliance can read and review. Switching role in the header re-evaluates every control instantly. |
| **Audit Sink** (`lib/audit/logger.ts`) | `logAuditEvent()` produces a deep-frozen, sequenced `AuditEvent` and fans it out to registered sinks. The in-memory sink powers the ledger drawer; a Kafka/HTTP sink can be registered alongside with no UI change. Events emitted before a sink attaches are buffered, so nothing is dropped. | Every material action — `VIEWED_RECORD`, `PII_UNMASKED`, `CHECKLIST_UPDATED`, `NOTE_ADDED`, `STATUS_UPDATED`, `ROLE_SWITCHED`, `LEDGER_EXPORTED` — is recorded with actor, role, timestamp and structured metadata. |
| **State Provider** (`lib/state/kyc-context.tsx`) | Reducer-backed context wrapping `/internal/kyc`. Status transitions, checklist state, notes and the audit stream persist across queue ⇄ detail navigation within the session. Pending records auto-move to *Under Review* and are assigned to the acting analyst on the first review action (committed and audited server-side via `beginReview`; the local copy updates from the returned record). | Deterministic, testable state transitions instead of a low-code canvas full of hidden formulas. |
| **Data Grid + UI primitives** (`components/ui/*`) | Dense 32–36px rows, 1px `zinc-200/800` borders, 12–14px type, `font-mono` for IDs / timestamps / SSNs / IPs, functional status dots, keyboard affordances (`/` search, `Esc` dismiss, `[` `]` prev/next). | Operator throughput. The visual language is Linear / Stripe / Ramp, not consumer SaaS. |

## 2. Why this beats low-code for fintech compliance

| Compliance requirement | Low-code platform | This chassis |
| --- | --- | --- |
| **PII minimisation** | Fields are either visible or hidden; reveal is not an auditable act. | Only `ssnLast4` is shipped to the browser (`•••-••-4819`); the full value is produced by a `server-only` vault (no identifiers in source — the sandbox derives them from `PII_VAULT_KEY`) and disclosed through the `revealSsn` server action, which checks the role's disclosure policy against the record's server-side status (a Tier-1 analyst cannot unmask an escalated or finalized record) and records `PII_UNMASKED { field: "ssn" }` on the server (actor and role taken from the signed session) *before* the value is returned. |
| **Four-eyes / tiered approval** | Role logic scattered across per-control visibility formulas. | One `ROLES` table + `evaluatePermission()`. Tier-1 cannot approve *High* risk (button disabled, tooltip explains why); Compliance Lead can decide escalated cases and override prior decisions — with the override recorded. Decisions are authorized *and committed* by the `commitDecision` server action against the session's role and the record's server-side status and risk tier (`lib/data/record-store.ts`) — the browser supplies neither actor, role nor current status, and `STATUS_UPDATED` is emitted only after the record is committed. The client applies the committed record it receives. *Escalate* reassigns the record to the Compliance Lead queue (`reassignedTo` in the event); the lead who decides it claims the assignment. |
| **Immutable audit trail** | Connector-dependent logging, often best-effort. | Deep-frozen event objects, monotonic IDs, structured metadata JSON, chronological ledger scoped per record. *Copy JSON* exports a data-minimised view (IP / contact keys redacted and listed) and is logged as `LEDGER_EXPORTED` only once the clipboard write succeeds. The audit actor is always the signed-in operator; the active role is recorded as separate metadata, so switching role never changes who is on record. Server-emitted events are retained in a server-side audit log (`lib/audit/server-sink.ts`, also streamed to stdout as JSON lines) and re-hydrate the client ledger on every page load, so a refreshed ledger shows the transitions that actually happened rather than a reconstruction. |
| **Evidence integrity** | Checkbox state is whatever the operator clicked. | Checklist invariants live in `lib/checklist.ts` and are enforced by the state layer: an expired document can never be marked *Expiration date valid* (control disabled with the expiry date; the reducer refuses the toggle regardless). |
| **Structured decisions** | Free-text reason fields. | Rejection requires an enumerated reason code (`EXPIRED_DOCUMENT`, `UNREADABLE_SCAN`, `SUSPECTED_FRAUD`, `SANCTIONS_LIST`) behind a confirmation modal. |
| **Change control** | Opaque app definitions, no diffs, no CI. | Plain TypeScript in Git: reviewable PRs, type-checking, lint, `next build` as a release gate. |
| **Throughput** | Generic, spacious controls; every click round-trips to a connector. | Instant client-side search/filter/sort, keyboard navigation, three-pane review with no page reloads. |

## 3. Run and verify locally

Requirements: Node 20+.

```bash
npm install
npm run dev        # http://localhost:3000  → /internal/kyc → /internal/sign-in until a session exists
```

Environment (optional in development, required in production):

| Variable | Purpose |
| --- | --- |
| `KYC_SESSION_SECRET` | HMAC key for the session cookie. A fixed dev key is used when unset outside production. |
| `PII_VAULT_KEY` | Key the sandbox vault derives synthetic tax IDs from. Same dev fallback rule. |

Verification walkthrough (all state is in-memory; refresh resets to seed data):

0. **Sign in** — pick a sandbox identity (Priya Natarajan → Tier-1, Marcus Ellison → Compliance Lead). Both sandbox identities are granted both roles so the RBAC switcher can be demonstrated; a forged or expired `kyc_session` cookie is rejected by the middleware.
1. **Queue** — press `/`, type `volkov`; the table filters across name, email and App ID. Use the *Risk* / *Status* selects and column sort on *Risk* / *Submitted* / *Status*.
2. **Navigate** — click any row (or focus a row and press `Enter`) to open the review console. Note the `VIEWED_RECORD` event in the bottom *Compliance Audit Ledger*.
3. **PII reveal** — click *Reveal* next to *Tax ID / SSN*. The server records `PII_UNMASKED { field: "ssn" }`, then the full SSN appears and the event lands in the ledger.
4. **Checklist** — toggle the three verification items; each writes `CHECKLIST_UPDATED`. A *Pending* record moves to *Under Review* and is assigned to you. On a record with an expired document, *Expiration date valid* is disabled and shows the expiry date.
5. **RBAC** — on a *High* risk record (e.g. `APP-7F3A21`) as *Tier-1 Analyst*, *Approve* is disabled with the tooltip *"High Risk applications require Compliance Lead approval."* Switch the header role to *Compliance Lead (Admin)*: the server re-issues the session, the button enables without a reload, and `ROLE_SWITCHED` is logged.
6. **Decisions** — *Reject* requires a reason code, then a confirmation step; *Approve* and *Escalate* confirm before committing. Each writes `STATUS_UPDATED` with `from`/`to` (and `reasonCode`). *Escalate* reassigns the record to the *Compliance Lead queue*; a Tier-1 analyst then sees it read-only. Decisions are authorized and committed server-side (`commitDecision`) — a denied request surfaces inline in the modal, and the confirm button is disabled while authorization is in flight. Return to the queue with `Esc` or *← Back to Queue*; the new status, metrics and reviewer persist.
7. **Export** — open the ledger drawer and *Copy JSON*: IP addresses are `[redacted]`, each event lists `redactedFields`, and a `LEDGER_EXPORTED` event is appended after the copy succeeds.

Release gates:

```bash
npm run lint       # ESLint (next/core-web-vitals + typescript)
npm run build      # type-check + production build; must complete with zero errors
```

## 4. Notes

- No external media: passports and driver licences are rendered from SVG/CSS (portrait placeholder, signature, barcode, MRZ) using the applicant's data.
- Seed timestamps are anchored to the server render time and passed to the client, so hydration is deterministic while "38m ago"-style relative times stay realistic.
- Light and dark themes are supported (toggle in the header, persisted to `localStorage`).
