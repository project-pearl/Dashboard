// Upload record status lifecycle: PENDING → ACTIVE → SUPERSEDED
// No record ever reaches DELETED.

export type UploadStatus = 'PENDING' | 'ACTIVE' | 'FLAGGED' | 'SUPERSEDED';

export type IntakeMethod = 'DIRECT_UPLOAD' | 'EMAIL_INTAKE' | 'API_PUSH' | 'MANUAL_ENTRY';

export type ProvenanceBadge =
  | 'FEDERAL_AUTHORITATIVE'
  | 'STATE_AUTHORITATIVE'
  | 'LAB_VERIFIED'
  | 'FIELD_CERTIFIED'
  | 'SELF_REPORTED'
  | 'RESEARCH_SUBMITTED'
  | 'CITIZEN_SCIENCE'
  | 'EDUCATIONAL'
  | 'MODIFIED'
  | 'FLAGGED';

export type AmendmentReason =
  | 'LAB_CORRECTION'
  | 'DATA_ENTRY_ERROR'
  | 'INSTRUMENT_MALFUNCTION'
  | 'WRONG_LOCATION'
  | 'DUPLICATE_SUBMISSION'
  | 'ERRONEOUS_UPLOAD'
  | 'OTHER';

export type UserRole =
  | 'PROGRAM_MANAGER'
  | 'DATA_STEWARD'
  | 'FIELD_INSPECTOR'
  | 'VIEWER'
  | 'AUDITOR';

export interface AuditEntry {
  id: string;
  timestamp: string;          // ISO 8601, server-side UTC
  userId: string;
  userRole: UserRole;
  ipAddress: string;
  action: 'UPLOAD' | 'APPROVE' | 'AMEND' | 'FLAG' | 'ACKNOWLEDGE_FLAG';
  details: Record<string, unknown>;
}

export interface DataRecord {
  id: string;
  version: number;            // v1, v2, v3...
  status: UploadStatus;

  // What
  parameter: string;          // e.g. 'E_COLI', 'PH', 'DO'
  value: number;
  unit: string;
  sampleDate: string;
  locationId: string;         // ATTAINS assessment unit ID
  locationName: string;

  // Who
  uploadedBy: string;         // userId
  uploadedByRole: UserRole;
  approvedBy?: string;
  approvedAt?: string;

  // How
  intakeMethod: IntakeMethod;
  provenance: ProvenanceBadge;

  // Source
  originalFileHash: string;   // SHA-256
  originalFileName: string;
  originalFileSize: number;
  sourceLabName?: string;
  sourceLabAccreditation?: string;  // NELAC ID if applicable

  // Integrity
  createdAt: string;
  supersededAt?: string;
  supersededBy?: string;      // ID of replacement record
  supersededReason?: AmendmentReason;
  supersededReasonText?: string;
  previousVersionId?: string; // ID of record this replaced
  supportingDocHash?: string;
  supportingDocName?: string;

  // Anomaly detection
  anomalyFlags: AnomalyFlag[];

  // Audit
  auditTrail: AuditEntry[];
}

export interface AnomalyFlag {
  type: 'OUT_OF_RANGE' | 'STATISTICAL_OUTLIER' | 'CROSS_PARAMETER' | 'TEMPORAL';
  message: string;
  severity: 'WARNING' | 'CRITICAL';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  acknowledgedReason?: string;
}

export interface UploadBatch {
  id: string;
  uploadedBy: string;
  uploadedByRole: UserRole;
  intakeMethod: IntakeMethod;
  originalFileHash: string;
  originalFileName: string;
  originalFileSize: number;
  parsedRecordCount: number;
  status: 'PARSING' | 'REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  records: DataRecord[];
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}
