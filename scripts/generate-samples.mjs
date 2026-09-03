import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const samplesDir = join(__dirname, '..', 'public', 'samples')
mkdirSync(samplesDir, { recursive: true })

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

// --- Run all ---
console.log('Generating sample images...\n')
await downloadPhoto()
await generateGraphic()
await generateGradient()
console.log('\nDone!')
