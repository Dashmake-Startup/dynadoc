<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import type * as monaco from 'monaco-editor'
  import { _$_monacoEditorModal } from '../../../../extensions/tiptap/CustomMonacoCodeBlockExtension/stores/monacoCode.store'
  import EditorHelpers from '../../../../utils/EditorHelpers'
import { nodeApi } from '../../../../utils/shims/node'

  let dialogEl: HTMLDialogElement
  let editorContainer: HTMLDivElement
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  let code = ''

  let visible = false
  let filePath = ''
  let fileRelativePath = ''
  let language = ''
  let inlineContent = ''
  let onSave: ((newCode: string, filePath: string, fileRelativePath: string) => void) | undefined
  let onClose: ((newCode: string, filePath: string, fileRelativePath: string) => void) | undefined
  const t = get(_)

  // Re-entrancy guard — prevents subscriber→closeModal→store→subscriber loops
  let _closing = false

  const unsubscribeVisible = _$_monacoEditorModal.visible.subscribe((v) => {
    visible = v
    if (visible) showModal()
    else closeModal()
  })

  const unsubscribeData = _$_monacoEditorModal.data.subscribe((data) => {
    if (data) {
      filePath = data.filePath
      fileRelativePath = data.fileRelativePath
      language = data.language
      inlineContent = data.content ?? ''
      onSave = data.onSave
      onClose = data.onClose
    } else {
      filePath = ''
      fileRelativePath = ''
      language = ''
      inlineContent = ''
      onSave = undefined
      onClose = undefined
    }
  })

  async function showModal() {
    if (!dialogEl) return

    if (filePath) {
      try {
        code = await nodeApi.fsPromises?.exists(filePath)
          ? await nodeApi.fsPromises.readFile(filePath, 'utf8') || ''
          : t('New {language} file', { values: { language } })
      } catch (err) {
        console.error('[GlobalCodeEditor] failed to read file:', filePath, err)
        return
      }
    } else {
      code = inlineContent
    }

    dialogEl.showModal()

    const monaco = await import('monaco-editor')
    setTimeout(() => {
      if (editor) { editor.dispose(); editor = null }
      editor = monaco.editor.create(editorContainer, {
        value: code,
        language,
        theme: 'vs-dark',
        automaticLayout: true,
        formatOnPaste: false,
        formatOnType: false,
      })
    }, 50)
  }

  function doClose(newCode: string) {
    if (_closing) return
    _closing = true
    // Capture before _$_monacoEditorModal.close() clears data subscriber
    const _filePath = filePath
    const _fileRelativePath = fileRelativePath
    const _onClose = onClose
    try {
      if (dialogEl?.open) dialogEl.close()
      if (editor) { editor.dispose(); editor = null }
      _$_monacoEditorModal.close()
    } finally {
      _closing = false
    }
    _onClose?.(newCode, _filePath, _fileRelativePath)
  }

  async function saveAndClose() {
    if (!editor) return
    const newCode = editor.getValue()
    if (filePath) {
      try {
        await EditorHelpers.writeFileEnsuringDirAsync(filePath, newCode, 'utf8')
      } catch (err) {
        console.error('[GlobalCodeEditor] failed to save file:', filePath, err)
        return
      }
    }
    onSave?.(newCode, filePath, fileRelativePath)
    doClose(newCode)
  }

  function closeModal() {
    doClose(editor?.getValue() ?? '')
  }

  onMount(() => {
    // Prevent Chrome 132+ light-dismiss from auto-closing the dialog
    // e.preventDefault() stops the native close; we handle it ourselves
    dialogEl.addEventListener('cancel', (e) => {
      e.preventDefault()
      closeModal()
    })
  })

  onDestroy(() => {
    unsubscribeVisible()
    unsubscribeData()
    if (editor) { editor.dispose(); editor = null }
  })
</script>

<dialog bind:this={dialogEl} class="modal">
  <div class="modal-box max-w-5xl w-full" onclick={(e) => e.stopPropagation()}>
    <h3 class="font-bold text-lg mb-3">
      {fileRelativePath ? $_('Editing {fileRelativePath}', { values: { fileRelativePath } }) : filePath ? filePath.split('/').at(-1) : $_('Code Editor')}
    </h3>
    <div bind:this={editorContainer} class="h-[60vh] w-full border border-base-200"></div>

    <div class="modal-action">
      <button class="btn btn-primary" onclick={saveAndClose}>{$_('Save')}</button>
      <button class="btn" onclick={closeModal}>{$_('Cancel')}</button>
    </div>
  </div>
</dialog>
