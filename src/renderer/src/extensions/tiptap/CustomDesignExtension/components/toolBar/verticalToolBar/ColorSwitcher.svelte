<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { spectrumIcons } from '../../../../../../components/common/icons/Icons'

  // Svelte 5 reactive state
  let foreground = $state('#ffffff')
  let background = $state('#000000')

  const swapColors = () => {
    const temp = foreground
    foreground = background
    background = temp
  }

  const resetColors = () => {
    foreground = '#ffffff'
    background = '#000000'
  }

  // Keyboard Shortcuts (X for swap, D for reset)
  $effect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key.toLowerCase() === 'x') swapColors()
      if (e.key.toLowerCase() === 'd') resetColors()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })
</script>

<div class="flex flex-col items-center gap-2 p-2 bg-base-200 w-max select-none">
  <div class="relative w-11 h-11">
    <div
      class="absolute bottom-0 right-0 w-[30px] h-7 border-2 bg-base-400 shadow-sm cursor-pointer z-10 transition-transform active:scale-95"
      style:background-color={background}
      title={$_('Background Color (click to edit)')}
    >
      <input
        type="color"
        bind:value={background}
        class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </div>

    <div
      class="absolute top-0 left-0 w-[30px] h-7 border-2 bg-base-400 shadow-md cursor-pointer z-20 transition-transform active:scale-95"
      style:background-color={foreground}
      title={$_('Foreground Color (click to edit)')}
    >
      <input
        type="color"
        bind:value={foreground}
        class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      />
    </div>

    <button
      onclick={swapColors}
      class="absolute top-[-2px] right-[-2px] z-30 text-[#ccc] hover:text-base-content transition-colors bg-transparent border-none p-0 cursor-pointer"
      title={$_('Switch Foreground and Background Colors (X)')}
    >
      <span>{@html spectrumIcons.spectrumIconReplace}</span>
    </button>

    <button
      onclick={resetColors}
      class="absolute bottom-[-2px] left-[-2px] z-30 text-[#ccc] hover:text-base-content transition-colors bg-transparent border-none p-0 cursor-pointer"
      title={$_('Default Foreground and Background Colors (D)')}
    >
      <div class="flex flex-col gap-[1px] border border-[#ccc] p-[1px] bg-base-200">
        <div class="w-[20px] h-2 bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)]"></div>
        <div class="w-[20px] h-2 bg-black"></div>
      </div>
    </button>
  </div>
</div>

<style>
  /* Ensure the color inputs don't show default browser UI padding */
  input[type='color']::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  input[type='color']::-webkit-color-swatch {
    border: none;
  }
</style>
