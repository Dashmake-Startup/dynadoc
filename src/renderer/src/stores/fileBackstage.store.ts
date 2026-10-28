import { writable } from 'svelte/store'

// Controls the WPS-style "File" backstage overlay.
export const _$_fileBackstageOpen = writable(false)

export function openFileBackstage(): void {
  _$_fileBackstageOpen.set(true)
}

export function closeFileBackstage(): void {
  _$_fileBackstageOpen.set(false)
}

export function toggleFileBackstage(): void {
  _$_fileBackstageOpen.update((v) => !v)
}
