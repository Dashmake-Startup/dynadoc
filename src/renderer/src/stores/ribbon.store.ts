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

import { writable, get, derived } from 'svelte/store'
import type { ComponentType } from 'svelte'
import Platform from '../libs/platform'
import { createUiPersistedStore } from './uiPersistence'

const ui = (key: string) => `ui:${key}`
export const RibbonType = {
  home: 'home',
  translate: 'translate',
  insert: 'insert',
  design: 'design',
  data: 'data',
  media: 'media',
  automation: 'automation',
  layout: 'layout',
  references: 'references',
  form: 'form',
  review: 'review',
  view: 'view',
  draw: 'draw',
  developer: 'developer',
  addins: 'addins',
  help: 'help',
  transitions: 'transitions',
  animations: 'animations',
  table_tools: 'table_tools',
  table_style: 'table_style',
  picture_tools: 'picture_tools',
  drawing_tools: 'drawing_tools',
  formulas: 'formulas'
} as const

export type RibbonEntry = {
  id: keyof typeof RibbonType
  // id: string
  label: string
  isActive?: boolean
  body: ComponentType | null
}

const ribbonStore = writable<RibbonEntry[]>([])
type RibbonContextState = {
  hasEditor: boolean
  inTable: boolean
  inImage: boolean
  inSheet: boolean
  inSlide: boolean
  hasPositionableNode: boolean
  activePositionableType: string | null
}

const defaultRibbonContext: RibbonContextState = {
  hasEditor: false,
  inTable: false,
  inImage: false,
  inSheet: false,
  inSlide: false,
  hasPositionableNode: false,
  activePositionableType: null
}

const ribbonContextStore = writable<RibbonContextState>(defaultRibbonContext)
export const _$_ribbonContainer = writable<HTMLElement>()
export const _$_ribbonContainerHeight = writable(0)
// export const _$_ribbbonVisible = writable(false)

export const _isMobileScreen = Platform.isMobileScreen()

// Not persisted: the ribbon is deployed by default on every launch. The chevron
// can still hide it within the session, but that choice is not remembered across
// restarts (it kept reopening hidden otherwise).
export const _$_ribbonUserVisible = writable<boolean>(!_isMobileScreen)
// Auto-hidden only for non-editable media previews (PDF, image, video, audio).
export const _$_ribbonAutoHidden = writable(false)
export const _$_ribbbonVisible = derived(
  [_$_ribbonUserVisible, _$_ribbonAutoHidden],
  ([$userVisible, $autoHidden]) => $userVisible && !$autoHidden
)

export const _$_ribbonActiveTab = createUiPersistedStore<keyof typeof RibbonType>(
  ui('ribbonActiveTab'),
  RibbonType.home
)

export type RibbonDisplayPreferences = {
  showGroupNames: boolean
  centerButtons: boolean
  autoCollapse: boolean
}

export const _$_ribbonDisplayPreferences = createUiPersistedStore<RibbonDisplayPreferences>(
  ui('ribbonDisplayPreferences'),
  {
    showGroupNames: true,
    centerButtons: true,
    autoCollapse: false
  }
)

export const _$_ribbonsList = {
  subscribe: ribbonStore.subscribe,

  /** Add a single ribbon and make it active */
  addRibbon(id: string, label: string, body: ComponentType | null = null) {
    ribbonStore.update((list) => {
      // Deactivate all existing ribbons
      const updated = list.map((r) => ({ ...r, isActive: false }))
      // Add new one as active
      updated.push({ id, label, body, isActive: true })
      return updated
    })
  },

  /**
   * Add multiple ribbons at once.
   * - Optionally sets one active (the first if none specified)
   * - Skips ribbons with duplicate IDs
   */
  addRibbonsFromList(ribbons: RibbonEntry[], activeId?: string) {
    ribbonStore.update((list) => {
      const existingIds = new Set(list.map((r) => r.id))
      const newRibbons = ribbons.filter((r) => !existingIds.has(r.id))

      // If no active ribbon in current or new list, activate the first
      const shouldActivate =
        activeId ||
        newRibbons.find((r) => r.isActive)?.id ||
        list.find((r) => r.isActive)?.id ||
        newRibbons[0]?.id

      const merged = [...list, ...newRibbons].map((r) => ({
        ...r,
        isActive: r.id === shouldActivate
      }))

      return merged
    })
  },

  /** Set a specific ribbon active */
  setActive(id: string) {
    ribbonStore.update((list) => list.map((r) => ({ ...r, isActive: r.id === id })))
  },

  /** Update a ribbon’s label or body */
  updateRibbon(id: string, changes: Partial<Omit<RibbonEntry, 'id'>>) {
    ribbonStore.update((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)))
  },

  /** Remove a ribbon */
  removeRibbon(id: string) {
    ribbonStore.update((list) => {
      const filtered = list.filter((r) => r.id !== id)
      // If no ribbon is active, activate the last one
      if (filtered.length > 0 && !filtered.some((r) => r.isActive)) {
        filtered[filtered.length - 1].isActive = true
      }
      return filtered
    })
  },

  /** Get the currently active ribbon */
  getActive(): RibbonEntry | null {
    const list = get(ribbonStore)
    return list.find((r) => r.isActive) || null
  },

  /** Reset all ribbons */
  reset() {
    ribbonStore.set([])
  }
}

export const _$_ribbonContext = {
  subscribe: ribbonContextStore.subscribe,
  set(value: RibbonContextState) {
    ribbonContextStore.set(value)
  },
  patch(value: Partial<RibbonContextState>) {
    ribbonContextStore.update((state) => ({ ...state, ...value }))
  },
  reset() {
    ribbonContextStore.set(defaultRibbonContext)
  },
  getSnapshot(): RibbonContextState {
    return get(ribbonContextStore)
  }
}

// export type RibbonEntry = {
//   id: string
//   label: string
//   isActive?: boolean
//   body: ComponentType | null
// }

// const ribbonStore = writable<RibbonEntry[]>([])

// export const _$_ribbonsList = {
//   subscribe: ribbonStore.subscribe,

//   /** Create and set a new ribbon as active */
//   addRibbon(id: string, label: string, body: ComponentType | null = null) {
//     ribbonStore.update((list) => {
//       // Deactivate all existing ribbons
//       const updated = list.map((t) => ({ ...t, isActive: false }))
//       // Add new active ribbon
//       updated.push({ id, label, body, isActive: true })
//       return updated
//     })
//   },
//   /** Create and set a new ribbon as active */
//   addRibbonsFromList(ribbonList: RibbonEntry[]) {
//     for (let index = 0; index < ribbonList.length; index++) {
//       const ribbon = ribbonList[index];
//       this.addRibbon(ribbon.id, ribbon.label, ribbon.body)
//     }
//   },

//   /** Mark an existing ribbon as active */
//   setActive(id: string) {
//     ribbonStore.update((list) =>
//       list.map((t) => ({ ...t, isActive: t.id === id }))
//     )
//   },

//   /** Update label or body instance for a specific ribbon */
//   updateRibbon(id: string, changes: Partial<Omit<RibbonEntry, 'id'>>) {
//     ribbonStore.update((list) =>
//       list.map((t) => (t.id === id ? { ...t, ...changes } : t))
//     )
//   },

//   /** Remove a ribbon */
//   removeRibbon(id: string) {
//     ribbonStore.update((list) => {
//       const filtered = list.filter((t) => t.id !== id)
//       // If no ribbon is active, activate the last one
//       if (filtered.length > 0 && !filtered.some((t) => t.isActive)) {
//         filtered[filtered.length - 1].isActive = true
//       }
//       return filtered
//     })
//   },

//   /** Get the currently active ribbon entry */
//   getActive(): RibbonEntry | null {
//     const list = get(ribbonStore)
//     return list.find((t) => t.isActive) || null
//   },

//   /** Reset everything */
//   reset() {
//     ribbonStore.set([])
//   }
// }
