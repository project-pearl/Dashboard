'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shell, Droplets, Trophy, RotateCcw, Play, Pause, Zap, Heart, Star } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'tss' | 'nutrient' | 'bacteria' | 'microplastic';
  size: number;
  opacity: number;
  captured: boolean;
  capturedBy: number | null;
  fadeOut: number; // 0 = visible, counts up to removal
}

interface Oyster {
  id: number;
  x: number;
  y: number;
  filterRadius: number;
  health: number;       // 100 = max, decreases as it works
  filtering: boolean;
  particlesEaten: number;
  pulsePhase: number;   // for animation
  level: number;        // 1-3, upgrades with experience
}

interface GameState {
  score: number;
  level: number;
  particlesFiltered: number;
  particlesEscaped: number;
  oystersPlaced: number;
  oystersAvailable: number;
  timeRemaining: number;
  waterClarity: number;  // 0-100
  combo: number;
  maxCombo: number;
  gamePhase: 'menu' | 'playing' | 'paused' | 'levelComplete' | 'gameOver';
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CANVAS_W = 720;
const CANVAS_H = 480;
const TICK_MS = 1000 / 60;
const LEVEL_DURATION = 45; // seconds per level

const PARTICLE_TYPES = {
  tss: { color: '#8B6914', label: 'Sediment', emoji: '🟤', points: 10, speed: 1.2 },
  nutrient: { color: '#22c55e', label: 'Nutrient', emoji: '🟢', points: 15, speed: 1.5 },
  bacteria: { color: '#ef4444', label: 'Bacteria', emoji: '🔴', points: 20, speed: 1.8 },
  microplastic: { color: '#8b5cf6', label: 'Microplastic', emoji: '🟣', points: 25, speed: 0.8 },
};

const LEVELS = [
  { name: 'Calm Creek', spawnRate: 40, types: ['tss'] as const, oysters: 5, targetClarity: 60, bgColor: '#dbeafe' },
  { name: 'Busy Bay', spawnRate: 28, types: ['tss', 'nutrient'] as const, oysters: 6, targetClarity: 65, bgColor: '#bfdbfe' },
  { name: 'Storm Surge', spawnRate: 18, types: ['tss', 'nutrient', 'bacteria'] as const, oysters: 7, targetClarity: 70, bgColor: '#93c5fd' },
  { name: 'Pollution Peak', spawnRate: 14, types: ['tss', 'nutrient', 'bacteria', 'microplastic'] as const, oysters: 8, targetClarity: 75, bgColor: '#60a5fa' },
  { name: 'PEARL Challenge', spawnRate: 10, types: ['tss', 'nutrient', 'bacteria', 'microplastic'] as const, oysters: 10, targetClarity: 80, bgColor: '#3b82f6' },
];

const FACTS = [
  "A single adult oyster can filter up to 50 gallons of water per day!",
  "Oysters remove nitrogen and phosphorus — two major pollutants in waterways.",
  "Oyster reefs provide habitat for over 300 species of marine life.",
  "TSS stands for Total Suspended Solids — tiny particles floating in water.",
  "The Chesapeake Bay once had so many oysters they could filter the entire Bay in a week!",
  "PEARL combines mechanical filtration with oyster biofiltration for cleaner water.",
  "Stormwater runoff is the #1 source of pollution in urban waterways.",
  "Oysters are nature's water filters — they eat algae and trap sediment.",
  "A healthy oyster reef can reduce wave energy by up to 76%!",
  "Microplastics are tiny plastic fragments less than 5mm — they're everywhere in our water.",
];

// ─── Component ──────────────────────────────────────────────────────────────

export function OysterFilterRace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const oystersRef = useRef<Oyster[]>([]);
  const frameRef = useRef<number>(0);
  const tickRef = useRef<number>(0);
  const lastSpawnRef = useRef<number>(0);
  const nextIdRef = useRef({ particle: 0, oyster: 0 });

  const [game, setGame] = useState<GameState>({
    score: 0, level: 0, particlesFiltered: 0, particlesEscaped: 0,
    oystersPlaced: 0, oystersAvailable: 5, timeRemaining: LEVEL_DURATION,
    waterClarity: 100, combo: 0, maxCombo: 0, gamePhase: 'menu',
  });

  const [fact, setFact] = useState(() => FACTS[Math.floor(Math.random() * FACTS.length)]);
  const [showPlaceHint, setShowPlaceHint] = useState(true);

  const gameRef = useRef(game);
  gameRef.current = game;

  // ── Spawn a particle ──
  const spawnParticle = useCallback(() => {
    const levelCfg = LEVELS[Math.min(gameRef.current.level, LEVELS.length - 1)];
    const type = levelCfg.types[Math.floor(Math.random() * levelCfg.types.length)];
    const ptCfg = PARTICLE_TYPES[type];

    // Spawn from left or top
    const fromLeft = Math.random() > 0.3;
    const p: Particle = {
      id: nextIdRef.current.particle++,
      x: fromLeft ? -10 : Math.random() * CANVAS_W * 0.8,
      y: fromLeft ? Math.random() * CANVAS_H * 0.6 + 20 : -10,
      vx: (0.5 + Math.random() * 0.8) * ptCfg.speed,
      vy: (0.2 + Math.random() * 0.4) * ptCfg.speed,
      type,
      size: 4 + Math.random() * 6,
      opacity: 0.7 + Math.random() * 0.3,
      captured: false,
      capturedBy: null,
      fadeOut: 0,
    };
    particlesRef.current.push(p);
  }, []);

  // ── Place oyster on click ──
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameRef.current.gamePhase !== 'playing') return;
    if (gameRef.current.oystersAvailable <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Only place in lower 70% of canvas (water area)
    if (y < CANVAS_H * 0.15) return;

    const oyster: Oyster = {
      id: nextIdRef.current.oyster++,
      x, y,
      filterRadius: 45 + Math.random() * 10,
      health: 100,
      filtering: false,
      particlesEaten: 0,
      pulsePhase: Math.random() * Math.PI * 2,
      level: 1,
    };
    oystersRef.current.push(oyster);
    setGame(prev => ({
      ...prev,
      oystersAvailable: prev.oystersAvailable - 1,
      oystersPlaced: prev.oystersPlaced + 1,
    }));
    setShowPlaceHint(false);
  }, []);

  // ── Start / Restart ──
  const startGame = useCallback((level = 0) => {
    particlesRef.current = [];
    oystersRef.current = [];
    nextIdRef.current = { particle: 0, oyster: 0 };
    lastSpawnRef.current = 0;
    tickRef.current = 0;
    const lvl = LEVELS[Math.min(level, LEVELS.length - 1)];
    setGame({
      score: 0, level, particlesFiltered: 0, particlesEscaped: 0,
      oystersPlaced: 0, oystersAvailable: lvl.oysters,
      timeRemaining: LEVEL_DURATION, waterClarity: 100,
      combo: 0, maxCombo: 0, gamePhase: 'playing',
    });
    setShowPlaceHint(true);
    setFact(FACTS[Math.floor(Math.random() * FACTS.length)]);
  }, []);

  const nextLevel = useCallback(() => {
    const newLevel = gameRef.current.level + 1;
    if (newLevel >= LEVELS.length) {
      setGame(prev => ({ ...prev, gamePhase: 'gameOver' }));
      return;
    }
    particlesRef.current = [];
    oystersRef.current = [];
    lastSpawnRef.current = 0;
    tickRef.current = 0;
    const lvl = LEVELS[newLevel];
    setGame(prev => ({
      ...prev,
      level: newLevel,
      oystersAvailable: lvl.oysters,
      oystersPlaced: 0,
      timeRemaining: LEVEL_DURATION,
      waterClarity: 100,
      combo: 0,
      gamePhase: 'playing',
    }));
    setShowPlaceHint(true);
    setFact(FACTS[Math.floor(Math.random() * FACTS.length)]);
  }, []);

  // ── Game Loop ──
  useEffect(() => {
    if (game.gamePhase !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let lastTime = performance.now();
    let accumulator = 0;
    let timerAccum = 0;

    function update() {
      const g = gameRef.current;
      const levelCfg = LEVELS[Math.min(g.level, LEVELS.length - 1)];
      tickRef.current++;

      // Spawn particles
      if (tickRef.current - lastSpawnRef.current >= levelCfg.spawnRate) {
        spawnParticle();
        lastSpawnRef.current = tickRef.current;
      }

      // Update particles
      const particles = particlesRef.current;
      const oysters = oystersRef.current;
      let newFiltered = 0;
      let newEscaped = 0;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (p.captured) {
          p.fadeOut += 0.05;
          if (p.fadeOut >= 1) {
            particles.splice(i, 1);
          }
          continue;
        }

        // Move
        p.x += p.vx;
        p.y += p.vy;
        // Slight drift
        p.vy += 0.01 * Math.sin(tickRef.current * 0.02 + p.id);

        // Check capture by oysters
        for (const o of oysters) {
          if (o.health <= 0) continue;
          const dx = p.x - o.x;
          const dy = p.y - o.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const pulseR = o.filterRadius + Math.sin(o.pulsePhase + tickRef.current * 0.05) * 5;

          if (dist < pulseR) {
            p.captured = true;
            p.capturedBy = o.id;
            o.filtering = true;
            o.particlesEaten++;
            o.health = Math.max(0, o.health - 0.8);
            newFiltered++;

            // Level up oyster
            if (o.particlesEaten >= 15 && o.level < 2) {
              o.level = 2;
              o.filterRadius += 10;
              o.health = Math.min(100, o.health + 20);
            } else if (o.particlesEaten >= 35 && o.level < 3) {
              o.level = 3;
              o.filterRadius += 10;
              o.health = Math.min(100, o.health + 20);
            }
            break;
          }
        }

        // Escaped off screen
        if (!p.captured && (p.x > CANVAS_W + 20 || p.y > CANVAS_H + 20)) {
          particles.splice(i, 1);
          newEscaped++;
        }
      }

      // Update oysters
      for (const o of oysters) {
        o.pulsePhase += 0.03;
        o.filtering = false; // reset each frame
        // Slow health regen when idle
        if (o.health < 100 && o.health > 0) {
          o.health = Math.min(100, o.health + 0.02);
        }
      }

      // Update game state
      if (newFiltered > 0 || newEscaped > 0) {
        setGame(prev => {
          const totalHandled = prev.particlesFiltered + newFiltered + prev.particlesEscaped + newEscaped;
          const clarity = totalHandled > 0
            ? Math.round(((prev.particlesFiltered + newFiltered) / totalHandled) * 100)
            : 100;
          const combo = newFiltered > 0 ? prev.combo + newFiltered : (newEscaped > 0 ? 0 : prev.combo);
          const points = newFiltered * 10 * (1 + Math.floor(combo / 5) * 0.5);
          return {
            ...prev,
            score: prev.score + points,
            particlesFiltered: prev.particlesFiltered + newFiltered,
            particlesEscaped: prev.particlesEscaped + newEscaped,
            waterClarity: clarity,
            combo,
            maxCombo: Math.max(prev.maxCombo, combo),
          };
        });
      }
    }

    function draw() {
      if (!ctx) return;
      const g = gameRef.current;
      const levelCfg = LEVELS[Math.min(g.level, LEVELS.length - 1)];

      // Background — water
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#e0f2fe');
      grad.addColorStop(0.3, levelCfg.bgColor);
      grad.addColorStop(1, '#1e3a5f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Water surface shimmer
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        const baseY = 10 + i * 60;
        for (let x = 0; x < CANVAS_W; x += 4) {
          const y = baseY + Math.sin((x + tickRef.current * 1.5) * 0.02 + i) * 3;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Sandy bottom
      const bottomGrad = ctx.createLinearGradient(0, CANVAS_H - 40, 0, CANVAS_H);
      bottomGrad.addColorStop(0, 'rgba(194,165,108,0.3)');
      bottomGrad.addColorStop(1, 'rgba(194,165,108,0.7)');
      ctx.fillStyle = bottomGrad;
      ctx.fillRect(0, CANVAS_H - 40, CANVAS_W, 40);

      // Draw oysters
      for (const o of oystersRef.current) {
        const pulse = Math.sin(o.pulsePhase + tickRef.current * 0.05) * 5;
        const r = o.filterRadius + pulse;

        // Filter radius circle
        ctx.beginPath();
        ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
        ctx.fillStyle = o.health > 0
          ? `rgba(34, 197, 94, ${0.06 + Math.sin(o.pulsePhase + tickRef.current * 0.03) * 0.03})`
          : 'rgba(156, 163, 175, 0.05)';
        ctx.fill();
        ctx.strokeStyle = o.health > 0
          ? `rgba(34, 197, 94, ${0.2 + Math.sin(o.pulsePhase + tickRef.current * 0.05) * 0.1})`
          : 'rgba(156, 163, 175, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Oyster body
        const oSize = 12 + o.level * 3;
        ctx.save();
        ctx.translate(o.x, o.y);

        // Shell shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.ellipse(2, 2, oSize, oSize * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shell
        ctx.fillStyle = o.health > 50 ? '#a3a3a3' : o.health > 20 ? '#d4d4d4' : '#e5e5e5';
        ctx.beginPath();
        ctx.ellipse(0, 0, oSize, oSize * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = o.health > 50 ? '#737373' : '#a3a3a3';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Shell ridges
        ctx.strokeStyle = o.health > 50 ? 'rgba(82, 82, 82, 0.3)' : 'rgba(163, 163, 163, 0.3)';
        ctx.lineWidth = 0.8;
        for (let r = 0; r < 3; r++) {
          ctx.beginPath();
          ctx.ellipse(0, 0, oSize * (0.35 + r * 0.2), oSize * 0.65 * (0.35 + r * 0.2), 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Level stars
        if (o.level >= 2) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = `${8 + o.level}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('⭐'.repeat(o.level - 1), 0, -oSize - 4);
        }

        // Health bar
        const hbW = oSize * 1.6;
        const hbH = 3;
        const hbX = -hbW / 2;
        const hbY = oSize * 0.65 + 5;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(hbX, hbY, hbW, hbH);
        ctx.fillStyle = o.health > 50 ? '#22c55e' : o.health > 20 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(hbX, hbY, hbW * (o.health / 100), hbH);

        ctx.restore();
      }

      // Draw particles
      for (const p of particlesRef.current) {
        const ptCfg = PARTICLE_TYPES[p.type];
        const alpha = p.captured ? Math.max(0, 1 - p.fadeOut) : p.opacity;

        if (p.captured) {
          // Shrink + fade when captured
          const shrink = 1 - p.fadeOut;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = ptCfg.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * shrink, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Floating particle with glow
          ctx.save();
          ctx.globalAlpha = alpha;

          // Glow
          ctx.shadowColor = ptCfg.color;
          ctx.shadowBlur = 6;
          ctx.fillStyle = ptCfg.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          // Inner highlight
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.beginPath();
          ctx.arc(p.x - p.size * 0.25, p.y - p.size * 0.25, p.size * 0.35, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }

      // Place hint
      if (showPlaceHint && g.oystersAvailable > 0 && oystersRef.current.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('👆 Click to place oysters in the water!', CANVAS_W / 2, CANVAS_H / 2);
        ctx.font = '12px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Oysters will filter pollutants that pass through their zone', CANVAS_W / 2, CANVAS_H / 2 + 22);
      }

      // Combo indicator
      if (g.combo >= 5) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
        ctx.font = `bold ${14 + Math.min(g.combo, 20)}px system-ui`;
        ctx.textAlign = 'right';
        ctx.fillText(`🔥 ${g.combo}× Combo!`, CANVAS_W - 15, 30);
      }
    }

    function loop(now: number) {
      if (!running) return;
      const delta = now - lastTime;
      lastTime = now;
      accumulator += delta;
      timerAccum += delta;

      // Timer countdown
      if (timerAccum >= 1000) {
        timerAccum -= 1000;
        setGame(prev => {
          const newTime = prev.timeRemaining - 1;
          if (newTime <= 0) {
            const levelCfg = LEVELS[Math.min(prev.level, LEVELS.length - 1)];
            const won = prev.waterClarity >= levelCfg.targetClarity;
            return {
              ...prev,
              timeRemaining: 0,
              gamePhase: won ? 'levelComplete' : 'gameOver',
            };
          }
          return { ...prev, timeRemaining: newTime };
        });
      }

      // Fixed timestep updates
      while (accumulator >= TICK_MS) {
        update();
        accumulator -= TICK_MS;
      }

      draw();
      frameRef.current = requestAnimationFrame(loop);
    }

    frameRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [game.gamePhase, spawnParticle, showPlaceHint]);

  // ── Render ──
  const levelCfg = LEVELS[Math.min(game.level, LEVELS.length - 1)];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-cyan-50 to-blue-50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shell size={18} className="text-cyan-600" />
            Oyster Filter Race
          </CardTitle>
          {game.gamePhase === 'playing' && (
            <div className="flex items-center gap-3 text-xs">
              <Badge variant="secondary" className="font-mono">
                🏆 {Math.round(game.score)}
              </Badge>
              <Badge variant="secondary" className="font-mono bg-blue-50 text-blue-700">
                💧 {game.waterClarity}% clear
              </Badge>
              <Badge variant="secondary" className={`font-mono ${game.timeRemaining < 10 ? 'bg-red-50 text-red-700 animate-pulse' : ''}`}>
                ⏱ {game.timeRemaining}s
              </Badge>
              <Badge variant="secondary" className="font-mono bg-green-50 text-green-700">
                🐚 {game.oystersAvailable} left
              </Badge>
            </div>
          )}
        </div>
        {game.gamePhase === 'playing' && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-500 font-medium">Level {game.level + 1}: {levelCfg.name}</span>
            <span className="text-[10px] text-slate-400">·</span>
            <span className="text-[10px] text-slate-500">Target: {levelCfg.targetClarity}% clarity</span>
            <span className="text-[10px] text-slate-400">·</span>
            <div className="flex gap-1">
              {levelCfg.types.map(t => (
                <span key={t} className="text-[10px]" title={PARTICLE_TYPES[t].label}>
                  {PARTICLE_TYPES[t].emoji}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 relative">
        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleCanvasClick}
          className="w-full cursor-crosshair"
          style={{ display: 'block', imageRendering: 'auto' }}
        />

        {/* ── Menu Overlay ── */}
        {game.gamePhase === 'menu' && (
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/80 to-blue-900/90 flex flex-col items-center justify-center text-white">
            <Shell size={48} className="text-cyan-300 mb-3" />
            <h2 className="text-2xl font-bold mb-1">Oyster Filter Race</h2>
            <p className="text-sm text-cyan-200 mb-4 text-center max-w-md px-4">
              Place oysters in the water to filter pollutants!<br />
              Keep water clarity above the target to advance.
            </p>
            <div className="bg-white/10 rounded-lg p-3 mb-4 text-xs text-cyan-100 max-w-sm text-center">
              <span className="font-bold text-white">🧠 Did you know?</span><br />
              {fact}
            </div>
            <Button onClick={() => startGame(0)} size="lg" className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2">
              <Play size={18} /> Start Game
            </Button>
          </div>
        )}

        {/* ── Level Complete Overlay ── */}
        {game.gamePhase === 'levelComplete' && (
          <div className="absolute inset-0 bg-gradient-to-b from-green-900/80 to-emerald-900/90 flex flex-col items-center justify-center text-white">
            <Trophy size={48} className="text-yellow-300 mb-3" />
            <h2 className="text-2xl font-bold mb-1">Level Complete! 🎉</h2>
            <p className="text-sm text-green-200 mb-3">{levelCfg.name} cleared!</p>

            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
              <div>
                <div className="text-2xl font-bold font-mono">{Math.round(game.score)}</div>
                <div className="text-[10px] text-green-300">Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{game.particlesFiltered}</div>
                <div className="text-[10px] text-green-300">Filtered</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{game.waterClarity}%</div>
                <div className="text-[10px] text-green-300">Clarity</div>
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-3 mb-4 text-xs text-green-100 max-w-sm text-center">
              <span className="font-bold text-white">🧠 Fun Fact:</span><br />
              {fact}
            </div>

            {game.level + 1 < LEVELS.length ? (
              <Button onClick={nextLevel} size="lg" className="bg-green-500 hover:bg-green-600 text-white gap-2">
                <Zap size={18} /> Next Level: {LEVELS[game.level + 1].name}
              </Button>
            ) : (
              <div className="text-center">
                <p className="text-lg font-bold text-yellow-300 mb-2">🏆 You beat all levels!</p>
                <Button onClick={() => startGame(0)} size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-white gap-2">
                  <RotateCcw size={18} /> Play Again
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Game Over Overlay ── */}
        {game.gamePhase === 'gameOver' && (
          <div className="absolute inset-0 bg-gradient-to-b from-red-900/80 to-slate-900/90 flex flex-col items-center justify-center text-white">
            <Droplets size={48} className="text-red-300 mb-3" />
            <h2 className="text-2xl font-bold mb-1">Water Too Polluted! 😢</h2>
            <p className="text-sm text-red-200 mb-3">Clarity dropped below {levelCfg.targetClarity}% target</p>

            <div className="grid grid-cols-3 gap-4 mb-4 text-center">
              <div>
                <div className="text-2xl font-bold font-mono">{Math.round(game.score)}</div>
                <div className="text-[10px] text-red-300">Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{game.particlesFiltered}</div>
                <div className="text-[10px] text-red-300">Filtered</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{game.maxCombo}×</div>
                <div className="text-[10px] text-red-300">Best Combo</div>
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-3 mb-4 text-xs text-red-100 max-w-sm text-center">
              <span className="font-bold text-white">💡 Tip:</span> Spread your oysters out to cover more area. Place them where the pollutants are flowing!
            </div>

            <div className="flex gap-3">
              <Button onClick={() => startGame(game.level)} size="lg" className="bg-red-500 hover:bg-red-600 text-white gap-2">
                <RotateCcw size={18} /> Retry Level
              </Button>
              {game.level > 0 && (
                <Button onClick={() => startGame(0)} variant="outline" size="lg" className="text-white border-white/30 hover:bg-white/10 gap-2">
                  <RotateCcw size={14} /> Start Over
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Legend ── */}
        {game.gamePhase === 'playing' && (
          <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-1.5 flex gap-3 text-[10px]">
            {levelCfg.types.map(t => (
              <span key={t} className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PARTICLE_TYPES[t].color }} />
                {PARTICLE_TYPES[t].label}
              </span>
            ))}
          </div>
        )}

        {/* Clarity bar */}
        {game.gamePhase === 'playing' && (
          <div className="absolute top-2 left-2 right-2">
            <div className="h-2 bg-black/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  game.waterClarity >= levelCfg.targetClarity ? 'bg-green-400' :
                  game.waterClarity >= levelCfg.targetClarity * 0.8 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${game.waterClarity}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-white/70 mt-0.5 font-mono">
              <span>Water Clarity</span>
              <span>Target: {levelCfg.targetClarity}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
