export type UserRole = "TIER1_ANALYST" | "COMPLIANCE_LEAD";

export type RiskTier = "Low" | "Medium" | "High";

export type ApplicationStatus =
  | "Pending"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Escalated";

export type PrimaryFlag =
  | "Clean"
  | "Address Mismatch"
  | "Name Mismatch"
  | "PEP Hit"
  | "Sanctions Match"
  | "Document Expired"
  | "Velocity Anomaly"
  | "Synthetic ID Suspected"
  | "High-Risk Jurisdiction"
  | "Income Inconsistency";

export type RejectionReasonCode =
  | "EXPIRED_DOCUMENT"
  | "UNREADABLE_SCAN"
  | "SUSPECTED_FRAUD"
  | "SANCTIONS_LIST";

export type AuditAction =
  | "APPLICATION_SUBMITTED"
  | "RISK_SCORED"
  | "VIEWED_RECORD"
  | "PII_UNMASKED"
  | "CHECKLIST_UPDATED"
  | "NOTE_ADDED"
  | "STATUS_UPDATED"
  | "ROLE_SWITCHED";

export type DocumentType = "PASSPORT" | "DRIVERS_LICENSE";

export type AcquisitionChannel = "Web" | "iOS" | "Android";

export interface PostalAddress {
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
}

export interface ScreeningResult {
  pep: boolean;
  sanctions: boolean;
  adverseMedia: boolean;
  matchedList?: string;
  screenedAt: string;
}

export interface Applicant {
  legalName: string;
  sex: "M" | "F";
  email: string;
  phone: string;
  dateOfBirth: string;
  address: PostalAddress;
  country: string;
  nationality: string;
  statedIncomeUsd: number;
  occupation: string;
  /** Only the last four digits are ever sent to the client; see `pii-vault.ts`. */
  ssnLast4: string;
  ipAddress: string;
  screening: ScreeningResult;
}

export interface RiskScore {
  score: number;
  tier: RiskTier;
  primaryFlag: PrimaryFlag;
  factors: string[];
  modelVersion: string;
}

export interface OcrExtraction {
  fullName: string;
  dateOfBirth: string;
  documentNumber: string;
  expiresOn: string;
  addressLine?: string;
  confidence: number;
}

export interface IdentityDocument {
  type: DocumentType;
  documentNumber: string;
  issuingCountry: string;
  issuingAuthority: string;
  issuedOn: string;
  expiresOn: string;
  ocr: OcrExtraction;
}

export interface VerificationChecklist {
  tamperCheckPassed: boolean;
  facialMatchVerified: boolean;
  expirationValid: boolean;
}

export type ChecklistKey = keyof VerificationChecklist;

export interface ReviewNote {
  id: string;
  author: string;
  role: UserRole | "SYSTEM";
  body: string;
  createdAt: string;
}

export interface Decision {
  outcome: Extract<ApplicationStatus, "Approved" | "Rejected" | "Escalated">;
  decidedBy: string;
  role: UserRole;
  decidedAt: string;
  reasonCode?: RejectionReasonCode;
  override?: boolean;
}

export interface Application {
  id: string;
  product: string;
  channel: AcquisitionChannel;
  applicant: Applicant;
  risk: RiskScore;
  document: IdentityDocument;
  status: ApplicationStatus;
  submittedAt: string;
  assignedReviewer: string | null;
  checklist: VerificationChecklist;
  notes: ReviewNote[];
  decision?: Decision;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  role: UserRole | "SYSTEM";
  action: AuditAction;
  applicationId?: string;
  metadata: Record<string, unknown>;
}
