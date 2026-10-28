<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { DOMParser as PMDOMParser } from 'prosemirror-model'
  import { NodeViewContent, NodeViewWrapper } from 'svelte-tiptap'
  import { v4 as uuidv4 } from 'uuid'
  import { registerFileIncludeListener } from '../utils/fileIncludeListener'
  import type { Editor } from '@tiptap/core'
  import { _  } from 'svelte-i18n'

  interface Props {
    editor?: Editor
    node?: any
    view?: any
    getPos?: () => number
    updateAttributes?: (attrs: Record<string, any>) => void
  }

  let { editor, node, view, getPos, updateAttributes }: Props = $props()

  let status = $state<'synced' | 'loading' | 'error'>('synced')
  let lastUpdated = $state<string>('never')
  let lastError = $state<string | null>(null)

  let callerId = $state(node?.attrs?.id || uuidv4())
  let sourcePath = $derived(node?.attrs?.sourcePath)

  let watchingPath: string | null = null
  let stopWatching: (() => void) | null = null
  let unregisterListener: (() => void) | null = null
  let mounted = false

  $effect(() => {
    if (!node?.attrs?.id && updateAttributes) {
      updateAttributes({ id: callerId })
      return
    }
    if (node?.attrs?.id && node?.attrs?.id !== callerId) {
      callerId = node.attrs.id
    }
  })

  function findNodeById(targetId: string) {
    if (!view || !targetId) return null
    let foundPos = -1
    view.state.doc.descendants((candidate, pos) => {
      if (candidate.attrs?.id === targetId) {
        foundPos = pos
        return false
      }
      return true
    })
    if (foundPos === -1) return null
    return { pos: foundPos, node: view.state.doc.nodeAt(foundPos) }
  }

  function findNodeBySourcePath(pathValue: string | null | undefined) {
    if (!view || !pathValue) return null
    let foundPos = -1
    view.state.doc.descendants((candidate, pos) => {
      if (candidate.attrs?.sourcePath === pathValue) {
        foundPos = pos
        return false
      }
      return true
    })
    if (foundPos === -1) return null
    return { pos: foundPos, node: view.state.doc.nodeAt(foundPos) }
  }

  async function applyContent1(raw: string) {
    if (!view) return
    const resolved = findNodeById(callerId)
    if (!resolved?.node) return
    const currentPos = resolved.pos
    const currentNode = resolved.node

    const element = document.createElement('span')
    element.innerHTML = raw || ''

    const { schema } = view.state
    const parsed = PMDOMParser.fromSchema(schema).parse(element)
    let replacement: any = parsed.content

    if (!replacement || replacement.size === 0) {
      const paragraph = schema.nodes.paragraph?.createAndFill()
      if (paragraph) {
        replacement = paragraph
      }
    }

    const docSize = view.state.doc.content.size
    if (currentPos < 0 || currentPos > docSize) return

    const from = currentPos + 1
    const to = currentPos + currentNode.nodeSize - 1
    if (from < 0 || to < from || to > docSize) return

    let tr = view.state.tr
    try {
      tr = tr.replaceWith(from, to, replacement)
    } catch (error) {
      console.warn('[FileInclude] Failed to replace content', error)
      return
    }

    try {
      tr = tr.setNodeMarkup(currentPos, undefined, {
        ...currentNode.attrs,
        sourcePath: sourcePath || currentNode.attrs?.sourcePath,
        lastSyncedAt: Date.now()
      })
    } catch (error) {
      console.warn('[FileInclude] Failed to update attributes', error)
    }

    if (tr.steps.length) {
      view.dispatch(tr)
    }
  }

  async function applyContent2(raw: string) {
    // Check if view still exists and getPos is a function
    if (!view || typeof getPos !== 'function') return

    const pos = getPos()
    if (pos === undefined) return // Node is no longer in the document

    const { schema } = view.state
    const element = document.createElement('span')
    element.innerHTML = raw || ''

    // Parse the HTML into a ProseMirror Fragment
    const content = PMDOMParser.fromSchema(schema).parse(element).content

    // IMPORTANT: We must calculate the end position based on the LIVE node size
    const currentNode = view.state.doc.nodeAt(pos)
    if (!currentNode || currentNode.type.name !== node.type.name) return

    const from = pos + 1
    const to = pos + currentNode.nodeSize - 1

    // Use a single transaction to replace content and update attributes
    const tr = view.state.tr.replaceWith(from, to, content)

    // Update sync timestamp
    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      lastSyncedAt: Date.now()
    })

    view.dispatch(tr)
  }

  async function applyContent3(raw: string) {
    if (!editor || typeof getPos !== 'function') return

    const pos = getPos()
    if (pos === undefined) return

    const element = document.createElement('span')
    // Ensure we don't try to insert an empty fragment into a block+ node
    element.innerHTML = raw?.trim() ? raw : '<p></p>'

    const { schema } = editor.schema

    // Parse HTML to a PM Node, then get the content as a JSON array
    const slice = PMDOMParser.fromSchema(schema).parse(element)
    const contentJson = slice.content.toJSON()

    const currentNode = editor.state.doc.nodeAt(pos)
    if (!currentNode || currentNode.type.name !== node.type.name) return

    const from = pos + 1
    const to = pos + currentNode.nodeSize - 1

    // Use the command chain
    editor
      .chain()
      .insertContentAt({ from, to }, contentJson)
      .updateAttributes(node.type.name, {
        lastSyncedAt: Date.now()
      })
      .setMeta('addToHistory', false) // Innovative: prevents "Undo" from breaking sync state
      .run()
  }

  async function applyContentW(raw: string) {
    if (!editor || typeof getPos !== 'function') return

    const pos = getPos()
    if (pos === undefined) return

    // 1. Guard against empty content (required for block+ content)
    const safeHtml = raw?.trim() ? raw : '<p></p>'

    // 2. Get the current node to calculate the range
    const currentNode = editor.state.doc.nodeAt(pos)
    if (!currentNode || currentNode.type.name !== node.type.name) return

    const from = pos + 1
    const to = pos + currentNode.nodeSize - 1

    try {
      // 3. Insert Content directly as HTML
      // Tiptap's insertContentAt accepts HTML strings and handles the
      // DOMParser/Schema mapping internally, preventing the 'cached' error.
      editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, safeHtml)
        .updateAttributes(node.type.name, {
          lastSyncedAt: Date.now()
        })
        .setMeta('addToHistory', false)
        .run()

      status = 'synced'
      lastUpdated = new Date().toLocaleTimeString()
    } catch (error) {
      console.error('[FileInclude] Sync Error:', error)
      status = 'error'
      lastError = 'Failed to update document structure.'
    }
  }

  async function applyContent(raw: string) {
    if (!view || !editor) return
    if (typeof getPos !== 'function') return

    let pos = getPos() // Use getPos() instead of findNodeById for speed
    if (pos === undefined) return
    let currentNode = view.state.doc.nodeAt(pos)
    if (!currentNode || currentNode.type.name !== node?.type?.name || currentNode.attrs?.id !== callerId) {
      const resolved = findNodeById(callerId)
      if (resolved?.node) {
        pos = resolved.pos
        currentNode = resolved.node
      } else {
        const fallback = findNodeBySourcePath(sourcePath)
        if (!fallback?.node) return
        pos = fallback.pos
        currentNode = fallback.node
      }
    }

    const docSize = view.state.doc.content.size
    if (pos < 0 || pos > docSize) return

    // 1. Off-main-thread Parsing (Simulation)
    // We use a temporary element to keep the main DOM clean
    const element = document.createElement('span')
    element.innerHTML = raw || '<p></p>'

    const { schema } = view.state
    // High-performance parsing
    const parsed = PMDOMParser.fromSchema(schema).parse(element)
    const replacement = parsed.content

    // 2. The "Mega-Transaction"
    let tr = view.state.tr

    // INNOVATIVE: Tell the pagination extension to ignore this update until finished
    // Use setMeta if your pagination extension supports a 'skip' flag
    tr.setMeta('addToHistory', false)
    tr.setMeta('preventPaginationReflow', true)
    tr.setMeta('forceVarTransform', true)

    const from = pos + 1
    const to = Math.min(pos + currentNode.nodeSize - 1, docSize)
    if (from < 0 || to < from || to > docSize) return

    try {
      tr = tr.replaceWith(from, to, replacement)
      tr = tr.setNodeMarkup(pos, undefined, {
        ...currentNode.attrs,
        lastSyncedAt: Date.now()
      })
    } catch (error) {
      console.warn('[FileInclude] Failed to replace content', error)
      return
    }

    // 3. Single Dispatch
    // One dispatch = one DOM update. Vital for big files.
    view.dispatch(tr)
  }

  async function refresh() {
    if (!sourcePath || !window?.api?.readFile) return

    // If the editor is currently calculating pages, wait 100ms
    if (editor.storage.pagination?.isReflowing) {
      setTimeout(refresh, 100)
      return
    }

    status = 'loading'

    // async function refresh() {
    // if (!sourcePath || !window?.api?.readFile) return
    // status = 'loading'
    lastError = null
    try {
      const content = await window.api.readFile(sourcePath)
      if (typeof content === 'string' && content.startsWith('Error reading file:')) {
        status = 'error'
        lastError = content
        return
      }
      await applyContent(content)
      status = 'synced'
      lastUpdated = new Date().toLocaleTimeString()
    } catch (error: any) {
      console.error(error)
      status = 'error'
      lastError = error?.message || 'Failed to load content.'
    }
  }

  function startWatching(path: string) {
    if (!window?.api?.watchFile) return
    if (stopWatching) {
      stopWatching()
      stopWatching = null
    } else if (watchingPath && watchingPath !== path) {
      // Back-compat for platforms that still require explicit unwatch.
      window.api.unwatchFile?.(watchingPath, callerId)
    }

    const maybeStop = window.api.watchFile(path, callerId)
    stopWatching = typeof maybeStop === 'function' ? maybeStop : null
    if (!unregisterListener) {
      unregisterListener = registerFileIncludeListener(callerId, async (content) => {
        if (editor?.storage?.pagination?.isReflowing) {
          setTimeout(() => {
            void applyContent(content)
          }, 120)
        } else {
          await applyContent(content)
        }
        status = 'synced'
        lastUpdated = new Date().toLocaleTimeString()
      })
    }
  }

  $effect(() => {
    if (!mounted) return
    if (!sourcePath) return
    if (watchingPath === sourcePath) return
    watchingPath = sourcePath
    startWatching(sourcePath)
    refresh()
  })

  // onMount(() => {
  //   mounted = true
  //   if (sourcePath) {
  //     startWatching(sourcePath)
  //     refresh()
  //   }
  // })

  onMount(() => {
    mounted = true
    if (sourcePath) {
      startWatching(sourcePath)
      // Give the editor a frame to settle
      requestAnimationFrame(() => {
        refresh()
      })
    }
  })

  onDestroy(() => {
    unregisterListener?.()
    stopWatching?.()
    stopWatching = null
    if (watchingPath) {
      window.api.unwatchFile?.(watchingPath, callerId)
    }
  })
</script>


<NodeViewWrapper as="div" class="adobe-locked-node group">
  <div class="adobe-hud print:hidden" contenteditable="false">
    <span class="hud-flex">
      <i class="ph-fill ph-lock-key text-base-300 text-[10px]"></i>
      <span class="eyebrow">{$_('READ-ONLY REFERENCE')}</span>
      <span class="v-sep"></span>
      <span class="source-path truncate">{sourcePath}</span>
    </span>
  </div>

  <div class="ref-container">
    <div 
      class="content-body readonly-cursor" 
      contenteditable="false"
    >
      <NodeViewContent as="div" />
    </div>
    
    <div class="lock-indicator print:hidden"></div>
  </div>
</NodeViewWrapper>

<style lang="postcss">
  .adobe-locked-node {
    @apply relative block w-full align-baseline select-all;
  }

  .ref-container {
    @apply relative block w-full bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] rd-[2px];
    /* In Adobe style, locked content often has a solid "under-ink" border */
    box-shadow: inset 0 -1px 0 rgba(0, 190, 172, 0.2);
  }

  .readonly-cursor {
    /* Shows the "Not Allowed" or "Grab" cursor so user knows they can't type */
    cursor: not-allowed;
    @apply block w-full px-1;
  }

  .lock-indicator {
    @apply absolute inset-0 border border-transparent transition-colors pointer-events-none;
  }

  /* Show a subtle "L-shaped" corner bracket when hovering, typical of Adobe frame bounds */
  .adobe-locked-node:hover .lock-indicator {
    @apply border-[var(--color-base-300)]/20 border-dashed;
  }

  .adobe-hud {
    @apply absolute -top-8 left-0 flex items-center bg-[var(--color-base-100)] border border-white/10 
           px-2 h-6 rd-[2px] opacity-0 group-hover:opacity-100 transition-opacity z-50;
  }

  .eyebrow { @apply text-[8px] font-900 tracking-tighter text-[var(--color-base-300)] ml-1.5; }
  .v-sep { @apply w-px h-3 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-2; }
  .source-path { @apply text-[9px] text-[var(--color-base-content)]/30 font-mono; }

  @media print {
    .ref-container { @apply bg-transparent !important; box-shadow: none !important; }
    .adobe-hud { display: none !important; }
  }
</style>
