#!/usr/bin/env node
// Print the film's timeline for a project (the same plan the browser renders).
//   node plan.mjs <project>
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2] ?? ".");
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const { makePlan } = await import(pathToFileURL(path.join(root, "plan.js")));
const [spec, invite, theme, man] = ["spec.json", "invite.json", "theme.json", "img/manifest.json"].map(read);
let P;
try { P = makePlan(invite, theme, man, spec.duration); } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
const f = (t) => t.toFixed(1).padStart(5);
const rows = [
  [0, "street: truck right + tilt to the roof"],
  [P.b1.down[0], "banner unrolls"], [P.b1.textStart, `invitation (${(invite.invitation ?? []).length} lines)`], [P.b1.up[0], "banner rolls up"],
];
P.windows.forEach((w, i) => {
  rows.push([w.zoom[0], `zoom into window ${i + 1}`]);
  w.cer.forEach((c) => rows.push([c.start, `  ${invite.events[c.idx].id ?? "ceremony"} · plate ${invite.events[c.idx].plate} · ${(c.end - c.start).toFixed(1)} s`]));
  rows.push([w.pull[0], `pull out of window ${i + 1}`]);
});
rows.push([P.b2.down[0], "venue banner unrolls"], [P.b2.textStart, `venue (${(invite.venue ?? []).length} lines)`], [P.D, "end"]);
console.log(rows.map(([t, s]) => `${f(t)}  ${s}`).join("\n"));
const missing = [...new Set(["wall", "window", "banner", ...invite.events.map((e) => e.plate),
  ...(P.opt.roofFigure ? ["roof"] : []), ...(P.opt.rider ? ["rider"] : []), ...P.props.filter((p) => p.name).map((p) => p.name)])].filter((n) => !man[n]);
console.log(`\nceremony length ${P.E.toFixed(1)} s · ${P.windows.length} window(s) · song ${P.D} s${P.bpm ? ` @ ${P.bpm} BPM` : ""}`);
if (missing.length) console.log(`missing art: ${missing.join(", ")}`);
for (const w of P.warnings) console.log(`! ${w}`);
