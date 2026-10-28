/**
 * Copyright (C) 2025 Dashmake Inc.
 *
 * This file is part of DDoc Office.
 *
 * DDoc Office is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DDoc Office is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */

/* const editor = new Editor({
  content: `
    <h1>Heading</h1>
    <p>Some text <strong>bold</strong></p>
    <table><tr><td>Ignore me</td></tr></table>
    <pre data-ignore="true">Also ignore this code block</pre>
    <div class="ignore-spotlight">Ignore this div</div>
  `,
  extensions: [
    Spotlight.configure({
      mode: 'both',
      blockDim: 0.4,
      inlineDim: 0.2,
      ignoreNodes: [
        { type: 'table', ignoreChildren: true } // ignore table + children
      ]
    })
  ]
})

// Dynamically ignore nodes with a class or attribute
editor.commands.ignoreNode({ class: 'ignore-spotlight', ignoreChildren: true })
editor.commands.ignoreNode({
  attribute: { name: 'data-ignore', value: 'true' },
  ignoreChildren: true
})

// Dynamically remove ignore
editor.commands.unignoreNode({ type: 'table', ignoreChildren: true }) */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

const spotlightKey = new PluginKey('spotlight')

export interface IgnoreNode {
  type?: string // Node type name
  class?: string // CSS class to match
  attribute?: {
    // Attribute to match
    name: string
    value?: string
  }
  ignoreChildren?: boolean // Whether children are ignored too
}

export interface SpotlightOptions {
  mode: 'block' | 'inline' | 'both' | 'off'
  blockDim?: number
  inlineDim?: number
  transition?: string
  ignoreNodes?: IgnoreNode[] // default ignore rules
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spotlight: {
      setSpotlightMode: (mode: 'block' | 'inline' | 'both' | 'off') => ReturnType
      ignoreNode: (ignore: IgnoreNode) => ReturnType
      unignoreNode: (ignore: IgnoreNode) => ReturnType
    }
  }
}

export const CustomSpotlightExtension = Extension.create<SpotlightOptions>({
  name: 'spotlight',

  addOptions() {
    return {
      mode: 'both',
      blockDim: 0.4,
      inlineDim: 0.6,
      transition: 'all 0.3s ease',
      ignoreNodes: []
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: spotlightKey,
        state: {
          init: (_, state) => ({
            decorations: DecorationSet.empty,
            mode: this.options.mode,
            prevCursorPos: null,
            dynamicIgnoreNodes: [...(this.options.ignoreNodes || [])] // dynamic ignore list
          }),
          apply(tr, prev, _oldState, newState) {
            let { decorations, mode, prevCursorPos, dynamicIgnoreNodes } = prev

            const newMode = tr.getMeta(spotlightKey)?.mode
            const dynamicChanges = tr.getMeta(spotlightKey)?.dynamicIgnoreNodes

            if (newMode) mode = newMode
            if (dynamicChanges) dynamicIgnoreNodes = dynamicChanges

            if (mode === 'off')
              return { decorations: DecorationSet.empty, mode, prevCursorPos, dynamicIgnoreNodes }

            const { selection, doc } = newState
            const cursorPos = selection.$from.pos
            if (cursorPos === prevCursorPos)
              return { decorations, mode, prevCursorPos, dynamicIgnoreNodes }

            const decos: Decoration[] = []
            const $from = selection.$from
            const activeBlockPos = $from.before($from.depth)
            const inlineStart = $from.start()
            const inlineEnd = $from.end()

            // Helper to check if node should be ignored
            const isIgnored = (pos: number, node) => {
              for (const ignore of dynamicIgnoreNodes) {
                if (ignore.type && node.type.name === ignore.type) return true
                if (ignore.class && node.attrs?.class === ignore.class) return true
                if (ignore.attribute) {
                  const val = node.attrs?.[ignore.attribute.name]
                  if (
                    val !== undefined &&
                    (ignore.attribute.value === undefined || val === ignore.attribute.value)
                  )
                    return true
                }
              }
              return false
            }

            doc.descendants((node, pos) => {
              if (!node || node.isText) return

              if (isIgnored(pos, node)) return

              let shouldDim = true
              let opacity = this.spec.options.blockDim

              if (mode === 'block') {
                shouldDim = pos !== activeBlockPos
                opacity = this.spec.options.blockDim
              } else if (mode === 'inline') {
                shouldDim = pos < inlineStart || pos >= inlineEnd
                opacity = this.spec.options.inlineDim
              } else if (mode === 'both') {
                if (pos === activeBlockPos) shouldDim = false
                if (pos >= inlineStart && pos < inlineEnd) shouldDim = false
                opacity =
                  pos === activeBlockPos ? this.spec.options.inlineDim : this.spec.options.blockDim
              }

              if (shouldDim) {
                decos.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    style: `background-color: rgba(0,0,0,${opacity}); transition: ${this.spec.options.transition};`
                  })
                )
              }
            })

            return {
              decorations: DecorationSet.create(doc, decos),
              mode,
              prevCursorPos: cursorPos,
              dynamicIgnoreNodes
            }
          }
        },
        props: {
          decorations(state) {
            return this.getState(state).decorations
          }
        }
      })
    ]
  },

  addCommands() {
    return {
      setSpotlightMode:
        (mode: 'block' | 'inline' | 'both' | 'off') =>
        ({ tr, dispatch }) => {
          if (!dispatch) return true
          dispatch(tr.setMeta(spotlightKey, { mode }))
          return true
        },
      ignoreNode:
        (ignore: IgnoreNode) =>
        ({ tr, dispatch, state }) => {
          if (!dispatch) return true
          const current =
            this.editor.extensionManager.extensions.find((e) => e.name === 'spotlight')?.options
              .ignoreNodes || []
          const newIgnoreList = [...current, ignore]
          dispatch(tr.setMeta(spotlightKey, { dynamicIgnoreNodes: newIgnoreList }))
          return true
        },
      unignoreNode:
        (ignore: IgnoreNode) =>
        ({ tr, dispatch, state }) => {
          if (!dispatch) return true
          const current =
            this.editor.extensionManager.extensions.find((e) => e.name === 'spotlight')?.options
              .ignoreNodes || []
          const newIgnoreList = current.filter((i) => i !== ignore)
          dispatch(tr.setMeta(spotlightKey, { dynamicIgnoreNodes: newIgnoreList }))
          return true
        }
    }
  }
})
