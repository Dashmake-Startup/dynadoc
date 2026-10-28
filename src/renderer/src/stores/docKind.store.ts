import { derived, readable, type Readable } from 'svelte/store'
import { _$_documentEditorsList } from './editor.store'
import { _$_ribbonContext } from './ribbon.store'

export type DocKind = 'writer' | 'sheets' | 'slides' | 'pdf' | 'design' | 'form' | 'meeting'

const SHEET_EXT = ['.xls', '.xlsx', '.xlsm', '.xlsb', '.csv', '.ods']
const SLIDE_EXT = ['.ppt', '.pptx', '.pps', '.ppsx', '.odp']
const WRITER_EXT = ['.doc', '.docx', '.odt', '.rtf']

/** Map a file extension to its WPS-style document kind (null when unknown). */
export function docKindFromExtension(ext?: string | null): DocKind | null {
  const raw = (ext || '').toLowerCase().trim()
  if (!raw) return null
  const dotted = raw.startsWith('.') ? raw : `.${raw}`
  if (SHEET_EXT.includes(dotted)) return 'sheets'
  if (SLIDE_EXT.includes(dotted)) return 'slides'
  if (WRITER_EXT.includes(dotted)) return 'writer'
  if (dotted === '.pdf') return 'pdf'
  return null
}

/**
 * Map a native document's persisted content type to its kind. This is the
 * authoritative signal for native (.xddoc/.sddoc) documents: it is set at
 * creation and saved in info.json, so it works the moment a document opens —
 * no cursor placement required.
 */
export function docKindFromContentType(contentType?: string | null): DocKind | null {
  switch (contentType) {
    case 'text':
      return 'writer'
    case 'sheet':
      return 'sheets'
    case 'slide':
      return 'slides'
    case 'design':
      return 'design'
    case 'form':
      return 'form'
    case 'meeting':
      return 'meeting'
    default:
      return null
  }
}

/**
 * Kind of the currently active document. Drives the per-type accent colour
 * (Writer = blue, Sheets = green, Presentation = orange, PDF = red) and the
 * ribbon tab set.
 *
 * Native dynadoc files share one extension, so their kind comes from the
 * persisted info.contentType. Imported office files are detected by extension,
 * and embedded spreadsheet/slide nodes by the live editor context. Returns null
 * when no document is open (home screen) so the default Dynadoc teal accent is kept.
 */
export const _$_activeDocKind: Readable<DocKind | null> = readable<DocKind | null>(null, (set) => {
  // Built lazily on first subscription: accessing _$_documentEditorsList at
  // module-eval time triggers a temporal-dead-zone error through the
  // editor.store import cycle.
  const inner = derived(
    [_$_documentEditorsList.getActive(), _$_ribbonContext],
    ([$active, $ctx]): DocKind | null => {
      if (!$active?.document) return null
      // Native documents carry their kind in info.contentType (authoritative,
      // available on open). Imported office files fall back to extension, then
      // to the live editor context for embedded spreadsheet/slide nodes.
      const byContentType = docKindFromContentType($active.document.info?.contentType)
      if (byContentType) return byContentType
      const byExt = docKindFromExtension($active.document.extension)
      if (byExt) return byExt
      if ($ctx?.inSheet) return 'sheets'
      if ($ctx?.inSlide) return 'slides'
      return 'writer'
    }
  )
  return inner.subscribe(set)
})
