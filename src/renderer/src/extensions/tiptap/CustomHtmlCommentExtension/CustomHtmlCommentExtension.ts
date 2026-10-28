/**
 * CustomHtmlCommentExtension
 *
 * Preserves ALL comment types through TipTap's parse/serialize cycle:
 *   - HTML comments:          <!-- any content -->
 *   - CSS comments in styles: <style>/* any content *\/</style>
 *
 * How it works:
 *   LOAD  → pre-process raw HTML string, encode every comment into a
 *           <span data-html-comment="..."> placeholder that ProseMirror
 *           can actually see and store as a CommentNode.
 *
 *   SAVE  → post-process editor.getHTML() output, decode every placeholder
 *           span back into its original comment syntax.
 *
 * Usage:
 *   1. Add CustomHtmlCommentExtension to your editor extensions array.
 *   2. Use prepareHtmlForEditor(rawHtml)  before editor.commands.setContent()
 *   3. Use getHtmlWithComments(editor)    instead of editor.getHTML()
 */

import { Node, Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const COMMENT_TAG = 'span'
const COMMENT_ATTR = 'data-html-comment'
const COMMENT_TYPE_ATTR = 'data-comment-type'

/** Marks whether comment was <!-- html --> or /* css *\/ inside a <style> */
type CommentType = 'html' | 'css'

// ─────────────────────────────────────────────
// Encode / Decode helpers
// ─────────────────────────────────────────────

function encodeComment(content: string, type: CommentType): string {
  return `<${COMMENT_TAG} ${COMMENT_ATTR}="${encodeURIComponent(content)}" ${COMMENT_TYPE_ATTR}="${type}" style="display:none" aria-hidden="true"></${COMMENT_TAG}>`
}

/**
 * Replace all HTML comments and CSS comments inside <style> blocks
 * with placeholder <span> elements that ProseMirror can parse.
 *
 * Call this BEFORE editor.commands.setContent(html).
 */
export function prepareHtmlForEditor(html: string): string {
  // Step 1 — encode CSS comments inside <style>...</style> blocks first
  // so they don't get confused with HTML comment regex below
  let result = html.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_fullMatch, openTag: string, cssContent: string, closeTag: string) => {
      const encodedCss = cssContent.replace(
        /\/\*([\s\S]*?)\*\//g,
        (_m, inner: string) => encodeComment(inner, 'css')
      )
      return `${openTag}${encodedCss}${closeTag}`
    }
  )

  // Step 2 — encode remaining HTML comments
  result = result.replace(
    /<!--([\s\S]*?)-->/g,
    (_m, inner: string) => encodeComment(inner, 'html')
  )

  return result
}

/**
 * Decode placeholder <span data-html-comment> elements back to real comments.
 *
 * Call this INSTEAD OF editor.getHTML().
 */
export function getHtmlWithComments(editor: { getHTML(): string }): string {
  return decodeCommentsInHtml(editor.getHTML())
}

/**
 * Can also be used standalone to decode a serialized HTML string
 * (e.g. after loading from DB).
 */
export function decodeCommentsInHtml(html: string): string {
  return html.replace(
    new RegExp(
      `<${COMMENT_TAG}[^>]*${COMMENT_ATTR}="([^"]*)"[^>]*${COMMENT_TYPE_ATTR}="(html|css)"[^>]*>\\s*<\\/${COMMENT_TAG}>`,
      'gi'
    ),
    (_m, encoded: string, type: CommentType) => {
      const content = decodeURIComponent(encoded)
      return type === 'css' ? `/*${content}*/` : `<!--${content}-->`
    }
  )
}

// ─────────────────────────────────────────────
// CommentNode — stores a single comment in the doc
// ─────────────────────────────────────────────

const CommentNode = Node.create({
  name: 'htmlComment',

  // Inline so comments can live inside paragraphs, style blocks, etc.
  group: 'inline',
  inline: true,
  atom: true,       // Not editable / selectable as text
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      content: {
        default: '',
        parseHTML: (el) => decodeURIComponent((el as HTMLElement).getAttribute(COMMENT_ATTR) ?? ''),
        renderHTML: (attrs) => ({
          [COMMENT_ATTR]: encodeURIComponent(attrs.content as string),
        }),
      },
      commentType: {
        default: 'html' as CommentType,
        parseHTML: (el) => (el as HTMLElement).getAttribute(COMMENT_TYPE_ATTR) ?? 'html',
        renderHTML: (attrs) => ({
          [COMMENT_TYPE_ATTR]: attrs.commentType,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: `${COMMENT_TAG}[${COMMENT_ATTR}]`,
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      COMMENT_TAG,
      {
        ...HTMLAttributes,
        style: 'display:none',
        'aria-hidden': 'true',
      },
    ]
  },
})

// ─────────────────────────────────────────────
// Main Extension
// ─────────────────────────────────────────────

export const CustomHtmlCommentExtension = Extension.create({
  name: 'customHtmlComment',

  addExtensions() {
    return [CommentNode]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('customHtmlComment'),
        props: {
          /**
           * transformPastedHTML fires when content is pasted into the editor.
           * We encode comments so ProseMirror doesn't discard them.
           */
          transformPastedHTML(html: string) {
            return prepareHtmlForEditor(html)
          },
        },
      }),
    ]
  },
})

// ─────────────────────────────────────────────
// Type augmentation so editor.storage is typed (optional)
// ─────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customHtmlComment: Record<string, never>
  }
}
