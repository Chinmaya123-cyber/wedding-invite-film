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
