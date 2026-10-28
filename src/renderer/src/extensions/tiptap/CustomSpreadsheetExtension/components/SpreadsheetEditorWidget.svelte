<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'

  // import jspreadsheet from 'jspreadsheet-ce'
  // import  'jspreadsheet-ce/dist/jspreadsheet.css'
  // import  'jspreadsheet-ce/dist/jspreadsheet.themes.css'
  // import spreadsheet from '../libs/x-spreadsheet/dist/xspreadsheet.js'
  // import Spreadsheet from '../libs/x-spreadsheet/src/index'
  let sheetName = 'Sheet1'
  import Resizer from '../../../../components/app/editor/components/display/Resizer.svelte'
  import { nodeApi } from '../../../../utils/shims/node'
  import { _$_resolvedTheme } from '../../../../stores/theme.store'

  let {
    __src = '',
    __spreadsheetHeight = null,
    __spreadsheetWidth = null,
    __maxPageHeight = null,
    __maxPageWidth = null,
    __wysiwygEditorIdToUpdate = null,
    __parentDoc = null,
    __userInfo = null,
    __sheetName = null,
    __disableCollab = false,
    __readOnly = false,
    __resizable = false,
    __updateAttributes = null
  } = $props()
  // export let __maxPageHeight: number = null
  // export let __maxPageWidth: number = 1000

  let _spreadsheetContainer: HTMLDivElement
  let _rootEl: HTMLDivElement
  let _scrollTarget: HTMLElement | null = null
  let _srcLabel = ''
  let _resizeObserver: ResizeObserver | null = null
  // The <react-spreadsheet-editor> tag below is held back until the custom
  // element class is actually registered. ReactSpreadsheetEditorElement's
  // parentDoc/userInfo are accessor properties (set parentDoc(...)); setting
  // them on an un-upgraded element would create plain shadowing own
  // properties that never reach the real setter, even after upgrade —
  // silently breaking later collab-presence updates via use:setParentDoc.
  let _customElementReady = $state(false)

  // Helper to handle preventDefault consistently
  const prevent = (fn) => (event) => {
    event.preventDefault()
    fn?.(event)
  }

  const handleWheel = (event) => {
    if (!_scrollTarget) return
    _scrollTarget.scrollTop += event.deltaY
    _scrollTarget.scrollLeft += event.deltaX
  }

  const setParentDoc = (node, props) => {
    if (node && props) {
      ;(node as any).parentDoc = props.doc
      ;(node as any).userInfo = props.userInfo
    }
    return {
      update(newProps) {
        if (node && newProps) {
          ;(node as any).parentDoc = newProps.doc
          ;(node as any).userInfo = newProps.userInfo
        }
      }
    }
  }

  onMount(() => {
    // Registers the <react-spreadsheet-editor> custom element. Loaded on
    // demand — it drags in react, react-dom and @fortune-sheet/react, which
    // must not sit on the first-render critical path for plain text
    // documents. The tag itself only renders once this resolves (see
    // _customElementReady above), so use:setParentDoc never sets
    // parentDoc/userInfo on an un-upgraded element.
    import('./react/ReactSpreadsheetEditor').then(() => {
      _customElementReady = true
    })

    try {
      const ext = nodeApi?.path?.extname?.(__src) || ''
      _srcLabel = nodeApi?.path?.basename?.(__src, ext) || __src
    } catch {
      _srcLabel = __src
    }
    if (_rootEl) {
      _scrollTarget =
        _rootEl.querySelector('.fortune-sheet-container') ||
        _rootEl.querySelector('.fortune-workarea') ||
        _rootEl.querySelector('.fortune-sheet-area') ||
        _rootEl.querySelector('.fortune-sheet-overlay') ||
        _rootEl.querySelector('react-spreadsheet-editor')
    }

    // FortuneSheet measures its container once on mount and only re-fits on a
    // window resize. In full-bleed mode the container's real height isn't
    // settled at mount, so the grid paints into a zero-height box. Nudge it to
    // re-measure whenever the host element resizes to a non-zero size.
    if (_rootEl && typeof ResizeObserver !== 'undefined') {
      let lastH = 0
      _resizeObserver = new ResizeObserver(() => {
        const h = _rootEl?.clientHeight ?? 0
        if (h > 0 && h !== lastH) {
          lastH = h
          window.dispatchEvent(new Event('resize'))
        }
      })
      _resizeObserver.observe(_rootEl)
    }

    return () => _resizeObserver?.disconnect()

    // Create a new spreadsheet
    /*  jspreadsheet(_spreadsheetContainer, {
      // jspreadsheet(document.getElementById('spreadsheet'), {
      worksheets: [
        {
          minDimensions: [6, 6]
        }
      ]
    }) */
    /* const rows = {
      len: 80,
      1: {
        cells: {
          0: { text: 'testingtesttestetst' },
          2: { text: 'testing' }
        }
      },
      2: {
        cells: {
          0: { text: 'render', style: 0 },
          1: { text: 'Hello' },
          2: { text: 'haha', merge: [1, 1] }
        }
      },
      8: {
        cells: {
          8: { text: 'border test', style: 0 }
        }
      }
    }

    const rows10 = { len: 1000 }
    for (let i = 0; i < 1000; i += 1) {
      rows10[i] = {
        cells: {
          0: { text: 'A-' + i },
          1: { text: 'B-' + i },
          2: { text: 'C-' + i },
          3: { text: 'D-' + i },
          4: { text: 'E-' + i },
          5: { text: 'F-' + i }
        }
      }
    }

    var xs = new Spreadsheet(`#${_spreadsheetContainer.getAttribute('id')}`, {
      //  var xs = spreadsheet('#x-spreadsheet-demo', {
      showToolbar: true,
      showGrid: true,
      showBottomBar: true,
      extendToolbar: {
        left: [
          {
            tip: 'Save',
            // icon: saveIcon,
            onClick: (data, sheet) => {
              console.log('click save button：', data, sheet)
            }
          }
        ],
        right: [
          {
            tip: 'Preview',
            // el: previewEl,
            onClick: (data, sheet) => {
              console.log('click preview button：', data)
            }
          }
        ]
      }
    })
      .loadData([
        {
          freeze: 'B3',
          styles: [
            {
              bgcolor: '#f4f5f8',
              textwrap: true,
              color: '#900b09',
              border: {
                top: ['thin', '#0366d6'],
                bottom: ['thin', '#0366d6'],
                right: ['thin', '#0366d6'],
                left: ['thin', '#0366d6']
              }
            }
          ],
          merges: ['C3:D4'],
          cols: {
            len: 10,
            2: { width: 200 }
          },
          rows
        },
        { name: 'sheet-test', rows: rows10 }
      ])
      .change((cdata) => {
        // console.log(cdata);
        console.log('>>>', xs.getData())
      }) */
  })
</script>

{#snippet inner()}
  <div
    class="relative items-center m-auto border border-ligt dark:border-dark rounded-[5px]"
    style:width={__maxPageWidth ? `${__maxPageWidth}px` : '100%'}
    style:height={__maxPageHeight ? `${__maxPageHeight}px` : '100%'}
    style:max-width={__maxPageWidth ? `${__maxPageWidth}px` : '100%'}
    style:max-height={__maxPageHeight ? `${__maxPageHeight}px` : '100%'}
    bind:this={_rootEl}
  >
    {#if _srcLabel}
      <div
        class="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-base-content/80 shadow-md backdrop-blur"
      >
        <span
          class="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
        ></span>
        <span class="truncate max-w-[240px]">{_srcLabel}</span>
        {#if __sheetName}
          <span class="text-base-content/50">•</span>
          <span class="text-base-content/70">{__sheetName}</span>
        {/if}
      </div>
    {/if}
    <!-- <div
  class="p-4 flex flex-col items-center max-w-[{__maxPageWidth}px] w-[{__maxPageWidth}px] h-[{__maxPageHeight}px] maxh-h-[{__maxPageHeight}px]"
> -->
    <!-- <div
    id="spreadsheet-{uuidv4()}"
    class="spreadsheet-preview-container"
    bind:this={_spreadsheetContainer}
  ></div> -->

    <div class="w-full h-full" class:sheet-readonly={__readOnly}>
      {#if _customElementReady}
        <react-spreadsheet-editor
          root-path={__src}
          sheet-name={__sheetName}
          theme={$_$_resolvedTheme}
          disable-collab={__disableCollab ? '' : undefined}
          read-only={__readOnly ? '' : undefined}
          use:setParentDoc={{ doc: __parentDoc, userInfo: __userInfo }}
        ></react-spreadsheet-editor>
      {:else}
        <div class="flex items-center justify-center w-full h-full text-base-content/50 text-[12px]">
          {$_('Loading...')}
        </div>
      {/if}
    </div>

    {#if __readOnly}
      <div
        class="absolute inset-0 bg-transparent"
        onpointerdown={(e) => e.preventDefault()}
        onclick={(e) => e.preventDefault()}
        ondblclick={(e) => e.preventDefault()}
        oncontextmenu={(e) => e.preventDefault()}
        onwheel={handleWheel}
        role="presentation"
      ></div>
    {/if}
  </div>
{/snippet}

{#if __resizable}
  <Resizer
    __width={__maxPageWidth}
    __height={__maxPageHeight}
    __maxHeight={__maxPageHeight}
    __maxWidth={__maxPageWidth}
    __direction="both"
    __lockAspectRatio={false}
    __updateAttributes={(newAttrs) => __updateAttributes?.(newAttrs)}
  >
    {@render inner()}
  </Resizer>
{:else}
  {@render inner()}
{/if}

<style>
  :global(.spreadsheet-preview-container canvas) {
    @apply: m-auto border border-ligt dark:border-dark rounded-[5px];
  }
  .app {
    display: grid;
    grid-template-columns: 220px 1fr 320px;
    grid-template-rows: 48px 1fr;
    grid-template-areas: 'sidebar toolbar editor' 'sidebar main editor';
    height: 100vh;
  }
  .toolbar {
    grid-area: toolbar;
  }
  .sidebar {
    grid-area: sidebar;
    padding: 8px;
    border-right: 1px solid #eee;
    overflow: auto;
  }
  .main {
    grid-area: main;
    padding: 8px;
  }
  .editor {
    grid-area: editor;
    border-left: 1px solid #eee;
  }
</style>
