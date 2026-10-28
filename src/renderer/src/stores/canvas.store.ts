import { derived, get, writable, type Readable } from 'svelte/store'
import type { CanvasCommands } from '../commands/canvasCommands.types'

// export const canvasCommandsStore: CanvasCommands | null = $derived(null)
export const canvasCommandsStore = writable<Map<string, CanvasCommands | null>>(new Map())
// export const canvasCommandsStore = writable<CanvasCommands | null>(null)

export const _$_canvasCommands = {
    subscribe: canvasCommandsStore.subscribe,
    /** 🔎 Subscribe to commands for a specific canvas ID */
    subscribeById(id: string): Readable<CanvasCommands | null | undefined> {
        return derived(canvasCommandsStore, (map) => map.get(id))
    },

    /** 📝 Set / replace commands for a canvas */
    set(id: string, commands: CanvasCommands | null) {
        canvasCommandsStore.update((map) => {
            const next = new Map(map)
            next.set(id, commands)
            return next
        })
    },

    /** 🧹 Remove commands for a canvas */
    unset(id: string) {
        canvasCommandsStore.update((map) => {
            const next = new Map(map)
            next.delete(id)
            return next
        })
    },

    /** 📦 One-shot getter (non-reactive) */
    get(id: string): CanvasCommands | null | undefined {
        return get(canvasCommandsStore).get(id)
    },
    /* set(id: string, commands: CanvasCommands) {
        canvasCommandsStore.update(map => {
            const next = new Map(map)
            next.set(id, commands)
            return next
        })

    }, */

    /* get(id: string): CanvasCommands | undefined {
        return get(canvasCommandsStore).get(id)
    }, */

    delete(id: string) {
        canvasCommandsStore.update(map => {
            const next = new Map(map)
            next.delete(id)
            return next
        })
    },

    clear() {
        canvasCommandsStore.set(new Map())
    },

    /**
   *  Execute a command on a specific canvas
   */
    executeCommand<K extends keyof CanvasCommands>(
        nodeviewId: string,
        commandName: any,
        // commandName: K,
        ...args: any[]
        // ...args: Parameters<CanvasCommands[K]>
    ): ReturnType<CanvasCommands[K]> | void {
        const commands = _$_canvasCommands.get(nodeviewId)

        if (!commands) {
            console.warn(
                `[CanvasCommands] No commands registered for nodeview "${nodeviewId}"`
            )
            return
        }

        const command = commands[commandName]

        if (typeof command !== 'function') {
            console.warn(
                `[CanvasCommands] Command "${String(commandName)}" does not exist on canvas "${nodeviewId}"`
            )
            return
        }

        // 🔥 Execute in correct context
        return command(...args)
    },
}
