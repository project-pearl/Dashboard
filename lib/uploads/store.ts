import crypto from 'crypto';
import { DataRecord, UploadBatch, UploadStatus,
         AmendmentReason, AuditEntry } from './types';

// In-memory for now. Replace with persistent store when ready.
let batches: UploadBatch[] = [];
let records: DataRecord[] = [];

export function hashFile(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function createAuditEntry(
  userId: string,
  userRole: string,
  ipAddress: string,
  action: AuditEntry['action'],
  details: Record<string, unknown> = {}
): AuditEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    userId,
    userRole: userRole as any,
    ipAddress,
    action,
    details,
  };
}

export function getActiveRecords(locationId?: string): DataRecord[] {
  return records.filter(r =>
    r.status === 'ACTIVE' &&
    (!locationId || r.locationId === locationId)
  );
}

export function getRecordHistory(recordId: string): DataRecord[] {
  // Walk the version chain
  const chain: DataRecord[] = [];
  let current = records.find(r => r.id === recordId);
  while (current) {
    chain.push(current);
    current = current.previousVersionId
      ? records.find(r => r.id === current!.previousVersionId)
      : undefined;
  }
  return chain.reverse();
}

export function supersedeRecord(
  originalId: string,
  replacementData: Partial<DataRecord>,
  reason: AmendmentReason,
  reasonText: string | undefined,
  userId: string,
  userRole: string,
  ipAddress: string,
): DataRecord {
  const original = records.find(r => r.id === originalId);
  if (!original) throw new Error(`Record ${originalId} not found`);
  if (original.status === 'SUPERSEDED') throw new Error('Cannot amend a superseded record');

  const newRecord: DataRecord = {
    ...original,
    ...replacementData,
    id: crypto.randomUUID(),
    version: original.version + 1,
    status: 'PENDING',
    previousVersionId: original.id,
    provenance: 'MODIFIED',
    createdAt: new Date().toISOString(),
    anomalyFlags: [],
    auditTrail: [
      createAuditEntry(userId, userRole, ipAddress, 'AMEND', {
        originalId,
        originalValue: original.value,
        newValue: replacementData.value,
        reason,
        reasonText,
      }),
    ],
  };

  // Mark original as superseded
  original.status = 'SUPERSEDED';
  original.supersededAt = new Date().toISOString();
  original.supersededBy = newRecord.id;
  original.supersededReason = reason;
  original.supersededReasonText = reasonText;
  original.auditTrail.push(
    createAuditEntry(userId, userRole, ipAddress, 'AMEND', {
      supersededBy: newRecord.id,
      reason,
    })
  );

  records.push(newRecord);
  return newRecord;
}

export function getAllRecordsForAudit(locationId?: string): DataRecord[] {
  // Returns ALL records including SUPERSEDED — for Auditor role
  return records.filter(r => !locationId || r.locationId === locationId);
}
