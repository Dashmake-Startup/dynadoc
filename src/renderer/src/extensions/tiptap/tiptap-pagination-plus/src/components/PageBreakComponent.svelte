<script lang="ts">
  import { _ } from 'svelte-i18n'
  import CurvedToolbar from './CurvedToolbar.svelte'
  import PageHeaderFooterComponent from './PageHeaderFooterComponent.svelte'
  import type { Editor } from '@tiptap/core'

  let {
    __editor,
    __pageHeight,
    __pageWidth,
    __headerHeight,
    __footerHeight,
    __gap
  } = $props()
  // export let __index
  // export let __total
  // export let __totalHeight
  // export let __margin
</script>

<div class="custom-page-break-wrapper">
  <!-- <CurvedToolbar {__editor} /> -->

  <!-- <div
    class="page-background rounded-xl shadow-lg border border-gray-200 p-6 mx-auto"
    style="
        height: {__pageHeight + __headerHeight + __footerHeight + __gap}px;
        
      "
  > -->
  <div
    class="page-background"
    style="
        height: {__pageHeight + __headerHeight + __footerHeight + __gap}px;
        
      "
  >
    <canvas class="page-background-design-canvas" width={__pageWidth} height={__pageHeight}>
    </canvas>
  </div>
</div>

<!-- </div> -->
<style>
  .custom-page-break-wrapper {
    position: absolute;
    width: 100%;
    left: 0;
    /* top: calc(-1 * (var(--rm-margin-top))) !important; */
  }
  :global(.rm-first-page-header .custom-page-break-wrapper) {
    /* top: calc(-1 * var(--rm-content-margin-top)) !important; */
  }
  .page-background {
    background-color: white;
    position: absolute;
    width: 100%;
    z-index: -30;
    top: 0;
  }
  /* .editor-page-footer,
  .editor-page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  } */
</style>
