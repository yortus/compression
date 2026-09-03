<script setup lang="ts">
const props = defineProps<{
  current: number
  total: number
  title: string
}>()

const emit = defineEmits<{
  goTo: [index: number]
}>()

const STEP_LABELS = [
  'Source', 'Color', 'Subsample', 'Blocks',
  'DCT', 'Quantize', 'Zigzag', 'RLE', 'Huffman', 'Result',
]
</script>

<template>
  <div class="progress-bar">
    <div class="steps">
      <button
        v-for="(label, i) in STEP_LABELS"
        :key="i"
        :class="['step-dot', { active: i === current, visited: i < current }]"
        @click="emit('goTo', i)"
        :title="label"
      >
        <span class="dot" />
        <span class="label">{{ label }}</span>
      </button>
    </div>
    <div class="position">{{ current + 1 }}/{{ total }} — {{ title }}</div>
  </div>
</template>

<style scoped>
.progress-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2.5rem;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  z-index: 100;
}

.steps {
  display: flex;
  gap: 0.25rem;
}

.step-dot {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.step-dot:hover {
  background: var(--bg-elevated);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border);
  transition: background 0.2s, transform 0.2s;
}

.step-dot.visited .dot {
  background: var(--accent-dim);
}

.step-dot.active .dot {
  background: var(--accent);
  transform: scale(1.4);
}

.label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.step-dot.active .label {
  color: var(--text);
  font-weight: 600;
}

.position {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
