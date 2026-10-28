<script lang="ts">
import { nodeApi } from '../../utils/shims/node'
  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount } from 'svelte'
  import type * as monaco from 'monaco-editor'
  import hljs from 'highlight.js/lib/common'
  import { debounce } from 'lodash-es'
  import ScrollGuardOverlay from '../../components/common/interaction/ScrollGuardOverlay.svelte'
  import MissingFilePlaceholder from './MissingFilePlaceholder.svelte'
  import { _$_wysiwygEditorsList } from '../../stores/editor.store'
  import { get } from 'svelte/store'
  import { toLocalPath } from '../../utils/assetUrl'

  interface Props {
    __value?: string
    __language?: string | null
    __src?: string | null
    __editable?: boolean
    __theme?: string
    __options?: Record<string, any>
    __wysiwygEditorId?: string
    __syncEnabled?: boolean
    __showToolbar?: boolean
    __showStatusBar?: boolean
    __height?: string
    __guarded?: boolean
  }

  let {
    __value = '',
    __language = null,
    __src = null,
    __editable = true,
    __theme = 'vs-dark',
    __options = {},
    __wysiwygEditorId = '',
    __syncEnabled = true,
    __showToolbar = true,
    __showStatusBar = true,
    __height = '100%',
    __guarded = false
  }: Props = $props()

  let container: HTMLDivElement
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  // Loaded on demand — monaco-editor is ~8.5 MB and must not sit on the
  // first-render critical path for plain text documents.
  let monacoMod: typeof import('monaco-editor') | null = null
// const  fs = nodeApi.fs
  const normalizedPath = $derived.by(() => {
    if (!__src) return ''
    const raw = toLocalPath(__src)
    return raw.split('?')[0]
  })
  const isExternalUrl = $derived.by(() => /^(blob:|data:|https?:)/i.test(__src || ''))
  let exists = $state<boolean | 'checking'>('checking')

  $effect(() => {
    const currentPath = normalizedPath
    if (!currentPath) {
      exists = true
      return
    }
    if (isExternalUrl) {
      exists = true
      return
    }
    exists = 'checking'
    async function checkFile() {
      try {
        if (nodeApi.fsPromises?.exists) {
          exists = await nodeApi.fsPromises.exists(currentPath)
          return
        }
        if (nodeApi.fs?.existsSync) {
          exists = nodeApi.fs.existsSync(currentPath)
          return
        }
        exists = true
      } catch {
        exists = false
      }
    }
    void checkFile()
  })

  let currentLanguage = $state(__language || 'plaintext')
  let syncEnabled = $state(__syncEnabled)
  let minimapEnabled = $state(true)
  let wordWrap = $state<'on' | 'off'>('on')
  let cursorLabel = $state('LN 1, COL 1')
  let isDirty = $state(false)

  const updateWysiwyg = debounce(async (code: string) => {
    if (!__wysiwygEditorId || !syncEnabled) return
    const wysiwygEditor = get(_$_wysiwygEditorsList.get(__wysiwygEditorId))
    if (!wysiwygEditor) return
    wysiwygEditor.commands.setContent(code, { emitUpdate: false })
  }, 150)

  function detectLanguage(): string {
    if (__language) return __language
    if (__src) {
      const ext = __src.split('.').pop()?.toLowerCase()
      const extToLang: Record<string, string> = {
        js: 'javascript',
        ts: 'typescript',
        py: 'python',
        html: 'html',
        css: 'css',
        scss: 'scss',
        json: 'json',
        md: 'markdown',
        yml: 'yaml',
        yaml: 'yaml',
        cpp: 'cpp',
        c: 'c',
        cs: 'csharp',
        java: 'java',
        php: 'php',
        rb: 'ruby',
        go: 'go',
        rs: 'rust',
        swift: 'swift',
        kt: 'kotlin',
        sh: 'shell',
        tex: 'latex',
        bib: 'bibtex',
        sty: 'latex',
        cls: 'latex'
      }
      if (ext && extToLang[ext]) return extToLang[ext]
    }
    try {
      const result = hljs.highlightAuto(__value || '')
      if (result.language) return result.language
    } catch {
      // ignore
    }
    return 'plaintext'
  }

  async function initEditor() {
    if (!container) return
    destroyEditor()
    currentLanguage = detectLanguage()

    if (normalizedPath && exists !== true) {
      return
    }

    let initialValue = __value
    if (normalizedPath) {
      initialValue = await window.api.readFileContent(normalizedPath)
    }

    const monaco = monacoMod ?? (monacoMod = await import('monaco-editor'))

    editor = monaco.editor.create(container, {
      value: initialValue,
      language: currentLanguage,
      theme: __theme,
      readOnly: !__editable,
      automaticLayout: true,
      minimap: { enabled: minimapEnabled },
      scrollBeyondLastLine: false,
      wordWrap,
      fontSize: 13,
      tabSize: 2,
      scrollbar: { verticalScrollbarSize: 8 },
      ...__options
    })

    editor.onDidChangeModelContent(() => {
      const next = editor?.getValue() ?? ''
      isDirty = true
      __value = next
      updateWysiwyg(next)
    })

    editor.onDidChangeCursorPosition(() => {
      const pos = editor?.getPosition()
      if (!pos) return
      cursorLabel = `LN ${pos.lineNumber}, COL ${pos.column}`
    })
  }

  function destroyEditor() {
    if (editor) {
      editor.dispose()
      editor = null
    }
  }

  function changeLanguage(lang: string) {
    currentLanguage = lang
    const model = editor?.getModel()
    if (model && monacoMod) monacoMod.editor.setModelLanguage(model, lang)
  }

  function toggleMinimap() {
    minimapEnabled = !minimapEnabled
    editor?.updateOptions({ minimap: { enabled: minimapEnabled } })
  }

  function toggleWordWrap() {
    wordWrap = wordWrap === 'on' ? 'off' : 'on'
    editor?.updateOptions({ wordWrap })
  }

  function formatDocument() {
    editor?.getAction('editor.action.formatDocument')?.run()
  }

  onDestroy(destroyEditor)

  $effect(() => {
    // Track config — conditionally read `exists` only when we have a path,
    // so changes to `exists` during initial no-src mount don't cause double-init
    const path = normalizedPath
    __src
    __language
    __theme
    __editable

    const resolvedExists = path ? exists : true

    if (!container) return
    if (path && resolvedExists !== true) {
      destroyEditor()
      return
    }
    void initEditor()
  })

  $effect(() => {
    if (!editor || !monacoMod) return
    if (__theme) monacoMod.editor.setTheme(__theme)
  })

  $effect(() => {
    if (!editor) return
    const model = editor.getModel()
    if (!model) return
    const detected = detectLanguage()
    if (detected && detected !== currentLanguage) {
      changeLanguage(detected)
    }
  })

  $effect(() => {
    if (!editor) return
    const value = editor.getValue()
    if (__value !== value) {
      const position = editor.getPosition()
      const scrollTop = editor.getScrollTop()
      editor.setValue(__value || '')
      if (position) {
        const lineCount = editor.getModel()?.getLineCount() ?? 1
        editor.setPosition({ lineNumber: Math.min(position.lineNumber, lineCount), column: position.column })
        editor.setScrollTop(scrollTop)
      }
    }
  })
</script>

{#if normalizedPath && !exists}
  <MissingFilePlaceholder
    __title={$_('File missing')}
    __subtitle={$_('The source file could not be found.')}
    __path={normalizedPath}
  />
{:else if normalizedPath && exists === 'checking'}
  <div class="h-48 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] animate-pulse rounded-lg flex items-center justify-center border border-white/5">
    <i class="ph-bold ph-circle-notch animate-spin text-white/20"></i>
  </div>
{:else}
  <div class="code-editor-core" style={`height: ${__height};`}>
    {#if __showToolbar}
      <div class="core-toolbar">
        <div class="left">
          <div class="lang-chip">
            <span class="label">{currentLanguage}</span>
            <button class="btn btn-xs btn-ghost" on:click={() => changeLanguage('html')}>HTML</button>
            <button class="btn btn-xs btn-ghost" on:click={() => changeLanguage('markdown')}>MD</button>
            <button class="btn btn-xs btn-ghost" on:click={() => changeLanguage('json')}>JSON</button>
          </div>
        </div>
        <div class="right">
          {#if __wysiwygEditorId}
            <label class="toggle-row">
              <span>{$_('Live Sync')}</span>
              <input type="checkbox" bind:checked={syncEnabled} class="toggle toggle-primary toggle-xs" />
            </label>
          {/if}
          <button class="btn btn-xs btn-ghost" on:click={toggleWordWrap}>
            {wordWrap === 'on' ? $_('Wrap') : $_('No Wrap')}
          </button>
          <button class="btn btn-xs btn-ghost" on:click={toggleMinimap}>
            {minimapEnabled ? $_('Hide Minimap') : $_('Show Minimap')}
          </button>
          <button class="btn btn-xs btn-ghost" on:click={formatDocument}>
            {$_('Format')}
          </button>
        </div>
      </div>
    {/if}
    {#if __guarded}
      <ScrollGuardOverlay message="Click to scroll/edit">
        <div bind:this={container} class="code-surface" />
      </ScrollGuardOverlay>
    {:else}
      <div bind:this={container} class="code-surface" />
    {/if}
    {#if __showStatusBar}
      <div class="core-status">
        <div class="left">
          <span>{$_('UTF-8')}</span>
          <span class="dot">•</span>
          <span>{currentLanguage}</span>
          {#if isDirty}
            <span class="dirty">{$_('Unsaved')}</span>
          {/if}
        </div>
        <div class="right">{cursorLabel}</div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .code-editor-core {
    display: flex;
    flex-direction: column;
    background: #0f1216;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
  }
  .core-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.04);
    padding: 6px 8px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .core-toolbar .right {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .lang-chip {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .lang-chip .label {
    font-weight: 700;
    color: #8bb1ff;
  }
  .toggle-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .code-surface {
    flex: 1;
    min-height: 200px;
  }
  .core-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.04);
    padding: 4px 8px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.6);
  }
  .core-status .left {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .core-status .dirty {
    color: #f7b955;
  }
  .core-status .dot {
    opacity: 0.4;
  }
</style>
