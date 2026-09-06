# Single-page explorations

A plan for rebuilding four more of the deck's ideas the way `huffman-codes` was rebuilt: one slide,
one round trip, one picker that spans the outcome space.

See [ROADMAP.md](../ROADMAP.md) for what the deck is and
[compression-techniques-survey.md](compression-techniques-survey.md) for the technique table these
slides visualise.

> **Status: delivered, three of four.** `summarising`, `rle-bitmap` and `lz77` are built, wired
> into the deck and covered by the round-trip suite (82 cases). **`arithmetic` was built and then
> cut** — it worked, and fractional bits turned out to be past what this deck needs to cover. Its
> section below is kept for the record; the slide, its engine and its corpus are gone. What follows is the plan as written, with a delivery note at the end
> of each section recording what the measurements turned out to be — several of them are more
> interesting than what the plan predicted.

---

## 1. What made `huffman-codes` work

Act 3 went from two slides — an animated tree build plus a per-block code table — to one, and got
better. Worth naming why, because the same nine rules generate the four slides below.

1. **One slide carries the whole round trip.** Source on the left, machinery in the middle,
   reconstruction on the right. The right panel is not decoration; it is the proof, and it is
   verified by actually decoding rather than by asserting.
2. **The picker spans the outcome space, and one option must fail.** English 5.4×, Sanskrit 18.1×,
   Chinese 4.4×, ASCII noise 1.2×. The control case is what turns a demo into an argument: the
   technique is not the variable, the data is.
3. **The knob changes the *model*, not just the input.** Each text carries its own tokeniser. That
   the choice of symbol is made *before* any compression happens — and is language-specific — is
   the lesson, and it is only visible because the picker changes it.
4. **Phase buttons are deck fragments.** N segmented buttons wired both ways to `deck.fragment`,
   driving one paused GSAP timeline with a label per phase. Arrow keys and buttons are the same
   control; a presenter can mix them freely.
5. **One canvas, GSAP tweening plain objects the draw loop reads.** Not DOM sprites. The backing
   store is sized to the real display size, and the stage aspect is chosen to match the slide area
   so the canvas fills its box.
6. **One headline number on the stage.** `4.7× smaller`, computed. Everything else — the code
   table, the overhead, the round-trip flag — goes to the always-on HUD.
7. **No text on the stage that is not a live readout.** Panel captions restate what the picture
   already says. The two that carried real information moved to the control row.
8. **Cut the mechanism slide.** The tree build answered *how* the codes are chosen, which the talk
   never asks. Every one of the four below is deliberately about what a technique *does*, not how
   it is implemented.
9. **The headline number and the LOSSY/LOSSLESS verdict are stamped, not written.** Same
   renderer, same tilt, arriving at the end of the animation that earned them. See §1.1 — this one
   is already built.

### 1.1 Verdict stamps *(done)*

`huffman-codes` used to show `✓ identical` in 21px grey once the decode finished, and its ratio as
a line of plain green text. Both are conclusions rather than labels, and neither looked like one.
Replaced by one convention, applied everywhere:

- **`src/rendering/stamp.ts`** draws rubber-stamp verdicts: heavy letterspaced caps, a double
  border, a 7° tilt, and an opaque black interior that punches through whatever it lands on.
  Obscuring a corner of the output is the intent — a stamp that politely avoided the artwork would
  read as a caption again. `stampBounds()` reports the rotated footprint so a caller can place one
  against a corner without it hanging off the stage.
- **Two things use it, and they are meant to read as a matched pair:** the ratio a slide achieved
  (`4.7× SMALLER`, in `--positive`) and whether it was lossless (`LOSSY` in `--warning` or
  `LOSSLESS` in `--positive`). Same size, same tilt, same treatment.
- The loss stamp is struck across the bottom corner of the output panel where it fits, and sits
  just below the panel where the panel is too small to take it without covering the picture it is
  describing.
- **The stats HUD carries the same lossy/lossless tag on every slide that publishes a stat**, so
  the guarantee is deck-wide rather than per-slide even on slides with no output panel to stamp.
  `.tag.lossless` previously had no colour rule and rendered grey; it is now green, matching.
- **The flag is always measured.** `huffman-codes` reads it from a real `decodeBits` walk compared
  against the original; `basis-64` from the pixel diff, so a block that survives quantisation intact
  correctly reads LOSSLESS. Never a constant — two slides once hardcoded `lossy: true` for JPEG,
  which is true of the format but not of every block.
- **Stamps appear at the end of their animation**, fading in over the last of the decode. The
  verdict is the payoff of watching the output panel fill; one sitting there from the first frame
  gives the answer away before the animation has made its case, and reads as chrome rather than as
  a result. Callers pass an `alpha` from their own progress.

Retrofitted to `huffman-codes` and `basis-64`. Every slide below inherits both stamps for free.

### 1.2 Step 0: extract the machinery first

`HuffmanCodes.vue` and `Basis64.vue` already duplicate roughly 120 lines of stage plumbing between
them. A third and fourth copy would be a mistake, and four new slides is the moment to pay this
down. Four extractions, in dependency order:

| New module | What it owns | Used by |
|---|---|---|
| ~~`src/deck/usePhaseStage.ts`~~ | Paused-timeline-with-labels, `stage` ↔ `deck.fragment` two-way sync, `selectStage`, dirty-flag draw loop, DPR-aware resize | all four, plus retrofit `basis-64` |
| ~~`src/rendering/textGrid.ts`~~ | Grapheme layout into a fixed-width grid, runtime font fit with auto-shrink retry, draw with per-token alpha callbacks | summarising, lz77, arithmetic |
| ~~`src/rendering/ribbon.ts`~~ | Wrapped stream of small glyphs, batched into same-colour runs, reveal fraction, `+N more` tail | rle-bitmap (hex), arithmetic (bits) |
| ~~`src/rendering/tokenColours.ts`~~ | Golden-angle hue by frequency rank, grey below a repeat threshold | rle-bitmap, lz77, summarising |
| ~~`src/rendering/stamp.ts`~~ | Ratio and LOSSY/LOSSLESS verdict stamps | all four |

**Done.** All four exist, plus the segmented-control and stage-layout classes in `global.css`.
`huffman-codes` and `basis-64` were retrofitted onto `usePhaseStage` as well, so six slides share
one stage machine instead of six copies of it.

One addition the plan did not foresee: `usePhaseStage` needed a `beforeBuild` hook. Without it the
composable's own font-ready rebuild only replayed the timeline, leaving the text grids measured
against the fallback font — the retrofit reintroduced a bug the original slide had already fixed.
Every rebuild now runs model, colours and layout through the one path.

---

## 2. `summarising` — compression you already do

**Act:** `framing`, after `why-care` and before `info-theory`.
**Replaces:** nothing. It is the on-ramp: lossy and lossless, with zero machinery, before a single
bit appears.

### The argument

Summarising a document *is* compression, and it splits cleanly into the two families the whole deck
turns on. Rewrite a weather bulletin in METAR and you can get it back exactly — that is lossless
coding with a shared dictionary, and it is the Huffman story told at the level of meaning. Write a
précis of a novel and you cannot get it back at all. Both shrink the text; only one has an inverse.

The payoff is the last phase, where both modes run the round trip and only one of them survives it.

### Controls

Two axes, in the control row: the text, and the mode.

| Text | Lossless route | Lossy route |
|---|---|---|
| **Aviation weather** (NWS/FAA TAF — US government work, public domain) | METAR/TAF codes: `24015KT 10SM FEW035` | poor — it is already terse |
| **Shipping forecast** (UKMO wording, formulaic) | domain abbreviations | moderate |
| **Signal traffic** (Q-codes and prowords, pre-1923 manuals) | `QTH` = "my position is" | poor |
| **Literary prose** (Gettysburg Address, or the Austen paragraph already in `corpus.ts`) | almost nothing to abbreviate | strong |

The diagonal is the lesson: a domain with an agreed codebook compresses losslessly and prose does
not; prose summarises well and a weather report does not. Neither route is universally better.

**Mode** is a three-way toggle: `lossless` / `summary 50%` / `summary 10%`.

### Phases

1. **Message** — source text in the left grid.
2. **Marked** — the scan sweeps; lossless boxes the phrases with dictionary entries, lossy dims the
   clauses that will not survive.
3. **Coded** — the dictionary appears below (lossless), or the dropped text fades out (lossy).
4. **Result** — the right grid fills. Badge: `N× smaller`.
5. **Back** — the round trip, and the reason this slide exists. In lossless mode the abbreviations
   expand and the right grid becomes the left grid, character for character, under a green
   **LOSSLESS**. In lossy mode the expansion produces the summary and stops — the dropped words
   simply do not return — under a yellow **LOSSY**. Same animation, same badge, two outcomes. It is
   the clearest statement of the distinction the deck can make, and it needs no bits at all.

### Honesty constraint

**The lossy summaries are hand-written and stored as data**, in `src/content/summaries.ts`, credited
as such on the slide. There is no summariser in the app and pretending otherwise would break the
deck's own rule about never asserting what can be measured.

That constraint is worth making into the point rather than hiding: the slide can measure the *size*
of a lossy compression exactly and cannot measure its *quality* at all. Which is precisely why every
lossy codec contains a model of a human — the thesis `lossiness-subjective` pays off in Act 6.

### Engine

New `src/engine/codecs/abbreviate.ts`: longest-match phrase substitution against a domain
dictionary, plus the inverse. Pure, ~60 lines, round-trip covered by the existing suite.

### Stats

`rawBits` = UTF-8 bytes × 8. `encodedBits` = result bytes × 8. `overheadBits` = the dictionary, in
lossless mode, because the reader needs it (a pilot who cannot read METAR gets nothing from
`24015KT`). `lossy` is read from the actual round-trip comparison, not hardcoded.

### Delivered

`src/engine/codecs/abbreviate.ts` (longest-phrase substitution and its inverse),
`src/content/summaries.ts`, `src/components/slides/Summarising.vue`. Sits in `framing` between
`why-care` and `info-theory`.

The picker turned out to be a sharper diagonal than planned once chess was added:

| Text | Codebook | Précis |
|---|---|---|
| Chess (Najdorf) | **8.8×** — the whole game becomes `1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6` | 3.2× |
| Weather (TAF) | 4.5× | 3.3× |
| Signals (Q-codes) | 3.6× | 3.1× |
| Prose (Gettysburg) | **1.1×** — the control; there is no shorthand for English | 1.8× |

Every codebook expands back to the original exactly, checked in the suite. The lossy route expands
to the summary and stops, under a LOSSY stamp and a measured "N% of the words are gone".

---

## 3. `rle-bitmap` — run-length encoding on pixel art

**Act:** `simple`.
**Replaces:** `rle-text`, `rle-two-way`, `bmp-rgb`, `bmp-palette` — four slides into one.
`rle-primer` survives, retagged `optional` (§3.6).

The largest consolidation available in the deck, and the closest parallel to what Act 3 just went
through.

### 3.1 No BMP, no global controls

**Decided:** step away from BMP and demo run-length encoding in the abstract, on bespoke artwork the
slide owns. The image picker and quality slider are simply not declared in the slide's `controls`,
so the control bar disables them in place rather than hiding them.

Two consequences, both better than the photo version:

- **The sprites are 16×16, so the entire byte stream fits the hex ribbon with nothing truncated.**
  256 bytes, all on screen, every number countable by eye. No 512px photograph could offer that —
  it would have shown the first few hundred of 786,432 bytes and asked the audience to take the
  rest on trust.
- **The artwork can be authored to span the outcome space exactly**, rather than hoping a sample
  photo happens to make the point.

### 3.2 The artwork

`src/content/sprites.ts` — hand-authored 16×16 index grids with a small palette each, in the same
spirit as `corpus.ts`.

| Sprite | Character | RLE on indices |
|---|---|---|
| **Heart** | three colours, big flat areas | strong |
| **Space invader** | two colours, long horizontal runs | strong |
| **Horizontal bands** | one colour per row | best case — 16 runs for 256 pixels |
| **Gradient** | a smooth two-axis ramp, 256 colours in 256 pixels | **worst case twice over — see below** |
| **Dithered gradient** | 50% dither | expands |
| **Noise** | random indices, seeded | expands |

The gradient is the control case and it fails in two different ways at once, which is more than a
control usually manages. Nothing repeats, so run-length coding has nothing to collapse; and there
are sixteen times more colours than `MAX_PALETTE` holds, so the one representation that *could*
find runs in it can only do so by discarding colour. It is the only cell on the slide that stamps
LOSSY, and the banding in the decoded panel makes the loss visible rather than merely reported.

### 3.3 Controls

Sprite picker, plus a representation toggle. Same encoder throughout.

| Representation | The bytes | Bytes for 16×16 |
|---|---|---|
| Indices | one palette index per pixel | 256 |
| Greyscale | one luminance byte per pixel | 256 |
| Colour planes | all R, then all G, then all B | 768 |
| 24-bit RGB | interleaved triples | 768 |

Pixel art is *authored* as indices, so the RGB row is what happens when you store it the naive way,
and the run count collapses from one-per-band to nearly one-per-pixel. Same encoder, four framings,
ratios from better than 10:1 to worse than 1:1 — the deck's central thesis in a single control.

Encoder form is fixed at the naive `(count, value)` pair form. The escape form stays on
`rle-primer`, where the shared-primer argument lives. That keeps this slide at two toggles.

### 3.4 The hex dump

The centre pane is the full byte stream in hex, reusing `rendering/ribbon.ts` from the Huffman bit
ribbon. Consecutive equal bytes share a tint, so runs are visible as coloured bands *before*
anything is encoded — and on the RGB representation there are visibly none. During the encode phase
each run collapses in place into its `(count, value)` pair. The bytes doing the collapsing is the
clearest possible statement of what RLE is.

### 3.5 Stage and phases

- **Left** — the sprite at ~24 units per pixel, so a 16×16 sprite fills a 384-unit panel. Pixel art
  at that scale will be the best-looking thing in the deck.
- **Centre** — hex ribbon, then the collapsed pairs, then the badge.
- **Right** — the decoded sprite filling in row by row, LOSSLESS badge beneath it.

Four phases: **Pixels** → **Runs** (the scan sweeps, equal-byte runs get boxed and tinted) →
**Encoded** (runs collapse; on RGB the badge reads **`0.5× — bigger`**) → **Decoded**.

### 3.6 Engine, and what this costs

`codecs/rle.ts` and `codecs/planes.ts` already do the work. One addition: `runSpans(data)` returning
`{start, length, value}[]`, computed once per sprite-or-representation change rather than per frame.
`formats/bmp.ts` is untouched and unused by this slide.

The three-real-BMP-files framing goes, and with it the argument from the format's own missing 24-bit
RLE mode. `formats/bmp.ts` and its round-trip tests stay in the engine either way. The fact is worth
one sentence of prose here — *BMP ships `BI_RLE8` and `BI_RLE4` and no 24-bit RLE mode at all, and
this is why* — which is cheaper than a slide and lands harder next to a gradient that has just
expanded by half.

`rle-primer` survives as an `optional` slide because the escape-byte collision (what happens when
the data contains your escape byte) is a distinct idea about shared primers, not a variation on
run-length encoding.

### Delivered

`runSpans`/`spansToBytes` added to `codecs/rle.ts`; `src/content/sprites.ts`;
`src/components/slides/RleBitmap.vue`. Replaced `rle-text`, `rle-two-way`, `bmp-rgb` and
`bmp-palette`; `rle-primer` retagged `optional`.

Ratios, all round-trip verified:

Representations were later reworked to 32-bit RGBA → colour planes → palette (worst to best), and
the checkerboard replaced by a gradient:

| Sprite | RGBA | Planes | Palette |
|---|---|---|---|
| Bands | 0.50× | **16.00×** | 16.00× |
| Invader | 0.60× | 2.04× | 2.03× |
| Heart | 0.57× | 1.98× | 1.97× |
| Dithered ramp | 0.67× | 0.94× | 0.94× |
| Noise | 0.50× | 0.56× | 0.56× |
| Gradient | **0.50×** | 0.73× | 2.00× **but LOSSY** |

**Two things the plan got wrong.** Greyscale was listed as "modest" and turned out to be *identical*
to indices on every sprite — greyscaling an indexed image is a relabelling, so the run structure is
untouched. It was a dead picker option and was cut, replaced by 32-bit RGBA, which makes the failure
case worse and more honest (four bytes a pixel, and the alpha channel buys nothing because
interleaving separates every pair of them).

And the palette was originally derived from each sprite's own legend, which made palettising exact
*by construction* — so the slide could not show that it is not always. The palette is now a real
median cut capped at 16 entries, and the gradient overflows it. That single change turns the palette
row from "always the winner" into "the winner, but look what it cost", which is a better lesson and
sets up the lossy/lossless act that follows.

---

## 4. `lz77` — the sliding window *(my choice for the fourth)*

**Act:** `entropy`, immediately after `huffman-codes`.
**Replaces:** nothing. It is the deck's biggest hole.

### Why this one

The deck teaches RLE (adjacent repetition) and Huffman (symbol frequency) and never teaches
dictionary matching — which is what actually compresses text, source code, and every file anyone
cares about. `wider-general` currently name-drops LZ77 in a bullet.

More importantly: **DEFLATE is LZ77 followed by Huffman**. A slide here lets the deck say "gzip is
two things you have already watched, stacked" — a payoff no other slide can give. Two slides that
multiply instead of add.

It also completes the thesis. RLE finds redundancy that is *adjacent*; LZ77 finds redundancy that is
*distant*; Huffman finds redundancy that is *statistical*. Three reframings of the same question.

### The visual

An arc drawn over the left text grid, from the cursor back to the match it found. Long arcs mean
long-range redundancy. On a repeated licence header the grid fills with sweeping arcs; on noise
there are none at all, and every token is a literal.

### Controls

| Text | Behaviour |
|---|---|
| **Repeated boilerplate** (a licence header, three times) | huge — long matches, few tokens |
| **Source code** | realistic — many medium matches; this is where the audience lives |
| **The Austen paragraph** (already in `corpus.ts`) | **directly comparable with the Huffman slide's 5.4× on the same text** |
| **ASCII noise** (same generator as `corpus.ts`) | all literals, slight expansion |

Second toggle: **window size** — 32 / 128 / 512 characters. Shrink it and watch the long arcs
vanish one by one as distant matches fall out of reach. That is the knob that explains why gzip has
a window size at all, and why it is a memory-versus-ratio decision rather than a free parameter.

### Phases

1. **Text**
2. **Matching** — the cursor advances; arcs appear as matches are found; the window shades behind it.
3. **Tokens** — the emitted stream: literals as characters, matches as `(distance, length)` chips
   tinted to match the region they point back to. Badge.
4. **Decoded** — rebuilt from tokens alone. **LOSSLESS**.
5. **+ Huffman** — run `engine/codecs/huffman.ts`, untouched, over the token stream and show the
   combined ratio. Caption: **that is DEFLATE**. One extra fragment, and the best value in this
   document.

### Engine

New `src/engine/codecs/lz77.ts`: greedy longest-match over a configurable window, emitting
`{literal}` / `{distance, length}` tokens, plus a decoder. DEFLATE's own parameters (min match 3,
max match 258) so the slide is honest about what gzip does. ~80 lines, round-trip tested. Naive
O(n · window) matching over a 500-character sample is nothing.

### Delivered

`src/engine/codecs/lz77.ts`, `LZ77_TEXTS` in `corpus.ts`, `src/components/slides/Lz77.vue`.

The window knob is the star, and it earns more than expected — at 32 characters the boilerplate's
repeats are out of reach entirely:

| Text | w=32 | w=128 | w=512 | + Huffman (w=512) |
|---|---|---|---|---|
| Boilerplate | 0.94× | 2.78× | 2.76× | **5.20×** |
| Source code | 0.99× | 1.30× | 1.82× | **3.78×** |
| English (Austen) | 0.93× | 1.06× | 1.09× | **2.12×** |
| Noise | 0.89× | 0.89× | 0.89× | 1.23× |

**The DEFLATE fragment is the payoff, and for a better reason than planned.** LZ77 alone barely
pays on anything but boilerplate — under a flat cost model a literal costs nine bits against eight
raw. What it does is *reshape* the data into a very repetitive token stream, and the existing
Huffman coder then roughly doubles the result. "Matching alone is not much use; the pairing is
everything" is a truer story than "LZ77 is great", and it is why DEFLATE exists.

---

## 5. `arithmetic` — fractional bits *(cut)*

**Act:** `entropy`, last.
**Replaces:** nothing. It is the `beyond-huffman` row already in the ROADMAP's Act 3 table, built
properly.

### The argument

Huffman must spend a whole number of bits per symbol. When one symbol has probability 0.9, its ideal
cost is 0.15 bits and Huffman has to charge it 1. Arithmetic coding spends fractional bits and
reaches the entropy floor. That is a real, large, easily-demonstrated win, and it is the natural
answer to the question `huffman-codes` leaves hanging.

### Controls

The picker is a set of alphabets chosen so the gap is visible, and one where there is none:

| Message | Entropy | Huffman | Arithmetic | Gap |
|---|---|---|---|---|
| **90% A / 10% B** | 0.47 b/sym | 1.00 | ~0.47 | **2.1× — Huffman cannot get near it** |
| **½, ⅓, ⅙** | 1.46 | 1.50 | ~1.46 | small |
| **English letters** | ~4.14 | ~4.18 | ~4.14 | tiny — the realistic case |
| **Uniform, 4 symbols** | 2.00 | 2.00 | 2.00 | **none — the control** |

Skewed binary is the default because it is the case that makes the point. Uniform is the control
that stops the slide overclaiming.

### Stage

Different shape from the three-panel slides, deliberately.

- **Left** — the message. Short, ~20 symbols; this is the one slide where a small input is correct.
- **Centre** — the unit interval as a tall bar, subdivided in proportion to the probabilities,
  narrowing as each symbol is consumed.
- **Right** — the output bits, appearing one at a time. The payoff is watching several symbols go in
  before a single bit comes out.
- **Badge** — bits/symbol, with three reference bars: flat, Huffman, and the Shannon floor from
  `codecs/entropy.ts`. Arithmetic landing *on* the floor is the headline.

### Renormalisation is the animation

After twenty symbols at 0.9/0.1 the interval is around 1e-20 and no linear zoom can show it. The
real coder solves this by emitting the top bit once it is settled and rescaling — so **show that**.
When the interval commits to a leading bit, the bit flies to the right panel and the bar springs
back to full height. Honest, and it solves the display problem for free.

### Phases

1. **Message** — symbols and their probabilities.
2. **Narrowing** — subdivide and zoom, with renormalisation beats.
3. **Bits** — the binary expansion; bits lock in.
4. **Compared** — the four bars.
5. **Decoded** — the interval walk run backwards. **LOSSLESS**.

### Engine

New `src/engine/codecs/arithmetic.ts`: a scaled-integer range coder with carry handling and
renormalisation, exposing the interval state per step so the animation can replay it.

**Static model, not adaptive** — probabilities are fixed and shipped as the primer, exactly like
Huffman's code table. It keeps the comparison apples-to-apples and keeps the deck's primer story
consistent. That real coders adapt belongs in the prose, not in the code.

This is the most engine risk of the four. It is scheduled last for that reason, and tagged
`optional` so a dry run that overruns can drop it without leaving a hole.

### Delivered

`src/engine/codecs/arithmetic.ts` (Witten–Neal–Cleary integer coder with underflow handling),
`src/content/alphabets.ts`, `src/components/slides/Arithmetic.vue`. Tagged `optional`.

| Alphabet | Entropy | Huffman | Arithmetic | Gain |
|---|---|---|---|---|
| 90 / 10 | 0.469 | 1.000 | **0.364** | **2.75×** |
| ½ ⅓ ⅙ | 1.459 | 1.500 | 1.424 | 1.05× |
| English | 3.449 | 3.484 | 3.444 | 1.01× |
| Uniform | 2.000 | 2.000 | 2.061 | **0.97×** |

The uniform row is the control and it *loses* — two bits a symbol is already optimal, and on a
33-symbol message the coder's closing flush costs more than it saves. The slide stamps `NO BETTER`
rather than a ratio below one, which is the honest reading.

Renormalisation worked out exactly as hoped: the suite asserts the interval never falls below a
quarter of the register at any step, which is both the coder's correctness guarantee and the reason
the bar stays drawable after thirty symbols.

---

## 6. Net effect, act names, build order

| Act | Now | After | Δ |
|---|---|---|---|
| `framing` | 6 | 7 (+`summarising`) | +1 |
| `simple` | 6 | 3 (`rle-bitmap`, `rle-primer`, `lossy-vs-lossless`) | −3 |
| `entropy` → `codes` | 1 | 3 (+`lz77`, +`arithmetic`) | +2 |
| **Total** | **33** | **33** | **0** |

Same slide count. Seven weaker slides become two strong ones, and two genuine gaps get filled.

### 6.1 Act names

Act ids are not in the URL — only slide ids are — so these rename freely.

| Id | Now | Proposed |
|---|---|---|
| `simple` | *Start simple: run-length encoding* | **The simplest idea, and where it breaks** |
| `entropy` → **`codes`** | *Entropy — spending bits where they count* | **Frequency, distance, and fractions of a bit** (label: *Codes*) |

The second matters: "entropy" stopped describing the act the moment LZ77 joined it, and the new
title is a list of its three slides in order — Huffman finds redundancy in *frequency*, LZ77 in
*distance*, arithmetic coding in the *fractions of a bit* Huffman has to round away. `framing`,
`colour`, `fourier`, `jpeg` and `conclusions` are unchanged.

### 6.2 Order

| # | Item | Why here | Rough size |
|---|---|---|---|
| ~~0a~~ | ~~Loss badge~~ | Done — §1.1 | ✅ |
| ~~0b~~ | ~~Shared modules~~ | Done — §1.2, plus the `basis-64` and `huffman-codes` retrofits | ✅ |
| ~~1~~ | ~~`rle-bitmap`~~ | Four slides deleted | ✅ |
| ~~2~~ | ~~`lz77`~~ | DEFLATE fragment landed | ✅ |
| ~~3~~ | ~~`summarising`~~ | | ✅ |
| ~~4~~ | ~~`arithmetic`~~ | Built, then cut as out of scope | — |

The deck stands at 33 slides, one fewer than it started with: seven weaker slides replaced by two
strong ones, one gap filled (`lz77`), one on-ramp added (`summarising`), and `arithmetic` dropped.

---

## 7. Decisions taken

All four open questions from the first draft are settled.

1. **Canned summaries — yes.** The lossy side of `summarising` uses hand-written summaries stored in
   `src/content/summaries.ts` and credited as such on the slide. §2 turns the constraint into the
   point: the slide can measure a lossy compression's *size* exactly and its *quality* not at all.
2. **BMP — dropped.** Run-length encoding is demonstrated in the abstract on bespoke 16×16 pixel art
   that the slide owns, with no image picker and no quality slider. See §3.1; this turned out to be
   a straight improvement rather than a compromise, because 256 bytes fit on screen in full.
3. **Act names — renamed.** See §6.1. `entropy` becomes `codes`.
4. **Control-row budget — build it and check.** Three of these slides want two per-slide toggles on
   top of the phase buttons. `huffman-codes` runs one comfortably; `rle-bitmap` is the first with
   two and is also first in the build order, so it is the natural place to find out. The failure
   mode is known and cheap to fix — a wrapped control row costs a whole line of canvas height, and
   the fix is `min-width: 0` plus ellipsis on the label, natural-width segmented buttons rather than
   equal columns, and shorter labels.

### Acceptance criteria, every slide

- Fills its box on both a laptop and a 1080p projector, with no `vh` caps and no letterboxing beyond
  ~30px on one axis.
- Control row on one line at both sizes.
- Ratio and LOSSY/LOSSLESS stamps, from measured values, arriving at the end of the animation.
- Phase buttons and arrow keys drive the same timeline.
- One headline number on the stage; everything else in the HUD.
- No text on the stage that is not a live readout.
- Round trip verified in `engine/codecs/roundtrip.test.ts` for any new codec.
