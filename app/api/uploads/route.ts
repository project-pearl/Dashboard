import { NextRequest, NextResponse } from 'next/server';
import { hashFile, createAuditEntry } from '@/lib/uploads/store';
import { IntakeMethod, ProvenanceBadge } from '@/lib/uploads/types';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const userRole = formData.get('userRole') as string;
    const provenance = (formData.get('provenance') || 'SELF_REPORTED') as ProvenanceBadge;

    if (!file || !userId || !userRole) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Role check: only PROGRAM_MANAGER, DATA_STEWARD, FIELD_INSPECTOR can upload
    const uploadRoles = ['PROGRAM_MANAGER', 'DATA_STEWARD', 'FIELD_INSPECTOR'];
    if (!uploadRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = hashFile(buffer);
    const ip = req.headers.get('x-forwarded-for') || 'unknown';

    const auditEntry = createAuditEntry(userId, userRole, ip, 'UPLOAD', {
      fileName: file.name,
      fileSize: file.size,
      fileHash,
      provenance,
    });

    // TODO: Parse file (CSV/XLSX/PDF) → extract records
    // TODO: Run anomaly detection
    // TODO: Store batch with PENDING status
    // TODO: Notify Program Manager for approval

    return NextResponse.json({
      success: true,
      batch: {
        fileHash,
        fileName: file.name,
        fileSize: file.size,
        status: 'PARSING',
        audit: auditEntry,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
