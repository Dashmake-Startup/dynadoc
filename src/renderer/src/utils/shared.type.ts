import type { PaginationPlusOptions } from '../extensions/tiptap/utils/common.utils'
import type { PresentationPayload as IpcPresentationPayload } from '../shared/ipc'

export {
  IPC_MEETING_DATA,
  IPC_MEETING_START,
  IPC_PRESENTATION_DATA,
  IPC_PRESENTATION_NAVIGATE,
  IPC_PRESENTATION_START,
  IPC_PRESENTATION_STOP,
  IPC_PRESENTATION_UPDATE,
  IPC_PRESENTATION_WINDOW_FOCUS
} from '../shared/ipc'

export interface PresentationPayload extends IpcPresentationPayload {
  editorPaginationOptions?: PaginationPlusOptions
}
