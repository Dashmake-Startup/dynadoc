import { writable } from 'svelte/store'

export type GrammarSettingsTabId =
  | 'overview'
  | 'settings'
  | 'dictionary'
  | 'language'

export interface GrammarSettingsModalState {
  open: boolean
  activeTab: GrammarSettingsTabId
}

const INITIAL_STATE: GrammarSettingsModalState = {
  open: false,
  activeTab: 'overview'
}

export const _$_grammarSettingsModal = (() => {
  const store = writable<GrammarSettingsModalState>(INITIAL_STATE)

  function open(activeTab: GrammarSettingsTabId = 'overview') {
    store.set({
      open: true,
      activeTab
    })
  }

  function close() {
    store.set(INITIAL_STATE)
  }

  function setActiveTab(activeTab: GrammarSettingsTabId) {
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

export function openGrammarSettingsModal(activeTab: GrammarSettingsTabId = 'overview') {
  _$_grammarSettingsModal.open(activeTab)
}