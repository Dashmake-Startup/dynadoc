

<!--
 Copyright (C) 2025 Dashmake Inc.

 This file is part of DDoc Office.

 DDoc Office is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 DDoc Office is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Platform from '../../../../libs/platform'
  import * as monaco from 'monaco-editor'
  import { ModelOperations } from '@vscode/vscode-languagedetection'
  import { onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import { v4 as uuidv4 } from 'uuid'
  import { _$_monacoEditorModal } from '../stores/monacoCode.store'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import { DocumentModel } from '../../../../models/Document'
  import PdfRenderer from '../../../fileRenderers/PdfRenderer.svelte'
  import CodeRenderer from '../../../fileRenderers/CodeRenderer.svelte'
  import EditorHelpers from '../../../../utils/EditorHelpers'
  import katex from 'katex'
  import 'katex/dist/katex.min.css'
  import { nodeApi } from '../../../../utils/shims/node'
  import { registerMonacoContent, unregisterMonacoContent } from '../../../tiptap/CustomFindReplaceExtension/monacoContentRegistry'

  let {
    node,
    updateAttributes,
    onSave,
    onClose
  }: {
    node: any
    updateAttributes: (attrs: Record<string, any>) => void
    onSave?: (newCode: string, filePath: string, fileRelativePath: string) => void
    onClose?: (newCode: string, filePath: string, fileRelativePath: string) => void
  } = $props()

  // Node environment API (from Electron preload)
//   const nodeApi =
//     typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
//   const fs = nodeApi?.fs
//   const path = nodeApi?.path

  const getExtension = (lang: string) => {
    switch (lang) {
      case 'javascript':
        return 'js'
      case 'typescript':
        return 'ts'
      case 'latex':
        return 'tex'
      case 'python':
        return 'py'
      default:
        return 'txt'
    }
  }

  let editor: monaco.editor.IStandaloneCodeEditor
  let code = $state('')
  let _filePath = ''
  let _fileRelativePath = ''
  let _codeRenderElement: HTMLDivElement
  let _compiledLatexCodePdfPath = $state<string | null>(null)
  let _language = node.attrs.language
  let watchFileCallerId = uuidv4()
  // let _fileNameToCreate = `code${node.attrs.index}.${getExtension(language)}`
  let _fileNameToCreate = `code${node.attrs.index}`
  // let dialogEl: HTMLDialogElement

  // Function to watch file changes and update the code editor automatically
  async function watchGlobalCodeEditorFileChange(): Promise<void> {
    window.api.onFileChange((content: string, callerId: string) => {
      // EditorHelpers.setCodeEditorValuePreserveState(_codeEditor, content)
      // formatCodeInCodeEditor()
      // Take action only if the callerId matches
      if (callerId == watchFileCallerId) {
        loadPreview(content)
      }
    })
    if (_filePath) {
      await window.api.watchFile(_filePath, watchFileCallerId)
    }
  }
  onMount(() => {
    watchGlobalCodeEditorFileChange()
  })

  onDestroy(() => {
    if (_filePath) unregisterMonacoContent(_filePath)
  })

  const getFilePath = async () => {
    const activeEditorStore = _$_documentEditorsList.getActive()
    // const activeEditor = _$_documentEditorsList.getActive()
    const activeEditor = get(activeEditorStore) // unwrap derived store    // const dir = nodeApi.path.join(process.cwd(), node.attrs.path)

    const fileName = `${_fileNameToCreate}.${getExtension(_language)}`
    const fileNameWithParentFolder = nodeApi.path.join(getExtension(_language), fileName)
    const dir = activeEditor?.document?.getAsset(DocumentModel.AssetType.CODE)

    if (!dir) return { filePath: null, fileRelativePath: null }
    // const dir = nodeApi.path.join(
    //   activeEditor?.document?.getAsset(DocumentModel.AssetType.CODE),
    //   getExtension(_language)
    // )
    // activeEditor?.document?.cachePath || nodeApi.path.join(process.cwd(), 'assets/code', language)
    // const dir = nodeApi.path.join(process.cwd(), `assets/code/${language}`)
    if (!(await nodeApi.fsPromises?.exists(dir)))
      await nodeApi.fsPromises?.mkdir(dir, { recursive: true })
    // Relative file name
    const fileRelativePath =
      node.attrs.src ||
      DocumentModel.getAssetRelativePath(
        DocumentModel.AssetType.CODE,
        fileNameWithParentFolder
      )
    // const fileRelativePath = node.attrs.src || `${_fileNameToCreate}.${getExtension(_language)}`
    // const fileRelativePath = node.attrs.src || `code${node.attrs.index}.${getExtension(language)}`
    // return {(nodeApi.path.join(dir, fileRelativePath)),fileRelativePath}
    // Absolute path
    const filePath = nodeApi.path.join(dir, fileNameWithParentFolder)
    // const filePath = nodeApi.path.join(dir, fileName)
    // const filePath = nodeApi.path.join(dir, fileRelativePath)

    return { filePath, fileRelativePath }
  }

  async function detectLanguageIfNeeded(content: string) {
    return node.attrs.language
    if (node.attrs.manualSet || node.attrs.detected) return _language
    const ops = new ModelOperations()
    const result = await ops.runModel(content)
    if (result?.languageId) {
      _language = result.languageId
      updateAttributes({ language: _language, detected: true })
    }
    return _language
  }

  async function compileLatex(filePath: string = null) {
    const isElectron = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop
    if (!isElectron) {
      console.warn('Full PDF compilation is only available on the Desktop version.')
      return null
    }
    // const filePath = await window.api.saveTempTex(code); // save to temp .tex file
    const pdfPath = await window.api.latexCompile(filePath || _filePath)
    console.log('Compiled PDF at:', pdfPath)
    return pdfPath
  }
  async function loadPreview(content: string = null) {
    if (content) {
      code = content
    } else {
      const { filePath, fileRelativePath } = await getFilePath()
      _filePath = filePath
      _fileRelativePath = fileRelativePath
      if (!_filePath || !_fileRelativePath) return
      if (!(await nodeApi.fsPromises?.exists(filePath))) {
        await nodeApi.fsPromises?.mkdir(nodeApi.path.dirname(filePath), { recursive: true })
        await writeFileEnsuringDirAsync(filePath, '// start coding...', 'utf8')
      }
      code = (await nodeApi.fsPromises?.readFile(filePath, 'utf8')) || ''
    }

    if (_filePath) registerMonacoContent(_filePath, code)

    if (_language === 'latex' && _codeRenderElement) {
      try {
        const html = katex.renderToString(code, {
          throwOnError: false,
          displayMode: true
        })
        _codeRenderElement.innerHTML = html
      } catch (err) {
        console.error('KaTeX preview error:', err)
        _codeRenderElement.innerText = 'LaTeX Preview Error'
      }
    }
  }

  // Subscribe to the MonacoModal stores
  /*   const unsubscribeVisible = _$_monacoEditorModal.visible.subscribe((v) => {
    // visible = v
    if (v) openModal()
    // if (visible) showModal()
    else closeModal()
  })

  const unsubscribeData = _$_monacoEditorModal.data.subscribe((data) => {
    if (data) {
      filePath = data.filePath
      language = data.language
      onSave = data.onSave
    } else {
      filePath = ''
      language = ''
      onSave = undefined
    }
  }) */

  // Open modal and load file content
  async function openModal() {
    // Re-resolve path lazily on every click so we always have the latest absolute path
    if (!_filePath || !_fileRelativePath) {
      const resolved = await getFilePath()
      if (resolved.filePath) {
        _filePath = resolved.filePath
        _fileRelativePath = resolved.fileRelativePath
        // Register file watcher now that we have the path
        window.api.watchFile(_filePath, watchFileCallerId)
      }
    }
    if (!_filePath) {
      console.warn('[CodeBlockWidget] openModal: no filePath resolved — cannot open editor')
      return
    }

    _$_monacoEditorModal.open({
      filePath: _filePath,
      fileRelativePath: _fileRelativePath,
      language: _language,
      onSave: (newCode, filePath, fileRelativePath) => {
        onSave?.(newCode, filePath, fileRelativePath)
        // Refresh preview with saved content
        if (newCode) loadPreview(newCode)
        // Compile LaTeX — file already written by GlobalCodeEditor before this fires
        if (_language === 'latex') {
          compileLatex(filePath).then((path) => {
            _compiledLatexCodePdfPath = path
          })
        }
      },
      onClose: (newCode, filePath, fileRelativePath) => {
        onClose?.(newCode, filePath, fileRelativePath)
      }
    })
    /* if (!dialogEl) return
    if (nodeApi.fs.existsSync(filePath)) {
      code = nodeApi.fs.readFileSync(filePath, 'utf8') || ''
    } else {
      code = `// New ${language} file`
    }

    dialogEl.showModal()

    // Delay Monaco mount to after modal is visible
    setTimeout(() => {
      if (editor) editor.dispose()
      editor = monaco.editor.create(monacoContainer, {
        value: code,
        language,
        theme: 'vs-dark',
        automaticLayout: true
      })
    }, 50) */
  }

  /* function saveAndClose() {
    const newCode = editor.getValue()
    EditorHelpers.writeFileEnsuringDir(filePath, newCode, 'utf8')
    onSave?.(newCode)
    // dialogEl.close()
    _$_monacoEditorModal.close()
  } */

  /* function closeModal() {
    // dialogEl.close()
    _$_monacoEditorModal.close()
  } */

  /*
  function openModal() {
    modalOpen = true
    document.getElementById('monacoEditorModal').showModal()
    loadPreview()
    setTimeout(async () => {
      language = await detectLanguageIfNeeded(code)
      editor = monaco.editor.create(monacoContainer, {
        value: code,
        language,
        theme: 'vs-dark',
        automaticLayout: true
      })
    }, 0)
  }

  function saveAndClose() {
    const value = editor.getValue()
    EditorHelpers.writeFileEnsuringDir(filePath, value, 'utf8')
    editor.dispose()
    modalOpen = false
    code = value
  } */

  void loadPreview()
</script>

<div
  class="relative group border rounded-lg p-3 cursor-pointer hover:bg-base-200"
  on:click={openModal}
>
  <!-- <h3 class="text-sm font-semibold mb-1">Code Block ({_language})</h3>
  <pre
    class="text-xs text-base-content/90 overflow-x-auto whitespace-pre-wrap"
    bind:this={_codeElement}>{code}</pre> -->

  <!-- Auto-detect from filename -->
  <!-- <CodeRenderer filename="main.py" value={pythonCode} /> -->

  <!-- Auto-detect from code content -->
  <CodeRenderer __value={code} __editable={false} />
  <div
    class="text-xs text-base-content/90 overflow-x-auto whitespace-pre-wrap"
    bind:this={_codeRenderElement}
  ></div>

  <!-- Force language manually -->
  <!-- <CodeRenderer value={jsCode} language="javascript" editable={true} /> -->
  {#if _compiledLatexCodePdfPath}
    <PdfRenderer __src={_compiledLatexCodePdfPath} />
    <!-- <PdfReader filePath={_compiledLatexCodePdfPath} /> -->
  {/if}
  <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
    <button class="btn btn-xs btn-outline">{$_('Edit')}</button>
  </div>
</div>

<!-- <dialog bind:this={dialogEl} class="modal">
  <div class="modal-box max-w-5xl w-full">
    <h3 class="font-bold text-lg mb-3">Editing {filePath}</h3>
    <div bind:this={monacoContainer} class="h-[60vh] w-full border border-base-200"></div>
    <div class="modal-action">
      <button class="btn btn-primary" on:click={saveAndClose}>Save</button>
      <button class="btn" on:click={closeModal}>Cancel</button>
    </div>
  </div>
</dialog> -->

<!-- {#if modalOpen} -->
<!-- <div class="modal" id="monacoEditorModal">
  <div class="modal-box max-w-5xl w-11/12 h-[80vh] p-0 flex flex-col">
    <div class="flex justify-between items-center p-3 border-b bg-base-200">
      <h3 class="font-semibold">Editing: code{node.attrs.index}.{getExtension(language)}</h3>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-primary" on:click={saveAndClose}>Save</button>
        <button
          class="btn btn-sm"
          on:click={() => {
            editor.dispose()
            modalOpen = false
          }}>Close</button
        >
      </div>
    </div>
    <div bind:this={monacoContainer} class="flex-1"></div>
  </div>
  <label
    class="modal-backdrop"
    on:click={() => {
      editor.dispose()
      modalOpen = false
    }}
  />
</div> -->
<!-- {/if} -->