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
