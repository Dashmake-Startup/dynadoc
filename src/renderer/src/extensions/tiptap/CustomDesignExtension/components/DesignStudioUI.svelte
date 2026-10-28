<script lang="ts">
  import { _ } from 'svelte-i18n'
  import EditToolBar from './toolBar/editToolBar/EditToolBar.svelte'

  let {
    __canvaHeight = null,
    __canvaWidth = null,
    __maxPageHeight = null,
    __maxPageWidth = null
  } = $props()
</script>

<!-- Ui {__maxPageHeight} -->

<!-- <div class="ui flex max-w-[{__maxPageWidth}px] w-full h-[{__maxPageHeight}px]
   max-h-[{__maxPageHeight}px] flex-col bg-gray-600 font-sans text-gray-200"
> -->
<div
  class="flex w-full h-full max-h-[{__maxPageHeight}px] flex-col bg-gray-600 font-sans text-gray-200"
>
  <!-- <EditToolBar></EditToolBar> -->

  <div class="flex flex-grow overflow-hidden">
    <main class="flex-grow flex items-center justify-center overflow-auto bg-gray-600">
      <!-- <div
        class="canvas-area relative flex items-center justify-center"
        style="width: 100%; height: 100%;"
      >
        <div
          class="w-full h-full bg-gray-800 shadow-2xl flex items-center justify-center"
        > -->
      <!-- <img src="/path/to/car-image.jpg" alt="Editing" class="max-w-full max-h-full object-contain"> -->
      <slot name="editor-canvas" />
      <!-- </div>
      </div> -->
    </main>
  </div>
</div>
