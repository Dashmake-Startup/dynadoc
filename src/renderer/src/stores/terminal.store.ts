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

import { writable, get } from 'svelte/store'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'

export type TerminalEntry = {
  id: string
  folder: string
  isActive: boolean
  instance: Terminal | null   // Renamed for clarity: the actual xterm object
  fitAddon: FitAddon | null   // Stored for easy resizing
}

const terminalStore = writable<TerminalEntry[]>([])

export const _$_terminalsList = {
  subscribe: terminalStore.subscribe,

  /** * Retrieves a specific terminal entry by ID.
   * Useful for internal logic like fitting or focusing.
   */
  getTerminal(id: string): TerminalEntry | undefined {
    return get(terminalStore).find((t) => t.id === id)
  },

  /** Create and set a new terminal as active */
  addTerminal(id: string, folder: string, instance: Terminal | null = null, fitAddon: FitAddon | null = null) {
    terminalStore.update((list) => {
      // Deactivate all others in one pass
      const updated = list.map((t) => ({ ...t, isActive: false }))
      updated.push({ 
        id, 
        folder, 
        instance, 
        fitAddon, 
        isActive: true 
      })
      return updated
    })
  },

  /** Mark an existing terminal as active */
  setActive(id: string) {
    terminalStore.update((list) =>
      list.map((t) => ({ ...t, isActive: t.id === id }))
    )
  },

  /** * Adobe 2025 Feature: Batch Resize
   * Runs the fit calculation for all terminal instances.
   */
  fitAll() {
    get(terminalStore).forEach(t => {
      if (t.fitAddon && t.isActive) {
        t.fitAddon.fit()
      }
    })
  },

  /** Update folder or xterm instance for a specific terminal */
  updateTerminal(id: string, changes: Partial<Omit<TerminalEntry, 'id'>>) {
    terminalStore.update((list) =>
      list.map((t) => (t.id === id ? { ...t, ...changes } : t))
    )
  },

  /** Remove a terminal and handle instance cleanup */
  removeTerminal(id: string) {
    terminalStore.update((list) => {
      const target = list.find(t => t.id === id)
      
      // Clean up the xterm instance to prevent memory leaks
      if (target?.instance) {
        target.instance.dispose()
      }

      const filtered = list.filter((t) => t.id !== id)
      
      // Smart Focus: If we closed the active terminal, focus the previous one
      if (filtered.length > 0 && !filtered.some((t) => t.isActive)) {
        filtered[filtered.length - 1].isActive = true
      }
      return filtered
    })
  },

  /** Get the currently active terminal entry */
  getActive(): TerminalEntry | null {
    return get(terminalStore).find((t) => t.isActive) || null
  },

  /** Clear all terminals and dispose instances */
  reset() {
    get(terminalStore).forEach(t => t.instance?.dispose())
    terminalStore.set([])
  }
}
