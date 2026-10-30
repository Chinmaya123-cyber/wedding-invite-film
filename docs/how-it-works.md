# How it works

```
 your details ──► invite.json ─┐
 the place ─────► theme.json ──┼─► plan.js ─► scenes.js (seek t) ─► Playwright frames ─► ffmpeg + song ─► final.mp4
 Atlabs MCP ────► img/*.png ───┘   (timing      (draws every frame
   (paintings,     manifest.json    fitted to    as a pure function
    cut-outs)                       the song)    of time)
```

## The film grammar (from the reference invite this skill was built on)
| time (82 s song) | what happens | engine |
|---|---|---|
| 0 – 6.6 s | camera trucks right along the painted street, tilts up to the roof | `cam.x`, `cam.y` keyframes |
| 6.9 – 9.1 | the cloth banner unrolls from the roof, petals fall | clip-path reveal + a rolling bar |
| 9.3 – 17 | invitation lines write on, one every 0.74 s | feathered mask wipe per line |
| 18 – 19.5 | banner rolls back up | |
| 22 – 23.5 | camera flies into the painted window; the painting inside becomes full screen | world zoom ×5 + cross-fade |
| 23.5 – 40.5 | two ceremonies on that painting (day → night cross-fade) | plates with slow Ken Burns |
| 40.5 – 42 | pull back out through the window | |
| 42 – 47 | truck to the next window, zoom in | |
| 47 – 65.5 | two more ceremonies (text swap on the same painting) | |
| 66 – 70 | pull out, truck on | |
| 70 – end | venue banner unrolls, lines write on, hold | |

`plan.js` keeps these proportions for any song length and number of ceremonies: ceremonies stretch or shrink
(4.5–13 s each), everything else keeps its timing, and ceremony changes snap to the song's beat (tempo detected by
`tempo.py`).

## Layers
- **World** (6000+ px wide, 1400 tall): the wall painting tiled (every other copy mirrored), props on the plinth or hanging
  from the band, the monogram, the roof figure, banners, windows (each with its ceremony paintings behind the opening), and
  the rider, which travels with the camera.
- **Screen**: one layer per ceremony — the painting, petals or stars, and the text block.

## Why HTML/CSS/JS
Every frame is computed from the time alone, so frames render in parallel and any frame can be re-rendered on its own.
Text stays real text (crisp, any language, editable in `invite.json`); only the paintings are images.
