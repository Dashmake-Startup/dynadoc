// import { derived, get, writable, type Readable } from 'svelte/store'
// import type { CanvasCommands } from '../utils/slideCommands'

// // export const slideCommandsStore: CanvasCommands | null = $derived(null)
// export const slideCommandsStore = writable<Map<string, CanvasCommands | null>>(new Map())
// // export const slideCommandsStore = writable<CanvasCommands | null>(null)

// export const _$_canvasCommands = {
//     subscribe: slideCommandsStore.subscribe,
//     /** 🔎 Subscribe to commands for a specific slide ID */
//     subscribeById(id: string): Readable<CanvasCommands | null | undefined> {
//         return derived(slideCommandsStore, (map) => map.get(id))
//     },

//     /** 📝 Set / replace commands for a slide */
//     set(id: string, commands: CanvasCommands | null) {
//         slideCommandsStore.update((map) => {
//             const next = new Map(map)
//             next.set(id, commands)
//             return next
//         })
//     },

//     /** 🧹 Remove commands for a slide */
//     unset(id: string) {
//         slideCommandsStore.update((map) => {
//             const next = new Map(map)
//             next.delete(id)
//             return next
//         })
//     },

//     /** 📦 One-shot getter (non-reactive) */
//     get(id: string): CanvasCommands | null | undefined {
//         return get(slideCommandsStore).get(id)
//     },
//     /* set(id: string, commands: CanvasCommands) {
//         slideCommandsStore.update(map => {
//             const next = new Map(map)
//             next.set(id, commands)
//             return next
//         })

//     }, */

//     /* get(id: string): CanvasCommands | undefined {
//         return get(slideCommandsStore).get(id)
//     }, */

//     delete(id: string) {
//         slideCommandsStore.update(map => {
//             const next = new Map(map)
//             next.delete(id)
//             return next
//         })
//     },

//     clear() {
//         slideCommandsStore.set(new Map())
//     },
// }

