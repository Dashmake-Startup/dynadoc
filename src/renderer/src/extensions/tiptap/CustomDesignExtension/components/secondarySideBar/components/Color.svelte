<script lang="ts">
  import { _ } from 'svelte-i18n'
  // --- COLOR LOGIC UTILS ---
  const hsvToRgb = (h, s, v) => {
    s /= 100
    v /= 100
    let i = Math.floor(h / 60)
    let f = h / 60 - i
    let p = v * (1 - s)
    let q = v * (1 - f * s)
    let t = v * (1 - (1 - f) * s)
    let r, g, b
    switch (i % 6) {
      case 0:
        ;((r = v), (g = t), (b = p))
        break
      case 1:
        ;((r = q), (g = v), (b = p))
        break
      case 2:
        ;((r = p), (g = v), (b = t))
        break
      case 3:
        ;((r = p), (g = q), (b = v))
        break
      case 4:
        ;((r = t), (g = p), (b = v))
        break
      case 5:
        ;((r = v), (g = p), (b = q))
        break
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
  }

  // --- SVELTE 5 STATE ---
  let h = $state(0)
  let s = $state(100)
  let v = $state(100)
  let activeMode = $state('fg') // 'fg' or 'bg'

  let rgb = $derived(hsvToRgb(h, s, v))
  let hex = $derived(`#${rgb.map((x) => x.toString(16).padStart(2, '0')).join('')}`)
  let hueBackground = $derived(`hsl(${h}, 100%, 50%)`)

  // Interactions
  function handleCanvasClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    s = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    v = Math.max(0, Math.min(100, (1 - (e.clientY - rect.top) / rect.height) * 100))
  }

  function handleHueClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    h = Math.max(0, Math.min(360, ((e.clientY - rect.top) / rect.height) * 360))
  }
</script>

<div
  class="w-full bg-base-200 p-3 flex flex-col gap-4 select-none text-xs text-base-content/80 border-l border-base-content/10"
>
  <!-- <div class="flex gap-4 border-b bg-base-400 mb-1">
    <span class="border-b-2 border-white pb-1 text-base-content cursor-pointer">Color</span>
    <span class="pb-1 hover:text-base-content cursor-pointer">Swatches</span>
  </div> -->

  <div class="flex gap-3 h-32">
    <div class="relative w-12 flex-shrink-0">
      <div
        class="absolute top-0 left-0 w-8 h-8 border border-white z-20 shadow-xl"
        style:background-color={activeMode === 'fg' ? hex : '#fff'}
        onclick={() => (activeMode = 'fg')}
      ></div>
      <div
        class="absolute top-4 left-4 w-8 h-8 border border-base-content/35 z-10"
        style:background-color={activeMode === 'bg' ? hex : '#000'}
        onclick={() => (activeMode = 'bg')}
      ></div>
    </div>

    <div
      class="relative flex-grow h-full cursor-crosshair border border-base-content/10"
      style:background-color={hueBackground}
      onmousedown={handleCanvasClick}
    >
      <div class="absolute inset-0 bg-gradient-to-r from-white to-transparent"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>

      <div
        class="absolute w-3 h-3 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style:left="{s}%"
        style:top="{100 - v}%"
      ></div>
    </div>

    <div
      class="w-4 h-full relative cursor-pointer border border-base-content/10 rounded-sm"
      style="background: linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)"
      onmousedown={handleHueClick}
    >
      <div
        class="absolute left-[-2px] right-[-2px] h-1 border-y border-white bg-black/20 pointer-events-none"
        style:top="{(h / 360) * 100}%"
      ></div>
    </div>
  </div>

  <div class="flex flex-col gap-2">
    {#each [['R', rgb[0]], ['G', rgb[1]], ['B', rgb[2]]] as [label, val]}
      <div class="flex items-center gap-2">
        <span class="w-3">{label}</span>
        <div class="flex-grow h-1 bg-base-100 relative">
          <div class="absolute h-full bg-gray-500" style:width="{(Number(val) / 255) * 100}%"></div>
        </div>
        <input
          type="text"
          value={val}
          class="w-8 bg-base-100 border border-base-content/10 text-center py-0.5 outline-none focus:border-blue-500"
        />
      </div>
    {/each}
  </div>

  <div class="flex justify-end items-center gap-2 mt-1">
    <span>#</span>
    <input
      type="text"
      value={hex.replace('#', '').toUpperCase()}
      class="w-20 bg-base-100 border border-base-content/10 px-1 py-0.5 outline-none uppercase"
    />
  </div>
</div>

<style>
  /* Custom scrollbar or input styling if needed */
</style>
