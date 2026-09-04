# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An interactive, keyboard-driven slide deck for a tech talk on compression, aimed at an SWE
audience. It walks through the JPEG encoding pipeline one step per "slide", with live controls
(quality slider, subsampling mode, block picker) so the presenter can demo each stage.

It is a vibe-coded talk prop, not a production encoder or a library. Optimise for *legibility on
a projector* and *demonstrating the idea*, not for correctness against ITU-T T.81 or for
performance beyond "the slider feels smooth". There are no tests, no linter, and no CI.

**Read [ROADMAP.md](ROADMAP.md) before making structural changes.** The deck is mid-restructure:
it is being rebuilt from a flat ten-step JPEG walkthrough into a seven-act narrative with a deck
framework, an always-on compression-stats layer, and generalised codecs. The architecture described
below is the *current* state, not the target.

`docs/compression-techniques-survey.md` is the talk's background material — a table of techniques
(T1–T22) and the pipelines that real formats compose from them. The app visualises the JPEG row
of that table.

## Commands

```bash
npm run dev      # vite dev server — the normal way to work and to present
npm run build    # vue-tsc -b && vite build — the only automated check that exists
npm run preview  # serve the production build

node scripts/generate-samples.mjs   # regenerate public/samples/* (needs sharp; downloads a
                                    # CC0 photo, falls back to a synthetic one offline)
```

Type errors only surface via `npm run build` (or the editor); the dev server will happily run
broken types.

## Architecture

Three layers, strictly one-directional:

**`src/engine/*.ts` — pure functions, no Vue, no DOM** (beyond `ImageData` in/out).
One file per pipeline stage: `colorspace` → `subsampling` → `blocks` → `dct` → `quantization` →
`zigzag` → `rle` → `huffman`. `pipeline.ts` composes them; `types.ts` holds the shared shapes
(`Block` is a row-major `number[][]` 8×8).

**`src/composables/useJpegPipeline.ts` — the single source of truth.** `createJpegPipeline()` is
instantiated once in `App.vue` and `provide`d under `PIPELINE_KEY`; every step `inject`s it. It
holds the inputs (`sourceImageData`, `quality`, `subsamplingMode`, `selectedBlockIndex`), a
`shallowRef` `PipelineCache` of every intermediate stage, and `computed`s that expose them.
There is no other state store.

**`src/components/steps/StepN*.vue` — one component per slide.** Each injects the pipeline, reads
the intermediate it needs, and draws it. `App.vue` holds the ordered `steps` array (component +
title) that drives both rendering and the `ProgressBar`; arrow keys / `?` / `Esc` are bound there.

### Things worth knowing before editing

- **Recompute paths.** Changing `quality` takes the `requantize` fast path (re-quantize +
  reconstruct only, debounced with `requestAnimationFrame`) so dragging the slider stays smooth.
  Changing `subsamplingMode` or the image re-runs `runFullPipeline`. Keep expensive new work out
  of the quality path.
- **Everything is synchronous on the main thread.** `ImagePicker` caps loaded images at 512px —
  that cap is the only reason the full pipeline is fast enough to feel interactive. Don't raise it
  without moving work off-thread.
- **`selectedBlockIndex` is an index into the *Y-channel* block array** and is shared by steps 3–8.
  Step 3 sets it (click the grid); steps 4–8 derive their whole display from it via
  `selectedBlock` / `selectedDCT` / `selectedQuantized` / `selectedZigzag` / `selectedRLE` /
  `selectedHuffman`.
- **The −128 level shift lives inside `forwardDCT`/`inverseDCT`**, not in the colorspace stage.
  Y/Cb/Cr stay in 0–255 through subsampling and block splitting.
- **Huffman is per-block and illustrative.** `encodeBlock` builds a fresh tree from one block's RLE
  pairs, and Step 9's compressed-size figure extrapolates that block's `totalBits` across all
  blocks. There is no real bitstream, no DC differential coding, and no standard entropy tables —
  that's deliberate; it demos the idea in numbers the audience can follow.
- **Rendering is plain 2D canvas** (`getContext('2d')` + `putImageData`) inside each step, with a
  `watch` + `onMounted` redraw pair. `src/rendering/PixiCanvas.vue` and the `pixi.js` dependency
  are currently unused; `gsap` is used only by `Step6Zigzag.vue`.

### Adding or reordering a slide

Create `src/components/steps/StepN*.vue`, wrap the content in `StepShell` (props `title`/`subtitle`,
default slot for content plus an optional `detail` slot that renders as a floating side note), and
add it to the `steps` array in `App.vue` — that array is the deck order and the progress-bar labels.
`ExpandablePanel.vue` is the convention for "click to reveal the maths/details" asides.

### Presentation styling

`src/styles/global.css` sets `html, body { font-size: 28px }` — all `rem` sizes are already scaled
for a projector, so a `0.9rem` label is normal body text here, not fine print. Colours come from the
dark-theme CSS custom properties there (`--bg*`, `--text*`, `--accent`, `--positive`/`--warning`/
`--negative`); use those rather than literal colours so slides stay consistent.
