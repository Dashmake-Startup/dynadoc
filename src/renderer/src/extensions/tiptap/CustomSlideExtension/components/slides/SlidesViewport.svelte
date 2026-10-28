<script lang="ts">
  import { _ } from 'svelte-i18n'
  import SlideWrapper from './SlideWrapper.svelte'

  // export let slides: string[]
  interface Props {
    __slideId: string | number
    __slidePath: string
    activeIndex?: number
    __slideHeight?: number | null
    __slideWidth?: number | null
    __maxPageHeight?: number | null
    __maxPageWidth?: number | null
    __wysiwygEditorIdToUpdate?: string | null
    __layout?: string | null
    __transition?: string | null
    __transitionDuration?: number | null
    __transitionSound?: string | null
    __transitionAdvance?: string | null
    __transitionAdvanceAfter?: number | null
  }

  let {
    __slideId,
    __slidePath,
    activeIndex = $bindable(0),
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
  }: Props = $props()

  const WINDOW = 1

  function stateFor(i: number) {
    return 'active'
    if (i === activeIndex) return 'active'
    if (Math.abs(i - activeIndex) <= WINDOW) return 'near'
    return 'far'
  }
</script>

<!-- {#each slides as slideId, i (slideId)} -->

<!-- SlideWrapper {__slideWidth} {__maxPageWidth} -->
<SlideWrapper
  slideId={__slideId}
  slidePath={__slidePath}
  {__transition}
  {__transitionDuration}
  {__transitionSound}
  {__transitionAdvance}
  {__transitionAdvanceAfter}
  {__maxPageHeight}
  {__maxPageWidth}
  {__slideWidth}
  {__slideHeight}
  {__wysiwygEditorIdToUpdate}
  {__layout}
/>
<!-- <SlideWrapper slideId={slideId} {slidePath} state={stateFor(i)} /> -->
<!-- {/each} -->
