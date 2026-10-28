<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { NodeViewContent, NodeViewWrapper } from 'svelte-tiptap'
  import { runAI } from '../utils/utils'
  import { v4 as uuidv4 } from 'uuid'
  import MarkdownIt from 'markdown-it'
  import { DOMParser } from 'prosemirror-model' // Important for HTML to Node conversion
  import ContextMenu from '../../../../components/common/contextMenu/ContextMenu.svelte'
  import CustomAIExtensionComponentContextMenu from './CustomAIExtensionComponentContextMenu.svelte'
  import { openTextInputModal } from '../../../../stores/textInputModal.store'

  interface Props {
    node?: any
    view?: any
    getPos?: () => number
    updateAttributes?: (attrs: Record<string, any>) => void
    __prompt?: string
    __done?: boolean
    __onComplete?: Function
  }

  let { node, view, getPos, updateAttributes, __prompt, __done, __onComplete }: Props = $props()

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true
  })

  const _nodeId = node?.attrs?.id || uuidv4()
  let _prompt = $derived(__prompt || node?.attrs?.prompt)
  let prompt: string = $state(_prompt || '')
  let _done = $derived(__done ?? node?.attrs?.done)

  let responseText: string = $state('')
  let isLoading: boolean = $state(true)
  let temperature: number = $state(node?.attrs?.temperature ?? 0.7)
  let versionCount: number = $state(Array.isArray(node?.attrs?.versions) ? node.attrs.versions.length : 1)
  let currentVersion: number = $state(
    typeof node?.attrs?.currentVersion === 'number' ? node.attrs.currentVersion : Math.max(0, versionCount - 1)
  )
  let controller: AbortController
  let hasStarted = false

  $effect(() => {
    if (!node) return
    prompt = __prompt || node?.attrs?.prompt || ''
    if (Array.isArray(node.attrs?.versions)) {
      versionCount = node.attrs.versions.length || 1
      currentVersion =
        typeof node.attrs.currentVersion === 'number'
          ? node.attrs.currentVersion
          : Math.max(0, versionCount - 1)
    }
  })

  /**
   * Converts Markdown to HTML
   */
  function parseAiResult(result: string): string {
    const cleanMarkdown = result.trim()
    return md.render(cleanMarkdown)
  }

  /**
   * The core logic to turn HTML string into Tiptap Nodes
   */
  function onComplete(rawMarkdown: string) {
    const htmlResult = parseAiResult(rawMarkdown)

    if (__onComplete) {
      __onComplete(htmlResult)
      return
    }

    if (!view || typeof getPos !== 'function') return

    const { pos, currentNode } = resolveNodeById()
    if (!currentNode) {
      isLoading = false
      return
    }
    // Always get the LATEST state

    // 1. Create a temporary DOM element to hold our HTML
    const element = document.createElement('div')
    element.innerHTML = htmlResult

    // 2. Parse that DOM into ProseMirror Fragments using the current schema
    const { schema } = view.state
    const content = DOMParser.fromSchema(schema).parse(element)

    // 3. Dispatch transaction to replace inner content with parsed nodes
    const versions = Array.isArray(currentNode.attrs?.versions) ? [...currentNode.attrs.versions] : []
    versions.push(htmlResult)
    const nextVersionIndex = versions.length - 1
    versionCount = versions.length
    currentVersion = nextVersionIndex

    const tr = view.state.tr
      // Replace the content between [pos + 1] and [pos + size - 1]
      .replaceWith(pos + 1, pos + currentNode.nodeSize - 1, content.content)
      .setNodeMarkup(pos, undefined, {
        ...currentNode.attrs,
        done: true,
        result: htmlResult, // Store HTML in attrs for persistence if needed
        versions,
        currentVersion: nextVersionIndex,
        temperature
      })

    view.dispatch(tr)
    isLoading = false
  }

  function onComplete2(rawMarkdown: string) {
    const htmlResult = parseAiResult(rawMarkdown)

    // IMPORTANT: view.state.tr.mapping will help if we were in a sequence,
    // but for async, we should re-find the position if possible or use the current one safely.
    if (!view || typeof getPos !== 'function') return

    const pos = getPos()
    // Always get the LATEST state
    const { state } = view
    const currentNode = state.doc.nodeAt(pos)

    // STRICTOR CHECK: If the document shifted, this pos might be wrong.
    if (!currentNode || currentNode.attrs.id !== _nodeId) {
      // Fallback: Find the node by ID if the position shifted
      let foundPos = -1
      state.doc.descendants((node, p) => {
        if (node.attrs.id === _nodeId) {
          foundPos = p
          return false
        }
      })
      if (foundPos === -1) return
      // update locals
      updatePosAndNode(foundPos)
    }

    // ... dispatch logic ...
  }

  onMount(() => {
    if (_done || hasStarted) {
      isLoading = false
      return
    }

    hasStarted = true
    controller = new AbortController()

    runAI(
      _prompt,
      null,
      () => {
        isLoading = true
      },
      (chunk) => {
        responseText += chunk
      },
      (data) => {
        onComplete(data)
      }
    )
  })

  onDestroy(() => {
    controller?.abort()
  })

  function resolveNodeById() {
    if (!view || typeof getPos !== 'function') return { pos: -1, currentNode: null }
    let pos = -1
    let currentNode = null

    try {
      pos = getPos()
    } catch {
      return { pos: -1, currentNode: null }
    }

    try {
      const docSize = view.state.doc.content.size
      if (pos < 0 || pos > docSize) return { pos: -1, currentNode: null }
      currentNode = view.state.doc.nodeAt(pos)
    } catch {
      return { pos: -1, currentNode: null }
    }

    if (!currentNode || currentNode.attrs.id !== _nodeId) {
      let foundPos = -1
      try {
        view.state.doc.descendants((node, p) => {
          if (node.attrs?.id === _nodeId) {
            foundPos = p
            return false
          }
        })
      } catch {
        return { pos: -1, currentNode: null }
      }
      if (foundPos === -1) return { pos: -1, currentNode: null }
      pos = foundPos
      try {
        currentNode = view.state.doc.nodeAt(pos)
      } catch {
        return { pos: -1, currentNode: null }
      }
    }

    return { pos, currentNode }
  }

  function replaceNodeContentWithHtml(html: string, attrs: Record<string, any> = {}) {
    if (!view) return
    const { pos, currentNode } = resolveNodeById()
    if (!currentNode) return

    const element = document.createElement('div')
    element.innerHTML = html
    const { schema } = view.state
    const content = DOMParser.fromSchema(schema).parse(element)

    const tr = view.state.tr
      .replaceWith(pos + 1, pos + currentNode.nodeSize - 1, content.content)
      .setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...attrs })
    view.dispatch(tr)
  }

  function handleRegenerate() {
    if (!prompt) return
    if (!view) return
    responseText = ''
    isLoading = true
    hasStarted = true

    const { pos, currentNode } = resolveNodeById()
    if (currentNode) {
      const tr = view.state.tr
        .replaceWith(
          pos + 1,
          pos + currentNode.nodeSize - 1,
          view.state.schema.nodes.paragraph.create({}, view.state.schema.text(' '))
        )
        .setNodeMarkup(pos, undefined, { ...currentNode.attrs, done: false, prompt })
      view.dispatch(tr)
    }

    runAI(
      prompt,
      null,
      () => {
        isLoading = true
      },
      (chunk) => {
        responseText += chunk
      },
      (data) => {
        onComplete(data)
      }
    )
  }

  async function handleShowPrompt() {
    const nextPrompt = await openTextInputModal({
      title: $_('Edit AI Prompt'),
      message: $_('Update the prompt and regenerate this AI block.'),
      defaultValue: prompt || _prompt || '',
      placeholder: $_('Describe what you want the AI to generate…'),
      multiline: true,
      rows: 6,
      confirmText: $_('Update & Regenerate'),
      cancelText: $_('Cancel')
    })
    if (typeof nextPrompt !== 'string') return
    prompt = nextPrompt.trim()
    if (!prompt) return
    updateAttributes?.({ prompt })
    handleRegenerate()
  }

  function handleAccept() {
    if (!view) return
    const { pos, currentNode } = resolveNodeById()
    if (!currentNode) return
    const tr = view.state.tr.replaceWith(pos, pos + currentNode.nodeSize, currentNode.content)
    view.dispatch(tr)
  }

  function handlePrevVersion() {
    if (!view) return
    const { currentNode } = resolveNodeById()
    if (!currentNode) return
    const versions = Array.isArray(currentNode.attrs?.versions) ? currentNode.attrs.versions : []
    if (!versions.length) return
    const nextIndex = Math.max(0, currentVersion - 1)
    if (nextIndex === currentVersion) return
    currentVersion = nextIndex
    replaceNodeContentWithHtml(versions[nextIndex], { currentVersion: nextIndex })
  }

  function handleNextVersion() {
    if (!view) return
    const { currentNode } = resolveNodeById()
    if (!currentNode) return
    const versions = Array.isArray(currentNode.attrs?.versions) ? currentNode.attrs.versions : []
    if (!versions.length) return
    const nextIndex = Math.min(versions.length - 1, currentVersion + 1)
    if (nextIndex === currentVersion) return
    currentVersion = nextIndex
    replaceNodeContentWithHtml(versions[nextIndex], { currentVersion: nextIndex })
  }

  function handleTemperatureChange(event: CustomEvent<{ value: number }>) {
    if (!view) return
    temperature = event.detail?.value ?? temperature
    const { pos, currentNode } = resolveNodeById()
    if (!currentNode) return
    const tr = view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, temperature })
    view.dispatch(tr)
  }
</script>

<NodeViewWrapper class="ai-node-container block">
  <!-- <div
    class="relative rounded-lg border-2 border-dashed border-indigo-300/50 bg-indigo-50/5 transition-all"
    style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%);"
  > -->
  <div
    class="relative bg-indigo-50/5 transition-all"
    style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%);"
  >
    <div class="flex items-center gap-2 mb-3 select-none absolute left-[-3%]">
      <ContextMenu>
        <i class="ph-bold ph-sparkle text-indigo-500"></i>
        <svelte:fragment slot="content">
          <CustomAIExtensionComponentContextMenu
            status={isLoading ? 'drafting' : 'idle'}
            versionCount={versionCount}
            currentVersion={currentVersion + 1}
            temperature={temperature}
            on:regenerate={handleRegenerate}
            on:accept={handleAccept}
            on:showPrompt={handleShowPrompt}
            on:prevVersion={handlePrevVersion}
            on:nextVersion={handleNextVersion}
            on:temperatureChange={handleTemperatureChange}
          />
        </svelte:fragment>
      </ContextMenu>

      <!-- <i class="ph-bold ph-sparkle text-indigo-500 animate-pulse"></i> -->
      <!-- <span class="text-[10px] font-bold uppercase tracking-widest text-indigo-400">AI Assistant</span> -->
      {#if isLoading}
        <span class="text-[9px] text-indigo-300 italic">{$_('Drafting...')}</span>
      {/if}
    </div>

    <div class="prose prose-sm max-w-none">
      <!-- <div class="prose prose-sm max-w-none text-base-content"> -->
      {#if isLoading}
        <div class="whitespace-pre-wrap opacity-60 italic text-sm">
          {responseText}<span class="inline-block w-1 h-4 ml-1 bg-indigo-500"></span>
          <!-- {responseText}<span class="inline-block w-1 h-4 ml-1 bg-indigo-500 animate-bounce"></span> -->
        </div>
      {/if}

      <NodeViewContent class="ai-editable-area outline-none min-h-[1em]" />
    </div>
  </div>
</NodeViewWrapper>

<style>
  :global(.ai-node-container .ai-editable-area > *:first-child) {
    margin-top: 0;
  }
  :global(.ai-node-container .ai-editable-area > *:last-child) {
    margin-bottom: 0;
  }
</style>
