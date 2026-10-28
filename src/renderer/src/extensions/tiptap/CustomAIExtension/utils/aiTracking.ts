import { Plugin, PluginKey, Selection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import toast from 'svelte-hot-french-toast'

type AITrackingState = {
  activeRequests: Map<string, Selection>
}

export const AI_TRACKING_PLUGIN_KEY = new PluginKey<AITrackingState>('ai-tracking')

export type AITrackingMeta =
  | { action: 'add'; requestId: string; selection: Selection }
  | { action: 'remove'; requestId: string }
  | { action: 'apply'; requestId: string }
  | { action: 'clear' }

let lastToastAt = 0

function shouldToast() {
  const now = Date.now()
  if (now - lastToastAt < 1200) return false
  lastToastAt = now
  return true
}

function hasLockedOverlap(selection: Selection, from: number, to: number) {
  const start = Math.min(selection.from, selection.to)
  const end = Math.max(selection.from, selection.to)
  return from < end && to > start
}

export const AiTrackingPlugin = new Plugin<AITrackingState>({
  key: AI_TRACKING_PLUGIN_KEY,
  state: {
    init: () => ({ activeRequests: new Map() }),
    apply(tr, value) {
      const nextMap = new Map(value.activeRequests)
      const meta = tr.getMeta(AI_TRACKING_PLUGIN_KEY) as AITrackingMeta | undefined

      if (meta?.action === 'add') {
        nextMap.set(meta.requestId, meta.selection)
      } else if (meta?.action === 'remove') {
        nextMap.delete(meta.requestId)
      } else if (meta?.action === 'clear') {
        nextMap.clear()
      }

      for (const [id, selection] of nextMap.entries()) {
        try {
          nextMap.set(id, selection.map(tr.doc, tr.mapping))
        } catch {
          nextMap.delete(id)
        }
      }

      return { activeRequests: nextMap }
    }
  },
  props: {
    decorations(state) {
      const pluginState = AI_TRACKING_PLUGIN_KEY.getState(state)
      if (!pluginState?.activeRequests?.size) return null

      const decorations: Decoration[] = []
      pluginState.activeRequests.forEach((selection) => {
        const from = Math.min(selection.from, selection.to)
        const to = Math.max(selection.from, selection.to)
        if (from === to) return
        decorations.push(
          Decoration.inline(from, to, {
            class: 'ai-locked-range',
            'data-ai-lock': 'true'
          })
        )
      })

      return DecorationSet.create(state.doc, decorations)
    }
  },
  filterTransaction(tr, state) {
    if (!tr.docChanged) return true

    const meta = tr.getMeta(AI_TRACKING_PLUGIN_KEY) as AITrackingMeta | undefined
    if (meta?.action === 'apply') return true

    const pluginState = AI_TRACKING_PLUGIN_KEY.getState(state)
    if (!pluginState?.activeRequests?.size) return true

    let blocked = false
    for (const step of tr.steps) {
      const map = step.getMap()
      map.forEach((from, to) => {
        if (blocked) return
        for (const selection of pluginState.activeRequests.values()) {
          if (hasLockedOverlap(selection, from, to)) {
            blocked = true
            return
          }
        }
      })
      if (blocked) break
    }

    const uiEvent = tr.getMeta('uiEvent')
    if (blocked && uiEvent && shouldToast()) {
      toast.error('This text is currently being processed by AI.')
    }

    return !blocked
  }
})

export function getTrackedSelection(state: any, requestId: string): Selection | null {
  const pluginState = AI_TRACKING_PLUGIN_KEY.getState(state)
  if (!pluginState?.activeRequests) return null
  return pluginState.activeRequests.get(requestId) || null
}
