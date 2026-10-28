<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'

  // Svelte 5 state runes
  let x = $state(0)
  let y = $state(0)
  let isActive = $state(false)
  let isSpotlightActive = $state(false) // 👈 Added for spotlight

  onMount(() => {
    // 1. Laser Toggle Listener
    window.meetingAPI.onLaserToggle((active) => {
      console.log('Laser State:', active)
      isActive = active
    })

    // 2. Spotlight Toggle Listener
    window.meetingAPI.onSpotlightToggle((active) => {
      console.log('Spotlight State:', active)
      isSpotlightActive = active
    })

    // 3. Shared Position Listener (Both use the same X,Y)
    window.meetingAPI.onLaserCursorUpdate((pos) => {
      x = pos.x
      y = pos.y
    })

    // Cleanup on unmount
    return () => window.meetingAPI.removeMeetingListeners()
  })

  // Keyboard shortcuts for testing locally
  window.addEventListener('keydown', (e) => {
    if (e.key === 'l') isActive = true
    if (e.key === 's') isSpotlightActive = true
  })
  window.addEventListener('keyup', (e) => {
    if (e.key === 'l') isActive = false
    if (e.key === 's') isSpotlightActive = false
  })
</script>

{#if isActive}
  <div class="laser-pointer" style:left="{x}px" style:top="{y}px">
    <div class="core"></div>
    <div class="outer-glow"></div>
  </div>
{/if}

{#if isSpotlightActive}
  <div class="spotlight-overlay" style="--x: {x}px; --y: {y}px;"></div>
{/if}

<style>
  /* :global(:root) { */
  :root {
    background: transparent !important;
  }

  .laser-pointer {
    position: fixed;
    pointer-events: none;
    transform: translate(-50%, -50%);
    z-index: 10000; /* Higher than spotlight */
  }

  .core {
    width: 8px;
    height: 8px;
    background: #ff3b30;
    border-radius: 50%;
    box-shadow: 0 0 10px #ff3b30;
  }
  .outer-glow {
    position: absolute;
    width: 40px;
    height: 40px;
    background: radial-gradient(circle, rgba(255, 59, 48, 0.3) 0%, rgba(255, 59, 48, 0) 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .spotlight-overlay2 {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6); /* Dim the screen */
    pointer-events: none;
    /* Create a hole at the cursor position */
    mask-image: radial-gradient(circle 120px at var(--x) var(--y), transparent 100%, black 100%);
    -webkit-mask-image: radial-gradient(
      circle 120px at var(--x) var(--y),
      transparent 100%,
      black 100%
    );
  }

  .spotlight-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7); /* Slightly darker for better focus */
    pointer-events: none;
    z-index: 9999;

    /* Smooth hole transition */
    mask-image: radial-gradient(circle 120px at var(--x) var(--y), transparent 95%, black 100%);
    -webkit-mask-image: radial-gradient(
      circle 120px at var(--x) var(--y),
      transparent 95%,
      black 100%
    );
  }
</style>
