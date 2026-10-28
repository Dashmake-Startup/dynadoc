<script lang="ts">
  import 'shepherd.js/dist/css/shepherd.css'
  // ShepherdTourWrapper.svelte
  let {
    __title = '',
    StepComponent,
    currentStep = 1,
    totalSteps = 5
  } = $props<{
    __title?: string
    StepComponent: any
    currentStep?: number
    totalSteps?: number
  }>()
</script>

<div class="overflow-auto">
  <!-- <div class="min-w-[300px] max-w-[400px] overflow-hidden"> -->
  <!-- Adobe-style Header: High Density Info -->
  <div class="flex items-center justify-between mb-4 border-b border-[--theme-border-subtle] pb-2">
    {#if __title}
      <div class="flex items-center gap-2">
        <!-- <i class="ph-bold ph-terminal-window text-primary"></i> -->
        <span class="font-900 tracking-widest text-primary">
          {__title}
        </span>
      </div>
    {/if}

    <!-- Innovative Step Counter -->
    <div class="flex items-center gap-1">
      {#each Array(totalSteps) as _, i}
        <div
          class="h-1 rd-full transition-all duration-300 {i < currentStep
            ? 'w-4 bg-primary'
            : 'w-1 bg-base-content/10'}"
        ></div>
      {/each}
    </div>
  </div>

  <!-- Content Injection -->
  <div class="step-body-transition">
    <svelte:component this={StepComponent} />
  </div>
</div>

<style lang="postcss">
  .step-body-transition {
    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  :global(.shepherd-modal-overlay-container) {
    /* width: 100vw !important; */
    @apply !w-[100vw] !h-[100vh] !bg-transparent !backdrop-blur-sm !bg-opacity-30;
  }
  /* The main popover container */
  :global(.shepherd-element) {
    /* background: var(--theme-popover-bg) !important; */

    background: color-mix(in srgb, var(--theme-popover-bg), transparent 20%) !important;

    /* The Blur Effect */
    backdrop-filter: blur(30px) saturate(180%);
    -webkit-backdrop-filter: blur(30px) saturate(180%); /* Safari support */

    /* Border and Shadow to make the blur "pop" */
    /* border: 1px solid var(--theme-border-subtle) !important; */
    /* box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3); */

    color: var(--color-base-content) !important;
    border: 1px solid var(--theme-border-subtle);
    border-radius: 12px; /* Rounded modern look */
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
    max-width: inherit;
    width: 50%;
    padding: 0.5rem;
  }

  /* The arrow pointing to the element */
  :global(.shepherd-arrow:before) {
    /* background: var(--theme-popover-bg) !important;
    border: 1px solid var(--theme-border-subtle); */

    background: color-mix(in srgb, var(--theme-popover-bg), transparent 20%) !important;
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
  }

  /* Header/Title styling */
  :global(.shepherd-header) {
    background: transparent !important;
    /* padding: 0.75rem 0.75rem 0; */
    padding: 0 0.75rem;
  }

  :global(.shepherd-title) {
    color: var(--theme-text-1) !important;
    font-weight: 700;
    font-size: 1.1rem;
  }

  /* Content body */
  :global(.shepherd-text) {
    color: var(--theme-text-1) !important;
    line-height: 1.6;
    padding: 0.75rem !important;
    font-size: 0.95rem;
  }

  /* Buttons - Using your Teal Accent (--color-base-300) */
  :global(.shepherd-button) {
    background: var(--color-base-300) !important;
    color: white !important; /* Teal looks best with white text */
    border-radius: 60px !important;
    padding: 0.5rem 1rem !important;
    font-weight: 600 !important;
    transition: all 0.2s ease;
    border: none !important;
    cursor: pointer;
  }

  :global(.shepherd-button:hover) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px rgba(0, 190, 172, 0.3);
  }

  /* Secondary/Skip buttons (Outline style) */
  :global(.shepherd-button-secondary) {
    background: transparent !important;
    color: var(--theme-text-muted) !important;
    border: 1px solid var(--theme-border-subtle) !important;
  }

  :global(.shepherd-button-secondary:hover) {
    background: var(--color-base-200) !important;
    color: var(--theme-text-1) !important;
  }

  /* The Backdrop (Dimming effect) */
  :global(.shepherd-modal-overlay-container) {
    opacity: 0.8;
    fill: var(--theme-backdrop-strong) !important;
  }
</style>
