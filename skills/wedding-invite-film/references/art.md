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
