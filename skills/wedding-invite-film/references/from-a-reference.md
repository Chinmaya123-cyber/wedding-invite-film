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
