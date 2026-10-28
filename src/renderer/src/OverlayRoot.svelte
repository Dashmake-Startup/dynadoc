<script lang="ts">
  import { onMount } from 'svelte'
  import ConfirmModal from './components/common/modal/ConfirmModal.svelte'
  import AlertModal from './components/common/modal/AlertModal.svelte'
  import TextInputModal from './components/common/modal/TextInputModal.svelte'
  import ExportOptionsModal from './components/common/modal/ExportOptionsModal.svelte'
  import SpreadsheetExportModal from './components/common/modal/SpreadsheetExportModal.svelte'
  import SpreadsheetImportModal from './components/common/modal/SpreadsheetImportModal.svelte'
  import SpreadsheetEditorModal from './components/common/modal/SpreadsheetEditorModal.svelte'
  import ChartInspectorModal from './components/common/modal/ChartInspectorModal.svelte'
  import LatexProjectModal from './components/common/modal/LatexProjectModal.svelte'
  import TranslationPickerModal from './components/common/modal/TranslationPickerModal.svelte'
  import UpgradePlanModal from './components/common/upgrade/UpgradePlanModal.svelte'
  import IncludeFromDocumentModal from './components/common/modal/IncludeFromDocumentModal.svelte'
  import { setupOverlayReceiver } from './utils/overlayBridge'
  import { ensureEmbeddedVarDropdown } from './components/browser/embeddedVarDropdown'
  import { initBrowserVarDropdown } from './components/browser/browserVarDropdown'
  import { _$_confirmModal } from './stores/confirmModal.store'
  import { _$_alertModal } from './stores/alertModal.store'
  import { _$_textInputModal } from './stores/textInputModal.store'
  import { _$_exportOptionsModal } from './stores/exportOptionsModal.store'
  import { _$_spreadsheetExportModal } from './stores/spreadsheetExportModal.store'
  import { _$_spreadsheetImportModal } from './stores/spreadsheetImportModal.store'
  import { _$_spreadsheetEditorModal } from './stores/spreadsheetEditorModal.store'
  import { _$_latexProjectModal } from './stores/latexProjectModal.store'
  import { _$_translationPickerModal } from './stores/translationPickerModal.store'
  import { _$_upgradePlanModal } from './stores/upgradePlanModal.store'
  import { _$_includeFromDocumentModal } from './stores/includeFromDocumentModal.store'
  import { forceOverlayInteraction } from './utils/overlayInteraction'
  import SettingsModal from './components/settings/SettingsModal.svelte'
  import GrammarSettingsModal from './extensions/tiptap/CustomGrammarCheckExtension/components/GrammarSettingsModal.svelte'

  let cleanup: (() => void) | null = null

  onMount(async () => {
    const { initializeStore } = await import('./stores/editor.store')
    await initializeStore()
    cleanup = setupOverlayReceiver()
    ensureEmbeddedVarDropdown()
    initBrowserVarDropdown()
    forceOverlayInteraction(false)
  })

  $effect(() => {
    const hasModal =
      $_$_confirmModal.open ||
      $_$_alertModal.open ||
      $_$_textInputModal.open ||
      $_$_exportOptionsModal.open ||
      $_$_spreadsheetExportModal.open ||
      $_$_spreadsheetImportModal.open ||
      $_$_spreadsheetEditorModal.open ||
      $_$_upgradePlanModal.open ||
      $_$_includeFromDocumentModal.open ||
      $_$_latexProjectModal.open ||
      $_$_translationPickerModal.open
    forceOverlayInteraction(hasModal)
  })
</script>

<!-- <ConfirmModal />
<AlertModal />
<TextInputModal />
<ExportOptionsModal /> -->

<TextInputModal />
<ConfirmModal />
<AlertModal />
<ExportOptionsModal />
<SpreadsheetExportModal />
<SpreadsheetImportModal />
<SpreadsheetEditorModal />
<ChartInspectorModal />
<LatexProjectModal />
<TranslationPickerModal />
<SettingsModal />
<GrammarSettingsModal />
<UpgradePlanModal />
<IncludeFromDocumentModal />
