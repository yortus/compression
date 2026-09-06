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
`engine/jpeg/` is one file per pipeline stage: `colorspace` → `subsampling` → `blocks` → `dct` →
`quantization` → `zigzag` → `rle` → `huffman`. `pipeline.ts` composes them; `types.ts` holds the
shared shapes (`Block` is a row-major `number[][]` 8×8). `engine/codecs/` holds the general,
format-independent coders the exploration slides use — `huffman`, `rle`, `lz77`, `arithmetic`,
`abbreviate`, `entropy`, `palette`, `planes`, `tokenise` — every one of them with a working
decoder and a round-trip case in `roundtrip.test.ts`.

**`src/composables/useJpegPipeline.ts` — the single source of truth.** `createJpegPipeline()` is
instantiated once in `App.vue` and `provide`d under `PIPELINE_KEY`; every step `inject`s it. It
holds the inputs (`sourceImageData`, `quality`, `subsamplingMode`, `selectedBlockIndex`), a
`shallowRef` `PipelineCache` of every intermediate stage, and `computed`s that expose them.
There is no other state store.

**`src/deck/` — the deck framework.** `slides.ts` is the single source of deck order: an array of
`{ id, act, title, component, tag, controls, fragments }`, 30 slides across 6 acts. `useDeck.ts`
owns the current slide and fragment and syncs them to the URL hash (`#/zigzag`, `#/zigzag/1`);
`DeckShell.vue` renders all the persistent chrome (ToC rail, title bar, control bar, loupe) and
binds the keys. The title bar is the slide's title and subtitle only — no act name, no numbers. Slide components live in `src/components/slides/`; the older
`src/components/steps/StepN*.vue` are the original JPEG walkthrough, still in use and reached
through the same registry.

**`src/rendering/` — the shared canvas vocabulary.** `usePhaseStage` (in `src/deck/`) owns the
stage machine every exploration slide runs on; `textGrid`, `ribbon`, `stamp`, `tokenColours` and
`shade` are the pieces they draw with. See "The exploration-slide pattern" below.

**`src/stats/` — the measured ratio.** A slide calls `useStat(id, () => StatSample)` in setup;
`StatSample` keeps `overheadBits` separate from `encodedBits` so the shared-primer cost is visible.
Nothing in the shell renders it any more — a slide that wants its numbers on screen draws them
itself, in the panel or stamp where they are made — so what `useStat` now feeds is the per-slide
scoreboard `jpeg-pipeline` reads back. `StatsHUD.vue` is the old always-on readout, kept but no
longer mounted anywhere.

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
  is the general version, over an arbitrary symbol type, used by the Codes act's `huffman-codes` slide
  over whole words and characters of real text.
- **`estimateEncodedBits` is the one whole-image size figure**, shared by `why-care`, `jpeg-result`,
  `jpeg-pipeline` and the benchmark so they cannot disagree. It samples blocks via
  `sampleBlockIndices`, a golden-ratio sequence — *not* a fixed stride. Every sample image is 512px
  wide, so a channel is exactly 64 blocks across and a stride of `n / 64` silently measures one
  column of the image. That bug made line art report the same ratio at every quality setting.
- **`engine/formats/bmp.ts` is real BMP arithmetic** — the 54-byte header, four bytes per palette
  entry, rows padded to a four-byte boundary, `BI_RLE8` encoded and decoded per spec. The Codes act used to
  be built on it and no longer is: `rle-bitmap` demonstrates run-length encoding in the abstract on
  its own 16×16 pixel art, because 256 bytes fit on screen in full and a photograph's 786,432 do
  not. The module and its tests stay, and the fact that BMP ships `BI_RLE8` and `BI_RLE4` and no
  24-bit run-length mode survives as one sentence of that slide's prose.
- **`engine/jpeg/stages.ts` prices the whole chain stage by stage** for the finale slide, and
  `compareScanOrders` there backs the zigzag comparison. Note what it found: reordering does *not*
  change the RLE pair count, and the DCT *reduces* order-0 entropy rather than increasing it.
- **The four `content/` corpora are data, not decoration.** `corpus.ts` (Huffman texts and the
  LZ77 texts, which deliberately share the Austen paragraph so the two slides' ratios are
  comparable), `sprites.ts` and `summaries.ts`. Each picker is built so one option *fails* — ASCII
  noise, a gradient, prose with no shorthand. Those control cases are what make the slides
  arguments rather than demos; do not quietly replace them with something that works. The gradient
  earns its place twice over: it defeats run-length coding *and* overflows `MAX_PALETTE`, which is
  what lets `rle-bitmap` show that palettising is itself sometimes the lossy step.
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

### The exploration-slide pattern

Five slides are built the same way — `summarising`, `rle-bitmap`, `huffman-codes`, `lz77`,
`basis-64` — and a sixth should be too. The shape is: **source on the left,
machinery in the middle, reconstruction on the right**, a picker whose options span the outcome
space, and a row of phase buttons that plays one animation.

```ts
const { canvas, stage, selectStage, rebuild } = usePhaseStage({
  stages: ['message', 'coded', 'decoded'],   // one label per phase, on the timeline
  width: 1600, height: 816,                  // aspect matched to the slide area
  beforeBuild: () => { readColours(); model.value = buildModel() },
  build,                                     // returns a paused gsap.Timeline
  draw,                                      // (ctx, scale) => void, in logical units
})
```

`usePhaseStage` owns the DPR-aware backing store, the gated redraw loop, the two-way sync between
`stage` and `deck.fragment`, and learn mode. `beforeBuild` runs before every build, so a
late-loading font re-measures the layout instead of replaying over stale metrics. The template is
a `.stage-wrap` flex box around the canvas plus a `.stage-controls` row of `.seg-group` buttons —
all four classes are in `global.css`, and the wrapper is what lets `max-width/max-height: 100%`
fill the box on both a laptop and a projector.

Rules the six follow, learned the hard way:

- **One picker option must fail.** ASCII noise, a gradient, prose with no shorthand. Without it the
  slide is a demo rather than an argument, and the deck's thesis is that the data is the variable.
- **Verify the round trip, never assert it.** Decode and compare; the LOSSY/LOSSLESS stamp reads
  the result. `rle-bitmap` compares *pixels* rather than bytes, which is what catches a palette
  that had to drop colours before the encoder ever ran.
- **Nothing on the stage that is not a live readout.** Captions belong in the control row (a
  `.desc` above the picker) or nowhere. No panel titles, no phase-name captions.
- **Two stamps, both at the end of their animation.** `drawStamp` from `rendering/stamp.ts` is the
  only place the ratio and the verdict are worded or coloured.
- **Truncation is reported, and type is never scaled to fit.** `layoutRibbon` returns `hidden`;
  the numbers a slide publishes are always computed over the whole stream, never the visible part.
  Fitting the font size to the content makes a short stream render bigger than a long one, which
  destroys the very comparison these panes exist to make — pick one size and say what did not fit.
- **Panels showing the same message in two forms share one grid.** Pass the source grid's
  `fontSize` to `layoutTextGrid` for the others, or the shorter form is scaled up to fill its panel
  and the compression stops being visible.

### Presentation styling

`src/styles/global.css` sets `html, body { font-size: 28px }` — all `rem` sizes are already scaled
for a projector, so a `0.9rem` label is normal body text here, not fine print. Colours come from the
dark-theme CSS custom properties there (`--bg*`, `--text*`, `--accent`, `--positive`/`--warning`/
`--negative`); use those rather than literal colours so slides stay consistent.
