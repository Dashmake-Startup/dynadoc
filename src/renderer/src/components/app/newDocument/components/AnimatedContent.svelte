<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import gsap from 'gsap'
  import { TextPlugin } from 'gsap/dist/TextPlugin'

  gsap.registerPlugin(TextPlugin)

  let { userName = 'Creative', status = 'ready' } = $props()

  let titleElement = $state<HTMLElement>()
  let dynamicSpan = $state<HTMLElement>()

  // Professional phrase rotations for a workstation feel
  const phrases = [
    'writing dynamic contents with AI',
    // "writing something dynamically Amazing",
    'designing something bold with AI',
    'writing a masterpiece with AI',
    'generating a dynamic slide with AI'
    // "building a new layout",
    // "architecting ideas",
    // "visualizing data"
  ]

  let phraseIndex = 0

  $effect(() => {
    // Initial Entrance Animation
    /* if (titleElement) {
      gsap.from(titleElement.querySelectorAll('.char'), {
        y: 20,
        opacity: 0,
        stagger: 0.03,
        duration: 0.8,
        ease: "power4.out"
      });
    } */
    // Phrase Rotation Loop
    /* const interval = setInterval(() => {
      phraseIndex = (phraseIndex + 1) % phrases.length;
      
      gsap.to(dynamicSpan, {
        duration: 0.5,
        text: phrases[phraseIndex],
        ease: "none"
      });
    }, 4000);

    return () => clearInterval(interval); */
  })

  // Helper to split text for GSAP staggered animation
  const staticText = 'Start '
</script>

<div class="py-4 lg:py-8 select-none">
  <h1
    bind:this={titleElement}
    class="text-3xl md:text-3xl font-black tracking-tighter text-base-content flex flex-wrap items-center gap-x-3"
  >
    <i class="ph-bold ph-sparkle"></i>

    <span class="inline-flex italic font-serif">
      <!-- {#each staticText.split("") as char}
        <span class="char inline-block">{char === " " ? "\u00A0" : char}</span>
      {/each} -->
      {staticText}
    </span>

    <span
      bind:this={dynamicSpan}
      class="bg-[length:200%_auto] p-2 rounded-md
           bg-gradient-to-r from-[hsl(var(--p))] via-[hsl(var(--s))] to-[hsl(var(--a))]
            text-base-content
             italic font-serif opacity-90 drop-shadow-sm transition-all duration-500"
    >
      {$_('writing dynamic contents with AI')}
    </span>
  </h1>

  <!-- <p class="mt-3 text-xs font-bold uppercase tracking-[0.3em] opacity-30"> -->
  <!-- Adobe Spectrum GenAI Workspace // 2026 Edition -->
  <!-- </p> -->
</div>

<style>
  /* Ensure characters stay in place during animation */
  .char {
    display: inline-block;
    will-change: transform, opacity;
  }

  /* @layer base { */
  :root {
    /* Adobe Spectrum Pro Palette */
    --p: 215 100% 50%; /* Primary Blue: #0078d4 */
    --s: 275 80% 60%; /* Secondary Purple: #a855f7 */
    --a: 325 90% 60%; /* Accent Pink/Red: #f43f5e */

    /* Text colors for the gradient */
    --primary: hsl(var(--p));
    --secondary: hsl(var(--s));
    --accent: hsl(var(--a));
  }
  /* } */
</style>
