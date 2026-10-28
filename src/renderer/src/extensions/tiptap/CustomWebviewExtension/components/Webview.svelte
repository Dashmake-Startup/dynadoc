<script lang="ts">
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import Platform from '../../../../libs/platform'
  import Resizer from '../../../../components/app/editor/components/display/Resizer.svelte'
  import ScrollGuardOverlay from '../../../../components/common/interaction/ScrollGuardOverlay.svelte'

  interface Props {
    node?: any
    view?: any
    getPos?: () => number
    updateAttributes?: (attrs: Record<string, any>) => void
    selected?: boolean
    extension?: any
    // The '?' here marks them as optional in the type system
    __src?: string
    __onSubmit?: Function
    __height?: number
    __width?: number
    __maxPageHeight?: number
    __maxPageWidth?: number
    __wysiwygEditorIdToUpdate?: string
  }

  let {
    node, // The Prosemirror node (contains attributes)
    view, // The editor view
    getPos, // Function to get the current position
    updateAttributes, // Function to update node attributes
    selected, // Boolean: is the node selected?
    extension, // The extension instance
    __src, //make it optional
    __onSubmit, //make it optional
    __height,
    __width,
    __maxPageHeight,
    __maxPageWidth,
    __wysiwygEditorIdToUpdate
  }: Props = $props()

  // Derived values: Use the prop if passed, otherwise fall back to the Tiptap node attribute
  let _src = $derived(__src ?? node.attrs.src)
  let _onSubmit = $derived(__onSubmit)
  let _height = $derived(__height ?? node.attrs.height)
  let _width = $derived(__width ?? node.attrs.width)
  let _maxPageHeight = $derived(__maxPageHeight || node.attrs.maxPageHeight)
  let _maxPageWidth = $derived(__maxPageWidth ?? node.attrs.maxPageWidth)
  let _wysiwygEditorIdToUpdate = $derived(
    __wysiwygEditorIdToUpdate ?? node.attrs.wysiwygEditorIdToUpdate
  )

  // let _src = ''
  let _currentlyInputSrc = ''
  let _urlInputTextEl
  let error = ''
  let _nodeViewRoot: HTMLDivElement | null = null
  let _isVisible = $state(false)
  let _observer: IntersectionObserver | null = null

  const _placeholderHeight = $derived(
    (() => {
      const raw = _height ?? _maxPageHeight ?? 260
      const value = typeof raw === 'number' ? raw : parseFloat(String(raw))
      return Number.isFinite(value) ? value : 260
    })()
  )

  const ensureVisible = () => {
    if (_isVisible) return
    _isVisible = true
    _observer?.disconnect()
    _observer = null
  }

  function normalizeUrl(value: string) {
    if (!value) return ''
    if (!/^https?:\/\//i.test(value)) {
      return 'https://' + value
    }
    return value
  }

  function submit(url?: string) {
    ensureVisible()
    _src = url || _src
    console.log('yes submit')
    const normalized = normalizeUrl(_src.trim())

    try {
      new URL(normalized)
      error = ''
      _onSubmit?.(normalized)
      // dispatch('submit', { url: normalized })
      _src = normalized
      console.log('yes submit _src ', { _src, normalized })

      // update node src
      updateAttributes({
        src: _src
      })
    } catch {
      error = 'Invalid URL'
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') submit(_currentlyInputSrc)
    if (e.key === 'Escape') _currentlyInputSrc = ''
  }

  onMount(() => {
    // const tabs = _urlInputTextEl;
    _urlInputTextEl.addEventListener('change', (e) => {
      console.log('yes submit change.', { e }, e.target.value, e.target.detail)
      _src = e.target.value
    })
    _urlInputTextEl.addEventListener('input', (e) => {
      // console.log('yes submit input.', { e }, e.target.value, e.target.detail)
      _currentlyInputSrc = e.target.value
    })

    if (typeof IntersectionObserver === 'undefined') {
      ensureVisible()
      return
    }

    _observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          ensureVisible()
        }
      },
      {
        root: view?.dom?.parentElement ?? null,
        rootMargin: '600px 0px'
      }
    )

    if (_nodeViewRoot) {
      _observer.observe(_nodeViewRoot)
    }

    return () => {
      _observer?.disconnect()
      _observer = null
    }
  })
  // ... (Keep all your existing Props and derived logic exactly as they are) ...

  let _isLoading = $state(true)
  let _isLocked = $state(true) // Innovative: Interaction Lock
  const _transport = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop ? 'webview' : 'iframe'
  const _isDesktopPlatform = _transport === 'webview'

  function toggleLock() {
    _isLocked = !_isLocked
  }

  // Existing submit logic remains unchanged, but we wrap it in a "mechanical" UI
  let _webviewEl: HTMLElement | null = null // Use HTMLElement or any if types are strict
  let _iframeEl: HTMLIFrameElement | null = null

  // Adobe Mechanical Logic: Handlers for Electron/Webview events
  function handleLoadStart() {
    _isLoading = true
  }
  function handleLoadStop() {
    _isLoading = false
  }

  onMount(() => {
    if (_isDesktopPlatform && _webviewEl) {
      // Manual event listeners bypass standard HTML attribute type checking
      _webviewEl.addEventListener('did-start-loading', handleLoadStart)
      _webviewEl.addEventListener('did-stop-loading', handleLoadStop)
      _webviewEl.addEventListener('did-fail-load', () => {
        _isLoading = false
      })
    }

    return () => {
      if (_isDesktopPlatform && _webviewEl) {
        _webviewEl.removeEventListener('did-start-loading', handleLoadStart)
        _webviewEl.removeEventListener('did-stop-loading', handleLoadStop)
      }
    }
  })
</script>

<NodeViewWrapper>
  <Resizer
    __width={_width}
    __height={_height}
    __maxHeight={_maxPageHeight}
    __maxWidth={_maxPageWidth}
    __onUpdate={(newAttrs) => updateAttributes(newAttrs)}
  >
    <div class="adobe-webview-shell w-[{_width}] h-[{_height}]" class:is-selected={selected}>
      <div class="adobe-property-bar">
        <div class="status-chip" class:live={!_isLoading && _src}>
          <span class="dot"></span>
          <span class="eyebrow">{_src ? 'SERVICE_ACTIVE' : 'AWAITING_URL'}</span>
        </div>

        <div class="status-chip">
          <span class="dot"></span>
          <span class="eyebrow">{_transport}</span>
        </div>

        <div class="input-orchestrator">
          <i class="ph-bold ph-link-simple"></i>
          <input
            bind:this={_urlInputTextEl}
            class="adobe-input"
            placeholder={$_('Introduce online service URL...')}
            value={_src}
            onkeydown={onKeydown}
          />
        </div>

        <button class="adobe-execute-btn" onclick={() => submit()}>
          <i class="ph-bold ph-lightning"></i>
          <span>{$_('INITIALIZE')}</span>
        </button>
      </div>

      <div class="adobe-viewport-area">
        <aside class="adobe-gutter">
          <button
            class="gutter-tool"
            class:active={!_isLocked}
            onclick={() => (_isLocked = !_isLocked)}
          >
            <i class="ph-bold {_isLocked ? 'ph-lock' : 'ph-lock-open'}"></i>
          </button>
          <button
            class="gutter-tool"
            onclick={() => {
              _isLoading = true
              if (_isDesktopPlatform && _webviewEl) {
                ;(_webviewEl as any)?.reload?.()
              } else if (_iframeEl) {
                _iframeEl.src = _src
              }
            }}
          >
            <i class="ph-bold ph-arrows-clockwise"></i>
          </button>
          <div class="gutter-filler"></div>
          <button class="gutter-tool"><i class="ph-bold ph-info"></i></button>
        </aside>

        <div class="webview-canvas">
          <ScrollGuardOverlay message="Click to interact with service">
            {#if _src}
              {#if _isDesktopPlatform}
                <webview
                  bind:this={_webviewEl}
                  src={_src}
                  class="w-[{_maxPageWidth}px] h-[{_maxPageHeight}px]"
                  class:is-clipping={_isLocked}
                ></webview>
              {:else}
                <iframe
                  bind:this={_iframeEl}
                  src={_src}
                  title={$_('Embedded service')}
                  class="w-[{_maxPageWidth}px] h-[{_maxPageHeight}px] border-none bg-black"
                  class:is-clipping={_isLocked}
                  allow="camera *; microphone *; display-capture *; autoplay; fullscreen; clipboard-read; clipboard-write"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                  onload={handleLoadStop}
                  onerror={() => {
                    _isLoading = false
                  }}
                ></iframe>
              {/if}
            {:else}
              <div class="webview-placeholder" style={`height: ${_placeholderHeight}px`}>
                <i class="ph-duotone ph-browser text-3xl opacity-20 mb-2"></i>
                <span class="eyebrow">{$_('NO_ACTIVE_SERVICE')}</span>
              </div>
            {/if}
          </ScrollGuardOverlay>
        </div>
      </div>
    </div>
  </Resizer>
</NodeViewWrapper>

<style lang="postcss">
  /* Styles remain the same as the previous Adobe Blueprint design */
  /* Using @keyframes for the .adobe-loader progress animation */
  @keyframes progress {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(200%);
    }
  }

  .adobe-webview-shell {
    @apply flex flex-col bg-[var(--color-base-100)] border border-white/5 rd-4px overflow-hidden shadow-2xl transition-all;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 20px 40px rgba(0, 0, 0, 0.4);
  }

  .is-selected {
    @apply border-[var(--color-base-300)]/50 ring-1 ring-[var(--color-base-300)]/20;
  }

  /* --- Property Bar --- */
  .adobe-property-bar {
    @apply flex items-center gap-3 p-2 bg-black/40 border-b border-white/5;
  }

  .status-chip {
    @apply flex items-center gap-2 px-2 py-1 bg-black/40 rd-2px border border-white/5;
  }
  .dot {
    @apply size-1.5 rd-full bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)];
  }
  .status-chip.live .dot {
    @apply bg-[var(--color-base-300)] shadow-[0_0_8px_var(--color-base-300)];
  }
  .eyebrow {
    @apply text-[8px] font-900 tracking-[0.15em] text-[var(--color-base-content)]/30 uppercase;
  }

  .input-orchestrator {
    @apply flex-1 flex items-center gap-2 h-7 bg-black/20 px-2 rd-2px border border-white/5 focus-within:border-white/20;
  }
  .input-orchestrator i {
    @apply text-[var(--color-base-content)]/20 text-10px;
  }
  .adobe-input {
    @apply flex-1 bg-transparent border-none outline-none text-11px font-mono text-[var(--color-base-content)]/60 placeholder:text-[var(--color-base-content)]/10;
  }

  .adobe-execute-btn {
    @apply h-7 px-3 bg-[var(--color-base-300)] text-black font-900 text-[9px] tracking-widest rd-2px 
           flex items-center gap-2 hover:bg-[#00D9C5] transition-all active:scale-95;
  }

  /* --- Viewport & Gutter --- */
  .adobe-viewport-area {
    @apply flex-1 flex overflow-hidden bg-black;
  }

  .adobe-gutter {
    @apply w-9 flex flex-col items-center py-2 bg-black/20 border-r border-white/5 gap-1;
  }
  .gutter-tool {
    @apply size-7 flex items-center justify-center text-[var(--color-base-content)]/20 rd-2px transition-all hover:(bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-[var(--color-base-content)]);
  }
  .gutter-tool.active {
    @apply text-[var(--color-base-300)] bg-[color-mix(in_srgb,var(--color-base-300)_10%,transparent)];
  }
  .gutter-filler {
    @apply flex-1;
  }

  .webview-canvas {
    @apply flex-1 relative;
  }

  .is-clipping {
    @apply grayscale-[0.2] opacity-80 pointer-events-none;
  }

  /* --- Blueprint Loader --- */
  .blueprint-overlay {
    @apply absolute inset-0 bg-[var(--color-base-100)] flex items-center justify-center z-50;
    background-image: radial-gradient(circle, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 16px 16px;
  }
  .loader-stack {
    @apply flex flex-col items-center gap-3;
  }
  .mono-label {
    @apply text-[9px] font-mono text-[var(--color-base-300)] opacity-40 tracking-tighter;
  }
  .adobe-loader {
    @apply w-32 h-[1px] bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] overflow-hidden relative;
  }
  .adobe-loader::after {
    content: '';
    @apply absolute top-0 left-0 h-full bg-[var(--color-base-300)] w-1/2 animate-[progress_1.5s_infinite_ease-in-out];
  }

  .webview-placeholder {
    @apply flex flex-col items-center justify-center bg-[var(--color-base-200)] text-[var(--color-base-content)]/20 border-none;
  }

  .adobe-error-toast {
    @apply mt-2 text-[10px] font-bold text-red-400 flex items-center gap-2 uppercase tracking-widest;
  }

  @keyframes progress {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(200%);
    }
  }
</style>
