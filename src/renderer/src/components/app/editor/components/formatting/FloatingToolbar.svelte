<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'
  import type { Editor } from '@tiptap/core'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import { GenericFormatingEditorCommands } from '../../../../common/actions/formatting/commands/GenericFormatingEditorCommands'
  import { GenericFormattingComponentMap } from '../../../../common/actions/formatting'

  // ── State ─────────────────────────────────────────────────────────────────
  let toolbarEl = $state<HTMLElement | null>(null)
  let visible = $state(false)
  let selectionState = $state<'hidden' | 'caret' | 'range'>('hidden')
  let posTop = $state(0)
  let posLeft = $state(0)

  // Active formatting marks
  let isBold = $state(false)
  let isItalic = $state(false)
  let isUnderline = $state(false)
  let isAlignLeft = $state(false)
  let isAlignCenter = $state(false)
  let isAlignRight = $state(false)
  let isAlignJustify = $state(false)
  let isBullet = $state(false)
  let isNumber = $state(false)

  // Current font / size
  let currentFont = $state('Default')
  let currentSize = $state(12)
  let editingSize = $state(false)
  let sizeInputEl = $state<HTMLInputElement | null>(null)
  let sizeDraft = $state('')

  // Size preset dropdown
  let sizeDropdownOpen = $state(false)
  const SIZE_PRESETS = [8, 9, 10, 11, 12, 14, 16, 18, 24, 36, 48, 60]

  // Heading dropdown
  let headingDropdownOpen = $state(false)
  const HEADING_PRESETS = [
    { label: 'Normal', command: () => GenericFormatingEditorCommands.paragraph?.() },
    { label: 'Heading 1', command: () => GenericFormatingEditorCommands.heading?.(1) },
    { label: 'Heading 2', command: () => GenericFormatingEditorCommands.heading?.(2) },
    { label: 'Heading 3', command: () => GenericFormatingEditorCommands.heading?.(3) },
    { label: 'Heading 4', command: () => GenericFormatingEditorCommands.heading?.(4) },
  ]

  // ── Editor binding ─────────────────────────────────────────────────────────
  let activeEditor = $state<Editor | null>(null)
  let detachEditorListeners: (() => void) | null = null
  let detachActiveStore: (() => void) | null = null

  function updateActiveStates(editor: Editor) {
    isBold = editor.isActive('bold')
    isItalic = editor.isActive('italic')
    isUnderline = editor.isActive('underline')
    isAlignLeft = editor.isActive({ textAlign: 'left' }) ||
      (!editor.isActive({ textAlign: 'center' }) &&
       !editor.isActive({ textAlign: 'right' }) &&
       !editor.isActive({ textAlign: 'justify' }))
    isAlignCenter = editor.isActive({ textAlign: 'center' })
    isAlignRight = editor.isActive({ textAlign: 'right' })
    isAlignJustify = editor.isActive({ textAlign: 'justify' })
    isBullet = editor.isActive('bulletList')
    isNumber = editor.isActive('orderedList')

    const attrs = editor.getAttributes('textStyle')
    if (attrs?.fontFamily) {
      currentFont = attrs.fontFamily.replace(/['"]/g, '').split(',')[0].trim()
    } else {
      currentFont = 'Default'
    }
    if (attrs?.fontSize) {
      const parsed = parseFloat(attrs.fontSize)
      if (!isNaN(parsed)) currentSize = Math.round(parsed)
    }
  }

  function updatePosition(editor: Editor) {
    if (!editor.isFocused) return

    const { empty } = editor.state.selection
    if (empty) {
      visible = false
      selectionState = 'hidden'
      return
    }
    selectionState = 'range'

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const rect = sel.getRangeAt(0).getBoundingClientRect()
    if (!rect || (rect.width === 0 && rect.height === 0)) return

    const tbW = toolbarEl?.offsetWidth || 480
    const tbH = toolbarEl?.offsetHeight || 136

    const above = rect.top - tbH - 8
    const below = rect.bottom + 8
    const computedTop = above > 12 ? above : below

    let computedLeft = rect.left + (rect.width - tbW) / 2
    computedLeft = Math.max(12, Math.min(computedLeft, window.innerWidth - tbW - 12))

    posTop = computedTop
    posLeft = computedLeft
    visible = true
  }

  function onEditorEvent(editor: Editor) {
    updateActiveStates(editor)
    requestAnimationFrame(() => updatePosition(editor))
  }

  function bindEditor(nextEditor: Editor | null) {
    if (activeEditor === nextEditor) {
      if (nextEditor) onEditorEvent(nextEditor)
      return
    }
    detachEditorListeners?.()
    detachEditorListeners = null
    activeEditor = nextEditor

    if (!nextEditor) {
      visible = false
      selectionState = 'hidden'
      return
    }

    const update = () => onEditorEvent(nextEditor)
    const blur = () => { visible = false; selectionState = 'hidden' }

    nextEditor.on('selectionUpdate', update)
    nextEditor.on('transaction', update)
    nextEditor.on('blur', blur)
    detachEditorListeners = () => {
      nextEditor.off('selectionUpdate', update)
      nextEditor.off('transaction', update)
      nextEditor.off('blur', blur)
    }
    onEditorEvent(nextEditor)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') { visible = false; selectionState = 'hidden' }
  }

  onMount(() => {
    const store = _$_wysiwygEditorsList.getActive()
    const sync = (entry: any) => bindEditor(entry?.editor || null)
    detachActiveStore = store.subscribe(sync)
    sync(get(store))
    document.addEventListener('keydown', onKeyDown)
  })

  onDestroy(() => {
    detachActiveStore?.()
    detachEditorListeners?.()
    document.removeEventListener('keydown', onKeyDown)
  })

  // ── Commands ───────────────────────────────────────────────────────────────
  function run(fn: () => void) {
    fn()
    sizeDropdownOpen = false
    headingDropdownOpen = false
  }

  function applySize(pt: number) {
    // Convert pt to px (1pt = 1.333px) then delegate to command
    const px = Math.round(pt * 1.333)
    GenericFormatingEditorCommands.setFontSize?.(`${px}px`)
    currentSize = pt
    sizeDropdownOpen = false
    activeEditor?.commands.focus()
  }

  function commitSizeDraft() {
    const n = parseInt(sizeDraft)
    if (!isNaN(n) && n >= 1 && n <= 400) applySize(n)
    editingSize = false
  }

  function invokeSmart(key: string) {
    const tool = GenericFormattingComponentMap[key]
    if (tool?.props && typeof (tool.props as any).__onClick === 'function') {
      (tool.props as any).__onClick()
    }
  }

  // Active heading label
  let headingLabel = $derived.by(() => {
    if (!activeEditor) return 'Normal'
    if (activeEditor.isActive('heading', { level: 1 })) return 'H1'
    if (activeEditor.isActive('heading', { level: 2 })) return 'H2'
    if (activeEditor.isActive('heading', { level: 3 })) return 'H3'
    if (activeEditor.isActive('heading', { level: 4 })) return 'H4'
    return 'Normal'
  })
</script>

{#if visible && activeEditor}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={toolbarEl}
  class="float-tb"
  data-state={selectionState}
  style="top:{posTop}px; left:{posLeft}px"
  onmousedown={(e) => e.preventDefault()}
>

  <!-- ── Row 1: Font + inline formatting ───────────────────────────── -->
  <div class="ft-row">
    <!-- Font chip -->
    <button class="ft-chip ft-font" title="Font family">
      <span class="ft-glyph">Aa</span>
      <span class="ft-lbl" style="font-family:{currentFont}">{currentFont}</span>
      <span class="ft-chev">▾</span>
    </button>

    <!-- Size chip -->
    <div class="ft-chip ft-size" style="position:relative">
      {#if editingSize}
        <input
          bind:this={sizeInputEl}
          class="ft-size-input"
          bind:value={sizeDraft}
          onblur={commitSizeDraft}
          onkeydown={(e) => { if (e.key === 'Enter') commitSizeDraft(); if (e.key === 'Escape') editingSize = false }}
          type="number"
          min="1"
          max="400"
        />
      {:else}
        <button
          class="ft-size-btn"
          onclick={() => { sizeDraft = String(currentSize); editingSize = true; sizeDropdownOpen = true; requestAnimationFrame(() => sizeInputEl?.select()) }}
          onmousedown={(e) => e.preventDefault()}
        >
          <span class="ft-lbl">{currentSize}</span>
          <span class="ft-chev">▾</span>
        </button>
      {/if}
      {#if sizeDropdownOpen}
        <div class="ft-dropdown ft-size-drop">
          {#each SIZE_PRESETS as sz}
            <button
              class="ft-drop-item"
              class:active={currentSize === sz}
              onmousedown={(e) => { e.preventDefault(); applySize(sz) }}
            >{sz}</button>
          {/each}
        </div>
      {/if}
    </div>

    <span class="ft-sep"></span>

    <!-- Grow font -->
    <button class="ft-btn" title="Increase font size · ⌘⇧>" onclick={() => run(GenericFormatingEditorCommands.increaseFontSize)}>
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <text x="1" y="12" font-size="10" font-family="serif" stroke="none" fill="currentColor" font-weight="500">A</text>
        <path d="M9.5 1 L12.5 4.5 L15.5 1" transform="translate(-3 -0.5)" stroke="currentColor" stroke-width="1.4"/>
      </svg>
    </button>

    <!-- Shrink font -->
    <button class="ft-btn" title="Decrease font size · ⌘⇧<" onclick={() => run(GenericFormatingEditorCommands.decreaseFontSize)}>
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <text x="1" y="12" font-size="10" font-family="serif" stroke="none" fill="currentColor" font-weight="500">A</text>
        <path d="M9.5 4.5 L12.5 1 L15.5 4.5" transform="translate(-3 -0.5)" stroke="currentColor" stroke-width="1.4"/>
      </svg>
    </button>

    <span class="ft-sep"></span>

    <!-- Bold -->
    <button class="ft-btn" class:active={isBold} title="Bold · ⌘B" onclick={() => run(GenericFormatingEditorCommands.bold)}>
      <strong>B</strong>
    </button>

    <!-- Italic -->
    <button class="ft-btn" class:active={isItalic} title="Italic · ⌘I" onclick={() => run(GenericFormatingEditorCommands.italic)}>
      <em>I</em>
    </button>

    <!-- Underline -->
    <button class="ft-btn" class:active={isUnderline} title="Underline · ⌘U" onclick={() => run(GenericFormatingEditorCommands.underline)}>
      <span style="text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:3px">U</span>
    </button>

    <span class="ft-sep"></span>

    <!-- Clear formatting -->
    <button class="ft-btn" title="Clear formatting · ⌘\" onclick={() => run(GenericFormatingEditorCommands.clearFormatting)}>
      <i class="ph-light ph-text-strikethrough" style="font-size:14px"></i>
    </button>
  </div>

  <!-- ── Row 2: Alignment + Lists + Heading ────────────────────────── -->
  <div class="ft-row">
    <button class="ft-btn" class:active={isAlignLeft} title="Align left · ⌘⇧L" onclick={() => run(GenericFormatingEditorCommands.alignLeft)}>
      <i class="ph-light ph-text-align-left" style="font-size:14px"></i>
    </button>
    <button class="ft-btn" class:active={isAlignCenter} title="Align center · ⌘⇧E" onclick={() => run(GenericFormatingEditorCommands.alignCenter)}>
      <i class="ph-light ph-text-align-center" style="font-size:14px"></i>
    </button>
    <button class="ft-btn" class:active={isAlignRight} title="Align right · ⌘⇧R" onclick={() => run(GenericFormatingEditorCommands.alignRight)}>
      <i class="ph-light ph-text-align-right" style="font-size:14px"></i>
    </button>
    <button class="ft-btn" class:active={isAlignJustify} title="Justify · ⌘⇧J" onclick={() => run(GenericFormatingEditorCommands.alignJustify)}>
      <i class="ph-light ph-text-align-justify" style="font-size:14px"></i>
    </button>

    <span class="ft-sep"></span>

    <button class="ft-btn" class:active={isBullet} title="Bullet list" onclick={() => run(GenericFormatingEditorCommands.bulletList)}>
      <i class="ph-light ph-list-bullets" style="font-size:14px"></i>
    </button>
    <button class="ft-btn" class:active={isNumber} title="Numbered list" onclick={() => run(GenericFormatingEditorCommands.orderedList)}>
      <i class="ph-light ph-list-numbers" style="font-size:14px"></i>
    </button>
    <button class="ft-btn" title="Indent" onclick={() => run(GenericFormatingEditorCommands.indent)}>
      <i class="ph-light ph-text-indent" style="font-size:14px"></i>
    </button>
    <button class="ft-btn" title="Outdent" onclick={() => run(GenericFormatingEditorCommands.outdent)}>
      <i class="ph-light ph-text-outdent" style="font-size:14px"></i>
    </button>

    <span class="ft-sep"></span>

    <!-- Heading dropdown -->
    <div style="position:relative; margin-left:auto">
      <button
        class="ft-chip ft-heading"
        onclick={() => headingDropdownOpen = !headingDropdownOpen}
        onmousedown={(e) => e.preventDefault()}
      >
        <span class="ft-lbl">{headingLabel}</span>
        <span class="ft-chev">▾</span>
      </button>
      {#if headingDropdownOpen}
        <div class="ft-dropdown ft-heading-drop">
          {#each HEADING_PRESETS as preset}
            <button
              class="ft-drop-item"
              onmousedown={(e) => { e.preventDefault(); run(preset.command); headingDropdownOpen = false }}
            >{preset.label}</button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- ── Row 3: Smart actions ───────────────────────────────────────── -->
  <div class="ft-row ft-smart">
    <button
      class="ft-fab ft-ai"
            title="AI"
      onclick={() => invokeSmart('GenerateWithAI')}
    >
      <i class="ph-light ph-magic-wand"></i>
      <span>AI</span>
    </button>

    <button
      class="ft-fab ft-var"
            title="Variable"
      onclick={() => invokeSmart('VariableSelect')}
    >
      <i class="ph-light ph-brackets-curly"></i>
      <span>Variable</span>
    </button>

    <button
      class="ft-fab ft-protect"
            title="Protect"
      onclick={() => invokeSmart('SecuredContent')}
    >
      <i class="ph-light ph-shield-check"></i>
      <span>Protect</span>
    </button>

    <button
      class="ft-fab ft-inspect"
      title="Inspect"
      onclick={() => invokeSmart('TextSearch')}
    >
      <i class="ph-light ph-magnifying-glass"></i>
      <span>Inspect</span>
    </button>
  </div>
</div>
{/if}

<style>
  /* ── Container ────────────────────────────────────────────────────── */
  .float-tb {
    position: fixed;
    z-index: 100;
    background: var(--bg-3, #fff);
    border: 1px solid var(--line-2, rgba(28,29,26,.14));
    border-radius: 10px;
    box-shadow:
      0 8px 24px rgba(0,0,0,.13),
      0 2px 6px rgba(0,0,0,.07),
      inset 0 1px 0 rgba(255,255,255,.5);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: ft-in 120ms ease-out;
    pointer-events: auto;
    user-select: none;
    -webkit-user-select: none;
  }

  @keyframes ft-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Rows ─────────────────────────────────────────────────────────── */
  .ft-row {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 32px;
  }

  .ft-smart {
    height: 40px;
    gap: 0;
    border-top: 1px solid var(--line-2, rgba(28,29,26,.12));
    padding-top: 6px;
    margin-top: 2px;
  }

  /* ── Separator ────────────────────────────────────────────────────── */
  .ft-sep {
    display: inline-block;
    width: 1px;
    height: 16px;
    background: var(--line-2, rgba(28,29,26,.12));
    margin: 0 4px;
    flex-shrink: 0;
  }

  /* ── Icon buttons ─────────────────────────────────────────────────── */
  .ft-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--fg-2, #4a4f5b);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: background 80ms, color 80ms, transform 80ms;
    flex-shrink: 0;
    padding: 0;
  }

  .ft-btn:hover {
    background: var(--bg-4, rgba(28,29,26,.06));
    color: var(--fg-1, #1a1d23);
  }

  .ft-btn.active {
    background: var(--bg-4, rgba(28,29,26,.06));
    box-shadow: inset 0 0 0 1px var(--line-3, rgba(28,29,26,.14));
    color: var(--fg-1, #1a1d23);
  }

  .ft-btn:active {
    transform: scale(.94);
  }

  /* ── Chips (font, size, heading) ──────────────────────────────────── */
  .ft-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 10px;
    background: var(--bg-4, rgba(28,29,26,.04));
    border: 1px solid var(--line-2, rgba(28,29,26,.10));
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: var(--fg-2, #4a4f5b);
    white-space: nowrap;
    transition: background 80ms;
    flex-shrink: 0;
  }

  .ft-chip:hover { background: var(--bg-3, rgba(28,29,26,.08)); }

  .ft-font { width: 148px; }
  .ft-size { width: 58px; padding: 0 8px; }
  .ft-heading { min-width: 70px; }

  .ft-glyph {
    font-family: 'Times New Roman', serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-1, #1a1d23);
    flex-shrink: 0;
  }

  .ft-lbl {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    font-size: 12px;
  }

  .ft-chev {
    font-size: 8px;
    color: var(--fg-3, #8a8f9b);
    flex-shrink: 0;
    margin-left: 2px;
  }

  /* ── Size chip input ──────────────────────────────────────────────── */
  .ft-size-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    height: 100%;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    color: inherit;
  }

  .ft-size-input {
    width: 100%;
    height: 100%;
    background: none;
    border: none;
    outline: none;
    font-size: 12px;
    color: var(--fg-1, #1a1d23);
    text-align: center;
    padding: 0;
  }

  /* ── Dropdowns ─────────────────────────────────────────────────────── */
  .ft-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    background: var(--bg-3, #fff);
    border: 1px solid var(--line-2, rgba(28,29,26,.12));
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.07);
    padding: 4px;
    z-index: 101;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 60px;
  }

  .ft-size-drop { right: 0; left: auto; }
  .ft-heading-drop { right: 0; left: auto; min-width: 110px; }

  .ft-drop-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 4px 10px;
    border: none;
    background: none;
    font-size: 12px;
    color: var(--fg-2, #4a4f5b);
    cursor: pointer;
    border-radius: 5px;
    text-align: left;
    transition: background 60ms;
  }

  .ft-drop-item:hover { background: var(--bg-4, rgba(28,29,26,.06)); color: var(--fg-1, #1a1d23); }
  .ft-drop-item.active { color: var(--accent, #059669); font-weight: 600; }

  /* ── Smart action FABs ─────────────────────────────────────────────── */
  .ft-fab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    flex: 1;
    height: 100%;
    padding: 4px 6px;
    border: none;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    transition: background 80ms, opacity 80ms;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .ft-fab i { font-size: 16px; line-height: 1; }
  .ft-fab span { font-size: 9px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--fg-3, #8a8f9b); }
  .ft-fab:hover { background: var(--bg-4, rgba(28,29,26,.06)); }
  .ft-fab:active { transform: scale(.95); }
  .ft-fab.dimmed { opacity: .4; pointer-events: none; }

  /* AI – violet */
  .ft-ai i { color: var(--accent-2, #7c3aed); }
  .ft-ai:hover { background: rgba(124,58,237,.08); }
  .ft-ai span { color: var(--accent-2, #7c3aed); }

  /* Variable – green */
  .ft-var i { color: var(--accent, #059669); }
  .ft-var:hover { background: var(--accent-subtle, rgba(5,150,105,.08)); }
  .ft-var span { color: var(--accent, #059669); }

  /* Protect – amber */
  .ft-protect i { color: var(--amber, #f59e0b); }
  .ft-protect:hover { background: rgba(245,158,11,.08); }
  .ft-protect span { color: var(--amber, #f59e0b); }

  /* Inspect – neutral */
  .ft-inspect i { color: var(--fg-2, #4a4f5b); }
  .ft-inspect span { color: var(--fg-3, #8a8f9b); }
</style>
