<script lang="ts">
  import { computePosition, flip, shift, offset } from '@floating-ui/dom'
  import { get } from 'svelte/store'
  import type { Editor } from '@tiptap/core'
  import { NodeSelection } from 'prosemirror-state'
  import { listMarkerSelectionKey } from '../../../../extensions/tiptap/CustomListStyleExtension/CustomListStyleExtension'
  import ContextMenuRow from './ContextMenuRow.svelte'
  import type { ContextMenuItem } from '../utils/utils'
  import { _ as base_ } from 'svelte-i18n'
  import {
    GenericFormatingEditorCommands,
    GenericFormattingComponentMap
  } from '../../actions/formatting'
  import {
    exportSelectionToFile,
    exportTablesToFile
  } from '../../../../services/export/editorExport.service'
  import { _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { openTextInputModal } from '../../../../stores/textInputModal.store'
  import { onDestroy, onMount } from 'svelte'
  import { fluentUIcons } from '../../icons/Icons'

  type InternalContextMenuItem = ContextMenuItem & {
    hidden?: boolean
  }

  type EditorContext = {
    hasEditor: boolean
    hasSelection: boolean
    selectionText: string
    inTable: boolean
    inHeading: boolean
    headingLevel: number | null
    inParagraph: boolean
    inBulletList: boolean
    inOrderedList: boolean
    inTaskList: boolean
    inLink: boolean
    inCode: boolean
    inCodeBlock: boolean
    inBlockquote: boolean
    listItemSelected: boolean
  }

  // --- Props ---
  let {
    __x = 0,
    __y = 0,
    __show = $bindable(false),
    __menuItems = [],
    __menuRef = $bindable<HTMLElement | null>(null)
  } = $props<{
    __x: number
    __y: number
    __show: boolean
    __menuItems: ContextMenuItem[]
    __menuRef?: HTMLElement | null
  }>()

  let menuEl = $state<HTMLElement | null>(null)
  let scrollEl = $state<HTMLElement | null>(null)
  let canScrollUp = $state(false)
  let canScrollDown = $state(false)
  let activeEditor = $state<Editor | null>(null)
  let unsubscribeActiveEditor: (() => void) | null = null
  let detachEditorListeners: (() => void) | null = null

  let editorContext = $state<EditorContext>({
    hasEditor: false,
    hasSelection: false,
    selectionText: '',
    inTable: false,
    inHeading: false,
    headingLevel: null,
    inParagraph: false,
    inBulletList: false,
    inOrderedList: false,
    inTaskList: false,
    inLink: false,
    inCode: false,
    inCodeBlock: false,
    inBlockquote: false,
    listItemSelected: false
  })

  let computedFallbackMenu = $state<InternalContextMenuItem[]>([])
  const t = (key: string) => get(base_)(key)

  const usingExternalMenu = $derived(Array.isArray(__menuItems) && __menuItems.length > 0)
  const rawMenuItems = $derived(
    usingExternalMenu ? (__menuItems as InternalContextMenuItem[]) : computedFallbackMenu
  )
  const visibleMenuItems = $derived(pruneHiddenMenuItems(rawMenuItems))

  // Position logic
  $effect(() => {
    if (__show && menuEl) {
      updateMenuPosition()
      requestAnimationFrame(() => updateScrollState())
    }
  })

  $effect(() => {
    if (menuEl) {
      __menuRef = menuEl
    }
  })

  $effect(() => {
    if (!usingExternalMenu) {
      computedFallbackMenu = buildEditorContextMenu(editorContext)
    }
  })

  function resolveComponentAction(
    key: keyof typeof GenericFormattingComponentMap
  ): (() => void) | undefined {
    const source = GenericFormattingComponentMap[key]
    if (!source) return undefined
    const props = typeof source.props === 'function' ? source.props({}) : source.props
    return props?.__onClick as (() => void) | undefined
  }

  function run(action: () => unknown) {
    try {
      action()
    } catch (error) {
      console.error('[ContextMenuWidget] action failed', error)
    }
  }

  const runCommand = (
    name: keyof typeof GenericFormatingEditorCommands,
    fallback?: () => unknown
  ) => {
    const fn = (GenericFormatingEditorCommands as any)?.[name]
    if (typeof fn === 'function') return fn()
    return fallback?.()
  }

  function can(check: (editor: Editor) => boolean): boolean {
    if (!activeEditor) return false
    try {
      return Boolean(check(activeEditor))
    } catch {
      return false
    }
  }

  function detectHeadingLevel(editor: Editor): number | null {
    for (let level = 1; level <= 6; level += 1) {
      if (editor.isActive('heading', { level })) return level
    }
    return null
  }

  function updateEditorContext(editor: Editor | null) {
    if (!editor) {
      editorContext = {
        hasEditor: false,
        hasSelection: false,
        selectionText: '',
        inTable: false,
        inHeading: false,
        headingLevel: null,
        inParagraph: false,
        inBulletList: false,
        inOrderedList: false,
        inTaskList: false,
        inLink: false,
        inCode: false,
        inCodeBlock: false,
        inBlockquote: false,
        listItemSelected: false
      }
      return
    }

    const { from, to, empty } = editor.state.selection
    const markerSelection =
      editor.state.selection instanceof NodeSelection &&
      editor.state.selection.node?.type?.name === 'listItem'
    const listMarkerState = listMarkerSelectionKey.getState(editor.state)
    const listItemSelected = markerSelection || listMarkerState?.listPos != null
    const text = empty ? '' : editor.state.doc.textBetween(from, to, ' ', ' ').trim()
    const headingLevel = detectHeadingLevel(editor)

    editorContext = {
      hasEditor: true,
      hasSelection: !empty,
      selectionText: text,
      inTable:
        editor.isActive('table') || editor.isActive('tableRow') || editor.isActive('tableCell'),
      inHeading: headingLevel !== null,
      headingLevel,
      inParagraph: editor.isActive('paragraph'),
      inBulletList: editor.isActive('bulletList'),
      inOrderedList: editor.isActive('orderedList'),
      inTaskList: editor.isActive('taskList'),
      inLink: editor.isActive('link'),
      inCode: editor.isActive('code'),
      inCodeBlock: editor.isActive('codeBlock'),
      inBlockquote: editor.isActive('blockquote'),
      listItemSelected
    }
  }

  function bindEditor(editor: Editor | null) {
    if (detachEditorListeners) {
      detachEditorListeners()
      detachEditorListeners = null
    }
    activeEditor = editor

    if (!editor) {
      updateEditorContext(null)
      return
    }

    const sync = () => updateEditorContext(editor)
    editor.on('selectionUpdate', sync)
    editor.on('focus', sync)
    editor.on('blur', sync)
    editor.on('transaction', sync)
    sync()

    detachEditorListeners = () => {
      editor.off('selectionUpdate', sync)
      editor.off('focus', sync)
      editor.off('blur', sync)
      editor.off('transaction', sync)
    }
  }

  function pasteFromClipboardAsText() {
    run(() => GenericFormatingEditorCommands.pasteAsText())
  }

  function pruneHiddenMenuItems(items: InternalContextMenuItem[]): ContextMenuItem[] {
    const result: ContextMenuItem[] = []

    for (const item of items || []) {
      if (item?.hidden) continue

      let children: ContextMenuItem[] | undefined = undefined
      if (item.children?.length) {
        children = pruneHiddenMenuItems(item.children as InternalContextMenuItem[])
      }

      // Drop empty submenu containers.
      if (item.children && (!children || children.length === 0)) continue

      result.push({
        ...item,
        children
      })
    }

    return result
  }

  function updateScrollState() {
    if (!scrollEl) {
      canScrollUp = false
      canScrollDown = false
      return
    }
    const { scrollTop, scrollHeight, clientHeight } = scrollEl
    canScrollUp = scrollTop > 4
    canScrollDown = scrollTop + clientHeight < scrollHeight - 4
  }

  function scrollMenuBy(delta: number) {
    if (!scrollEl) return
    scrollEl.scrollBy({ top: delta, behavior: 'smooth' })
  }

  function buildEditorContextMenu(ctx: EditorContext): InternalContextMenuItem[] {
    const insertLinkAction = resolveComponentAction('HyperlinkSelect')
    const aiAction = resolveComponentAction('GenerateWithAI')
    const secureAction = resolveComponentAction('SecuredContent')
    const variableAction = resolveComponentAction('VariableSelect')
    const commentAction = resolveComponentAction('CommentSelect')
    const insertSpreadsheetAction = resolveComponentAction('WorksheetSelect')
    const insertSlideAction = resolveComponentAction('SlideSelect')
    const insertDesignAction = resolveComponentAction('DesignSelect')

    const inAnyList =
      ctx.inBulletList || ctx.inOrderedList || ctx.inTaskList || ctx.listItemSelected

    return [
      // GROUP 0: QUICK BAR
      {
        icon: 'ph-bold ph-text-bolder',
        label: 'Bold',
        action: () => run(() => activeEditor?.chain().focus().toggleBold().run()),
        group: 0,
        inline: true,
        disabled:
          !ctx.hasEditor ||
          !can((e) => e.can().chain().focus().toggleBold().run()) ||
          ctx.inCodeBlock
      },
      {
        icon: 'ph-bold ph-text-italic',
        label: 'Italic',
        action: () => run(() => activeEditor?.chain().focus().toggleItalic().run()),
        group: 0,
        inline: true,
        disabled:
          !ctx.hasEditor ||
          !can((e) => e.can().chain().focus().toggleItalic().run()) ||
          ctx.inCodeBlock
      },
      {
        icon: 'ph-bold ph-text-underline',
        label: 'Underline',
        action: () => run(() => activeEditor?.chain().focus().toggleUnderline().run()),
        group: 0,
        inline: true,
        disabled:
          !ctx.hasEditor ||
          !can((e) => e.can().chain().focus().toggleUnderline().run()) ||
          ctx.inCodeBlock
      },
      {
        icon: 'ph-bold ph-list-bullets',
        label: 'Bullets',
        action: () => run(() => activeEditor?.chain().focus().toggleBulletList().run()),
        group: 0,
        inline: true,
        disabled: !ctx.hasEditor || ctx.inCodeBlock
      },
      {
        icon: ctx.inLink ? 'ph-bold ph-link-break' : 'ph-bold ph-link',
        label: ctx.inLink ? 'Remove Link' : 'Add Link',
        action: () =>
          run(() => {
            if (ctx.inLink) {
              activeEditor?.chain().focus().unsetLink().run()
              return
            }
            insertLinkAction?.()
          }),
        group: 0,
        inline: true,
        disabled: !ctx.hasEditor || (!ctx.inLink && !ctx.hasSelection)
      },

      // GROUP 1.2: EXPORT
      {
        icon: 'ph-bold ph-export',
        label: 'Export Selection',
        group: 1.2,
        hidden: !ctx.hasSelection,
        children: [
          {
            icon: 'ph-bold ph-code',
            label: 'HTML',
            action: () => run(() => exportSelectionToFile({ format: 'html' }))
          },
          {
            icon: 'ph-bold ph-text-aa',
            label: 'Markdown',
            action: () => run(() => exportSelectionToFile({ format: 'markdown' }))
          },
          {
            icon: 'ph-bold ph-file-text',
            label: 'Text',
            action: () => run(() => exportSelectionToFile({ format: 'txt' }))
          }
        ]
      },
      {
        icon: 'ph-bold ph-table',
        label: 'Export Tables',
        group: 1.2,
        hidden: !ctx.inTable,
        children: [
          {
            icon: 'ph-bold ph-file-csv',
            label: 'CSV',
            action: () => run(() => exportTablesToFile({ format: 'csv', scope: 'all' }))
          },
          {
            icon: 'ph-bold ph-code',
            label: 'HTML',
            action: () => run(() => exportTablesToFile({ format: 'html', scope: 'all' }))
          },
          {
            icon: 'ph-bold ph-text-aa',
            label: 'Markdown',
            action: () => run(() => exportTablesToFile({ format: 'markdown', scope: 'all' }))
          }
        ]
      },

      // GROUP 0.8: INSERT (ONLY WHEN NO TEXT SELECTION)
      {
        icon: 'ph-bold ph-plus-circle',
        label: 'Insert',
        group: 0.8,
        hidden: ctx.hasSelection,
        children: [
          {
            icon: 'ph-light ph-brackets-curly',
            label: 'Variable',
            action: () => runCommand('insertVariable', () => variableAction?.())
          },
          {
            icon: 'ph-bold ph-table',
            label: 'Spreadsheet',
            action: () => runCommand('insertSpreadsheet', () => insertSpreadsheetAction?.())
          },
          {
            icon: 'ph-bold ph-slideshow',
            label: 'Slide',
            action: () => runCommand('insertSlide', () => insertSlideAction?.())
            // action: () => run(() => insertSlideAction?.())
          },
          {
            icon: 'ph-bold ph-pen-nib',
            label: 'Design Canvas',
            action: () => runCommand('insertDesign', () => insertDesignAction?.())
          },
          {
            iconHtml: fluentUIcons.fluentUIconSurvey,
            label: 'Form',
            color: 'text-red-600',
            action: () => runCommand('insertSurvey', () => {})
          },
          {
            icon: 'ph-light ph-brackets-angle',
            label: 'Code Block',
            action: () => runCommand('insertMonacoCodeBlock', () => {})
          }
        ]
      },

      // GROUP 0.5: DIRECT LIST ACTIONS (ONLY WHEN MARKER SELECTED)
      {
        icon: 'ph-bold ph-list-numbers',
        label: 'Continue Numbering',
        group: 0.5,
        hidden: !ctx.listItemSelected,
        action: () => run(() => GenericFormatingEditorCommands.continueOrderedList()),
        disabled: !ctx.inOrderedList
      },
      {
        icon: 'ph-bold ph-arrow-counter-clockwise',
        label: 'Restart Numbering',
        group: 0.5,
        hidden: !ctx.listItemSelected,
        action: () => run(() => GenericFormatingEditorCommands.restartOrderedList()),
        disabled: !ctx.inOrderedList
      },
      {
        icon: 'ph-bold ph-arrow-line-down',
        label: 'Continue from Previous List',
        group: 0.5,
        hidden: !ctx.listItemSelected,
        action: () => run(() => GenericFormatingEditorCommands.continueOrderedListFromPrevious()),
        disabled: !ctx.inOrderedList
      },
      {
        icon: 'ph-bold ph-hash',
        label: 'Set Numbering Value...',
        group: 0.5,
        hidden: !ctx.listItemSelected,
        action: () =>
          run(async () => {
            const value = await openTextInputModal({
              title: t('Start at'),
              message: t('Enter the starting number'),
              placeholder: '1',
              confirmText: t('Apply')
            })
            const parsed = Number.parseInt((value || '').toString(), 10)
            if (Number.isFinite(parsed)) {
              GenericFormatingEditorCommands.setOrderedListStart(parsed)
            }
          }),
        disabled: !ctx.inOrderedList
      },
      {
        icon: 'ph-bold ph-paint-brush',
        label: 'Format Bullet/Number',
        group: 0.5,
        hidden: !ctx.listItemSelected,
        children: [
          {
            icon: 'ph-bold ph-text-aa',
            label: 'Match Text Style',
            action: () => run(() => GenericFormatingEditorCommands.setListMarkerMatchContent(true))
          },
          {
            icon: 'ph-bold ph-paint-brush',
            label: 'Marker Color...',
            action: () =>
              run(async () => {
                const color = await openTextInputModal({
                  title: t('Marker color'),
                  message: t('Enter a color (hex or name)'),
                  placeholder: '#2d6cff',
                  confirmText: t('Apply')
                })
                if (color) {
                  GenericFormatingEditorCommands.setListMarkerColor(color.toString())
                }
              })
          },
          {
            icon: 'ph-bold ph-text-aa',
            label: 'Marker Size...',
            action: () =>
              run(async () => {
                const size = await openTextInputModal({
                  title: t('Marker size'),
                  message: t('Enter size (e.g. 14px, 0.9em)'),
                  placeholder: '1em',
                  confirmText: t('Apply')
                })
                if (size) {
                  GenericFormatingEditorCommands.setListMarkerSize(size.toString())
                }
              })
          },
          {
            icon: 'ph-bold ph-bold',
            label: 'Marker Weight',
            children: [
              {
                icon: 'ph-bold ph-bold',
                label: 'Bold',
                action: () => run(() => GenericFormatingEditorCommands.setListMarkerWeight('700'))
              },
              {
                icon: 'ph-bold ph-text-aa',
                label: 'Normal',
                action: () => run(() => GenericFormatingEditorCommands.setListMarkerWeight('400'))
              }
            ]
          },
          {
            icon: 'ph-bold ph-eraser',
            label: 'Reset Marker Style',
            action: () => run(() => GenericFormatingEditorCommands.clearListMarkerStyle())
          }
        ]
      },
      {
        icon: 'ph-bold ph-arrow-u-up-left',
        label: 'Outdent',
        group: 0.5,
        hidden: !ctx.listItemSelected,
        action: () => run(() => GenericFormatingEditorCommands.outdent()),
        disabled: ctx.inCodeBlock
      },
      {
        icon: 'ph-bold ph-arrow-u-up-right',
        label: 'Indent',
        group: 0.5,
        hidden: !ctx.listItemSelected,
        action: () => run(() => GenericFormatingEditorCommands.indent()),
        disabled: ctx.inCodeBlock
      },

      // GROUP 1: CLIPBOARD / BASIC EDIT
      {
        icon: 'ph-bold ph-copy',
        label: 'Copy',
        shortcut: '⌘C',
        group: 1,
        action: () => run(() => GenericFormatingEditorCommands.copy()),
        disabled: !ctx.hasSelection
      },
      {
        icon: 'ph-bold ph-copy',
        label: t('Copy as Text'),
        shortcut: '⇧⌘C',
        group: 1,
        action: () => run(() => GenericFormatingEditorCommands.copyAsText()),
        disabled: !ctx.hasSelection
      },
      {
        icon: 'ph-bold ph-scissors',
        label: 'Cut',
        shortcut: '⌘X',
        group: 1,
        action: () => run(() => GenericFormatingEditorCommands.cut()),
        disabled: !ctx.hasSelection || ctx.inCodeBlock
      },
      {
        icon: 'ph-bold ph-clipboard-text',
        label: 'Paste',
        shortcut: '⌘V',
        group: 1,
        children: [
          {
            icon: 'ph-bold ph-clipboard-text',
            label: 'Keep Source Formatting',
            shortcut: '⌘V',
            group: 1,
            action: () => run(() => GenericFormatingEditorCommands.paste())
          },
          {
            icon: 'ph-bold ph-text-aa',
            label: 'Paste as Plain Text',
            shortcut: '⇧⌘V',
            group: 1,
            action: () => run(() => pasteFromClipboardAsText())
          },
          {
            icon: 'ph-bold ph-link-simple',
            label: 'Paste as Reference',
            shortcut: 'Ctrl+Alt+R',
            group: 1,
            action: () => run(() => GenericFormatingEditorCommands.pasteAsReference())
          }
        ]
      },
      {
        icon: 'ph-bold ph-trash',
        label: 'Delete Selection',
        shortcut: '⌫',
        group: 1,
        action: () => run(() => activeEditor?.chain().focus().deleteSelection().run()),
        disabled: !ctx.hasSelection
      },
      {
        icon: 'ph-bold ph-link',
        label: 'Include/Append',
        // label: 'Insert from File',
        group: 1.2,
        disabled: !ctx.hasEditor,
        children: [
          {
            icon: 'ph-bold ph-link',
            label: 'Add from document',
            shortcut: 'Ctrl+Alt+D',
            action: () => run(() => GenericFormatingEditorCommands.includeFileFromDocument())
          },
          {
            icon: 'ph-bold ph-link',
            label: 'Include File (Sync)',
            shortcut: 'Ctrl+Alt+I',
            action: () => run(() => GenericFormatingEditorCommands.includeFile())
          },
          {
            icon: 'ph-bold ph-article',
            label: 'Append File (Static)',
            shortcut: 'Ctrl+Alt+A',
            action: () => run(() => GenericFormatingEditorCommands.appendFile())
          },
          {
            icon: 'ph-bold ph-link-simple',
            label: 'Include From Clipboard',
            shortcut: 'Ctrl+Alt+Shift+I',
            action: () => run(() => GenericFormatingEditorCommands.includeFileFromClipboard())
          },
          {
            icon: 'ph-bold ph-clipboard-text',
            label: 'Append From Clipboard',
            shortcut: 'Ctrl+Alt+Shift+A',
            action: () => run(() => GenericFormatingEditorCommands.appendFileFromClipboard())
          }
        ]
      },

      // GROUP 2: TEXT / PARAGRAPH / LIST / HEADING
      {
        icon: 'ph-bold ph-text-align-left',
        label: 'Paragraph',
        group: 2,
        disabled: !ctx.hasEditor,
        children: [
          {
            icon: 'ph-bold ph-text-align-left',
            label: 'Align Left',
            action: () => run(() => GenericFormatingEditorCommands.alignLeft()),
            active: !!activeEditor?.isActive({ textAlign: 'left' }),
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-text-align-center',
            label: 'Align Center',
            action: () => run(() => GenericFormatingEditorCommands.alignCenter()),
            active: !!activeEditor?.isActive({ textAlign: 'center' }),
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-text-align-right',
            label: 'Align Right',
            action: () => run(() => GenericFormatingEditorCommands.alignRight()),
            active: !!activeEditor?.isActive({ textAlign: 'right' }),
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-text-align-justify',
            label: 'Justify',
            action: () => run(() => GenericFormatingEditorCommands.alignJustify()),
            active: !!activeEditor?.isActive({ textAlign: 'justify' }),
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-text-indent',
            label: 'Increase Indent',
            action: () => run(() => GenericFormatingEditorCommands.indent()),
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-text-outdent',
            label: 'Decrease Indent',
            action: () => run(() => GenericFormatingEditorCommands.outdent()),
            disabled: ctx.inCodeBlock
          }
        ]
      },
      {
        icon: 'ph-bold ph-list-checks',
        label: 'List',
        group: 2,
        hidden: !ctx.inParagraph && !inAnyList,
        children: [
          {
            icon: 'ph-bold ph-list-bullets',
            label: 'Bulleted List',
            action: () => run(() => GenericFormatingEditorCommands.bulletList()),
            active: ctx.inBulletList,
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-list-numbers',
            label: 'Numbered List',
            action: () => run(() => GenericFormatingEditorCommands.orderedList()),
            active: ctx.inOrderedList,
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-list-checks',
            label: 'Checklist',
            action: () => run(() => GenericFormatingEditorCommands.taskList()),
            active: ctx.inTaskList,
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-rows',
            label: 'Bullet Style',
            hidden: !ctx.inBulletList,
            children: [
              {
                icon: 'ph-bold ph-list-bullets',
                label: 'Disc',
                action: () =>
                  run(() => GenericFormatingEditorCommands.setBulletListStyle('disc', 'default'))
              },
              {
                icon: 'ph-bold ph-list-bullets',
                label: 'Circle',
                action: () =>
                  run(() => GenericFormatingEditorCommands.setBulletListStyle('circle', 'default'))
              },
              {
                icon: 'ph-bold ph-list-bullets',
                label: 'Square',
                action: () =>
                  run(() => GenericFormatingEditorCommands.setBulletListStyle('square', 'default'))
              },
              {
                icon: 'ph-bold ph-list-bullets',
                label: 'Tree (Multilevel)',
                action: () =>
                  run(() => GenericFormatingEditorCommands.setBulletListStyle('disc', 'tree'))
              }
            ]
          },
          {
            icon: 'ph-bold ph-list-numbers',
            label: 'Numbering Style',
            hidden: !ctx.inOrderedList,
            children: [
              {
                icon: 'ph-bold ph-list-numbers',
                label: '1, 2, 3',
                action: () =>
                  run(() =>
                    GenericFormatingEditorCommands.setOrderedListStyle('decimal', 'decimal')
                  )
              },
              {
                icon: 'ph-bold ph-list-numbers',
                label: 'A, B, C',
                action: () =>
                  run(() =>
                    GenericFormatingEditorCommands.setOrderedListStyle('upper-alpha', 'default')
                  )
              },
              {
                icon: 'ph-bold ph-list-numbers',
                label: 'I, II, III',
                action: () =>
                  run(() =>
                    GenericFormatingEditorCommands.setOrderedListStyle('upper-roman', 'default')
                  )
              },
              {
                icon: 'ph-bold ph-list-numbers',
                label: 'Legal (1.1.1)',
                action: () =>
                  run(() => GenericFormatingEditorCommands.setOrderedListStyle('decimal', 'legal'))
              },
              {
                icon: 'ph-bold ph-list-numbers',
                label: 'Outline',
                action: () =>
                  run(() =>
                    GenericFormatingEditorCommands.setOrderedListStyle('upper-roman', 'outline')
                  )
              }
            ]
          },
          {
            icon: 'ph-bold ph-arrow-counter-clockwise',
            label: 'Restart Numbering',
            action: () => run(() => GenericFormatingEditorCommands.restartOrderedList()),
            hidden: !ctx.inOrderedList
          },
          {
            icon: 'ph-bold ph-arrows-counter-clockwise',
            label: 'Continue Numbering',
            action: () => run(() => GenericFormatingEditorCommands.continueOrderedList()),
            hidden: !ctx.inOrderedList
          },
          {
            icon: 'ph-bold ph-arrow-line-down',
            label: 'Continue from Previous List',
            action: () =>
              run(() => GenericFormatingEditorCommands.continueOrderedListFromPrevious()),
            hidden: !ctx.inOrderedList && !ctx.inParagraph
          },
          {
            icon: 'ph-bold ph-hash',
            label: 'Start at...',
            hidden: !ctx.inOrderedList,
            action: () =>
              run(async () => {
                const value = await openTextInputModal({
                  title: t('Start at'),
                  message: t('Enter the starting number'),
                  placeholder: '1',
                  confirmText: t('Apply')
                })
                const parsed = Number.parseInt((value || '').toString(), 10)
                if (Number.isFinite(parsed)) {
                  GenericFormatingEditorCommands.setOrderedListStart(parsed)
                }
              })
          },
          {
            icon: 'ph-bold ph-paint-brush',
            label: 'Format Bullet/Number',
            hidden: !inAnyList,
            children: [
              {
                icon: 'ph-bold ph-text-aa',
                label: 'Match Text Style',
                action: () =>
                  run(() => GenericFormatingEditorCommands.setListMarkerMatchContent(true))
              },
              {
                icon: 'ph-bold ph-paint-brush',
                label: 'Marker Color...',
                action: () =>
                  run(async () => {
                    const color = await openTextInputModal({
                      title: t('Marker color'),
                      message: t('Enter a color (hex or name)'),
                      placeholder: '#2d6cff',
                      confirmText: t('Apply')
                    })
                    if (color) {
                      GenericFormatingEditorCommands.setListMarkerColor(color.toString())
                    }
                  })
              },
              {
                icon: 'ph-bold ph-text-aa',
                label: 'Marker Size...',
                action: () =>
                  run(async () => {
                    const size = await openTextInputModal({
                      title: t('Marker size'),
                      message: t('Enter size (e.g. 14px, 0.9em)'),
                      placeholder: '1em',
                      confirmText: t('Apply')
                    })
                    if (size) {
                      GenericFormatingEditorCommands.setListMarkerSize(size.toString())
                    }
                  })
              },
              {
                icon: 'ph-bold ph-bold',
                label: 'Marker Weight',
                children: [
                  {
                    icon: 'ph-bold ph-bold',
                    label: 'Bold',
                    action: () =>
                      run(() => GenericFormatingEditorCommands.setListMarkerWeight('700'))
                  },
                  {
                    icon: 'ph-bold ph-text-aa',
                    label: 'Normal',
                    action: () =>
                      run(() => GenericFormatingEditorCommands.setListMarkerWeight('400'))
                  }
                ]
              },
              {
                icon: 'ph-bold ph-eraser',
                label: 'Reset Marker Style',
                action: () => run(() => GenericFormatingEditorCommands.clearListMarkerStyle())
              }
            ]
          },
          {
            icon: 'ph-bold ph-arrow-u-up-left',
            label: 'Outdent',
            action: () => run(() => GenericFormatingEditorCommands.outdent()),
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-arrow-u-up-right',
            label: 'Indent',
            action: () => run(() => GenericFormatingEditorCommands.indent()),
            disabled: ctx.inCodeBlock
          }
        ]
      },
      {
        icon: 'ph-bold ph-text-h',
        label: 'Heading',
        group: 2,
        hidden: !ctx.inHeading && !ctx.inParagraph,
        children: [
          {
            icon: 'ph-bold ph-text-h-one',
            label: 'Heading 1',
            action: () =>
              run(() => activeEditor?.chain().focus().toggleHeading({ level: 1 }).run()),
            active: ctx.headingLevel === 1,
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-text-h-two',
            label: 'Heading 2',
            action: () =>
              run(() => activeEditor?.chain().focus().toggleHeading({ level: 2 }).run()),
            active: ctx.headingLevel === 2,
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-text-h-three',
            label: 'Heading 3',
            action: () =>
              run(() => activeEditor?.chain().focus().toggleHeading({ level: 3 }).run()),
            active: ctx.headingLevel === 3,
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-text-t',
            label: 'Normal Text',
            action: () => run(() => activeEditor?.chain().focus().setParagraph().run()),
            active: ctx.inParagraph,
            disabled: ctx.inCodeBlock
          },
          {
            icon: 'ph-bold ph-arrow-fat-up',
            label: 'Promote Heading',
            action: () =>
              run(() => {
                if (!ctx.inHeading || !ctx.headingLevel || ctx.headingLevel <= 1) return
                activeEditor
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: ctx.headingLevel - 1 })
                  .run()
              }),
            disabled: !ctx.inHeading || !ctx.headingLevel || ctx.headingLevel <= 1
          },
          {
            icon: 'ph-bold ph-arrow-fat-down',
            label: 'Demote Heading',
            action: () =>
              run(() => {
                if (!ctx.inHeading || !ctx.headingLevel || ctx.headingLevel >= 6) return
                activeEditor
                  ?.chain()
                  .focus()
                  .toggleHeading({ level: ctx.headingLevel + 1 })
                  .run()
              }),
            disabled: !ctx.inHeading || !ctx.headingLevel || ctx.headingLevel >= 6
          }
        ]
      },

      // GROUP 3: TABLE CONTEXT
      {
        icon: 'ph-bold ph-table',
        label: 'Table',
        group: 3,
        hidden: !ctx.inTable,
        children: [
          {
            icon: 'ph-bold ph-plus',
            label: 'Insert Row Above',
            action: () => run(() => GenericFormatingEditorCommands.addRowBefore()),
            disabled: !can((e) => e.can().chain().focus().addRowBefore().run())
          },
          {
            icon: 'ph-bold ph-minus',
            label: 'Insert Row Below',
            action: () => run(() => GenericFormatingEditorCommands.addRowAfter()),
            disabled: !can((e) => e.can().chain().focus().addRowAfter().run())
          },
          {
            icon: 'ph-bold ph-columns',
            label: 'Insert Column Left',
            action: () => run(() => GenericFormatingEditorCommands.addColumnBefore()),
            disabled: !can((e) => e.can().chain().focus().addColumnBefore().run())
          },
          {
            icon: 'ph-bold ph-columns-plus-left',
            label: 'Insert Column Right',
            action: () => run(() => GenericFormatingEditorCommands.addColumnAfter()),
            disabled: !can((e) => e.can().chain().focus().addColumnAfter().run())
          },
          {
            icon: 'ph-bold ph-cells-merge',
            label: 'Merge Cells',
            action: () => run(() => GenericFormatingEditorCommands.mergeCells()),
            disabled: !can((e) => e.can().chain().focus().mergeCells().run())
          },
          {
            icon: 'ph-bold ph-cells-split',
            label: 'Split Cell',
            action: () => run(() => GenericFormatingEditorCommands.splitCell()),
            disabled: !can((e) => e.can().chain().focus().splitCell().run())
          },
          {
            icon: 'ph-bold ph-trash',
            label: 'Delete Row',
            action: () => run(() => GenericFormatingEditorCommands.deleteRow()),
            disabled: !can((e) => e.can().chain().focus().deleteRow().run())
          },
          {
            icon: 'ph-bold ph-trash',
            label: 'Delete Column',
            action: () => run(() => GenericFormatingEditorCommands.deleteColumn()),
            disabled: !can((e) => e.can().chain().focus().deleteColumn().run())
          },
          {
            icon: 'ph-bold ph-table',
            label: 'Delete Table',
            action: () => run(() => GenericFormatingEditorCommands.deleteTable()),
            disabled: !can((e) => e.can().chain().focus().deleteTable().run())
          }
        ]
      },

      // GROUP 4: LINKS / COMMENTS / INNOVATIVE
      {
        icon: 'ph-bold ph-link',
        label: ctx.inLink ? 'Edit Link' : 'Add Link...',
        shortcut: '⌘K',
        group: 4,
        action: () =>
          run(() => {
            if (ctx.inLink) {
              // open edit flow by reusing insert hyperlink helper from map
              insertLinkAction?.()
              return
            }
            insertLinkAction?.()
          }),
        disabled: !ctx.inLink && !ctx.hasSelection
      },
      {
        icon: 'ph-bold ph-chat-centered-text',
        label: 'New Comment',
        shortcut: '⌘⌥M',
        group: 4,
        action: () => run(() => commentAction?.()),
        disabled: !ctx.hasSelection
      },
      {
        icon: 'ph-light ph-sparkle text-primary',
        label: 'AI Rewrite Selection',
        shortcut: '⌘J',
        group: 4,
        action: () => run(() => aiAction?.()),
        disabled: !ctx.hasSelection || ctx.inCodeBlock
      },
      {
        icon: 'ph-bold ph-brackets-curly',
        label: 'Convert to Variable',
        group: 4,
        action: () => run(() => variableAction?.()),
        disabled: !ctx.hasSelection
      },
      {
        icon: 'ph-bold ph-lock-key',
        label: 'Lock Selection (SDDoc)',
        group: 4,
        action: () => run(() => secureAction?.()),
        disabled: !ctx.hasSelection
      },
      {
        icon: 'ph-bold ph-magnifying-glass',
        label: 'Find / Replace',
        shortcut: '⌘F',
        group: 4,
        action: () => run(() => GenericFormatingEditorCommands.search())
      },
      {
        icon: 'ph-bold ph-translate',
        label: 'Smart Translate',
        group: 4,
        action: () => run(() => resolveComponentAction('TranslateSelect')?.()),
        disabled: !ctx.hasSelection
      }
    ]
  }

  async function updateMenuPositionOld() {
    const virtualEl = {
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        x: __x,
        y: __y,
        top: __y,
        left: __x,
        right: __x,
        bottom: __y
      })
    }

    const { x: finalX, y: finalY } = await computePosition(virtualEl, menuEl!, {
      placement: 'bottom-start',
      middleware: [offset(6), flip(), shift({ padding: 12 })]
    })

    if (menuEl) {
      menuEl.style.left = `${finalX}px`
      menuEl.style.top = `${finalY}px`
    }
  }

  function updateMenuPosition() {
    if (!menuEl) return

    // Create a virtual anchor element representing the mouse coordinates
    const virtualEl = {
      getBoundingClientRect() {
        return {
          width: 0,
          height: 0,
          x: __x,
          y: __y,
          top: __y,
          left: __x,
          right: __x,
          bottom: __y
        }
      }
    }

    computePosition(virtualEl, menuEl, {
      placement: 'bottom-start', // Your default starting strategy position
      middleware: [
        offset(4), // Little buffer clearance spacing away from the mouse pointer tip

        flip({
          // Define fallback strategies when space is highly constrained vertically
          fallbackPlacements: [
            'top-start', // 1st alternative: try top-left first
            'right-start', // 2nd alternative: flip to the right side if height fails entirely
            'left-start', // 3rd alternative: flip to the left side
            'bottom-end' // Final safety net layout
          ],
          boundary: 'clippingAncestors',
          padding: 8 // Keep a small safety margin away from window edges
        }),

        shift({
          padding: 8 // Shift the menu along its axis slightly to stay inside the screen box boundaries
        })
      ]
    }).then(({ x, y }) => {
      if (menuEl) {
        menuEl.style.left = `${x}px`
        menuEl.style.top = `${y}px`
      }
    })
  }

  const close = () => {
    __show = false
  }

  // Svelte Teleport Action
  // This dynamically pulls the element out of its current layout
  // container and drops it right into the body when it mounts.
  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node)
        }
      }
    }
  }

  onMount(() => {
    const activeEditorStore = _$_wysiwygEditorsList.getActive()
    unsubscribeActiveEditor = activeEditorStore.subscribe((entry) => {
      bindEditor(entry?.editor || null)
    })
    bindEditor(get(activeEditorStore)?.editor || null)
  })

  onDestroy(() => {
    unsubscribeActiveEditor?.()
    detachEditorListeners?.()
  })
</script>

<!-- <svelte:window onkeydown={(e) => e.key === 'Escape' && close()} /> -->

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && close()}
  onmousedown={(e) => {
    // Close if clicking outside the menu element
    if (__show && menuEl && !menuEl.contains(e.target as Node)) {
      close()
    }
  }}
/>

{#if __show}
  <!-- This wrapper teleports its entire content to document.body -->
  <div use:portal style="display: contents;">
    <div
      class="fixed inset-0 z-[1000] bg-transparent"
      onclick={close}
      oncontextmenu={(e) => {
        // 1. Close the current menu immediately
        close()

        // 2. DO NOT call e.preventDefault() or e.stopPropagation()
        // This allows the right-click to hit the editor underneath, which will trigger the context menu to open again with the correct position and content based on the new click location.
        // e.preventDefault()
        // close()
      }}
    ></div>

    <div
      bind:this={menuEl}
      class="context-menu-root fixed z-[1001] bg-base-100 backdrop-blur-2xl border border-white/10 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-1.5 min-w-[220px] select-none"
    >
      <div
        bind:this={scrollEl}
        class="context-menu-scroll flex flex-col max-h-[70vh] overflow-y-auto overflow-x-hidden pr-1"
        onscroll={updateScrollState}
        onmouseenter={updateScrollState}
      >
        {#if visibleMenuItems.some((i) => i.group === 0)}
          <div
            class="flex items-center justify-between p-1 mb-1.5 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-md border border-white/5"
          >
            {#each visibleMenuItems.filter((i) => i.group === 0) as item}
              <button
                class="flex-grow flex justify-center p-2 hover:bg-primary hover:text-base-content rounded-[4px] transition-all text-base-content/40 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={item.disabled}
                onclick={() => {
                  if (item.disabled) return
                  item.action?.()
                  close()
                }}
              >
                <!-- <i class="{item.icon} text-[18px]"></i> -->
                {#if item.iconHtml}
                  {@html `<div class="w-[18px] max-w-[max-content]">${item.iconHtml}</div>`}
                {:else if item.icon}
                  <i class="{item.icon} text-[18px]"></i>
                {/if}
              </button>
            {/each}
          </div>
        {/if}

        <div class="flex flex-col">
          {#each visibleMenuItems.filter((i) => i.group !== 0) as item, index (item.label)}
            {@const listItems = visibleMenuItems.filter((i) => i.group !== 0)}
            {#if index > 0 && item.group !== listItems[index - 1].group}
              <div
                class="h-px bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] mx-1 my-1.5"
              ></div>
            {/if}

            <ContextMenuRow {item} onSelection={close} />
          {/each}
        </div>
      </div>

      {#if canScrollUp}
        <button
          class="context-menu-scroll-arrow top-2"
          onclick={() => scrollMenuBy(-160)}
          onmouseenter={() => scrollMenuBy(-120)}
        >
          <i class="ph-bold ph-caret-up"></i>
        </button>
      {/if}

      {#if canScrollDown}
        <button
          class="context-menu-scroll-arrow bottom-2"
          onclick={() => scrollMenuBy(160)}
          onmouseenter={() => scrollMenuBy(120)}
        >
          <i class="ph-bold ph-caret-down"></i>
        </button>
      {/if}
    </div>
  </div>
{/if}

<style lang="postcss">
  .context-menu-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }
  .context-menu-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .context-menu-scroll::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 999px;
  }
  .context-menu-scroll-arrow {
    @apply absolute left-2 right-2 z-10 flex items-center justify-center h-6 rounded-md 
      bg-black/40 text-[var(--color-base-content)]/60 backdrop-blur-md border border-white/10 shadow-md 
      transition-all hover:text-[var(--color-base-content)] hover:bg-black/70;
  }

  @media (max-width: 768px) {
    .context-menu-root {
      min-width: min(86vw, 320px);
      max-width: 92vw;
    }
    .context-menu-root .context-menu-scroll {
      max-height: 60vh;
    }
    .context-menu-root .context-menu-scroll button,
    .context-menu-root .context-menu-scroll .menu-row {
      min-height: 40px;
    }
  }
</style>
