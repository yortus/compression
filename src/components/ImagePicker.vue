<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  load: [imageData: ImageData]
}>()

const fileInput = ref<HTMLInputElement>()

const SAMPLES = [
  { name: 'Photo', url: '/samples/photo.jpg' },
  { name: 'Graphic', url: '/samples/graphic.png' },
  { name: 'Gradient', url: '/samples/gradient.png' },
]

function openDialog() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const imageData = await loadFile(file)
  if (imageData) emit('load', imageData)
}

async function loadSample(url: string) {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const imageData = await blobToImageData(blob)
    if (imageData) emit('load', imageData)
  } catch {
    // Sample not found — generate a fallback test image
    emit('load', generateTestImage())
  }
}

async function loadFile(file: File): Promise<ImageData | null> {
  return blobToImageData(file)
}

async function blobToImageData(blob: Blob): Promise<ImageData | null> {
  const bitmap = await createImageBitmap(blob)
  // Cap at 512px to keep processing fast
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

function generateTestImage(): ImageData {
  const w = 256, h = 256
  const data = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      data.data[i] = Math.round((x / w) * 255)
      data.data[i + 1] = Math.round((y / h) * 255)
      data.data[i + 2] = 128
      data.data[i + 3] = 255
    }
  }
  return data
}

// Auto-load a test image on mount if no samples available
function loadDefault() {
  loadSample(SAMPLES[0].url)
}

defineExpose({ loadDefault })
</script>

<template>
  <div class="image-picker">
    <div class="samples">
      <button
        v-for="s in SAMPLES"
        :key="s.name"
        @click="loadSample(s.url)"
        class="sample-btn"
      >
        {{ s.name }}
      </button>
    </div>
    <button @click="openDialog" class="upload-btn">Choose File…</button>
    <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
  </div>
</template>

<style scoped>
.image-picker {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.samples {
  display: flex;
  gap: 0.25rem;
}

.upload-btn {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
</style>
