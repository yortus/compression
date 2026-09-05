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

**`src/deck/` — the deck framework.** `slides.ts` is the single source of deck order: an array of
`{ id, act, title, component, tag, controls, fragments }`, 34 slides across 7 acts. `useDeck.ts`
owns the current slide and fragment and syncs them to the URL hash (`#/zigzag`, `#/zigzag/1`);
`DeckShell.vue` renders all the persistent chrome (ToC rail, title bar, stats HUD, control bar,
loupe) and binds the keys. Slide components live in `src/components/slides/`; the older
`src/components/steps/StepN*.vue` are the original JPEG walkthrough, still in use and reached
through the same registry.

**`src/stats/` — the always-on ratio.** A slide calls `useStat(id, () => StatSample)` in setup and
its numbers appear in the HUD; `StatSample` keeps `overheadBits` separate from `encodedBits` so the
shared-primer cost is visible. The registry also keeps a per-slide scoreboard, which `jpeg-pipeline`
reads back.

**`src/content/` — the words.** Per-slide prose in two registers (`speaker`, `learner`), keyed by
slide id. Learn mode (`L`) reveals every fragment and shows the learner text.

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
  pairs. There is no real bitstream, no DC differential coding, and no standard entropy tables —
  that's deliberate; it demos the idea in numbers the audience can follow. `engine/codecs/huffman.ts`
  is the general version, over an arbitrary symbol type, used by the Act 3 tree-building slide.
- **`estimateEncodedBits` is the one whole-image size figure**, shared by `why-care`, `jpeg-result`,
  `jpeg-pipeline` and the benchmark so they cannot disagree. It samples blocks via
  `sampleBlockIndices`, a golden-ratio sequence — *not* a fixed stride. Every sample image is 512px
  wide, so a channel is exactly 64 blocks across and a stride of `n / 64` silently measures one
  column of the image. That bug made line art report the same ratio at every quality setting.
- **`engine/formats/bmp.ts` is real BMP arithmetic**, not BMP-flavoured prose: the 54-byte header,
  four bytes per palette entry, rows padded to a four-byte boundary, and `BI_RLE8` encoded and
  decoded per spec. Act 1 is built on it, because the format's own compression field makes the
  act's argument — BMP has no 24-bit RLE mode, only palettised ones.
- **`engine/jpeg/stages.ts` prices the whole chain stage by stage** for the finale slide, and
  `compareScanOrders` there backs the zigzag comparison. Note what it found: reordering does *not*
  change the RLE pair count, and the DCT *reduces* order-0 entropy rather than increasing it.
- **Rendering is plain 2D canvas** (`getContext('2d')` + `putImageData`) inside each step, with a
  `watch` + `onMounted` redraw pair. `src/rendering/PixiCanvas.vue` and the `pixi.js` dependency
  are still unused — `basis-64` animates 64 sprites on a 2D canvas instead, deliberately, to avoid
  keeping a WebGL scene graph alive for one slide. `gsap` is used by `Step6Zigzag.vue` and
  `Basis64.vue`, the latter driving a GSAP timeline whose labels are wired to the deck's fragments.
- **Canvases that are CSS-scaled must size their backing store to the display size.**
  `imageSmoothingEnabled = false` governs drawing *into* a canvas, not the browser's scaling
  *of* one — a 1100px-wide backing store shown at 775px gets resampled smoothly every frame,
  which softens everything. `basis-2d` and `basis-64` size the store from
  `getBoundingClientRect() * devicePixelRatio` and scale the context, keeping the drawing code in
  fixed logical units. Their 8×8 panels also use `fillBlock8`, which snaps every cell to whole
  device pixels, because a station size that does not divide by 8 bands hard-edged art.
- **Greenscale lives in `src/rendering/shade.ts`** — `GREEN` (null for grey), `CONTRAST` for
  imagery and `PATTERN_CONTRAST` for basis patterns, which clip if stretched. Used by `basis-2d`
  and `basis-64` only; the engine's own `channelToImageData` stays greyscale for every other slide.
- **`basis-64` computes its reconstruction, it does not blend it.** DCT coefficients are signed, so
  additively blending the flying pattern sprites would look like superposition while being wrong.
  The sprites are narrative; the reconstruction panel runs a real `inverseDCT` weighted by each
  sprite's tween value. Keep it that way if the animation is ever changed.

### Adding or reordering a slide

Create `src/components/slides/*.vue`, wrap the content in `SlideLayout` (optional `column` prop, and
a `notes` slot that renders as a floating side note), wrap anything held back for the build in
`<Fragment :index="n">`, and add an entry to `SLIDES` in `src/deck/slides.ts` — that array is the
deck order, the ToC and the deep links. Declare which global controls the slide uses
(`controls: ['image', 'quality']`) and how many `fragments` it has. Publish numbers with `useStat`,
and put the prose in `src/content/`. `ExpandablePanel.vue` is the convention for "click to reveal
the maths/details" asides.

### Presentation styling

`src/styles/global.css` sets `html, body { font-size: 28px }` — all `rem` sizes are already scaled
for a projector, so a `0.9rem` label is normal body text here, not fine print. Colours come from the
dark-theme CSS custom properties there (`--bg*`, `--text*`, `--accent`, `--positive`/`--warning`/
`--negative`); use those rather than literal colours so slides stay consistent.
