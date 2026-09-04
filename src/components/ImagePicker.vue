<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  load: [imageData: ImageData]
}>()

defineProps<{
  disabled?: boolean
}>()

const fileInput = ref<HTMLInputElement>()
const activeSample = ref<string | null>(null)

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
  const imageData = await blobToImageData(file)
  if (imageData) {
    activeSample.value = null
    emit('load', imageData)
  }
}

async function loadSample(url: string) {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const imageData = await blobToImageData(blob)
    if (imageData) {
      activeSample.value = url
      emit('load', imageData)
    }
  } catch {
    // Sample not found — generate a fallback test image
    activeSample.value = null
    emit('load', generateTestImage())
  }
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

// Called by the control bar so the deck is never sitting on an empty slide.
function loadDefault() {
  loadSample(SAMPLES[0].url)
}

defineExpose({ loadDefault })
</script>

<template>
  <div class="image-picker">
    <button
      v-for="s in SAMPLES"
      :key="s.name"
      class="chip"
      :class="{ active: activeSample === s.url }"
      :disabled="disabled"
      @click="loadSample(s.url)"
    >
      {{ s.name }}
    </button>
    <button class="chip file" :disabled="disabled" @click="openDialog">File…</button>
    <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
  </div>
</template>

<style scoped>
.image-picker {
  display: flex;
  gap: 0.2rem;
  align-items: center;
}

.chip {
  padding: 0.2rem 0.5rem;
  font-size: 0.62rem;
  border-radius: 4px;
}

.chip.file {
  color: var(--text-secondary);
}
</style>
