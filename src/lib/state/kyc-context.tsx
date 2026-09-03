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
import { evaluatePermission, ROLES, RoleContext, type RoleContextValue } from "@/lib/auth/rbac";
import { buildSeedApplications, buildSeedAuditEvents } from "@/lib/data/seed";
import { revealSsn as revealSsnAction, switchRole as switchRoleAction } from "@/app/internal/kyc/actions";
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
  role: UserRole;
  grants: readonly UserRole[];
}

interface KycState {
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
  decide: (id: string, input: DecisionInput) => void;
  /** Minimized ledger export for one application; records `LEDGER_EXPORTED`. */
  exportLedger: (id: string) => string;
}

const KycContext = createContext<KycContextValue | null>(null);

function buildInitialState({ seedAnchor, session }: { seedAnchor: number; session: SessionSnapshot }): KycState {
  const applications = buildSeedApplications(seedAnchor);
  return {
    role: session.role,
    grants: session.grants,
    applications,
    auditEvents: buildSeedAuditEvents(applications),
  };
}

let noteSequence = 2000;

export function KycProvider({
  children,
  seedAnchor,
  session,
}: {
  children: ReactNode;
  seedAnchor: number;
  session: SessionSnapshot;
}) {
  const [state, dispatch] = useReducer(reducer, { seedAnchor, session }, buildInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    return registerAuditSink((event) => dispatch({ type: "APPEND_EVENT", event }));
  }, []);

  const actorFor = useCallback((role: UserRole) => ROLES[role].actor, []);

  const setRole = useCallback(
    async (requested: UserRole, applicationId?: string) => {
      const prev = stateRef.current.role;
      if (prev === requested) return prev;
      const granted = await switchRoleAction(requested);
      if (granted === prev) return prev;
      dispatch({ type: "SET_ROLE", role: granted });
      logAuditEvent("ROLE_SWITCHED", actorFor(granted), granted, {
        applicationId,
        from: prev,
        to: granted,
        previousActor: actorFor(prev),
      });
      return granted;
    },
    [actorFor],
  );

  const getApplication = useCallback(
    (id: string) => stateRef.current.applications.find((a) => a.id === id),
    [],
  );

  const lastViewRef = useRef<{ key: string; at: number } | null>(null);
  const viewRecord = useCallback(
    (id: string) => {
      const { role } = stateRef.current;
      const actor = actorFor(role);
      const key = `${id}:${actor}`;
      const now = Date.now();
      const last = lastViewRef.current;
      if (last && last.key === key && now - last.at < 2_000) return;
      lastViewRef.current = { key, at: now };
      logAuditEvent("VIEWED_RECORD", actor, role, { applicationId: id, surface: "review-console" });
    },
    [actorFor],
  );

  const revealSsn = useCallback(
    async (id: string) => {
      const { role } = stateRef.current;
      const { ssn, disclosedAt } = await revealSsnAction(id);
      logAuditEvent("PII_UNMASKED", actorFor(role), role, {
        applicationId: id,
        field: "ssn",
        justification: "manual-review",
        disclosedAt,
      });
      return ssn;
    },
    [actorFor],
  );

  /**
   * Pending applications move to Under Review the first time an analyst
   * touches them. Returns a pure updater; the transition is logged here so
   * the reducer stays side-effect free.
   */
  const beginReviewIfPending = useCallback(
    (app: Application, actor: string, role: UserRole): ((a: Application) => Application) => {
      if (app.status !== "Pending") return (a) => a;
      logAuditEvent("STATUS_UPDATED", actor, role, {
        applicationId: app.id,
        from: "Pending",
        to: "Under Review",
        trigger: "auto:first-review-action",
      });
      return (a) => ({
        ...a,
        status: "Under Review",
        assignedReviewer: a.assignedReviewer ?? actor,
      });
    },
    [],
  );

  const toggleChecklist = useCallback(
    (id: string, key: ChecklistKey) => {
      const { role } = stateRef.current;
      const actor = actorFor(role);
      const app = getApplication(id);
      if (!app) return false;
      const next = !app.checklist[key];
      if (next && !checklistConstraint(app, key).allowed) return false;
      const start = beginReviewIfPending(app, actor, role);
      dispatch({
        type: "UPDATE_APPLICATION",
        id,
        updater: (a) => {
          const started = start(a);
          return { ...started, checklist: { ...started.checklist, [key]: next } };
        },
      });
      logAuditEvent("CHECKLIST_UPDATED", actor, role, {
        applicationId: id,
        item: key,
        checked: next,
      });
      return true;
    },
    [actorFor, beginReviewIfPending, getApplication],
  );

  const addNote = useCallback(
    (id: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const { role } = stateRef.current;
      const actor = actorFor(role);
      const app = getApplication(id);
      if (!app) return;
      const note: ReviewNote = {
        id: `N-${++noteSequence}`,
        author: actor,
        role,
        body: trimmed,
        createdAt: new Date().toISOString(),
      };
      const start = beginReviewIfPending(app, actor, role);
      dispatch({
        type: "UPDATE_APPLICATION",
        id,
        updater: (a) => {
          const started = start(a);
          return { ...started, notes: [...started.notes, note] };
        },
      });
      logAuditEvent("NOTE_ADDED", actor, role, {
        applicationId: id,
        noteId: note.id,
        length: trimmed.length,
      });
    },
    [actorFor, beginReviewIfPending, getApplication],
  );

  const decide = useCallback(
    (id: string, input: DecisionInput) => {
      const { role } = stateRef.current;
      const actor = actorFor(role);
      const app = getApplication(id);
      if (!app) return;
      const action =
        input.status === "Approved" ? "approve" : input.status === "Rejected" ? "reject" : "escalate";
      const permission = evaluatePermission(role, app, action);
      if (!permission.allowed) return;

      const decidedAt = new Date().toISOString();
      const from = app.status;
      const routedTo = input.status === "Escalated" ? ROLES.COMPLIANCE_LEAD.actor : null;
      const decisionNote: ReviewNote | null = input.note?.trim()
        ? {
            id: `N-${++noteSequence}`,
            author: actor,
            role,
            body: input.note.trim(),
            createdAt: decidedAt,
          }
        : null;
      dispatch({
        type: "UPDATE_APPLICATION",
        id,
        updater: (a) => ({
          ...a,
          status: input.status,
          assignedReviewer: routedTo ?? a.assignedReviewer ?? actor,
          decision: {
            outcome: input.status,
            decidedBy: actor,
            role,
            decidedAt,
            reasonCode: input.reasonCode,
            override: permission.override,
          },
          notes: decisionNote ? [...a.notes, decisionNote] : a.notes,
        }),
      });
      if (decisionNote) {
        logAuditEvent("NOTE_ADDED", actor, role, {
          applicationId: id,
          noteId: decisionNote.id,
          length: decisionNote.body.length,
          context: "decision",
        });
      }
      logAuditEvent("STATUS_UPDATED", actor, role, {
        applicationId: id,
        from,
        to: input.status,
        ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
        ...(permission.override ? { override: true } : {}),
        ...(routedTo ? { reassignedFrom: app.assignedReviewer, reassignedTo: routedTo } : {}),
        riskTier: app.risk.tier,
      });
    },
    [actorFor, getApplication],
  );

  const exportLedger = useCallback(
    (id: string) => {
      const { role, auditEvents } = stateRef.current;
      const events = auditEvents.filter((e) => e.applicationId === id);
      logAuditEvent("LEDGER_EXPORTED", actorFor(role), role, {
        applicationId: id,
        eventCount: events.length,
        destination: "clipboard",
        minimized: true,
      });
      return JSON.stringify(minimizeForExport(events), null, 2);
    },
    [actorFor],
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
      actor: ROLES[state.role].actor,
      setRole,
      grants: state.grants,
      can: (app, action) => evaluatePermission(state.role, app, action),
    }),
    [state.role, state.grants, setRole],
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
      exportLedger,
    }),
    [state.applications, state.auditEvents, metrics, eventsFor, viewRecord, revealSsn, toggleChecklist, addNote, decide, exportLedger],
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
