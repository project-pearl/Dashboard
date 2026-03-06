/* ------------------------------------------------------------------ */
/*  PIN Sentinel - HUC-8 Directed Flow Routing Loader                 */
/*  Optional downstream routing graph used for true directional paths */
/* ------------------------------------------------------------------ */

import fs from 'fs';
import path from 'path';

export interface DirectedHucEntry {
  downstream: string[];
  upstream?: string[];
}

type DirectedTable = Record<string, DirectedHucEntry>;

let _directed: DirectedTable | null = null;
let _loaded = false;

function loadDirected(): DirectedTable {
  if (_loaded) return _directed ?? {};
  _loaded = true;
  try {
    const filePath = path.resolve(process.cwd(), 'data/huc8-flow-routing.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    _directed = JSON.parse(raw) as DirectedTable;
  } catch {
    _directed = {};
  }
  return _directed;
}

export function hasDirectedRoutingData(): boolean {
  return Object.keys(loadDirected()).length > 0;
}

export function getDirectedDownstream(huc8: string): string[] {
  return loadDirected()[huc8]?.downstream ?? [];
}

