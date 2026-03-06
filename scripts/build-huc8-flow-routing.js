#!/usr/bin/env node
/* ------------------------------------------------------------------ */
/*  Build directed HUC-8 flow routing table                           */
/*  Input: CSV or JSON of directed edges (upstream -> downstream)     */
/*  Output: data/huc8-flow-routing.json                               */
/* ------------------------------------------------------------------ */

const fs = require('fs');
const path = require('path');

function usage() {
  console.log(
    'Usage: node scripts/build-huc8-flow-routing.js ' +
      '[--input data/huc8-flow-edges.csv] [--output data/huc8-flow-routing.json]'
  );
}

function readArgs() {
  const args = process.argv.slice(2);
  let input = path.resolve(process.cwd(), 'data/huc8-flow-edges.csv');
  let output = path.resolve(process.cwd(), 'data/huc8-flow-routing.json');

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--help' || a === '-h') {
      usage();
      process.exit(0);
    }
    if (a === '--input' && args[i + 1]) {
      input = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
      continue;
    }
    if (a === '--output' && args[i + 1]) {
      output = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
      continue;
    }
  }

  return { input, output };
}

function normHuc(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(/[^0-9]/g, '');
  if (!s) return null;
  return s.padStart(8, '0').slice(0, 8);
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idxFrom = headers.findIndex((h) => ['from', 'from_huc8', 'upstream', 'source'].includes(h));
  const idxTo = headers.findIndex((h) => ['to', 'to_huc8', 'downstream', 'target'].includes(h));
  if (idxFrom < 0 || idxTo < 0) {
    throw new Error(
      'CSV header must include upstream/downstream columns. ' +
        'Accepted names: from_huc8,to_huc8 (or from,to / upstream,downstream).'
    );
  }

  const edges = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const from = normHuc(cols[idxFrom]);
    const to = normHuc(cols[idxTo]);
    if (!from || !to || from === to) continue;
    edges.push({ from, to });
  }
  return edges;
}

function parseJson(text) {
  const data = JSON.parse(text);
  const edges = [];

  if (Array.isArray(data)) {
    for (const row of data) {
      const from = normHuc(row.from ?? row.from_huc8 ?? row.upstream ?? row.source);
      const to = normHuc(row.to ?? row.to_huc8 ?? row.downstream ?? row.target);
      if (!from || !to || from === to) continue;
      edges.push({ from, to });
    }
    return edges;
  }

  if (data && typeof data === 'object') {
    for (const [rawFrom, downstream] of Object.entries(data)) {
      const from = normHuc(rawFrom);
      if (!from) continue;
      if (!Array.isArray(downstream)) continue;
      for (const rawTo of downstream) {
        const to = normHuc(rawTo);
        if (!to || to === from) continue;
        edges.push({ from, to });
      }
    }
    return edges;
  }

  throw new Error('Unsupported JSON format for flow edges.');
}

function parseEdges(inputPath) {
  const raw = fs.readFileSync(inputPath, 'utf-8');
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.json') return parseJson(raw);
  if (ext === '.csv' || ext === '.txt') return parseCsv(raw);
  throw new Error(`Unsupported input extension: ${ext}. Use .csv or .json`);
}

function buildRouting(edges, allKnownHucs) {
  const map = new Map();

  function ensure(huc) {
    if (!map.has(huc)) {
      map.set(huc, { downstream: new Set(), upstream: new Set() });
    }
    return map.get(huc);
  }

  for (const huc of allKnownHucs) ensure(huc);

  for (const e of edges) {
    const src = ensure(e.from);
    const dst = ensure(e.to);
    src.downstream.add(e.to);
    dst.upstream.add(e.from);
  }

  const out = {};
  for (const [huc, node] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    out[huc] = {
      downstream: [...node.downstream].sort(),
      upstream: [...node.upstream].sort(),
    };
  }
  return out;
}

function main() {
  const { input, output } = readArgs();
  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const edges = parseEdges(input);
  const allKnownHucs = new Set();
  for (const e of edges) {
    allKnownHucs.add(e.from);
    allKnownHucs.add(e.to);
  }

  const routing = buildRouting(edges, [...allKnownHucs]);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(routing, null, 2)}\n`, 'utf-8');

  console.log(`[build-huc8-flow-routing] input: ${input}`);
  console.log(`[build-huc8-flow-routing] output: ${output}`);
  console.log(`[build-huc8-flow-routing] edges: ${edges.length}`);
  console.log(`[build-huc8-flow-routing] hucs: ${Object.keys(routing).length}`);
}

try {
  main();
} catch (err) {
  console.error(`[build-huc8-flow-routing] ${err.message}`);
  process.exit(1);
}
