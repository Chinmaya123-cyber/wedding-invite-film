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
