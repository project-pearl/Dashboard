import type { NwsAlert } from '@/lib/nwsAlertCache';

export function makeNwsAlert(overrides: Partial<NwsAlert> = {}): NwsAlert {
  return {
    id: 'urn:oid:2.49.0.1.840.0.abc123',
    event: 'Flash Flood Warning',
    severity: 'Severe',
    certainty: 'Likely',
    urgency: 'Immediate',
    headline: 'Flash Flood Warning issued for Baltimore City',
    description: 'Heavy rainfall is expected to cause flash flooding in low-lying areas.',
    areaDesc: 'Baltimore City, MD',
    onset: '2024-06-15T14:00:00Z',
    expires: '2099-06-15T20:00:00Z',
    senderName: 'NWS Baltimore MD/Washington DC',
    affectedZones: ['MDZ011'],
    precipForecast: { total6hr: 2.5, total24hr: 4.0 },
    geometry: null,
    centroidLat: 39.29,
    centroidLng: -76.61,
    ...overrides,
  };
}
