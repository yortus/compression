# ROADMAP

Development plan for turning the current JPEG-pipeline visualiser into the full compression talk
described in [docs/draft-roadmap.md](docs/draft-roadmap.md).

## 1. Intent

Two audiences, one artefact:

1. **The live talk.** A presenter drives it with arrow keys in front of an SWE audience. Slides
   must be readable at projector distance, build progressively (so the room looks at one idea at a
   time), and be trimmable to fit whatever the time slot turns out to be.
2. **The published SPA.** After the talk it lives on a URL where people play with it self-paced.
   That means deep links, no presenter required to make sense of it, and prose that carries what
   the presenter would have said out loud.

The thesis the deck argues, in the draft's own words: **every real compression win comes from
_reframing_ the data, not from packing bits more cleverly.** RLE on raw RGB barely works; RLE on
palettised or plane-split data works well. The DCT wins because it changes what the numbers mean.
Zigzag wins because it changes their order. Each act should land that beat.

A second through-line, added after seeing Act 1's numbers: **techniques differ enormously in how
much they care what you feed them.** RLE is spectacular on one image (10.6:1) and worse than
useless on the next (+98%); entropy coding and transform coding are almost never a disaster. That
spread is not luck, and the deck owes the audience the reason — it is developed on the slides
themselves and paid off in `brittle-vs-robust` in Act 6.

Standing constraints from the draft, to be honoured everywhere:

- **Always show the ratio.** From the first RLE demo onward, every slide with data on it reports
  its compression stats. This is a cross-cutting feature, not a per-slide afterthought.
- **Compression is a two-way transform.** Every codec in the engine has a working `decode`, and
  demos can show the round trip, not just the forward direction.
- **You need the message *and* a shared primer.** Palette tables, Huffman code tables and RLE
  escape conventions are counted as overhead in the stats, not quietly ignored.
- **Lossy is anthropic.** Psychovisual and psychoacoustic slides make the point that "lossless
  enough" is a fact about human wetware, not about the data.
- **The chrome is always there.** One consistent layout across every slide, with navigation, the
  key controls (jump forward/back, change the image, adjust settings) and the compression stats
  visible and usable *everywhere* — never buried inside whichever slide happens to own them. The
  zoom loupe belongs to this set: any slide showing an image gets it, from one shared implementation
  (`v-loupe` on the canvas), never a per-slide reimplementation. So does the image picker: a single
  thumbnail in the control bar that opens a 4×3 grid of samples plus a "Choose…" tile.

## 2. Design principles

These exist to settle recurring decisions without re-litigating them:

- **Narrative order beats pipeline order.** The current deck is ordered like an encoder. The new
  deck is ordered like an argument: simple technique, why it fails, reframe, now it works. JPEG is
  the finale, not the subject.
- **Every technique gets a knob.** If the audience cannot change something and watch the number
  move, it is a bullet point, not a slide.
- **Prose lives in `src/content/`, not in templates.** Slide components own layout and interaction;
  the words are data, so they can be revised without touching code and reused by learn mode.
- **Fail-visible demos are the point.** The RGB-RLE slide that *expands* the file is more valuable
  than any slide that works. Do not quietly fix it.
- **Never assert what can be measured.** If a slide claims a transform is invertible, decode and
  compare; if it labels a result lossy, diff the reconstruction against the original. Two slides
  originally hardcoded `lossy: true` for JPEG, which is true of the format but not necessarily of a
  given run of it — the badge now reports what actually happened, and the note carries the max
  channel error. This has since caught three more claims that were simply false — the zigzag
  producing fewer pairs, the DCT costing bits, and a whole-image estimate that was measuring one
  column of the image (all in P4/P5 below). Prefer generating a slide's verdict text *from* its
  numbers, so a wrong expectation shows up as odd prose rather than as a confident lie.
- **Report the spread, not just the best case.** A technique's numbers on one image say little; the
  interesting fact is usually how far they move across the three samples. Where a slide can show
  that range cheaply, it should.
- **Trimmable.** Slides are tagged `core` or `optional`. A dry run that overruns is fixed by
  flipping tags, never by deleting work.
- **One shell owns the furniture.** Navigation, global controls and stats are rendered once by the
  app shell in fixed positions, and slides render only their own content. A control must never move
  between slides, and no slide reimplements one — today the quality slider is copy-pasted with its
  own markup and CSS into three separate steps, which is the exact failure mode to design out.

## 3. Target deck structure

Roughly 35 slides in 7 acts. "Reuse" names the existing component a slide is built from; everything
else is new. Ids are also the deep-link fragments (`#/rle-palette`).

### Act 0 — Framing (new)

| Id | Slide | Notes |
|----|-------|-------|
| `title` | Title and hook | core |
| `why-care` | How much of what you download is compressed, and what the web looks like if it is not | core |
| `info-theory` | Shannon 1948, entropy as the hard floor. Interactive: type text, see live bits/char vs a flat 8 | core; needs `engine/codecs/entropy.ts` |
| `timeline` | Key people, dates, techniques — data-driven from `src/content/timeline.ts` | optional |
| `optimisation` | Compression as optimisation; the Knuth "root of all evil" riff; the ratio/speed/fidelity trade | core |

### Act 1 — Start simple: RLE (new — the biggest build)

| Id | Slide | Notes |
|----|-------|-------|
| `rle-text` | RLE on general data. Editable input, live runs, live stats. Show it *expanding* poorly-suited input | core |
| `rle-two-way` | Forward and inverse side by side; round-trip proof | core |
| `rle-primer` | The escape/marker convention both sides must already agree on; overhead enters the stats | core |
| `rle-bitmap` | RLE straight over RGB pixels — barely helps, often hurts | core |
| `rle-palette` | Palettise, then RLE — big win; palette table counted as overhead | core |
| `rle-planes` | Split into R/G/B planes, RLE each — another win from pure reframing | core |
| `lossy-vs-lossless` | Name the two families; locate where the loss actually lives | core |

**The sample set is part of the argument.** Fourteen images in `engine/loadImage.ts`, laid out in the
picker as three rows of five: photographs and continuous tone, flat-colour graphics, then structure
and stress tests. Each is there to flatter or break something — `flat` and `lineart` for RLE,
`dither` and `noise` to defeat it, `text` for JPEG ringing, `parrot` for saturated chroma, `forest`
for high-frequency detail that is nearly monochrome, `checker` for the highest frequency a block can
hold, and `sweep` — a linear chirp with falling contrast — where dropping the quality slider visibly
eats the fine end of the image while the coarse end survives. `scripts/generate-samples.mjs` builds the synthetic ones deterministically, downloads
the two freely-licensed photographs from Wikimedia Commons (credits in
`public/samples/CREDITS.md`), and skips anything already present — `--force` rebuilds. The skip
matters: `photo.jpg`'s original URL now 403s, so a blind rebuild would replace it with a fallback.

**`pixelart.png` is built for the DCT slides.** Forty-four hand-drawn sprites (`scripts/pixelart.mjs`)
on white, every one aligned to the 8×8 lattice with a blank cell of padding, so a JPEG block holds
either blank white, one whole 8×8 sprite, or one quadrant of a 16×16 one. Selecting such a block
gives a coefficient grid made of a handful of flat values instead of photographic mush — block 1230
is a good demonstration. Flat sprites are nearly pure DC; the multicolour ones light up the high
frequencies.

The three benchmark images are not decoration in this act — they are the experiment. The same encoder
run over Photo, Graphic and Gradient spans 0.50:1 to 10.6:1, and `rle-bitmap` and `rle-planes`
should invite the audience to switch between them and watch the verdict text flip. That spread is
the first evidence for the brittleness argument the conclusions pick up, and `lossy-vs-lossless`
should record not just what each technique achieved but how much it varied.

### Act 2 — Colour space (mostly reuse)

| Id | Slide | Notes |
|----|-------|-------|
| `ycbcr` | RGB to YCbCr as a reframe. **Y, Cb and Cr shown side by side at once**, chroma planes in colour | core; rework `Step1ColorSpace` |
| `psychovisual` | Rod and cone density in the human eye, and why Y carries the picture; would a mantis shrimp build this codec? | core; new |
| `chroma-subsample` | 4:4:4 / 4:2:2 / 4:2:0 with an A/B "can you actually see it?" | core; reuse `Step2Subsampling` |

This act runs discovery-then-explanation, so the order matters: the audience sees the three planes
and notices Y alone reads as the picture, *then* finds out why, *then* watches the codec exploit it.

**`ycbcr` — three-up, and chroma in colour.** The current `Step1ColorSpace` toggles one channel at a
time via an `activeChannel` ref and renders all three through `channelToImageData` in greyscale.
Both need to go. Show the three planes simultaneously so they can be compared at a glance, and
render each chroma plane along the colour axis it actually encodes — hold Y at mid-grey and the
other chroma channel at neutral 128, then map the plane through `ycbcrToRgb`, which gives Cb its
true blue-to-yellow ramp and Cr its red-to-cyan one. Greyscale chroma planes are the thing that
makes this slide forgettable: they look like noisy duplicates of each other instead of the
blue-ness and red-ness maps they are. Y stays greyscale, correctly, and label all three with their
size — identical at this point in the pipeline, which is the whole setup for the next slide.

**`psychovisual` — the eye.** A diagram of rod and cone distribution across the retina: roughly 120
million rods to 6 million cones, cones bunched in the fovea, and the blue-sensitive cones both the
rarest and absent from the very centre. Check the figures against a source before they go on a
slide. That lands the payoff the previous slide set up: all three planes carry the same number of
bits, but you read the image almost entirely out of Y. The interaction that proves it rather than
asserting it — destroy one plane and look: scramble or flatten the chroma and the photo survives
nearly intact, do the same to luma and it is gone. That A/B is what earns the subsampling slide.

### Act 3 — Huffman (reuse and generalise)

| Id | Slide | Notes |
|----|-------|-------|
| `huffman-build` | Animated tree build over a user-supplied string | core; generalise `engine/huffman.ts` off JPEG symbols |
| `huffman-codes` | Code table, savings vs fixed-width, and the table itself as overhead | core; reuse `Step8Huffman` |
| `beyond-huffman` | Arithmetic / range / ANS in one slide: fractional bits, and why that matters | optional |

### Act 4 — Fourier and the DCT (reuse and extend)

| Id | Slide | Notes |
|----|-------|-------|
| `waves-intro` | Data as superposition. Draw a signal, watch it decompose | core |
| `dct-1d` | 1-D forward/inverse with a "how many coefficients?" slider | core |
| `blocks` | Why 8x8 at all — moved here, since blocks only matter once there is a transform | core; reuse `Step3Blocks` |
| `dct-2d` | 2-D DCT on the selected block | core; reuse `Step4DCT` |
| `basis-64` | The 64 basis images, animated build-up, click to add one at a time | core; extend `Step4DCT`'s `drawBasis` |
| `quantisation` | Psychovisual again: drop high frequencies, watch quality and bits move together | core; reuse `Step5Quantization` |
| `rle-on-coeffs` | RLE over coefficients in *raster* order — a modest win. Callback: RLE failed on raw pixels, so JPEG **manufactures** the runs rather than hoping for them | core |
| `zigzag` | The reorder insight; run-length histogram raster vs zigzag, side by side | core; reuse `Step6Zigzag` plus new comparison |

### Act 5 — Putting it together: JPEG (reuse)

| Id | Slide | Notes |
|----|-------|-------|
| `jpeg-history` | The committee, 1986–1992, and how it ate the world | optional |
| `jpeg-pipeline` | The whole chain end to end, each stage's contribution stacked | core; new, driven by the scoreboard |
| `jpeg-result` | Final A/B, ratio, and artifacts at brutal quality | core; reuse `Step9Summary` |

### Act 6 — Conclusions (new)

| Id | Slide | Notes |
|----|-------|-------|
| `wider-audio` | MDCT plus psychoacoustic masking: same skeleton, different sense | core |
| `wider-general` | gzip/LZ77, BWT, zstd/ANS: "decorrelate, then entropy-code" | core |
| `modern` | WebP / AVIF / HEIC / JPEG XL; stills as single video frames | optional |
| `brittle-vs-robust` | Why some schemes only work sometimes and others almost always do | core; new |
| `lossiness-subjective` | Lossy is a claim about people, not about data | core |
| `reframing` | The thesis, paid off; the life-lesson beat | core |
| `end` | Links, credits, pointer to `docs/compression-techniques-survey.md` | core |

**`brittle-vs-robust` — the answer to "why is this so?"** The audience will have watched one encoder
score 10.6:1 and 0.50:1 on two images of the same size. Five parts, in this order:

1. **Expansion is compulsory, not a defect.** There are fewer short strings than long ones, so any
   lossless codec that shortens some inputs *must* lengthen others — you cannot win on all of them.
   Every scheme is therefore a bet on which inputs it will actually meet. RLE's +98% on a photo is
   not RLE being bad; it is RLE paying out on a bet it lost. Worth stating plainly, because it
   reframes "this compressor failed" as "this compressor was pointed at the wrong data".

2. **What breaks the bet is usually noise, not subject matter.** RLE needs bytes to be *exactly*
   equal. Neighbouring pixels in a photograph are strongly correlated but almost never identical —
   one count of sensor noise ends a run. Synthetic graphics have genuine exact repetition, which is
   why they behave completely differently. So the sensitivity is to exactness, and the techniques
   that survive noise are the ones modelling *approximate* similarity: predict, then code the small
   residual.

3. **Brittle schemes hard-code their model; robust ones learn it.** RLE's model is fixed and
   parameterless — nothing to transmit, and no ability to adapt. Huffman measures the actual
   symbol distribution and ships a code table. LZ77 builds its dictionary out of the data itself.
   Adaptive arithmetic and ANS update their model as they go. Applicability is bought with primer
   cost — the same trade `rle-primer` introduced in Act 1, seen from the other end.

4. **Robust schemes bound their downside deliberately.** Escape-RLE passes literals through
   untouched, so its worst case is a small overhead rather than 2×. Deflate picks per block between
   stored, static and dynamic Huffman — the "stored" mode caps the loss at a few bits. "Never much
   worse than raw" is an engineering decision, not a happy accident. Even so, universality has
   limits: gzip a JPEG and it gets *bigger*, because the data has no redundancy left to find.

5. **JPEG's answer, and the punchline: do not rely on the property — manufacture it.** JPEG does not
   apply RLE to an image and hope for runs. It transforms, quantises (which drives most
   high-frequency coefficients to zero) and zigzag-scans (which gathers those zeros together), so
   that long runs are *guaranteed* to exist before RLE is asked to find them. The brittle technique
   is kept and the input is engineered to suit it. That is the reframing thesis one level up, and it
   is why this slide belongs next to `reframing`.

A visual worth building if there is time: the Act 1 scoreboard replayed as a grouped bar chart, one
group per technique and one bar per sample image, so brittleness reads as *spread* — tall bars for
RLE, flat ones for the transform pipeline.

## 4. Architecture changes

The current shape — a flat `steps` array in `App.vue` over one JPEG-specific pipeline store — does
not stretch to this. Five new pieces, all of which should land before bulk content work:

**`src/deck/` — deck framework.**
`slides.ts` holds the registry (`{ id, act, title, component, tag: 'core' | 'optional' }`) as the
single source of deck order. `useDeck.ts` owns the current slide and *fragment* index, next/prev
that advances fragments before slides, `goToId`, and hash-route sync (`#/rle-palette`,
`#/rle-palette/2`) so links are deep and the SPA works on static hosting. A `<Fragment>` wrapper
gives progressive reveal within a slide. Navigation is a table of contents down the left edge, listing every slide title
grouped by act and scrolling with the wheel — it reads the registry, replacing `ProgressBar.vue`,
which hardcoded `STEP_LABELS` as a parallel array to `App.vue`'s `steps`.

**`src/deck/DeckShell.vue` — persistent chrome.**
One shell wraps every slide and owns four fixed regions: the act/slide navigation, a global control
bar, the stats HUD, and the slide's own content area. Slides declare which global controls are
relevant (`controls: ['image', 'quality', 'subsampling']` in the registry) and the shell renders
them in the same place every time, disabling rather than relocating the ones a slide does not use —
so the audience learns the furniture once. This replaces `StepShell.vue`, whose `detail` slot
floats a panel over the content and whose per-step layouts are currently all bespoke.

Three concrete fixes this delivers, all of them present problems: the image can only be changed on
slide 0 today (`ImagePicker` is imported by `Step0Source` alone) and should be changeable from any
slide with an image on it; the quality slider is duplicated in `Step3Blocks`, `Step5Quantization`
and `Step9Summary` with three different markups; and subsampling can only be touched on
`Step2Subsampling`. All three move into the shared control bar over the single pipeline store, so
changing an input anywhere is reflected everywhere.

Navigation must support both jumping and stepping: arrow keys through fragments and slides, the
ToC rail for direct jumps to any slide, and deep links by id. Assume a presenter mid-talk will want to
jump back three slides to re-answer a question and then return — make that one click, not nine.

**`src/stats/` — the always-on ratio.**
A provided registry plus `useStat(id, () => StatSample)` where
`StatSample = { label, rawBits, encodedBits, overheadBits, lossy, note? }`. `StatsHUD.vue` renders
the active slide's sample as a persistent bar. Overhead is a first-class field precisely so the
"shared primer" point is visible in the numbers. A `useScoreboard` keeps the best result per act so
`jpeg-pipeline` can stack every technique's contribution in one chart at the end.

**`src/engine/codecs/` — generalised codecs.**
A uniform `Codec<TIn, TEncoded>` with `encode`, `decode`, and bit accounting that separates payload
from primer. New: generic `rle.ts` (byte and symbol variants — distinct from JPEG's
coefficient-specific RLE), `palette.ts`, `planes.ts`, `entropy.ts`. `huffman.ts` gets generalised
over an arbitrary symbol type, with the JPEG `(runLength, value)` packing kept as a thin wrapper.
Existing JPEG-specific modules move to `src/engine/jpeg/` — the engine is currently entirely
JPEG-shaped, and the new acts need codecs that know nothing about 8x8 blocks.

**`src/content/` — the words.**
Timeline entries, sample strings and bitmaps, and per-slide prose in two registers: `speaker` (the
terse cue the presenter needs) and `learner` (the paragraph that replaces the presenter online).
Learn mode (`L`, and the default when the URL is not in presenter mode) reveals all fragments and
shows the learner prose.

**Performance note that will bite.** `huffman.ts` builds its bitstring with `bitstring += ...`.
That is fine for one 8x8 block and quadratic-ish disaster for the whole-image Huffman and RLE runs
Act 1 needs. Replace it with a bit counter plus an optional `Uint8Array` writer before pointing any
codec at 512x512 data. Same caution for the palette and plane demos: keep them O(n) and keep the
existing 512px cap in `ImagePicker`, or move the work to a worker — the whole pipeline is still
synchronous on the main thread.

## 5. Phases

Ordered so the deck is presentable end to end as early as possible, then deepened.

### P1 — Foundations ✅ done
Deck framework, `DeckShell` with its persistent chrome, stats layer, codec interface, the
`src/engine/jpeg/` move, left-hand ToC rail. The existing ten slides are ported onto the shell —
losing their bespoke layouts and their duplicated quality sliders — and keep working throughout.
**Done when:** every current slide is reachable by id and hash link, arrow keys step fragments then
slides, at least one slide publishes a `StatSample` that renders in the HUD, and image, quality and
subsampling can all be changed from any slide that uses them without the controls moving.

*Verified in the browser:* arrow/Home/End/L navigation, hash sync in both directions, and switching
chroma mode from the reconstruction slide (which does not own that control) re-running the pipeline.
Three slides publish stats so far — `chroma-subsample`, `huffman-codes` and `jpeg-result`. The
fragment mechanism is in place but no slide declares a build yet; Act 1 will be the first to use it.

### P2 — Act 1, RLE ✅ done
The whole simple-techniques act, plus the generic codecs it needs. This is the largest new build and
it is what proves the stats layer is designed right.
**Done when:** all seven Act 1 slides run, the RGB-RLE slide visibly expands its input, the palette
and plane variants show their wins, and every stat includes primer overhead.

*Measured across the three samples* (raw 768 KB each), which is what the slides now say out loud:

| | interleaved RLE | R/G/B planes | palette 16 + RLE |
|---|---|---|---|
| Photo | 0.51:1 (+98%) | 0.68:1 (+47%) | 23.5:1 |
| Graphic | 1.05:1 | 10.6:1 | 53.2:1 |
| Gradient | 0.50:1 (+99%) | 1.43:1 | 154:1 |

Reordering into planes always removes runs (26% of them even on the photo) but only crosses into an
actual win on the graphic and gradient — the slide says so rather than claiming a win the numbers do
not support. `src/content/` landed here too, earlier than planned, along with learn-mode prose and
an `N` speaker-note toggle; the fragment mechanism from P1 is now in use, two per Act 1 slide.

The `vitest` round-trip suite from §6 landed with this phase: `npm run test` (28 cases in
`src/engine/codecs/roundtrip.test.ts`), covering both RLE forms, the palette and the plane split.
`vue-tsc` type-checks the test file during `npm run build`, so a broken test file fails the build.

### P3 — Acts 0 and 6, framing and conclusions ✅ done
Cheap relative to their value: mostly prose, the timeline data file, and the entropy widget. This is
what turns a demo into a talk.
**Done when:** the deck runs start to finish as an argument, and a first timed dry run is possible.

*Delivered:* 29 slides across all seven acts. Act 0 is `title`, `why-care`, `info-theory` (live
Shannon entropy over editable text), `timeline` and `optimisation`; Act 6 is `wider-audio`,
`wider-general`, `modern`, `brittle-vs-robust`, `lossiness-subjective`, `reframing` and `end`.
Five of the narrative slides share one `PointsSlide` component driven by `src/content/points.ts`,
so they cannot drift apart visually.

Two things worth knowing for later phases:

- **`estimateEncodedBits` in `engine/jpeg/pipeline.ts` is now the single whole-image size estimate**,
  sampling ~64 blocks per channel instead of extrapolating from whichever block happened to be
  selected. `jpeg-result`, `why-care` and the benchmark all use it, so their headline numbers agree.
  It is still idealised — per-block optimal Huffman with no code tables counted — and the slides now
  say so rather than implying a real encoder.
- **`engine/benchmark.ts` measures every technique against every sample** and caches the result for
  the session; `brittle-vs-robust` renders it. Robustness there is ranked by *worst case*, not by low
  variance: interleaved RLE barely varies either, but only because it is reliably useless, and the
  first version of that slide accidentally crowned it the most robust technique.

*Not yet done from P3's spirit:* the timed dry run itself, which is the user's to do.

### P4 — Depth in Acts 3 and 4 ✅ done
Interactive Huffman tree build; `waves-intro` and `dct-1d`; the animated 64 basis images; the
raster-vs-zigzag run-length comparison that makes the zigzag insight land.
**Done when:** each of those four has a knob the audience can turn and a stat that responds to it.

*Delivered:* five slides, 34 in total. `huffman-build` steps or replays the merges over editable
text and decodes its own bitstream back before reporting; `waves-intro` and `dct-1d` share a
drawable `SignalPad` over a new general 1-D DCT-II in `engine/signal.ts`; `basis-64` builds a real
block back up from the 64 patterns, by slider, by replay, or by clicking patterns individually; and
`zigzag` compares the two scan orders side by side. Two new engine modules came with them —
`engine/codecs/huffman.ts` (Huffman over an arbitrary symbol type, with the merge sequence recorded
for the animation) and `engine/signal.ts` — both covered by the round-trip suite, now 56 cases.

**Two things the measurements contradicted, which is the whole reason for measuring them:**

- **The zigzag does not produce fewer RLE pairs.** It cannot: a pair is emitted per surviving
  coefficient plus an end-of-block marker, and reordering does not change how many survive. The
  first version of the slide claimed it did and dutifully rendered "0% saving". What the reorder
  changes is the *gaps* between the survivors — scattered fives and sixes in row order, almost all
  zeros along the diagonal — which collapses the symbol alphabet the entropy coder has to describe.
  Measured on the whole image that is worth about **9%**, and the slide now shows the gap lists,
  says the pair counts are identical, and prices the saving where it actually lives.
- **`estimateEncodedBits` was sampling one column of the image.** It used a fixed stride of
  `n / 64` blocks; every sample in the deck is 512px wide, so a channel is exactly 64 blocks across
  and that stride landed on the same column of every row. Line art scored an identical 512:1 at
  Q15, Q50 and Q92 because its left edge is blank at every quality. Replaced with a golden-ratio
  sequence (`sampleBlockIndices`), which has no period to collide with a row width. This moved every
  headline JPEG figure in the deck — Photo at Q50 went from 73:1 to 82:1 — and is the reason the
  `brittle-vs-robust` chart's JPEG row is now believable.

### P5 — Act 5 finale ✅ done
The end-to-end pipeline slide driven by the scoreboard, stacking each technique's contribution.
**Done when:** the finale's total agrees with the numbers the individual acts showed.

*Delivered:* `jpeg-pipeline`, eight rows from raw RGB to the final bitstream, measured live on
whichever image is loaded (`engine/jpeg/stages.ts`). Every intermediate row is priced identically —
the size an order-0 entropy coder would reach on that representation — so consecutive rows are
comparable; the first row is the literal 24 bits a pixel the rest of the deck quotes, and the last
is the same `estimateEncodedBits` `jpeg-result` reports. Verified across Photo, Line art, Gradient
and Pixel art at Q15/Q50/Q92: **the finale's ratio matches `jpeg-result`'s exactly in all twelve
combinations.** Where the Act 1 slides have been visited, their scores on the same image are picked
up from the scoreboard and shown underneath.

**A third contradicted expectation.** The slide was written asserting that the DCT row would *cost*
bits — a rotation cannot destroy information, so spelling out a wider range of numbers ought to be
more expensive. Measured, it is the second-largest saving on the board (−63% on a photo). Order-0
entropy is not preserved by a rotation: decorrelating the samples is precisely what makes a
memoryless coder do better, and that is the entire reason transform coding exists. The commentary
under the table is now generated from the measured deltas rather than written in advance.

### P6 — Publish and polish
Learn mode as the off-presentation default, `base` config and static deploy, share metadata,
keyboard help overlay refresh, and a full dry run with trimming via the `core`/`optional` tags.
Include a consistency sweep: click every slide in order looking for chrome that shifts, controls
that appear or vanish, headings that change size, and stats that blank out between slides.
**Done when:** the URL works cold for someone who was not in the room.

## 6. Risks and decisions

- **Round-trip correctness matters more than usual.** The deck literally claims every transform is
  invertible; a silent engine regression becomes a wrong claim in front of a room. This is the one
  place tests earn their keep in a vibe-coded repo — `npm run test` covers exactly that and nothing
  else. Keep it that way: add a case when a new codec appears, and resist growing it into a general
  test suite for slide components.
- **Scope.** ~35 slides is a lot for one talk. The `core`/`optional` tagging is the release valve;
  use it rather than cutting phases short.
- **Chrome versus canvas.** Persistent navigation, controls and stats compete for space with the
  visuals, and at the 28px root font the deck uses for projector legibility that competition is
  real. Budget the chrome as a fixed fraction of the viewport up front and hold slides to what
  remains, rather than letting individual slides claw space back — a slide that needs the full
  screen should dim the chrome, not remove it.
- **Main-thread budget.** Act 1 runs codecs over whole images. If anything stutters during a dry
  run, fix it by shrinking the demo image before reaching for a worker.
- **Assumption — "DCT1 and DCT2" in the draft** is read as *1-D then 2-D*, which is the
  pedagogically useful build-up. The `dct-1d` slide should mention in passing that the variant JPEG
  uses is DCT-II, which also covers the other reading of that note.
- **Assumption — talk length around 40 minutes.** This drives the slide count and the trimming
  strategy. Worth confirming, and cheap to adjust via tags if it is wrong.
- **Open — deploy target.** The plan assumes a static host with hash routing (GitHub Pages being the
  obvious candidate, which needs `base` set for a project path). Confirm before P6.
