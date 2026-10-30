#!/usr/bin/env node
// List the paintings a project still needs, with ready-to-send Atlabs prompts.
//
//   node art_jobs.mjs <project>            → prints a table and writes <project>/art_jobs.json
//
// Each job: { name, status, model, aspect_ratio, resolution, refs, prompt, save_as }.
//   refs: "style:<file>" = a style anchor from the skill's assets/style (upload once, reuse the media id)
//         "photo:<path>" = the couple's own photo (likeness reference)
//         "job:<name>"   = the media id of another job's result (night edit of a day plate, etc.)
// Generate each missing job with generate_image, download it to save_as, then run cutout.py.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const theme = JSON.parse(fs.readFileSync(path.join(root, "theme.json"), "utf8"));
const invite = JSON.parse(fs.readFileSync(path.join(root, "invite.json"), "utf8"));
const opts = { roofFigure: true, rider: true, ...(invite.options ?? {}) };
const STYLE = theme.style;
const ANCHOR = "Use the reference image(s) ONLY for painting technique, brushwork, colour handling and texture — do not copy any object, building or person from them.";
const ISO = "Isolated on a plain flat light grey (#D9D9D9) background, full subject visible with a margin, no ground, no cast shadow, nothing else.";
// pale cloth vanishes against light grey; a mid grey keeps every fold separable
const ISO_DARK = ISO.replace("light grey (#D9D9D9)", "medium grey (#7A7A7A)");

const have = (n) => ["png", "jpg"].some((e) => fs.existsSync(path.join(root, "img", `${n}.${e}`)));
const jobs = [];
const job = (name, o) => jobs.push({ name, status: have(name) ? "ready" : "missing", model: "nano_banana_2_1", resolution: "2K",
  save_as: `img/raw/${name}.jpg`, ...o });

job("wall", { aspect_ratio: "21:9", refs: ["style:style_wall.jpg"], prompt:
  `${ANCHOR} Paint a long, perfectly front-on (orthographic, no perspective) panoramic street facade, completely EMPTY — no doors, no windows, no people, no shops, no signs, no decorations: ${theme.wall.prompt}. ` +
  `Layout from top to bottom: top 12% a flat parapet/roof edge against a thin strip of sky; from 23% to 34% a continuous horizontal decorative band running the full width; 34%–77% plain wall surface with gentle weathering; ` +
  `77%–83% a raised plinth or footpath step; bottom 17% the street surface. Evenly lit and consistent from left to right so it can scroll sideways. ${STYLE}.` });
job("window", { aspect_ratio: "3:4", refs: ["style:style_cutout.png"], prompt:
  `${ANCHOR} A single isolated architectural cut-out, front-on: ${theme.window.prompt}. The opening in the middle is filled with a perfectly flat, solid pure magenta #FF00FF colour — nothing painted inside it. ` +
  `Outside the window: a plain flat light grey (#D9D9D9) background. No wall, no shadow, nothing else. ${STYLE}.` });
job("banner", { aspect_ratio: "3:4", refs: ["style:style_cutout.png"], prompt:
  `${ANCHOR} A single isolated object, perfectly front-on and flat: a large rectangular ${theme.banner.prompt}. Hanging straight down, the top edge straight, completely blank — no text, no motif in the middle. ${ISO_DARK}` });
if (opts.roofFigure) job("roof", { aspect_ratio: "1:1", refs: ["style:style_cutout.png"], prompt:
  `${ANCHOR} A single isolated figure from the waist up, front view: ${theme.roof.prompt}. Cut off cleanly at the waist with a straight horizontal edge. ${ISO} ${STYLE}.` });
if (opts.rider) {
  const couple = invite.photos?.rider_couple && invite.photos?.couple?.length;
  job("rider", { aspect_ratio: "4:3", refs: couple ? invite.photos.couple.map((p) => `photo:${p}`) : ["style:style_cutout.png"], prompt: couple
    ? `Paint the two people in the reference photos — keep their faces, skin tones, hair and build faithful — dressed as a wedding couple, riding together on this: ${theme.rider.prompt.replace(/ridden by.*|with a (young )?(man|woman|driver).*/i, "")}. Seen exactly from the side, facing RIGHT. ${ISO} ${STYLE}.`
    : `${ANCHOR} A single isolated subject seen exactly from the side, facing RIGHT: ${theme.rider.prompt}. ${ISO} ${STYLE}.` });
}
for (const p of theme.props ?? []) job(p.name, { aspect_ratio: { shopfront: "3:4", door: "2:3", hang: "2:3", wall: "4:3", people: "16:9" }[p.role] ?? "1:1",
  refs: ["style:style_cutout.png"], prompt: `${ANCHOR} A single isolated cut-out, front-on: ${p.prompt}. ${ISO} ${STYLE}.` });

// plates: only those the ceremonies use (plus any day plate a night plate is edited from)
const plates = new Set((invite.events ?? []).map((e) => e.plate));
for (const id of [...plates]) if (theme.plates?.[id]?.edit_of) plates.add(theme.plates[id].edit_of);
for (const id of plates) {
  const ev = (invite.events ?? []).find((e) => e.plate === id);
  const pl = theme.plates?.[id];
  if (ev?.plate_photo) {
    job(id, { model: "gpt_image_2_5_sunburst", resolution: "2K", aspect_ratio: "9:16", refs: [`photo:${ev.plate_photo}`, "style:style_plate_day.jpg"], prompt:
      `Repaint the place in the first reference photo as an original vertical painting in the style of the second reference (${STYLE}); keep the architecture, layout and landmarks of the photo recognisable, remove people, cars and signage, ` +
      `and leave the top 35–40% as calm open sky with plenty of empty space for text.${ev.look === "night" ? " Make it night: deep navy sky, warm festive lights." : ""}` });
  } else if (pl?.edit_of) {
    job(id, { aspect_ratio: "9:16", refs: [`job:${pl.edit_of}`], prompt:
      `Repaint this exact same painting, keeping the composition, buildings and figures in exactly the same places: ${pl.prompt}. Keep the top 35% empty for text. Same painting style and paper texture.` });
  } else if (pl) {
    job(id, { aspect_ratio: "9:16", refs: [pl.look === "night" ? "style:style_plate_day.jpg" : pl.look === "sky" ? "style:style_plate_sky.jpg" : "style:style_plate_day.jpg"], prompt:
      `${ANCHOR} Paint an original vertical painting: ${pl.prompt}. The top 35–40% of the image is calm, open sky with plenty of empty space for text. ${STYLE}.` });
  } else {
    jobs.push({ name: id, status: have(id) ? "ready" : "missing", note: `event plate "${id}" is not in theme.plates — add a prompt to theme.json or set plate_photo on the event` });
  }
}
if (invite.photos?.couple?.length) job("portrait", { aspect_ratio: "3:4", refs: invite.photos.couple.map((p) => `photo:${p}`), prompt:
  `Paint the two people in the reference photos as a ${STYLE} wedding portrait — keep their faces, skin tones, hair and likeness faithful — in ${theme.portrait_attire ?? "elegant wedding clothes that suit the place"}, ` +
  `inside an ornate ${theme.portrait_frame ?? "antique gilded"} picture frame shown front-on. ${ISO}` });

// a job that edits another job's result has to wait for it
jobs.sort((a, b) => (a.refs ?? []).some((r) => r.startsWith("job:")) - (b.refs ?? []).some((r) => r.startsWith("job:")));
fs.writeFileSync(path.join(root, "art_jobs.json"), JSON.stringify(jobs, null, 1));
const miss = jobs.filter((j) => j.status !== "ready");
console.log(jobs.map((j) => `${j.status === "ready" ? "✓" : "·"} ${j.name.padEnd(16)} ${(j.aspect_ratio ?? "").padEnd(5)} ${(j.refs ?? []).join(", ")}${j.note ? "  ! " + j.note : ""}`).join("\n"));
console.log(`\n${miss.length} to generate (${miss.length} credits on nano_banana_2_1 at the time of writing) → ${path.join(root, "art_jobs.json")}`);
