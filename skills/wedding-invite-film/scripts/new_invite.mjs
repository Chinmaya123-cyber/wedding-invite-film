#!/usr/bin/env node
// Scaffold a wedding-invite film project.
//
//   node new_invite.mjs <project> --theme rajasthan [--names "Mohini,Rishabh"] [--song song.mp3 --start 0 --end 82] [--force]
//
// Copies the template, merges themes/_defaults.json + themes/<id>.json → theme.json, downloads the theme's
// fonts, copies a cached art set when the theme has one (assets/themes/<id>/img), cuts the song to audio/song.wav,
// estimates its tempo, and writes spec.json + an example invite.json (never overwrites invite.json without --force).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Python with numpy, scipy, pillow, rembg: $WIF_PY, else ~/.claude/video-env, else python3 on PATH
const VENV = path.join(process.env.HOME ?? "", ".claude/video-env/bin/python");
const PY = process.env.WIF_PY ?? (fs.existsSync(VENV) ? VENV : "python3");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const root = path.resolve(args[0] ?? ".");
const themeId = opt("theme", "rajasthan");
const force = args.includes("--force");
const themeFile = path.join(SKILL, "themes", `${themeId}.json`);
if (!fs.existsSync(themeFile)) {
  console.error(`No theme "${themeId}". Available: ${fs.readdirSync(path.join(SKILL, "themes")).filter((f) => !f.startsWith("_")).map((f) => f.replace(".json", "")).join(", ")}`);
  process.exit(1);
}

// ---- template ----
fs.mkdirSync(root, { recursive: true });
for (const f of fs.readdirSync(path.join(SKILL, "template"))) {
  const dst = path.join(root, f);
  if (f === "invite.json" || (fs.existsSync(dst) && ["img", "audio"].includes(f))) continue;
  fs.cpSync(path.join(SKILL, "template", f), dst, { recursive: true, force: true });
}
fs.mkdirSync(path.join(root, "img/raw"), { recursive: true });
fs.mkdirSync(path.join(root, "audio"), { recursive: true });

// ---- theme (defaults deep-merged with the place) ----
const merge = (a, b) => {
  const o = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) o[k] = v && typeof v === "object" && !Array.isArray(v) && a?.[k] && typeof a[k] === "object" ? merge(a[k], v) : v;
  return o;
};
const theme = merge(JSON.parse(fs.readFileSync(path.join(SKILL, "themes/_defaults.json"), "utf8")), JSON.parse(fs.readFileSync(themeFile, "utf8")));
const themeDst = path.join(root, "theme.json");
if (!fs.existsSync(themeDst) || force) fs.writeFileSync(themeDst, JSON.stringify(theme, null, 1));

// ---- fonts ----
for (const [role, f] of Object.entries(theme.fonts ?? {})) {
  const dst = path.join(root, "fonts", f.file);
  if (fs.existsSync(dst)) continue;
  if (!f.url) { console.warn(`font ${role}: ${f.file} missing and no url`); continue; }
  const r = spawnSync("curl", ["-sfL", "-o", dst, f.url]);
  console.log(r.status ? `font ${role}: download FAILED (${f.url})` : `font ${role}: ${f.file}`);
}

// ---- cached art ----
const cache = path.join(SKILL, "assets/themes", themeId, "img");
let cached = 0;
if (fs.existsSync(cache)) for (const f of fs.readdirSync(cache)) {
  const dst = path.join(root, "img", f);
  if (!fs.existsSync(dst)) { fs.copyFileSync(path.join(cache, f), dst); cached++; }
}

// ---- song ----
let duration = 80, bpm = null, firstBeat = 0;
const song = opt("song");
if (song) {
  const start = Number(opt("start", 0)), end = opt("end");
  const cut = ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(start), ...(end ? ["-to", String(end)] : []), "-i", path.resolve(song),
    "-vn", "-ac", "2", "-ar", "48000", path.join(root, "audio/song.wav")];
  const r = spawnSync("ffmpeg", cut, { encoding: "utf8" });
  if (r.status) { console.error(r.stderr); process.exit(1); }
}
const wav = path.join(root, "audio/song.wav");
if (fs.existsSync(wav)) {
  const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav], { encoding: "utf8" });
  duration = Math.floor(Number(p.stdout) * 10) / 10;
  const t = spawnSync(PY, ["-I", path.join(SKILL, "scripts/tempo.py"), wav], { encoding: "utf8" });
  if (!t.status) ({ bpm, first_beat: firstBeat } = JSON.parse(t.stdout));
}

// ---- spec ----
const spec = {
  title: "Wedding invite", duration, fps: 30, bpm: bpm ?? 120, width: 720, height: 1280,
  render: { subframes: 1, shutter: 0.5 },
  audio: { music: fs.existsSync(wav) ? { file: "audio/song.wav", offset: 0, gain_db: 0 } : null, vo: null, sfx_gain_db: 0 },
};
fs.writeFileSync(path.join(root, "spec.json"), JSON.stringify(spec, null, 1));

// ---- example invite.json ----
const invPath = path.join(root, "invite.json");
const [p1, p2] = (opt("names", "Partner One,Partner Two")).split(",").map((s) => s.trim());
if (!fs.existsSync(invPath) || force) {
  const india = theme.region === "india";
  const order = india ? ["mehendi", "sangeet", "haldi", "wedding"] : ["welcome", "ceremony", "reception"];
  const names = { mehendi: "Mehendi", sangeet: "Sangeet", haldi: "Haldi", wedding: "The Wedding", welcome: "Welcome Evening", ceremony: "The Ceremony", reception: "Reception" };
  const events = order.filter((k) => theme.ceremonies?.[k]).map((k) => {
    const c = theme.ceremonies[k], look = theme.plates?.[c.plate]?.look ?? "day";
    return { id: k, plate: c.plate, look, ...(c.particles ? { particles: c.particles } : {}), ...(c.stars ? { stars: true } : {}),
      lines: [{ k: "title", t: names[k] }, { k: "sub", t: "A line about the celebration" }, { k: "div" },
        { k: "sub", t: "Day, Date" }, { k: "body", t: "Time Onwards" }, { k: "body", t: "Dress Code: …" }] };
  });
  const invite = {
    song: { file: "audio/song.wav", bpm, first_beat: firstBeat },
    monogram: { left: p1[0], right: p2[0], caption: `${p1} & ${p2}` },
    invitation: [
      ...(theme.greeting ? [{ k: "native", t: theme.greeting }] : []),
      { k: "body", t: india ? "With the blessings of our elders" : "Together with their families" },
      { k: "body", t: "we joyfully invite you to the wedding of" },
      { k: "name", t: p1 }, { k: "with", t: india ? "with" : "&" }, { k: "name", t: p2 },
      { k: "div" }, { k: "body", t: "Date" }, { k: "body", t: "City" },
    ],
    events,
    venue: [{ k: "small", t: "VENUE" }, { k: "title", t: "Venue name, City" }, { k: "div" },
      { k: "small", t: "YOUR BLESSINGS AND PRESENCE" }, { k: "small", t: "WILL MAKE OUR JOY COMPLETE" },
      { k: "with", t: "with love," }, { k: "title", t: `The Families of<br>${p1} &amp; ${p2}` }],
    photos: {},
    options: { perWindow: 2, roofFigure: true, rider: true },
  };
  fs.writeFileSync(invPath, JSON.stringify(invite, null, 1));
} else if (fs.existsSync(wav)) {
  // re-cut song on an existing project: keep the words, refresh the tempo the planner snaps to
  const invite = JSON.parse(fs.readFileSync(invPath, "utf8"));
  invite.song = { ...(invite.song ?? {}), file: "audio/song.wav", bpm, first_beat: firstBeat };
  fs.writeFileSync(invPath, JSON.stringify(invite, null, 1));
}

// ---- manifest for whatever art is already there ----
if (cached || fs.readdirSync(path.join(root, "img")).some((f) => /\.(png|jpe?g)$/.test(f)))
  spawnSync(PY, ["-I", path.join(SKILL, "scripts/cutout.py"), root, "--manifest-only"], { stdio: "inherit" });

console.log(JSON.stringify({ project: root, theme: themeId, cached_art: cached, duration, bpm, first_beat: firstBeat,
  next: "edit invite.json, then: node scripts/art_jobs.mjs <project>" }, null, 1));
