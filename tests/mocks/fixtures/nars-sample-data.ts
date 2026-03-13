import type { NarsSite } from '@/lib/narsCache';

export function makeNarsSite(overrides: Partial<NarsSite> = {}): NarsSite {
  return {
    siteId: 'NLA17-0001',
    uniqueId: 'NLA17-0001-2017',
    name: 'Loch Raven Reservoir',
    survey: 'NLA',
    surveyYear: '2017',
    lat: 39.42,
    lng: -76.55,
    state: 'MD',
    county: 'Baltimore',
    ecoregion: 'Northern Appalachian',
    huc8: '02060003',
    visitDate: '2017-07-15',
    chla: 5.2,
    ph: 7.8,
    turbidity: 3.1,
    dissolvedO2: 8.5,
    conductivity: 250,
    nitrogen: 0.8,
    phosphorus: 0.02,
    ...overrides,
  };
}
