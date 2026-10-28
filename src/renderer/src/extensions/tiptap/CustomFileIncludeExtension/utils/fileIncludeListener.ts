type FileIncludeHandler = (content: string) => void

const includeListeners = new Map<string, FileIncludeHandler>()
let isListening = false

export function registerFileIncludeListener(callerId: string, handler: FileIncludeHandler) {
  includeListeners.set(callerId, handler)

  if (!isListening && typeof window !== 'undefined') {
    // Listen for custom file-update events dispatched by the web API driver
    // This supports both Push-Pull (web/SSE) and IPC (Electron) architectures
    const handleFileUpdate = (event: CustomEvent) => {
      const content = event.detail
      const listener = includeListeners.get(callerId)
      if (listener && typeof content === 'string') {
        listener(content)
      }
    }

    window.addEventListener(`file-update:${callerId}`, handleFileUpdate as EventListener)

    // Fallback: Also listen for the legacy IPC-based file-changed event
    window.api?.onFileChange?.((content: string, incomingCallerId: string) => {
      const listener = includeListeners.get(incomingCallerId)
      if (listener) {
        listener(content)
      }
    })

    isListening = true
  }

  return () => {
    includeListeners.delete(callerId)
  }
}
