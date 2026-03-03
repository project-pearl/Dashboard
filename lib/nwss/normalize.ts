/* ------------------------------------------------------------------ */
/*  CDC NWSS — Concentration Normalization                            */
/*                                                                    */
/*  Raw concentrations (copies/L) are NOT comparable across sites     */
/*  due to flow rate, population, lab methodology, and sample type.   */
/*                                                                    */
/*  Strategy:                                                         */
/*  1. PRIMARY: Use CDC's pcr_target_flowpop_lin (copies/person/day)  */
/*  2. FALLBACK: Manual calc from concentration × flow ÷ population   */
/*  3. LAST RESORT: Use raw concentration (flagged as unnormalized)   */
/* ------------------------------------------------------------------ */

import type { NWSSRecord } from './types';

/** Convert MGD (million gallons/day) to liters/day */
const MGD_TO_LITERS = 3_785_411.784;

/* ------------------------------------------------------------------ */
/*  Normalize a single record                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns the best available normalized concentration for a record.
 * Priority: CDC flowpop > manual calc > raw concentration.
 * Returns null only if no usable concentration exists.
 */
export function getNormalizedConcentration(record: NWSSRecord): number | null {
  // 1. CDC-provided flow-population normalized value (copies/person/day)
  if (record.flowPopNormalized != null && !isNaN(record.flowPopNormalized) && record.flowPopNormalized > 0) {
    return record.flowPopNormalized;
  }

  // 2. Manual calculation: (copies/L × L/day) / population
  if (
    record.concentration != null &&
    record.flowRate != null &&
    record.populationServed > 0 &&
    record.flowRate > 0
  ) {
    const litersPerDay = record.flowRate * MGD_TO_LITERS;
    return (record.concentration * litersPerDay) / record.populationServed;
  }

  // 3. Raw concentration (not normalized — less comparable but still useful)
  if (record.concentration != null && record.concentration > 0) {
    return record.concentration;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Batch normalization                                               */
/* ------------------------------------------------------------------ */

export interface NormalizedRecord {
  record: NWSSRecord;
  normalizedConcentration: number;
  normalizationMethod: 'cdc_flowpop' | 'manual_calc' | 'raw';
}

/**
 * Normalize an array of records, filtering out those with no usable data.
 */
export function normalizeRecords(records: NWSSRecord[]): NormalizedRecord[] {
  const result: NormalizedRecord[] = [];

  for (const record of records) {
    let normalizedConcentration: number | null = null;
    let method: NormalizedRecord['normalizationMethod'] = 'raw';

    // 1. CDC flowpop
    if (record.flowPopNormalized != null && !isNaN(record.flowPopNormalized) && record.flowPopNormalized > 0) {
      normalizedConcentration = record.flowPopNormalized;
      method = 'cdc_flowpop';
    }
    // 2. Manual calc
    else if (
      record.concentration != null &&
      record.flowRate != null &&
      record.populationServed > 0 &&
      record.flowRate > 0
    ) {
      const litersPerDay = record.flowRate * MGD_TO_LITERS;
      normalizedConcentration = (record.concentration * litersPerDay) / record.populationServed;
      method = 'manual_calc';
    }
    // 3. Raw
    else if (record.concentration != null && record.concentration > 0) {
      normalizedConcentration = record.concentration;
      method = 'raw';
    }

    if (normalizedConcentration !== null) {
      result.push({ record, normalizedConcentration, normalizationMethod: method });
    }
  }

  return result;
}
