'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Droplets, Trophy, RotateCcw, Play, Zap, ChevronRight } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type PollutantType = 'sediment' | 'nutrient' | 'bacteria' | 'microplastic' | 'oil' | 'heavy_metal';
type TowerType = 'oyster_bed' | 'mech_filter' | 'resin_trap' | 'uv_station' | 'kelp_wall';

interface Pollutant {
  id: number;
  type: PollutantType;
  lane: number;
  x: number;
  hp: number;
  maxHp: number;
  speed: number;
  slowed: number;
  size: number;
  value: number;
  dead: boolean;
  deathAnim: number;
  attacking: boolean;
  attackTarget: number | null;
}

interface Tower {
  id: number;
  type: TowerType;
  col: number;
  lane: number;
  hp: number;
  maxHp: number;
  damage: number;
  fireRate: number;
  lastFired: number;
  range: number;
  kills: number;
  animPhase: number;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  lane: number;
  speed: number;
  damage: number;
  towerType: TowerType;
}

interface WaterDrop {
  id: number;
  x: number;
  y: number;
  vy: number;
  value: number;
  life: number;
}

interface WaveEnemy {
  type: PollutantType;
  lane: number;
  spawnAt: number;
}

interface GameState {
  phase: 'menu' | 'playing' | 'waveBreak' | 'victory' | 'defeat';
  coins: number;
  lives: number;
  wave: number;
  maxWaves: number;
  score: number;
  totalKills: number;
  selectedTower: TowerType | null;
  level: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const W = 740;
const H = 440;
const LANES = 5;
const COLS = 9;
const CELL_W = 60;
const CELL_H = 72;
const GRID_LEFT = 80;
const GRID_TOP = 20;
const BAY_X = GRID_LEFT + COLS * CELL_W;

const POLLUTANT_CFG: Record<PollutantType, {
  color: string; label: string; emoji: string; hp: number; speed: number;
  value: number; size: number; attackDmg: number;
}> = {
  sediment:     { color: '#92702B', label: 'Sediment',     emoji: '🟤', hp: 40,  speed: 0.4, value: 10, size: 10, attackDmg: 2 },
  nutrient:     { color: '#16a34a', label: 'Nutrient',     emoji: '🟢', hp: 55,  speed: 0.5, value: 12, size: 9,  attackDmg: 3 },
  bacteria:     { color: '#dc2626', label: 'Bacteria',     emoji: '🔴', hp: 30,  speed: 0.8, value: 15, size: 7,  attackDmg: 4 },
  microplastic: { color: '#7c3aed', label: 'Microplastic', emoji: '🟣', hp: 70,  speed: 0.3, value: 15, size: 11, attackDmg: 2 },
  oil:          { color: '#1a1a1a', label: 'Oil Slick',    emoji: '⚫', hp: 90,  speed: 0.35, value: 20, size: 12, attackDmg: 5 },
  heavy_metal:  { color: '#6b7280', label: 'Heavy Metal',  emoji: '⬛', hp: 120, speed: 0.3, value: 25, size: 11, attackDmg: 6 },
};

const TOWER_CFG: Record<TowerType, {
  label: string; emoji: string; cost: number; hp: number; damage: number;
  fireRate: number; range: number; color: string;
  description: string; strongVs: string;
}> = {
  oyster_bed: {
    label: 'Oyster Bed', emoji: '🐚', cost: 50, hp: 80, damage: 8,
    fireRate: 35, range: CELL_W * 3.5, color: '#a3a3a3',
    description: 'Steady filter. Slows targets.', strongVs: 'Sediment, Nutrient',
  },
  mech_filter: {
    label: 'Mech Filter', emoji: '⚙️', cost: 100, hp: 60, damage: 20,
    fireRate: 25, range: CELL_W * 4, color: '#3b82f6',
    description: 'High damage. Hits hard.', strongVs: 'Microplastic, Oil',
  },
  resin_trap: {
    label: 'Resin Trap', emoji: '🧲', cost: 75, hp: 50, damage: 6,
    fireRate: 8, range: CELL_W * 3, color: '#f59e0b',
    description: 'Rapid fire. Wears them down.', strongVs: 'Heavy Metal, Oil',
  },
  uv_station: {
    label: 'UV Station', emoji: '☀️', cost: 125, hp: 40, damage: 25,
    fireRate: 50, range: CELL_W * 5, color: '#a855f7',
    description: 'Long range beam. Pierces.', strongVs: 'Bacteria, Nutrient',
  },
  kelp_wall: {
    label: 'Kelp Wall', emoji: '🌿', cost: 25, hp: 200, damage: 0,
    fireRate: 999, range: 0, color: '#22c55e',
    description: 'Cheap blocker. Absorbs hits.', strongVs: 'Everything (defensive)',
  },
};

const BONUS: Partial<Record<TowerType, Partial<Record<PollutantType, number>>>> = {
  oyster_bed:  { sediment: 1.8, nutrient: 1.6 },
  mech_filter: { microplastic: 2.0, oil: 1.5 },
  resin_trap:  { heavy_metal: 2.5, oil: 1.8 },
  uv_station:  { bacteria: 2.5, nutrient: 1.5 },
};

function generateWaves(level: number): WaveEnemy[][] {
  const waves: WaveEnemy[][] = [];
  const types: PollutantType[][] = [
    ['sediment'],
    ['sediment', 'nutrient'],
    ['sediment', 'nutrient', 'bacteria'],
    ['sediment', 'nutrient', 'bacteria', 'microplastic'],
    ['sediment', 'nutrient', 'bacteria', 'microplastic', 'oil'],
    ['nutrient', 'bacteria', 'microplastic', 'oil', 'heavy_metal'],
  ];
  const numWaves = level === 0 ? 5 : level === 1 ? 7 : 10;
  for (let w = 0; w < numWaves; w++) {
    const enemies: WaveEnemy[] = [];
    const pool = types[Math.min(w + level, types.length - 1)];
    const count = 6 + w * 2 + level * 3;
    let tick = 40;
    for (let i = 0; i < count; i++) {
      const type = pool[Math.floor(Math.random() * pool.length)];
      const lane = Math.floor(Math.random() * LANES);
      enemies.push({ type, lane, spawnAt: tick });
      tick += Math.max(10, 25 + Math.floor(Math.random() * 20) - w * 2);
    }
    waves.push(enemies);
  }
  return waves;
}

const LEVEL_NAMES = ['Calm Creek', 'Urban Storm', 'Industrial Zone'];
const STARTING_COINS = [200, 250, 300];

const FACTS = [
  "A single adult oyster can filter up to 50 gallons of water per day!",
  "Oysters remove nitrogen and phosphorus — two major pollutants in waterways.",
  "TSS stands for Total Suspended Solids — tiny particles floating in water.",
  "The Chesapeake Bay once had so many oysters they could filter the entire Bay in a week!",
  "PEARL combines mechanical filtration with oyster biofiltration for cleaner water.",
  "Stormwater runoff is the #1 source of pollution in urban waterways.",
  "Microplastics are tiny plastic fragments less than 5mm — they're everywhere in our water.",
  "Kelp and seagrass beds act as natural water filters in coastal ecosystems.",
  "UV light destroys bacteria DNA — it's used in water treatment plants worldwide.",
  "Heavy metals like lead and mercury bioaccumulate up the food chain.",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function laneToY(lane: number): number { return GRID_TOP + lane * CELL_H + CELL_H / 2; }
function colToX(col: number): number { return GRID_LEFT + col * CELL_W + CELL_W / 2; }
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WaterTowerDefense() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const towersRef = useRef<Tower[]>([]);
  const pollutantsRef = useRef<Pollutant[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const dropsRef = useRef<WaterDrop[]>([]);
  const spawnQueueRef = useRef<WaveEnemy[]>([]);
  const frameRef = useRef(0);
  const tickRef = useRef(0);
  const nextId = useRef({ t: 0, p: 0, pr: 0, d: 0 });
  const spawnedRef = useRef(0);
  const waveEndedRef = useRef(false);

  const [game, setGame] = useState<GameState>({
    phase: 'menu', coins: 200, lives: 5, wave: 0, maxWaves: 5,
    score: 0, totalKills: 0, selectedTower: 'oyster_bed', level: 0,
  });
  const [fact, setFact] = useState(() => FACTS[Math.floor(Math.random() * FACTS.length)]);
  const gameRef = useRef(game);
  gameRef.current = game;

  const allWaves = useMemo(() => generateWaves(game.level), [game.level]);

  // ── Start game ──
  const startGame = useCallback((level = 0) => {
    towersRef.current = [];
    pollutantsRef.current = [];
    projectilesRef.current = [];
    dropsRef.current = [];
    spawnQueueRef.current = [];
    nextId.current = { t: 0, p: 0, pr: 0, d: 0 };
    spawnedRef.current = 0;
    waveEndedRef.current = false;
    tickRef.current = 0;
    const ws = generateWaves(level);
    spawnQueueRef.current = [...ws[0]];
    setGame({
      phase: 'playing', coins: STARTING_COINS[level] || 200, lives: 5,
      wave: 0, maxWaves: ws.length, score: 0, totalKills: 0,
      selectedTower: 'oyster_bed', level,
    });
    setFact(FACTS[Math.floor(Math.random() * FACTS.length)]);
  }, []);

  // ── Next wave ──
  const nextWave = useCallback(() => {
    const g = gameRef.current;
    const nw = g.wave + 1;
    if (nw >= allWaves.length) {
      setGame(prev => ({ ...prev, phase: 'victory' }));
      return;
    }
    spawnQueueRef.current = [...allWaves[nw]];
    spawnedRef.current = 0;
    waveEndedRef.current = false;
    tickRef.current = 0;
    setGame(prev => ({ ...prev, phase: 'playing', wave: nw }));
    setFact(FACTS[Math.floor(Math.random() * FACTS.length)]);
  }, [allWaves]);

  // ── Canvas coords ──
  const canvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }, []);

  // ── Click ──
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    const { x, y } = canvasCoords(e);

    // Collect water drops
    for (let i = dropsRef.current.length - 1; i >= 0; i--) {
      const d = dropsRef.current[i];
      if (dist(x, y, d.x, d.y) < 20) {
        setGame(prev => ({ ...prev, coins: prev.coins + d.value }));
        dropsRef.current.splice(i, 1);
        return;
      }
    }

    if (g.phase !== 'playing' && g.phase !== 'waveBreak') return;
    if (!g.selectedTower) return;

    const col = Math.floor((x - GRID_LEFT) / CELL_W);
    const lane = Math.floor((y - GRID_TOP) / CELL_H);
    if (col < 0 || col >= COLS || lane < 0 || lane >= LANES) return;

    const cfg = TOWER_CFG[g.selectedTower];
    if (g.coins < cfg.cost) return;
    if (towersRef.current.some(t => t.col === col && t.lane === lane)) return;

    towersRef.current.push({
      id: nextId.current.t++,
      type: g.selectedTower, col, lane,
      hp: cfg.hp, maxHp: cfg.hp,
      damage: cfg.damage, fireRate: cfg.fireRate,
      lastFired: -999, range: cfg.range, kills: 0,
      animPhase: Math.random() * Math.PI * 2,
    });
    setGame(prev => ({ ...prev, coins: prev.coins - cfg.cost }));
  }, [canvasCoords]);

  // ── Game loop ──
  useEffect(() => {
    const g = gameRef.current;
    if (g.phase !== 'playing' && g.phase !== 'waveBreak') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let last = performance.now();
    let acc = 0;
    const TICK = 1000 / 60;

    function update() {
      const g = gameRef.current;
      tickRef.current++;

      // ── Water drops (resources like PVZ sun) ──
      if (tickRef.current % 180 === 0) {
        dropsRef.current.push({
          id: nextId.current.d++,
          x: GRID_LEFT + Math.random() * (COLS * CELL_W),
          y: -5, vy: 0.5 + Math.random() * 0.3, value: 25, life: 600,
        });
      }
      for (let i = dropsRef.current.length - 1; i >= 0; i--) {
        const d = dropsRef.current[i];
        d.y += d.vy; d.life--;
        if (d.life <= 0 || d.y > H + 10) dropsRef.current.splice(i, 1);
      }

      if (g.phase !== 'playing') return;

      // ── Spawn pollutants ──
      const queue = spawnQueueRef.current;
      while (queue.length > 0 && queue[0].spawnAt <= tickRef.current) {
        const e = queue.shift()!;
        const cfg = POLLUTANT_CFG[e.type];
        const hpMult = 1 + g.wave * 0.12 + g.level * 0.25;
        pollutantsRef.current.push({
          id: nextId.current.p++, type: e.type, lane: e.lane,
          x: GRID_LEFT - 20,
          hp: Math.round(cfg.hp * hpMult), maxHp: Math.round(cfg.hp * hpMult),
          speed: cfg.speed * (0.9 + Math.random() * 0.2),
          slowed: 0, size: cfg.size, value: cfg.value,
          dead: false, deathAnim: 0, attacking: false, attackTarget: null,
        });
        spawnedRef.current++;
      }

      // ── Move pollutants ──
      let livesLost = 0;
      for (const p of pollutantsRef.current) {
        if (p.dead) continue;
        if (p.slowed > 0) p.slowed--;

        // Check if blocked by tower
        if (!p.attacking) {
          for (const t of towersRef.current) {
            if (t.lane !== p.lane) continue;
            const towerX = colToX(t.col);
            if (towerX > p.x && towerX - p.x < p.size + 15) {
              p.attacking = true;
              p.attackTarget = t.id;
              break;
            }
          }
        }

        if (p.attacking) {
          const target = towersRef.current.find(t => t.id === p.attackTarget);
          if (!target) {
            p.attacking = false;
            p.attackTarget = null;
          } else {
            if (tickRef.current % 30 === 0) {
              target.hp -= POLLUTANT_CFG[p.type].attackDmg;
              if (target.hp <= 0) {
                const idx = towersRef.current.indexOf(target);
                if (idx >= 0) towersRef.current.splice(idx, 1);
                p.attacking = false;
                p.attackTarget = null;
              }
            }
            continue;
          }
        }

        p.x += p.speed * (p.slowed > 0 ? 0.5 : 1);

        if (p.x >= BAY_X + 10) {
          p.dead = true;
          livesLost++;
        }
      }

      // ── Towers fire ──
      let scoreGain = 0, coinsGain = 0, killsGain = 0;
      for (const t of towersRef.current) {
        t.animPhase += 0.04;
        if (t.damage === 0 || tickRef.current - t.lastFired < t.fireRate) continue;

        const towerX = colToX(t.col);
        let best: Pollutant | null = null;
        let bestDist = Infinity;
        for (const p of pollutantsRef.current) {
          if (p.dead || p.lane !== t.lane) continue;
          const d = p.x - towerX;
          if (d > -10 && d < t.range && d < bestDist) { bestDist = d; best = p; }
        }

        if (best) {
          t.lastFired = tickRef.current;
          projectilesRef.current.push({
            id: nextId.current.pr++,
            x: towerX + 15, y: laneToY(t.lane), lane: t.lane,
            speed: 5, damage: t.damage, towerType: t.type,
          });
        }
      }

      // ── Move projectiles ──
      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const pr = projectilesRef.current[i];
        pr.x += pr.speed;
        if (pr.x > W + 10) { projectilesRef.current.splice(i, 1); continue; }

        let hit = false;
        for (const p of pollutantsRef.current) {
          if (p.dead || p.lane !== pr.lane) continue;
          if (Math.abs(pr.x - p.x) < p.size + 5) {
            const bonus = BONUS[pr.towerType]?.[p.type] ?? 1;
            p.hp -= Math.round(pr.damage * bonus);
            if (pr.towerType === 'oyster_bed') p.slowed = 60;
            if (p.hp <= 0) {
              p.dead = true;
              scoreGain += p.value * 2;
              coinsGain += p.value;
              killsGain++;
            }
            hit = true;
            if (pr.towerType !== 'uv_station') break; // UV pierces
          }
        }
        if (hit && pr.towerType !== 'uv_station') projectilesRef.current.splice(i, 1);
      }

      // ── Clean up dead pollutants ──
      for (let i = pollutantsRef.current.length - 1; i >= 0; i--) {
        const p = pollutantsRef.current[i];
        if (p.dead) { p.deathAnim += 0.06; if (p.deathAnim >= 1) pollutantsRef.current.splice(i, 1); }
      }

      // ── State update ──
      if (scoreGain || coinsGain || livesLost || killsGain) {
        setGame(prev => {
          const nl = prev.lives - livesLost;
          if (nl <= 0) return { ...prev, lives: 0, phase: 'defeat' };
          return { ...prev, score: prev.score + scoreGain, coins: prev.coins + coinsGain, lives: nl, totalKills: prev.totalKills + killsGain };
        });
      }

      // ── Wave complete ──
      const allSpawned = queue.length === 0 && spawnedRef.current > 0;
      const allDead = pollutantsRef.current.length === 0;
      if (allSpawned && allDead && !waveEndedRef.current) {
        waveEndedRef.current = true;
        const g2 = gameRef.current;
        if (g2.lives <= 0) return;
        if (g2.wave + 1 >= allWaves.length) {
          setGame(prev => ({ ...prev, phase: 'victory' }));
        } else {
          setGame(prev => ({ ...prev, phase: 'waveBreak', coins: prev.coins + 50 }));
        }
      }
    }

    function draw() {
      if (!ctx) return;
      const g = gameRef.current;

      // Background
      ctx.fillStyle = '#e8f5e9';
      ctx.fillRect(0, 0, W, H);

      // Storm drain (left)
      const stormGrad = ctx.createLinearGradient(0, 0, GRID_LEFT, 0);
      stormGrad.addColorStop(0, '#475569');
      stormGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = stormGrad;
      ctx.fillRect(0, GRID_TOP, GRID_LEFT - 5, LANES * CELL_H);

      // Drain pipes per lane
      ctx.fillStyle = '#334155';
      for (let l = 0; l < LANES; l++) {
        const py = laneToY(l);
        ctx.beginPath();
        ctx.arc(GRID_LEFT - 5, py, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(GRID_LEFT - 5, py, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#334155';
      }

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(22, GRID_TOP + LANES * CELL_H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('STORM DRAINS', 0, 0);
      ctx.restore();

      // Bay (right)
      const bayGrad = ctx.createLinearGradient(BAY_X, 0, W, 0);
      bayGrad.addColorStop(0, '#93c5fd');
      bayGrad.addColorStop(1, '#2563eb');
      ctx.fillStyle = bayGrad;
      ctx.fillRect(BAY_X, GRID_TOP, W - BAY_X, LANES * CELL_H);

      // Bay waves
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        for (let y = GRID_TOP; y < GRID_TOP + LANES * CELL_H; y += 3) {
          const wx = BAY_X + 8 + i * 18 + Math.sin((y + tickRef.current * 1.2) * 0.06 + i) * 4;
          y === GRID_TOP ? ctx.moveTo(wx, y) : ctx.lineTo(wx, y);
        }
        ctx.stroke();
      }

      // Bay critters
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      const bob = Math.sin(tickRef.current * 0.03) * 3;
      ctx.fillText('🐟', BAY_X + 22, laneToY(0) + bob);
      ctx.fillText('🦀', BAY_X + 45, laneToY(2) - bob);
      ctx.fillText('🐢', BAY_X + 25, laneToY(4) + bob);
      ctx.fillText('🐠', BAY_X + 50, laneToY(1) + bob * 0.7);
      ctx.fillText('🦐', BAY_X + 30, laneToY(3) - bob * 0.5);

      ctx.fillStyle = '#1e3a5f';
      ctx.font = 'bold 9px system-ui';
      ctx.save();
      ctx.translate(W - 14, GRID_TOP + LANES * CELL_H / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillText('🌊 THE BAY 🌊', 0, 0);
      ctx.restore();

      // Grid
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      for (let c = 0; c <= COLS; c++) {
        const x = GRID_LEFT + c * CELL_W;
        ctx.beginPath(); ctx.moveTo(x, GRID_TOP); ctx.lineTo(x, GRID_TOP + LANES * CELL_H); ctx.stroke();
      }
      for (let l = 0; l <= LANES; l++) {
        const y = GRID_TOP + l * CELL_H;
        ctx.beginPath(); ctx.moveTo(GRID_LEFT, y); ctx.lineTo(BAY_X, y); ctx.stroke();
      }

      // Lane tint
      for (let l = 0; l < LANES; l++) {
        if (l % 2 === 0) {
          ctx.fillStyle = 'rgba(147, 197, 253, 0.06)';
          ctx.fillRect(GRID_LEFT, GRID_TOP + l * CELL_H, COLS * CELL_W, CELL_H);
        }
      }

      // Towers
      for (const t of towersRef.current) {
        const tx = colToX(t.col), ty = laneToY(t.lane);
        const cfg = TOWER_CFG[t.type];

        // Base
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, 22, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        // Emoji
        const sway = t.type === 'kelp_wall' ? Math.sin(t.animPhase + tickRef.current * 0.02) * 2 : 0;
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cfg.emoji, tx, ty + 8 + sway);

        // HP bar
        if (t.hp < t.maxHp) {
          const bw = 30;
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(tx - bw / 2, ty + 17, bw, 3);
          ctx.fillStyle = t.hp > t.maxHp * 0.5 ? '#22c55e' : t.hp > t.maxHp * 0.25 ? '#f59e0b' : '#ef4444';
          ctx.fillRect(tx - bw / 2, ty + 17, bw * (t.hp / t.maxHp), 3);
        }
      }

      // Pollutants
      for (const p of pollutantsRef.current) {
        const py = laneToY(p.lane);
        const cfg = POLLUTANT_CFG[p.type];

        if (p.dead) {
          const s = 1 + p.deathAnim * 2;
          ctx.globalAlpha = 1 - p.deathAnim;
          ctx.fillStyle = cfg.color;
          ctx.beginPath(); ctx.arc(p.x, py, p.size * s, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }

        if (p.slowed > 0) {
          ctx.strokeStyle = 'rgba(59,130,246,0.4)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, py, p.size + 4, 0, Math.PI * 2); ctx.stroke();
        }
        if (p.attacking) {
          ctx.strokeStyle = 'rgba(239,68,68,0.5)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, py, p.size + 3, 0, Math.PI * 2); ctx.stroke();
        }

        ctx.fillStyle = cfg.color;
        ctx.shadowColor = cfg.color; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(p.x, py, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(p.x - p.size * 0.25, py - p.size * 0.25, p.size * 0.35, 0, Math.PI * 2); ctx.fill();

        if (p.hp < p.maxHp) {
          const bw = p.size * 2.5;
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(p.x - bw / 2, py - p.size - 6, bw, 2.5);
          ctx.fillStyle = p.hp > p.maxHp * 0.5 ? '#22c55e' : p.hp > p.maxHp * 0.25 ? '#f59e0b' : '#ef4444';
          ctx.fillRect(p.x - bw / 2, py - p.size - 6, bw * (p.hp / p.maxHp), 2.5);
        }
      }

      // Projectiles
      for (const pr of projectilesRef.current) {
        const py = laneToY(pr.lane);
        if (pr.towerType === 'uv_station') {
          ctx.strokeStyle = 'rgba(168,85,247,0.6)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(pr.x - 10, py); ctx.lineTo(pr.x + 4, py); ctx.stroke();
        } else {
          const cfg = TOWER_CFG[pr.towerType];
          ctx.fillStyle = cfg.color; ctx.shadowColor = cfg.color; ctx.shadowBlur = 3;
          ctx.beginPath(); ctx.arc(pr.x, py, 3, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Water drops
      for (const d of dropsRef.current) {
        const pulse = 1 + Math.sin(tickRef.current * 0.1 + d.id) * 0.15;
        ctx.globalAlpha = d.life < 120 ? 0.4 : 0.9;
        ctx.font = `${14 * pulse}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('💧', d.x, d.y + 5);
        ctx.fillStyle = '#3b82f6';
        ctx.font = 'bold 8px system-ui';
        ctx.fillText(`+${d.value}`, d.x, d.y - 8);
        ctx.globalAlpha = 1;
      }

      // Lives
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('❤️'.repeat(Math.max(0, g.lives)) + '🖤'.repeat(Math.max(0, 5 - g.lives)), W - 8, 14);
    }

    function loop(now: number) {
      if (!running) return;
      const dt = now - last; last = now; acc += dt;
      while (acc >= TICK) { update(); acc -= TICK; }
      draw();
      frameRef.current = requestAnimationFrame(loop);
    }
    frameRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [game.phase, allWaves]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-emerald-50 to-cyan-50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield size={18} className="text-emerald-600" />
            PEARL Tower Defense
          </CardTitle>
          {(game.phase === 'playing' || game.phase === 'waveBreak') && (
            <div className="flex items-center gap-3 text-xs">
              <Badge variant="secondary" className="font-mono">💧 {game.coins}</Badge>
              <Badge variant="secondary" className="font-mono">🏆 {game.score}</Badge>
              <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700">
                Wave {game.wave + 1}/{game.maxWaves}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          <div className="relative flex-1">
            <canvas ref={canvasRef} width={W} height={H} onClick={handleClick} className="w-full cursor-crosshair block" />

            {/* Menu */}
            {game.phase === 'menu' && (
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/85 to-cyan-900/90 flex flex-col items-center justify-center text-white">
                <Shield size={48} className="text-emerald-300 mb-3" />
                <h2 className="text-2xl font-bold mb-1">PEARL Tower Defense</h2>
                <p className="text-sm text-emerald-200 mb-1 text-center px-4">
                  Pollutants are flowing from storm drains toward the bay!
                </p>
                <p className="text-xs text-emerald-300 mb-4 text-center px-4">
                  Place oysters, filters & kelp to stop them. Collect 💧 for coins.
                </p>
                <div className="bg-white/10 rounded-lg p-3 mb-4 text-xs text-emerald-100 max-w-sm text-center">
                  <span className="font-bold text-white">🧠 Did you know?</span><br />{fact}
                </div>
                <div className="flex flex-col gap-2">
                  {LEVEL_NAMES.map((name, i) => (
                    <Button key={i} onClick={() => startGame(i)}
                      className={`gap-2 min-w-[200px] text-white ${i === 0 ? 'bg-emerald-500 hover:bg-emerald-600' : i === 1 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'}`}>
                      <Play size={14} /> Level {i + 1}: {name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Wave Break */}
            {game.phase === 'waveBreak' && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                <h2 className="text-xl font-bold mb-2">✅ Wave {game.wave} Clear!</h2>
                <p className="text-xs text-green-300 mb-1">+50 bonus 💧</p>
                <div className="bg-white/10 rounded-lg p-2 mb-3 text-xs text-emerald-100 max-w-sm text-center">🧠 {fact}</div>
                <Button onClick={nextWave} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
                  <Zap size={14} /> Next Wave
                </Button>
              </div>
            )}

            {/* Victory */}
            {game.phase === 'victory' && (
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-900/80 to-emerald-900/90 flex flex-col items-center justify-center text-white">
                <Trophy size={48} className="text-yellow-300 mb-3" />
                <h2 className="text-2xl font-bold mb-1">Bay Protected! 🎉</h2>
                <div className="grid grid-cols-3 gap-4 my-4 text-center">
                  <div><div className="text-2xl font-bold font-mono">{game.score}</div><div className="text-[10px]">Score</div></div>
                  <div><div className="text-2xl font-bold font-mono">{game.totalKills}</div><div className="text-[10px]">Filtered</div></div>
                  <div><div className="text-2xl font-bold font-mono">{game.lives}/5</div><div className="text-[10px]">Lives</div></div>
                </div>
                <div className="flex gap-2">
                  {game.level + 1 < LEVEL_NAMES.length && (
                    <Button onClick={() => startGame(game.level + 1)} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
                      <ChevronRight size={14} /> Next: {LEVEL_NAMES[game.level + 1]}
                    </Button>
                  )}
                  <Button onClick={() => setGame(prev => ({ ...prev, phase: 'menu' }))} variant="outline" className="text-white border-white/30 hover:bg-white/10">
                    <RotateCcw size={14} className="mr-1" /> Menu
                  </Button>
                </div>
              </div>
            )}

            {/* Defeat */}
            {game.phase === 'defeat' && (
              <div className="absolute inset-0 bg-gradient-to-b from-red-900/80 to-slate-900/90 flex flex-col items-center justify-center text-white">
                <Droplets size={48} className="text-red-300 mb-3" />
                <h2 className="text-2xl font-bold mb-1">Bay Overwhelmed! 😢</h2>
                <p className="text-xs text-slate-300 mb-3">💡 Place Kelp Walls up front, then damage towers behind them!</p>
                <div className="flex gap-2">
                  <Button onClick={() => startGame(game.level)} className="bg-red-500 hover:bg-red-600 text-white gap-1">
                    <RotateCcw size={14} /> Retry
                  </Button>
                  <Button onClick={() => setGame(prev => ({ ...prev, phase: 'menu' }))} variant="outline" className="text-white border-white/30 hover:bg-white/10">Menu</Button>
                </div>
              </div>
            )}
          </div>

          {/* Tower Shop */}
          {(game.phase === 'playing' || game.phase === 'waveBreak') && (
            <div className="w-full lg:w-[180px] bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-3 space-y-2">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Click grid to place</div>
              {(Object.entries(TOWER_CFG) as [TowerType, typeof TOWER_CFG[TowerType]][]).map(([type, cfg]) => {
                const sel = game.selectedTower === type;
                const ok = game.coins >= cfg.cost;
                return (
                  <button key={type}
                    onClick={() => setGame(prev => ({ ...prev, selectedTower: type }))}
                    disabled={!ok}
                    className={`w-full text-left rounded-lg border p-2 transition-all text-xs ${
                      sel ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                        : ok ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-slate-100 border-slate-200 opacity-50'
                    }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{cfg.emoji} {cfg.label}</span>
                      <span className="font-mono text-[10px]">💧{cfg.cost}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{cfg.description}</div>
                  </button>
                );
              })}

              <div className="pt-2 border-t border-slate-200">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Pollutants</div>
                {(Object.entries(POLLUTANT_CFG) as [PollutantType, typeof POLLUTANT_CFG[PollutantType]][]).map(([, cfg]) => (
                  <div key={cfg.label} className="flex items-center gap-1.5 text-[10px] py-0.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                    <span className="text-slate-600">{cfg.label}</span>
                  </div>
                ))}
              </div>

              <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-200">
                💧 Click falling drops for coins<br />
                🌿 Kelp Walls block pollutants<br />
                🐚 Oysters slow them down<br />
                ☀️ UV beams pierce through
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
