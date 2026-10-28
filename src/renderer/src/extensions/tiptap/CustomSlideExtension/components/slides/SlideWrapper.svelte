<script lang="ts">
  import { _ } from 'svelte-i18n'
  import ActiveSlide from './ActiveSlide.svelte'
  // import StaticSlide from './DELETE/StaticSlide.svelte'
  // import Thumbnail from './Thumbnail.svelte'

  let {
    slideId,
    slidePath,
    state = 'active',
    __slideHeight = null,
    __slideWidth = null,
    __maxPageHeight = null,
    __maxPageWidth = null,
    __wysiwygEditorIdToUpdate = null,
    __layout = null,
    __transition = null,
    __transitionDuration = null,
    __transitionSound = null,
    __transitionAdvance = null,
    __transitionAdvanceAfter = null
  } = $props()
</script>

<!-- {#if state === 'active'} -->
  <ActiveSlide __slideId={slideId} __slidePath={slidePath}
  {__maxPageHeight}
      {__maxPageWidth}
      {__slideWidth}
      {__slideHeight}
      {__wysiwygEditorIdToUpdate}
      {__layout}
      {__transition}
      {__transitionDuration}
      {__transitionSound}
      {__transitionAdvance}
      {__transitionAdvanceAfter} />
<!-- {:else if state === 'near'}
  <StaticSlide {slideId} />
{:else}
  <Thumbnail {slideId} />
{/if} -->
