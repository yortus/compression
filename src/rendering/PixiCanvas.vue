<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineExpose } from 'vue'
import { Application, Container } from 'pixi.js'

const emit = defineEmits<{
  ready: [app: Application]
}>()

const containerRef = ref<HTMLDivElement>()
let app: Application | null = null

onMounted(async () => {
  if (!containerRef.value) return
  app = new Application()
  await app.init({
    background: 0x14141f,
    resizeTo: containerRef.value,
    antialias: true,
  })
  containerRef.value.appendChild(app.canvas)
  emit('ready', app)
})

onUnmounted(() => {
  if (app) {
    app.destroy({ removeView: true })
    app = null
  }
})

defineExpose({ getApp: () => app })
</script>

<template>
  <div ref="containerRef" class="pixi-container" />
</template>

<style scoped>
.pixi-container {
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>
