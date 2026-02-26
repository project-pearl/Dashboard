/* ------------------------------------------------------------------ */
/*  PIN Sentinel — HUC-8 Adjacency Loader                            */
/*  Loads static data/huc8-adjacency.json                             */
/* ------------------------------------------------------------------ */

import fs from 'fs';
import path from 'path';

interface HucEntry {
  huc6: string;
  adjacent: string[];
  state: string;
}

type AdjacencyTable = Record<string, HucEntry>;

let _table: AdjacencyTable | null = null;
let _stateIndex: Record<string, string[]> | null = null;

function load(): AdjacencyTable {
  if (_table) return _table;
  const filePath = path.resolve(process.cwd(), 'data/huc8-adjacency.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    _table = JSON.parse(raw) as AdjacencyTable;
  } catch {
    console.warn('[sentinel] huc8-adjacency.json not found, using empty table');
    _table = {};
  }
  return _table;
}

function buildStateIndex(): Record<string, string[]> {
  if (_stateIndex) return _stateIndex;
  const table = load();
  _stateIndex = {};
  for (const [huc8, entry] of Object.entries(table)) {
    const st = entry.state;
    if (!_stateIndex[st]) _stateIndex[st] = [];
    _stateIndex[st].push(huc8);
  }
  return _stateIndex;
}

/** Get adjacent HUC-8 codes for a given HUC-8 */
export function getAdjacentHucs(huc8: string): string[] {
  const table = load();
  return table[huc8]?.adjacent ?? [];
}

/** Get the HUC-6 parent from the first 6 characters */
export function getHuc6Parent(huc8: string): string {
  return huc8.slice(0, 6);
}

/** Check if two HUC-8s share the same HUC-6 parent */
export function shareHuc6Parent(a: string, b: string): boolean {
  return a.slice(0, 6) === b.slice(0, 6);
}

/** Get all HUC-8 codes for a given state */
export function getHucsInState(stateAbbr: string): string[] {
  const idx = buildStateIndex();
  return idx[stateAbbr] ?? [];
}

/** Get the state for a given HUC-8 */
export function getStateForHuc(huc8: string): string | undefined {
  const table = load();
  return table[huc8]?.state;
}

/** Get the full entry for a HUC-8 */
export function getHucEntry(huc8: string): HucEntry | undefined {
  const table = load();
  return table[huc8];
}

/** Get total count of HUC-8s in the table */
export function getHucCount(): number {
  const table = load();
  return Object.keys(table).length;
}
