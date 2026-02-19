'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Droplets, Trophy, RotateCcw, Play, Zap, Heart, Shell, Filter, Sun, Magnet, ChevronRight } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type PollutantType = 'sediment' | 'nutrient' | 'bacteria' | 'microplastic' | 'oil' | 'heavy_metal';
type TowerType = 'oyster_bed' | 'mech_filter' | 'resin_trap' | 'uv_station';

interface PathPoint { x: number; y: number }

interface Pollutant {
  id: number;
  type: PollutantType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  pathIndex: number;      // current segment
  pathProgress: number;   // 0-1 within segment
  slowed: number;         // ticks remaining of slow effect
  size: number;
  value: number;          // coins on kill
  escaped: boolean;
  dead: boolean;
  deathAnim: number;
}

interface Tower {
  id: number;
  type: TowerType;
  x: number;
  y: number;
  range: number;
  damage: number;
  fireRate: number;       // ticks between shots
  lastFired: number;
  level: number;
  kills: number;
  specialEffect?: 'slow' | 'splash' | 'dot' | 'pierce';
  targetId: number | null;
  angle: number;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  speed: number;
  damage: number;
  towerType: TowerType;
  special?: 'slow' | 'splash' | 'dot' | 'pierce';
}

interface WaveConfig {
  enemies: Array<{ type: PollutantType; count: number; delay: number }>;
  label: string;
}

interface GameState {
  phase: 'menu' | 'building' | 'wave' | 'waveComplete' | 'victory' | 'defeat';
  coins: number;
  lives: number;
  maxLives: number;
  wave: number;
  score: number;
  totalKills: number;
  selectedTower: TowerType | null;
  selectedPlaced: number | null; // tower id for info/upgrade
  level: number; // campaign level
}

// ─── Constants ──────────────────────────────────────────────────────────────

const W = 720;
const H = 520;
const TICK = 1000 / 60;
const CELL = 40;
const GRID_W = W / CELL;   // 18
const GRID_H = H / CELL;   // 13

// The stormwater path — pollutants flow along this from storm drain to bay
const PATHS: PathPoint[][] = [
  // Main path: storm drain (top-left) → winding through → bay (right)
  [
    { x: 0, y: 3 * CELL },
    { x: 3 * CELL, y: 3 * CELL },
    { x: 3 * CELL, y: 6 * CELL },
    { x: 7 * CELL, y: 6 * CELL },
    { x: 7 * CELL, y: 2 * CELL },
    { x: 11 * CELL, y: 2 * CELL },
    { x: 11 * CELL, y: 8 * CELL },
    { x: 14 * CELL, y: 8 * CELL },
    { x: 14 * CELL, y: 5 * CELL },
    { x: W, y: 5 * CELL },
  ],
];

const POLLUTANT_TYPES: Record<PollutantType, {
  color: string; label: string; emoji: string; hp: number; speed: number; value: number; size: number;
}> = {
  sediment:      { color: '#92702B', label: 'Sediment',      emoji: '🟤', hp: 30,  speed: 0.8, value: 5,  size: 6 },
  nutrient:      { color: '#16a34a', label: 'Nutrient',      emoji: '🟢', hp: 45,  speed: 1.0, value: 8,  size: 5 },
  bacteria:      { color: '#dc2626', label: 'Bacteria',      emoji: '🔴', hp: 25,  speed: 1.4, value: 10, size: 4 },
  microplastic:  { color: '#7c3aed', label: 'Microplastic',  emoji: '🟣', hp: 60,  speed: 0.6, value: 12, size: 7 },
  oil:           { color: '#1a1a1a', label: 'Oil Slick',     emoji: '⚫', hp: 80,  speed: 0.5, value: 15, size: 8 },
  heavy_metal:   { color: '#6b7280', label: 'Heavy Metal',   emoji: '⬛', hp: 100, speed: 0.7, value: 20, size: 7 },
};

const TOWER_TYPES: Record<TowerType, {
  label: string; emoji: string; cost: number; range: number; damage: number;
  fireRate: number; color: string; special?: Tower['specialEffect'];
  description: string; strongVs: string; upgradeCost: number;
}> = {
  oyster_bed: {
    label: 'Oyster Bed', emoji: '🐚', cost: 25, range: 70, damage: 8,
    fireRate: 30, color: '#a3a3a3', special: 'slow',
    description: 'Filters particles & slows them. Strong vs sediment & nutrients.',
    strongVs: 'sediment, nutrient', upgradeCost: 30,
  },
  mech_filter: {
    label: 'Mech Filter', emoji: '⚙️', cost: 40, range: 85, damage: 15,
    fireRate: 20, color: '#3b82f6', special: 'splash',
    description: 'High damage, splash hits nearby. Strong vs microplastics.',
    strongVs: 'microplastic, oil', upgradeCost: 45,
  },
  resin_trap: {
    label: 'Resin Trap', emoji: '🧲', cost: 50, range: 60, damage: 5,
    fireRate: 10, color: '#f59e0b', special: 'dot',
    description: 'Fast fire, applies damage over time. Strong vs heavy metals.',
    strongVs: 'heavy_metal, oil', upgradeCost: 50,
  },
  uv_station: {
    label: 'UV Station', emoji: '☀️', cost: 60, range: 100, damage: 20,
    fireRate: 45, color: '#a855f7', special: 'pierce',
    description: 'Long range, shots pierce through multiple targets. Strong vs bacteria.',
    strongVs: 'bacteria, nutrient', upgradeCost: 55,
  },
};

// Bonus damage multipliers
const BONUS: Partial<Record<TowerType, Partial<Record<PollutantType, number>>>> = {
  oyster_bed:  { sediment: 2.0, nutrient: 1.8 },
  mech_filter: { microplastic: 2.0, oil: 1.5 },
  resin_trap:  { heavy_metal: 2.5, oil: 1.8 },
  uv_station:  { bacteria: 2.5, nutrient: 1.5 },
};

const WAVES: WaveConfig[][] = [
  // Level 1: Calm Creek
  [
    { enemies: [{ type: 'sediment', count: 8, delay: 30 }], label: 'Muddy Runoff' },
    { enemies: [{ type: 'sediment', count: 10, delay: 25 }, { type: 'nutrient', count: 4, delay: 35 }], label: 'Fertilizer Wash' },
    { enemies: [{ type: 'sediment', count: 12, delay: 20 }, { type: 'nutrient', count: 8, delay: 25 }], label: 'Spring Rain' },
  ],
  // Level 2: Urban Storm
  [
    { enemies: [{ type: 'sediment', count: 10, delay: 25 }, { type: 'bacteria', count: 6, delay: 20 }], label: 'Parking Lot Wash' },
    { enemies: [{ type: 'nutrient', count: 8, delay: 22 }, { type: 'microplastic', count: 5, delay: 30 }], label: 'Plastic Tide' },
    { enemies: [{ type: 'sediment', count: 8, delay: 20 }, { type: 'bacteria', count: 8, delay: 18 }, { type: 'microplastic', count: 6, delay: 25 }], label: 'Combined Overflow' },
    { enemies: [{ type: 'nutrient', count: 12, delay: 15 }, { type: 'bacteria', count: 10, delay: 15 }], label: 'Algae Alert' },
  ],
  // Level 3: Industrial Zone
  [
    { enemies: [{ type: 'oil', count: 5, delay: 35 }, { type: 'heavy_metal', count: 3, delay: 40 }], label: 'Factory Discharge' },
    { enemies: [{ type: 'microplastic', count: 10, delay: 18 }, { type: 'oil', count: 6, delay: 25 }], label: 'Microplastic Flood' },
    { enemies: [{ type: 'heavy_metal', count: 6, delay: 30 }, { type: 'bacteria', count: 10, delay: 15 }, { type: 'sediment', count: 8, delay: 20 }], label: 'Toxic Mix' },
    { enemies: [{ type: 'oil', count: 8, delay: 20 }, { type: 'heavy_metal', count: 8, delay: 22 }, { type: 'microplastic', count: 8, delay: 18 }], label: 'Industrial Storm' },
    { enemies: [{ type: 'heavy_metal', count: 12, delay: 15 }, { type: 'oil', count: 10, delay: 15 }, { type: 'bacteria', count: 12, delay: 12 }], label: 'BOSS: Pollution Surge' },
  ],
];

const LEVEL_NAMES = ['Calm Creek', 'Urban Storm', 'Industrial Zone'];
const STARTING_COINS = [100, 120, 150];
const STARTING_LIVES = [20, 15, 12];

const FACTS = [
  "Oyster beds slow water flow, giving natural filtration more time to work!",
  "Mechanical filters in PEARL systems remove 88-95% of suspended solids.",
  "Ion exchange resins can trap dissolved heavy metals that filters miss.",
  "UV light destroys bacteria DNA — it's used in water treatment plants worldwide.",
  "A single rainstorm can wash thousands of pounds of pollutants into waterways.",
  "MS4 permits require cities to treat stormwater before it reaches natural waters.",
  "Microplastics are found in 94% of US tap water samples.",
  "Combined sewer overflows mix raw sewage with stormwater during heavy rain.",
  "PEARL stands for Proactive Engineering for Aquatic Rehabilitation & Legacy.",
  "Heavy metals like lead and mercury bioaccumulate — small fish absorb them, bigger fish eat small fish.",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function isOnPath(x: number, y: number, margin = 22): boolean {
  for (const path of PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (len * len)));
      const px = a.x + t * dx, py = a.y + t * dy;
      if (dist(x, y, px, py) < margin) return true;
    }
  }
  return false;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WaterTowerDefense() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const towersRef = useRef<Tower[]>([]);
  const pollutantsRef = useRef<Pollutant[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const frameRef = useRef<number>(0);
  const tickRef = useRef(0);
  const spawnQueueRef = useRef<Array<{ type: PollutantType; spawnAt: number }>>([]);
  const nextIdRef = useRef({ tower: 0, pollutant: 0, projectile: 0 });

  const [game, setGame] = useState<GameState>({
    phase: 'menu', coins: 100, lives: 20, maxLives: 20,
    wave: 0, score: 0, totalKills: 0,
    selectedTower: null, selectedPlaced: null, level: 0,
  });
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [fact, setFact] = useState(() => FACTS[Math.floor(Math.random() * FACTS.length)]);

  const gameRef = useRef(game);
  gameRef.current = game;

  const waves = useMemo(() => WAVES[Math.min(game.level, WAVES.length - 1)], [game.level]);

  // ── Canvas coordinate helper ──
  const canvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height),
    };
  }, []);

  // ── Start game ──
  const startGame = useCallback((level = 0) => {
    towersRef.current = [];
    pollutantsRef.current = [];
    projectilesRef.current = [];
    spawnQueueRef.current = [];
    nextIdRef.current = { tower: 0, pollutant: 0, projectile: 0 };
    tickRef.current = 0;
    setGame({
      phase: 'building', coins: STARTING_COINS[level] || 100,
      lives: STARTING_LIVES[level] || 20, maxLives: STARTING_LIVES[level] || 20,
      wave: 0, score: 0, totalKills: 0,
      selectedTower: 'oyster_bed', selectedPlaced: null, level,
    });
    setFact(FACTS[Math.floor(Math.random() * FACTS.length)]);
  }, []);

  // ── Start wave ──
  const startWave = useCallback(() => {
    const g = gameRef.current;
    const waveCfg = waves[g.wave];
    if (!waveCfg) return;

    const queue: Array<{ type: PollutantType; spawnAt: number }> = [];
    let tick = 30; // small initial delay
    for (const group of waveCfg.enemies) {
      for (let i = 0; i < group.count; i++) {
        queue.push({ type: group.type, spawnAt: tick });
        tick += group.delay;
      }
    }
    spawnQueueRef.current = queue;
    setGame(prev => ({ ...prev, phase: 'wave', selectedPlaced: null }));
  }, [waves]);

  // ── Place tower ──
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const g = gameRef.current;
    const { x, y } = canvasCoords(e);

    // Check if clicking an existing tower for info
    for (const t of towersRef.current) {
      if (dist(x, y, t.x, t.y) < 18) {
        setGame(prev => ({ ...prev, selectedPlaced: t.id, selectedTower: null }));
        return;
      }
    }

    // Place new tower
    if (!g.selectedTower) {
      setGame(prev => ({ ...prev, selectedPlaced: null }));
      return;
    }
    if (g.phase !== 'building' && g.phase !== 'wave') return;

    const cfg = TOWER_TYPES[g.selectedTower];
    if (g.coins < cfg.cost) return;
    if (isOnPath(x, y)) return;
    if (x < 15 || x > W - 15 || y < 15 || y > H - 15) return;

    // Don't stack towers
    for (const t of towersRef.current) {
      if (dist(x, y, t.x, t.y) < 30) return;
    }

    const tower: Tower = {
      id: nextIdRef.current.tower++,
      type: g.selectedTower,
      x, y,
      range: cfg.range,
      damage: cfg.damage,
      fireRate: cfg.fireRate,
      lastFired: -999,
      level: 1,
      kills: 0,
      specialEffect: cfg.special,
      targetId: null,
      angle: 0,
    };
    towersRef.current.push(tower);
    setGame(prev => ({ ...prev, coins: prev.coins - cfg.cost, selectedPlaced: tower.id }));
  }, [canvasCoords]);

  // ── Upgrade tower ──
  const upgradeTower = useCallback((towerId: number) => {
    const g = gameRef.current;
    const tower = towersRef.current.find(t => t.id === towerId);
    if (!tower || tower.level >= 3) return;
    const cfg = TOWER_TYPES[tower.type];
    const cost = cfg.upgradeCost * tower.level;
    if (g.coins < cost) return;

    tower.level++;
    tower.damage = Math.round(cfg.damage * (1 + tower.level * 0.4));
    tower.range = cfg.range + tower.level * 10;
    tower.fireRate = Math.max(5, cfg.fireRate - tower.level * 3);
    setGame(prev => ({ ...prev, coins: prev.coins - cost }));
  }, []);

  // ── Sell tower ──
  const sellTower = useCallback((towerId: number) => {
    const idx = towersRef.current.findIndex(t => t.id === towerId);
    if (idx < 0) return;
    const tower = towersRef.current[idx];
    const cfg = TOWER_TYPES[tower.type];
    const refund = Math.round(cfg.cost * 0.6);
    towersRef.current.splice(idx, 1);
    setGame(prev => ({ ...prev, coins: prev.coins + refund, selectedPlaced: null }));
  }, []);

  // ── Mouse move for placement preview ──
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setHoverPos(canvasCoords(e));
  }, [canvasCoords]);

  // ── Game Loop ──
  useEffect(() => {
    const g = gameRef.current;
    if (g.phase !== 'wave' && g.phase !== 'building' && g.phase !== 'waveComplete') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let lastTime = performance.now();
    let accum = 0;

    function update() {
      const g = gameRef.current;
      if (g.phase !== 'wave') return;
      tickRef.current++;

      // Spawn from queue
      const queue = spawnQueueRef.current;
      while (queue.length > 0 && queue[0].spawnAt <= tickRef.current) {
        const { type } = queue.shift()!;
        const cfg = POLLUTANT_TYPES[type];
        const path = PATHS[0];
        const waveNum = g.wave;
        const hpMult = 1 + waveNum * 0.15 + g.level * 0.3;
        pollutantsRef.current.push({
          id: nextIdRef.current.pollutant++,
          type, x: path[0].x, y: path[0].y,
          hp: Math.round(cfg.hp * hpMult), maxHp: Math.round(cfg.hp * hpMult),
          speed: cfg.speed * (0.9 + Math.random() * 0.2),
          pathIndex: 0, pathProgress: 0,
          slowed: 0, size: cfg.size, value: cfg.value,
          escaped: false, dead: false, deathAnim: 0,
        });
      }

      // Move pollutants
      const path = PATHS[0];
      for (const p of pollutantsRef.current) {
        if (p.dead || p.escaped) continue;
        if (p.slowed > 0) p.slowed--;

        const spd = p.speed * (p.slowed > 0 ? 0.5 : 1.0);
        const segIdx = p.pathIndex;
        if (segIdx >= path.length - 1) { p.escaped = true; continue; }

        const a = path[segIdx], b = path[segIdx + 1];
        const segLen = dist(a.x, a.y, b.x, b.y);
        p.pathProgress += spd / segLen;

        if (p.pathProgress >= 1) {
          p.pathProgress = 0;
          p.pathIndex++;
          if (p.pathIndex >= path.length - 1) { p.escaped = true; continue; }
        }

        const seg = p.pathIndex;
        const sa = path[seg], sb = path[seg + 1];
        p.x = lerp(sa.x, sb.x, p.pathProgress);
        p.y = lerp(sa.y, sb.y, p.pathProgress);
      }

      // Tower targeting + firing
      for (const t of towersRef.current) {
        // Find target: closest to end of path within range
        let bestTarget: Pollutant | null = null;
        let bestProgress = -1;

        for (const p of pollutantsRef.current) {
          if (p.dead || p.escaped) continue;
          if (dist(t.x, t.y, p.x, p.y) > t.range) continue;
          const progress = p.pathIndex + p.pathProgress;
          if (progress > bestProgress) {
            bestProgress = progress;
            bestTarget = p;
          }
        }

        t.targetId = bestTarget?.id ?? null;
        if (bestTarget) {
          t.angle = Math.atan2(bestTarget.y - t.y, bestTarget.x - t.x);
        }

        if (bestTarget && tickRef.current - t.lastFired >= t.fireRate) {
          t.lastFired = tickRef.current;
          projectilesRef.current.push({
            id: nextIdRef.current.projectile++,
            x: t.x, y: t.y,
            targetId: bestTarget.id,
            speed: 4,
            damage: t.damage,
            towerType: t.type,
            special: t.specialEffect,
          });
        }
      }

      // Move projectiles
      let scoreGain = 0;
      let coinsGain = 0;
      let killsGain = 0;

      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const proj = projectilesRef.current[i];
        const target = pollutantsRef.current.find(p => p.id === proj.targetId);

        if (!target || target.dead || target.escaped) {
          projectilesRef.current.splice(i, 1);
          continue;
        }

        const dx = target.x - proj.x;
        const dy = target.y - proj.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d < 8) {
          // Hit!
          const bonus = BONUS[proj.towerType]?.[target.type] ?? 1;
          const dmg = Math.round(proj.damage * bonus);
          target.hp -= dmg;

          // Special effects
          if (proj.special === 'slow') target.slowed = 90;
          if (proj.special === 'dot') target.hp -= 3; // extra tick damage
          if (proj.special === 'splash') {
            for (const p2 of pollutantsRef.current) {
              if (p2.id !== target.id && !p2.dead && dist(target.x, target.y, p2.x, p2.y) < 35) {
                p2.hp -= Math.round(dmg * 0.4);
              }
            }
          }

          if (target.hp <= 0) {
            target.dead = true;
            scoreGain += target.value * 2;
            coinsGain += target.value;
            killsGain++;
            // Credit the tower
            const tower = towersRef.current.find(t => t.targetId === target.id);
            if (tower) tower.kills++;
          }

          projectilesRef.current.splice(i, 1);
        } else {
          proj.x += (dx / d) * proj.speed;
          proj.y += (dy / d) * proj.speed;
        }
      }

      // Handle escapes
      let livesLost = 0;
      for (const p of pollutantsRef.current) {
        if (p.escaped && !p.dead) {
          p.dead = true;
          livesLost++;
        }
      }

      // Animate dead pollutants then remove
      for (let i = pollutantsRef.current.length - 1; i >= 0; i--) {
        if (pollutantsRef.current[i].dead) {
          pollutantsRef.current[i].deathAnim += 0.06;
          if (pollutantsRef.current[i].deathAnim >= 1) {
            pollutantsRef.current.splice(i, 1);
          }
        }
      }

      // Update game state
      if (scoreGain || coinsGain || livesLost || killsGain) {
        setGame(prev => {
          const newLives = prev.lives - livesLost;
          if (newLives <= 0) return { ...prev, lives: 0, phase: 'defeat' };
          return {
            ...prev,
            score: prev.score + scoreGain,
            coins: prev.coins + coinsGain,
            lives: newLives,
            totalKills: prev.totalKills + killsGain,
          };
        });
      }

      // Check wave complete
      if (queue.length === 0 && pollutantsRef.current.every(p => p.dead)) {
        const g2 = gameRef.current;
        if (g2.wave + 1 >= waves.length) {
          setGame(prev => ({ ...prev, phase: 'victory' }));
        } else {
          setGame(prev => ({
            ...prev, phase: 'waveComplete',
            wave: prev.wave + 1, coins: prev.coins + 20, // wave bonus
          }));
          setFact(FACTS[Math.floor(Math.random() * FACTS.length)]);
        }
      }
    }

    function draw() {
      if (!ctx) return;
      const g = gameRef.current;

      // Background
      ctx.fillStyle = '#e8f5e9';
      ctx.fillRect(0, 0, W, H);

      // Grid dots (subtle)
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      for (let gx = 0; gx < GRID_W; gx++) {
        for (let gy = 0; gy < GRID_H; gy++) {
          ctx.fillRect(gx * CELL + CELL / 2 - 0.5, gy * CELL + CELL / 2 - 0.5, 1, 1);
        }
      }

      // Draw path
      const path = PATHS[0];
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = CELL * 0.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();

      // Path water effect
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.lineWidth = CELL * 0.6;
      ctx.setLineDash([8, 12]);
      ctx.lineDashOffset = -tickRef.current * 0.5;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Labels
      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText('⬇️ STORM DRAIN', path[0].x + 60, path[0].y - 22);
      ctx.fillText('🌊 BAY →', path[path.length - 1].x - 40, path[path.length - 1].y - 15);

      // Draw tower ranges for selected/hovered
      for (const t of towersRef.current) {
        if (t.id === g.selectedPlaced) {
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Placement preview
      if (g.selectedTower && hoverPos && (g.phase === 'building' || g.phase === 'wave')) {
        const cfg = TOWER_TYPES[g.selectedTower];
        const onPath = isOnPath(hoverPos.x, hoverPos.y);
        const canAfford = g.coins >= cfg.cost;
        const valid = !onPath && canAfford;

        ctx.beginPath();
        ctx.arc(hoverPos.x, hoverPos.y, cfg.range, 0, Math.PI * 2);
        ctx.fillStyle = valid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)';
        ctx.fill();
        ctx.strokeStyle = valid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.6;
        ctx.fillText(cfg.emoji, hoverPos.x, hoverPos.y + 6);
        ctx.globalAlpha = 1;
      }

      // Draw towers
      for (const t of towersRef.current) {
        const cfg = TOWER_TYPES[t.type];
        const selected = t.id === g.selectedPlaced;

        // Base
        ctx.fillStyle = selected ? '#e2e8f0' : '#f1f5f9';
        ctx.strokeStyle = selected ? '#3b82f6' : '#cbd5e1';
        ctx.lineWidth = selected ? 2 : 1;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 14 + t.level * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Level ring
        if (t.level >= 2) {
          ctx.strokeStyle = t.level >= 3 ? '#f59e0b' : '#a3a3a3';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 17 + t.level * 2, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Emoji
        ctx.font = `${16 + t.level * 2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(cfg.emoji, t.x, t.y + 6 + t.level);

        // Targeting line
        if (t.targetId != null) {
          const target = pollutantsRef.current.find(p => p.id === t.targetId);
          if (target && !target.dead) {
            ctx.strokeStyle = 'rgba(239,68,68,0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(t.x, t.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
          }
        }
      }

      // Draw pollutants
      for (const p of pollutantsRef.current) {
        if (p.dead && !p.escaped) {
          // Death pop
          const s = 1 + p.deathAnim * 2;
          ctx.globalAlpha = 1 - p.deathAnim;
          ctx.fillStyle = POLLUTANT_TYPES[p.type].color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        if (p.dead) continue;

        const ptCfg = POLLUTANT_TYPES[p.type];

        // Slow effect ring
        if (p.slowed > 0) {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Body
        ctx.fillStyle = ptCfg.color;
        ctx.shadowColor = ptCfg.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // HP bar
        if (p.hp < p.maxHp) {
          const bw = p.size * 2.5;
          const bh = 2.5;
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(p.x - bw / 2, p.y - p.size - 6, bw, bh);
          ctx.fillStyle = p.hp > p.maxHp * 0.5 ? '#22c55e' : p.hp > p.maxHp * 0.25 ? '#f59e0b' : '#ef4444';
          ctx.fillRect(p.x - bw / 2, p.y - p.size - 6, bw * (p.hp / p.maxHp), bh);
        }
      }

      // Draw projectiles
      for (const proj of projectilesRef.current) {
        const cfg = TOWER_TYPES[proj.towerType];
        ctx.fillStyle = cfg.color;
        ctx.shadowColor = cfg.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Lives hearts at top-right
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      const lives = gameRef.current.lives;
      const maxLives = gameRef.current.maxLives;
      if (lives <= 5) {
        ctx.fillText('❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 5 - lives)), W - 10, 18);
      } else {
        ctx.fillStyle = lives > maxLives * 0.5 ? '#22c55e' : lives > maxLives * 0.25 ? '#f59e0b' : '#ef4444';
        ctx.font = 'bold 12px system-ui';
        ctx.fillText(`❤️ ${lives}/${maxLives}`, W - 10, 18);
      }
    }

    function loop(now: number) {
      if (!running) return;
      const dt = now - lastTime;
      lastTime = now;
      accum += dt;
      while (accum >= TICK) {
        update();
        accum -= TICK;
      }
      draw();
      frameRef.current = requestAnimationFrame(loop);
    }

    frameRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [game.phase, hoverPos, waves]);

  // ── Tower panel info ──
  const selectedTowerInfo = useMemo(() => {
    if (game.selectedPlaced == null) return null;
    return towersRef.current.find(t => t.id === game.selectedPlaced) ?? null;
  }, [game.selectedPlaced, game.score]); // score as proxy for re-render

  const levelCfg = useMemo(() => ({
    name: LEVEL_NAMES[game.level] || 'Unknown',
    waves: waves.length,
  }), [game.level, waves]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-emerald-50 to-cyan-50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield size={18} className="text-emerald-600" />
            PEARL Tower Defense
          </CardTitle>
          {(game.phase === 'building' || game.phase === 'wave' || game.phase === 'waveComplete') && (
            <div className="flex items-center gap-3 text-xs">
              <Badge variant="secondary" className="font-mono">🪙 {game.coins}</Badge>
              <Badge variant="secondary" className="font-mono">🏆 {game.score}</Badge>
              <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700">
                📡 Wave {game.wave + 1}/{levelCfg.waves}
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          {/* Canvas */}
          <div className="relative flex-1">
            <canvas
              ref={canvasRef} width={W} height={H}
              onClick={handleClick}
              onMouseMove={handleMouseMove}
              className="w-full cursor-crosshair block"
            />

            {/* Menu Overlay */}
            {game.phase === 'menu' && (
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/85 to-cyan-900/90 flex flex-col items-center justify-center text-white">
                <Shield size={48} className="text-emerald-300 mb-3" />
                <h2 className="text-2xl font-bold mb-1">PEARL Tower Defense</h2>
                <p className="text-sm text-emerald-200 mb-4 text-center max-w-md px-4">
                  Build water treatment towers to stop pollutants<br />
                  from reaching the bay!
                </p>
                <div className="bg-white/10 rounded-lg p-3 mb-4 text-xs text-emerald-100 max-w-sm text-center">
                  <span className="font-bold text-white">🧠 Did you know?</span><br />
                  {fact}
                </div>
                <div className="flex flex-col gap-2">
                  {LEVEL_NAMES.map((name, i) => (
                    <Button key={i} onClick={() => startGame(i)}
                      className={`gap-2 ${i === 0 ? 'bg-emerald-500 hover:bg-emerald-600' : i === 1 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'} text-white min-w-[200px]`}>
                      <Play size={14} /> Level {i + 1}: {name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Wave Complete Overlay */}
            {game.phase === 'waveComplete' && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white">
                <h2 className="text-xl font-bold mb-2">✅ Wave {game.wave} Complete!</h2>
                <p className="text-xs text-green-300 mb-1">+20 bonus coins</p>
                <div className="bg-white/10 rounded-lg p-2 mb-3 text-xs text-emerald-100 max-w-sm text-center">
                  🧠 {fact}
                </div>
                <p className="text-xs text-slate-300 mb-3">Place or upgrade towers, then start the next wave.</p>
                <div className="flex gap-2">
                  <Button onClick={() => setGame(prev => ({ ...prev, phase: 'building' }))}
                    className="bg-blue-500 hover:bg-blue-600 text-white gap-1">
                    <Wrench size={14} /> Build Phase
                  </Button>
                  <Button onClick={startWave} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
                    <Zap size={14} /> Send Wave {game.wave + 1}
                  </Button>
                </div>
              </div>
            )}

            {/* Victory */}
            {game.phase === 'victory' && (
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-900/80 to-emerald-900/90 flex flex-col items-center justify-center text-white">
                <Trophy size={48} className="text-yellow-300 mb-3" />
                <h2 className="text-2xl font-bold mb-1">Bay Protected! 🎉</h2>
                <p className="text-sm text-emerald-200 mb-3">{levelCfg.name} complete!</p>
                <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                  <div><div className="text-2xl font-bold font-mono">{game.score}</div><div className="text-[10px] text-emerald-300">Score</div></div>
                  <div><div className="text-2xl font-bold font-mono">{game.totalKills}</div><div className="text-[10px] text-emerald-300">Filtered</div></div>
                  <div><div className="text-2xl font-bold font-mono">{game.lives}/{game.maxLives}</div><div className="text-[10px] text-emerald-300">Lives Left</div></div>
                </div>
                <div className="flex gap-2">
                  {game.level + 1 < LEVEL_NAMES.length && (
                    <Button onClick={() => startGame(game.level + 1)} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
                      <ChevronRight size={14} /> Next: {LEVEL_NAMES[game.level + 1]}
                    </Button>
                  )}
                  <Button onClick={() => setGame(prev => ({ ...prev, phase: 'menu' }))}
                    variant="outline" className="text-white border-white/30 hover:bg-white/10">
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
                <p className="text-sm text-red-200 mb-3">Too many pollutants got through.</p>
                <p className="text-xs text-slate-300 mb-3">💡 Try mixing tower types — each one is strong against different pollutants!</p>
                <div className="flex gap-2">
                  <Button onClick={() => startGame(game.level)} className="bg-red-500 hover:bg-red-600 text-white gap-1">
                    <RotateCcw size={14} /> Retry
                  </Button>
                  <Button onClick={() => setGame(prev => ({ ...prev, phase: 'menu' }))}
                    variant="outline" className="text-white border-white/30 hover:bg-white/10">
                    Menu
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── Tower Shop Panel ── */}
          {(game.phase === 'building' || game.phase === 'wave' || game.phase === 'waveComplete') && (
            <div className="w-full lg:w-[200px] bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 p-3 space-y-3">
              {/* Tower shop */}
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Treatment Towers</div>
                <div className="space-y-1.5">
                  {(Object.entries(TOWER_TYPES) as [TowerType, typeof TOWER_TYPES[TowerType]][]).map(([type, cfg]) => {
                    const selected = game.selectedTower === type;
                    const canAfford = game.coins >= cfg.cost;
                    return (
                      <button key={type}
                        onClick={() => setGame(prev => ({ ...prev, selectedTower: type, selectedPlaced: null }))}
                        disabled={!canAfford}
                        className={`w-full text-left rounded-lg border p-2 transition-all text-xs ${
                          selected
                            ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                            : canAfford
                              ? 'bg-white border-slate-200 hover:border-slate-300'
                              : 'bg-slate-100 border-slate-200 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{cfg.emoji} {cfg.label}</span>
                          <span className="font-mono text-[10px]">🪙{cfg.cost}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          Strong vs {cfg.strongVs}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected tower info */}
              {selectedTowerInfo && (
                <div className="bg-white rounded-lg border border-slate-200 p-2">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Tower Info</div>
                  <div className="text-xs space-y-1">
                    <div className="font-bold">{TOWER_TYPES[selectedTowerInfo.type].emoji} {TOWER_TYPES[selectedTowerInfo.type].label}</div>
                    <div className="flex justify-between"><span className="text-slate-500">Level</span><span className="font-mono">{'⭐'.repeat(selectedTowerInfo.level)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Damage</span><span className="font-mono">{selectedTowerInfo.damage}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Range</span><span className="font-mono">{selectedTowerInfo.range}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Kills</span><span className="font-mono">{selectedTowerInfo.kills}</span></div>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {selectedTowerInfo.level < 3 && (
                      <Button size="sm" className="flex-1 text-[10px] h-7"
                        disabled={game.coins < TOWER_TYPES[selectedTowerInfo.type].upgradeCost * selectedTowerInfo.level}
                        onClick={() => upgradeTower(selectedTowerInfo.id)}>
                        ⬆ Upgrade (🪙{TOWER_TYPES[selectedTowerInfo.type].upgradeCost * selectedTowerInfo.level})
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-[10px] h-7 text-red-600"
                      onClick={() => sellTower(selectedTowerInfo.id)}>
                      Sell (🪙{Math.round(TOWER_TYPES[selectedTowerInfo.type].cost * 0.6)})
                    </Button>
                  </div>
                </div>
              )}

              {/* Start wave button */}
              {game.phase === 'building' && (
                <Button onClick={startWave} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                  <Zap size={14} /> Send Wave {game.wave + 1}
                </Button>
              )}

              {/* Wave info */}
              {game.phase === 'wave' && (
                <div className="text-[10px] text-slate-500 text-center animate-pulse">
                  Wave in progress...
                </div>
              )}

              {/* Pollutant legend */}
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Pollutants</div>
                <div className="space-y-0.5">
                  {waves[game.wave]?.enemies.map((e, i) => {
                    const cfg = POLLUTANT_TYPES[e.type];
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-[10px]">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                        <span>{cfg.label}</span>
                        <span className="text-slate-400">×{e.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
