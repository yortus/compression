<script setup lang="ts">
import { ref, computed, onUnmounted, watch, nextTick } from 'vue'
import { blobToImageData, SAMPLES } from '../engine/loadImage'

/**
 * A thumbnail of the current image that opens a grid of the alternatives.
 *
 * The image is the deck's main variable — most slides behave completely differently
 * depending on which one is loaded — so it deserves to be visible at a glance rather
 * than spelled out as a row of names, and cheap to change from anywhere.
 */
const emit = defineEmits<{
  load: [imageData: ImageData]
}>()

defineProps<{
  disabled?: boolean
}>()

const fileInput = ref<HTMLInputElement>()
const rootRef = ref<HTMLElement>()
const open = ref(false)

// The grid is teleported to <body> and positioned from the button's rect: the control
// bar clips its overflow, and the popover has to escape it.
const anchor = ref({ left: 0, bottom: 0 })

const selectedUrl = ref<string | null>(null)
const selectedName = ref('')
/** Object URL for a file the user chose, so the thumbnail can show it too. */
const objectUrl = ref<string | null>(null)

const thumbSrc = computed(() => objectUrl.value ?? selectedUrl.value)

function releaseObjectUrl() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
  }
}

async function loadSample(sample: { name: string; url: string }) {
  try {
    const response = await fetch(sample.url)
    const imageData = await blobToImageData(await response.blob())
    releaseObjectUrl()
    selectedUrl.value = sample.url
    selectedName.value = sample.name
    emit('load', imageData)
  } catch {
    emit('load', generateTestImage())
  }
  open.value = false
}

function openDialog() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const imageData = await blobToImageData(file)
  releaseObjectUrl()
  objectUrl.value = URL.createObjectURL(file)
  selectedUrl.value = null
  selectedName.value = file.name
  emit('load', imageData)
  open.value = false
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

// Close on outside click or Escape. Escape is stopped here so it does not also reach
// the deck's own handler and close something else at the same time.
function onDocumentPointerDown(e: PointerEvent) {
  const target = e.target as Node
  if (rootRef.value?.contains(target)) return
  if ((target as HTMLElement)?.closest?.('.picker-grid')) return
  open.value = false
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    open.value = false
  }
}

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  const rect = rootRef.value?.getBoundingClientRect()
  if (rect) {
    anchor.value = { left: rect.left, bottom: window.innerHeight - rect.top + 8 }
  }
}

watch(open, isOpen => {
  if (isOpen) {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    document.addEventListener('keydown', onDocumentKeydown, true)
  } else {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    document.removeEventListener('keydown', onDocumentKeydown, true)
  }
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
  releaseObjectUrl()
})

function loadDefault() {
  loadSample(SAMPLES[0])
}

defineExpose({ loadDefault })
</script>

<template>
  <div ref="rootRef" class="image-picker">
    <button
      class="current"
      :class="{ open }"
      :disabled="disabled"
      :title="selectedName ? `${selectedName} — click to change` : 'choose an image'"
      @click="toggle"
    >
      <img v-if="thumbSrc" :src="thumbSrc" alt="" />
      <span v-else class="empty">?</span>
    </button>

    <!-- Opens upward: the control bar lives at the bottom of the window. -->
    <Teleport to="body">
      <div
        v-if="open"
        class="picker-grid"
        :style="{ left: anchor.left + 'px', bottom: anchor.bottom + 'px' }"
      >
      <button
        v-for="s in SAMPLES" :key="s.url"
        class="tile"
        :class="{ active: selectedUrl === s.url }"
        :title="s.note"
        @click="loadSample(s)"
      >
        <img :src="s.url" alt="" />
        <span class="tile-name">{{ s.name }}</span>
      </button>

      <button class="tile choose" @click="openDialog">
          <span class="choose-icon">+</span>
          <span class="tile-name">Choose…</span>
        </button>
      </div>
    </Teleport>

    <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
  </div>
</template>

<style scoped>
/* .picker-grid and its children are teleported to <body>; see the global block below. */
.image-picker {
  position: relative;
  display: flex;
  align-items: center;
}

.current {
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
}

.current:hover,
.current.open {
  border-color: var(--accent);
  background: var(--bg-elevated);
}

.current img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.empty {
  font-size: 0.6rem;
  color: var(--text-secondary);
}

</style>

<style>
/* Global: this markup is teleported out of the component's DOM subtree. */
.picker-grid {
  position: fixed;
  z-index: 800;
  display: grid;
  grid-template-columns: repeat(5, 4.3rem);
  gap: 0.35rem;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-surface);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.65);
}

.picker-grid .tile {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.15rem;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  overflow: hidden;
}

.picker-grid .tile img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 5px;
  display: block;
}

.picker-grid .tile:hover {
  border-color: var(--accent-dim);
  background: var(--bg-elevated);
}

.picker-grid .tile.active {
  border-color: var(--accent);
}

.picker-grid .tile-name {
  font-size: 0.5rem;
  text-align: center;
  color: var(--text-secondary);
  padding-bottom: 0.15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.picker-grid .tile.active .tile-name {
  color: var(--text);
}

.picker-grid .choose {
  border: 1px dashed var(--accent-dim);
  align-items: center;
  justify-content: center;
}

.picker-grid .choose-icon {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  color: var(--accent);
}
</style>

