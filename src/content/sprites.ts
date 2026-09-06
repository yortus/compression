/**
 * The artwork the run-length slide encodes, and the four ways it can be written down.
 *
 * Bespoke 16×16 pixel art rather than a photograph, for one decisive reason: 256 pixels is
 * a byte stream that fits on screen in full. Every number the slide reports can be counted
 * by eye from the hex dump beside it. A 512px sample image would have shown the first few
 * hundred of 786,432 bytes and asked the audience to take the rest on trust.
 *
 * Six sprites, chosen to span the outcome space rather than to be pretty. Run-length
 * encoding is the most input-sensitive technique in the deck — spectacular on one image and
 * worse than useless on the next — and a picker that only contained wins would be a demo
 * instead of an argument. The gradient is the control, and it fails twice: nothing repeats,
 * so there is nothing to collapse, and it has more colours than the palette can hold, so
 * the one representation that could find runs in it has to discard colour to do so.
 *
 * Pixel art is *authored* as palette indices, which is the honest starting point. The RGB
 * representation is what happens if you store it the naive way, and the run count collapses
 * from one-per-band to nearly one-per-pixel.
 */

import { palettiseRgb } from '../engine/codecs/palette'

export const SPRITE_SIZE = 16

/**
 * Sixteen entries — four-bit indexed colour, which is a real format (BMP's `BI_RLE4` codes
 * exactly this) and, more to the point, small enough that a smooth ramp does not fit.
 *
 * That is the whole reason for the cap. Every hand-drawn sprite here has at most eight
 * colours and palettises exactly; the gradient has 256 and cannot, so the palette row
 * becomes the only representation on the slide that is *itself* lossy. Palettising is a
 * reframe that usually costs nothing and sometimes costs the picture.
 */
export const MAX_PALETTE = 16

export type Representation = 'rgba' | 'planes' | 'palette'

export interface Sprite {
  id: string
  label: string
  /** What this one is here to show, printed under the picker. */
  note: string
  /** One character per pixel, `SPRITE_SIZE` rows of `SPRITE_SIZE`. Keys of `legend`. */
  rows?: string[]
  legend?: Record<string, [number, number, number]>
  /**
   * Colours directly, three bytes per pixel, for artwork with more shades than a legend of
   * single characters could name.
   */
  paint?: () => Uint8Array
}

const BG: [number, number, number] = [26, 26, 40]

/** Eight two-row bands, so the whole picture is eight runs of 32 bytes. */
function bands(): string[] {
  const keys = 'abcdefgh'
  return Array.from({ length: SPRITE_SIZE }, (_, y) =>
    keys[Math.floor(y / 2)].repeat(SPRITE_SIZE))
}

/**
 * A smooth two-axis ramp: every pixel a different colour from its neighbour, and 256
 * distinct colours in 256 pixels.
 *
 * It is the worst case twice over. No two adjacent bytes are equal, so run-length coding
 * has nothing to collapse; and there are sixteen times more colours than the palette can
 * hold, so the one representation that *would* have found runs can only do it by throwing
 * colours away. The dithered ramp beside it in the picker is the other half of that trade.
 */
function gradient(): Uint8Array {
  const out = new Uint8Array(SPRITE_SIZE * SPRITE_SIZE * 3)
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const u = x / (SPRITE_SIZE - 1)
      const v = y / (SPRITE_SIZE - 1)
      const i = (y * SPRITE_SIZE + x) * 3
      // Red tracks x alone and green tracks y alone, so no two pixels share a colour.
      out[i] = Math.round(28 + 214 * u)
      out[i + 1] = Math.round(36 + 186 * v)
      out[i + 2] = Math.round(196 - 84 * v + 44 * u)
    }
  }
  return out
}

/**
 * A left-to-right ramp rendered with a 4×4 ordered dither — the classic way to fake shades
 * you do not have, and a classic way to destroy every run in the image while doing it.
 */
function dither(): string[] {
  const M = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ]
  return Array.from({ length: SPRITE_SIZE }, (_, y) =>
    Array.from({ length: SPRITE_SIZE }, (_, x) => {
      const level = (x / (SPRITE_SIZE - 1)) * 16
      return level > M[y % 4][x % 4] ? 'b' : 'a'
    }).join(''))
}

/** Seeded, so the control case is the same in rehearsal as on the night. */
function noise(): string[] {
  let state = 0x9e3779b9
  const keys = 'abcdefgh'
  return Array.from({ length: SPRITE_SIZE }, () =>
    Array.from({ length: SPRITE_SIZE }, () => {
      state ^= state << 13; state >>>= 0
      state ^= state >>> 17
      state ^= state << 5; state >>>= 0
      return keys[state % keys.length]
    }).join(''))
}

const RAMP: Record<string, [number, number, number]> = {
  a: [24, 30, 54], b: [40, 58, 104], c: [58, 92, 150], d: [82, 130, 190],
  e: [120, 170, 214], f: [162, 202, 232], g: [206, 228, 244], h: [244, 248, 252],
}

export const SPRITES: Sprite[] = [
  {
    id: 'heart',
    label: 'Heart',
    note: 'few colours, wide flat areas',
    rows: [
      '................',
      '..###.....###...',
      '.#ooo#...#---#..',
      '#oooo-#.#-----#.',
      '#ooo----------#.',
      '#-------------#.',
      '.#-----------#..',
      '.#-----------#..',
      '..#---------#...',
      '..#---------#...',
      '...#-------#....',
      '....#-----#.....',
      '.....#---#......',
      '......#-#.......',
      '.......#........',
      '................',
    ],
    legend: { '.': BG, '#': [122, 20, 44], '-': [214, 48, 76], o: [246, 138, 158] },
  },
  {
    id: 'invader',
    label: 'Invader',
    note: 'two colours, long horizontal runs',
    rows: [
      '................',
      '.....#....#.....',
      '......#..#......',
      '.....########...',
      '....##.####.##..',
      '...############.',
      '...#.########.#.',
      '...#.#......#.#.',
      '...#.#......#.#.',
      '...#.########.#.',
      '...############.',
      '.....#.####.#...',
      '....#........#..',
      '...##........##.',
      '................',
      '................',
    ],
    legend: { '.': BG, '#': [126, 232, 118] },
  },
  {
    id: 'bands',
    label: 'Bands',
    note: 'best case — eight runs for 256 pixels',
    rows: bands(),
    legend: RAMP,
  },
  {
    id: 'gradient',
    label: 'Gradient',
    note: 'no repeats, and too many colours for a palette',
    paint: gradient,
  },
  {
    id: 'dither',
    label: 'Dithered ramp',
    note: 'a gradient faked with a 4×4 dither, and no runs left',
    rows: dither(),
    legend: { a: [18, 18, 30], b: [232, 232, 240] },
  },
  {
    id: 'noise',
    label: 'Noise',
    note: 'seeded random — the control case',
    rows: noise(),
    legend: RAMP,
  },
]

export function spriteById(id: string): Sprite {
  return SPRITES.find(s => s.id === id) ?? SPRITES[0]
}

export interface SpritePixels {
  /** The artwork as it is meant to look: three bytes per pixel, before any reframing. */
  rgb: Uint8Array
  /** One palette index per pixel, row-major. */
  indices: Uint8Array
  palette: [number, number, number][]
  /** True when the artwork has more colours than `MAX_PALETTE` and had to lose some. */
  lossyPalette: boolean
  sourceColours: number
}

function spriteRgb(sprite: Sprite): Uint8Array {
  if (sprite.paint) return sprite.paint()
  const legend = sprite.legend ?? {}
  const rows = sprite.rows ?? []
  const out = new Uint8Array(SPRITE_SIZE * SPRITE_SIZE * 3)
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const [r, g, b] = legend[rows[y]?.[x]] ?? [0, 0, 0]
      const i = (y * SPRITE_SIZE + x) * 3
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
    }
  }
  return out
}

/**
 * The artwork, and the same artwork reduced to at most `MAX_PALETTE` colours.
 *
 * Both are kept, because the difference between them *is* the palette row's loss. An
 * earlier version derived the palette straight from the legend, which made palettising
 * exact by construction and left the slide unable to show that it is not always.
 */
export function spritePixels(sprite: Sprite): SpritePixels {
  const rgb = spriteRgb(sprite)
  const reduced = palettiseRgb(rgb, MAX_PALETTE)
  return {
    rgb,
    indices: reduced.indices,
    palette: reduced.palette.map(c => [c[0], c[1], c[2]] as [number, number, number]),
    lossyPalette: reduced.lossy,
    sourceColours: reduced.sourceColors,
  }
}

/**
 * Worst to best, left to right. The order is the argument: the same encoder gets steadily
 * better results as the bytes are given a better meaning, and nothing about the coder
 * changes along the way.
 */
export const REPRESENTATIONS: { id: Representation; label: string; unit: string; primer: string }[] = [
  {
    id: 'rgba',
    label: '32-bit RGBA',
    unit: 'red, green, blue and alpha, interleaved, four bytes per pixel',
    primer: 'No primer. Every pixel carries its own colour, and neighbouring bytes are ' +
      'four channels of four different things — which is why almost no two in a row are equal.',
  },
  {
    id: 'planes',
    label: 'Colour planes',
    unit: 'all the red, then all the green, then all the blue',
    primer: 'No primer. Exactly the same colour bytes, visited plane by plane instead of ' +
      'pixel by pixel — a reordering, and nothing else.',
  },
  {
    id: 'palette',
    label: 'Palette',
    unit: 'one palette index per pixel',
    primer: '',
  },
]

/**
 * The same picture as bytes, four ways.
 *
 * Nothing about the encoder changes between these — only what the bytes *mean*. That is
 * the whole slide, and the reason this returns a plain `Uint8Array` in every case.
 */
export function spriteBytes(pixels: SpritePixels, rep: Representation): Uint8Array {
  const { indices, rgb } = pixels
  const n = indices.length

  if (rep === 'palette') return indices

  // The two colour representations carry the *true* colours, so both are exact and only
  // the palette row can lose anything.
  if (rep === 'planes') {
    const out = new Uint8Array(n * 3)
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < n; i++) out[c * n + i] = rgb[i * 3 + c]
    }
    return out
  }

  // RGBA. The alpha byte is a constant 255 and still buys nothing, because interleaving
  // puts three unrelated bytes between each pair of them.
  const out = new Uint8Array(n * 4)
  for (let i = 0; i < n; i++) {
    out[i * 4] = rgb[i * 3]
    out[i * 4 + 1] = rgb[i * 3 + 1]
    out[i * 4 + 2] = rgb[i * 3 + 2]
    out[i * 4 + 3] = 255
  }
  return out
}

/** The picture as it is meant to look — what every decode is compared against. */
export function sourceRgb(pixels: SpritePixels): Uint8Array {
  return pixels.rgb
}

/**
 * The picture the decoder gets back, from the decoded byte stream alone.
 *
 * Deliberately *not* mapped through the palette by nearest colour. An earlier version did
 * that, and it hid the one interesting thing the palette row has to show — that reducing
 * 256 colours to sixteen cannot be undone. Comparing rendered RGB is the honest test: it
 * asks whether the audience gets their picture back, not whether an intermediate array
 * survived.
 */
export function decodedRgb(bytes: Uint8Array, rep: Representation, pixels: SpritePixels): Uint8Array {
  const n = pixels.indices.length
  const out = new Uint8Array(n * 3)
  for (let i = 0; i < n; i++) {
    let r: number, g: number, b: number
    if (rep === 'palette') {
      const rgb = pixels.palette[bytes[i]] ?? [0, 0, 0]
      ;[r, g, b] = rgb
    } else if (rep === 'planes') {
      r = bytes[i]; g = bytes[n + i]; b = bytes[n * 2 + i]
    } else {
      r = bytes[i * 4]; g = bytes[i * 4 + 1]; b = bytes[i * 4 + 2]
    }
    out[i * 3] = r
    out[i * 3 + 1] = g
    out[i * 3 + 2] = b
  }
  return out
}
