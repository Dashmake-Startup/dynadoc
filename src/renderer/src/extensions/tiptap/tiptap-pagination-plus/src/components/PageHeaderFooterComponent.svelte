<script lang="ts">

  import { _ } from 'svelte-i18n'
  import type { Editor } from "@tiptap/core"
  let { __editor, __index, __height, __className, __margin }: { __editor: Editor, __index: any, __height: any, __className: any, __margin: any } = $props()

</script>

<div
  class="editor-page-section editor-page-{__className} {__margin}"
  style="height: {__height}px; padding: 0px {__margin}px;"
>
  <div
    style="
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          align-items: center;
          width: 100%;
        "
  >
    <slot name="content" />
  </div>
</div>

<!-- </div> -->
<style>
  .editor-page-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
</style>
