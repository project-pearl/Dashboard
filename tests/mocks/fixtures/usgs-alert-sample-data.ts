import type { UsgsAlert } from '@/lib/usgsAlertEngine';

export function makeUsgsAlert(overrides: Partial<UsgsAlert> = {}): UsgsAlert {
  return {
    id: '01646500-DO-critical-1700000000000',
    siteNumber: '01646500',
    siteName: 'Potomac River at Chain Bridge',
    state: 'MD',
    lat: 38.93,
    lng: -77.12,
    parameter: 'DO',
    parameterCd: '00300',
    value: 2.8,
    unit: 'mg/L',
    threshold: 4.0,
    severity: 'critical',
    type: 'low-do',
    title: 'Critical: Low Dissolved Oxygen',
    message: 'DO at 2.8 mg/L (< 4.0 mg/L) at Potomac River at Chain Bridge — fish kill risk',
    firedAt: new Date().toISOString(),
    readingTime: new Date().toISOString(),
    ...overrides,
  };
}
