/**
 * CustomHtmlStyleExtension — v5
 *
 * Solves two root bugs:
 *
 * BUG 1 — setContent() bypasses transformPastedHTML
 *   transformPastedHTML only fires on clipboard paste events (execCommand paste,
 *   ClipboardEvent). editor.commands.setContent(html) goes directly to the
 *   ProseMirror DOMParser — so <style> tags hit the parser raw, nothing matches
 *   them in the schema, and they're silently dropped before any plugin sees them.
 *
 *   Fix: intercept setContent via a custom command override that pre-processes
 *   the HTML string before handing it to the core command. Callers don't need
 *   to change anything — setContent now auto-encodes <style> tags.
 *
 * BUG 2 — syncStyleTagsToDOM used node position as the <style> tag id
 *   Positions shift on every edit. The injected <style id="tiptap-style-42">
 *   becomes stale after the user types anything, css stops applying, and the
 *   cleanup logic never matches the old id so tags leak into <head>.
 *
 *   Fix: use a stable content-hash of the CSS string as the id.
 *   Same CSS → same id → same <style> tag, regardless of document position.
 *
 * EXISTING behaviours preserved:
 *   - Clipboard paste: transformPastedHTML still intercepts (double safety)
 *   - class/style on block nodes: addGlobalAttributes + DOM patch plugin
 *   - <style> tags injected into document.head so selectors resolve live
 *   - getHtmlWithStyleBlocks() / decodeStyleBlocksInHtml() for save pipeline
 */

import { Extension, Node } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { Node as ProsemirrorNode } from 'prosemirror-model'

// ─────────────────────────────────────────────────────────────────────────────
// Node types for addGlobalAttributes + DOM patch
// EXCLUDE types whose custom extension already owns class/style in addAttributes
// ─────────────────────────────────────────────────────────────────────────────

const GLOBAL_ATTR_TYPES = [
  // 'paragraph'  ← PreserveParagraph.addAttributes() owns this — DO NOT add
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'horizontalRule',
  'image',
  // Uncomment only if PaginationTable extensions don't own class/style:
  // 'table', 'tableRow', 'tableCell', 'tableHeader',
]

// ─────────────────────────────────────────────────────────────────────────────
// Style block placeholder — custom element name, never collides with user content
// ─────────────────────────────────────────────────────────────────────────────

const PLACEHOLDER_TAG    = 'style-block'
const STYLE_CONTENT_ATTR = 'data-css'
const STYLE_ATTRS_ATTR   = 'data-style-attrs'
const INJECTED_ID_PREFIX = 'tiptap-injected-style-'

// ─────────────────────────────────────────────────────────────────────────────
// Stable hash — maps CSS content to a short deterministic id
// so injected <style> tags survive document edits without going stale
// ─────────────────────────────────────────────────────────────────────────────

function stableHash(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(16)
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS encode / decode — base64 keeps < > { } : alive inside attribute values
// ─────────────────────────────────────────────────────────────────────────────

function encodeCss(css: string): string {
  try   { return btoa(unescape(encodeURIComponent(css))) }
  catch { return encodeURIComponent(css) }
}

function decodeCss(encoded: string): string {
  try   { return decodeURIComponent(escape(atob(encoded))) }
  catch {
    try   { return decodeURIComponent(encoded) }
    catch { return encoded }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core HTML transformer
// Converts every <style>…</style> in an HTML string into a <style-block>
// placeholder that ProseMirror can store as an atomic node.
//
// Called automatically by:
//   - the setContent command override (handles programmatic load)
//   - transformPastedHTML plugin prop (handles clipboard paste)
// ─────────────────────────────────────────────────────────────────────────────

export function prepareStyleHtmlForEditor(html: string): string {
  return html.replace(
    /<style([^>]*)>([\s\S]*?)<\/style>/gi,
    (_m, attrs: string, css: string) => {
      const encoded   = encodeCss(css)
      const attrsAttr = attrs.trim()
        ? ` ${STYLE_ATTRS_ATTR}="${encodeURIComponent(attrs)}"`
        : ''
      return `<${PLACEHOLDER_TAG} ${STYLE_CONTENT_ATTR}="${encoded}"${attrsAttr}></${PLACEHOLDER_TAG}>`
    }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Save pipeline helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Use instead of editor.getHTML() when persisting. */
export function getHtmlWithStyleBlocks(editor: { getHTML(): string }): string {
  return decodeStyleBlocksInHtml(editor.getHTML())
}

export function decodeStyleBlocksInHtml(html: string): string {
  return html.replace(
    new RegExp(
      `<${PLACEHOLDER_TAG}[^>]*${STYLE_CONTENT_ATTR}="([^"]*)"([^>]*)>\\s*<\\/${PLACEHOLDER_TAG}>`,
      'gi'
    ),
    (_m, encoded: string, rest: string) => {
      const css       = decodeCss(encoded)
      const m         = rest.match(new RegExp(`${STYLE_ATTRS_ATTR}="([^"]*)"`))?.[1]
      const origAttrs = m ? decodeURIComponent(m) : ''
      return `<style${origAttrs}>${css}</style>`
    }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StyleBlockNode — atomic ProseMirror node for <style> blocks
// ─────────────────────────────────────────────────────────────────────────────

const StyleBlockNode = Node.create({
  name: 'styleBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      cssContent: {
        default: '',
        parseHTML:  el    => decodeCss((el as HTMLElement).getAttribute(STYLE_CONTENT_ATTR) ?? ''),
        renderHTML: attrs => ({ [STYLE_CONTENT_ATTR]: encodeCss(attrs.cssContent as string) }),
      },
      styleAttrs: {
        default: '',
        parseHTML: el => {
          const raw = (el as HTMLElement).getAttribute(STYLE_ATTRS_ATTR)
          return raw ? decodeURIComponent(raw) : ''
        },
        renderHTML: attrs =>
          attrs.styleAttrs
            ? { [STYLE_ATTRS_ATTR]: encodeURIComponent(attrs.styleAttrs as string) }
            : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: PLACEHOLDER_TAG }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      PLACEHOLDER_TAG,
      {
        ...HTMLAttributes,
        style: [
          'display:block', 'padding:4px 10px', 'margin:2px 0',
          'background:rgba(147,51,234,0.07)',
          'border:1px dashed rgba(147,51,234,0.3)',
          'border-radius:4px', 'font-size:10px',
          'color:rgba(147,51,234,0.6)', 'font-family:monospace',
          'user-select:none', 'cursor:default',
          'white-space:nowrap', 'overflow:hidden',
        ].join(';'),
        contenteditable: 'false',
      },
    ]
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// InlineStyledSpan — preserves style/class on <span> not caught by PreserveTextStyle
// ─────────────────────────────────────────────────────────────────────────────

const InlineStyledSpan = Node.create({
  name: 'inlineStyledSpan',
  group: 'inline',
  inline: true,
  content: 'inline*',
  marks: '_',

  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML:  el    => (el as HTMLElement).getAttribute('style'),
        renderHTML: attrs => (attrs.style ? { style: attrs.style } : {}),
      },
      class: {
        default: null,
        parseHTML:  el    => (el as HTMLElement).getAttribute('class'),
        renderHTML: attrs => (attrs.class ? { class: attrs.class } : {}),
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'span[style]', consuming: false },
      { tag: 'span[class]', consuming: false },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0]
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// DOM patch — writes class/style directly onto live DOM elements.
//
// Needed because built-in nodes (heading, blockquote, etc.) call
// mergeAttributes() in renderHTML with their own static config that doesn't
// include class/style. The attrs are in the model but never reach the DOM.
// ─────────────────────────────────────────────────────────────────────────────

// Classes TipTap manages internally — never strip these
const TIPTAP_CLASS_PREFIXES = ['ProseMirror', 'tiptap', 'is-', 'node-', 'rm-']

function isTiptapClass(c: string): boolean {
  return TIPTAP_CLASS_PREFIXES.some(p => c.startsWith(p))
}

function applyAttrsToDOM(view: EditorView): void {
  view.state.doc.descendants((node: ProsemirrorNode, pos: number) => {
    // Skip paragraph — PreserveParagraph.renderHTML already handles it
    if (node.type.name === 'paragraph') return

    const cls   = node.attrs.class  as string | null | undefined
    const style = node.attrs.style  as string | null | undefined
    if (!cls && !style) return

    let dom: Element | null = null
    try {
      const offset = node.isAtom || node.isLeaf ? 0 : 1
      const info   = view.domAtPos(pos + offset)
      dom = info.node.nodeType === window.Node.ELEMENT_NODE
        ? (info.node as Element)
        : (info.node as ChildNode).parentElement
    } catch {
      return
    }

    if (!dom || dom.nodeType !== window.Node.ELEMENT_NODE) return

    if (cls) {
      const existing    = (dom.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
      const tiptapOwned = existing.filter(isTiptapClass)
      const userClasses = cls.split(/\s+/).filter(Boolean)
      const merged      = [...new Set([...tiptapOwned, ...userClasses])].join(' ')
      if (dom.getAttribute('class') !== merged) dom.setAttribute('class', merged)
    }

    if (style) {
      const existing = (dom.getAttribute('style') ?? '').replace(/;\s*$/, '')
      const merged   = existing ? `${existing};${style}` : style
      if (dom.getAttribute('style') !== merged) dom.setAttribute('style', merged)
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Style tag injection — injects <style> into document.head using a stable
// content-hash id so tags survive position shifts from edits
// ─────────────────────────────────────────────────────────────────────────────

function syncStyleTagsToDOM(view: EditorView): void {
  const root      = view.dom.getRootNode() as Document | ShadowRoot
  const container = (root === document ? document.head : root) as ParentNode
  const liveIds   = new Set<string>()

  view.state.doc.descendants((node: ProsemirrorNode) => {
    if (node.type.name !== 'styleBlock') return

    const css = node.attrs.cssContent as string
    if (!css.trim()) return

    // Stable id based on CSS content, not document position
    const id = `${INJECTED_ID_PREFIX}${stableHash(css)}`
    liveIds.add(id)

    let el = container.querySelector<HTMLStyleElement>(`#${CSS.escape(id)}`)
    if (!el) {
      el    = document.createElement('style')
      el.id = id
      container.appendChild(el)
    }
    // Only rewrite if content actually changed
    if (el.textContent !== css) el.textContent = css
  })

  // Remove injected tags whose styleBlock nodes no longer exist in the doc
  container
    .querySelectorAll(`[id^="${INJECTED_ID_PREFIX}"]`)
    .forEach(el => { if (!liveIds.has(el.id)) el.remove() })
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Extension
// ─────────────────────────────────────────────────────────────────────────────

export const CustomHtmlStyleExtension = Extension.create({
  name: 'customHtmlStyle',

  addExtensions() {
    return [StyleBlockNode, InlineStyledSpan]
  },

  // ── Command override: intercept setContent so <style> tags are encoded
  //    BEFORE the ProseMirror DOMParser runs.
  //    This is the fix for the "setContent bypasses transformPastedHTML" bug.
  addCommands() {
    return {
      setContent:
        (content: string | object, emitUpdate?: boolean, parseOptions?: object) =>
        ({ commands }: { commands: any }) => {
          // Only intercept string HTML — JSON content objects pass through
          if (typeof content === 'string') {
            return commands.setContent(
              prepareStyleHtmlForEditor(content),
              emitUpdate,
              parseOptions,
            )
          }
          return commands.setContent(content, emitUpdate, parseOptions)
        },
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: GLOBAL_ATTR_TYPES,
        attributes: {
          style: {
            default: null,
            parseHTML:  el    => (el as HTMLElement).getAttribute('style') || null,
            renderHTML: attrs => (attrs.style ? { style: attrs.style as string } : {}),
          },
          class: {
            default: null,
            parseHTML:  el    => (el as HTMLElement).getAttribute('class') || null,
            renderHTML: attrs => (attrs.class ? { class: attrs.class as string } : {}),
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [
      // ── DOM patch + style injection ────────────────────────────────────────
      new Plugin({
        key: new PluginKey('customHtmlStyleDOM'),
        view(editorView: EditorView) {
          // Defer past TipTap's own initial render
          requestAnimationFrame(() => {
            applyAttrsToDOM(editorView)
            syncStyleTagsToDOM(editorView)
          })
          return {
            update(view: EditorView, prevState) {
              // Skip cursor-only transactions — doc didn't change
              if (view.state.doc.eq(prevState.doc)) return
              applyAttrsToDOM(view)
              syncStyleTagsToDOM(view)
            },
            destroy() {
              const root      = editorView.dom.getRootNode() as Document | ShadowRoot
              const container = (root === document ? document.head : root) as ParentNode
              container
                .querySelectorAll(`[id^="${INJECTED_ID_PREFIX}"]`)
                .forEach(el => el.remove())
            },
          }
        },
      }),

      // ── Clipboard paste interception (safety net for paste events) ─────────
      new Plugin({
        key: new PluginKey('customHtmlStylePaste'),
        props: {
          transformPastedHTML: (html: string) => prepareStyleHtmlForEditor(html),
        },
      }),
    ]
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Combined pipeline helpers (use alongside CustomHtmlCommentExtension)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prepare HTML for editor.commands.setContent().
 * If you're using the command override above, this is called automatically.
 * Only needed if you bypass the command and call insertContent / other methods.
 */
export function prepareFullHtml(
  html: string,
  encodeComments?: (h: string) => string,
): string {
  let result = prepareStyleHtmlForEditor(html)
  if (encodeComments) result = encodeComments(result)
  return result
}

/**
 * Extract final HTML for saving — call instead of editor.getHTML().
 */
export function extractFullHtml(
  editor: { getHTML(): string },
  decodeComments?: (h: string) => string,
): string {
  let html = decodeStyleBlocksInHtml(editor.getHTML())
  if (decodeComments) html = decodeComments(html)
  return html
}
