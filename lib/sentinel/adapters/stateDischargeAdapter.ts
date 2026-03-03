/* ------------------------------------------------------------------ */
/*  PIN Sentinel — State Discharge Adapter (stub)                     */
/*  ChangeSource: STATE_DISCHARGE                                     */
/*                                                                    */
/*  Stub adapter — returns empty events until state discharge data    */
/*  sources (MDE, etc.) are integrated. Registered so compound        */
/*  patterns referencing STATE_DISCHARGE don't error.                 */
/* ------------------------------------------------------------------ */

import type { AdapterResult, SentinelSourceState } from '../types';

const SOURCE = 'STATE_DISCHARGE' as const;

export function pollStateDischarge(_prevState: SentinelSourceState): AdapterResult {
  // TODO: Integrate state-level discharge data (MDE, DEP, etc.)
  // When ready, read from a stateDischargeCache and map to ChangeEvents
  return {
    events: [],
    updatedState: {},
  };
}
