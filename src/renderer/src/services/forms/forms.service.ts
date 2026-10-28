import type { FormSubmissionPayload } from '../../extensions/tiptap/CustomFormFieldExtension/utils/form.utils'
import { resolveApiBaseUrl } from '../../lib/api/shared/baseUrl'
import { getSession } from '../auth/auth.service'

export type FormSubmissionSummary = {
  id: string
  docUuid: string
  responderId?: string
  responderName?: string
  submittedAt?: string
  answers?: Array<{ fieldId: string; name: string; label: string; value: any }>
  metadata?: Record<string, any>
}

export type FormListResponse = {
  ok: boolean
  items?: FormSubmissionSummary[]
  message?: string
}

const serverApi = () => (window as any)?.server

export async function submitFormResponse(payload: FormSubmissionPayload) {
  const api = serverApi()
  if (!api?.forms?.submit) {
    return { ok: false, message: 'Forms API not available' }
  }
  return api.forms.submit(payload)
}

export async function listFormResponses(payload: { docUuid: string }) {
  const api = serverApi()
  if (!api?.forms?.list) {
    return { ok: false, message: 'Forms API not available', items: [] }
  }
  return api.forms.list(payload)
}

export async function getFormResponse(payload: { docUuid: string; submissionId: string }) {
  const api = serverApi()
  if (!api?.forms?.get) {
    return { ok: false, message: 'Forms API not available' }
  }
  return api.forms.get(payload)
}

export async function listFormHistory(payload: { docUuid: string; responderId: string }) {
  const api = serverApi()
  if (api?.forms?.history) {
    return api.forms.history(payload)
  }

  const base = resolveApiBaseUrl()
  const url = `${base}/forms/history?docUuid=${encodeURIComponent(payload.docUuid)}&responderId=${encodeURIComponent(payload.responderId)}`
  const session = await getSession()
  const token = session?.accessToken
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  if (!res.ok) {
    return { ok: false, message: `HTTP ${res.status}` }
  }
  return res.json()
}

export type FormStreamHandle = {
  close: () => void
}

export async function startFormStream(
  payload: { docUuid: string },
  onData: (items: FormSubmissionSummary[]) => void,
  onStatus?: (status: { connected: boolean; message?: string }) => void
): Promise<FormStreamHandle | null> {
  const base = resolveApiBaseUrl()
  const url = `${base}/forms/stream?docUuid=${encodeURIComponent(payload.docUuid)}`
  const session = await getSession()
  const token = session?.accessToken
  const controller = new AbortController()

  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal
    })
    if (!res.ok || !res.body) {
      onStatus?.({ connected: false, message: `HTTP ${res.status}` })
      return null
    }
    onStatus?.({ connected: true })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const readLoop = async () => {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let index
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const rawEvent = buffer.slice(0, index).trim()
          buffer = buffer.slice(index + 2)
          const lines = rawEvent.split('\n')
          const dataLine = lines.find((line) => line.startsWith('data:'))
          if (!dataLine) continue
          const data = dataLine.replace(/^data:\s*/, '')
          try {
            const parsed = JSON.parse(data)
            if (parsed?.items && Array.isArray(parsed.items)) {
              onData(parsed.items)
            }
          } catch {
            // ignore
          }
        }
      }
      onStatus?.({ connected: false, message: 'stream closed' })
    }

    readLoop()
    return {
      close: () => controller.abort()
    }
  } catch (err: any) {
    onStatus?.({ connected: false, message: err?.message || 'stream error' })
    return null
  }
}
