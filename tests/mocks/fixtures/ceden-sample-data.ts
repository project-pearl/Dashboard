import type { ChemRecord, ToxRecord } from '@/lib/cedenCache';

export function makeChemRecord(overrides: Partial<ChemRecord> = {}): ChemRecord {
  return {
    stn: 'CEDEN-001',
    name: 'Sacramento River at Freeport',
    date: '2024-06-15',
    key: 'pH',
    analyte: 'pH',
    val: 7.8,
    unit: 'units',
    lat: 38.46,
    lng: -121.50,
    agency: 'SWRCB',
    ...overrides,
  };
}

export function makeToxRecord(overrides: Partial<ToxRecord> = {}): ToxRecord {
  return {
    stn: 'CEDEN-001',
    name: 'Sacramento River at Freeport',
    date: '2024-06-15',
    organism: 'Hyalella azteca',
    analyte: 'Survival',
    val: 85,
    mean: 82.5,
    unit: '%',
    sig: 'false',
    lat: 38.46,
    lng: -121.50,
    ...overrides,
  };
}
