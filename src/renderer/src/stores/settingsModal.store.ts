import { writable } from 'svelte/store'

export type SettingsTabId =
  | 'general'
  | 'page'
  | 'layout'
  | 'appearance'
  | 'proofing'
  | 'save'
  | 'advanced'
  | 'accessibility'
  | 'privacy'
  | 'updates'
  | 'shortcuts'
  | 'collaboration'
  | 'sovereignty'

export interface SettingsModalState {
  open: boolean
  activeTab: SettingsTabId
}

const INITIAL_STATE: SettingsModalState = {
  open: false,
  activeTab: 'general'
}

export const _$_settingsModal = (() => {
  const store = writable<SettingsModalState>(INITIAL_STATE)

  function open(activeTab: SettingsTabId = 'general') {
    store.set({
      open: true,
      activeTab
    })
  }

  function close() {
    store.set(INITIAL_STATE)
  }

  function setActiveTab(activeTab: SettingsTabId) {
    store.update((state) => ({
      ...state,
      activeTab
    }))
  }

  return {
    subscribe: store.subscribe,
    open,
    close,
    setActiveTab
  }
})()

export function openSettingsModal(activeTab: SettingsTabId = 'general') {
  _$_settingsModal.open(activeTab)
}
