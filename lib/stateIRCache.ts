/**
 * State IR Cache — Loads the PIN pipeline's state_ir_index.json at build time
 * and provides lookup functions for Integrated Report metadata.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface StateIREntry {
  state_code: string;
  state_name: string;
  agency: string;
  ir_page: string;
  ir_pdf: string | null;
  latest_cycle: string;
  epa_approval: string | null;
  data_window: string | null;
  status: 'confirmed' | 'needs_verification' | 'probable';
  supplemental: string[];
  notes: string;
}

interface StateIRIndex {
  generated: string;
  total_jurisdictions: number;
  states: StateIREntry[];
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _index: StateIRIndex | null = null;

function loadIndex(): StateIRIndex | null {
  if (_index) return _index;
  try {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), 'pin-pipeline', 'state_ir_index.json');
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    _index = JSON.parse(raw);
    console.log(`[State IR] Loaded index: ${_index!.total_jurisdictions} jurisdictions`);
    return _index;
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getStateIR(stateCode: string): StateIREntry | null {
  const index = loadIndex();
  if (!index) return null;
  return index.states.find(s => s.state_code === stateCode.toUpperCase()) || null;
}

export function getAllStateIRs(): StateIREntry[] {
  const index = loadIndex();
  return index?.states || [];
}

export function getConfirmedStates(): StateIREntry[] {
  return getAllStateIRs().filter(s => s.status === 'confirmed');
}

export function getStateIRIndexMeta(): { generated: string; total: number } | null {
  const index = loadIndex();
  if (!index) return null;
  return { generated: index.generated, total: index.total_jurisdictions };
}
