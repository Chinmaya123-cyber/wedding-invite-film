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
