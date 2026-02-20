'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Static Data ────────────────────────────────────────────────────────────

const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const RARITY_COLORS = ['#aaaaaa', '#4fc3f7', '#ab47bc', '#ff9800', '#ff5252'];
const RARITY_MULT = [1, 1.4, 1.9, 2.6, 3.5];

const FAMILIES = [
  { id: 'crab', base: 'Crab Claw', pre: ['Rusty', 'Sand', 'King', 'Golden', 'Ancient'], type: 'pistol', dmg: 12, rate: 400, speed: 8, spread: 0.05, count: 1, pierce: 0, explode: 0, bounce: 0, chain: 0, color: '#e85d3a', pSize: 6, desc: 'Fires snapping crab claws' },
  { id: 'shrimp', base: 'Shrimp Shooter', pre: ['Tiny', 'Snapping', 'Tiger', 'Mantis', 'Colossal'], type: 'smg', dmg: 5, rate: 120, speed: 10, spread: 0.15, count: 1, pierce: 0, explode: 0, bounce: 0, chain: 0, color: '#ff8a80', pSize: 4, desc: 'Rapid-fire shrimp barrage' },
  { id: 'jelly', base: 'Jellyfish Zapper', pre: ['Baby', 'Bloom', 'Moon', "Lion's Mane", 'Immortal'], type: 'beam', dmg: 8, rate: 80, speed: 12, spread: 0.08, count: 1, pierce: 1, explode: 0, bounce: 0, chain: 0, color: '#ce93d8', pSize: 5, desc: 'Piercing jellyfish stingers' },
  { id: 'star', base: 'Starfish Spinner', pre: ['Flat', 'Spiny', 'Sunflower', 'Crown', 'Void'], type: 'spin', dmg: 10, rate: 350, speed: 6, spread: 0.02, count: 1, pierce: 0, explode: 0, bounce: 2, chain: 0, color: '#fff176', pSize: 7, desc: 'Bouncing starfish projectiles' },
  { id: 'urchin', base: 'Urchin Launcher', pre: ['Baby', 'Spiny', 'Purple', 'Fire', 'Abyssal'], type: 'explosive', dmg: 20, rate: 800, speed: 5, spread: 0.08, count: 1, pierce: 0, explode: 1, bounce: 0, chain: 0, color: '#4a148c', pSize: 8, desc: 'Explosive sea urchin bombs' },
  { id: 'puffer', base: 'Pufferfish Popper', pre: ['Tiny', 'Spiky', 'Banded', 'Toxic', 'Nuclear'], type: 'heavy', dmg: 25, rate: 900, speed: 4, spread: 0.03, count: 1, pierce: 0, explode: 1, bounce: 0, chain: 0, color: '#a5d6a7', pSize: 10, desc: 'Expanding pufferfish projectiles' },
  { id: 'horse', base: 'Seahorse Rifle', pre: ['Dwarf', 'Lined', 'Thorny', 'Leafy', 'Dragon'], type: 'sniper', dmg: 35, rate: 1200, speed: 14, spread: 0.01, count: 1, pierce: 2, explode: 0, bounce: 0, chain: 0, color: '#ffcc80', pSize: 5, desc: 'Precision seahorse rounds' },
  { id: 'coral', base: 'Coral Blaster', pre: ['Soft', 'Brain', 'Staghorn', 'Fire', 'Living'], type: 'shotgun', dmg: 7, rate: 600, speed: 7, spread: 0.35, count: 5, pierce: 0, explode: 0, bounce: 0, chain: 0, color: '#ef9a9a', pSize: 4, desc: 'Coral fragment shotgun spread' },
  { id: 'barnacle', base: 'Barnacle Blitz', pre: ['Acorn', 'Goose', 'Stalked', 'Titan', 'Eternal'], type: 'minigun', dmg: 4, rate: 70, speed: 9, spread: 0.2, count: 1, pierce: 0, explode: 0, bounce: 0, chain: 0, color: '#b0bec5', pSize: 3, desc: 'Barnacle minigun mayhem' },
  { id: 'clam', base: 'Clam Cannon', pre: ['Littleneck', 'Quahog', 'Geoduck', 'Giant', 'Pearl'], type: 'cannon', dmg: 45, rate: 1500, speed: 6, spread: 0.02, count: 1, pierce: 1, explode: 1, bounce: 0, chain: 0, color: '#e0e0e0', pSize: 12, desc: 'Devastating clam shell blasts' },
  { id: 'lobster', base: 'Lobster Launcher', pre: ['Baby', 'Rock', 'Spiny', 'Hammer', 'Kraken'], type: 'launcher', dmg: 30, rate: 1000, speed: 5, spread: 0.06, count: 1, pierce: 0, explode: 1, bounce: 0, chain: 0, color: '#c62828', pSize: 9, desc: 'Arcing explosive lobsters' },
  { id: 'squid', base: 'Squid Sprayer', pre: ['Baby', 'Reef', 'Humboldt', 'Giant', 'Kraken'], type: 'spray', dmg: 6, rate: 100, speed: 7, spread: 0.3, count: 3, pierce: 0, explode: 0, bounce: 0, chain: 0, color: '#1a237e', pSize: 4, desc: 'Rapid ink spray attack' },
  { id: 'ray', base: 'Stingray Slicer', pre: ['Round', 'Spotted', 'Eagle', 'Manta', 'Phantom'], type: 'disc', dmg: 14, rate: 500, speed: 7, spread: 0.04, count: 1, pierce: 0, explode: 0, bounce: 3, chain: 0, color: '#78909c', pSize: 7, desc: 'Ricocheting stingray discs' },
  { id: 'dolphin', base: 'Dolphin Blaster', pre: ['River', 'Spinner', 'Bottlenose', 'Orca', 'Leviathan'], type: 'wave', dmg: 16, rate: 450, speed: 9, spread: 0.02, count: 1, pierce: 3, explode: 0, bounce: 0, chain: 0, color: '#4dd0e1', pSize: 6, desc: 'Piercing sonic dolphin waves' },
  { id: 'whale', base: 'Whale Buster', pre: ['Minke', 'Gray', 'Humpback', 'Blue', 'Cosmic'], type: 'mega', dmg: 50, rate: 2000, speed: 4, spread: 0.05, count: 1, pierce: 2, explode: 1, bounce: 0, chain: 0, color: '#37474f', pSize: 16, desc: 'Massive whale-force blast' },
  { id: 'anemone', base: 'Anemone Spray', pre: ['Tube', 'Beadlet', 'Carpet', "Hell's Fire", 'Abyssal'], type: 'close', dmg: 9, rate: 150, speed: 5, spread: 0.5, count: 4, pierce: 0, explode: 0, bounce: 0, chain: 0, color: '#f48fb1', pSize: 4, desc: 'Close-range tentacle barrage' },
  { id: 'narwhal', base: 'Narwhal Lance', pre: ['Young', 'Arctic', 'Tusked', 'Ivory', 'Spectral'], type: 'lance', dmg: 40, rate: 1100, speed: 16, spread: 0.0, count: 1, pierce: 4, explode: 0, bounce: 0, chain: 0, color: '#b3e5fc', pSize: 5, desc: 'Ultra-piercing narwhal horn' },
  { id: 'turtle', base: 'Turtle Tosser', pre: ['Hatchling', 'Green', 'Hawksbill', 'Leatherback', 'World'], type: 'shield', dmg: 15, rate: 700, speed: 5, spread: 0.1, count: 1, pierce: 0, explode: 0, bounce: 5, chain: 0, color: '#388e3c', pSize: 8, desc: 'Bouncing turtle shell mayhem' },
  { id: 'mantis', base: 'Mantis Striker', pre: ['Tiny', 'Peacock', 'Smasher', 'Spearer', 'Godlike'], type: 'melee', dmg: 55, rate: 500, speed: 18, spread: 0.02, count: 1, pierce: 0, explode: 0, bounce: 0, chain: 0, color: '#76ff03', pSize: 7, desc: 'Devastating mantis shrimp punch' },
  { id: 'eel', base: 'Electric Eel', pre: ['Spark', 'Volt', 'Storm', 'Thunder', 'Lightning God'], type: 'chain', dmg: 11, rate: 350, speed: 10, spread: 0.05, count: 1, pierce: 0, explode: 0, bounce: 0, chain: 3, color: '#ffee58', pSize: 5, desc: 'Chain lightning between enemies' },
  { id: 'sword', base: 'Swordfish Rifle', pre: ['Juvenile', 'Striped', 'Pacific', 'Atlantic', 'Celestial'], type: 'precision', dmg: 30, rate: 800, speed: 15, spread: 0.0, count: 1, pierce: 3, explode: 0, bounce: 0, chain: 0, color: '#90a4ae', pSize: 5, desc: 'High-velocity swordfish spear' },
];

interface Gun {
  id: string; family: string; name: string; rarity: number; rarityName: string; rarityColor: string;
  dmg: number; rate: number; speed: number; spread: number; count: number; pierce: number;
  explode: number; bounce: number; chain: number; color: string; pSize: number; desc: string; type: string;
}

function generateGuns(): Gun[] {
  const guns: Gun[] = [];
  for (const f of FAMILIES) {
    for (let r = 0; r < 5; r++) {
      const m = RARITY_MULT[r];
      guns.push({
        id: `${f.id}_${r}`, family: f.id,
        name: `${f.pre[r]} ${f.base}`,
        rarity: r, rarityName: RARITIES[r], rarityColor: RARITY_COLORS[r],
        dmg: Math.round(f.dmg * m), rate: Math.max(40, Math.round(f.rate * (1 - r * 0.08))),
        speed: f.speed * (1 + r * 0.1), spread: f.spread * (1 - r * 0.1),
        count: f.count + (f.type === 'shotgun' ? r : 0), pierce: f.pierce + Math.floor(r / 2),
        explode: f.explode, bounce: f.bounce + Math.floor(r * 0.5),
        chain: f.chain + Math.floor(r * 0.8),
        color: f.color, pSize: f.pSize + r, desc: f.desc, type: f.type,
      });
    }
  }
  return guns;
}

const ALL_GUNS = generateGuns();

const QUIPS = [
  "Looks like you've been... filtered out!", "Shell yeah!", "50 gallons a day keeps the pollution away!",
  "That's what I call water treatment!", "You just got reef-wrecked!", "Pearl of wisdom: don't mess with an oyster!",
  "Consider yourself... purified!", "Another one bites the reef!", "Cleaning up the bay, one shot at a time!",
  "Shuck around and find out!", "The bay sends its regards.", "Filter THAT!",
  "I'm on a roll... an oyster roll!", "Living infrastructure at its finest!",
  "That pollution didn't stand a shell's chance!", "Time to get shucked!", "Oyster power, baby!",
  "You're nothing but dirty water under the bridge!", "That's some high-quality filtration right there!",
  "Project PEARL says hello!", "Proactive Engineering at its finest!",
  "Call that a dead zone? I call it target practice!", "Rehabilitated!",
  "Your toxicity levels just hit zero!", "I've filtered worse than you before breakfast!",
  "Back to the treatment plant with you!", "This reef's under new management!",
  "Clean water? You're welcome.", "Someone call the EPA — oh wait, that's me!",
  "Ecosystem: RESTORED.", "Biodiversity goes BRRR!", "That's 200% more biodiversity, baby!",
  "You picked the wrong bay, pal!", "Aquatic Rehabilitation? More like Aquatic DEMOLITION!",
  "Legacy? I'll show you a legacy!", "One less pollutant. You're welcome, fishies!",
  "Chesapeake sends its finest!", "Modular water treatment... of DOOM!",
  "Nature's filter, reporting for duty!", "Gone! Like clean water after a chemical spill!",
];

const ENEMY_TYPES = [
  { id: 'dirty', name: 'Dirty Drop', hp: 20, speed: 1.2, size: 14, color: '#8d6e4c', dmg: 5, fp: 5, minWave: 1, explode: 0, spawns: 0, armor: 0, boss: 0 },
  { id: 'toxic', name: 'Toxic Splash', hp: 30, speed: 1.5, size: 16, color: '#4caf50', dmg: 8, fp: 8, minWave: 3, explode: 0, spawns: 0, armor: 0, boss: 0 },
  { id: 'acid', name: 'Acid Drop', hp: 15, speed: 2.5, size: 10, color: '#76ff03', dmg: 10, fp: 7, minWave: 4, explode: 0, spawns: 0, armor: 0, boss: 0 },
  { id: 'oil', name: 'Oil Blob', hp: 80, speed: 0.6, size: 22, color: '#212121', dmg: 12, fp: 15, minWave: 6, explode: 0, spawns: 0, armor: 0, boss: 0 },
  { id: 'sewage', name: 'Sewage Glob', hp: 100, speed: 0.5, size: 26, color: '#4e342e', dmg: 15, fp: 18, minWave: 8, explode: 0, spawns: 0, armor: 0, boss: 0 },
  { id: 'chemical', name: 'Chemical Flask', hp: 40, speed: 1.0, size: 15, color: '#7b1fa2', dmg: 8, fp: 12, minWave: 5, explode: 1, spawns: 0, armor: 0, boss: 0 },
  { id: 'algae', name: 'Algae Bloom', hp: 60, speed: 0.8, size: 20, color: '#1b5e20', dmg: 6, fp: 20, minWave: 10, explode: 0, spawns: 1, armor: 0, boss: 0 },
  { id: 'plastic', name: 'Microplastic', hp: 8, speed: 3.0, size: 6, color: '#90a4ae', dmg: 3, fp: 3, minWave: 7, explode: 0, spawns: 0, armor: 0, boss: 0 },
  { id: 'metal', name: 'Heavy Metal', hp: 150, speed: 0.4, size: 24, color: '#607d8b', dmg: 20, fp: 25, minWave: 12, explode: 0, spawns: 0, armor: 1, boss: 0 },
  { id: 'deadzone', name: 'Dead Zone', hp: 500, speed: 0.3, size: 50, color: '#1a0a0a', dmg: 30, fp: 100, minWave: 10, explode: 0, spawns: 0, armor: 0, boss: 1 },
];

const DEATH_QUIPS = [
  "I'll be back... with a bigger gun.", "Tell the reef... I tried.",
  "Should've brought the Legendary Whale Buster...", "That's not how filtration is supposed to work!",
  "The bay still needs me... *dramatic cough*", "At least I filtered some of them...",
  "Even oysters have bad days!", "Pollution: 1, Oyster: ... we'll get 'em next time.",
  "My shell... cracked... but not my spirit!", "Respawning in 3... 2... 1...",
  "This oyster's not done yet!", "Next time I'm bringing the whole reef!",
  "Was that... microplastic? That's just unfair.", "Note to self: dodge MORE.",
  "50 gallons a day wasn't enough this time...",
];

const GO_FACTS = [
  'Project PEARL uses <strong>living infrastructure</strong> to clean polluted shorelines — each oyster filters <strong>50 gallons of water per day</strong>.',
  'Despite <strong>$20 billion+</strong> spent on Chesapeake Bay restoration, shoreline pollution hotspots remain untreated.',
  'A fully restored oyster reef ecosystem can see <strong>200%+ biodiversity increases</strong>.',
  'PEARL stands for <strong>Proactive Engineering for Aquatic Rehabilitation & Legacy</strong>.',
  'Restored oyster reefs could yield a <strong>150% increase in blue crab harvest</strong>.',
  "PEARL's living infrastructure transforms <strong>toxic dead zones into thriving ecosystems in months</strong>.",
  'Oyster reefs provide 3D habitat structure — a single reef supports over <strong>300 species</strong>.',
  'Seagrass meadows capture carbon <strong>35x faster</strong> than tropical rainforests per unit area.',
  'Project PEARL partners with <strong>NOAA, the EPA, and the Chesapeake Bay Trust</strong>.',
  'Visit <strong>project-pearl.org</strong> to learn how you can support real-world aquatic restoration!',
];

function hexToRGB(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function loadHighScores() {
  try { return JSON.parse(localStorage.getItem('shuck_scores') || '[]'); } catch { return []; }
}
function saveHighScore(entry: any) {
  const scores = loadHighScores();
  scores.push(entry);
  scores.sort((a: any, b: any) => b.wave - a.wave || b.kills - a.kills);
  if (scores.length > 10) scores.length = 10;
  localStorage.setItem('shuck_scores', JSON.stringify(scores));
  return scores;
}
function getGrade(s: any) {
  const sc = s.wave * 100 + s.kills * 2 + s.combo * 10 + Math.round(s.gal * 0.1);
  if (sc >= 5000) return { letter: 'S+', color: '#ff5252' };
  if (sc >= 3000) return { letter: 'S', color: '#ff9800' };
  if (sc >= 2000) return { letter: 'A', color: '#f0b429' };
  if (sc >= 1200) return { letter: 'B', color: '#00ffa3' };
  if (sc >= 600) return { letter: 'C', color: '#4fc3f7' };
  if (sc >= 200) return { letter: 'D', color: '#ab47bc' };
  return { letter: 'F', color: '#ff5252' };
}

// ─── CSS ────────────────────────────────────────────────────────────────────

const GAME_CSS = `
.sd-root{position:fixed;inset:0;z-index:9999;background:#0a0e17;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;cursor:crosshair}
.sd-root canvas{display:block}
.sd-root .ov{position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:100;background:rgba(6,8,14,0.92);backdrop-filter:blur(6px)}
.sd-root .ov.active{display:flex}
.sd-root .ov-inner{text-align:center;max-width:700px;width:92%;max-height:90vh;overflow-y:auto}
.sd-root .title-logo{font-size:52px;font-weight:900;letter-spacing:-2px;background:linear-gradient(135deg,#00ffa3,#00aaff,#ff6b9d);background-size:300% 300%;animation:sd-grad 4s ease infinite;-webkit-background-clip:text;-webkit-text-fill-color:transparent}
@keyframes sd-grad{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.sd-root .title-sub{color:#4a7a9a;font-size:14px;letter-spacing:4px;text-transform:uppercase;margin:4px 0 20px}
.sd-root .title-oyster{font-size:80px;margin:10px 0}
.sd-root .title-desc{color:#7eacc7;font-size:14px;line-height:1.7;max-width:440px;margin:0 auto 24px}
.sd-root .title-desc strong{color:#00ffa3}
.sd-root .btn{display:inline-block;padding:14px 36px;border-radius:30px;border:none;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:1px;font-family:inherit}
.sd-root .btn:active{transform:scale(.96)}
.sd-root .btn-go{background:linear-gradient(135deg,#00ffa3,#00aaff);color:#000;box-shadow:0 4px 25px rgba(0,255,163,.25)}
.sd-root .btn-go:hover{box-shadow:0 6px 35px rgba(0,255,163,.45);transform:translateY(-2px)}
.sd-root .btn-sec{background:rgba(255,255,255,.06);color:#7eacc7;border:1px solid rgba(255,255,255,.1);margin:0 6px}
.sd-root .btn-sec:hover{background:rgba(255,255,255,.1);color:#fff}
.sd-root .sd-exit{position:absolute;top:12px;right:16px;z-index:200;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#7eacc7;font-size:13px;font-weight:600;padding:6px 16px;border-radius:8px;cursor:pointer;transition:all .2s;font-family:inherit}
.sd-root .sd-exit:hover{background:rgba(255,82,82,0.2);border-color:rgba(255,82,82,0.4);color:#ff8a80}
.sd-root #sd-hud{position:absolute;top:0;left:0;right:0;z-index:50;display:none;padding:10px 20px;pointer-events:none;background:linear-gradient(180deg,rgba(6,8,14,.8) 0%,transparent 100%)}
.sd-root #sd-hud.active{display:flex;justify-content:space-between;align-items:flex-start}
.sd-root .hud-sec{display:flex;gap:12px;align-items:center}
.sd-root .hud-box{background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:6px 12px;min-width:70px;text-align:center}
.sd-root .hud-lbl{font-size:9px;color:#3a6a8a;text-transform:uppercase;letter-spacing:1px}
.sd-root .hud-val{font-size:16px;font-weight:700;color:#e0f0ff}
.sd-root .hp-bar{width:180px;height:10px;background:rgba(255,255,255,.06);border-radius:5px;overflow:hidden}
.sd-root .hp-fill{height:100%;background:linear-gradient(90deg,#ff4444,#00ff88);border-radius:5px;transition:width .3s}
.sd-root .gun-info{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:50;display:none;background:rgba(6,8,14,.85);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 20px;pointer-events:none;backdrop-filter:blur(6px);text-align:center}
.sd-root .gun-info.active{display:block}
.sd-root .gun-name{font-size:15px;font-weight:700}
.sd-root .gun-stats{font-size:11px;color:#4a8ab5;margin-top:2px}
.sd-root .gun-rarity-common{color:#aaa}.sd-root .gun-rarity-uncommon{color:#4fc3f7}.sd-root .gun-rarity-rare{color:#ab47bc}
.sd-root .gun-rarity-epic{color:#ff9800}.sd-root .gun-rarity-legendary{color:#ff5252}
.sd-root #sd-quip{position:absolute;z-index:55;display:none;background:rgba(0,0,0,.8);border:1px solid rgba(0,255,163,.3);border-radius:10px;padding:8px 16px;color:#00ffa3;font-size:13px;font-weight:600;font-style:italic;pointer-events:none;white-space:nowrap;animation:sd-quipPop .3s ease}
@keyframes sd-quipPop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
.sd-root #sd-combo{position:absolute;top:50%;right:30px;transform:translateY(-50%);z-index:50;display:none;text-align:right;pointer-events:none}
.sd-root #sd-combo.active{display:block}
.sd-root .combo-num{font-size:36px;font-weight:900;color:#ff6b9d;text-shadow:0 0 20px rgba(255,107,157,.4)}
.sd-root .combo-label{font-size:11px;color:#ff6b9d;text-transform:uppercase;letter-spacing:2px}
.sd-root #sd-wave-announce{position:absolute;top:40%;left:50%;transform:translate(-50%,-50%);z-index:55;display:none;text-align:center;pointer-events:none}
.sd-root #sd-wave-announce.active{display:block;animation:sd-waveAnn .8s ease}
@keyframes sd-waveAnn{0%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}30%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:1}}
.sd-root .wa-num{font-size:48px;font-weight:900;color:#00ffa3;text-shadow:0 0 30px rgba(0,255,163,.3)}
.sd-root .wa-sub{font-size:14px;color:#4a8ab5;margin-top:4px}
.sd-root .shop-title{font-size:32px;font-weight:800;color:#00ffa3;margin-bottom:4px}
.sd-root .shop-sub{font-size:13px;color:#4a8ab5;margin-bottom:16px}
.sd-root .shop-fp{font-size:18px;color:#f0b429;font-weight:700;margin-bottom:16px}
.sd-root .shop-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:20px;text-align:left}
.sd-root .shop-item{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px;cursor:pointer;transition:all .2s}
.sd-root .shop-item:hover{background:rgba(0,255,163,.05);border-color:rgba(0,255,163,.2);transform:translateY(-2px)}
.sd-root .shop-item.owned{opacity:.3;cursor:default}
.sd-root .shop-item-name{font-size:13px;font-weight:700}
.sd-root .shop-item-stats{font-size:10px;color:#4a8ab5;margin-top:4px}
.sd-root .shop-item-cost{font-size:12px;color:#f0b429;font-weight:700;margin-top:6px}
.sd-root .arsenal-title{font-size:28px;font-weight:800;color:#00ffa3;margin-bottom:16px}
.sd-root .arsenal-count{font-size:13px;color:#4a8ab5;margin-bottom:16px}
.sd-root .arsenal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:20px;text-align:left;max-height:55vh;overflow-y:auto;padding-right:8px}
.sd-root .arsenal-gun{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:8px;padding:10px;font-size:12px;cursor:pointer;transition:all .15s}
.sd-root .arsenal-gun:hover{background:rgba(0,255,163,.04);border-color:rgba(0,255,163,.15)}
.sd-root .arsenal-gun.equipped{border-color:#00ffa3;background:rgba(0,255,163,.08)}
.sd-root .arsenal-gun.locked{opacity:.2;cursor:default}
.sd-root .a-name{font-weight:700;font-size:11px}.sd-root .a-stats{color:#4a8ab5;font-size:10px;margin-top:3px}
@keyframes sd-deathSpin{0%{transform:scale(1) rotate(0deg);opacity:1}60%{transform:scale(1.3) rotate(180deg);opacity:1}100%{transform:scale(0) rotate(360deg);opacity:0}}
@keyframes sd-goSlideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes sd-goPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
@keyframes sd-goGlitch{0%,100%{text-shadow:0 0 20px rgba(255,82,82,.3)}25%{text-shadow:-3px 0 20px rgba(255,0,0,.5),3px 0 20px rgba(0,100,255,.5)}50%{text-shadow:3px 0 20px rgba(255,0,0,.5),-3px 0 20px rgba(0,100,255,.5)}75%{text-shadow:0 -2px 20px rgba(255,82,82,.5)}}
.sd-root .go-title{font-size:44px;font-weight:900;color:#ff5252;margin-bottom:6px;animation:sd-goGlitch 2s ease infinite;letter-spacing:-1px}
.sd-root .go-stats-grid{display:inline-grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;max-width:480px}
.sd-root .go-stat-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px 10px;animation:sd-goSlideUp .5s ease both}
.sd-root .go-stat-card:nth-child(1){animation-delay:.1s}.sd-root .go-stat-card:nth-child(2){animation-delay:.2s}
.sd-root .go-stat-card:nth-child(3){animation-delay:.3s}.sd-root .go-stat-card:nth-child(4){animation-delay:.4s}
.sd-root .go-stat-card:nth-child(5){animation-delay:.5s}.sd-root .go-stat-card:nth-child(6){animation-delay:.6s}
.sd-root .go-stat-icon{font-size:20px;margin-bottom:4px}
.sd-root .go-stat-val{font-size:22px;font-weight:800;color:#e0f0ff}
.sd-root .go-stat-lbl{font-size:9px;color:#4a8ab5;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.sd-root .go-leaderboard-panel{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:0;margin-bottom:24px;display:inline-block;min-width:520px;max-width:95vw;overflow:hidden}
.sd-root .go-lb-header{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 20px;font-size:14px;font-weight:800;color:#f0b429;letter-spacing:2px;text-transform:uppercase;background:rgba(240,180,41,.05);border-bottom:1px solid rgba(255,255,255,.05)}
.sd-root .go-new-hs{padding:8px;font-size:12px;font-weight:800;color:#fff;letter-spacing:2px;background:linear-gradient(90deg,#ff5252,#ff9800,#f0b429);animation:sd-goPulse 1s ease infinite}
.sd-root .go-lb-row{display:flex;align-items:center;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.03);font-size:12px;transition:background .15s}
.sd-root .go-lb-row:last-child{border-bottom:none}
.sd-root .go-lb-row:hover{background:rgba(255,255,255,.02)}
.sd-root .go-lb-row.current{background:rgba(0,255,163,.07);border-left:3px solid #00ffa3}
.sd-root .go-lb-row.go-lb-head{font-size:9px;font-weight:700;color:#3a5a7a;text-transform:uppercase;letter-spacing:1px;padding:8px 16px;background:rgba(0,0,0,.15);border-bottom:1px solid rgba(255,255,255,.05)}
.sd-root .go-lb-row.go-lb-head:hover{background:rgba(0,0,0,.15)}
.sd-root .go-lb-rank{width:32px;font-weight:800;text-align:center;flex-shrink:0}
.sd-root .go-lb-rank.gold{color:#f0b429;font-size:15px}
.sd-root .go-lb-rank.silver{color:#b0bec5;font-size:14px}
.sd-root .go-lb-rank.bronze{color:#bf8040;font-size:13px}
.sd-root .go-lb-col-wave{flex:1;color:#00ffa3;font-weight:700}
.sd-root .go-lb-col-kills{flex:1;color:#e0f0ff}
.sd-root .go-lb-col-combo{flex:0.7;color:#ff6b9d}
.sd-root .go-lb-col-gal{flex:1;color:#4fc3f7}
.sd-root .go-lb-col-time{flex:0.7;color:#7eacc7}
.sd-root .go-lb-col-rating{flex:0.5;font-weight:800;text-align:right}
`;

// ─── Component ──────────────────────────────────────────────────────────────

export function ShuckAndDestroy() {
  const [active, setActive] = useState(false);

  if (!active) {
    return (
      <div
        onClick={() => setActive(true)}
        className="relative overflow-hidden rounded-2xl border-2 border-slate-200 hover:border-cyan-300 bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-8 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/10 group"
      >
        <div className="flex items-center gap-6">
          <div className="text-6xl">🦪</div>
          <div className="text-left">
            <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-cyan-400 to-pink-400">
              SHUCK &amp; DESTROY
            </div>
            <div className="text-xs text-cyan-400/60 tracking-[4px] uppercase mt-0.5">A Project PEARL Game</div>
            <div className="text-sm text-slate-400 mt-2 leading-relaxed max-w-md">
              You are <span className="text-green-400 font-semibold">Captain Shuck</span> — the world&apos;s most heavily armed oyster.
              105 aquatic weapons. Infinite pollution. One shell to rule them all.
            </div>
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-400/20 to-cyan-400/20 border border-green-400/30 text-green-400 text-xs font-bold tracking-wide group-hover:from-green-400/30 group-hover:to-cyan-400/30 transition-all">
              PLAY NOW
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <ShuckAndDestroyGame onExit={() => setActive(false)} />;
}

// ─── Game ───────────────────────────────────────────────────────────────────

function ShuckAndDestroyGame({ onExit }: { onExit: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const fns = useRef<Record<string, any>>({});

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const ctx = canvas.getContext('2d')!;
    let W = 0, H = 0;
    let destroyed = false;

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }
    resize();

    // ── IDs helper ──
    const $ = (id: string) => root!.querySelector(`#${id}`) as HTMLElement | null;

    // ── Game state ──
    type EnemyInstance = { x: number; y: number; type: typeof ENEMY_TYPES[0]; hp: number; maxHp: number; speed: number; size: number; color: string; dmg: number; flash: number; angle: number };
    type Projectile = { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; explode: number; bounce: number; chain: number; color: string; size: number; gun: Gun; life: number; maxLife: number };
    type Particle = { x: number; y: number; vx: number; vy: number; size: number; color: string; alpha: number; life: number; maxLife: number };
    type Pickup = { x: number; y: number; gun: Gun; life: number; maxLife: number };

    let state = 'title';
    let player = { x: 0, y: 0, hp: 100, maxHp: 100, angle: 0, gun: null as Gun | null, fireCD: 0, invuln: 0, speed: 3.5 };
    let enemies: EnemyInstance[] = [], projectiles: Projectile[] = [], particles: Particle[] = [], pickups: Pickup[] = [];
    let wave = 0, waveTimer = 0, waveActive = false, enemiesToSpawn = 0, spawnTimer = 0;
    let kills = 0, totalKills = 0, fp = 0, gallonsFiltered = 0;
    let combo = 0, comboTimer = 0, bestCombo = 0;
    let shakeX = 0, shakeY = 0, shakeMag = 0;
    let discoveredGuns = new Set<string>();
    let ownedGuns = new Set<string>();
    let quipTimer = 0;
    let keys: Record<string, boolean> = {}, mouse = { x: 0, y: 0, down: false };
    let arsenalFrom = 'title';
    let time = 0, lastT = performance.now();
    let gameStartTime = 0;
    let animFrameId = 0;

    // ── Input handlers ──
    function onKeyDown(e: KeyboardEvent) {
      keys[e.code] = true;
      if (e.code === 'KeyE' && state === 'playing' && !waveActive) openShop();
      if (e.code === 'Escape') {
        if (state === 'shop') closeShop();
        else if (state === 'arsenal') closeArsenal();
      }
    }
    function onKeyUp(e: KeyboardEvent) { keys[e.code] = false; }
    function onMouseMove(e: MouseEvent) { mouse.x = e.clientX; mouse.y = e.clientY; }
    function onMouseDown(e: MouseEvent) { if (e.button === 0) mouse.down = true; }
    function onMouseUp(e: MouseEvent) { if (e.button === 0) mouse.down = false; }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', resize);

    // ── Helpers ──
    function hideAll() {
      root!.querySelectorAll('.ov').forEach(o => o.classList.remove('active'));
      $('sd-hud')?.classList.remove('active');
      $('sd-gun-info')?.classList.remove('active');
      $('sd-combo')?.classList.remove('active');
      $('sd-wave-announce')?.classList.remove('active');
      const q = $('sd-quip');
      if (q) q.style.display = 'none';
    }

    function updateGunInfo() {
      const g = player.gun;
      if (!g) return;
      const nameEl = $('sd-gi-name');
      const statsEl = $('sd-gi-stats');
      if (nameEl) {
        nameEl.textContent = g.name;
        nameEl.className = 'gun-name gun-rarity-' + g.rarityName.toLowerCase();
      }
      if (statsEl) {
        const dps = Math.round(g.dmg * g.count / (g.rate / 1000));
        statsEl.textContent = `DMG ${g.dmg} | DPS ${dps} | ${g.rarityName}`;
      }
    }

    function updateHUD() {
      const hpFill = $('sd-hp-fill');
      if (hpFill) hpFill.style.width = (player.hp / player.maxHp * 100) + '%';
      const w = $('sd-hud-wave'); if (w) w.textContent = String(wave);
      const k = $('sd-hud-kills'); if (k) k.textContent = String(totalKills);
      const f = $('sd-hud-fp'); if (f) f.textContent = String(fp);
      const g = $('sd-hud-gal'); if (g) g.textContent = Math.round(gallonsFiltered) + ' gal';
    }

    function showQuip() {
      const q = QUIPS[Math.floor(Math.random() * QUIPS.length)];
      const el = $('sd-quip');
      if (!el) return;
      el.textContent = q;
      el.style.display = 'block';
      el.style.left = (player.x - q.length * 3.5) + 'px';
      el.style.top = (player.y - 50) + 'px';
      quipTimer = 2000;
    }

    function equipGun(gun: Gun) {
      player.gun = gun;
      ownedGuns.add(gun.id);
      discoveredGuns.add(gun.id);
      updateGunInfo();
    }

    // ── Spawning ──
    function spawnEnemy() {
      const available = ENEMY_TYPES.filter(t => wave >= t.minWave && (!t.boss || wave % 10 === 0));
      if (available.length === 0) return;
      let type;
      if (wave % 10 === 0 && enemiesToSpawn <= 1) {
        type = ENEMY_TYPES.find(t => t.boss) || available[0];
      } else {
        const weights = available.filter(t => !t.boss);
        type = weights[Math.floor(Math.random() * weights.length)] || available[0];
      }
      let ex, ey;
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { ex = Math.random() * W; ey = -30; }
      else if (side === 1) { ex = W + 30; ey = Math.random() * H; }
      else if (side === 2) { ex = Math.random() * W; ey = H + 30; }
      else { ex = -30; ey = Math.random() * H; }
      const hpMult = 1 + wave * 0.15;
      enemies.push({
        x: ex, y: ey, type, hp: type.hp * hpMult, maxHp: type.hp * hpMult,
        speed: type.speed * (1 + wave * 0.01), size: type.size, color: type.color,
        dmg: type.dmg, flash: 0, angle: 0,
      });
    }

    function nextWave() {
      wave++;
      waveActive = true;
      enemiesToSpawn = 8 + wave * 3 + Math.floor(wave * wave * 0.3);
      spawnTimer = 0;
      const wa = $('sd-wave-announce');
      const waNum = $('sd-wa-num');
      const waSub = $('sd-wa-sub');
      if (waNum) waNum.textContent = `Wave ${wave}`;
      const subs = ['Incoming pollution!', 'The bay needs you!', 'Toxins approaching!', 'Clean them up!', 'Filter everything!', 'They just keep coming!', 'For the reef!', 'PEARL power!'];
      if (waSub) waSub.textContent = subs[Math.floor(Math.random() * subs.length)];
      wa?.classList.add('active');
      setTimeout(() => wa?.classList.remove('active'), 2000);
    }

    // ── Combat ──
    function fireGun() {
      const g = player.gun;
      if (!g || player.fireCD > 0) return;
      player.fireCD = g.rate;
      const baseAngle = player.angle;
      for (let i = 0; i < g.count; i++) {
        const spread = (Math.random() - 0.5) * g.spread * 2;
        const a = baseAngle + spread + (g.count > 1 ? (i / (g.count - 1) - 0.5) * g.spread * 3 : 0);
        projectiles.push({
          x: player.x + Math.cos(baseAngle) * 20, y: player.y + Math.sin(baseAngle) * 20,
          vx: Math.cos(a) * g.speed, vy: Math.sin(a) * g.speed,
          dmg: g.dmg, pierce: g.pierce, explode: g.explode, bounce: g.bounce, chain: g.chain,
          color: g.color, size: g.pSize, gun: g, life: 0, maxLife: 2000,
        });
      }
      shakeMag = Math.min(shakeMag + 1.5, 6);
    }

    function damageEnemy(e: EnemyInstance, dmg: number, proj: Projectile | null) {
      e.hp -= dmg;
      e.flash = 100;
      gallonsFiltered += dmg * 0.5;
      for (let i = 0; i < 4; i++) {
        particles.push({
          x: e.x + (Math.random() - .5) * e.size, y: e.y + (Math.random() - .5) * e.size,
          vx: (Math.random() - .5) * 3, vy: (Math.random() - .5) * 3,
          size: 2 + Math.random() * 3, color: e.color, alpha: 1, life: 0, maxLife: 500
        });
      }
      if (e.hp <= 0) {
        killEnemy(e);
        if (proj && proj.chain > 0) {
          let chainLeft = proj.chain;
          let lastX = e.x, lastY = e.y;
          const hit = new Set<EnemyInstance>();
          for (const other of enemies) {
            if (chainLeft <= 0) break;
            if (other.hp <= 0 || hit.has(other)) continue;
            const d = Math.hypot(other.x - lastX, other.y - lastY);
            if (d < 120) {
              hit.add(other);
              damageEnemy(other, Math.round(dmg * 0.7), null);
              for (let i = 0; i < 6; i++) {
                const t = i / 5;
                particles.push({
                  x: lastX + (other.x - lastX) * t + (Math.random() - .5) * 15,
                  y: lastY + (other.y - lastY) * t + (Math.random() - .5) * 15,
                  vx: 0, vy: 0, size: 2, color: '#ffee58', alpha: 1, life: 0, maxLife: 300
                });
              }
              lastX = other.x; lastY = other.y;
              chainLeft--;
            }
          }
        }
      }
    }

    function killEnemy(e: EnemyInstance) {
      kills++; totalKills++;
      fp += e.type.fp;
      combo++; comboTimer = 2000;
      if (combo > bestCombo) bestCombo = combo;
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 3 * (1 + Math.random()), vy: Math.sin(a) * 3 * (1 + Math.random()), size: 3 + Math.random() * 4, color: e.color, alpha: 1, life: 0, maxLife: 800 });
      }
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, size: 2 + Math.random() * 2, color: '#00ffa3', alpha: 0.8, life: 0, maxLife: 600 });
      }
      if (e.type.explode) {
        for (const other of enemies) {
          if (other !== e && other.hp > 0) {
            const d = Math.hypot(other.x - e.x, other.y - e.y);
            if (d < 60) damageEnemy(other, 15, null);
          }
        }
      }
      if (e.type.spawns) {
        for (let i = 0; i < 3; i++) {
          const baby = ENEMY_TYPES[0];
          enemies.push({
            x: e.x + (Math.random() - .5) * 30, y: e.y + (Math.random() - .5) * 30,
            type: baby, hp: baby.hp, maxHp: baby.hp, speed: baby.speed * 1.5,
            size: baby.size * 0.7, color: '#2e7d32', dmg: baby.dmg, flash: 0, angle: 0
          });
        }
      }
      if (Math.random() < 0.15 + combo * 0.02) showQuip();
      if (Math.random() < 0.06 + wave * 0.005) dropGun(e.x, e.y);
      shakeMag = Math.min(shakeMag + 3, 10);
    }

    function dropGun(gx: number, gy: number) {
      const maxRarity = Math.min(4, Math.floor(wave / 4));
      const rarity = Math.min(maxRarity, Math.floor(Math.random() * (maxRarity + 1)));
      const familyIdx = Math.floor(Math.random() * FAMILIES.length);
      const gun = ALL_GUNS[familyIdx * 5 + rarity];
      pickups.push({ x: gx, y: gy, gun, life: 0, maxLife: 15000 });
    }

    // ── Shop ──
    function openShop() {
      state = 'shop';
      $('sd-shop-ov')?.classList.add('active');
      const fpEl = $('sd-shop-fp');
      if (fpEl) fpEl.textContent = String(fp);
      const grid = $('sd-shop-grid');
      if (!grid) return;
      grid.innerHTML = '';
      const maxR = Math.min(4, Math.floor(wave / 3));

      // Health item
      const hpItem = document.createElement('div');
      hpItem.className = 'shop-item';
      hpItem.innerHTML = `<div class="shop-item-name" style="color:#00ff88">❤️ Full Heal</div><div class="shop-item-stats">Restore all HP</div><div class="shop-item-cost">30 FP</div>`;
      hpItem.onclick = () => {
        if (fp >= 30) { fp -= 30; player.hp = player.maxHp; if (fpEl) fpEl.textContent = String(fp); }
      };
      grid.appendChild(hpItem);

      // Max HP item
      const mhpItem = document.createElement('div');
      mhpItem.className = 'shop-item';
      mhpItem.innerHTML = `<div class="shop-item-name" style="color:#ff6b9d">💪 +25 Max HP</div><div class="shop-item-stats">Permanently increase max health</div><div class="shop-item-cost">50 FP</div>`;
      mhpItem.onclick = () => {
        if (fp >= 50) { fp -= 50; player.maxHp += 25; player.hp = Math.min(player.hp + 25, player.maxHp); if (fpEl) fpEl.textContent = String(fp); }
      };
      grid.appendChild(mhpItem);

      // Gun offers
      for (let i = 0; i < 6; i++) {
        const r = Math.min(maxR, Math.floor(Math.random() * (maxR + 1)));
        const fi = Math.floor(Math.random() * FAMILIES.length);
        const gun = ALL_GUNS[fi * 5 + r];
        const cost = Math.round((gun.rarity + 1) * 20 + gun.dmg);
        const owned = ownedGuns.has(gun.id);
        const item = document.createElement('div');
        item.className = 'shop-item' + (owned ? ' owned' : '');
        item.innerHTML = `<div class="shop-item-name" style="color:${gun.rarityColor}">${gun.name}</div>
          <div class="shop-item-stats">DMG ${gun.dmg} | Rate ${gun.rate}ms | ${gun.desc}</div>
          <div class="shop-item-cost">${owned ? 'OWNED' : cost + ' FP'}</div>`;
        if (!owned) {
          item.onclick = () => {
            if (fp >= cost) {
              fp -= cost; equipGun(gun);
              item.classList.add('owned');
              const costEl = item.querySelector('.shop-item-cost');
              if (costEl) costEl.textContent = 'EQUIPPED';
              if (fpEl) fpEl.textContent = String(fp);
            }
          };
        }
        grid.appendChild(item);
      }
    }

    function closeShop() {
      $('sd-shop-ov')?.classList.remove('active');
      state = 'playing';
      nextWave();
    }

    // ── Arsenal ──
    function renderArsenal() {
      hideAll();
      $('sd-arsenal-ov')?.classList.add('active');
      const countEl = $('sd-arsenal-count');
      if (countEl) countEl.textContent = `${discoveredGuns.size} / ${ALL_GUNS.length} Discovered`;
      const grid = $('sd-arsenal-grid');
      if (!grid) return;
      grid.innerHTML = '';
      for (const gun of ALL_GUNS) {
        const disc = discoveredGuns.has(gun.id);
        const owned = ownedGuns.has(gun.id);
        const isEquipped = player.gun && player.gun.id === gun.id;
        const div = document.createElement('div');
        div.className = 'arsenal-gun' + (isEquipped ? ' equipped' : '') + (disc ? '' : ' locked');
        if (disc) {
          const dps = Math.round(gun.dmg * gun.count / (gun.rate / 1000));
          div.innerHTML = `<div class="a-name" style="color:${gun.rarityColor}">${gun.name}</div>
            <div class="a-stats">DMG ${gun.dmg} | DPS ${dps} | ${gun.rarityName}${isEquipped ? ' ✓' : ''}</div>`;
          if (owned && state === 'playing') {
            div.onclick = () => { equipGun(gun); renderArsenal(); };
          }
        } else {
          div.innerHTML = `<div class="a-name" style="color:#2a3a4a">???</div><div class="a-stats">Not yet discovered</div>`;
        }
        grid.appendChild(div);
      }
    }

    function closeArsenal() {
      $('sd-arsenal-ov')?.classList.remove('active');
      if (arsenalFrom === 'shop') $('sd-shop-ov')?.classList.add('active');
      else if (arsenalFrom === 'title') $('sd-title-ov')?.classList.add('active');
      else if (arsenalFrom === 'gameover') $('sd-gameover-ov')?.classList.add('active');
      else if (state === 'playing') {
        $('sd-hud')?.classList.add('active');
        $('sd-gun-info')?.classList.add('active');
      }
    }

    // ── Game lifecycle ──
    function startGame() {
      hideAll();
      state = 'playing';
      player = { x: W / 2, y: H / 2, hp: 100, maxHp: 100, angle: 0, gun: ALL_GUNS[0], fireCD: 0, invuln: 0, speed: 3.5 };
      enemies = []; projectiles = []; particles = []; pickups = [];
      wave = 0; kills = 0; totalKills = 0; fp = 50; gallonsFiltered = 0; combo = 0; bestCombo = 0;
      discoveredGuns = new Set([ALL_GUNS[0].id]);
      ownedGuns = new Set([ALL_GUNS[0].id]);
      gameStartTime = performance.now();
      $('sd-hud')?.classList.add('active');
      $('sd-gun-info')?.classList.add('active');
      updateGunInfo();
      nextWave();
    }

    function showTitle() {
      hideAll();
      state = 'title';
      $('sd-title-ov')?.classList.add('active');
    }

    function gameOver() {
      state = 'gameover';
      $('sd-hud')?.classList.remove('active');
      $('sd-gun-info')?.classList.remove('active');
      $('sd-combo')?.classList.remove('active');
      const q = $('sd-quip'); if (q) q.style.display = 'none';

      const survivalSecs = Math.round((performance.now() - gameStartTime) / 1000);
      const survivalStr = `${Math.floor(survivalSecs / 60)}:${(survivalSecs % 60).toString().padStart(2, '0')}`;
      const entry = { wave, kills: totalKills, combo: bestCombo, gal: Math.round(gallonsFiltered), guns: discoveredGuns.size, time: survivalSecs, date: Date.now() };
      const scores = saveHighScore(entry);
      const isNewBest = scores[0] && scores[0].date === entry.date;

      const goOv = $('sd-gameover-ov');
      const goAnim = $('sd-go-anim');
      const goContent = $('sd-go-content');
      if (goAnim) goAnim.style.display = 'block';
      if (goContent) goContent.style.display = 'none';
      goOv?.classList.add('active');

      setTimeout(() => {
        if (destroyed) return;
        if (goAnim) goAnim.style.display = 'none';
        if (goContent) goContent.style.display = 'block';

        const subtitles = wave <= 2
          ? ['The pollution barely broke a sweat...', 'That was... quick.', 'Captain Shuck, more like Captain Stuck!']
          : wave <= 5
          ? ['A valiant effort, but not enough.', 'The bay still needs more filtration!', 'You gave it a good shot!']
          : wave <= 10
          ? ['Impressive resistance, Captain!', 'The reef remembers your sacrifice.', 'A true warrior of the waves!']
          : ['Legendary run, Captain Shuck!', 'The bay will sing songs of your filtration!', 'An absolute PEARL of a performance!'];
        const sub = $('sd-go-subtitle'); if (sub) sub.textContent = subtitles[Math.floor(Math.random() * subtitles.length)];
        const quip = $('sd-go-quip'); if (quip) quip.textContent = '"' + DEATH_QUIPS[Math.floor(Math.random() * DEATH_QUIPS.length)] + '"';

        const els: Record<string, string> = { 'sd-go-wave': String(wave), 'sd-go-kills': String(totalKills), 'sd-go-combo': String(bestCombo), 'sd-go-gal': Math.round(gallonsFiltered).toLocaleString(), 'sd-go-guns': String(discoveredGuns.size), 'sd-go-time': survivalStr };
        for (const [id, val] of Object.entries(els)) { const el = $(id); if (el) el.textContent = val; }

        if (player.gun) {
          const gn = $('sd-go-gun-name');
          if (gn) { gn.textContent = player.gun.name; gn.style.color = player.gun.rarityColor; }
          const gs = $('sd-go-gun-stats');
          if (gs) {
            const dps = Math.round(player.gun.dmg * player.gun.count / (player.gun.rate / 1000));
            gs.textContent = `DMG ${player.gun.dmg} | DPS ${dps} | ${player.gun.rarityName}`;
          }
        }

        const score = wave * 100 + totalKills * 2 + bestCombo * 10 + Math.round(gallonsFiltered * 0.1);
        let rating: string, ratingColor: string, ratingMsg: string;
        if (score >= 5000) { rating = 'S+'; ratingColor = '#ff5252'; ratingMsg = 'ABSOLUTE LEGEND! The bay is saved!'; }
        else if (score >= 3000) { rating = 'S'; ratingColor = '#ff9800'; ratingMsg = 'Outstanding! Master filtration operative!'; }
        else if (score >= 2000) { rating = 'A'; ratingColor = '#f0b429'; ratingMsg = 'Excellent! The reef is proud of you!'; }
        else if (score >= 1200) { rating = 'B'; ratingColor = '#00ffa3'; ratingMsg = 'Solid run! The ecosystem thanks you.'; }
        else if (score >= 600) { rating = 'C'; ratingColor = '#4fc3f7'; ratingMsg = 'Not bad! Keep filtering, Captain!'; }
        else if (score >= 200) { rating = 'D'; ratingColor = '#ab47bc'; ratingMsg = 'Room for improvement. Try new guns!'; }
        else { rating = 'F'; ratingColor = '#ff5252'; ratingMsg = 'The pollution won this round...'; }
        const rEl = $('sd-go-rating'); if (rEl) { rEl.textContent = rating; rEl.style.color = ratingColor; }
        const rmEl = $('sd-go-rating-msg'); if (rmEl) rmEl.textContent = ratingMsg;

        const factEl = $('sd-go-fact'); if (factEl) factEl.innerHTML = GO_FACTS[Math.floor(Math.random() * GO_FACTS.length)];
        const hsBanner = $('sd-go-highscore-banner'); if (hsBanner) hsBanner.style.display = isNewBest && scores.length > 1 ? 'block' : 'none';

        const lb = $('sd-go-leaderboard');
        const lbEmpty = $('sd-go-lb-empty');
        if (lb) lb.innerHTML = '';
        if (scores.length === 0) { if (lbEmpty) lbEmpty.style.display = 'block'; }
        else {
          if (lbEmpty) lbEmpty.style.display = 'none';
          scores.slice(0, 10).forEach((s: any, i: number) => {
            const isCurrent = s.date === entry.date;
            const row = document.createElement('div');
            row.className = 'go-lb-row' + (isCurrent ? ' current' : '');
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            const medals = ['🥇', '🥈', '🥉'];
            const rankLabel = i < 3 ? medals[i] : String(i + 1);
            const timeStr = s.time ? `${Math.floor(s.time / 60)}:${(s.time % 60).toString().padStart(2, '0')}` : '—';
            const grade = getGrade(s);
            row.innerHTML = `<span class="go-lb-rank ${rankClass}">${rankLabel}</span><span class="go-lb-col-wave">Wave ${s.wave}</span><span class="go-lb-col-kills">${s.kills.toLocaleString()} kills</span><span class="go-lb-col-combo">${(s.combo || 0)}x</span><span class="go-lb-col-gal">${s.gal.toLocaleString()} gal</span><span class="go-lb-col-time">${timeStr}</span><span class="go-lb-col-rating" style="color:${grade.color}">${grade.letter}</span>`;
            lb!.appendChild(row);
          });
        }
      }, 1400);
    }

    // ── Drawing ──
    function drawBG() {
      const grad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W);
      grad.addColorStop(0, '#0f1a2e'); grad.addColorStop(1, '#060a14');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0,170,255,0.04)'; ctx.lineWidth = 1;
      const gridSize = 60;
      const ox = (time * 0.02) % gridSize, oy = (time * 0.015) % gridSize;
      for (let gx = -gridSize + ox; gx < W + gridSize; gx += gridSize) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = -gridSize + oy; gy < H + gridSize; gy += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,170,255,0.06)';
      for (let i = 0; i < 15; i++) {
        const bx = ((i * 197 + time * 0.03 * (i % 3 + 1)) % (W + 40)) - 20;
        const by = H - ((i * 131 + time * 0.05 * (i % 2 + 1)) % (H + 40));
        ctx.beginPath(); ctx.arc(bx, by, 2 + i % 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawPlayer() {
      ctx.save();
      ctx.translate(player.x, player.y);
      if (player.invuln > 0 && Math.floor(player.invuln / 80) % 2 === 0) ctx.globalAlpha = 0.4;
      ctx.rotate(player.angle);
      ctx.beginPath(); ctx.ellipse(-5, 0, 18, 22, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#7a8a6a'; ctx.fill();
      ctx.strokeStyle = '#5a6a4a'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.ellipse(-5, i * 7, 14, 4, 0.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(90,106,74,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#d4c4a8'; ctx.fill();
      ctx.rotate(-player.angle);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(-5, -6, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5, -6, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
      const lookAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
      const px = Math.cos(lookAngle) * 1.5, py = Math.sin(lookAngle) * 1.5;
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(-5 + px, -6 + py, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5 + px, -6 + py, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 2, 5, 0.1, Math.PI - 0.1);
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.rotate(player.angle);
      const g = player.gun;
      if (g) {
        ctx.fillStyle = g.color; ctx.fillRect(10, -3, 16, 6);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(10, -3, 16, 2);
        if (player.fireCD > player.gun!.rate * 0.7) {
          ctx.beginPath(); ctx.arc(28, 0, 5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,200,0.6)'; ctx.fill();
        }
      }
      ctx.restore();
    }

    function drawEnemy(e: EnemyInstance) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.flash > 0) ctx.globalAlpha = 0.5 + Math.sin(e.flash * 0.1) * 0.5;
      const s = e.size;
      ctx.beginPath(); ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.8, -s * 0.3, s, s * 0.3);
      ctx.arc(0, s * 0.3, s, 0, Math.PI);
      ctx.quadraticCurveTo(-s * 0.8, -s * 0.3, 0, -s);
      ctx.closePath(); ctx.fillStyle = e.color; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.save(); ctx.translate(-s * 0.25, -s * 0.1); ctx.rotate(-0.3); ctx.fillRect(-2, -1.5, 5, 3); ctx.restore();
      ctx.save(); ctx.translate(s * 0.25, -s * 0.1); ctx.rotate(0.3); ctx.fillRect(-2, -1.5, 5, 3); ctx.restore();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.35); ctx.lineTo(-s * 0.1, -s * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.45, -s * 0.35); ctx.lineTo(s * 0.1, -s * 0.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, s * 0.2, s * 0.25, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      if (e.hp < e.maxHp) {
        const bw = s * 1.6;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-bw / 2, -s - 8, bw, 4);
        ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#00ff88' : '#ff4444';
        ctx.fillRect(-bw / 2, -s - 8, bw * (e.hp / e.maxHp), 4);
      }
      if (e.type.boss) {
        ctx.fillStyle = '#f0b429';
        ctx.beginPath(); ctx.moveTo(-s * 0.4, -s - 2); ctx.lineTo(-s * 0.2, -s - 12);
        ctx.lineTo(0, -s - 5); ctx.lineTo(s * 0.2, -s - 12); ctx.lineTo(s * 0.4, -s - 2);
        ctx.closePath(); ctx.fill();
      }
      if (e.type.armor) {
        ctx.strokeStyle = 'rgba(150,150,150,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, s + 3, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    function drawProjectile(p: Projectile) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const angle = Math.atan2(p.vy, p.vx);
      ctx.rotate(angle);
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      const g = p.gun;
      if (g && g.type === 'shotgun') {
        ctx.beginPath(); ctx.moveTo(p.size, 0); ctx.lineTo(-p.size / 2, -p.size / 2); ctx.lineTo(-p.size / 2, p.size / 2); ctx.closePath(); ctx.fill();
      } else if (g && g.type === 'beam') {
        ctx.fillRect(-p.size * 2, -1, p.size * 4, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-p.size, -0.5, p.size * 2, 1);
      } else if (g && g.type === 'spin') {
        ctx.rotate(time * 0.01);
        for (let i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); ctx.fillRect(-1, -p.size, 2, p.size); }
      } else if (g && (g.type === 'explosive' || g.type === 'launcher')) {
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = p.color; ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * p.size * 1.5, Math.sin(a) * p.size * 1.5); ctx.stroke(); }
      } else if (g && g.type === 'chain') {
        ctx.fillStyle = '#ffee58';
        ctx.beginPath(); ctx.moveTo(p.size, 0); ctx.lineTo(0, -3); ctx.lineTo(2, 0); ctx.lineTo(-p.size, 0); ctx.lineTo(0, 3); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill();
      } else if (g && g.type === 'disc') {
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      } else if (g && (g.type === 'mega' || g.type === 'cannon')) {
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(-p.size * 0.2, -p.size * 0.2, p.size * 0.4, 0, Math.PI * 2); ctx.fill();
      } else if (g && g.type === 'shield') {
        ctx.rotate(time * 0.015);
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      particles.push({
        x: p.x, y: p.y, vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5,
        size: p.size * 0.4, color: p.color, alpha: 0.3, life: 0, maxLife: 200
      });
    }

    function drawPickup(pk: Pickup) {
      ctx.save();
      ctx.translate(pk.x, pk.y);
      const bob = Math.sin(time * 0.005 + pk.x) * 4;
      ctx.beginPath(); ctx.arc(0, bob, 18, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${hexToRGB(pk.gun.rarityColor)},0.15)`; ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-14, bob - 10, 28, 20);
      ctx.strokeStyle = pk.gun.rarityColor; ctx.lineWidth = 2; ctx.strokeRect(-14, bob - 10, 28, 20);
      ctx.fillStyle = pk.gun.rarityColor; ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, bob);
      ctx.restore();
    }

    function drawParticles2() {
      for (const p of particles) {
        ctx.fillStyle = typeof p.color === 'string' && p.color.startsWith('#')
          ? `rgba(${hexToRGB(p.color)},${p.alpha})` : `rgba(200,200,200,${p.alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Main Loop ──
    function update(now: number) {
      if (destroyed) return;
      animFrameId = requestAnimationFrame(update);
      const dt = Math.min(now - lastT, 50);
      lastT = now; time += dt;

      if (state !== 'playing') {
        ctx.clearRect(0, 0, W, H); drawBG(); return;
      }

      let mx = 0, my = 0;
      if (keys.KeyW || keys.ArrowUp) my = -1;
      if (keys.KeyS || keys.ArrowDown) my = 1;
      if (keys.KeyA || keys.ArrowLeft) mx = -1;
      if (keys.KeyD || keys.ArrowRight) mx = 1;
      if (mx || my) {
        const len = Math.hypot(mx, my);
        player.x += mx / len * player.speed * (dt * 0.06);
        player.y += my / len * player.speed * (dt * 0.06);
      }
      player.x = Math.max(20, Math.min(W - 20, player.x));
      player.y = Math.max(20, Math.min(H - 20, player.y));
      player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
      player.fireCD = Math.max(0, player.fireCD - dt);
      if (mouse.down) fireGun();
      player.invuln = Math.max(0, player.invuln - dt);

      if (waveActive && enemiesToSpawn > 0) {
        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawnTimer = Math.max(100, 600 - wave * 15); spawnEnemy(); enemiesToSpawn--; }
      }
      if (waveActive && enemiesToSpawn <= 0 && enemies.length === 0) { waveActive = false; waveTimer = 2000; }
      if (!waveActive && waveTimer > 0) { waveTimer -= dt; if (waveTimer <= 0) openShop(); }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.hp <= 0) { enemies.splice(i, 1); continue; }
        const dx = player.x - e.x, dy = player.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) { e.x += dx / dist * e.speed * (dt * 0.06); e.y += dy / dist * e.speed * (dt * 0.06); }
        e.angle = Math.atan2(dy, dx); e.flash = Math.max(0, e.flash - dt);
        if (dist < e.size + 15 && player.invuln <= 0) {
          player.hp -= e.dmg; player.invuln = 800; shakeMag = Math.min(shakeMag + 5, 12); combo = 0;
          player.x -= dx / dist * 20; player.y -= dy / dist * 20;
          if (player.hp <= 0) gameOver();
        }
      }

      for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx * (dt * 0.06); p.y += p.vy * (dt * 0.06); p.life += dt;
        if (p.bounce > 0) {
          if (p.x < 0 || p.x > W) { p.vx *= -1; p.bounce--; }
          if (p.y < 0 || p.y > H) { p.vy *= -1; p.bounce--; }
        }
        if (p.life > p.maxLife || (p.bounce <= 0 && (p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50))) {
          projectiles.splice(i, 1); continue;
        }
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(p.x - e.x, p.y - e.y);
          if (d < e.size + p.size) {
            let dmg = p.dmg;
            if (e.type.armor) dmg = Math.round(dmg * 0.6);
            damageEnemy(e, dmg, p);
            if (p.explode) {
              for (const other of enemies) {
                if (other !== e && other.hp > 0) {
                  const d2 = Math.hypot(other.x - p.x, other.y - p.y);
                  if (d2 < 50) damageEnemy(other, Math.round(p.dmg * 0.5), null);
                }
              }
              for (let j = 0; j < 15; j++) {
                const a = Math.random() * Math.PI * 2;
                particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, size: 3 + Math.random() * 3, color: '#ff9800', alpha: 1, life: 0, maxLife: 400 });
              }
            }
            if (p.pierce > 0) { p.pierce--; p.dmg = Math.round(p.dmg * 0.7); }
            else { projectiles.splice(i, 1); }
            break;
          }
        }
      }

      for (let i = pickups.length - 1; i >= 0; i--) {
        const pk = pickups[i]; pk.life += dt;
        if (pk.life > pk.maxLife) { pickups.splice(i, 1); continue; }
        const d = Math.hypot(pk.x - player.x, pk.y - player.y);
        if (d < 30) {
          equipGun(pk.gun); showQuip(); pickups.splice(i, 1);
          for (let j = 0; j < 10; j++) {
            const a = Math.random() * Math.PI * 2;
            particles.push({ x: pk.x, y: pk.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, size: 3, color: pk.gun.rarityColor, alpha: 1, life: 0, maxLife: 500 });
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.life += dt;
        p.x += p.vx; p.y += p.vy; p.alpha *= 0.97; p.size *= 0.99;
        if (p.life > p.maxLife || p.alpha < 0.01) particles.splice(i, 1);
      }

      if (combo > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
      const comboEl = $('sd-combo');
      if (combo >= 3) { comboEl?.classList.add('active'); const cn = $('sd-combo-num'); if (cn) cn.textContent = String(combo); }
      else { comboEl?.classList.remove('active'); }

      if (quipTimer > 0) {
        quipTimer -= dt;
        const qEl = $('sd-quip');
        if (qEl) { qEl.style.left = (player.x - 60) + 'px'; qEl.style.top = (player.y - 55) + 'px'; }
        if (quipTimer <= 0) { const qEl2 = $('sd-quip'); if (qEl2) qEl2.style.display = 'none'; }
      }

      shakeMag *= 0.9;
      shakeX = (Math.random() - .5) * shakeMag * 2;
      shakeY = (Math.random() - .5) * shakeMag * 2;

      ctx.save();
      ctx.translate(shakeX, shakeY);
      ctx.clearRect(-20, -20, W + 40, H + 40);
      drawBG();
      pickups.forEach(drawPickup);
      drawParticles2();
      enemies.forEach(drawEnemy);
      projectiles.forEach(drawProjectile);
      drawPlayer();
      ctx.restore();
      updateHUD();
    }

    // ── Expose functions for JSX onClick handlers ──
    fns.current = {
      startGame, showTitle, openShop, closeShop, renderArsenal, closeArsenal,
      showArsenal: () => { arsenalFrom = 'title'; renderArsenal(); },
      showArsenalFromShop: () => { arsenalFrom = 'shop'; renderArsenal(); },
      showArsenalFromGameOver: () => { arsenalFrom = 'gameover'; renderArsenal(); },
    };

    // ── Start ──
    $('sd-title-ov')?.classList.add('active');
    animFrameId = requestAnimationFrame(update);

    // ── Cleanup ──
    return () => {
      destroyed = true;
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', resize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rootRef} className="sd-root">
      <style dangerouslySetInnerHTML={{ __html: GAME_CSS }} />
      <canvas ref={canvasRef} id="sd-canvas" />

      {/* Exit button */}
      <button className="sd-exit" onClick={onExit}>✕ Exit Game</button>

      {/* HUD */}
      <div id="sd-hud">
        <div className="hud-sec">
          <div className="hud-box"><div className="hud-lbl">Health</div><div className="hp-bar"><div className="hp-fill" id="sd-hp-fill" /></div></div>
          <div className="hud-box"><div className="hud-lbl">Wave</div><div className="hud-val" id="sd-hud-wave">1</div></div>
          <div className="hud-box"><div className="hud-lbl">Kills</div><div className="hud-val" id="sd-hud-kills">0</div></div>
        </div>
        <div className="hud-sec">
          <div className="hud-box"><div className="hud-lbl">Filter Pts</div><div className="hud-val" id="sd-hud-fp" style={{ color: '#f0b429' }}>0</div></div>
          <div className="hud-box"><div className="hud-lbl">Purified</div><div className="hud-val" id="sd-hud-gal">0 gal</div></div>
        </div>
      </div>

      {/* Gun info */}
      <div className="gun-info" id="sd-gun-info">
        <div className="gun-name" id="sd-gi-name">Crab Claw</div>
        <div className="gun-stats" id="sd-gi-stats">DMG 10 | RPM 300 | Common</div>
      </div>

      {/* Quip */}
      <div id="sd-quip" />

      {/* Combo */}
      <div id="sd-combo"><div className="combo-num" id="sd-combo-num">0</div><div className="combo-label">combo</div></div>

      {/* Wave announce */}
      <div id="sd-wave-announce"><div className="wa-num" id="sd-wa-num">Wave 1</div><div className="wa-sub" id="sd-wa-sub">Incoming pollution!</div></div>

      {/* Title */}
      <div className="ov" id="sd-title-ov">
        <div className="ov-inner">
          <div className="title-oyster">🦪</div>
          <div className="title-logo">SHUCK &amp; DESTROY</div>
          <div className="title-sub">A Project PEARL Game</div>
          <div className="title-desc">
            You are <strong>Captain Shuck</strong> — the world&apos;s most heavily armed oyster.
            Pollution is flooding the bay with toxic water, and only your <strong>super oyster powers</strong>
            {' '}and an arsenal of <strong>105 aquatic weapons</strong> can stop it.<br /><br />
            Filter. Shoot. Save the bay. <strong>One shell at a time.</strong>
          </div>
          <button className="btn btn-go" onClick={() => fns.current.startGame?.()}>SHUCK &apos;EM UP</button><br /><br />
          <button className="btn btn-sec" onClick={() => fns.current.showArsenal?.()}>Arsenal (105 Guns)</button>
        </div>
      </div>

      {/* Shop */}
      <div className="ov" id="sd-shop-ov">
        <div className="ov-inner">
          <div className="shop-title">Reef Supply Depot</div>
          <div className="shop-sub">Resupply between waves — spend your Filter Points</div>
          <div className="shop-fp">Filter Points: <span id="sd-shop-fp">0</span></div>
          <div className="shop-grid" id="sd-shop-grid" />
          <button className="btn btn-go" onClick={() => fns.current.closeShop?.()}>NEXT WAVE →</button>
          {' '}
          <button className="btn btn-sec" onClick={() => fns.current.showArsenalFromShop?.()}>View Arsenal</button>
        </div>
      </div>

      {/* Arsenal */}
      <div className="ov" id="sd-arsenal-ov">
        <div className="ov-inner">
          <div className="arsenal-title">Full Arsenal</div>
          <div className="arsenal-count" id="sd-arsenal-count">0 / 105 Discovered</div>
          <div className="arsenal-grid" id="sd-arsenal-grid" />
          <button className="btn btn-sec" onClick={() => fns.current.closeArsenal?.()}>Back</button>
        </div>
      </div>

      {/* Game Over */}
      <div className="ov" id="sd-gameover-ov">
        <div className="ov-inner">
          <div id="sd-go-anim" style={{ display: 'none' }}>
            <div style={{ fontSize: '100px', animation: 'sd-deathSpin 1.2s ease-out forwards' }}>🦪</div>
          </div>
          <div id="sd-go-content" style={{ display: 'none' }}>
            <div style={{ fontSize: '80px', marginBottom: '4px', filter: 'grayscale(0.5)' }}>🦪</div>
            <div className="go-title">GAME OVER</div>
            <div id="sd-go-subtitle" style={{ color: '#7eacc7', fontSize: '14px', marginBottom: '20px' }}>The pollution overwhelmed you...</div>

            <div id="sd-go-lastwords" style={{ background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.2)', borderRadius: '12px', padding: '12px 20px', marginBottom: '24px', display: 'inline-block' }}>
              <div style={{ fontSize: '9px', color: '#ff5252', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Captain Shuck&apos;s Last Words</div>
              <div id="sd-go-quip" style={{ color: '#ff8a80', fontSize: '15px', fontStyle: 'italic', fontWeight: 600 }}>&quot;I&apos;ll be back... with a bigger gun.&quot;</div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '9px', color: '#4a8ab5', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>Performance Rating</div>
              <div id="sd-go-rating" style={{ fontSize: '36px', fontWeight: 900 }}>D</div>
              <div id="sd-go-rating-msg" style={{ fontSize: '12px', color: '#7eacc7', marginTop: '2px' }}>Keep trying, Captain!</div>
            </div>

            <div className="go-stats-grid">
              <div className="go-stat-card"><div className="go-stat-icon">🌊</div><div className="go-stat-val" id="sd-go-wave">0</div><div className="go-stat-lbl">Wave Reached</div></div>
              <div className="go-stat-card"><div className="go-stat-icon">💀</div><div className="go-stat-val" id="sd-go-kills">0</div><div className="go-stat-lbl">Pollutants Destroyed</div></div>
              <div className="go-stat-card"><div className="go-stat-icon">🔥</div><div className="go-stat-val" id="sd-go-combo">0</div><div className="go-stat-lbl">Best Combo</div></div>
              <div className="go-stat-card"><div className="go-stat-icon">💧</div><div className="go-stat-val" id="sd-go-gal">0</div><div className="go-stat-lbl">Gallons Filtered</div></div>
              <div className="go-stat-card"><div className="go-stat-icon">🔫</div><div className="go-stat-val" id="sd-go-guns">0</div><div className="go-stat-lbl">Guns Discovered</div></div>
              <div className="go-stat-card"><div className="go-stat-icon">⏱️</div><div className="go-stat-val" id="sd-go-time">0:00</div><div className="go-stat-lbl">Time Survived</div></div>
            </div>

            <div id="sd-go-gun-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 20px', marginBottom: '24px', display: 'inline-block', minWidth: '280px' }}>
              <div style={{ fontSize: '9px', color: '#4a8ab5', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>Last Equipped Weapon</div>
              <div id="sd-go-gun-name" style={{ fontSize: '18px', fontWeight: 800 }}>Rusty Crab Claw</div>
              <div id="sd-go-gun-stats" style={{ fontSize: '11px', color: '#4a8ab5', marginTop: '2px' }}>DMG 12 | Common</div>
            </div>

            <div className="go-leaderboard-panel">
              <div className="go-lb-header"><span style={{ fontSize: '20px' }}>🏆</span><span>LEADERBOARD</span></div>
              <div id="sd-go-highscore-banner" style={{ display: 'none' }}><div className="go-new-hs">NEW HIGH SCORE!</div></div>
              <div className="go-lb-row go-lb-head">
                <span className="go-lb-rank">#</span>
                <span className="go-lb-col-wave">Wave</span>
                <span className="go-lb-col-kills">Kills</span>
                <span className="go-lb-col-combo">Combo</span>
                <span className="go-lb-col-gal">Filtered</span>
                <span className="go-lb-col-time">Time</span>
                <span className="go-lb-col-rating">Grade</span>
              </div>
              <div id="sd-go-leaderboard" />
              <div id="sd-go-lb-empty" style={{ display: 'none', padding: '16px', color: '#3a5a7a', fontSize: '12px' }}>No runs yet — get out there, Captain!</div>
            </div>

            <div style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', borderRadius: '12px', padding: '14px 20px', marginBottom: '24px', textAlign: 'left', maxWidth: '500px', display: 'inline-block' }}>
              <div style={{ fontSize: '9px', color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, marginBottom: '4px' }}>PEARL Fact</div>
              <div id="sd-go-fact" style={{ fontSize: '13px', color: '#7eacc7', lineHeight: 1.6 }}>Project PEARL uses living infrastructure to clean polluted shorelines.</div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-go" onClick={() => fns.current.startGame?.()}>SHUCK &apos;EM AGAIN</button>
              <button className="btn btn-sec" onClick={() => fns.current.showArsenalFromGameOver?.()}>ARSENAL</button>
              <button className="btn btn-sec" onClick={() => fns.current.showTitle?.()}>MENU</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
