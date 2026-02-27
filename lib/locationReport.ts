/**
 * Location Water Quality Report — Types for the unified location report
 * that fans out to all spatial caches and returns a multi-source water
 * quality summary for any given lat/lng.
 */

import type { WqpRecord } from './wqpCache';
import type { SdwisSystem, SdwisViolation, SdwisEnforcement } from './sdwisCache';
import type { IcisPermit, IcisViolation } from './icisCache';
import type { EchoFacility, EchoViolation } from './echoCache';
import type { PfasResult } from './pfasCache';
import type { NwisGwSite, NwisGwLevel, NwisGwTrend } from './nwisGwCache';
import type { UsgsIvSite, UsgsIvReading } from './nwisIvCache';
import type { FrsFacility } from './frsCache';
import type { TriFacility } from './triCache';
import type { NdbcStation } from './ndbcCache';
import type { NarsSite } from './narsCache';
import type { StateDataReport } from './stateReportCache';

export interface LocationReport {
  location: {
    lat: number;
    lng: number;
    state: string;
    label: string;
    zip?: string;
  };
  sources: {
    wqp: { records: WqpRecord[] } | null;
    sdwis: { systems: SdwisSystem[]; violations: SdwisViolation[]; enforcement: SdwisEnforcement[] } | null;
    icis: { permits: IcisPermit[]; violations: IcisViolation[] } | null;
    echo: { facilities: EchoFacility[]; violations: EchoViolation[] } | null;
    pfas: { results: PfasResult[] } | null;
    nwisGw: { sites: NwisGwSite[]; levels: NwisGwLevel[]; trends: NwisGwTrend[] } | null;
    nwisIv: { sites: UsgsIvSite[]; readings: UsgsIvReading[] } | null;
    frs: { facilities: FrsFacility[] } | null;
    tri: { facilities: TriFacility[] } | null;
    ndbc: { stations: NdbcStation[] } | null;
    nars: { sites: NarsSite[] } | null;
    ejscreen: Record<string, unknown> | null;
    stateReport: StateDataReport | null;
    attains: { impaired: number; total: number; topCauses: string[] } | null;
  };
  generatedAt: string;
}
