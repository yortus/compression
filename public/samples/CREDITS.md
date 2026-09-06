# Sample image credits

The sample set is chosen so that each image flatters or breaks a different compression
technique — that spread is what the "brittle and robust" slide measures.

## Photographs

Downloaded from Wikimedia Commons by `scripts/generate-samples.mjs` and downscaled hard
from much larger originals, which averages away the source JPEG's artifacts. Stored as
PNG so the deck's "raw pixels" really are raw.

| File | Source | Author | Licence |
|------|--------|--------|---------|
| `parrot.png` | [Eclectus roratus closeup.jpg](https://commons.wikimedia.org/wiki/File:Eclectus_roratus_closeup.jpg) | Bernard Spragg. NZ | CC0 |
| `forest.png` | [Birchwood Slavnoe 2012 G1.jpg](https://commons.wikimedia.org/wiki/File:Birchwood_Slavnoe_2012_G1.jpg) | George Chernilevsky | Public domain |
| `photo.jpg` | Pixabay (bell peppers) | Hans | Pixabay Content Licence |

## Generated

Everything else is generated deterministically by `scripts/generate-samples.mjs`, with the
pixel-art sprites hand-drawn in `scripts/pixelart.mjs`. No licence considerations.

| File | What it is for |
|------|----------------|
| `gradient.png` | smooth everywhere — banding, and nothing for RLE to find |
| `dither.png` | looks continuous but repeats nothing — defeats RLE; pairs against `gradient` |
| `graphic.png` | flat colour and hard edges |
| `flat.png` | solid blocks — the case RLE was invented for |
| `pixelart.png` | 192×192, packed with 8/16/32px sprites on the 8×8 block grid, for the DCT and quantisation slides |
| `lineart.png` | two colours, long runs — palettises exactly |
| `mosaic.png` | exact repetition, few colours |
| `text.png` | fine edges, where JPEG rings badly |
| `checker.png` | 2px checkerboard — the highest frequency an 8×8 block can hold |
| `sweep.png` | linear chirp across x, falling contrast down y — every frequency exactly once |
| `noise.png` | no redundancy at all, so nothing lossless can help |

## Rebuilding

```bash
node scripts/generate-samples.mjs           # fills in anything missing
node scripts/generate-samples.mjs --force    # rebuilds everything
```

The script skips files that already exist. That matters for `photo.jpg`, whose original
Pixabay URL now returns 403 — a blind rebuild would replace it with a synthetic fallback.
