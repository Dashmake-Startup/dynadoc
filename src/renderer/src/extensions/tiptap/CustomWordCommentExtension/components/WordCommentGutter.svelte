<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { Editor } from '@tiptap/core'
  import { GenericFormatingEditorCommands } from '../../../../components/common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'
  import { slide } from 'svelte/transition'
  import ContextMenu from '../../../../components/common/contextMenu/ContextMenu.svelte'
  import WordCommentEditor from './WordCommentEditor.svelte'
  import EditorCommonUtils from '../../../../utils/common.utils'
  import {
    _$_activeSecondarySidebarItem,
    _$_secondarySidebarVisible
  } from '../../../../stores/common.store'
  import { authStore } from '../../../../stores/auth.store'
  import { _$_wordCommentFocus, focusWordComment } from '../stores/commentFocus.store'

  type GutterItem = {
    id: string
    author: string
    text: string
    resolved: boolean
    from: number
    to: number
    top: number
    top_original: number
    thread: any[]
    createdAt?: number
  }

  const { editor } = $props<{ editor: Editor | null }>()

  let items: GutterItem[] = $state([])
  let container: HTMLDivElement | null = null
  let scrollContainer: HTMLElement | null = null
  let rafId = 0
  let hideResolved = false

  let hoveredId = $state<string | null>(null)

  let activeId = $state<string | null>(null)
  let editingTarget = $state<{ commentId: string; threadId: string } | null>(null)
  let replyingId = $state<string | null>(null)
  let pendingFocusId = $state<string | null>(null)
  let pendingScroll = $state(false)
  let authState = $derived($authStore)

  // Innovation: We calculate the "Anchor Top" (original pos) vs "Card Top" (pushed pos)
  // to draw the Bezier curve correctly.
  function getConnectorPath(item: GutterItem) {
    const anchorY = item.top_original + 10 // Pointing to the text
    const cardY = item.top + 20 // Landing on the card
    const deltaX = 40 // Width of the connector zone

    // SVG Path: Move to anchor, draw cubic bezier to card
    return `M -${deltaX},${anchorY} C -${deltaX / 2},${anchorY} -${deltaX / 2},${cardY} 0,${cardY}`
  }

  function computePositions() {
    if (!editor || !container) return

    const { view } = editor
    const { doc } = view.state
    const rootRect = view.dom.getBoundingClientRect()

    // Configuration for High-Density Stacking
    const CARD_MARGIN = 8 // Spacing between cards
    const GUTTER_OFFSET = 20 // Initial top padding
    const COLLAPSED_HEIGHT = 42 // Height when not active (Snippet mode)
    const EXPANDED_HEIGHT = 180 // Estimated height when active/expanded

    const seen = new Map<string, GutterItem>()
    const onlyMine = !!editor.storage?.review?.onlyShowMine
    const reviewer = (editor.storage?.review?.author || 'Editor').toString().trim().toLowerCase()

    hideResolved = !!editor.storage?.review?.hideResolvedComments

    // 1. Scan Document for Comment Marks
    doc.descendants((node, pos) => {
      if (!node.marks?.length) return

      node.marks.forEach((mark) => {
        if (mark.type.name !== 'wordComment') return

        const id = mark.attrs.id
        if (seen.has(id)) return
        if (hideResolved && mark.attrs?.resolved) return

        const thread = Array.isArray(mark.attrs.thread) ? mark.attrs.thread : []
        const first = thread[0] || {}
        const author = (first.author || mark.attrs.author || 'Editor').toString().trim()

        if (onlyMine && author.toLowerCase() !== reviewer) return

        // Calculate the "Anchor" position (where the line starts)
        const coords = view.coordsAtPos(pos)
        const idealTop = coords.top - rootRect.top

        const createdAt = first.createdAt || mark.attrs?.createdAt
        seen.set(id, {
          id,
          author,
          text: first.text || node.textContent || '',
          resolved: !!mark.attrs.resolved,
          from: pos,
          to: pos + node.nodeSize,
          top: idealTop, // This will be mutated by the stacker
          top_original: idealTop, // This stays locked as the SVG anchor
          thread,
          createdAt
        })
      })
    })

    // 2. Sort by document order
    const sortedItems = Array.from(seen.values()).sort((a, b) => a.top_original - b.top_original)

    // 3. Collision Resolution (The "Push-Down" Algorithm)
    let currentStackY = GUTTER_OFFSET

    const positionedItems = sortedItems.map((item) => {
      // Determine height based on whether it's the active comment
      const isExpanded = activeId === item.id
      const itemHeight = isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT

      // The card wants to be at item.top_original, but it CANNOT be higher than currentStackY
      const finalTop = Math.max(item.top_original, currentStackY)

      // Update the stack pointer for the next card
      currentStackY = finalTop + itemHeight + CARD_MARGIN

      return {
        ...item,
        top: finalTop
      }
    })

    // 4. Update Svelte State
    items = positionedItems

    if (pendingFocusId) {
      const target = positionedItems.find((entry) => entry.id === pendingFocusId)
      if (target && pendingScroll) {
        jump(target)
      }
      pendingFocusId = null
      pendingScroll = false
    }
  }

  /**
   * Handles Card Actions (Resolve, Edit, Delete)
   * Uses Tiptap commands to sync changes back to the document marks.
   */
  function handleAction(e: MouseEvent, action: string, item: GutterItem) {
    e.stopPropagation() // Prevent the card from "jumping" or toggling active state

    if (!editor) return

    switch (action) {
      case 'resolve':
        // Toggle the 'resolved' attribute on the mark
        editor.commands.resolveWordComment(item.id, !item.resolved)
        break

      case 'delete':
        // Custom command to strip the mark from the document
        if (confirm('Delete this comment thread?')) {
          editor.commands.deleteWordComment(item.id)
        }
        break

      case 'edit':
        // Logic for opening an inline edit state or focused reply
        activeId = item.id
        // You could trigger a local "editing" boolean here
        break
    }
  }

  function scheduleUpdate() {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(computePositions)
  }

  function bind() {
    if (!editor) return
    scheduleUpdate()
    editor.on('update', scheduleUpdate)
    editor.on('transaction', scheduleUpdate)
    editor.on('selectionUpdate', scheduleUpdate)
    scrollContainer = editor.view.dom.closest('.editor-container')
    scrollContainer?.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
  }

  function unbind() {
    if (!editor) return
    editor.off('update', scheduleUpdate)
    editor.off('transaction', scheduleUpdate)
    editor.off('selectionUpdate', scheduleUpdate)
    scrollContainer?.removeEventListener('scroll', scheduleUpdate)
    window.removeEventListener('resize', scheduleUpdate)
  }

  $effect(() => {
    if (!editor) return
    unbind()
    bind()
  })

  onDestroy(() => {
    unbind()
    cancelAnimationFrame(rafId)
  })

  function jump(item: GutterItem) {
    if (!editor) return
    editor.commands.setTextSelection({ from: item.from, to: item.to })
    editor.commands.scrollIntoView()
  }

  function resolve(item: GutterItem) {
    GenericFormatingEditorCommands.resolveWordComment(item.id, !item.resolved)
  }

  function openInReviewPane(item: GutterItem) {
    _$_activeSecondarySidebarItem.set('review')
    _$_secondarySidebarVisible.set(true)
    focusWordComment(item.id, { source: 'gutter', scroll: true })
  }

  function getThreadItemText(entry?: any) {
    if (!entry) return ''
    if (entry.text) return entry.text
    if (!entry.html) return ''
    if (typeof document !== 'undefined') {
      const div = document.createElement('div')
      div.innerHTML = entry.html
      return div.textContent || div.innerText || ''
    }
    return entry.html.replace(/<[^>]+>/g, '')
  }

  function resolveAuthDisplayName() {
    const user = authState?.user
    if (!user) return ''
    const full = `${user.firstName || ''} ${user.lastName || ''}`.trim()
    return (
      user.displayName ||
      user.name ||
      full ||
      user.username ||
      user.email ||
      ''
    )
  }

  function currentAuthor() {
    const authName = resolveAuthDisplayName()
    const stored = editor?.storage?.review?.author
    return (authName || stored || 'Editor').toString()
  }

  function beginEdit(commentId: string, threadId: string) {
    if (!threadId) return
    editingTarget = { commentId, threadId }
    replyingId = null
  }

  function cancelEdit() {
    editingTarget = null
  }

  function beginReply(commentId: string) {
    replyingId = commentId
    editingTarget = null
  }

  function cancelReply() {
    replyingId = null
  }

  function saveEdit(commentId: string, threadId: string, payload: { html: string; text: string }) {
    if (!editor) return
    editor.commands.updateWordCommentThreadItem(commentId, threadId, {
      html: payload.html,
      text: payload.text,
      author: currentAuthor()
    })
    editingTarget = null
  }

  function saveReply(commentId: string, payload: { html: string; text: string }) {
    if (!editor) return
    editor.commands.replyWordCommentRich(commentId, {
      html: payload.html,
      text: payload.text,
      author: currentAuthor()
    })
    replyingId = null
  }

  function deleteReply(commentId: string, threadId: string) {
    if (!editor) return
    if (confirm('Delete this reply?')) {
      editor.commands.deleteWordCommentThreadItem(commentId, threadId)
    }
  }

  async function copyCommentLink(item: GutterItem) {
    const value = `comment:${item.id}`
    await EditorCommonUtils.copyToClipboard(value)
  }

  function formatTimestamp(value?: number) {
    if (!value) return ''
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(value))
    } catch {
      return new Date(value).toLocaleString()
    }
  }

  function initials(name?: string) {
    const safe = (name || 'U').trim()
    if (!safe) return 'U'
    const parts = safe.split(' ')
    const head = parts[0]?.[0] || 'U'
    const tail = parts[1]?.[0] || ''
    return `${head}${tail}`.toUpperCase()
  }

  function avatarColor(name?: string) {
    const safe = (name || 'User').toLowerCase()
    let hash = 0
    for (let i = 0; i < safe.length; i += 1) {
      hash = (hash * 31 + safe.charCodeAt(i)) >>> 0
    }
    const hue = hash % 360
    return `hsl(${hue} 55% 45%)`
  }

  $effect(() => {
    const focus = $_$_wordCommentFocus
    if (!focus?.id) return
    activeId = focus.id
    pendingFocusId = focus.id
    pendingScroll = !!focus.scroll
    scheduleUpdate()
  })
</script>

<div bind:this={container} class="ms-gutter-system">
  <svg class="connector-layer">
    {#each items as item}
      <path
        d={getConnectorPath(item)}
        class="bezier-line"
        class:active={hoveredId === item.id || activeId === item.id}
      />
      <circle cx="-40" cy={item.top_original + 10} r="2" class="anchor-dot" />
    {/each}
  </svg>

  {#each items as item (item.id)}
    <div
      class="ms-card"
      class:is-active={activeId === item.id}
      class:is-hovered={hoveredId === item.id}
      class:is-resolved={item.resolved}
      style={`transform: translateY(${item.top}px)`}
      onmouseenter={() => (hoveredId = item.id)}
      onmouseleave={() => (hoveredId = null)}
      onclick={() => {
        activeId = activeId === item.id ? null : item.id
        focusWordComment(item.id, { source: 'gutter', scroll: true })
        jump(item)
      }}
    >
      <div class="card-accent" style="background: {avatarColor(item.author)}"></div>

      <div class="content-wrapper">
        <header class="card-header">
          <div class="user-info">
            <span class="avatar-sm" style="background: {avatarColor(item.author)}">
              {initials(item.author)}
            </span>
            <div class="name-box">
              <span class="u-name">{item.author}</span>
              <span class="u-time"
                >{formatTimestamp(item.thread?.[0]?.createdAt || item.createdAt)}</span
              >
            </div>
          </div>

          <div class="card-actions">
            <ContextMenu __placement="bottom-end" __offset={[0, 8]}>
              <button class="menu-btn" title="Actions" onclick={(e) => e.stopPropagation()}>
                <i class="ph-bold ph-dots-three-outline-vertical"></i>
              </button>
              <svelte:fragment slot="content">
                <div class="comment-menu">
                  <button onclick={() => beginReply(item.id)}>
                    <i class="ph-bold ph-chat-circle-dots"></i>
                    Reply
                  </button>
                  <button onclick={() => beginEdit(item.id, item.thread?.[0]?.id)}>
                    <i class="ph-bold ph-pencil-simple"></i>
                    Edit
                  </button>
                  <button onclick={() => resolve(item)}>
                    <i class="ph-bold ph-check-circle"></i>
                    {item.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                  <button onclick={() => openInReviewPane(item)}>
                    <i class="ph-bold ph-sidebar"></i>
                    Open in review pane
                  </button>
                  <button onclick={() => copyCommentLink(item)}>
                    <i class="ph-bold ph-link-simple"></i>
                    Copy link
                  </button>
                  <button class="danger" onclick={(e) => handleAction(e, 'delete', item)}>
                    <i class="ph-bold ph-trash"></i>
                    Delete
                  </button>
                </div>
              </svelte:fragment>
            </ContextMenu>
          </div>
        </header>

        <div class="comment-content">
          {#if activeId !== item.id}
            <p class="text-snippet">
              {getThreadItemText(item.thread?.[0]) || item.text}
            </p>
          {/if}

          {#if activeId === item.id}
            <div
              class="full-thread"
              in:slide
              onclick={(e) => {
                e.stopPropagation()
              }}
            >
              {#each item.thread as entry, idx}
                <div class="reply-box" class:is-root={idx === 0}>
                  <div class="reply-meta">
                    <span class="reply-author">{entry.author || item.author}</span>
                    <span class="reply-time">{formatTimestamp(entry.createdAt)}</span>
                    {#if idx === 0 && item.resolved}
                      <span class="reply-chip">Resolved</span>
                    {/if}
                  </div>
                  {#if editingTarget && editingTarget.commentId === item.id && editingTarget.threadId === entry.id}
                    <WordCommentEditor
                      value={entry?.html || entry?.text || ''}
                      placeholder="Edit comment…"
                      autofocus={true}
                      onSave={(payload) => saveEdit(item.id, entry.id, payload)}
                      onCancel={cancelEdit}
                    />
                  {:else}
                    <div class="reply-body">
                      {#if entry?.html}
                        {@html entry.html}
                      {:else}
                        {entry?.text || ''}
                      {/if}
                    </div>
                    <div class="reply-actions">
                      <button onclick={() => beginEdit(item.id, entry.id)}>Edit</button>
                      {#if idx > 0}
                        <button class="danger" onclick={() => deleteReply(item.id, entry.id)}>
                          Delete
                        </button>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}

              {#if replyingId === item.id}
                <WordCommentEditor
                  value=""
                  placeholder="Write a reply…"
                  autofocus={true}
                  onSave={(payload) => saveReply(item.id, payload)}
                  onCancel={cancelReply}
                />
              {:else}
                <button class="reply-cta" onclick={() => beginReply(item.id)}>
                  <i class="ph-bold ph-chat-circle-dots"></i>
                  Reply
                </button>
              {/if}
            </div>
          {:else if item.thread.length > 1}
            <div class="thread-count">
              <i class="ph ph-chats-teardrop"></i>
              {item.thread.length - 1} replies
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/each}
</div>

<style lang="postcss">
  .ms-gutter-system {
    @apply absolute top-0 right-[-260px] w-[300px] pointer-events-none font-sans;
  }

  /* SVG Bezier Styles */
  .connector-layer {
    @apply absolute inset-0 w-full h-full overflow-visible;
  }
  .bezier-line {
    @apply fill-none stroke-white/10 stroke-1 transition-all duration-300;
  }
  .bezier-line.active {
    @apply stroke-[var(--color-base-300)] stroke-2 opacity-100;
  }
  .anchor-dot {
    @apply fill-white/20 transition-colors;
  }
  .bezier-line.active + .anchor-dot {
    @apply fill-[var(--color-base-300)];
  }

  /* Card UI - Adobe meets MS Word */
  .ms-card {
    @apply absolute right-0 w-[270px] bg-[var(--color-base-100)] border border-white/5 
           rd-6px flex overflow-hidden pointer-events-auto transition-all duration-200;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .ms-card.is-hovered {
    @apply border-white/20 translate-x-[-2px] bg-[#222];
  }
  .ms-card.is-active {
    @apply ring-1 ring-[var(--color-base-300)] bg-[var(--color-base-100)] shadow-2xl z-10;
  }
  .ms-card.is-resolved {
    @apply opacity-50 grayscale;
  }

  .card-accent {
    @apply w-[4px] h-stretch shrink-0;
  }

  .content-wrapper {
    @apply flex-1 p-2.5 flex flex-col gap-2 min-w-0;
  }

  .card-header {
    @apply flex items-center justify-between;
  }
  .user-info {
    @apply flex items-center gap-2;
  }
  .avatar-sm {
    @apply size-5 rd-2px flex items-center justify-center text-[8px] font-bold text-[var(--color-base-content)];
  }
  .name-box {
    @apply flex flex-col leading-none;
  }
  .u-name {
    @apply text-[11px] font-semibold text-[var(--color-base-content)]/90;
  }
  .u-time {
    @apply text-[8px] text-[var(--color-base-content)]/30 uppercase mt-0.5;
  }

  .card-actions {
    @apply flex gap-1 opacity-0 transition-opacity;
  }
  .ms-card:hover .card-actions {
    @apply opacity-100;
  }
  .card-actions button {
    @apply size-6 rd-4px flex items-center justify-center text-[10px] text-[var(--color-base-content)]/40 hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] hover:text-[var(--color-base-content)];
  }
  .menu-btn {
    @apply size-6 rd-4px flex items-center justify-center text-[10px] text-[var(--color-base-content)]/50 hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] hover:text-[var(--color-base-content)];
  }

  .comment-menu {
    @apply w-44 bg-[#171a22] border border-white/10 rd-8px p-1 flex flex-col gap-1 shadow-2xl;
  }
  .comment-menu button {
    @apply flex items-center gap-2 px-2 py-1.5 text-[11px] text-[var(--color-base-content)]/70 rd-6px hover:(bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[var(--color-base-content)]);
  }
  .comment-menu button.danger {
    @apply text-red-300 hover:(bg-red-500/20 text-red-200);
  }

  .comment-content {
    @apply text-[12px] text-[var(--color-base-content)]/70;
  }
  .text-snippet {
    @apply line-clamp-2 transition-all;
  }
  .text-snippet.expanded {
    @apply line-clamp-none text-[var(--color-base-content)]/90;
  }

  /* Reply System */
  .full-thread {
    @apply mt-3 pt-3 border-t border-white/5 flex flex-col gap-3;
  }
  .reply-box {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] p-2 rd-6px flex flex-col gap-2;
  }
  .reply-box.is-root {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] border border-white/10;
  }
  .reply-meta {
    @apply flex items-center gap-2 text-[9px] text-[var(--color-base-content)]/50 uppercase tracking-wider;
  }
  .reply-author {
    @apply text-primary/70 font-bold;
  }
  .reply-time {
    @apply text-[var(--color-base-content)]/30;
  }
  .reply-chip {
    @apply ml-auto text-[8px] px-1.5 py-0.5 rd-4px bg-emerald-400/10 text-emerald-300;
  }
  .reply-body {
    @apply text-[11px] leading-relaxed text-[var(--color-base-content)]/80;
  }
  .reply-body :global(p) {
    @apply m-0;
  }
  .reply-actions {
    @apply flex gap-2 text-[9px] text-[var(--color-base-content)]/40;
  }
  .reply-actions button {
    @apply hover:text-[var(--color-base-content)] transition-colors;
  }
  .reply-actions button.danger {
    @apply text-red-300/70 hover:text-red-200;
  }

  .reply-cta {
    @apply flex items-center gap-2 text-[10px] font-800 tracking-widest uppercase text-primary/70
           hover:text-primary transition-colors;
  }

  .thread-count {
    @apply mt-1 text-[10px] text-primary/60 font-medium flex items-center gap-1;
  }
</style>
