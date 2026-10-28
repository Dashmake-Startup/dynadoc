<script>
  import { _ } from 'svelte-i18n'
  let {
    __wrapperId,
    __protectedContent,
    __protectionPaneHTMLContainerRoot,
    __node,
    __editor,
    __getPos,
    __author,
    __text,
    __shieldMethod = 'lock',
    __securityMethod = null,
    __policyConfigured = false,
    __maskWidth = null,
    __onUnset
  } = $props()

  import { mount } from 'svelte'
  import ContextMenu from '../../../../components/common/contextMenu/ContextMenu.svelte'
  import ProtectionPane from './ProtectionPane.svelte'
  import CustomSecuredContentExtensionMenuContent from './CustomSecuredContentExtensionMenuContent.svelte'

  const __props = $derived.by(() => ({
    __wrapperId,
    __node,
    __editor,
    __getPos,
    __author,
    __text,
    __onUnset,
    __protectionPaneHTMLContainerRoot,
    __shieldMethod,
    __securityMethod,
    __policyConfigured
  }))

  function openProtectionPane() {
    const pane = __protectionPaneHTMLContainerRoot
    if (!pane) return

    pane.innerHTML = ''
    mount(ProtectionPane, {
      target: pane,
      props: {
        __wrapperId,
        __node,
        __editor,
        __getPos
      }
    })
  }

  const securityLabel = $derived.by(() =>
    __securityMethod ? String(__securityMethod).toUpperCase() : 'UNCONFIGURED'
  )
  const shieldLabel = $derived.by(() => String(__shieldMethod || 'lock').toUpperCase())
</script>

<ContextMenu __component={CustomSecuredContentExtensionMenuContent} {__props}>
  <button
    class="secured-content-trigger"
    class:needs-config={!__policyConfigured}
    class:mode-hidden={__shieldMethod === 'hidden'}
    class:mode-blur={__shieldMethod === 'blur'}
    class:mode-lock={__shieldMethod === 'lock'}
    onclick={(event) => {
      if (!__policyConfigured) {
        event.preventDefault()
        event.stopPropagation()
        openProtectionPane()
      }
    }}
    title={!__policyConfigured ? 'Configure security method' : 'Protected content'}
  >
    <!-- <span
      class="secured-content-text"
      class:is-hidden={__shieldMethod === 'hidden'}
      class:is-blur={__shieldMethod === 'blur'}
      style={__maskWidth ? `width: ${__maskWidth}px;` : ''}
    > -->
    <span
      class="secured-content-text"
      class:is-hidden={__shieldMethod === 'hidden'}
      class:is-blur={__shieldMethod === 'blur'}
      style={__maskWidth ? `width: ${__maskWidth}px;` : ''}
    >
      {@html __protectedContent}
      {#if __shieldMethod === 'hidden'}
        <span class="secured-hidden-overlay"></span>
      {/if}
    </span>
    <span class="secured-chip">
      <i class={!__policyConfigured ? 'ph-light ph-warning-circle' : 'ph-light ph-shield-check'}
      ></i>
      {shieldLabel} · {securityLabel}
    </span>
  </button>
</ContextMenu>

<style>
  :global(.secured-content) {
    position: relative;
    display: inline;
  }

  :global(.secured-content-wrapper) {
    display: inline-block;
    position: relative;
    vertical-align: baseline;
  }

  .secured-content-trigger {
    display: inline-flex;
    align-items: center;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    padding: 0 4px;
    background: rgba(0, 0, 0, 0.06);
    color: inherit;
    cursor: pointer;
    position: relative;
  }

  .secured-content-trigger.needs-config {
    border-style: dashed;
    border-color: rgba(245, 158, 11, 0.45);
    background: rgba(245, 158, 11, 0.1);
  }

  .secured-content-trigger.mode-hidden {
    background: rgba(17, 17, 17, 0.85);
  }

  .secured-content-trigger.mode-blur {
    background: rgba(255, 255, 255, 0.08);
  }

  .secured-content-trigger.mode-lock {
    background: rgba(37, 45, 62, 0.28);
  }

  .secured-content-text {
    display: inline-block;
    min-width: 12px;
    white-space: pre-wrap;
  }

  .secured-content-text.is-hidden {
    overflow: hidden;
    white-space: nowrap;
    display: inline-block;
    position: relative;
    color: transparent;
    text-shadow: none;
  }

  .secured-content-text.is-blur {
    filter: blur(6px);
    user-select: none;
  }

  .secured-hidden-overlay {
    position: absolute;
    inset: 0;
    background: white;
    border-radius: 2px;
    pointer-events: none;
  }

  .secured-chip {
    position: absolute;
    top: -18px;
    right: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 9px;
    line-height: 1;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(220, 228, 255, 0.78);
    padding: 2px 4px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.44);
    border: 1px solid rgba(255, 255, 255, 0.08);
    opacity: 0;
    pointer-events: none;
    transform: translateY(4px);
    transition:
      opacity 120ms ease,
      transform 120ms ease;
    z-index: 10;
  }

  .secured-content-trigger:hover .secured-chip {
    opacity: 1;
    transform: translateY(0);
  }
</style>
