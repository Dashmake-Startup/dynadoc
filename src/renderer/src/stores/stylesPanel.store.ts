import { writable } from 'svelte/store'

// Controls the WPS-style "Styles and Formatting" side panel.
export const _$_stylesPanelVisible = writable(false)

export function toggleStylesPanel(): void {
  _$_stylesPanelVisible.update((v) => !v)
}

export function closeStylesPanel(): void {
  _$_stylesPanelVisible.set(false)
}
