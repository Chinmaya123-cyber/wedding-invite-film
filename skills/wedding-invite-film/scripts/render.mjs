#!/usr/bin/env node
// Deterministic renderer (code-motion's, with JPEG frames so an 80 s 1080×1920 film needs ~2 GB of temp space, not ~20 GB).
//
//   node render.mjs <project> --stills                 # one still per key beat → out/stills/sheet.jpg
//   node render.mjs <project> --draft                  # half-res, 30fps, no motion blur
//   node render.mjs <project>                          # full: spec fps, spec subframes, audio mix
//   node render.mjs <project> --from 3 --to 6 --subframes 8 --workers 6 --out out/cut.mp4
//   node render.mjs <project> --serve                  # live preview at http://localhost:4173
//
// Each output frame is seek(t) for `subframes` evenly spaced times inside the shutter
// window (shutter=0.5 → 180°), blended with ffmpeg tmix. Frames are independent, so
// workers render disjoint ranges in parallel.

import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const flag = (k) => args.includes(`--${k}`);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const root = path.resolve(args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--")) ?? ".");
const spec = JSON.parse(fs.readFileSync(path.join(root, "spec.json"), "utf8"));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".wav": "audio/wav", ".mp3": "audio/mpeg" };

function serve(port = 0) {
  const srv = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    const file = p.endsWith("/") ? path.join(p, "index.html") : p;
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => srv.listen(port, "127.0.0.1", () => r(srv)));
}

function ff(argv, label) {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...argv], { encoding: "utf8" });
  if (r.status) { console.error(`ffmpeg (${label}) failed:\n${r.stderr}`); process.exit(1); }
}

async function openPage(browser, url, w, h, scale) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.__motion, null, { timeout: 15000 }).catch(() => {
    console.error(`Page never exposed window.__motion. Errors:\n${errors.join("\n")}`); process.exit(1);
  });
  await page.evaluate(() => window.__motion.ready);
  return { page, errors };
}

async function main() {
  const srv = await serve(flag("serve") ? 4173 : 0);
  const base = `http://127.0.0.1:${srv.address().port}/index.html`;
  if (flag("serve")) { console.log(`preview: ${base}?hud  (space play/pause, ←/→ beat, ,/. frame)`); return; }

  const W = spec.width ?? 1920, H = spec.height ?? 1080;
  const draft = flag("draft");
  const scale = draft ? 0.5 : Number(opt("scale", 1));
  const fps = Number(opt("fps", draft ? 30 : spec.fps ?? 60));
  const S = Math.max(1, Number(opt("subframes", draft ? 1 : spec.render?.subframes ?? 4)));
  const shutter = Number(opt("shutter", spec.render?.shutter ?? 0.5));
  const workers = Number(opt("workers", Math.max(2, Math.min(8, os.cpus().length - 2))));
  const outDir = path.join(root, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ["--force-color-profile=srgb", "--disable-lcd-text", "--font-render-hinting=none"] });

  // ---- stills: one frame per key beat, labelled, tiled into a contact sheet ----
  if (flag("stills")) {
    const { page, errors } = await openPage(browser, `${base}?render&hud`, W, H, 0.5);
    const stills = await page.evaluate(() => window.__motion.stills);
    const dir = path.join(outDir, "stills");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const [i, s] of stills.entries()) {
      await page.evaluate(async ({ t, label }) => {
        await window.__motion.seek(t);
        document.getElementById("hud").textContent += ` · ${label}`;
      }, s);
      await page.screenshot({ path: path.join(dir, `${String(i).padStart(3, "0")}.png`) });
    }
    const cols = 3, rows = Math.ceil(stills.length / cols);
    ff(["-framerate", "1", "-i", path.join(dir, "%03d.png"), "-vf",
      `scale=640:-2,pad=iw+8:ih+8:4:4:color=0x222222,tile=${cols}x${rows}:color=0x222222`,
      "-frames:v", "1", "-q:v", "3", path.join(dir, "sheet.jpg")], "contact sheet");
    console.log(JSON.stringify({ stills: stills.length, sheet: path.join(dir, "sheet.jpg"), dir, errors }, null, 1));
    await browser.close(); srv.close(); return;
  }

  // ---- frames ----
  const from = Number(opt("from", 0)), to = Number(opt("to", spec.duration));
  const nFrames = Math.round((to - from) * fps);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "code-motion-"));
  const jobs = [];
  for (let f = 0; f < nFrames; f++) for (let k = 0; k < S; k++) {
    // subframes span the open-shutter window, centred on the frame time
    const t = from + f / fps + (S > 1 ? (k / (S - 1) - 0.5) * (shutter / fps) : 0);
    jobs.push({ i: f * S + k, t: Math.min(Math.max(t, 0), spec.duration - 1e-4) });
  }
  const chunk = Math.ceil(jobs.length / workers);
  const t0 = Date.now();
  let done = 0, cues = [], pageErrors = [];
  await Promise.all([...Array(workers)].map(async (_, w) => {
    const mine = jobs.slice(w * chunk, (w + 1) * chunk);
    if (!mine.length) return;
    const { page, errors } = await openPage(browser, `${base}?render`, W, H, scale);
    if (w === 0) cues = await page.evaluate(() => window.__motion.cues);
    for (const j of mine) {
      await page.evaluate((t) => window.__motion.seek(t), j.t);
      await page.screenshot({ path: path.join(tmp, `${String(j.i).padStart(7, "0")}.jpg`), type: "jpeg", quality: 94 });
      if (++done % 200 === 0) process.stderr.write(`  ${done}/${jobs.length} samples\n`);
    }
    pageErrors.push(...errors);
  }));
  await browser.close();
  srv.close();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  const silent = path.join(tmp, "video.mp4");
  const blend = S > 1 ? `tmix=frames=${S},select='eq(mod(n\\,${S})\\,${S - 1})',` : "";
  ff(["-framerate", String(fps * S), "-i", path.join(tmp, "%07d.jpg"), "-vf",
    `${blend}setpts=N/(${fps}*TB),format=yuv420p`, "-r", String(fps), "-c:v", "libx264",
    "-preset", draft ? "veryfast" : "slow", "-crf", draft ? "20" : "14", "-tune", "animation", silent], "encode");

  // ---- audio: SFX cues + music + VO on the same clock ----
  const out = path.resolve(root, opt("out", draft ? "out/draft.mp4" : "out/final.mp4"));
  const inputs = ["-i", silent], filters = [], bus = [];
  const add = (file) => { inputs.push("-i", file); return inputs.filter((x) => x === "-i").length - 1; };
  const sfxGain = spec.audio?.sfx_gain_db ?? -4;
  const missing = new Set();
  for (const [n, c] of cues.entries()) {
    if (c.t < from || c.t >= to) continue;
    const file = ["wav", "mp3"].map((e) => path.join(root, "sfx", `${c.sfx}.${e}`)).find(fs.existsSync);
    if (!file) { missing.add(c.sfx); continue; }
    const k = add(file);
    filters.push(`[${k}:a]aresample=48000,volume=${c.gain + sfxGain}dB,adelay=${Math.round((c.t - from) * 1000)}:all=1[c${n}]`);
    bus.push(`[c${n}]`);
  }
  const music = spec.audio?.music, vo = spec.audio?.vo;
  if (vo?.file) {
    const k = add(path.join(root, vo.file));
    filters.push(`[${k}:a]aresample=48000,adelay=${Math.round(((vo.at ?? 0) - from) * 1000)}:all=1,volume=${vo.gain_db ?? 0}dB[vo]`);
  }
  if (music?.file) {
    const k = add(path.join(root, music.file));
    const dur = to - from;
    filters.push(`[${k}:a]aresample=48000,atrim=${(music.offset ?? 0) + from}:${(music.offset ?? 0) + to},asetpts=PTS-STARTPTS,` +
      `volume=${music.gain_db ?? -10}dB,afade=t=out:st=${Math.max(dur - 1.5, 0)}:d=1.5[mus]`);
  }
  if (vo?.file && music?.file) {
    // pad the key: when the voice stream ends, sidechaincompress would otherwise keep the music ducked
    filters.push("[vo]asplit=2[vo1][vosc0]", "[vosc0]apad[vosc]", "[mus][vosc]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=350[mduck]");
    bus.push("[vo1]", "[mduck]");
  } else {
    if (vo?.file) bus.push("[vo]");
    if (music?.file) bus.push("[mus]");
  }
  if (bus.length) {
    filters.push(`${bus.join("")}amix=inputs=${bus.length}:normalize=0,apad=whole_dur=${to - from},atrim=0:${to - from},` +
      `alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]`);
    ff([...inputs, "-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[aout]", "-c:v", "copy",
      "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest", out], "audio mix");
  } else {
    fs.copyFileSync(silent, out);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(JSON.stringify({ file: out, frames: nFrames, fps, subframes: S, samples: jobs.length,
    seconds_to_render: Number(secs), cues: cues.length, missing_sfx: [...missing], page_errors: [...new Set(pageErrors)] }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
