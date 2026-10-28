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
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

/*
const editor = new Editor({
  content: "<h1>Heading</h1><p>Some text <strong>bold</strong></p>",
  extensions: [Spotlight.configure({ mode: "both" })],
});


// Switch mode dynamically
editor.commands.setSpotlightMode("block");  // only block
editor.commands.setSpotlightMode("inline"); // only inline
editor.commands.setSpotlightMode("both");   // block + inline
editor.commands.setSpotlightMode("off");    // disable spotlight
  */
const spotlightKey = new PluginKey('spotlight')

export interface SpotlightOptions {
  mode: 'block' | 'inline' | 'both' | 'off'
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spotlight: {
      setSpotlightMode: (mode: 'block' | 'inline' | 'both' | 'off') => ReturnType
    }
  }
}

export const CustomSpotlightExtension = Extension.create<SpotlightOptions>({
  name: 'spotlight',

  addOptions() {
    return {
      mode: 'both' // default to both
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
            prevCursorPos: null
          }),

          apply(tr, prev, _oldState, newState) {
            let { decorations, mode, prevCursorPos } = prev

            // Get mode from transaction meta, fallback to configured mode
            const newMode = tr.getMeta(spotlightKey)
            if (newMode) mode = newMode

            if (mode === 'off') return { decorations: DecorationSet.empty, mode, prevCursorPos }

            const { selection, doc } = newState
            const cursorPos = selection.$from.pos

            // Only update if cursor moved
            if (cursorPos === prevCursorPos) return { decorations, mode, prevCursorPos }

            const visibleDecorations: Decoration[] = []
            const $from = selection.$from
            const activeBlockPos = $from.before($from.depth)
            const inlineStart = $from.start()
            const inlineEnd = $from.end()

            doc.descendants((node, pos) => {
              if (!node || node.isText) return

              let shouldDim = true
              if (mode === 'block') shouldDim = pos !== activeBlockPos
              else if (mode === 'inline') shouldDim = pos < inlineStart || pos >= inlineEnd
              else if (mode === 'both') {
                if (pos === activeBlockPos) shouldDim = false
                if (pos >= inlineStart && pos < inlineEnd) shouldDim = false
              }

              if (shouldDim) {
                visibleDecorations.push(
                  Decoration.node(pos, pos + node.nodeSize, { class: 'dimmed-node' })
                )
              }
            })

            return {
              decorations: DecorationSet.create(doc, visibleDecorations),
              mode,
              prevCursorPos: cursorPos
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
          dispatch(tr.setMeta(spotlightKey, mode))
          return true
        }
    }
  }
})
