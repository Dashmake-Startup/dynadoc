export const IPC_PRESENTATION_START = 'presentation:start'
export const IPC_PRESENTATION_UPDATE = 'presentation:update'
export const IPC_PRESENTATION_NAVIGATE = 'presentation:navigate'
export const IPC_PRESENTATION_DATA = 'presentation:data'
export const IPC_PRESENTATION_WINDOW_FOCUS = 'presentation:window:focus'
export const IPC_PRESENTATION_STOP = 'presentation:stop'

export const IPC_MEETING_START = 'meeting:start'
export const IPC_MEETING_DATA = 'meeting:data'

export interface PresentationPayload {
  html: string
  pageCount: number
  pageWidth: number
  pageHeight: number
  currentIndex: number
  meta?: {
    title?: string
    author?: string
    createdAt?: number
  }
  // Kept loose to avoid importing editor-only types into main/preload builds.
  editorPaginationOptions?: unknown
}

