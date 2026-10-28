/**
 * CustomInternalLinkExtension — public barrel export.
 *
 * Usage in a Tiptap editor:
 *
 *   import { CustomInternalLinkExtension } from './CustomInternalLinkExtension'
 *
 *   const editor = new Editor({
 *     extensions: [
 *       CustomInternalLinkExtension.configure({
 *         onClick: (event, fileId) => dynadocApp.openFile(fileId),
 *         onAltClick: (event, fileId) => dynadocApp.openSplitView(fileId),
 *       }),
 *     ],
 *   })
 *
 * Mount the companion Svelte components once at your workspace layout root:
 *
 *   import InternalLinkPreview from './components/InternalLinkPreview.svelte'
 *   import InternalLinkPicker  from './components/InternalLinkPicker.svelte'
 */

export { CustomInternalLinkExtension } from './CustomInternalLinkExtension'
export type { InternalLinkOptions } from './CustomInternalLinkExtension'

export { internalLinkStore } from './stores/internalLink.store.svelte'
export type { LinkPickerState } from './stores/internalLink.store.svelte'

export type { LinkMeta } from './dbs/db'

export { CustomInternalLinkExtensionProps } from './utils/common.utils'
