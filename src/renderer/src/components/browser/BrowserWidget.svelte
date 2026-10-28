<script lang="ts">
  import { onMount } from 'svelte'
  import DetachedPanel from '../../extensions/tiptap/components/common/DetachedPanel.svelte'
  import BrowserShell from './BrowserShell.svelte'
  import { _ } from 'svelte-i18n'

  interface Props {
    __isVisible?: boolean
  }

  let { __isVisible = true }: Props = $props()

  let sourceContainer: HTMLDivElement

  function teleport(node: HTMLElement) {
    node.appendChild(sourceContainer)
    return {
      destroy() {
        const storage = document.getElementById('browser-hidden-storage')
        if (storage) storage.appendChild(sourceContainer)
      }
    }
  }
</script>

<div id="browser-hidden-storage" style="display: none;">
  <div bind:this={sourceContainer} class="h-full w-full">
    <BrowserShell __isVisible={__isVisible} />
  </div>
</div>

<DetachedPanel title={$_('Browser')}>
  {#snippet children()}
    <div use:teleport class="h-full w-full overflow-hidden"></div>
  {/snippet}
</DetachedPanel>
