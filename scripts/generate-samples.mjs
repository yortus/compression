import sharp from 'sharp'
import { SPRITES_8, SPRITES_16, SPRITES_32, spriteColor } from './pixelart.mjs'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const samplesDir = join(__dirname, '..', 'public', 'samples')
mkdirSync(samplesDir, { recursive: true })

const FORCE = process.argv.includes('--force')
const SIZE = 512

/** Skip work that is already done — the peppers photo cannot be re-downloaded. */
function needs(name) {
  if (FORCE || !existsSync(join(samplesDir, name))) return true
  console.log(`  · ${name} already exists, skipping (use --force to rebuild)`)
  return false
}

/** Deterministic PRNG, so the sample set is reproducible. */
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function raw(buf, name, width = SIZE, height = width) {
  await sharp(buf, { raw: { width, height, channels: 3 } })
    .png()
    .toFile(join(samplesDir, name))
  console.log(`  ✓ ${name}`)
}

function surface(fn) {
  const buf = Buffer.alloc(SIZE * SIZE * 3)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = fn(x, y)
      const i = (y * SIZE + x) * 3
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b
    }
  }
  return buf
}

// --- Photo: download bell peppers from Pixabay (CC0) ---
async function downloadPhoto() {
  // Pixabay image 499068 by Hans — "Bell Peppers, Sweet Peppers, Capsicums"
  // Pixabay Content License: free for commercial and non-commercial use
  const url = 'https://cdn.pixabay.com/photo/2014/08/09/12/04/bell-peppers-414186_640.jpg'
  console.log('Downloading peppers photo...')

  const res = await fetch(url)
  if (!res.ok) {
    console.log(`Primary URL failed (${res.status}), trying fallback...`)
    return downloadPhotoFallback()
  }

  const buffer = Buffer.from(await res.arrayBuffer())
  await sharp(buffer)
    .resize(512, 512, { fit: 'cover' })
    .jpeg({ quality: 95 })
    .toFile(join(samplesDir, 'photo.jpg'))

  console.log('  ✓ photo.jpg (512×512)')
}

async function downloadPhotoFallback() {
  // Fallback: try the alternate Pixabay CDN path
  const urls = [
    'https://cdn.pixabay.com/photo/2017/06/09/16/39/bell-peppers-2387394_640.jpg',
    'https://cdn.pixabay.com/photo/2016/08/11/08/04/vegetables-1585060_640.jpg',
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const buffer = Buffer.from(await res.arrayBuffer())
      await sharp(buffer)
        .resize(512, 512, { fit: 'cover' })
        .jpeg({ quality: 95 })
        .toFile(join(samplesDir, 'photo.jpg'))
      console.log('  ✓ photo.jpg (512×512) from fallback')
      return
    } catch { /* try next */ }
  }

  // Last resort: generate a photo-like synthetic image
  console.log('  Could not download — generating synthetic peppers...')
  await generateSyntheticPhoto()
}

async function generateSyntheticPhoto() {
  const w = 512, h = 512
  const buf = Buffer.alloc(w * h * 3)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      // Colored regions simulating peppers on a dark background
      const cx = x / w, cy = y / h
      const d1 = Math.hypot(cx - 0.3, cy - 0.4)
      const d2 = Math.hypot(cx - 0.65, cy - 0.35)
      const d3 = Math.hypot(cx - 0.5, cy - 0.7)

      if (d1 < 0.25) {
        // Red pepper
        const g = 1 - d1 / 0.25
        buf[i] = Math.min(255, Math.round(200 * g + 30))
        buf[i + 1] = Math.round(40 * g)
        buf[i + 2] = Math.round(20 * g)
      } else if (d2 < 0.22) {
        // Yellow pepper
        const g = 1 - d2 / 0.22
        buf[i] = Math.min(255, Math.round(230 * g + 20))
        buf[i + 1] = Math.min(255, Math.round(200 * g + 20))
        buf[i + 2] = Math.round(30 * g)
      } else if (d3 < 0.2) {
        // Green pepper
        const g = 1 - d3 / 0.2
        buf[i] = Math.round(30 * g + 10)
        buf[i + 1] = Math.min(255, Math.round(160 * g + 20))
        buf[i + 2] = Math.round(40 * g + 10)
      } else {
        // Dark background with slight gradient
        const v = Math.round(20 + 15 * cy)
        buf[i] = v; buf[i + 1] = v - 5; buf[i + 2] = v + 5
      }

      // Add subtle noise for texture
      const noise = Math.round((Math.random() - 0.5) * 8)
      buf[i] = Math.max(0, Math.min(255, buf[i] + noise))
      buf[i + 1] = Math.max(0, Math.min(255, buf[i + 1] + noise))
      buf[i + 2] = Math.max(0, Math.min(255, buf[i + 2] + noise))
    }
  }

  await sharp(buf, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 95 })
    .toFile(join(samplesDir, 'photo.jpg'))
  console.log('  ✓ photo.jpg (512×512, synthetic)')
}

// --- Graphic: sharp-edged image that shows JPEG ringing artifacts ---
async function generateGraphic() {
  const w = 512, h = 512

  // Build an SVG with geometric shapes and text
  const svg = `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#ffffff"/>

    <!-- Colored rectangles -->
    <rect x="40" y="40" width="200" height="160" fill="#e63946" rx="0"/>
    <rect x="270" y="40" width="200" height="160" fill="#457b9d" rx="0"/>
    <rect x="40" y="230" width="200" height="160" fill="#2a9d8f" rx="0"/>
    <rect x="270" y="230" width="200" height="160" fill="#e9c46a" rx="0"/>

    <!-- Black circle on white -->
    <circle cx="256" cy="440" r="50" fill="#000000"/>

    <!-- Diagonal lines -->
    <line x1="0" y1="0" x2="512" y2="512" stroke="#000" stroke-width="3"/>
    <line x1="512" y1="0" x2="0" y2="512" stroke="#000" stroke-width="3"/>

    <!-- Bold text -->
    <text x="256" y="135" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="72" font-weight="bold" fill="#ffffff">JPEG</text>

    <!-- Fine text -->
    <text x="256" y="345" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="18" fill="#000000">Sharp edges cause ringing artifacts</text>

    <!-- Thin black/white stripes (high frequency) -->
    ${Array.from({ length: 16 }, (_, i) =>
      `<rect x="${40 + i * 8}" y="410" width="4" height="60" fill="#000"/>`
    ).join('\n    ')}
  </svg>`

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(samplesDir, 'graphic.png'))
  console.log('  ✓ graphic.png (512×512)')
}

// --- Gradient: smooth transitions that show banding ---
async function generateGradient() {
  const w = 512, h = 512
  const buf = Buffer.alloc(w * h * 3)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      // Horizontal: black → white
      // Vertical: hue shift
      const t = x / w
      const hue = (y / h) * 360
      const [r, g, b] = hslToRgb(hue, 0.6, 0.15 + t * 0.7)
      buf[i] = r
      buf[i + 1] = g
      buf[i + 2] = b
    }
  }

  await sharp(buf, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile(join(samplesDir, 'gradient.png'))
  console.log('  ✓ gradient.png (512×512)')
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs(hp % 2 - 1))
  let r1 = 0, g1 = 0, b1 = 0
  if (hp < 1) { r1 = c; g1 = x }
  else if (hp < 2) { r1 = x; g1 = c }
  else if (hp < 3) { g1 = c; b1 = x }
  else if (hp < 4) { g1 = x; b1 = c }
  else if (hp < 5) { r1 = x; b1 = c }
  else { r1 = c; b1 = x }
  const m = l - c / 2
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ]
}




/** Big flat areas: the case run-length encoding was invented for. */
async function generateFlat() {
  const palette = [
    [230, 57, 70], [241, 250, 238], [168, 218, 220],
    [69, 123, 157], [29, 53, 87], [244, 162, 97],
  ]
  await raw(surface((x, y) => {
    const band = Math.floor(y / (SIZE / 3))
    const col = Math.floor(x / (SIZE / 2))
    return palette[(band * 2 + col) % palette.length]
  }), 'flat.png')
}

/** A 2px checkerboard — the highest frequency an 8x8 DCT block can carry. */
async function generateChecker() {
  await raw(surface((x, y) => {
    const on = ((x >> 1) + (y >> 1)) % 2 === 0
    return on ? [250, 250, 250] : [12, 12, 12]
  }), 'checker.png')
}

/**
 * Frequency sweep: a linear chirp left to right, contrast falling top to bottom.
 *
 * Every spatial frequency the format can represent appears exactly once, so lowering the
 * quality slider visibly eats the image from the right (fine detail) and the bottom (low
 * contrast) inwards. It turns quantisation from a claim into something you watch happen.
 */
async function generateSweep() {
  const F0 = 1 / 64          // cycles per pixel at the left edge
  const F1 = 0.42            // just under Nyquist at the right edge
  await raw(surface((x, y) => {
    // Integrated phase, so the frequency ramps smoothly rather than jumping.
    const phase = 2 * Math.PI * (F0 * x + ((F1 - F0) * x * x) / (2 * SIZE))
    const contrast = 1 - 0.9 * (y / SIZE)
    const v = Math.round(128 + 120 * contrast * Math.sin(phase))
    const c = Math.max(0, Math.min(255, v))
    return [c, c, c]
  }), 'sweep.png')
}

// --- Photographs from Wikimedia Commons -----------------------------------
// Freely licensed and downscaled hard from much larger originals, which averages the
// source JPEG's artifacts away; stored as PNG so the deck's "raw pixels" really are raw.
// Attribution is reproduced in public/samples/CREDITS.md.


/**
 * Pixel art, packed edge to edge, every sprite aligned to the 8x8 grid.
 *
 * Alignment is the point: a JPEG block then contains exactly one 8x8 sprite, one quadrant
 * of a 16x16, or one sixteenth of a 32x32 — so the DCT and quantisation slides can show a
 * block whose content is actually identifiable. Flat sprites give an almost pure DC
 * coefficient; the busy multicolour ones light up the high frequencies.
 *
 * Unlike every other sample this one is not 512px. Nothing here needs to be: the sprites
 * are the subject, and a 512px canvas only bought blank margins, which price into the
 * ratio as free wins and teach the audience nothing. `blobToImageData` caps at 512 rather
 * than resizing up to it, so a smaller image loads at its native pixels.
 *
 * The packer is a row-major greedy fill rather than the old scatter-with-padding: it walks
 * every cell in order, drops the largest sprite that fits in the space still free, and
 * falls back to an 8x8 — which always fits — so the sheet finishes with no gaps at all.
 */
const PIXELART_SIZE = 192

async function generatePixelArt() {
  const cells = PIXELART_SIZE / 8
  const buf = Buffer.alloc(PIXELART_SIZE * PIXELART_SIZE * 3, 255)
  const filled = new Uint8Array(cells * cells)
  const rand = rng(20260906)

  const put = (rows, cx, cy) => {
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const colour = spriteColor(rows[y][x])
        if (!colour) continue
        const i = ((cy * 8 + y) * PIXELART_SIZE + cx * 8 + x) * 3
        buf[i] = colour[0]; buf[i + 1] = colour[1]; buf[i + 2] = colour[2]
      }
    }
  }

  const fits = (cx, cy, w) => {
    if (cx + w > cells || cy + w > cells) return false
    for (let y = cy; y < cy + w; y++) {
      for (let x = cx; x < cx + w; x++) if (filled[y * cells + x]) return false
    }
    return true
  }

  // Each size gets its own shuffled bag, dealt round-robin, so the sheet uses the whole
  // cast before repeating anyone rather than leaning on whichever sprite the RNG liked.
  const bag = sprites => {
    const deck = Object.values(sprites)
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[deck[i], deck[j]] = [deck[j], deck[i]]
    }
    let next = 0
    return () => deck[next++ % deck.length]
  }
  const deal = { 1: bag(SPRITES_8), 2: bag(SPRITES_16), 4: bag(SPRITES_32) }

  const counts = { 1: 0, 2: 0, 4: 0 }
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      if (filled[cy * cells + cx]) continue
      const roll = rand()
      const size = (roll < 0.22 && fits(cx, cy, 4)) ? 4
        : (roll < 0.7 && fits(cx, cy, 2)) ? 2
          : 1
      for (let y = cy; y < cy + size; y++) {
        for (let x = cx; x < cx + size; x++) filled[y * cells + x] = 1
      }
      put(deal[size](), cx, cy)
      counts[size]++
    }
  }

  await raw(buf, 'pixelart.png', PIXELART_SIZE)
  const total = counts[1] + counts[2] + counts[4]
  console.log(`    (${PIXELART_SIZE}×${PIXELART_SIZE}, ${total} sprites: `
    + `${counts[4]}×32px, ${counts[2]}×16px, ${counts[1]}×8px, no blank cells)`)
}

const COMMONS = {
  parrot: {
    title: 'Eclectus roratus closeup.jpg',
    credit: 'Bernard Spragg. NZ',
    licence: 'CC0',
    why: 'saturated colour and fine feather detail against smooth bokeh',
  },
  forest: {
    title: 'Birchwood Slavnoe 2012 G1.jpg',
    credit: 'George Chernilevsky',
    licence: 'Public domain',
    why: 'dense high-frequency twigs over flat snow, almost monochrome',
  },
}

const USER_AGENT = 'compression-talk-samples/1.0 (educational slide deck; contact yortus@gmail.com)'

async function downloadCommons(entry, outName) {
  const query = new URLSearchParams({
    action: 'query',
    titles: `File:${entry.title}`,
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '2000',
    format: 'json',
  })
  const meta = await fetch(`https://commons.wikimedia.org/w/api.php?${query}`, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!meta.ok) throw new Error(`Commons API ${meta.status}`)
  const info = Object.values((await meta.json()).query.pages)[0].imageinfo[0]

  const image = await fetch(info.thumburl, { headers: { 'User-Agent': USER_AGENT } })
  if (!image.ok) throw new Error(`download ${image.status}`)

  // `attention` crops toward the busiest region, which lands on the subject.
  await sharp(Buffer.from(await image.arrayBuffer()))
    .resize(SIZE, SIZE, { fit: 'cover', position: 'attention' })
    .png()
    .toFile(join(samplesDir, outName))
  console.log(`  ✓ ${outName} — ${entry.credit}, ${entry.licence} (from ${info.width}x${info.height})`)
}

// --- Extra samples ---------------------------------------------------------
// Each one exists to break a different technique, so the deck's "some schemes are
// very sensitive to their input" argument has real evidence behind it.

/** Small text: sharp edges everywhere, the classic JPEG ringing case. */
async function generateText() {
  const lines = [
    'Compression is a bet about the data you will meet.',
    'Run-length encoding wins on repetition and loses',
    'on everything else. Huffman measures the symbols',
    'first, so it adapts. Arithmetic coding gets under',
    'a whole bit per symbol. The discrete cosine',
    'transform does not compress anything at all —',
    'it rearranges the picture so that throwing most',
    'of it away stops being noticeable.',
  ]
  const svg = `
  <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>
    <text x="24" y="40" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="#111">Sharp edges</text>
    ${lines.map((l, i) =>
      `<text x="24" y="${92 + i * 30}" font-family="Georgia, serif" font-size="17" fill="#111">${l}</text>`
    ).join(' ')}
    ${Array.from({ length: 9 }, (_, i) =>
      `<text x="24" y="${350 + i * 17}" font-family="monospace" font-size="11" fill="#333">the quick brown fox jumps over the lazy dog 0123456789</text>`
    ).join(' ')}
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(join(samplesDir, 'text.png'))
  console.log('  ✓ text.png')
}

/** Uniform noise: no redundancy at all, so nothing lossless can help. */
async function generateNoise() {
  const rand = rng(1234)
  await raw(surface(() => [rand() * 255, rand() * 255, rand() * 255]), 'noise.png')
}

/** Line art: two colours, long runs along the strokes, palettises exactly. */
async function generateLineArt() {
  const svg = `
  <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>
    <g stroke="#000" fill="none" stroke-width="3">
      <circle cx="256" cy="256" r="180"/>
      <circle cx="256" cy="256" r="120"/>
      <circle cx="256" cy="256" r="60"/>
      ${Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return `<line x1="256" y1="256" x2="${256 + Math.cos(a) * 180}" y2="${256 + Math.sin(a) * 180}"/>`
      }).join(' ')}
      <rect x="76" y="76" width="360" height="360"/>
    </g>
  </svg>`
  await sharp(Buffer.from(svg)).png().toFile(join(samplesDir, 'lineart.png'))
  console.log('  ✓ lineart.png')
}

/** Ordered dithering: looks smooth, but every pixel differs from its neighbour. */
async function generateDither() {
  const bayer = [
    [0, 8, 2, 10], [12, 4, 14, 6],
    [3, 11, 1, 9], [15, 7, 13, 5],
  ]
  await raw(surface((x, y) => {
    const shade = (x / SIZE) * 0.7 + (y / SIZE) * 0.3
    const threshold = (bayer[y % 4][x % 4] + 0.5) / 16
    const on = shade > threshold
    return on ? [20, 24, 40] : [235, 235, 245]
  }), 'dither.png')
}

/** Pixel-art blocks: exact repetition in both directions, few colours. */
async function generateMosaic() {
  const rand = rng(99)
  const cells = 16
  const colours = Array.from({ length: cells * cells }, () => [
    Math.floor(rand() * 6) * 42 + 20,
    Math.floor(rand() * 6) * 42 + 20,
    Math.floor(rand() * 6) * 42 + 20,
  ])
  const step = SIZE / cells
  await raw(surface((x, y) => {
    const c = Math.floor(y / step) * cells + Math.floor(x / step)
    return colours[c]
  }), 'mosaic.png')
}

const EXTRA = [
  ['text.png', generateText],
  ['noise.png', generateNoise],
  ['lineart.png', generateLineArt],
  ['dither.png', generateDither],
  ['mosaic.png', generateMosaic],
  ['pixelart.png', generatePixelArt],
  ['flat.png', generateFlat],
  ['checker.png', generateChecker],
  ['sweep.png', generateSweep],
  ['parrot.png', () => downloadCommons(COMMONS.parrot, 'parrot.png')],
  ['forest.png', () => downloadCommons(COMMONS.forest, 'forest.png')],
]

// --- Run all ---
console.log('Generating sample images...\n')
if (needs('photo.jpg')) await downloadPhoto()
if (needs('graphic.png')) await generateGraphic()
if (needs('gradient.png')) await generateGradient()
for (const [name, fn] of EXTRA) {
  if (needs(name)) await fn()
}
console.log('\nDone!')
