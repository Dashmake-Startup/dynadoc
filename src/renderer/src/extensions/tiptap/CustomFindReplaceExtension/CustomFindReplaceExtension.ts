import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection, NodeSelection } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { _$_findBar } from './findBar.store'
import { getMonacoContentBySrc } from './monacoContentRegistry'

const findKey = new PluginKey<FindPluginState>('findReplace')
const META = 'findReplace'

interface Match {
  from: number
  to: number
  isAtom?: boolean // true for Monaco block matches (whole-node decoration)
}

interface FindPluginState {
  query: string
  caseSensitive: boolean
  wholeWord: boolean
  currentIdx: number
  matches: Match[]
  decorations: DecorationSet
}

const MONACO_NODE_NAME = 'monacoCodeBlock'

function textMatches(text: string, q: string, wholeWord: boolean, idx: number, qLen: number): boolean {
  if (!wholeWord) return true
  const before = idx > 0 ? text[idx - 1] : '\n'
  const after = idx + qLen < text.length ? text[idx + qLen] : '\n'
  return !/\w/.test(before) && !/\w/.test(after)
}

function buildMatches(doc: any, query: string, caseSensitive: boolean, wholeWord: boolean): Match[] {
  const results: Match[] = []
  if (!query) return results

  const q = caseSensitive ? query : query.toLowerCase()

  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      const text: string = caseSensitive ? node.text : node.text.toLowerCase()
      let i = text.indexOf(q)
      while (i !== -1) {
        if (textMatches(text, q, wholeWord, i, q.length)) {
          results.push({ from: pos + i, to: pos + i + q.length })
        }
        i = text.indexOf(q, i + 1)
      }
      return
    }

    // Monaco code block — search in registered file content
    if (node.type?.name === MONACO_NODE_NAME) {
      const src: string = node.attrs?.src || ''
      const content = getMonacoContentBySrc(src)
      if (content) {
        const hay = caseSensitive ? content : content.toLowerCase()
        if (hay.includes(q)) {
          results.push({ from: pos, to: pos + node.nodeSize, isAtom: true })
        }
      }
    }
  })

  return results
}

function buildDecorations(doc: any, matches: Match[], currentIdx: number): DecorationSet {
  const decos = matches.map((m, i) => {
    const isCurrent = i === currentIdx
    if (m.isAtom) {
      return Decoration.node(m.from, m.to, {
        class: isCurrent ? 'find-match-block find-match-block--current' : 'find-match-block'
      })
    }
    return Decoration.inline(m.from, m.to, {
      class: isCurrent ? 'find-match find-match--current' : 'find-match'
    })
  })
  return DecorationSet.create(doc, decos)
}

export const CustomFindReplaceExtension = Extension.create({
  name: 'findReplace',

  addKeyboardShortcuts() {
    return {
      'Mod-f': () => {
        _$_findBar.update((s) => ({ ...s, open: true }))
        return true
      }
    }
  },

  addCommands() {
    return {
      setFindQuery:
        (query: string, opts: { caseSensitive?: boolean; wholeWord?: boolean } = {}) =>
        ({ state, dispatch }: any) => {
          if (dispatch)
            dispatch(state.tr.setMeta(META, { query, caseSensitive: opts.caseSensitive ?? false, wholeWord: opts.wholeWord ?? false, currentIdx: 0 }))
          return true
        },

      findNext:
        () =>
        ({ state, dispatch }: any) => {
          const ps: FindPluginState = findKey.getState(state)
          if (!ps || ps.matches.length === 0) return false
          const nextIdx = (ps.currentIdx + 1) % ps.matches.length
          if (dispatch) {
            const match = ps.matches[nextIdx]
            const sel = match.isAtom
              ? NodeSelection.create(state.doc, match.from)
              : TextSelection.create(state.doc, match.from, match.to)
            dispatch(state.tr.setMeta(META, { currentIdx: nextIdx }).setSelection(sel).scrollIntoView())
          }
          return true
        },

      findPrev:
        () =>
        ({ state, dispatch }: any) => {
          const ps: FindPluginState = findKey.getState(state)
          if (!ps || ps.matches.length === 0) return false
          const prevIdx = (ps.currentIdx - 1 + ps.matches.length) % ps.matches.length
          if (dispatch) {
            const match = ps.matches[prevIdx]
            const sel = match.isAtom
              ? NodeSelection.create(state.doc, match.from)
              : TextSelection.create(state.doc, match.from, match.to)
            dispatch(state.tr.setMeta(META, { currentIdx: prevIdx }).setSelection(sel).scrollIntoView())
          }
          return true
        },

      clearFind:
        () =>
        ({ state, dispatch }: any) => {
          if (dispatch) dispatch(state.tr.setMeta(META, { query: '', currentIdx: 0 }))
          return true
        }
    } as any
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<FindPluginState>({
        key: findKey,
        state: {
          init(_config, state): FindPluginState {
            return {
              query: '',
              caseSensitive: false,
              wholeWord: false,
              currentIdx: 0,
              matches: [],
              decorations: DecorationSet.empty
            }
          },
          apply(tr, prev, _old, newState): FindPluginState {
            const meta = tr.getMeta(META)

            let { query, caseSensitive, wholeWord, currentIdx } = prev

            if (meta) {
              if (meta.query !== undefined) query = meta.query
              if (meta.caseSensitive !== undefined) caseSensitive = meta.caseSensitive
              if (meta.wholeWord !== undefined) wholeWord = meta.wholeWord
              if (meta.currentIdx !== undefined) currentIdx = meta.currentIdx
            }

            const needsRebuild = !!(meta || tr.docChanged)
            const matches = needsRebuild
              ? buildMatches(newState.doc, query, caseSensitive, wholeWord)
              : prev.matches

            if (currentIdx >= matches.length) currentIdx = 0

            const decorations = needsRebuild
              ? buildDecorations(newState.doc, matches, currentIdx)
              : currentIdx !== prev.currentIdx
                ? buildDecorations(newState.doc, matches, currentIdx)
                : prev.decorations.map(tr.mapping, newState.doc)

            // Sync counts back to the Svelte store
            const total = matches.length
            queueMicrotask(() => {
              _$_findBar.update((s) =>
                s.totalCount !== total || s.currentIdx !== currentIdx
                  ? { ...s, totalCount: total, currentIdx }
                  : s
              )
            })

            return { query, caseSensitive, wholeWord, currentIdx, matches, decorations }
          }
        },
        props: {
          decorations(state) {
            return findKey.getState(state)?.decorations ?? DecorationSet.empty
          }
        }
      })
    ]
  }
})
