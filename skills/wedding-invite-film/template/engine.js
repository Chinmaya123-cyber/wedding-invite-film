// code-motion engine: every frame is a pure function of time.
//
//   const tl = createTimeline(spec);          // spec.json: fps, duration, bpm, width, height
//   tl.scene({ id, start, end, setup(root), render(local, ctx) });
//   tl.layer({ id, setup(root), render(t, ctx) });   // persistent object across scenes
//   tl.cue(t, "whoosh", { gain: -6 });         // SFX on the same clock as the visuals
//   tl.still(t, "headline lands");             // key frames for the beat contact sheet
//   tl.mount();                                // exposes window.__motion for the renderer
//
// Rules for scene code (lint.mjs enforces them): no Math.random, Date.now,
// performance.now, setTimeout, setInterval or requestAnimationFrame. Derive
// everything from the time you are given; use rng(seed) for randomness.

// ---------- maths ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const range = (t, a, b) => clamp((t - a) / (b - a)); // 0→1 progress of t through [a, b]
export const mix = (from, to, p) =>
  typeof from === "number" ? lerp(from, to, p) : from.map((v, i) => lerp(v, to[i], p));

export const ease = {
  linear: (p) => p,
  inCubic: (p) => p * p * p,
  outCubic: (p) => 1 - (1 - p) ** 3,
  inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
  outQuint: (p) => 1 - (1 - p) ** 5,
  outExpo: (p) => (p === 1 ? 1 : 1 - 2 ** (-10 * p)),
  inOutExpo: (p) =>
    p === 0 ? 0 : p === 1 ? 1 : p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2,
};

// Closed-form damped spring from 0 to 1 (overshoot allowed). t in seconds, t<0 → 0.
// Because it is closed-form, any frame can be computed on its own (parallel renders).
export function spring(t, { stiffness = 170, damping = 26, mass = 1, velocity = 0 } = {}) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  let y;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    y = Math.exp(-zeta * w0 * t) * (-Math.cos(wd * t) + ((velocity - zeta * w0) / wd) * Math.sin(wd * t));
  } else if (zeta === 1) {
    y = Math.exp(-w0 * t) * (-1 + (velocity - w0) * t);
  } else {
    const s = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - s), r2 = -w0 * (zeta + s);
    const c2 = (velocity + r1) / (r2 - r1), c1 = -1 - c2;
    y = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  }
  return 1 + y;
}

export const SPRINGS = {
  snappy: { stiffness: 420, damping: 34 },   // UI, indicators, toggles
  smooth: { stiffness: 170, damping: 26 },   // general moves, no visible overshoot
  bouncy: { stiffness: 300, damping: 14 },   // playful pops, one clear overshoot
  heavy: { stiffness: 90, damping: 20, mass: 1.6 }, // camera, big panels
  lead: { stiffness: 520, damping: 38 },     // leading edge of a moving indicator
  trail: { stiffness: 190, damping: 24 },    // trailing edge catches up
};

// Value that springs from `from` to `to` starting at time `at`.
export const springTo = (t, at, from, to, cfg = SPRINGS.smooth) => mix(from, to, spring(t - at, cfg));

// One object that keeps changing identity: spring through a list of states.
// frames = [{at, ...props}], first frame is the rest state; numeric props only.
// Each change is its own spring added on top of the last, so it stays continuous and closed-form.
export function springStates(t, frames, cfg = SPRINGS.smooth) {
  const out = { ...frames[0] };
  for (let k = 1; k < frames.length; k++) {
    const p = spring(t - frames[k].at, frames[k].cfg ?? cfg);
    for (const key in frames[k]) {
      if (key === "at" || key === "cfg") continue;
      const prev = frames.slice(0, k).reverse().find((f) => key in f)?.[key] ?? 0;
      out[key] = (out[key] ?? prev) + (frames[k][key] - prev) * p;
    }
  }
  delete out.at;
  delete out.cfg;
  return out;
}

// Indicator / slider / tab pill whose front edge moves first and back edge catches up.
// a0,b0 = start [left,right]; a1,b1 = end. Returns {left, right, width}.
export function edgeSpring(t, at, [a0, b0], [a1, b1], lead = SPRINGS.lead, trail = SPRINGS.trail) {
  const right = a1 + b1 > a0 + b0;
  const left = lerp(a0, a1, spring(t - at, right ? trail : lead));
  const rgt = lerp(b0, b1, spring(t - at, right ? lead : trail));
  return { left, right: rgt, width: rgt - left };
}

// Deterministic PRNG (mulberry32). rng(seed)() → [0,1)
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- typography ----------
// Split an element's text into word spans (no wrapping inside a word) holding glyph spans.
export function glyphs(el) {
  const text = el.textContent;
  el.textContent = "";
  const out = [];
  text.split(/(\s+)/).forEach((word) => {
    if (/^\s+$/.test(word)) return el.append(document.createTextNode(" "));
    const w = document.createElement("span");
    w.className = "w";
    w.style.cssText = "display:inline-block;white-space:nowrap";
    for (const ch of word) {
      const g = document.createElement("span");
      g.className = "g";
      g.textContent = ch;
      g.style.cssText = "display:inline-block;will-change:transform";
      w.append(g);
      out.push(g);
    }
    el.append(w);
  });
  return out;
}

// Per-glyph entrance/exit. at = start time, stagger = seconds between glyphs (try tl.note(16)).
// order: "start" | "center" | "end" | "random". y in em, blur in px, rotate in deg.
export function glyphIn(gs, t, at, {
  stagger = 0.03, cfg = SPRINGS.snappy, y = 0.55, blur = 10, rotate = 0, scale = 0,
  order = "start", seed = 7, out = null,
} = {}) {
  const n = gs.length;
  const idx = order === "random" ? shuffleIdx(n, seed) : null;
  gs.forEach((g, i) => {
    const k = order === "end" ? n - 1 - i : order === "center" ? Math.abs(i - (n - 1) / 2) : idx ? idx[i] : i;
    let p = spring(t - at - k * stagger, cfg);
    if (out) p *= 1 - spring(t - out.at - k * (out.stagger ?? stagger), out.cfg ?? cfg);
    const q = clamp(p);
    g.style.transform =
      `translateY(${(1 - p) * y}em) rotate(${(1 - p) * rotate}deg) scale(${1 - (1 - p) * scale})`;
    g.style.opacity = clamp(p * 1.4);
    g.style.filter = blur ? `blur(${(1 - q) * blur}px)` : "";
  });
}

function shuffleIdx(n, seed) {
  const r = rng(seed), a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Number that counts to `value` and then holds the exact final string (tabular nums in CSS).
export function countTo(t, at, dur, value, { decimals = 0, locale = "en-US", curve = ease.outExpo } = {}) {
  const p = curve(range(t, at, at + dur));
  const v = p >= 1 ? value : value * p;
  return v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ---------- timeline ----------
export function createTimeline(spec) {
  const fps = spec.fps ?? 60, bpm = spec.bpm ?? 120, duration = spec.duration;
  const W = spec.width ?? 1920, H = spec.height ?? 1080;
  const beatLen = 60 / bpm;
  const scenes = [], layers = [], cues = [], stills = [];
  const stage = document.getElementById("stage");
  stage.style.width = `${W}px`;
  stage.style.height = `${H}px`;

  const tl = {
    fps, bpm, duration, width: W, height: H, spec,
    beat: (n) => n * beatLen,              // beat n → seconds
    bar: (n, beatsPerBar = 4) => n * beatsPerBar * beatLen,
    note: (div) => (4 / div) * beatLen,    // note(16) = a sixteenth note in seconds
    beatOf: (t) => t / beatLen,
    cue(t, sfx, opts = {}) { cues.push({ t: +t.toFixed(4), sfx, gain: opts.gain ?? 0, pan: opts.pan ?? 0 }); return tl; },
    still(t, label = "") { stills.push({ t: +t.toFixed(4), label }); return tl; },
    scene(s) { scenes.push(s); return tl; },
    layer(l) { layers.push(l); return tl; },
    // ctx.ft / ctx.lf = time snapped to the output frame. Motion-blur subframes sample
    // t around each frame; anything discrete (text content, counters, toggled states)
    // must use the snapped time or the blend ghosts several values on top of each other.
    seek(t) {
      const ft = Math.round(t * fps) / fps;
      const ctx = { tl, t, ft };
      for (const s of scenes) {
        const on = ft >= s.start && ft < s.end; // cut on frame boundaries, never mid-blur
        s.root.style.visibility = on ? "visible" : "hidden";
        if (on) s.render(t - s.start, { ...ctx, scene: s, dur: s.end - s.start, lf: ft - s.start });
      }
      for (const l of layers) l.render(t, ctx);
      hud(t);
    },
    mount() {
      for (const s of [...scenes, ...layers]) {
        s.root = document.createElement("section");
        s.root.className = `scene scene-${s.id}`;
        stage.append(s.root);
        s.setup?.(s.root, tl);
      }
      for (const s of scenes) { // default stills: each scene settled, and its exit
        if (!stills.some((x) => x.t >= s.start && x.t < s.end)) stills.push({ t: s.start + (s.end - s.start) * 0.6, label: s.id });
      }
      stills.sort((a, b) => a.t - b.t);
      const ready = document.fonts.ready.then(() => Promise.all(
        [...document.images].map((im) => (im.complete ? 0 : new Promise((r) => (im.onload = im.onerror = r))))));
      window.__motion = { fps, bpm, duration, width: W, height: H, cues, stills, seek: tl.seek, ready,
        sceneList: scenes.map(({ id, start, end }) => ({ id, start, end })) };
      if (!new URLSearchParams(location.search).has("render")) preview(tl);
      else tl.seek(0);
      return tl;
    },
  };

  let hudEl = null;
  const params = new URLSearchParams(location.search);
  function hud(t) {
    if (!params.has("hud")) return;
    if (!hudEl) { hudEl = document.createElement("div"); hudEl.id = "hud"; document.body.append(hudEl); }
    const b = t / beatLen, s = scenes.find((x) => t >= x.start && t < x.end);
    hudEl.textContent = `${t.toFixed(2)}s · bar ${Math.floor(b / 4) + 1}.${Math.floor(b % 4) + 1} · ${s?.id ?? "-"}` +
      (params.get("label") ? ` · ${params.get("label")}` : "");
  }
  return tl;
}

// Live preview (browser only; never used for the final render).
function preview(tl) {
  const fit = () => {
    const k = Math.min(innerWidth / tl.width, (innerHeight - 40) / tl.height);
    document.getElementById("stage").style.transform = `scale(${k})`;
  };
  addEventListener("resize", fit);
  fit();
  const bar = document.createElement("input");
  Object.assign(bar, { type: "range", min: 0, max: tl.duration, step: 1 / tl.fps, id: "scrub" });
  document.body.append(bar);
  let playing = true, t = 0, last = null;
  bar.oninput = () => { t = +bar.value; playing = false; tl.seek(t); };
  addEventListener("keydown", (e) => {
    if (e.code === "Space") playing = !playing;
    if (e.code === "ArrowRight") t = Math.min(tl.duration, t + tl.beat(1));
    if (e.code === "ArrowLeft") t = Math.max(0, t - tl.beat(1));
    if (e.key === ".") t += 1 / tl.fps;
    if (e.key === ",") t -= 1 / tl.fps;
    tl.seek(t); bar.value = t;
  });
  const loop = (now) => {
    if (playing) { if (last != null) t = (t + (now - last) / 1000) % tl.duration; tl.seek(t); bar.value = t; }
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
