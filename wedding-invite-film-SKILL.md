---
name: wedding-invite-film
description: "Make personalised animated wedding invitation videos (9:16, set to the couple's song) in a hand-painted street-scroll style: one continuous camera along a painted street with a rickshaw/Vespa/carriage riding along, an elder on the roof unrolling a cloth banner with the invitation, zoom-throughs of ornate windows into paintings of each ceremony (Mehendi, Sangeet, Haldi, Pheras, Nikah, welcome, ceremony, reception), and a venue banner. Customise names, ceremonies, language, the couple's photos, music and the place: 16 themes (Rajasthan, Udaipur, Kerala, Goa, Varanasi, Punjab, Chettinad, Mughal, Santorini, Tuscany, Paris, Lake Como, Bali, Scotland, Kyoto, Marrakech), any new place, or matched to a reference invite. HTML/CSS/JS + Playwright; paintings via the Atlabs MCP (required). Use for any wedding invite video, e-invite, shaadi card video, save-the-date or engagement reel, WhatsApp/Instagram invitation, destination-wedding invite, or edits to one."
---

# Wedding invite film

One continuous painted camera move, timed to the couple's song:

1. **Street** – the camera trucks along a painted street wall (props, monogram); a rider travels with it.
2. **Roof + banner** – tilt up to an elder on the roof; a cloth banner unrolls with falling petals; the invitation writes on
   line by line (feathered left→right wipes); the banner rolls back up.
3. **Window zoom-through** – the camera flies into an ornate window and the painting inside becomes the full screen.
   Two ceremonies per window (day→night cross-fade, or a text swap on the same painting), petals or stars per ceremony.
   Pull back out, truck to the next window… as many windows as the ceremonies need.
4. **Venue banner** – a second banner unrolls with the venue and the families' sign-off, held to the song's end.

Everything is data: `invite.json` (words, ceremonies, photos, song), `theme.json` (the place), `img/` (paintings).
`plan.js` fits the timing to any song length; `scenes.js` draws `seek(t)`; `scripts/render.mjs` renders it with Playwright.

```
SK=<this skill's folder>          e.g. ~/.claude/skills/wedding-invite-film
PY=<python with numpy scipy pillow rembg>   ~/.claude/video-env/bin/python if it exists, else python3
```

## 0. Hard rule — connect the Atlabs MCP first

Every painting in the film (street wall, window, banner cloth, roof figure, rider, props, ceremony paintings, the couple's
painted portrait) is generated through the **Atlabs MCP**. Check it before anything else:

1. Call `get_account`. If it answers, note the credit balance and go on.
2. If the Atlabs tools are not available, stop and give the user these steps, then wait:
   > This skill paints every scene with the **Atlabs MCP** — please connect it first:
   > 1. Account: https://app.atlabs.ai (generations use credits; a new place ≈ 13–15, the Rajasthan theme 0).
   > 2. Claude Code: `claude mcp add --transport http atlabs https://mcp.atlabs.ai/mcp`, then `/mcp` → **atlabs** → sign in.
   >    (Installed as a plugin, it is already added — just `/mcp` → atlabs → sign in.)
   >    Claude Desktop / claude.ai: Settings → Connectors → Add custom connector → `Atlabs`, `https://mcp.atlabs.ai/mcp` → Connect.
   > 3. Tell me when it's connected.
3. Before generating, tell the user how many paintings are missing and the credit cost (from `art_jobs.mjs`).

The `rajasthan` theme (and `santorini`) ship with finished paintings, so a text-only invite in those places needs no
generation — but anything new (another place, the couple's photos, a new ceremony painting) goes through Atlabs.
Tool-by-tool process: `references/atlabs-mcp.md`.

Local tools: Node 18+, ffmpeg, Playwright (`cd $SK && npm install`; Chromium via `npx playwright install chromium`),
and `$PY -m pip install -r $SK/requirements.txt`.

## 1. Brief — one AskUserQuestion round, then fill gaps yourself
Ask only what you can't infer: **names** (and how to write them: "Mohini with Rishabh", "Anna & Tom"), **place**
(the list in `references/themes.md`, "a new place: …", or "like this reference video"), **ceremonies** with
date/time/dress code, **venue + city**, **sign-off** (families' names), **song** (file + which part — or an original
instrumental from Atlabs), **language/greeting** (॥ श्री गणेशाय नमः ॥, ੴ, بسم الله, none…) and **photos** (optional: couple
photos for a painted portrait or the couple riding the scooter; a venue photo to repaint). Never invent parents' names;
if dates or venue are unknown, use clear placeholders and say so at delivery. Use photos only when the sender says they are
the couple or have the couple's consent.

If they sent a **reference invite video**, follow `references/from-a-reference.md` first (measure it, then pick or write
the theme that matches it).

## 2. Scaffold
```bash
node $SK/scripts/new_invite.mjs ~/Downloads/<couple>-invite --theme <id> --names "Mohini,Rishabh" --song song.mp3 [--start 12 --end 95]
```
Copies the engine, merges the theme into `theme.json`, downloads its fonts, copies cached paintings, cuts the song to
`audio/song.wav`, detects BPM, writes `spec.json` and an example `invite.json`. 60–100 s of song suits 3–5 ceremonies.
No song file? Generate an original instrumental with Atlabs `generate_music` (`references/atlabs-mcp.md`) and pass it as `--song`.
Running it again with a new `--song/--start/--end` keeps `invite.json`, `theme.json` and the art.

## 3. Write `invite.json` — `references/customise.md`
Line kinds: `native` (greeting in the script font) · `body` · `small` · `sub` · `name` · `with` · `title` · `div` (fleuron).
Each ceremony: `{id, plate, look: day|night|sky|dusk, particles, stars, lines}`; `plate` names a painting in
`theme.plates` (or a new one you add). Keep lines short (≤ 42 characters, `<br>` to break), ≤ 8 lines per ceremony.
Then `node $SK/scripts/plan.mjs <project>` — prints the timeline, ceremony length and any problem (song too short…).

## 4. Paintings with Atlabs — `references/atlabs-mcp.md`, `references/art.md`
```bash
node $SK/scripts/art_jobs.mjs <project>          # → art_jobs.json: every missing painting with model, ratio, refs, prompt
```
1. `start_upload` + PUT the style anchors you need (`$SK/assets/style/*`) and any couple/venue photos; keep the media ids.
2. `generate_image` for every missing job in one turn (model, `aspect_ratio`, `resolution: "2K"`, prompt, `reference_media_ids`
   from its `refs`: `style:` anchor id, `photo:` the photo's id, `job:` another job's result id — those run after it).
3. `get_result` each request; `curl -o <save_as> <url>` into `img/raw/`.
4. `$PY -I $SK/scripts/cutout.py <project>` — cuts out props, punches the window's magenta opening, writes `img/manifest.json`.
5. `$PY -I $SK/scripts/sheet.py <project>` → `out/check_sheet.jpg` (cut-outs on green). **Read it.** Regenerate any painting
   with leftover background, holes in a pale subject, a closed window, readable text, or a rider facing left.

## 5. Look, then render
```bash
node $SK/scripts/render.mjs <project> --stills     # → out/stills/sheet.jpg — one frame per beat; READ it
node $SK/scripts/render.mjs <project> --draft      # 360×640 with music, ~1.5 min — timing check
node $SK/scripts/render.mjs <project> --scale 1.5  # final 1080×1920 → out/final.mp4 (~10–15 min)
```
Check the sheet for: text overflowing the banner or crossing busy parts of a painting, props cut by the frame, the roof
figure and props sitting on the wall's ledge/plinth lines (else fix `theme.wall` fractions — `references/themes.md`),
legible text on every sky. Live preview with a scrubber: `node $SK/scripts/render.mjs <project> --serve` → `/index.html?hud`.
Frames are JPEG in the OS temp folder: a 90 s 1080p film needs ~3 GB free — check `df -h` first.

## 6. Deliver
```bash
cp <project>/out/final.mp4 ~/Downloads/<couple>-wedding-invite.mp4
ffmpeg -i <project>/out/final.mp4 -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart ~/Downloads/<couple>-wedding-invite-share.mp4
```
Send both (full quality + share size). Report: place, ceremonies, length, Atlabs models and credits used, placeholders still
to confirm, and that wording changes need only `invite.json` + one render. If the music is the user's file, remind them they
need the rights to share it publicly.

## Iterating (cheap → expensive)
| request | change |
|---|---|
| names, dates, wording, add a line | `invite.json` → stills → render |
| different song or part of it | `new_invite.mjs <project> --song … --start … --end …` (keeps words and art) → render |
| ceremony order / two-per-window | reorder `events`, `options.perWindow` |
| text colour/size, petals, stars | `theme.looks`, event `particles`/`stars`, `style.css` |
| new painting for one ceremony | add it to `theme.plates`, point the event's `plate` at it, `art_jobs` → generate one |
| the couple in the film | `photos.couple` (+ `rider_couple: true`) → `art_jobs` → generate `portrait` / `rider` |
| a different place | new project with another `--theme` (copy `invite.json` over; paintings regenerate) |
| a place not in the list | write a theme (`references/themes.md`), then the normal flow |

## Files
`template/` engine (plan.js, scenes.js, engine.js, style.css, fonts) · `themes/*.json` 16 places + `_defaults.json` ·
`assets/themes/{rajasthan,santorini}/img` finished paintings · `assets/style` style anchors ·
`scripts/` new_invite, art_jobs, cutout.py, sheet.py, tempo.py, plan, render ·
`references/` atlabs-mcp.md, art.md, customise.md, themes.md, from-a-reference.md.


---

<!-- references/atlabs-mcp.md -->

# The Atlabs MCP — what the skill uses it for, call by call

Endpoint `https://mcp.atlabs.ai/mcp` (HTTP, OAuth sign-in). Every generation spends the user's Atlabs credits.

## 1. Check the connection and credits
`get_account` → name, plan, credit balance. If the tool is missing, stop and give the connection steps from SKILL.md §0.
Before generating, say: "N paintings to make, ≈ N credits on Nano Banana 2.1 — you have B."

## 2. Upload what the paintings are based on
`start_upload(file_name, content_type)` returns a one-time `upload_url`; then
```bash
curl -X PUT -H "Content-Type: image/jpeg" --upload-file <file> "<upload_url>"     # → {"media_id": …}
```
Upload, once per session, only what the jobs reference:
- style anchors from `$SK/assets/style/` — `style_wall.jpg` (wall), `style_cutout.png` (all cut-outs),
  `style_plate_day.jpg` / `style_plate_sky.jpg` (ceremony paintings);
- the couple's photos (`photos.couple`) and any venue photo (`events[].plate_photo`).
If the PUT cannot connect (sandboxed environment), use `upload_from_browser` → `get_upload_result` instead.
Never upload the same file twice — reuse its media id; results of earlier generations already have ids.

## 3. Generate
`generate_image` with the job's fields from `art_jobs.json`:
```
model: nano_banana_2_1 (default) | gpt_image_2_5_sunburst (repainting a real venue photo)
aspect_ratio: as listed (21:9 wall, 3:4 window/banner/shopfront, 1:1 roof, 4:3 rider, 9:16 ceremony paintings…)
resolution: "2K"
prompt: as listed (already contains the style line and the background/cut instructions)
reference_media_ids: the ids for its refs
```
Send all independent jobs in one turn — they run in parallel (≈ 1 credit each). Jobs whose refs say `job:<name>`
(night or sunset repaints of a day painting) need that job's result id, so send them after it finishes.
`list_models(tool="generate_image")` shows other models and ratios if a job needs something else.

## 4. Collect
`get_result(request_id)` waits up to 45 s per call (call again while it says processing). The result has `outputs[0].url`
and a `media_id`. Download to the job's `save_as`:
```bash
curl -s -o <project>/img/raw/<name>.jpg "<url>"
```
Keep the `media_id` for any job that edits it (`job:` refs) or for a later fix.

## 5. Fix one painting
Regenerate just that job (same prompt, maybe one clarifying sentence: "the shutters are wide open", "facing right",
"no text on the sign", "background medium grey #7A7A7A" for pale objects), download over the old raw file, re-run
`cutout.py <project> <name>` and `sheet.py`.

## 6. Optional: an original song
If the couple has no music (or no rights to theirs), `generate_music` makes an original instrumental — e.g.
"warm Indian wedding instrumental, shehnai and santoor over soft dholak, 84 BPM, joyful and graceful, 90 seconds"
(or "acoustic guitar and strings, Mediterranean, 90 BPM" for a Santorini invite). `list_models(tool="generate_music")`
for durations; `get_result`; download the mp3 and pass it to `new_invite.mjs --song`. Tell the user the cost first.

## Models used
- **Nano Banana 2.1** — every street, prop, window, banner, roof figure, rider and ceremony painting; day→night repaints
  (the day painting as the only reference keeps the composition, so the cross-fade reads as time passing); the couple's
  portrait from their photos (keeps likeness).
- **GPT Image 2.5 Sunburst** — repainting the couple's real venue photo into the theme's style.


---

<!-- references/art.md -->

# Paintings with Atlabs

## The set a film needs
| file | what | ratio | cut |
|---|---|---|---|
| `wall` | empty street facade, front-on, 23–34 % band, 77–83 % plinth | 21:9 | none (JPEG) |
| `window` | portal window, shutters open, **magenta opening** | 3:4 | rembg + magenta punch (kept full size; it is zoomed ×5) |
| `banner` | blank cloth with a fringe | 3:4 | solid |
| `roof` | elder, waist-up, straight cut at the waist | 1:1 | cut-out |
| `rider` | vehicle + rider, side view **facing right** | 4:3 | cut-out |
| 5 props | shopfront · people · door · hang · wall | various | cut-out (door = solid) |
| plates | one per distinct ceremony painting, 9:16, open sky on top | 9:16 | none |
| `portrait` (opt.) | the couple, painted and framed, from their photos | 3:4 | solid |

## Recipe
- Model: `nano_banana_2_1`, 2K (≈ 1 credit each). For a couple's venue photo: `gpt_image_2_5_sunburst`.
- **Style anchors** (`assets/style/`): `style_wall.jpg` for the wall, `style_cutout.png` for cut-outs,
  `style_plate_day.jpg` / `style_plate_sky.jpg` for plates. Upload each once per session and reuse the ids. Every prompt
  says to use them only for technique — they keep different places looking like one hand painted them.
- Night or sunset versions: pass the **day plate's result** as the only reference and ask to "repaint this exact same
  painting … at night" — the composition stays put, so the cross-fade reads as time passing, not a cut.
- Fire all independent jobs in one turn; `get_result` each, then `curl -o <save_as> <url>`.

## Checks before building
Make a sheet of the cut-outs on a green background (one PIL/ffmpeg call) and look:
- background fully gone (no grey halo); window opening transparent; banner blank, no text; rider facing right;
- the roof figure ends in a straight waist line; nothing in the art has readable text or logos;
- plates: sky area really empty and calm (text sits there), horizon not too high.
Regenerate a single job rather than patching pixels. If rembg eats into a pale subject (white walls, linen), add its name
to the `solid` set in cutout.py or regenerate on a darker grey background.

## People and places
- Generated people are generic locals — never a recognisable real person. The couple appear only from their own photos.
- Landmarks may be painted (fort, lake palace, pagoda); keep religious sites respectful — exteriors, lamps, gardens,
  no deities as decoration.
- Ask for "no readable text" on signs, posters and noren; text belongs to the HTML layer, not the painting.


---

<!-- references/customise.md -->

# invite.json — everything the couple can change

```jsonc
{
  "song": { "file": "audio/song.wav", "bpm": 84.1, "first_beat": 0.19 },   // written by new_invite.mjs; ceremony changes snap to beats
  "monogram": { "left": "M", "right": "R", "joiner": "✦", "caption": "Mohini & Rishabh" },   // painted on the street wall
  "invitation": [ /* lines on the first banner */ ],
  "events": [
    { "id": "mehendi", "plate": "fort_day", "look": "day", "particles": "marigold",
      "text_top": 74,                       // optional: px from the top for this ceremony's text block
      "plate_photo": "photos/venue.jpg",    // optional: repaint the couple's own venue photo as this plate
      "lines": [ /* … */ ] }
  ],
  "venue": [ /* lines on the last banner */ ],
  "photos": {
    "couple": ["photos/us1.jpg", "photos/us2.jpg"],   // → a painted, framed portrait on the street wall
    "rider_couple": true                               // → the couple ride the theme's scooter/rickshaw/carriage
  },
  "options": { "perWindow": 2, "roofFigure": true, "rider": true }
}
```

## Line kinds
| k | looks like | use for |
|---|---|---|
| `native` | 23 px, the theme's script font | greeting in Devanagari, Gurmukhi, Tamil, Malayalam, Urdu, Japanese… |
| `body` | 21 px serif | sentences, times, dress codes |
| `small` | 15 px spaced caps | VENUE, YOUR PRESENCE… |
| `sub` | 23 px serif | sub-titles, dates |
| `name` | 68 px display | the couple's names on the invitation banner |
| `with` | italic 25 px | "with", "&", "weds", "with love," |
| `title` | 46 px display (38 px on banners) | ceremony names, venue name |
| `div` | fleuron divider (no text) | between description and the date block |

Text may hold `<br>`, `<sup>th</sup>`, `&amp;`. Keep each line under ~42 characters (≈ 28 for `title`, 12 for `name`).

## Ceremonies
- Order = screen order. Two per window by default (`options.perWindow`); 3 ceremonies → windows of 2 + 1.
- `look` picks the text colour/glow from `theme.looks`: `day` (dark text on pale sky), `night` (ivory on navy),
  `sky` (for blue skies), `dusk` (deep plum on pale sunset skies). Add your own look to `theme.json`.
- Same `plate` twice in a row → text swap on the same painting (Haldi → Saat Phere). Different plates → cross-fade
  (day → night).
- `particles`: marigold · haldi · rose · jasmine · blossom · lavender · confetti · gold · bougainvillea · frangipani.
  `stars: true` adds twinkling stars (night plates).
- Common sets — Hindu: Mehendi, Haldi, Sangeet, Pheras/Saat Phere, Reception · Sikh: Maiyan, Jaggo, Anand Karaj ·
  Muslim: Mehndi, Nikah, Walima · Christian: Rehearsal dinner, Ceremony, Reception · Tamil: Nichayathartham, Muhurtham ·
  Bengali: Aiburobhat, Gaye Holud, Biye · destination: Welcome evening, Ceremony, Reception, After-party.
  Write ceremony names the way the family says them.

## Photos (only with the couple's consent)
- `photos.couple`: 1–3 clear, well-lit photos of both faces. `art_jobs.mjs` adds a `portrait` job (painted in the theme's
  style, in a frame) placed beside the monogram, and with `rider_couple: true` turns the rider into the couple.
  Upload each photo with `start_upload`; pass the ids where the job says `photo:`.
- `events[].plate_photo`: a photo of their real venue, repainted (gpt_image_2_5_sunburst) with open sky for the text.
- Check likeness in the result before rendering; if a face drifts, regenerate with the clearest photo first.

## Languages and fonts
Theme fonts: `display`, `body`, `body_italic`, `script` (monogram), `native` (greeting). Swap any in `theme.json`
(`{ "family", "file", "url" }`; new_invite.mjs downloads `url` into `fonts/`). Google Fonts paths that work:
Devanagari `ofl/tirodevanagarihindi/TiroDevanagariHindi-Regular.ttf` · Gurmukhi `ofl/tirogurmukhi/TiroGurmukhi-Regular.ttf` ·
Tamil `ofl/tirotamil/TiroTamil-Regular.ttf` · Bangla `ofl/tirobangla/TiroBangla-Regular.ttf` · Telugu `ofl/tirotelugu/TiroTelugu-Regular.ttf` ·
Kannada `ofl/tirokannada/TiroKannada-Regular.ttf` · Gujarati `ofl/notoserifgujarati/NotoSerifGujarati%5Bwght%5D.ttf` ·
Malayalam `ofl/notoserifmalayalam/NotoSerifMalayalam%5Bwght%5D.ttf` · Urdu `ofl/notonastaliqurdu/NotoNastaliqUrdu%5Bwght%5D.ttf` ·
Japanese `ofl/shipporimincho/ShipporiMincho-Regular.ttf` · Greek/Latin display `ofl/italiana/Italiana-Regular.ttf`, `ofl/cinzel/Cinzel%5Bwght%5D.ttf`
(prefix `https://github.com/google/fonts/raw/main/`). Whole invitations in Hindi/Tamil/etc. work too: use `native`
lines throughout, or set `body` to the script font.


---

<!-- references/themes.md -->

# Places (themes)

| id | place | rider | window | ceremonies the paintings suit |
|---|---|---|---|---|
| `rajasthan` ★ | Jaipur bazaar, hill fort, peacock tower | cycle rickshaw | painted jharokha | mehendi · sangeet · haldi · wedding · reception |
| `udaipur` | white lake palaces | horse tonga | marble jharokha | lake day/night, island pavilion |
| `kerala` | tharavadu, backwaters, temple lamps | auto-rickshaw | teak window | houseboat, temple night, beach |
| `goa` | Portuguese quarter, churches, beach | Vespa | blue-shuttered window | church, beach night, river sunset |
| `varanasi` | ghats, aarti | cycle rickshaw | carved stone window | ghats dawn, aarti night, boat |
| `punjab` | Amritsar haveli, mustard fields | decorated tractor | carved wood window | fields, haveli night, village |
| `chettinad` | Chettinad mansion, gopuram | bullock cart | Burma-teak window | gopuram, temple tank, grove |
| `mughal` | Agra/Lucknow marble & sandstone | tonga | marble window | marble mausoleum day/moonlit, pavilion · nikah · walima |
| `santorini` ★ | Cycladic island | Vespa | blue shutters | caldera day/sunset, terrace night |
| `tuscany` | villa and vineyards | bicycle with sunflowers | green shutters | vineyard, courtyard night, hill town |
| `paris` | Haussmann boulevard | bicycle with peonies | French window | Seine day/night, Montmartre |
| `lake-como` | lakeside villa | Vespa | villa arch | lake day, terrace night, gardens |
| `bali` | temples, rice terraces | scooter with offerings | gilded carved window | rice terraces, cliff temple, beach torches |
| `scotland` | highland castle | horse carriage | Gothic window | loch castle, great hall, moor |
| `kyoto` | machiya lanes, blossom | jinrikisha | round moon window | pagoda, lantern lane, torii path |
| `marrakech` | riad and souk | donkey cart | keyhole arch | riad courtyard, desert camp, kasbah |

★ ships with finished paintings (no credits for a text-only invite). Others generate ~13 paintings (~13 Atlabs credits) on first use.
Mixing is fine: a Rajasthani street with a Udaipur lake plate — add the plate to `theme.json` and point an event at it.

## Theme file (themes/<id>.json, merged over _defaults.json into the project's theme.json)
```jsonc
{
  "id": "goa", "name": "Goa — Portuguese quarter", "region": "india",          // region picks default ceremonies
  "palette": { "wall": "#E3B23C", "ink": "#1F4E8C", "accent": "#B4245D" },  // background · banner text · monogram
  "fonts":   { "display": {...}, "native": {...} },                         // see customise.md
  "looks":   { "day": { "color": "#1F4E8C", "glow": "rgba(255,255,255,.95)" } },
  "particles": "bougainvillea", "greeting": "",
  "style": "near-photoreal gouache painting, …",                            // appended to every prompt
  "wall":   { "prompt": "…", "ledge": 0.227, "band_bottom": 0.343, "plinth": 0.794, "street": 0.954 },
  "window": { "prompt": "…" }, "banner": { "prompt": "…" }, "roof": { "prompt": "…" }, "rider": { "prompt": "…" },
  "rider_width": 340,
  "props":  [ { "name": "taverna", "role": "shopfront|people|door|hang|wall", "prompt": "…", "size": 600 } ],
  "plates": { "church_day": { "prompt": "…", "look": "sky" }, "beach_night": { "prompt": "…", "look": "night", "stars": true, "edit_of": "…" } },
  "ceremonies": { "mehendi": { "plate": "sunset", "particles": "bougainvillea" } }
}
```

## Writing a new place
1. Copy the closest theme to `themes/<new-id>.json`.
2. **wall** – describe only materials, colours and the horizontal band (cornice, lattice, balcony rail, tiles). The art prompt
   adds the fixed layout (band at 23–34 %, plinth at 77–83 %, street below), which the engine depends on.
3. **window** – the portal. Any opening works (arch, round, keyhole, French doors) as long as shutters are *open* and the
   opening is described; the prompt asks for a magenta fill that cutout.py punches out.
4. **banner** – the local cloth (khadi, linen + lace, washi, tartan-edged wool, batik) with something along the bottom edge.
5. **roof** – a welcoming local elder, waist-up. **rider** – a local vehicle seen from the side, facing right.
6. **props** – five: one `shopfront` (~600 px tall), one `people` group (seated musicians work best), one `door`,
   one `hang` (garlands, lanterns, bougainvillea), one `wall` (frames, plates, tiles, scrolls).
7. **plates** – 3 paintings with open sky in the top 35–40 %; a `night` version as `edit_of` the day plate gives the
   reference's day→night moment.
8. **ceremonies** – map the culture's ceremony ids to plates.
After generating, if the roof figure floats or props stand in the street, measure the wall painting: open `img/wall.jpg`,
read the y of the band's top edge (ledge), its bottom (band_bottom), the plinth top (plinth) and where wheels should
touch the street (street), as fractions of the height, and put them in the project's `theme.json`.


---

<!-- references/from-a-reference.md -->

# Starting from a reference invite video

The skill was built by replicating a 9:16 Rajasthani street-scroll invite (82 s, 84 BPM). Its grammar is the engine's
default; this is how to match another reference of the same family (an invite they saw on Instagram/WhatsApp).

## 1. Measure it
If the `video-replicator` skill is installed, run its analyser; otherwise ffmpeg alone is enough:
```bash
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate ref.mp4
ffmpeg -i ref.mp4 -vf "fps=1,scale=180:-1,tile=9x10" -frames:v 1 contact.jpg          # one frame per second
ffmpeg -ss <t> -t 3 -i ref.mp4 -vf "fps=8,scale=200:-1,tile=8x3" -frames:v 1 move.jpg  # any transition, frame by frame
```
Look at the sheets and write down: the place (architecture, materials, colours), the window type, the banner cloth, who is
on the roof, what rides along, the props, each ceremony painting (subject, day/night, sky colour), text colours and fonts
(display serif? script?), and the timeline (when the banner drops, each zoom-through, each ceremony, the venue banner).

## 2. Map it to a theme
- Same place as a ready theme → use it; adjust `looks` colours and fonts to the reference.
- New place → write `themes/<id>.json` (`references/themes.md`) from your notes; describe things in your own words —
  never copy the reference's paintings, logos or text.
- Timing: the planner already uses the reference grammar (intro 6.6 s, banner 2.2 s, lines 0.74 s apart, zoom 1.5 s,
  pull-out 1.4 s, truck 2.4–3.8 s). If the new reference is clearly faster or slower, scale those constants in
  `plan.js` in the project (not the skill).

## 3. Style anchors
Upload 2–3 frames of the reference as extra style references for the art jobs, with the same instruction the prompts
already carry: use them only for technique, palette and texture — the subjects are the couple's own.

## 4. Music
The reference's soundtrack belongs to someone else. Use the couple's own song file (their responsibility to have the
rights) or an original Atlabs instrumental at a similar tempo.
