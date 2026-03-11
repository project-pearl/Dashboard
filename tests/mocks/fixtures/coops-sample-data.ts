import type { CoopsStation } from '@/lib/coopsCache';

export function makeCoopsStation(overrides: Partial<CoopsStation> = {}): CoopsStation {
  return {
    id: '8574680',
    name: 'Baltimore, Fort McHenry',
    state: 'MD',
    lat: 39.27,
    lng: -76.58,
    waterLevel: 0.35,
    waterLevelTime: '2024-06-15T12:00:00Z',
    airTemp: 28.5,
    waterTemp: 24.2,
    windSpeed: 8.5,
    windDir: 180,
    conductivity: null,
    salinity: null,
    humidity: null,
    visibility: null,
    airPressure: null,
    tidePrediction: 0.30,
    tidePredictionTime: '2024-06-15T12:00:00Z',
    ...overrides,
  };
}
