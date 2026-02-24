#!/usr/bin/env node

// =============================================================
// PIN Synthesia CLI — Multi-Scene AI Video Pipeline
//
// Usage:
//   node scripts/synthesia-cli.js create --script "Your script text here"
//   node scripts/synthesia-cli.js create --file script.txt
//   node scripts/synthesia-cli.js create --file briefing.txt          (--- separators = multi-scene)
//   node scripts/synthesia-cli.js create --scenes scenes.json
//   node scripts/synthesia-cli.js create --prompt "3 scene briefing on Maryland Cat 5 waterbodies" --yes
//   node scripts/synthesia-cli.js status <video-id>
//   node scripts/synthesia-cli.js list
//   node scripts/synthesia-cli.js download <video-id>
//   node scripts/synthesia-cli.js avatars
//   node scripts/synthesia-cli.js voices
//   node scripts/synthesia-cli.js templates
//   node scripts/synthesia-cli.js help
//
// Setup:
//   1. Get API key from Synthesia dashboard → Account → API Keys
//   2. Set environment variable: export SYNTHESIA_API_KEY=your_key_here
//   3. Optional: export ANTHROPIC_API_KEY=your_key (for --prompt mode)
//      — or place it in Dashboard/.env.local and run from the project dir
//   4. Run: node scripts/synthesia-cli.js create --script "Hello world"
//
// The --prompt flag uses Claude to write a multi-scene script FOR you,
// returning structured JSON with per-scene avatar, background, and
// transition settings. Pair with --yes for fully autonomous operation.
// =============================================================

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── .env.local fallback ──

function loadEnvFallback() {
  // If ANTHROPIC_API_KEY is already set, skip
  if (process.env.ANTHROPIC_API_KEY) return;

  // Try loading from .env.local in the project root (Dashboard/)
  const candidates = [
    path.resolve(__dirname, "..", ".env.local"),
    path.resolve(process.cwd(), ".env.local"),
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const contents = fs.readFileSync(envPath, "utf-8");
      for (const line of contents.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (key === "ANTHROPIC_API_KEY" && !process.env[key]) {
          process.env[key] = val;
        }
      }
      break;
    }
  }
}

loadEnvFallback();

// ── Config ──

const SYNTHESIA_API_KEY = process.env.SYNTHESIA_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SYNTHESIA_BASE = "https://api.synthesia.io/v2";

// Default avatar/voice — change to match your Synthesia account
const DEFAULT_AVATAR = process.env.SYNTHESIA_AVATAR_ID || "anna_costume1_cameraA";
const DEFAULT_VOICE = process.env.SYNTHESIA_VOICE_ID || undefined;
const DEFAULT_BACKGROUND = process.env.SYNTHESIA_BACKGROUND || "#0f172a";
const POLL_INTERVAL_MS = 15000;
const MAX_POLL_MINUTES = 30;

// ── HTTP Helpers ──

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith("http") ? path : `${SYNTHESIA_BASE}${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Bearer ${SYNTHESIA_API_KEY}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch {
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          else resolve(data);
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function anthropicRequest(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`Anthropic API HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
            return;
          }
          const text = parsed.content?.map((c) => c.text || "").join("\n") || "";
          resolve(text);
        } catch (e) {
          reject(new Error(`Anthropic API error: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Scene Type ──
// Each scene object:
// {
//   scene: number,
//   script: string,
//   avatar?: string,
//   avatarStyle?: "rectangular" | "circular" | "voiceOnly",
//   avatarAlign?: "left" | "center" | "right",
//   background?: string,     // hex color, image URL, or Synthesia stock ID
//   transition?: string|null  // "fade", "slideLeft", "slideRight", etc.
// }

// ── Build Synthesia Payload ──

function buildSynthesiaPayload(scenes, options = {}) {
  const title = options.title || `PIN Briefing — ${new Date().toISOString().slice(0, 10)}`;
  const avatarId = options.avatar || DEFAULT_AVATAR;
  const background = options.background || DEFAULT_BACKGROUND;

  const payload = {
    title,
    test: options.test || false,
    visibility: options.visibility || "private",
    input: scenes.map((s, i) => {
      const element = {
        scriptText: s.script,
        avatar: s.avatar || avatarId,
        background: s.background || background,
      };

      // Avatar settings
      const style = s.avatarStyle || "rectangular";
      const align = s.avatarAlign || (i % 2 === 0 ? "right" : "left");
      element.avatarSettings = {
        style,
        horizontalAlign: align,
      };

      // Voice override
      const voice = s.voice || options.voice || DEFAULT_VOICE;
      if (voice) element.voice = voice;

      // Transition (skip for first scene if not set)
      const transition = s.transition || options.transition || null;
      if (transition && i > 0) {
        element.transition = { type: transition };
      }

      return element;
    }),
  };

  // Top-level optional fields
  if (options.aspectRatio && options.aspectRatio !== "16:9") {
    payload.aspectRatio = options.aspectRatio;
  }
  if (options.soundtrack) {
    payload.soundtrack = options.soundtrack;
  }

  return payload;
}

// ── Commands ──

async function createVideo(scenes, options = {}) {
  const payload = buildSynthesiaPayload(scenes, options);

  console.log("\n🎬 Creating Synthesia video...");
  console.log(`   Title:    ${payload.title}`);
  console.log(`   Scenes:   ${scenes.length}`);
  console.log(`   Test:     ${payload.test}`);
  if (payload.aspectRatio) console.log(`   Aspect:   ${payload.aspectRatio}`);
  if (payload.soundtrack) console.log(`   Music:    ${payload.soundtrack}`);

  scenes.forEach((s, i) => {
    const words = s.script.split(" ").length;
    const est = Math.ceil(words / 2.5);
    console.log(`   Scene ${i + 1}: ~${est}s (${words} words) — ${s.script.slice(0, 60)}...`);
  });

  const totalWords = scenes.reduce((sum, s) => sum + s.script.split(" ").length, 0);
  console.log(`   Total:    ~${Math.ceil(totalWords / 2.5)}s estimated (${totalWords} words)\n`);

  try {
    const result = await apiRequest("POST", "/videos", payload);
    console.log(`✅ Video created!`);
    console.log(`   ID:     ${result.id}`);
    console.log(`   Status: ${result.status}`);

    if (options.wait !== false) {
      console.log(`\n⏳ Polling for completion (every ${POLL_INTERVAL_MS / 1000}s, max ${MAX_POLL_MINUTES}min)...\n`);
      return await pollUntilDone(result.id);
    }

    return result;
  } catch (e) {
    console.error(`❌ Failed to create video: ${e.message}`);
    process.exit(1);
  }
}

async function pollUntilDone(videoId) {
  const maxPolls = (MAX_POLL_MINUTES * 60000) / POLL_INTERVAL_MS;
  let polls = 0;

  while (polls < maxPolls) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    polls++;

    try {
      const video = await apiRequest("GET", `/videos/${videoId}`);
      const elapsed = `${(polls * POLL_INTERVAL_MS / 1000 / 60).toFixed(1)}min`;

      if (video.status === "complete") {
        console.log(`\n✅ Video ready! (${elapsed})`);
        console.log(`   📥 Download: ${video.download}`);
        console.log(`   📊 Duration: ${video.duration || "unknown"}`);
        return video;
      } else if (video.status === "failed") {
        console.error(`\n❌ Video rendering failed after ${elapsed}`);
        if (video.error) console.error(`   Error: ${video.error}`);
        process.exit(1);
      } else {
        const bar = "█".repeat(Math.min(polls, 20)) + "░".repeat(Math.max(20 - polls, 0));
        process.stdout.write(`\r   [${bar}] ${video.status} (${elapsed})`);
      }
    } catch (e) {
      console.warn(`\n   ⚠ Poll error: ${e.message}. Retrying...`);
    }
  }

  console.error(`\n❌ Timed out after ${MAX_POLL_MINUTES} minutes. Check status with: node scripts/synthesia-cli.js status ${videoId}`);
  process.exit(1);
}

async function getStatus(videoId) {
  try {
    const video = await apiRequest("GET", `/videos/${videoId}`);
    console.log("\n📋 Video Status:");
    console.log(`   ID:       ${video.id}`);
    console.log(`   Title:    ${video.title}`);
    console.log(`   Status:   ${video.status}`);
    console.log(`   Created:  ${video.createdAt}`);
    if (video.download) console.log(`   Download: ${video.download}`);
    if (video.duration) console.log(`   Duration: ${video.duration}`);
    return video;
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}

async function listVideos() {
  try {
    const result = await apiRequest("GET", "/videos?limit=20&offset=0");
    const videos = result.videos || result.data || result;
    console.log(`\n📋 Recent Videos (${Array.isArray(videos) ? videos.length : "?"}):\n`);

    if (Array.isArray(videos)) {
      videos.forEach((v) => {
        const status = v.status === "complete" ? "✅" : v.status === "failed" ? "❌" : "⏳";
        console.log(`   ${status} ${v.id}  ${v.title || "Untitled"}  [${v.status}]  ${v.createdAt || ""}`);
      });
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    console.error(`❌ ${e.message}`);
  }
}

async function listAvatars() {
  try {
    const result = await apiRequest("GET", "/avatars");
    const avatars = result.avatars || result.data || result;
    console.log(`\n🧑 Available Avatars:\n`);
    if (Array.isArray(avatars)) {
      avatars.forEach((a) => {
        console.log(`   ${a.id}  —  ${a.name || a.id}  ${a.gender || ""}`);
      });
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    console.error(`❌ ${e.message}`);
  }
}

async function listVoices() {
  try {
    const result = await apiRequest("GET", "/voices");
    const voices = result.voices || result.data || result;
    console.log(`\n🔊 Available Voices:\n`);
    if (Array.isArray(voices)) {
      voices.forEach((v) => {
        console.log(`   ${v.id}  —  ${v.name || v.id}  [${v.language || ""}] ${v.gender || ""}`);
      });
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    console.error(`❌ ${e.message}`);
  }
}

async function listTemplates() {
  try {
    const result = await apiRequest("GET", "/templates");
    const templates = result.templates || result.data || result;
    console.log(`\n📑 Available Templates:\n`);
    if (Array.isArray(templates)) {
      templates.forEach((t) => {
        console.log(`   ${t.id}  —  ${t.name || t.title || t.id}`);
      });
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    console.error(`❌ ${e.message}`);
  }
}

async function downloadVideo(videoId) {
  const video = await apiRequest("GET", `/videos/${videoId}`);
  if (video.status !== "complete") {
    console.error(`❌ Video not ready yet. Status: ${video.status}`);
    process.exit(1);
  }
  if (!video.download) {
    console.error(`❌ No download URL available`);
    process.exit(1);
  }
  console.log(`\n📥 Download URL:\n   ${video.download}\n`);
  console.log(`   curl -o "${videoId}.mp4" "${video.download}"`);
}

// ── AI Multi-Scene Script Generator ──

async function generateScenes(prompt) {
  if (!ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not set. Required for --prompt mode.");
    console.error("   Set it: export ANTHROPIC_API_KEY=your_key");
    console.error("   Or add it to Dashboard/.env.local");
    process.exit(1);
  }

  console.log("\n🤖 Generating multi-scene script via Claude...");
  console.log(`   Prompt: ${prompt.slice(0, 100)}...\n`);

  const systemPrompt = `You are a scriptwriter for the PEARL Intelligence Network (PIN) — a national water quality intelligence platform powered by PEARL ALIA (Autonomous Legislative & Infrastructure Analyst).

You write multi-scene scripts for AI-generated spokesperson videos using Synthesia.

OUTPUT FORMAT: You MUST output ONLY a valid JSON array. No markdown, no code fences, no explanation — just the raw JSON array.

Each element in the array is a scene object:
{
  "scene": 1,
  "script": "The spoken text for this scene...",
  "avatarStyle": "rectangular",
  "avatarAlign": "right",
  "background": "#0f172a",
  "transition": null
}

RULES:
- Each scene should contain ~30-45 seconds of spoken text (~75-112 words).
- Decide the number of scenes based on the requested duration. Default to 3-4 scenes (~2 minutes) if unspecified.
- Scene 1 transition must be null. Subsequent scenes should use "fade" unless variety is needed.
- Alternate avatarAlign between "right" and "left" across scenes for visual variety.
- Use dark, professional backgrounds: "#0f172a" (navy), "#1e293b" (slate), "#0c4a6e" (dark blue), "#1a1a2e" (midnight).
- Tone: authoritative, clear, data-driven. Like an evening news anchor covering environmental infrastructure.
- Reference real PIN capabilities when relevant: 430M+ verified datapoints, 565,000 EPA assessment units, 12 role-based management centers, 5 water domains.
- Do NOT use markdown, bullets, or special characters in the script text. Plain spoken English only.
- End with a clear call to action or next step in the final scene.

EXAMPLE OUTPUT:
[
  {"scene":1,"script":"Welcome to the PEARL Intelligence Network. Today we bring you a critical update on national water quality trends.","avatarStyle":"rectangular","avatarAlign":"right","background":"#0f172a","transition":null},
  {"scene":2,"script":"Our monitoring systems have analyzed over 430 million verified datapoints across all five water domains.","avatarStyle":"rectangular","avatarAlign":"left","background":"#1e293b","transition":"fade"}
]`;

  try {
    const raw = await anthropicRequest(systemPrompt, prompt);

    // Extract JSON array — handle possible markdown fences
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    // Find the JSON array boundaries
    const startIdx = jsonStr.indexOf("[");
    const endIdx = jsonStr.lastIndexOf("]");
    if (startIdx === -1 || endIdx === -1) {
      throw new Error("Claude did not return a valid JSON array");
    }
    jsonStr = jsonStr.slice(startIdx, endIdx + 1);

    const scenes = JSON.parse(jsonStr);

    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error("Parsed result is not a non-empty array");
    }

    // Validate each scene has a script
    for (const s of scenes) {
      if (!s.script || typeof s.script !== "string") {
        throw new Error(`Scene ${s.scene || "?"} is missing a valid script`);
      }
    }

    console.log(`📝 Generated ${scenes.length}-scene script:\n`);
    scenes.forEach((s, i) => {
      const words = s.script.split(" ").length;
      const est = Math.ceil(words / 2.5);
      console.log(`   ── Scene ${i + 1} (${words} words, ~${est}s) ──`);
      console.log(`   Align: ${s.avatarAlign || "right"} | BG: ${s.background || DEFAULT_BACKGROUND} | Transition: ${s.transition || "none"}`);
      console.log(`   ${s.script.slice(0, 120)}${s.script.length > 120 ? "..." : ""}\n`);
    });

    const totalWords = scenes.reduce((sum, s) => sum + s.script.split(" ").length, 0);
    console.log(`   Total: ${scenes.length} scenes, ${totalWords} words, ~${Math.ceil(totalWords / 2.5)}s estimated\n`);

    return scenes;
  } catch (e) {
    console.error(`❌ Script generation failed: ${e.message}`);
    process.exit(1);
  }
}

// ── File Parsing Helpers ──

function parseScenesFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8").trim();

  // Check if file contains --- separators → multi-scene
  if (content.includes("\n---\n") || content.includes("\n---\r\n")) {
    const segments = content.split(/\n---\r?\n/).map((s) => s.trim()).filter(Boolean);
    console.log(`📄 Parsed ${segments.length} scenes from file (--- separated)\n`);
    return segments.map((script, i) => ({
      scene: i + 1,
      script,
      avatarStyle: "rectangular",
      avatarAlign: i % 2 === 0 ? "right" : "left",
      background: i % 2 === 0 ? "#0f172a" : "#1e293b",
      transition: i === 0 ? null : "fade",
    }));
  }

  // Single-scene fallback
  return [
    {
      scene: 1,
      script: content,
      avatarStyle: "rectangular",
      avatarAlign: "right",
      background: DEFAULT_BACKGROUND,
      transition: null,
    },
  ];
}

function parseScenesFromJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8").trim();
    const scenes = JSON.parse(content);

    if (!Array.isArray(scenes) || scenes.length === 0) {
      console.error("❌ JSON file must contain a non-empty array of scene objects");
      process.exit(1);
    }

    for (const s of scenes) {
      if (!s.script || typeof s.script !== "string") {
        console.error(`❌ Scene ${s.scene || "?"} is missing a valid "script" field`);
        process.exit(1);
      }
    }

    console.log(`📄 Loaded ${scenes.length} scenes from JSON file\n`);
    return scenes;
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error(`❌ Invalid JSON in ${filePath}: ${e.message}`);
    } else {
      console.error(`❌ Failed to parse ${filePath}: ${e.message}`);
    }
    process.exit(1);
  }
}

// ── CLI Parser ──

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const flags = {};
  const positional = [];

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "-y") {
      flags.yes = true;
    } else if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--") && next !== "-y") {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(args[i]);
    }
  }

  return { command, flags, positional };
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  PIN Synthesia CLI — Multi-Scene AI Video Pipeline          ║
╚══════════════════════════════════════════════════════════════╝

COMMANDS:

  create    Create a new video (single or multi-scene)

    INPUT (pick one):
      --script "text"       Single-scene script text
      --file path.txt       Read script from file (use --- to separate scenes)
      --scenes path.json    Multi-scene JSON file (array of scene objects)
      --prompt "desc"       AI-generates multi-scene script via Claude

    VIDEO OPTIONS:
      --title "name"        Video title (default: auto-generated)
      --avatar id           Default avatar ID (default: ${DEFAULT_AVATAR})
      --voice id            Voice ID (optional)
      --background "#hex"   Default background color (default: ${DEFAULT_BACKGROUND})
      --aspect-ratio ratio  16:9 (default), 9:16, or 1:1
      --soundtrack name     corporate, inspirational, modern, urban
      --transition type     Default transition between scenes (e.g. fade)

    BEHAVIOR:
      --test                Render test video (watermarked, free)
      --yes / -y            Skip confirmation — fully autonomous
      --no-wait             Don't poll for completion

  status <id>       Check video render status
  download <id>     Get download URL for completed video
  list              List recent videos
  avatars           List available avatars
  voices            List available voices
  templates         List available templates
  help              Show this help

ENVIRONMENT:
  SYNTHESIA_API_KEY     Required. From Synthesia dashboard.
  ANTHROPIC_API_KEY     For --prompt mode. Falls back to Dashboard/.env.local.
  SYNTHESIA_AVATAR_ID   Default avatar ID.
  SYNTHESIA_VOICE_ID    Default voice ID.
  SYNTHESIA_BACKGROUND  Default background color.

MULTI-SCENE EXAMPLES:

  # AI writes a multi-scene script autonomously (no prompts)
  node scripts/synthesia-cli.js create \\
    --prompt "3 scene intro to PIN for federal stakeholders" \\
    --test --yes

  # Text file with --- separators (each segment = one scene)
  node scripts/synthesia-cli.js create --file briefing.txt --test

  # Explicit JSON scenes file with full control
  node scripts/synthesia-cli.js create --scenes scenes.json \\
    --title "Weekly Briefing" --soundtrack corporate --test

  # Single-scene (backwards compatible)
  node scripts/synthesia-cli.js create --script "Welcome to PIN." --test

SCENE JSON FORMAT:
  [
    {
      "scene": 1,
      "script": "Welcome to the PEARL Intelligence Network...",
      "avatarStyle": "rectangular",
      "avatarAlign": "right",
      "background": "#0f172a",
      "transition": null
    },
    {
      "scene": 2,
      "script": "Our systems monitor over 430 million datapoints...",
      "avatarStyle": "rectangular",
      "avatarAlign": "left",
      "background": "#1e293b",
      "transition": "fade"
    }
  ]
`);
}

// ── Main ──

async function main() {
  const { command, flags, positional } = parseArgs(process.argv);

  if (!SYNTHESIA_API_KEY && command !== "help" && command !== undefined) {
    console.error("❌ SYNTHESIA_API_KEY not set.");
    console.error("   Get your key from: Synthesia dashboard → Account → API Keys");
    console.error("   Then: export SYNTHESIA_API_KEY=your_key_here\n");
    process.exit(1);
  }

  switch (command) {
    case "create": {
      let scenes;

      if (flags.prompt) {
        // AI generates multi-scene script
        scenes = await generateScenes(flags.prompt);

        // Confirm before sending to Synthesia (unless --yes)
        if (!flags.yes) {
          process.stdout.write("   Send to Synthesia? [Y/n] ");
          const readline = require("readline");
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise((r) => rl.question("", (a) => { rl.close(); r(a); }));
          if (answer.toLowerCase() === "n") {
            console.log("   Cancelled. Scenes printed above — save to JSON and use --scenes to re-submit.");
            process.exit(0);
          }
        }
      } else if (flags.scenes) {
        // Explicit JSON scenes file
        scenes = parseScenesFromJson(flags.scenes);
      } else if (flags.file) {
        // Text file — auto-detect multi-scene via --- separators
        scenes = parseScenesFromFile(flags.file);
      } else if (flags.script) {
        // Single-scene from --script flag
        scenes = [
          {
            scene: 1,
            script: flags.script,
            avatarStyle: "rectangular",
            avatarAlign: "right",
            background: DEFAULT_BACKGROUND,
            transition: null,
          },
        ];
      } else {
        console.error("❌ Must provide --script, --file, --scenes, or --prompt");
        printHelp();
        process.exit(1);
      }

      await createVideo(scenes, {
        title: flags.title,
        avatar: flags.avatar,
        voice: flags.voice,
        background: flags.background,
        aspectRatio: flags["aspect-ratio"],
        soundtrack: flags.soundtrack,
        transition: flags.transition,
        test: flags.test === true,
        wait: flags["no-wait"] !== true,
      });
      break;
    }

    case "status":
      if (!positional[0]) { console.error("❌ Provide video ID"); process.exit(1); }
      await getStatus(positional[0]);
      break;

    case "download":
      if (!positional[0]) { console.error("❌ Provide video ID"); process.exit(1); }
      await downloadVideo(positional[0]);
      break;

    case "list":
      await listVideos();
      break;

    case "avatars":
      await listAvatars();
      break;

    case "voices":
      await listVoices();
      break;

    case "templates":
      await listTemplates();
      break;

    case "help":
    case undefined:
      printHelp();
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\n❌ Unexpected error: ${e.message}`);
  process.exit(1);
});
