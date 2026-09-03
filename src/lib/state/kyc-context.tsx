"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { logAuditEvent, registerAuditSink } from "@/lib/audit/logger";
import { evaluatePermission, isRecordLocked, ROLES, RoleContext, type RoleContextValue } from "@/lib/auth/rbac";
import { buildSeedApplications, buildSeedAuditEvents } from "@/lib/data/seed";
import {
  beginReview as beginReviewAction,
  commitDecision as commitDecisionAction,
  revealSsn as revealSsnAction,
  switchRole as switchRoleAction,
} from "@/app/internal/kyc/actions";
import { applySnapshots, type RecordSnapshot } from "@/lib/data/records";
import { checklistConstraint } from "@/lib/checklist";
import { minimizeForExport } from "@/lib/audit/export";
import type {
  Application,
  ApplicationStatus,
  AuditEvent,
  ChecklistKey,
  RejectionReasonCode,
  ReviewNote,
  UserRole,
} from "@/lib/types";

export interface SessionSnapshot {
  /** Display name of the signed-in operator; recorded as the actor on every event. */
  operator: string;
  role: UserRole;
  grants: readonly UserRole[];
}

interface KycState {
  operator: string;
  role: UserRole;
  grants: readonly UserRole[];
  applications: Application[];
  auditEvents: AuditEvent[];
}

type KycReducerAction =
  | { type: "SET_ROLE"; role: UserRole }
  | { type: "APPEND_EVENT"; event: AuditEvent }
  | { type: "UPDATE_APPLICATION"; id: string; updater: (app: Application) => Application };

function reducer(state: KycState, action: KycReducerAction): KycState {
  switch (action.type) {
    case "SET_ROLE":
      return { ...state, role: action.role };
    case "APPEND_EVENT":
      if (state.auditEvents.some((e) => e.id === action.event.id)) return state;
      return { ...state, auditEvents: [...state.auditEvents, action.event] };
    case "UPDATE_APPLICATION":
      return {
        ...state,
        applications: state.applications.map((app) =>
          app.id === action.id ? action.updater(app) : app,
        ),
      };
  }
}

export interface QueueMetrics {
  totalPending: number;
  requiresAction: number;
  highRisk: number;
  escalated: number;
}

export interface DecisionInput {
  status: Extract<ApplicationStatus, "Approved" | "Rejected" | "Escalated">;
  reasonCode?: RejectionReasonCode;
  note?: string;
}

interface KycContextValue {
  applications: Application[];
  auditEvents: AuditEvent[];
  metrics: QueueMetrics;
  getApplication: (id: string) => Application | undefined;
  eventsFor: (id: string) => AuditEvent[];
  viewRecord: (id: string) => void;
  /** Fetches the full SSN from the server and records `PII_UNMASKED`. */
  revealSsn: (id: string) => Promise<string>;
  /** Returns false when the item cannot be checked (e.g. expired document). */
  toggleChecklist: (id: string, key: ChecklistKey) => boolean;
  addNote: (id: string, body: string) => void;
  /** Authorizes the decision on the server, then commits it; resolves false when not permitted. */
  decide: (id: string, input: DecisionInput) => Promise<boolean>;
  /** Data-minimized ledger for one application, ready for export. */
  serializeLedger: (id: string) => { json: string; eventCount: number };
  /** Records `LEDGER_EXPORTED`; call only once the export has actually been delivered. */
  recordLedgerExport: (id: string, eventCount: number) => void;
}

const KycContext = createContext<KycContextValue | null>(null);

function buildInitialState({
  seedAnchor,
  records,
  events,
  session,
}: {
  seedAnchor: number;
  records: readonly RecordSnapshot[];
  events: readonly AuditEvent[];
  session: SessionSnapshot;
}): KycState {
  const seeded = buildSeedApplications(seedAnchor);
  return {
    operator: session.operator,
    role: session.role,
    grants: session.grants,
    applications: applySnapshots(seeded, records),
    auditEvents: [...buildSeedAuditEvents(seeded), ...events],
  };
}

let noteSequence = 2000;

export function KycProvider({
  children,
  seedAnchor,
  records,
  events,
  session,
}: {
  children: ReactNode;
  seedAnchor: number;
  /** Dispositions committed on the server since seeding. */
  records: readonly RecordSnapshot[];
  /** Audit events recorded on the server since seeding. */
  events: readonly AuditEvent[];
  session: SessionSnapshot;
}) {
  const [state, dispatch] = useReducer(reducer, { seedAnchor, records, events, session }, buildInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    return registerAuditSink((event) => dispatch({ type: "APPEND_EVENT", event }));
  }, []);

  const operator = state.operator;

  const setRole = useCallback(
    async (requested: UserRole, applicationId?: string) => {
      const prev = stateRef.current.role;
      if (prev === requested) return prev;
      const granted = await switchRoleAction(requested);
      if (granted === prev) return prev;
      dispatch({ type: "SET_ROLE", role: granted });
      logAuditEvent("ROLE_SWITCHED", operator, granted, {
        applicationId,
        from: prev,
        to: granted,
      });
      return granted;
    },
    [operator],
  );

  const getApplication = useCallback(
    (id: string) => stateRef.current.applications.find((a) => a.id === id),
    [],
  );

  const lastViewRef = useRef<{ key: string; at: number } | null>(null);
  const viewRecord = useCallback(
    (id: string) => {
      const { role } = stateRef.current;
      const key = `${id}:${role}`;
      const now = Date.now();
      const last = lastViewRef.current;
      if (last && last.key === key && now - last.at < 2_000) return;
      lastViewRef.current = { key, at: now };
      logAuditEvent("VIEWED_RECORD", operator, role, { applicationId: id, surface: "review-console" });
    },
    [operator],
  );

  const revealSsn = useCallback(async (id: string) => {
    const { ssn, event } = await revealSsnAction(id);
    dispatch({ type: "APPEND_EVENT", event });
    return ssn;
  }, []);

  /**
   * Pending applications move to Under Review the first time an analyst
   * touches them. The transition is committed and audited on the server; the
   * local copy is updated only from the committed record it returns.
   */
  const ensureReviewStarted = useCallback((app: Application) => {
    if (app.status !== "Pending") return;
    void beginReviewAction(app.id)
      .then(({ record, event }) => {
        if (event) dispatch({ type: "APPEND_EVENT", event });
        dispatch({
          type: "UPDATE_APPLICATION",
          id: record.id,
          updater: (a) => ({ ...a, status: record.status, assignedReviewer: record.assignedReviewer }),
        });
      })
      .catch(() => undefined);
  }, []);

  const toggleChecklist = useCallback(
    (id: string, key: ChecklistKey) => {
      const { role } = stateRef.current;
      const actor = operator;
      const app = getApplication(id);
      if (!app || isRecordLocked(role, app)) return false;
      const next = !app.checklist[key];
      if (next && !checklistConstraint(app, key).allowed) return false;
      ensureReviewStarted(app);
      dispatch({
        type: "UPDATE_APPLICATION",
        id,
        updater: (a) => ({ ...a, checklist: { ...a.checklist, [key]: next } }),
      });
      logAuditEvent("CHECKLIST_UPDATED", actor, role, {
        applicationId: id,
        item: key,
        checked: next,
      });
      return true;
    },
    [operator, ensureReviewStarted, getApplication],
  );

  const addNote = useCallback(
    (id: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const { role } = stateRef.current;
      const actor = operator;
      const app = getApplication(id);
      if (!app) return;
      const note: ReviewNote = {
        id: `N-${++noteSequence}`,
        author: actor,
        role,
        body: trimmed,
        createdAt: new Date().toISOString(),
      };
      ensureReviewStarted(app);
      dispatch({
        type: "UPDATE_APPLICATION",
        id,
        updater: (a) => ({ ...a, notes: [...a.notes, note] }),
      });
      logAuditEvent("NOTE_ADDED", actor, role, {
        applicationId: id,
        noteId: note.id,
        length: trimmed.length,
      });
    },
    [operator, ensureReviewStarted, getApplication],
  );

  const decide = useCallback(
    async (id: string, input: DecisionInput) => {
      const { role } = stateRef.current;
      const app = getApplication(id);
      if (!app) return false;
      const action =
        input.status === "Approved" ? "approve" : input.status === "Rejected" ? "reject" : "escalate";
      if (!evaluatePermission(role, app, action).allowed) return false;

      const { record, event } = await commitDecisionAction({
        applicationId: id,
        status: input.status,
        reasonCode: input.reasonCode,
      });
      dispatch({ type: "APPEND_EVENT", event });
      const decision = record.decision;
      const decisionNote: ReviewNote | null =
        decision && input.note?.trim()
          ? {
              id: `N-${++noteSequence}`,
              author: decision.decidedBy,
              role: decision.role,
              body: input.note.trim(),
              createdAt: new Date().toISOString(),
            }
          : null;
      dispatch({
        type: "UPDATE_APPLICATION",
        id,
        updater: (a) => ({
          ...a,
          status: record.status,
          assignedReviewer: record.assignedReviewer,
          decision: record.decision,
          notes: decisionNote ? [...a.notes, decisionNote] : a.notes,
        }),
      });
      if (decisionNote) {
        logAuditEvent("NOTE_ADDED", decisionNote.author, decisionNote.role, {
          applicationId: id,
          noteId: decisionNote.id,
          length: decisionNote.body.length,
          context: "decision",
        });
      }
      return true;
    },
    [getApplication],
  );

  const serializeLedger = useCallback((id: string) => {
    const events = stateRef.current.auditEvents.filter((e) => e.applicationId === id);
    return { json: JSON.stringify(minimizeForExport(events), null, 2), eventCount: events.length };
  }, []);

  const recordLedgerExport = useCallback(
    (id: string, eventCount: number) => {
      const { role } = stateRef.current;
      logAuditEvent("LEDGER_EXPORTED", operator, role, {
        applicationId: id,
        eventCount,
        destination: "clipboard",
        minimized: true,
      });
    },
    [operator],
  );

  const metrics = useMemo<QueueMetrics>(() => {
    const apps = state.applications;
    return {
      totalPending: apps.filter((a) => a.status === "Pending" || a.status === "Under Review").length,
      requiresAction: apps.filter(
        (a) =>
          (a.status === "Pending" || a.status === "Under Review") &&
          (a.assignedReviewer === null || a.risk.primaryFlag !== "Clean"),
      ).length,
      highRisk: apps.filter(
        (a) => a.risk.tier === "High" && a.status !== "Approved" && a.status !== "Rejected",
      ).length,
      escalated: apps.filter((a) => a.status === "Escalated").length,
    };
  }, [state.applications]);

  const eventsFor = useCallback(
    (id: string) => state.auditEvents.filter((e) => e.applicationId === id),
    [state.auditEvents],
  );

  const roleValue = useMemo<RoleContextValue>(
    () => ({
      role: state.role,
      definition: ROLES[state.role],
      actor: state.operator,
      setRole,
      grants: state.grants,
      can: (app, action) => evaluatePermission(state.role, app, action),
    }),
    [state.role, state.grants, state.operator, setRole],
  );

  const value = useMemo<KycContextValue>(
    () => ({
      applications: state.applications,
      auditEvents: state.auditEvents,
      metrics,
      getApplication: (id) => state.applications.find((a) => a.id === id),
      eventsFor,
      viewRecord,
      revealSsn,
      toggleChecklist,
      addNote,
      decide,
      serializeLedger,
      recordLedgerExport,
    }),
    [
      state.applications,
      state.auditEvents,
      metrics,
      eventsFor,
      viewRecord,
      revealSsn,
      toggleChecklist,
      addNote,
      decide,
      serializeLedger,
      recordLedgerExport,
    ],
  );

  return (
    <RoleContext.Provider value={roleValue}>
      <KycContext.Provider value={value}>{children}</KycContext.Provider>
    </RoleContext.Provider>
  );
}

export function useKyc(): KycContextValue {
  const ctx = useContext(KycContext);
  if (!ctx) throw new Error("useKyc must be used within <KycProvider>");
  return ctx;
}
