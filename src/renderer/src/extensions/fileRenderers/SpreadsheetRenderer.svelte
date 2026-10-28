<script lang="ts">
import { nodeApi } from '../../utils/shims/node'
  import { onMount } from 'svelte'
  import { openConfirmModal } from '../../stores/confirmModal.store'
  import EditorHelpers from '../../utils/EditorHelpers'
  import { _$_documentEditorsList } from '../../stores/editor.store'
  import MissingFilePlaceholder from './MissingFilePlaceholder.svelte'
  import { toLocalPath } from '../../utils/assetUrl'

  interface Props {
    __src?: string
    __readOnly?: boolean
  }

  let { __src = '', __readOnly = false }: Props = $props()
  // export let __readOnly: boolean = true

  // Registers the <react-spreadsheet-file-viewer> custom element. Loaded on
  // demand — it drags in react, react-dom and @fortune-sheet/react, which
  // must not sit on the first-render critical path for plain text
  // documents. This component's class is statically referenced by
  // FileRenderer regardless of file type, so a top-level side-effect import
  // here used to pull those bytes into every document's critical path even
  // though this component only ever mounts when viewing a spreadsheet file.
  // The element upgrades automatically once this resolves, even though the
  // tag is already in the DOM by the time it does.
  onMount(() => {
    import('../tiptap/CustomSpreadsheetExtension/components/react/ReactSpreadsheetFileViewer')
  })

  let converting = false
  const isExternalUrl = (value: string) => /^(blob:|data:|https?:)/i.test(value || '')
  const _path = $derived.by(() => {
    const raw = toLocalPath(__src)
    return (raw || '').split('?')[0]
  })

  let _exists = $state<boolean | 'checking'>('checking')

  $effect(() => {
    const currentPath = _path
    if (!currentPath) {
      _exists = false
      return
    }
    if (isExternalUrl(currentPath)) {
      _exists = true
      return
    }
    _exists = 'checking'
    async function checkFile() {
      try {
        if (nodeApi.fsPromises?.exists) {
          _exists = await nodeApi.fsPromises.exists(currentPath)
          return
        }
        if (nodeApi.fs?.existsSync) {
          _exists = nodeApi.fs.existsSync(currentPath)
          return
        }
        _exists = true
      } catch {
        _exists = false
      }
    }
    void checkFile()
  })

  async function handleConvert() {
    if (!__src || converting) return
    const confirmed = await openConfirmModal({
      title: 'Convert to Dynadoc',
      message: 'This will create a Dynadoc document from the spreadsheet file.',
      confirmText: 'Convert',
      cancelText: 'Cancel'
    })
    if (!confirmed) return
    converting = true
    try {
      const { importSpreadsheetFileIntoNewDocument } = await import(
        '../../services/export/spreadsheetExchange.service'
      )
      await importSpreadsheetFileIntoNewDocument(__src)
      const active = _$_documentEditorsList.getActiveSync?.()
      if (active) {
        await EditorHelpers.saveDocumentEditor(active, { saveAs: true })
      }
    } finally {
      converting = false
    }
  }
</script>

{#if !_path}
  <MissingFilePlaceholder __title={$_('No spreadsheet selected')} __subtitle={$_('Pick a spreadsheet to preview.')} />
{:else if _exists === 'checking'}
  <div
    class="spreadsheet-file-wrapper animate-pulse rounded-lg flex items-center justify-center border border-white/5"
  >
    <i class="ph-bold ph-circle-notch animate-spin text-white/20"></i>
  </div>
{:else if _exists === false}
  <MissingFilePlaceholder __title={$_('Spreadsheet missing')} __subtitle={$_('The spreadsheet file could not be found.')} __path={_path} />
{:else}
<div class="spreadsheet-file-wrapper">
<!-- {__src} -->
  <react-spreadsheet-file-viewer
    file-path={__src}
    read-only={__readOnly ? 'true' : null}
  ></react-spreadsheet-file-viewer>
  <!-- {#if __readOnly} -->
    <div class="spreadsheet-file-actions">
      <button class="btn btn-xs btn-primary" on:click={handleConvert} disabled={converting}>
        {converting ? 'Converting…' : 'Convert to Dynadoc'}
      </button>
    </div>
  <!-- {/if} -->
</div>
{/if}

<style>
  .spreadsheet-file-wrapper {
    width: 100%;
    height: 100%;
    min-height: 400px;
    background: #0f172a;
    position: relative;
  }

  :global(react-spreadsheet-file-viewer) {
    display: block;
    width: 100%;
    height: 100%;
  }

  :global(.react-spreadsheet-file-viewer) {
    width: 100%;
    height: 100%;
  }

  :global(.react-spreadsheet-file-loading) {
    color: #e2e8f0;
    font-size: 12px;
    padding: 16px;
  }

  .spreadsheet-file-actions {
    position: absolute;
    top: 10px;
    right: 12px;
    z-index: 5;
  }
</style>
