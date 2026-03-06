/* ------------------------------------------------------------------ */
/*  PIN Sentinel - HUC-8 Flow-Time Estimator                          */
/*  Approximates travel-time between HUCs using adjacency + centroid  */
/*  distance. This is a routing proxy, not hydraulic simulation.      */
/* ------------------------------------------------------------------ */

import fs from 'fs';
import path from 'path';
import { FLOW_TIME_CONFIG } from './nwssCorrelationConfig';
import { getDirectedDownstream, hasDirectedRoutingData } from './hucFlowRouting';

interface HucAdjacencyEntry {
  adjacent: string[];
}

type HucAdjacencyTable = Record<string, HucAdjacencyEntry>;
type HucCentroids = Record<string, { lat: number; lng: number }>;

export interface HucFlowTiming {
  expectedHours: number;
  windowHours: number;
  hops: number;
  distanceKm: number | null;
  routingMode: 'directed' | 'adjacency';
}

let _adjacency: HucAdjacencyTable | null = null;
let _centroids: HucCentroids | null = null;
const _pathMemo = new Map<string, { hops: number; distanceKm: number | null } | null>();

function loadAdjacency(): HucAdjacencyTable {
  if (_adjacency) return _adjacency;
  try {
    const fp = path.resolve(process.cwd(), 'data/huc8-adjacency.json');
    _adjacency = JSON.parse(fs.readFileSync(fp, 'utf-8')) as HucAdjacencyTable;
  } catch {
    _adjacency = {};
  }
  return _adjacency;
}

function loadCentroids(): HucCentroids {
  if (_centroids) return _centroids;
  try {
    const fp = path.resolve(process.cwd(), 'data/huc8-centroids.json');
    _centroids = JSON.parse(fs.readFileSync(fp, 'utf-8')) as HucCentroids;
  } catch {
    _centroids = {};
  }
  return _centroids;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function edgeDistanceKm(a: string, b: string, centroids: HucCentroids): number {
  const ca = centroids[a];
  const cb = centroids[b];
  if (ca && cb) return haversineKm(ca.lat, ca.lng, cb.lat, cb.lng);
  return FLOW_TIME_CONFIG.defaultEdgeKm;
}

function shortestPath(
  source: string,
  target: string,
  directed: boolean
): { hops: number; distanceKm: number | null } | null {
  if (!source || !target) return null;
  if (source === target) return { hops: 0, distanceKm: 0 };

  const memoKey = `${source}|${target}|${FLOW_TIME_CONFIG.maxHops}|${directed ? 'directed' : 'adj'}`;
  if (_pathMemo.has(memoKey)) return _pathMemo.get(memoKey) ?? null;

  const graph = loadAdjacency();
  const centroids = loadCentroids();
  if (!graph[source] || !graph[target]) {
    _pathMemo.set(memoKey, null);
    return null;
  }

  const bestDist = new Map<string, number>();
  const bestHops = new Map<string, number>();
  const queue: Array<{ huc: string; dist: number; hops: number }> = [{ huc: source, dist: 0, hops: 0 }];

  bestDist.set(source, 0);
  bestHops.set(source, 0);

  while (queue.length > 0) {
    queue.sort((x, y) => x.dist - y.dist);
    const cur = queue.shift()!;

    if (cur.huc === target) {
      const out = { hops: cur.hops, distanceKm: Number.isFinite(cur.dist) ? cur.dist : null };
      _pathMemo.set(memoKey, out);
      return out;
    }

    if (cur.hops >= FLOW_TIME_CONFIG.maxHops) continue;
    const neighbors = directed
      ? getDirectedDownstream(cur.huc)
      : (graph[cur.huc]?.adjacent ?? []);
    for (const nxt of neighbors) {
      const nd = cur.dist + edgeDistanceKm(cur.huc, nxt, centroids);
      const nh = cur.hops + 1;
      const prevDist = bestDist.get(nxt);
      const prevHops = bestHops.get(nxt);
      const better =
        prevDist === undefined ||
        nd < prevDist - 1e-6 ||
        (Math.abs(nd - prevDist) <= 1e-6 && (prevHops === undefined || nh < prevHops));
      if (!better) continue;
      bestDist.set(nxt, nd);
      bestHops.set(nxt, nh);
      queue.push({ huc: nxt, dist: nd, hops: nh });
    }
  }

  _pathMemo.set(memoKey, null);
  return null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function timingFromPath(
  path: { hops: number; distanceKm: number | null },
  routingMode: 'directed' | 'adjacency'
): HucFlowTiming {
  const dist = path.distanceKm;
  const travelByDistance = dist === null ? null : dist / FLOW_TIME_CONFIG.avgFlowKmh;
  const travelByHops = path.hops * FLOW_TIME_CONFIG.hoursPerHop;
  const expectedHours = (travelByDistance ?? travelByHops) + FLOW_TIME_CONFIG.baseDelayHours;
  const windowHours = clamp(
    expectedHours + FLOW_TIME_CONFIG.windowBufferHours,
    FLOW_TIME_CONFIG.minWindowHours,
    FLOW_TIME_CONFIG.maxWindowHours
  );
  return {
    expectedHours: Math.round(expectedHours * 10) / 10,
    windowHours: Math.round(windowHours * 10) / 10,
    hops: path.hops,
    distanceKm: dist === null ? null : Math.round(dist * 10) / 10,
    routingMode,
  };
}

export function estimateFlowTimingForHucs(sourceHucs: string[], targetHuc: string): HucFlowTiming | null {
  if (!targetHuc || sourceHucs.length === 0) return null;

  const useDirected = FLOW_TIME_CONFIG.preferDirectedRouting && hasDirectedRoutingData();

  let best: { hops: number; distanceKm: number | null } | null = null;
  let bestMode: 'directed' | 'adjacency' = 'adjacency';
  for (const src of sourceHucs) {
    let p = shortestPath(src, targetHuc, useDirected);
    let mode: 'directed' | 'adjacency' = useDirected ? 'directed' : 'adjacency';
    if (!p && useDirected && !FLOW_TIME_CONFIG.strictDirectedRouting) {
      p = shortestPath(src, targetHuc, false);
      mode = 'adjacency';
    }
    if (!p) continue;
    if (!best) {
      best = p;
      bestMode = mode;
      continue;
    }
    const bestDist = best.distanceKm ?? Number.POSITIVE_INFINITY;
    const nextDist = p.distanceKm ?? Number.POSITIVE_INFINITY;
    if (nextDist < bestDist || (nextDist === bestDist && p.hops < best.hops)) {
      best = p;
      bestMode = mode;
    }
  }

  return best ? timingFromPath(best, bestMode) : null;
}
