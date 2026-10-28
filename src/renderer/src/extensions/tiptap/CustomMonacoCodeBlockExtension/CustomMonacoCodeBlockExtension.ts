import { Node, mergeAttributes, findChildren } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { createLowlight, common as lowlightCommon } from 'lowlight'
import { mount } from 'svelte';
import { CustomMonacoCodeBlockExtensionProps } from './utils/common.utils';
import { _$_monacoEditorModal } from './stores/monacoCode.store';

// Lazy init: a synchronous throw here would crash the entire renderer before any component mounts.
// Starts with the ~40-language "common" subset, then upgrades to the full grammar set in the
// background — the other ~150 grammars must not sit on the first-render critical path for plain
// text documents.
let lowlight: ReturnType<typeof createLowlight> | null = null
try {
  lowlight = createLowlight(lowlightCommon)
  import('lowlight').then(({ all }) => lowlight?.register(all))
} catch (err) {
  console.error('[lowlight] init failed — syntax highlighting disabled:', err)
}
const lowlightPluginKey = new PluginKey('monacoCodeBlockLowlight')

function parseNodes(nodes: any[], classes: string[] = []): { text: string; classes: string[] }[] {
  return nodes.flatMap((node) => {
    const merged = [...classes, ...(node.properties?.className ?? [])]
    if (node.children) return parseNodes(node.children, merged)
    return [{ text: node.value as string, classes: merged }]
  })
}

function buildDecorations(doc: any, name: string): DecorationSet {
  if (!lowlight) return DecorationSet.empty
  const decorations: Decoration[] = []
  findChildren(doc, (node) => node.type.name === name).forEach(({ node, pos }) => {
    try {
      const language = node.attrs.language || 'javascript'
      const result = lowlight.listLanguages().includes(language)
        ? lowlight.highlight(language, node.textContent)
        : lowlight.highlightAuto(node.textContent)
      const nodes = (result as any).value || (result as any).children || []
      let from = pos + 1
      parseNodes(nodes).forEach(({ text, classes }) => {
        const to = from + text.length
        if (classes.length) {
          decorations.push(Decoration.inline(from, to, { class: classes.join(' ') }))
        }
        from = to
      })
    } catch (err) {
      console.warn('[lowlight] buildDecorations failed for node at pos', pos, err)
    }
  })
  return DecorationSet.create(doc, decorations)
}

const extensionName = CustomMonacoCodeBlockExtensionProps.name
const extensionTagName = CustomMonacoCodeBlockExtensionProps.tagName

export const CustomMonacoCodeBlockExtension = Node.create({
  name: extensionName,
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      language: { default: 'javascript' },
      index: { default: 1 },
      detected: { default: false },
      manualSet: { default: false }
    }
  },

  parseHTML() {
    return [
      // Primary: element with explicit language attribute
      { tag: `${extensionTagName}[language]` },
      // Fallback: documents saved before the language attribute was required
      { tag: extensionTagName, getAttrs: () => ({ language: 'javascript' }) }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [extensionTagName, mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ({ node, editor, getPos, updateAttributes }) => {
      if (node.attrs.src) {
        // ── File-backed mode ────────────────────────────────────────────────
        // Full Svelte widget: file watching, LaTeX, PDF, find-replace registry.
        // Loaded on demand — it drags in monaco-editor, katex and
        // @vscode/vscode-languagedetection, which must not sit on the
        // first-render critical path for plain text documents.
        const dom = document.createElement('div')
        import('./components/CustomMonacoCodeBlockExtensionWidget.svelte').then(
          ({ default: CustomMonacoCodeBlockExtensionWidget }) => {
            mount(CustomMonacoCodeBlockExtensionWidget, {
              target: dom,
              props: {
                node,
                updateAttributes,
                onSave(_newCode: string, _filePath: string, fileRelativePath: string) {
                  const pos = typeof getPos === 'function' ? getPos() : null
                  if (pos !== null) {
                    editor.view.dispatch(
                      editor.view.state.tr.setNodeMarkup(pos, undefined, {
                        ...node.attrs,
                        src: fileRelativePath
                      })
                    )
                  }
                },
                onClose(_newCode: string, _filePath: string, _fileRelativePath: string) {},
              }
            })
          }
        )
        return {
          dom,
          update: (newNode) => {
            if (newNode.type !== node.type) return false
            // If src is removed, force recreation as inline node view
            if (!newNode.attrs.src) return false
            return true
          },
          // Let Svelte widget's click handlers fire — ProseMirror must not intercept
          stopEvent: () => true,
        }
      }

      // ── Inline mode ──────────────────────────────────────────────────────
      // ProseMirror owns the text content (contentDOM), Monaco opens on demand
      const LANGUAGES = [
        'javascript', 'typescript', 'python', 'rust', 'go', 'java',
        'c', 'cpp', 'csharp', 'css', 'html', 'json', 'markdown',
        'sql', 'shell', 'latex', 'plaintext',
      ]

      const dom = document.createElement('div')
      dom.className = 'monaco-code-inline'

      const pre = document.createElement('pre')
      const codeEl = document.createElement('code')
      codeEl.className = `language-${node.attrs.language || 'javascript'}`
      pre.appendChild(codeEl)
      dom.appendChild(pre)

      // Footer bar — language selector + expand button
      const footer = document.createElement('div')
      footer.className = 'monaco-code-footer'

      const langSelect = document.createElement('select')
      langSelect.className = 'monaco-lang-select'
      for (const lang of LANGUAGES) {
        const opt = document.createElement('option')
        opt.value = lang
        opt.textContent = lang
        if (lang === (node.attrs.language || 'javascript')) opt.selected = true
        langSelect.appendChild(opt)
      }
      langSelect.addEventListener('mousedown', (e) => e.stopPropagation())
      langSelect.addEventListener('change', () => {
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos === null) return
        const { state, dispatch } = editor.view
        const n = state.doc.nodeAt(pos)
        if (!n) {
          langSelect.value = node.attrs.language || 'javascript'
          return
        }
        try {
          dispatch(state.tr.setNodeMarkup(pos, undefined, { ...n.attrs, language: langSelect.value }))
        } catch (err) {
          console.warn('[Monaco] language select dispatch failed at pos', pos, err)
          langSelect.value = n.attrs.language || 'javascript'
        }
      })

      const expandBtn = document.createElement('button')
      expandBtn.className = 'monaco-expand-btn'
      expandBtn.title = 'Open in Monaco'
      expandBtn.textContent = '⤢'
      expandBtn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos === null) return
        const { state } = editor.view
        const n = state.doc.nodeAt(pos)
        if (!n) return
        _$_monacoEditorModal.open({
          filePath: '',
          fileRelativePath: '',
          language: n.attrs.language || 'javascript',
          content: n.textContent,
          onSave: (newCode: string) => {
            const { state: s, dispatch } = editor.view
            const currentN = s.doc.nodeAt(pos)
            if (!currentN) return
            const from = pos + 1
            const to = pos + currentN.nodeSize - 1
            const tr = s.tr
            if (newCode) {
              tr.replaceWith(from, to, s.schema.text(newCode))
            } else {
              tr.delete(from, to)
            }
            try {
              dispatch(tr)
            } catch (err) {
              console.error('[Monaco] expand save dispatch failed — node may have moved', err)
            }
          },
        })
      })

      footer.appendChild(langSelect)
      footer.appendChild(expandBtn)
      dom.appendChild(footer)

      return {
        dom,
        contentDOM: codeEl,
        update: (newNode) => {
          if (newNode.type !== node.type) return false
          if (newNode.attrs.src) return false
          codeEl.className = `language-${newNode.attrs.language || 'javascript'}`
          langSelect.value = newNode.attrs.language || 'javascript'
          return true
        },
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: lowlightPluginKey,
        state: {
          init: (_, { doc }) => buildDecorations(doc, this.name),
          apply: (tr, decorationSet, oldState, newState) => {
            if (!tr.docChanged) return decorationSet.map(tr.mapping, tr.doc)
            const oldName = oldState.selection.$head.parent.type.name
            const newName = newState.selection.$head.parent.type.name
            const oldNodes = findChildren(oldState.doc, (n) => n.type.name === this.name)
            const newNodes = findChildren(newState.doc, (n) => n.type.name === this.name)
            const needsUpdate =
              [oldName, newName].includes(this.name) ||
              newNodes.length !== oldNodes.length ||
              tr.steps.some((step: any) =>
                step.from !== undefined &&
                step.to !== undefined &&
                oldNodes.some(({ pos, node }) => pos >= step.from && pos + node.nodeSize <= step.to)
              )
            return needsUpdate
              ? buildDecorations(tr.doc, this.name)
              : decorationSet.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) { return lowlightPluginKey.getState(state) },
        },
      }),
    ]
  },

  addCommands() {
    return {
      insertMonacoCodeBlock:
        (options: { language?: string }) =>
          ({ chain, state }) => {
            const lang = options.language || 'javascript'
            let maxIndex = 0
            state.doc.descendants((n) => {
              if (n.type.name === extensionName) {
                maxIndex = Math.max(maxIndex, n.attrs.index || 0)
              }
            })
            return chain()
              .focus()
              .insertContent({
                type: this.name,
                attrs: { language: lang, index: maxIndex + 1 }
              })
              .run()
          }
    }
  }
})
