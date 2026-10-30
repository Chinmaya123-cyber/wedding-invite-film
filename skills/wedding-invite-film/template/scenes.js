// Wedding invite film — one continuous camera over a painted street. Everything is data:
//   invite.json  words, ceremonies, photos, song     theme.json  place, colours, fonts, props
//   img/manifest.json  sizes of every painting + the window opening (scripts/cutout.py writes it)
// plan.js turns them into times and positions; this file only draws seek(t).
import { createTimeline, clamp, lerp, range, ease, rng } from "./engine.js";
import { makePlan, W, H, WORLD_H } from "./plan.js";

const load = (f) => fetch(f).then((r) => r.json());
const [spec, invite, theme, man] = await Promise.all(["spec.json", "invite.json", "theme.json", "img/manifest.json"].map(load));
const P = makePlan(invite, theme, man, spec.duration);
if (P.warnings.length) console.warn(P.warnings.join("\n"));
const tl = createTimeline(spec);
const EV = invite.events ?? [];

const EASE = { sine: (p) => -(Math.cos(Math.PI * p) - 1) / 2, linear: (p) => p, ...ease };
function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, e = "sine"] = keys[i];
      if (t <= t1) { const [t0, v0] = keys[i - 1]; return t1 === t0 ? v1 : lerp(v0, v1, EASE[e]((t - t0) / (t1 - t0))); }
    }
    return keys.at(-1)[1];
  };
}
const { outCubic, inOutCubic } = EASE;
const ar = (name) => man[name]?.ar ?? 1;
const el = (tag, cls = "", css = "", html = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.style.cssText = css;
  if (html) e.innerHTML = html;
  return e;
};
const img = (file, css, cls = "abs") => { const i = el("img", cls, css); i.src = file.includes("/") ? file : `img/${file}`; return i; };
const file = (name) => man[name]?.file ?? name;

// ---------- theme → CSS ----------
{
  const f = theme.fonts ?? {};
  const face = (role, fallback) => f[role] ? `@font-face{font-family:"${role}";src:url("fonts/${f[role].file}");font-display:block}` : `/* ${role}: ${fallback} */`;
  const pal = theme.palette ?? {};
  const looks = Object.entries(theme.looks ?? {}).map(([k, v]) =>
    `.look-${k} .text{color:${v.color};text-shadow:0 0 14px ${v.glow},0 0 3px ${v.glow}}`).join("\n");
  document.head.append(el("style", "", "", `
    ${face("display", "serif")} ${face("body", "serif")} ${face("script", "cursive")} ${face("native", "serif")}
    @font-face{font-family:"body";font-style:italic;src:url("fonts/${f.body_italic?.file ?? f.body?.file}");font-display:block}
    :root{--wall:${pal.wall ?? "#A99474"};--ink:${pal.ink ?? "#C67A2E"};--accent:${pal.accent ?? "#8E2B3A"}}
    ${looks}`));
}

// ---------- text lines with a feathered left→right wipe ----------
const DIVIDER = `<svg viewBox="0 0 150 16"><path d="M2 8H62M88 8H148" stroke="currentColor" stroke-width="1"/>
  <path d="M75 1.5 78 8 75 14.5 72 8Z M66 8l3-2.2v4.4Z M84 8l-3-2.2v4.4Z" fill="currentColor"/></svg>`;
function buildLines(parent, lines, start, step) {
  return (lines ?? []).map((l, i) => {
    const e = el("div", `ln k-${l.k}`, "", l.k === "div" ? DIVIDER : l.t);
    parent.append(e);
    return { e, at: start + i * step };
  });
}
function wipeLines(lines, t) {
  for (const { e, at } of lines) {
    const p = outCubic(range(t, at, at + 1.0));
    const m = p >= 1 ? "none" : `linear-gradient(90deg,#000 ${p * 135 - 35}%,transparent ${p * 135}%)`;
    e.style.webkitMaskImage = e.style.maskImage = m;
  }
}

// ---------- particles (petals, confetti, blossom, lavender…) ----------
const PARTICLES = {
  marigold: ["#F49A1A", "#E8730C", "#FFB531"], haldi: ["#F7B21C", "#F2C230", "#FF9F1A"], rose: ["#C8243A", "#E0455A", "#B01E35"],
  jasmine: ["#FFFDF6", "#F6F1E4", "#FFF8E8"], blossom: ["#F7C6D3", "#F3AFC2", "#FFE1EA"], lavender: ["#A68BC9", "#BBA3DB", "#8F72B8"],
  confetti: ["#E9C46A", "#F4A261", "#E76F51", "#2A9D8F", "#FFFFFF"], gold: ["#E8C66A", "#F3DA8B", "#C9A24A"],
  bougainvillea: ["#D6337A", "#E8559A", "#C21F66"], frangipani: ["#FFF6E0", "#FFE7A8", "#FFFFFF"],
};
function particleField(parent, n, seed, { x0, x1, y0, y1, t0, t1, fall = [3.2, 4.6], size = [9, 15], kind = "marigold" }) {
  const r = rng(seed), hues = PARTICLES[kind] ?? PARTICLES.marigold;
  return [...Array(n)].map(() => {
    const s = lerp(size[0], size[1], r()), c = hues[Math.floor(r() * hues.length)];
    const shape = kind === "confetti" ? "border-radius:2px" : "border-radius:55% 45% 60% 40%";
    const e = el("div", "petal", `width:${s}px;height:${s * 0.82}px;${shape};` +
      `background:radial-gradient(circle at 40% 35%,#ffffffaa 0,${c} 45%,${c} 100%);box-shadow:0 1px 2px rgba(60,30,10,.22)`);
    parent.append(e);
    return { e, x: lerp(x0, x1, r()), ts: lerp(t0, t1, r()), dur: lerp(fall[0], fall[1], r()), sway: lerp(14, 34, r()),
      ph: r() * 6.28, spin: lerp(-260, 260, r()), y0, y1 };
  });
}
function renderParticles(ps, t) {
  for (const p of ps) {
    const k = (t - p.ts) / p.dur;
    if (k < 0 || k > 1) { p.e.style.opacity = 0; continue; }
    const y = lerp(p.y0, p.y1, k * (0.6 + 0.4 * k)), x = p.x + Math.sin(p.ph + k * 7) * p.sway;
    p.e.style.opacity = clamp(k * 12) * clamp((1 - k) * 6);
    p.e.style.transform = `translate(${x}px,${y}px) rotate(${p.ph * 57 + k * p.spin}deg) scaleX(${0.6 + 0.4 * Math.cos(p.ph + k * 9)})`;
  }
}

// ---------- banner that unrolls from the top ----------
function makeBanner(world, b, lines) {
  const h = b.w / ar("banner");
  const root = el("div", "banner", `left:${b.x - b.w / 2}px;top:${b.top}px;width:${b.w}px;height:${h}px`);
  const cloth = img(file("banner"), `width:${b.w}px;height:${h}px`, "cloth");
  const text = el("div", "text", `padding-top:${theme.banner_text_top ?? 96}px`);
  const roll = el("div", "roll");
  root.append(cloth, text, roll);
  world.append(root);
  return { root, cloth, text, roll, h, lines: buildLines(text, lines, b.textStart, b.step) };
}
function renderBanner(bn, t, unroll, textOut = null) {
  const p = clamp(unroll);
  bn.root.style.visibility = p > 0.001 ? "visible" : "hidden";
  bn.cloth.style.clipPath = bn.text.style.clipPath = `inset(0 0 ${(1 - p) * 100}% 0)`;
  bn.root.style.transform = `rotate(${Math.sin(t * 2.1) * 0.25 * (1 - p) + Math.sin(t * 1.3) * 0.12}deg)`;
  bn.roll.style.top = `${p * bn.h * 0.93 - 10}px`;
  bn.roll.style.opacity = p > 0.015 && p < 0.97 ? 1 : 0;
  wipeLines(bn.lines, t);
  bn.text.style.opacity = textOut ? 1 - range(t, textOut, textOut + 0.45) : 1;
}

// ---------- window with paintings behind its opening ----------
function makeWindow(world, w) {
  const { WIN_W, WIN_H, HOLE } = P;
  const root = el("div", "abs", `left:${w.x - (HOLE.x0 + HOLE.w / 2)}px;top:${w.y - (HOLE.y0 + HOLE.h / 2)}px;width:${WIN_W}px;height:${WIN_H}px`);
  const hole = el("div", "abs", `left:${HOLE.x0}px;top:${HOLE.y0}px;width:${HOLE.w}px;height:${HOLE.h}px;overflow:hidden;background:var(--wall)`);
  const plates = [EV[w.first].plate, EV[w.last].plate].map((p) => {
    const ph = HOLE.w / ar(p);
    return img(file(p), `left:0;top:${(HOLE.h - ph) / 2}px;width:${HOLE.w}px;height:${ph}px`);
  });
  hole.append(...plates);
  const frame = img(file("window"), `left:0;top:0;width:${WIN_W}px;height:${WIN_H}px`);
  root.append(hole, frame);
  world.append(root);
  return { plates };
}

// ---------- full-screen ceremony plates ----------
function makeCeremony(stage, c) {
  const ev = EV[c.idx];
  const ph = W / ar(ev.plate);
  const root = el("div", `plate look-${ev.look ?? "day"}`);
  const bg = img(file(ev.plate), `width:${W}px;height:${ph}px`, "bg");
  const fx = el("div", "abs", "inset:0");
  const text = el("div", "text", `top:${ev.text_top ?? theme.plate_text_top ?? 74}px`);
  root.append(bg, fx, text);
  stage.append(root);
  const stars = ev.stars ? [...Array(46)].map((_, i) => {
    const r = rng(100 + i + c.idx * 50), s = lerp(1.2, 3, r());
    const e = el("div", "star", `left:${r() * W}px;top:${lerp(8, 420, r() ** 1.3)}px;width:${s}px;height:${s}px`);
    fx.append(e);
    return { e, ph: r() * 6.28, sp: lerp(1.2, 3.2, r()) };
  }) : [];
  const parts = ev.particles ? particleField(fx, 26, 31 + c.idx * 7, { x0: -20, x1: W + 20, y0: -40, y1: H + 40,
    t0: c.start + 0.5, t1: c.end - 2.5, fall: [5, 7.5], kind: ev.particles }) : [];
  return { root, bg, ph, text, stars, parts, lines: buildLines(text, ev.lines, c.textStart, c.step) };
}

// ---------- build ----------
tl.layer({
  id: "film",
  setup(root) {
    const world = (this.world = el("div", "", `width:${P.worldW}px;height:${WORLD_H}px`));
    world.id = "world";
    root.append(world);

    // wall, repeated (every other copy mirrored so the plaster flows on)
    const ww = WORLD_H * ar("wall");
    for (let i = 0, x = 0; x < P.worldW; i++, x += ww)
      world.append(img(file("wall"), `left:${x}px;top:0;width:${ww + 1}px;height:${WORLD_H}px;${i % 2 ? "transform:scaleX(-1)" : ""}`));

    // props
    this.swing = []; this.bob = [];
    for (const s of P.props) {
      if (s.portrait) {
        const w = s.w, h = w / ar("portrait");
        world.append(img(file("portrait"), `left:${s.x}px;top:${P.Y.band + 90}px;width:${w}px;height:${h}px`));
        continue;
      }
      if (s.skip || !man[s.name]) continue;
      const a = ar(s.name), mir = s.mirror ? "scaleX(-1)" : "";
      let e;
      if (s.kind === "ground") e = img(file(s.name), `left:${s.x}px;top:${P.Y.plinth - s.size}px;height:${s.size}px;width:${s.size * a}px;transform:${mir}`);
      else if (s.kind === "hang") e = img(file(s.name), `left:${s.x}px;top:${P.Y.band - 8}px;width:${s.size}px;height:${s.size / a}px;transform-origin:50% 0`);
      else e = img(file(s.name), `left:${s.x}px;top:${P.Y.band + 95}px;width:${s.size}px;height:${s.size / a}px;transform:${mir}`);
      e.dataset.mirror = mir;
      world.append(e);
      if (s.kind === "hang") this.swing.push(e);
      if (s.role === "people") this.bob.push(e);
    }

    // monogram painted on the wall
    const m = invite.monogram;
    if (m) world.append(el("div", "abs mono", `left:${P.X.mono - 200}px;top:${P.Y.band + 80}px;width:400px`,
      `<div class="mono-letters">${m.left}<span>${m.joiner ?? "✦"}</span>${m.right}</div><div class="mono-cap">${m.caption ?? ""}</div>`));

    // roof figure + invitation banner
    if (P.opt.roofFigure && man.roof) {
      const h = 282;
      this.roof = img(file("roof"), `left:${P.b1.x - (h * ar("roof")) / 2}px;top:${P.Y.ledge - h}px;width:${h * ar("roof")}px;height:${h}px;transform-origin:50% 100%`);
      world.append(this.roof);
    }
    this.banner1 = makeBanner(world, P.b1, invite.invitation);
    this.petals1 = particleField(world, 22, 11, { x0: P.b1.x - 260, x1: P.b1.x + 260, y0: P.Y.ledge - 110, y1: 1180,
      t0: P.b1.petals[0], t1: P.b1.petals[1], kind: theme.particles ?? "marigold" });

    this.windows = P.windows.map((w) => makeWindow(world, w));
    this.banner2 = makeBanner(world, P.b2, invite.venue);
    this.petals2 = particleField(world, 18, 23, { x0: P.b2.x - 280, x1: P.b2.x + 280, y0: -30, y1: 1180,
      t0: P.b2.petals[0], t1: P.b2.petals[1], kind: theme.particles ?? "marigold" });

    if (P.opt.rider && man.rider) {
      const rw = theme.rider_width ?? 340;
      this.rider = img(file("rider"), `left:0;top:0;width:${rw}px;height:${rw / ar("rider")}px`);
      this.riderW = rw;
      world.append(this.rider);
    }

    // ceremonies (screen space, above the world)
    this.cer = P.windows.map((w) => w.cer.map((c) => makeCeremony(root, c)));

    this.camX = track(P.cam.x); this.camY = track(P.cam.y); this.camZ = track(P.cam.z); this.ride = track(P.ride);
  },

  render(t) {
    const cx = this.camX(t), cy = this.camY(t), z = this.camZ(t);
    this.world.style.transform = `translate(${W / 2}px,${H / 2}px) scale(${z}) translate(${-cx}px,${-cy}px)`;

    if (this.rider) {
      const rx = cx + this.ride(t), v = Math.abs(this.camX(t + 0.05) + this.ride(t + 0.05) - rx) / 0.05;
      const bob = Math.sin(t * 2 * Math.PI * 1.7) * 1.6 * clamp(v / 120);
      this.rider.style.transform = `translate(${rx - this.riderW / 2}px,${P.Y.street - this.riderW / ar("rider") + bob}px)`;
    }
    this.swing.forEach((g, i) => (g.style.transform = `rotate(${Math.sin(t * 1.25 + i * 1.7) * 1.3}deg)`));
    this.bob.forEach((g, i) => (g.style.transform = `${g.dataset.mirror} translateY(${Math.sin(t * 4.4 + i) * 0.8}px)`));
    if (this.roof) this.roof.style.transform = `scaleY(${1 + Math.sin(t * 1.6) * 0.004})`;

    const b1 = P.b1;
    renderBanner(this.banner1, t, outCubic(range(t, ...b1.down)) - inOutCubic(range(t, ...b1.up)), b1.textOut);
    renderParticles(this.petals1, t);
    renderBanner(this.banner2, t, outCubic(range(t, ...P.b2.down)));
    renderParticles(this.petals2, t);

    P.windows.forEach((w, wi) => {
      const win = this.windows[wi];
      const mid = (w.cer[0].end + w.pull[0]) / 2;
      win.plates[1].style.opacity = t > mid ? 1 : 0;
      const into = range(t, ...w.plateIn), out = 1 - range(t, w.pull[0] - 0.05, w.pull[0] + 0.55);
      const settle = w.zoom[1] + 1.7;
      const s = t < w.pull[0] ? track([[w.plateIn[0], P.S0], [settle, 1.05, "outCubic"], [w.pull[0], 1.1]])(t)
        : lerp(1.1, P.S0, outCubic(range(t, w.pull[0], w.pull[0] + 0.55)));
      const dx = track([[settle, 0], [w.pull[0], -18]])(t);
      w.cer.forEach((c, k) => {
        const L = this.cer[wi][k];
        const fadeIn = k === 0 ? into : range(t, c.start - 0.5, c.start + 0.4);
        const o = fadeIn * out;
        L.root.style.opacity = o;
        L.root.style.visibility = o > 0 ? "visible" : "hidden";
        if (o <= 0) return;
        L.bg.style.transform = `translate(${W / 2 - (W * s) / 2 + dx}px,${H / 2 - (L.ph * s) / 2}px) scale(${s})`;
        L.text.style.opacity = k < w.cer.length - 1 ? 1 - range(t, c.end - 0.5, c.end) : 1;
        wipeLines(L.lines, t);
        for (const st of L.stars) st.e.style.opacity = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.sp + st.ph));
        renderParticles(L.parts, t);
      });
    });
  },
});

for (const [s, label] of P.stills) tl.still(Math.max(0, Math.min(s, spec.duration - 0.05)), label);
tl.mount();
