<script>
  let { key } = $props()
</script>

<!--
<div class="document-editor-wrapper">
  <div class="navigation-tab">
    <slot name="navigation-tab"></slot>
  </div>

  <div class="editor-container">
    <div class="ribbon">
      <slot name="ribbon"></slot>
    </div>

    <div class="editor">
      <slot name="editor"></slot>
    </div>

    <div id="panel">
      <slot name="panel"></slot>
    </div>
  </div>
</div> -->

<!-- <div class="document-editor-wrapper"> -->

<slot name="navigation-tab"></slot>
<slot name="ribbon"></slot>
<slot name="editor"></slot>
<slot name="panel"></slot>

<!-- <div class="navigation-tab">
    <slot name="navigation-tab"></slot>
  </div>

  <div class="editor-container">
    <div class="ribbon">
      <slot name="ribbon"></slot>
    </div>

    <div class="editor">
      <slot name="editor"></slot>
    </div>

    <div>
      <slot name="panel"></slot>
    </div>
  </div>
</div> -->
