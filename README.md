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
│   ├── auth/rbac.ts          Role definitions + evaluatePermission() + useRole() hook
│   ├── audit/logger.ts       logAuditEvent(action, actor, role, metadata) → immutable event → sinks
│   ├── state/kyc-context.tsx <KycProvider> — session state that survives client navigation
│   └── data/seed.ts          12 realistic applicants (risk tiers, flags, statuses, notes, decisions)
├── components/
│   ├── ui/                   Primitives: Table, Modal, Drawer, Badge, Button, Input, Select, Tooltip, Kbd
│   └── kyc/                  Feature panes: queue, applicant, document, decisioning, audit drawer
└── app/internal/kyc/         Route layer (layout wraps everything in <KycProvider>)
```

| Layer | Responsibility | Why it matters |
| --- | --- | --- |
| **Auth / RBAC** (`lib/auth/rbac.ts`) | Declarative role table (`approvableTiers`, `canOverrideDecision`, `canDecideEscalated`) and a single `evaluatePermission(role, app, action)` that returns `{ allowed, reason, override }`. The UI never hard-codes rules; it renders the permission result (disabled state + tooltip text). | Policy lives in one typed file that compliance can read and review. Switching role in the header re-evaluates every control instantly. |
| **Audit Sink** (`lib/audit/logger.ts`) | `logAuditEvent()` produces a frozen, sequenced `AuditEvent` and fans it out to registered sinks. The in-memory sink powers the ledger drawer; a Kafka/HTTP sink can be registered alongside with no UI change. Events emitted before a sink attaches are buffered, so nothing is dropped. | Every material action — `VIEWED_RECORD`, `PII_UNMASKED`, `CHECKLIST_UPDATED`, `NOTE_ADDED`, `STATUS_UPDATED`, `ROLE_SWITCHED` — is recorded with actor, role, timestamp and structured metadata. |
| **State Provider** (`lib/state/kyc-context.tsx`) | Reducer-backed context wrapping `/internal/kyc`. Status transitions, checklist state, notes and the audit stream persist across queue ⇄ detail navigation within the session. Pending records auto-move to *Under Review* and are assigned to the acting analyst on the first review action. | Deterministic, testable state transitions instead of a low-code canvas full of hidden formulas. |
| **Data Grid + UI primitives** (`components/ui/*`) | Dense 32–36px rows, 1px `zinc-200/800` borders, 12–14px type, `font-mono` for IDs / timestamps / SSNs / IPs, functional status dots, keyboard affordances (`/` search, `Esc` dismiss, `[` `]` prev/next). | Operator throughput. The visual language is Linear / Stripe / Ramp, not consumer SaaS. |

## 2. Why this beats low-code for fintech compliance

| Compliance requirement | Low-code platform | This chassis |
| --- | --- | --- |
| **PII minimisation** | Fields are either visible or hidden; reveal is not an auditable act. | Only `ssnLast4` is shipped to the browser (`•••-••-4819`); the full value lives in a `server-only` vault and is disclosed through the `revealSsn` server action, which the client pairs with a `PII_UNMASKED { field: "ssn" }` audit event. |
| **Four-eyes / tiered approval** | Role logic scattered across per-control visibility formulas. | One `ROLES` table + `evaluatePermission()`. Tier-1 cannot approve *High* risk (button disabled, tooltip explains why); Compliance Lead can decide escalated cases and override prior decisions — with the override recorded. |
| **Immutable audit trail** | Connector-dependent logging, often best-effort. | Frozen event objects, monotonic IDs, structured metadata JSON, chronological ledger scoped per record and exportable (Copy JSON). |
| **Structured decisions** | Free-text reason fields. | Rejection requires an enumerated reason code (`EXPIRED_DOCUMENT`, `UNREADABLE_SCAN`, `SUSPECTED_FRAUD`, `SANCTIONS_LIST`) behind a confirmation modal. |
| **Change control** | Opaque app definitions, no diffs, no CI. | Plain TypeScript in Git: reviewable PRs, type-checking, lint, `next build` as a release gate. |
| **Throughput** | Generic, spacious controls; every click round-trips to a connector. | Instant client-side search/filter/sort, keyboard navigation, three-pane review with no page reloads. |

## 3. Run and verify locally

Requirements: Node 20+.

```bash
npm install
npm run dev        # http://localhost:3000  → redirects to /internal/kyc
```

Verification walkthrough (all state is in-memory; refresh resets to seed data):

1. **Queue** — press `/`, type `volkov`; the table filters across name, email and App ID. Use the *Risk* / *Status* selects and column sort on *Risk* / *Submitted* / *Status*.
2. **Navigate** — click any row (or focus a row and press `Enter`) to open the review console. Note the `VIEWED_RECORD` event in the bottom *Compliance Audit Ledger*.
3. **PII reveal** — click *Reveal* next to *Tax ID / SSN*. The full SSN appears and a `PII_UNMASKED { field: "ssn" }` event is written immediately.
4. **Checklist** — toggle the three verification items; each writes `CHECKLIST_UPDATED`. A *Pending* record moves to *Under Review* and is assigned to you.
5. **RBAC** — on a *High* risk record (e.g. `APP-7F3A21`) as *Tier-1 Analyst*, *Approve* is disabled with the tooltip *"High Risk applications require Compliance Lead approval."* Switch the header role to *Compliance Lead (Admin)*: the button enables without a reload, and `ROLE_SWITCHED` is logged.
6. **Decisions** — *Reject* requires a reason code, then a confirmation step; *Approve* and *Escalate* confirm before committing. Each writes `STATUS_UPDATED` with `from`/`to` (and `reasonCode`). Return to the queue with `Esc` or *← Back to Queue*; the new status, metrics and reviewer persist.

Release gates:

```bash
npm run lint       # ESLint (next/core-web-vitals + typescript)
npm run build      # type-check + production build; must complete with zero errors
```

## 4. Notes

- No external media: passports and driver licences are rendered from SVG/CSS (portrait placeholder, signature, barcode, MRZ) using the applicant's data.
- Seed timestamps are anchored to the server render time and passed to the client, so hydration is deterministic while "38m ago"-style relative times stay realistic.
- Light and dark themes are supported (toggle in the header, persisted to `localStorage`).
