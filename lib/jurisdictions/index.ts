'use client';

import type { PearlUser } from '@/lib/authTypes';
import { getEpaRegionForState } from '@/lib/epa-regions';

export type JurisdictionType = 'county' | 'municipality' | 'ms4' | 'utility' | 'watershed' | 'custom';

export interface JurisdictionScope {
  jurisdiction_id: string;
  jurisdiction_name: string;
  jurisdiction_type: JurisdictionType;
  parent_state: string;
  parent_epa_region: number;
  assessment_unit_ids: string[];
  region_ids?: string[];
  name_keywords?: string[];
}

// Initial seed: Maryland counties + key municipalities with MS4 context.
export const JURISDICTIONS: JurisdictionScope[] = [
  {
    jurisdiction_id: 'anne_arundel_county_md',
    jurisdiction_name: 'Anne Arundel County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-ANNE-001', 'MD-ANNE-002', 'MD-ANNE-003'],
    name_keywords: ['anne arundel', 'severn', 'south river', 'magothy', 'patapsco'],
  },
  {
    jurisdiction_id: 'baltimore_county_md',
    jurisdiction_name: 'Baltimore County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-BALCO-001', 'MD-BALCO-002', 'MD-BALCO-003'],
    name_keywords: ['baltimore county', 'gunpowder', 'back river', 'patapsco'],
  },
  {
    jurisdiction_id: 'baltimore_city_md',
    jurisdiction_name: 'Baltimore City',
    jurisdiction_type: 'municipality',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-BALCITY-001', 'MD-BALCITY-002'],
    name_keywords: ['baltimore city', 'inner harbor', 'gwynns', 'jones falls'],
  },
  {
    jurisdiction_id: 'prince_georges_county_md',
    jurisdiction_name: "Prince George's County",
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-PG-001', 'MD-PG-002', 'MD-PG-003'],
    name_keywords: ['prince george', 'anacostia', 'patuxent', 'western branch'],
  },
  {
    jurisdiction_id: 'montgomery_county_md',
    jurisdiction_name: 'Montgomery County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-MONT-001', 'MD-MONT-002', 'MD-MONT-003'],
    name_keywords: ['montgomery', 'potomac', 'rock creek', 'anacostia'],
  },
  {
    jurisdiction_id: 'city_of_annapolis_md',
    jurisdiction_name: 'City of Annapolis',
    jurisdiction_type: 'municipality',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-ANNA-001', 'MD-ANNA-002'],
    name_keywords: ['annapolis', 'severn', 'spa creek', 'back creek'],
  },
];

export function getJurisdictionById(id?: string | null): JurisdictionScope | null {
  if (!id) return null;
  const key = id.trim().toLowerCase();
  return JURISDICTIONS.find((j) => j.jurisdiction_id.toLowerCase() === key) ?? null;
}

export function getJurisdictionsForState(stateAbbr?: string | null): JurisdictionScope[] {
  if (!stateAbbr) return JURISDICTIONS;
  return JURISDICTIONS.filter((j) => j.parent_state === stateAbbr.toUpperCase());
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function getRoleJurisdictionIds(user: PearlUser | null): string[] {
  if (!user) return [];
  const rawValues = [
    (user as any).jurisdictionId,
    (user as any).jurisdiction_id,
    user.ms4Jurisdiction,
    (user as any).requestedJurisdiction,
  ].filter(Boolean) as string[];

  const ids = new Set<string>();
  for (const raw of rawValues) {
    const exact = getJurisdictionById(raw);
    if (exact) {
      ids.add(exact.jurisdiction_id);
      continue;
    }
    const normalized = normalizeId(raw);
    const byNormalized = getJurisdictionById(normalized);
    if (byNormalized) ids.add(byNormalized.jurisdiction_id);
  }
  return Array.from(ids);
}

export function getAssignedJurisdictions(user: PearlUser | null): JurisdictionScope[] {
  const ids = getRoleJurisdictionIds(user);
  return ids.map((id) => getJurisdictionById(id)).filter(Boolean) as JurisdictionScope[];
}

type ScopeRow = { id?: string; name?: string; state?: string };

export function scopeRowsByJurisdiction<T extends ScopeRow>(
  rows: T[],
  jurisdiction: JurisdictionScope | null
): T[] {
  if (!jurisdiction) return rows;

  const scopedByState = rows.filter((r) => !r.state || r.state.toUpperCase() === jurisdiction.parent_state);
  const statePool = scopedByState.length > 0 ? scopedByState : rows;

  const idSet = new Set((jurisdiction.assessment_unit_ids || []).map((id) => id.toLowerCase()));
  const byId = idSet.size > 0
    ? statePool.filter((r) => !!r.id && idSet.has(String(r.id).toLowerCase()))
    : [];
  if (byId.length > 0) return byId;

  const keywordSource = jurisdiction.name_keywords && jurisdiction.name_keywords.length > 0
    ? jurisdiction.name_keywords
    : jurisdiction.jurisdiction_name.split(/\s+/);
  const tokens = keywordSource
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length >= 3 && !['county', 'city', 'of', 'the'].includes(t));

  if (tokens.length === 0) return statePool;

  return statePool.filter((r) => {
    const name = (r.name || '').toLowerCase();
    return tokens.some((t) => name.includes(t));
  });
}

export function buildCustomJurisdiction(input: {
  id: string;
  name: string;
  type?: JurisdictionType;
  parentState: string;
  assessmentUnitIds?: string[];
  regionIds?: string[];
  keywords?: string[];
}): JurisdictionScope {
  const parentState = input.parentState.toUpperCase();
  return {
    jurisdiction_id: normalizeId(input.id),
    jurisdiction_name: input.name.trim(),
    jurisdiction_type: input.type || 'custom',
    parent_state: parentState,
    parent_epa_region: getEpaRegionForState(parentState) || 0,
    assessment_unit_ids: input.assessmentUnitIds || [],
    region_ids: input.regionIds || [],
    name_keywords: input.keywords || [],
  };
}

