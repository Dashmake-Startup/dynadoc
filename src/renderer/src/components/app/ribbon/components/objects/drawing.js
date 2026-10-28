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
// Drawing.js
import { Node, mergeAttributes } from '@tiptap/core'

export default Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      id: {
        default: () => `drawing-${Math.random().toString(36).slice(2)}`
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-drawing]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-drawing': true }), 0]
  }
})
