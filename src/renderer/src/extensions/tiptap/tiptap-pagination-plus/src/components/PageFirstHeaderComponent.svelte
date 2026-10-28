

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { Editor } from '@tiptap/core'
  import CurvedToolbar from './CurvedToolbar.svelte'
  import ImageEditor from '../../../../components/common/image/ImageEditor.svelte'

  export let __editor: Editor = null
  export let __pageWidth
  export let __pageHeight
  export let __headerHeight
  export let __footerHeight
  export let __gap
</script>

<!-- <div class="header-footer-bg-editor">
  <ImageEditor __src={''} __width={__pageWidth} __height={__pageHeight} />
</div> -->

<div
  style="
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          align-items: center;
          width: 100%;
        "
>
  <div style="text-align: left;">{$_('Page header')}</div>
  <div style="text-align: center;"></div>
  <div style="text-align: right;"></div>
</div>
<!-- <img src={""} class="page-bg" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:-1;" /> -->
<!-- <img src={bgImage.src} class="page-bg" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:-1;" /> -->
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
  <!-- <img class="page-background-design-canvas" width={__pageWidth} height={__pageHeight}/> -->
  <canvas class="page-background-design-canvas" width={__pageWidth} height={__pageHeight}> </canvas>
</div>
<CurvedToolbar {__editor} />

<!-- </div> -->
<style>
  .page-background {
    background-color: white;
    position: absolute;
    width: 100%;
  }
</style>
