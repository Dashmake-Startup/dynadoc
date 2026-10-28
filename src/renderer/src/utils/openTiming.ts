// Timing of a document open, from the request to the first text in the DOM.
//
// Each step is a performance.mark (prefix "open:"), each one also gets a
// performance.measure from the start, and the run ends in a single structured
// console line a human or a test can read:
//
//   [open-timing] {"docId":"…","source":"share","shareResolvedMs":…,…,"totalMs":…}
//
// Every value is in milliseconds since the open started; a step that did not
// happen is null. Nothing here may change how a document opens: every entry
// point swallows its own errors, and nothing but the document id is recorded.

type Step =
  | 'share-resolved'
  | 'archive-mounted'
  | 'document-loaded'
  | 'content-read'
  | 'persistence-synced'
  | 'room-wait-start'
  | 'room-wait-end'
  | 'editor-created'
  | 'text-visible'

type OpenRecord = {
  docId: string
  source: string
  startTime: number
  steps: Partial<Record<Step, number>>
  roomSynced: boolean | null
  observer: MutationObserver | null
}

const STEPS: Step[] = [
  'share-resolved',
  'archive-mounted',
  'document-loaded',
  'content-read',
  'persistence-synced',
  'room-wait-start',
  'room-wait-end',
  'editor-created',
  'text-visible'
]

// Opens in flight, keyed by document once the document is known. A few at
// most; opens that never reach the editor (already open, failed) age out.
const MAX_RECORDS = 8
const records = new Map<string, OpenRecord>()
// The open that has started but has no document yet.
let pending: OpenRecord | null = null

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const camel = (step: string): string => step.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

function mark(record: OpenRecord, step: Step): void {
  // First write wins: a remount of the editor must not move an earlier step.
  if (record.steps[step] !== undefined) return
  const at = now()
  record.steps[step] = at
  try {
    performance.mark(`open:${step}`, { detail: { docId: record.docId } })
    performance.measure(`open:${step}`, { start: record.startTime, end: at })
  } catch {
    // marks are best effort
  }
}

function finish(record: OpenRecord): void {
  const visibleAt = record.steps['text-visible']
  const line: Record<string, unknown> = { docId: record.docId, source: record.source }
  for (const step of STEPS) {
    const at = record.steps[step]
    line[`${camel(step)}Ms`] = at === undefined ? null : Math.round(at - record.startTime)
  }
  line.roomSynced = record.roomSynced
  line.totalMs = visibleAt === undefined ? null : Math.round(visibleAt - record.startTime)
  // For an open that started with the page (a share link in the URL), this is
  // what the user waited for.
  line.sinceNavigationMs = visibleAt === undefined ? null : Math.round(visibleAt)
  console.info(`[open-timing] ${JSON.stringify(line)}`)
}

function drop(record: OpenRecord): void {
  record.observer?.disconnect()
  record.observer = null
  for (const [key, value] of records) {
    if (value === record) records.delete(key)
  }
}

export const openTiming = {
  // The open was requested (a path, a link, or a new document).
  begin(): void {
    try {
      pending = {
        docId: '',
        source: '',
        startTime: now(),
        steps: {},
        roomSynced: null,
        observer: null
      }
      performance.mark('open:start')
    } catch {
      // ignore
    }
  },

  // A step before the document exists (share resolution, archive mount).
  mark(step: 'share-resolved' | 'archive-mounted'): void {
    if (pending) mark(pending, step)
  },

  // The document is known: from here on the editor finds the record by key.
  documentLoaded(key: string, docId: string, source: string): void {
    const record = pending
    pending = null
    if (!record || !key) return
    record.docId = docId || ''
    record.source = source
    mark(record, 'document-loaded')
    records.set(key, record)
    while (records.size > MAX_RECORDS) {
      const oldest = records.keys().next().value
      if (oldest === undefined) break
      drop(records.get(oldest))
    }
  },

  // The open failed before the editor; forget it.
  abort(): void {
    pending = null
  },

  // The editor side. Returns null when no open is being timed for this
  // document — a remount for other reasons, for instance.
  attach(key: string | null | undefined) {
    const record = key ? records.get(key) : undefined
    if (!record) return null
    return {
      mark(step: 'content-read' | 'persistence-synced' | 'editor-created'): void {
        mark(record, step)
      },
      roomWaitStart(): void {
        mark(record, 'room-wait-start')
      },
      roomWaitEnd(synced: boolean): void {
        record.roomSynced = synced
        mark(record, 'room-wait-end')
      },
      // The editor is shown; record the first moment its DOM carries text.
      watchText(dom: Element | null | undefined): void {
        if (!dom || record.steps['text-visible'] !== undefined) return
        const hasText = () => (dom.textContent || '').trim().length > 0
        const done = () => {
          record.observer?.disconnect()
          record.observer = null
          mark(record, 'text-visible')
          finish(record)
          drop(record)
        }
        try {
          if (hasText()) {
            // The class that hides the editor lifts on the next paint.
            requestAnimationFrame(done)
            return
          }
          record.observer?.disconnect()
          record.observer = new MutationObserver(() => {
            if (hasText()) done()
          })
          record.observer.observe(dom, { childList: true, characterData: true, subtree: true })
        } catch {
          // ignore
        }
      },
      detach(): void {
        record.observer?.disconnect()
        record.observer = null
      }
    }
  }
}

export type OpenTimingHandle = ReturnType<typeof openTiming.attach>
