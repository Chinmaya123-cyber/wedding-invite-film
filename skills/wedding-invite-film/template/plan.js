// Pure planner: invite + theme + manifest + song length → every time and position the film uses.
// No DOM here, so `node scripts/plan.mjs <project>` can print the same plan the browser renders.
//
// The grammar is the reference film's, measured at 83.95 BPM / 81.7 s with 4 ceremonies:
//   intro truck + tilt to the roof (6.6 s) · banner unrolls (2.2 s) · invitation lines (0.74 s apart) · hold ·
//   banner rolls up (1.4 s) · truck to window (2.4 s) · zoom through (1.5 s) · ceremonies (~8.5 s each, two per window,
//   day→night or text swap) · pull out (1.4 s) · truck to the next window (3.8 s) … · truck on (3.4 s) ·
//   venue banner (2.4 s) + lines (0.8 s apart) · hold to the end of the song.
// Ceremony length stretches or shrinks to fit the song; everything else keeps the reference's timing.

export const W = 720, H = 1280, WORLD_H = 1400;
const ROLE_SIZE = { shopfront: 600, people: 228, door: 560, hang: 112, wall: 330 }; // ground: height · hang/wall: width

export function makePlan(invite, theme, man, D) {
  const opt = { perWindow: 2, roofFigure: true, rider: true, ...(invite.options ?? {}) };
  const events = invite.events ?? [];
  const N = events.length;
  const L1 = (invite.invitation ?? []).length, Lv = (invite.venue ?? []).length;
  const bpm = invite.song?.bpm ?? null;
  const warnings = [];

  // ---- wall geometry (fractions of the wall painting, measured per theme) ----
  const wg = { ledge: 0.227, band_bottom: 0.343, plinth: 0.794, street: 0.954, ...(theme.wall ?? {}) };
  const Y = { ledge: wg.ledge * WORLD_H, band: wg.band_bottom * WORLD_H, plinth: wg.plinth * WORLD_H, street: wg.street * WORLD_H };

  // ---- window / zoom-through geometry ----
  const WIN_W = 340, winAR = man.window?.ar ?? 0.797;
  const WIN_H = WIN_W / winAR;
  const hf = man.window?.hole ?? { x0: 0.265, y0: 0.224, w: 0.48, h: 0.572 };
  const HOLE = { x0: hf.x0 * WIN_W, y0: hf.y0 * WIN_H, w: hf.w * WIN_W, h: hf.h * WIN_H };
  const ZMAX = (1.18 * W) / HOLE.w;
  const S0 = (HOLE.w * ZMAX) / W;
  const WIN_Y = 700;

  // ---- group ceremonies into windows ----
  const groups = [];
  for (let i = 0; i < N; i += opt.perWindow) groups.push(events.slice(i, i + opt.perWindow).map((e, k) => i + k));
  const NW = groups.length;

  // ---- timing budget ----
  let step1 = 0.74, hold1 = 1.5, between = 3.8, stepV = 0.8;
  const fixed = () => {
    const introEnd = 9.3 + Math.max(L1 - 1, 0) * step1 + 1.0 + hold1 + 0.35 + 1.4 + 2.4; // = arrival at window 1
    const windows = NW * (1.5 + 1.4) + Math.max(NW - 1, 0) * (0.1 + between) + (NW ? 0.1 + 3.3 : 3.0);
    const venue = 2.7 + Math.max(Lv - 1, 0) * stepV + 1.0 + 3.0;
    return introEnd + windows + venue;
  };
  let E = N ? (D - fixed()) / N : 0;
  if (N && E < 5.5) { step1 = 0.6; hold1 = 0.8; between = 2.9; stepV = 0.65; E = (D - fixed()) / N; }
  if (N && E < 4.5) {
    const need = fixed() + 4.5 * N;
    throw new Error(`Song is ${D.toFixed(1)} s but ${N} ceremonies need at least ${need.toFixed(1)} s. Use a longer cut of the song, fewer ceremonies, or perWindow:3.`);
  }
  const E_MAX = 13;
  if (E > E_MAX) { warnings.push(`ceremonies capped at ${E_MAX}s; the venue banner holds longer`); E = E_MAX; }
  const snap = (t) => (bpm ? Math.round((t - (invite.song?.first_beat ?? 0)) / (60 / bpm)) * (60 / bpm) + (invite.song?.first_beat ?? 0) : t);

  // ---- schedule ----
  const A = 6.6;
  const b1 = { down: [6.9, 9.1], petals: [6.7, 9.6], textStart: 9.3, step: step1 };
  b1.textOut = b1.textStart + Math.max(L1 - 1, 0) * step1 + 1.0 + hold1;
  b1.up = [b1.textOut + 0.35, b1.textOut + 1.75];

  // ---- world layout ----
  const X = { start: 380, mono: 900, wallA: 1075, banner: 1700, people: 1890 };
  const winX = (i) => 2450 + i * 1200;
  const venueX = (NW ? winX(NW - 1) : 1700) + 750;
  const props = [];
  const want = (role, x, extra = {}) => props.push({ role, x, ...extra });
  want("shopfront", 60); want("hang", 395);
  if (invite.photos?.portrait) props.push({ portrait: true, x: X.wallA, w: 300 });
  else want("wall", X.wallA);
  want("people", X.people);
  for (let i = 0; i < NW; i++) {
    const x = winX(i);
    if (i < NW - 1) { want("door", x + 250); want("hang", x + 625); want("wall", x + 725, { scale: 0.8, mirror: true }); }
    else { want("hang", x + 240); want("wall", x + 360, { scale: 0.73 }); }
  }
  want("people", venueX + 160, { scale: 0.92, mirror: true });
  assignProps(props, theme.props ?? []);

  // ---- camera, windows, ceremonies ----
  const camX = [[0, X.start], [A, X.banner], [b1.up[1], X.banner + 30, "linear"]];
  const camY = [[0, 770], [3.0, 770], [A, 645], [b1.up[1], 645]];
  const camZ = [[0, 1]];
  const ride = [[0, -175], [A, -175], [b1.up[0] + 0.6, 215]];
  let t = b1.up[1] + 2.4;                          // arrival at window 1
  camX.push([t, winX(0), "inOutCubic"]); camY.push([t, WIN_Y, "inOutCubic"]);
  ride.push([t - 0.4, -70, "inOutCubic"]);
  const windows = groups.map((g, i) => {
    const x = winX(i), zoom = [t, t + 1.5];
    camZ.push([zoom[0], 1], [zoom[1], ZMAX, "inCubic"]);
    const plateIn = [zoom[0] + 1.0, zoom[0] + 1.7];
    let s = zoom[1];
    const cer = g.map((idx, k) => {
      const start = k === 0 ? s : snap(s);
      const lines = events[idx].lines ?? [];
      const textStart = k === 0 ? start + 0.9 : start + 0.6;
      const step = Math.max(0.45, Math.min(0.85, (E - 2.4) / Math.max(lines.length, 1)));
      s = start + E;
      return { idx, start, textStart, step };
    });
    cer.forEach((c, k) => (c.end = k < cer.length - 1 ? cer[k + 1].start : s));
    const pull = [s, s + 1.4];
    camZ.push([pull[0], ZMAX], [pull[1], 1, "outCubic"]);
    camX.push([pull[1] + 0.1, x]); camY.push([pull[1] + 0.1, WIN_Y]);
    t = pull[1] + 0.1 + (i < NW - 1 ? between : 3.3);
    if (i < NW - 1) camX.push([t, winX(i + 1), "inOutCubic"]);
    return { x, y: WIN_Y, zoom, plateIn, cer, pull, first: g[0], last: g.at(-1) };
  });
  // venue banner
  const vArrive = NW ? t : b1.up[1] + 3.3;
  camX.push([vArrive, venueX, "inOutCubic"], [D, venueX + 30, "linear"]);
  camY.push([vArrive, 645, "inOutCubic"]);
  ride.push([vArrive - 3.3, -70], [vArrive, -40], [vArrive + 4.3, 30, "outCubic"]);
  const b2 = { down: [vArrive - 0.2, vArrive + 2.2], petals: [vArrive - 0.2, vArrive + 2.4], textStart: vArrive + 2.7, step: stepV };
  const venueEnd = b2.textStart + Math.max(Lv - 1, 0) * stepV + 1.0;
  if (venueEnd > D - 1.5) warnings.push(`venue text finishes ${(venueEnd - D).toFixed(1)} s before/after the song ends — shorten venue lines or use a longer song`);

  const stills = [[1.0, "street + monogram"], [5.0, "tilt to roof"], [8.0, "banner unrolling"], [b1.textOut - 0.3, "invitation"]];
  windows.forEach((w, i) => {
    stills.push([w.zoom[0] + 0.9, `zoom ${i + 1}`]);
    w.cer.forEach((c) => stills.push([c.end - 0.6, events[c.idx].id ?? `ceremony ${c.idx + 1}`]));
  });
  stills.push([b2.down[0] + 1.0, "venue banner"], [D - 1, "final"]);

  return {
    D, E, bpm, warnings, opt, Y, X, WIN_W, WIN_H, HOLE, ZMAX, S0,
    b1: { ...b1, x: X.banner, top: Y.ledge + 4, w: 590 },
    b2: { ...b2, x: venueX, top: 16, w: 590 },
    windows, props, worldW: venueX + 1200,
    cam: { x: camX, y: camY, z: camZ }, ride, stills,
  };
}

// fill each slot with the theme's next prop of that role (cycling, mirrored on reuse)
function assignProps(slots, themeProps) {
  const used = {};
  for (const s of slots) {
    if (s.portrait) continue;
    const pool = themeProps.filter((p) => p.role === s.role);
    const any = pool.length ? pool : themeProps.filter((p) => (p.kind ?? kindOf(p.role)) === kindOf(s.role));
    if (!any.length) { s.skip = true; continue; }
    const n = (used[s.role] = (used[s.role] ?? -1) + 1);
    const p = any[n % any.length];
    s.name = p.name; s.kind = p.kind ?? kindOf(p.role);
    s.size = (p.size ?? ROLE_SIZE[s.role] ?? 300) * (s.scale ?? 1);
    if (n >= any.length) s.mirror = !s.mirror;
  }
}
const kindOf = (role) => (["shopfront", "people", "door"].includes(role) ? "ground" : role === "hang" ? "hang" : "wall");
