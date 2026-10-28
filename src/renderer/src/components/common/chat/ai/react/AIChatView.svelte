<script lang="ts">
  import { nodeApi } from '../../../../../utils/shims/node'
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import Utils from '../../../../../utils/Utils'
  import { createRoot } from 'react-dom/client'
  import React from 'react'
  import { Chat } from './AIChat'
  import { authStore } from '../../../../../stores/auth.store'
  import { openAlertModal } from '../../../../../stores/alertModal.store'
  import { openTextInputModal } from '../../../../../stores/textInputModal.store'
  import DetachedPanel from '../../../../../extensions/tiptap/components/common/DetachedPanel.svelte'
  import { _$_wysiwygEditorsList, _$_documentEditorsList } from '../../../../../stores/editor.store'
  import EditorCommonUtils, { cryptoRandomUUID } from '../../../../../utils/common.utils'
  import { notifyAiFreePlanNotice } from '../../../../../utils/ai/aiFreePlanNotice'

  type ChatSession = {
    id: string
    title: string
    difyId: string
    createdAt: string
    updatedAt: string
  }

  type DatasetItem = {
    id: string
    name: string
    document_count?: number
    created_at?: string
    [key: string]: any
  }

  type UploadProgress = {
    file: string
    index: number
    total: number
    percent: number
    status: string
  }

  let { conversationId } = $props()
  let hiddenStorage: HTMLDivElement
  let activeContainer: HTMLDivElement | null = null
  let activeSessionId = $state('')
  let sessionFilter = $state('')
  let datasetIdOverride = $state('')
  let uploadStatus = $state('')
  let sidebarOpen = $state(false)
  // let sidebarOpen = $state(true)
  let teleportTarget: HTMLElement | null = null
  let datasetMenuOpen = $state(false)
  let datasets = $state<DatasetItem[]>([])
  let datasetsLoading = $state(false)
  let uploadProgress = $state<UploadProgress[]>([])
  let transcriptBySession = $state<Record<string, any[]>>({})
  let attachmentsBySession = $state<Record<string, any[]>>({})
  let contextEnabledBySession = $state<Record<string, boolean>>({})
  let sessionSummaryById = $state<Record<string, string>>({})
  let sessionTitleManuallySetById = $state<Record<string, boolean>>({})
  let lastWorkspaceKey = $state('')
  let datasetSearch = $state('')
  let datasetScope = $state<'org' | 'user' | 'all'>('org')
  let datasetPage = $state(1)
  const datasetsPerPage = 10
  let exportMenuOpen = $state(false)
  let serverSyncing = $state(false)
  let serverSyncError = $state('')

  let authState = $derived($authStore)
  let activeWorkspace = $derived(authState.activeOrg || authState.user?.organization || 'personal')
  let selectedDatasetName = $derived(
    datasets.find((item) => item.id === datasetIdOverride)?.name || datasetIdOverride || ''
  )
  let datasetLabel = $derived(
    datasetIdOverride
      ? `Dataset: ${selectedDatasetName || datasetIdOverride}`
      : activeWorkspace
        ? `Dataset: ${activeWorkspace}`
        : 'Dataset: default'
  )

  const sessionStorageKey = 'dynadoc.ai.chat.sessions'
  const transcriptStorageKey = 'dynadoc.ai.chat.transcripts'
  const datasetStorageKey = 'dynadoc.ai.chat.datasets'
  const pendingSyncStorageKey = 'dynadoc.ai.chat.pendingSync'
  const lastActiveSessionStorageKey = 'dynadoc.ai.chat.lastActiveSession'
  const sessionContainers = new Map<string, HTMLDivElement>()
  const sessionRoots = new Map<string, ReturnType<typeof createRoot>>()

  function nowISO() {
    return new Date().toISOString()
  }

  function generateId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return cryptoRandomUUID()
    }
    return `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  function getActiveDocContext() {
    const editor = _$_wysiwygEditorsList?.getActive2?.()
    const activeDoc = _$_documentEditorsList?.getActiveSync?.()
    const content = editor?.getText?.() || ''
    return {
      content: content.trim(),
      title: activeDoc?.document?.documentName || activeDoc?.document?.name || '',
      docId: activeDoc?.document?.id || activeDoc?.document?.uuid || ''
    }
  }

  function updateGlobalContext(sessionId: string, enabled: boolean) {
    const context = enabled ? getActiveDocContext() : { content: '', title: '', docId: '' }
    ;(window as any).__dynadocAiContext = {
      enabled,
      content: context.content,
      title: context.title,
      docId: context.docId,
      updatedAt: nowISO()
    }
    window.dispatchEvent(
      new CustomEvent('ai:context-updated', {
        detail: { sessionId, enabled }
      })
    )
  }

  function updateGlobalAttachments(sessionId: string) {
    const attachments = attachmentsBySession?.[sessionId] || []
    const map = (window as any).__dynadocAiAttachmentsMap || {}
    map[sessionId] = attachments
    ;(window as any).__dynadocAiAttachmentsMap = map
    window.dispatchEvent(
      new CustomEvent('ai:attachments-updated', {
        detail: { sessionId, attachments }
      })
    )
  }

  function loadSessions(): ChatSession[] {
    try {
      const raw = localStorage.getItem(sessionStorageKey)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      // Back-compat: older sessions won't have difyId yet.
      return parsed.map((item: any) => ({
        id: String(item?.id || ''),
        title: String(item?.title || 'New chat'),
        difyId: String(item?.difyId || ''),
        createdAt: String(item?.createdAt || nowISO()),
        updatedAt: String(item?.updatedAt || nowISO())
      }))
    } catch {
      return []
    }
  }

  function persistSessions(sessions: ChatSession[]) {
    localStorage.setItem(sessionStorageKey, JSON.stringify(sessions))
  }

  function loadPendingSync(): Record<string, any> {
    try {
      const raw = localStorage.getItem(pendingSyncStorageKey)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  function persistPendingSync(map: Record<string, any>) {
    try {
      localStorage.setItem(pendingSyncStorageKey, JSON.stringify(map || {}))
    } catch {
      // ignore
    }
  }

  function loadLastActiveSessionMap(): Record<string, string> {
    try {
      const raw = localStorage.getItem(lastActiveSessionStorageKey)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  function persistLastActiveSession(workspaceKey: string, sessionId: string) {
    try {
      const map = loadLastActiveSessionMap()
      map[String(workspaceKey || 'default')] = String(sessionId || '')
      localStorage.setItem(lastActiveSessionStorageKey, JSON.stringify(map))
    } catch {
      // ignore
    }
  }

  function getLastActiveSessionId(workspaceKey: string) {
    const map = loadLastActiveSessionMap()
    return String(map?.[String(workspaceKey || 'default')] || '').trim()
  }

  let sessions = $state<ChatSession[]>([])

  type TranscriptEntry = {
    role: string
    text: string
    createdAt?: string
  }

  type TranscriptStore = Record<string, TranscriptEntry[]>
  const SUMMARY_PENDING = '__PENDING__'
  const metaRequestKeyBySession = new Map<string, string>()
  const syncTimersBySession = new Map<string, ReturnType<typeof setTimeout>>()
  const hydratedFromServer = new Set<string>()

  function loadTranscripts(): TranscriptStore {
    try {
      const raw = localStorage.getItem(transcriptStorageKey)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  function persistTranscripts(map: TranscriptStore) {
    localStorage.setItem(transcriptStorageKey, JSON.stringify(map))
  }

  function transcriptToThreadMessages(transcript: TranscriptEntry[] = []) {
    return transcript
      .filter((entry) => entry?.text?.trim())
      .map((entry) => ({
        role: entry.role,
        content: [{ type: 'text', text: entry.text }]
      }))
  }

  function getTranscriptForSession(sessionId: string) {
    return transcriptBySession?.[sessionId] || loadTranscripts()?.[sessionId] || []
  }

  function transcriptFingerprint(transcript: TranscriptEntry[] = []) {
    const last = transcript[transcript.length - 1]
    const prev = transcript[transcript.length - 2]
    const lastKey = last ? `${last.role}:${String(last.text || '').slice(0, 96)}` : ''
    const prevKey = prev ? `${prev.role}:${String(prev.text || '').slice(0, 64)}` : ''
    return `${transcript.length}:${lastKey}:${prevKey}`
  }

  function chatMountKeyForSession(sessionId: string): string {
    const transcript = getTranscriptForSession(sessionId)
    const session = sessions.find((s) => s.id === sessionId)
    const difyId = session?.difyId || ''
    const msgCount = transcript?.length || 0
    const lastMsg = transcript?.[transcript.length - 1]
    const lastText = lastMsg?.content?.[0]?.text?.slice(0, 40) || ''
    // Key changes when message count or content changes → forces remount
    return `${sessionId}:${difyId}:${msgCount}:${lastText}`
  }

  function renderChat(sessionId: string) {
    const root = sessionRoots.get(sessionId)
    const container = sessionContainers.get(sessionId)
    if (!root || !container) return
    const initialMessages = transcriptToThreadMessages(getTranscriptForSession(sessionId))
    const initialDifyId = sessions.find((s) => s.id === sessionId)?.difyId || ''
    const key = chatMountKeyForSession(sessionId)
    root.render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(Chat, {
          key, // <-- this forces full remount including useLocalRuntime
          sessionId,
          initialMessages,
          initialDifyId
        })
      )
    )

    // Extra safety: reset the runtime thread after async hydration/session switch.
    // This avoids relying on `initialMessages` being consumed only once.
    try {
      window.dispatchEvent(
        new CustomEvent('ai:thread-reset', {
          detail: { sessionId, initialMessages, initialDifyId }
        })
      )
    } catch {
      // ignore
    }
  }

  function scheduleSyncSession(sessionId: string) {
    if (!sessionId) return
    const existing = syncTimersBySession.get(sessionId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      syncTimersBySession.delete(sessionId)
      const transcript = getTranscriptForSession(sessionId)
      void syncSessionToServer(sessionId, transcript)
    }, 600)
    syncTimersBySession.set(sessionId, timer)
  }

  async function runAiOneShot(prompt: string, requestId: string) {
    if (!(window as any)?.server?.ai?.generate) return ''
    notifyAiFreePlanNotice({ source: 'AI Chat' })
    return new Promise<string>((resolve) => {
      let buffer = ''
      const offChunk = (window as any).server.ai.onChunk((data: any) => {
        if (data?.requestId && data.requestId !== requestId) return
        buffer += typeof data === 'string' ? data : String(data?.content || '')
      })
      const offDone = (window as any).server.ai.onDone((data: any) => {
        if (data?.requestId && data.requestId !== requestId) return
        offChunk?.()
        offDone?.()
        resolve((data?.fullData || buffer || '').trim())
      })
      ;(window as any).server.ai.generate(prompt, requestId)
      setTimeout(() => {
        offChunk?.()
        offDone?.()
        resolve(buffer.trim())
      }, 12000)
    })
  }

  function heuristicTitle(text: string) {
    const cleaned = text.replace(/\s+/g, ' ').trim()
    if (!cleaned) return 'New chat'
    return cleaned.slice(0, 60)
  }

  function heuristicSummary(transcript: TranscriptEntry[]) {
    const userText = transcript
      .filter((t) => t.role === 'user')
      .map((t) => t.text)
      .join(' ')
      .trim()
    if (!userText) return ''
    return userText.slice(0, 180)
  }

  async function generateTitleAndSummary(sessionId: string, transcript: TranscriptEntry[]) {
    if (!transcript.length) return { title: '', summary: '' }
    const firstUserIndex = transcript.findIndex((t) => t.role === 'user' && t.text?.trim())
    const firstUser = firstUserIndex >= 0 ? transcript[firstUserIndex] : null
    const firstAssistantAfter =
      firstUserIndex >= 0
        ? transcript.slice(firstUserIndex + 1).find((t) => t.role === 'assistant' && t.text?.trim())
        : null
    const lastUser = [...transcript].reverse().find((t) => t.role === 'user' && t.text?.trim())

    const allowTitleOverwrite = !sessionTitleManuallySetById?.[sessionId]
    const titleBasis = [
      firstUser?.text || lastUser?.text || '',
      firstAssistantAfter?.text ? `Assistant: ${firstAssistantAfter.text}` : ''
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 1200)

    const titlePrompt = `Generate a concise chat title (max 6 words) for:\n${titleBasis}`
    const summaryPrompt = `Summarize this conversation in one short sentence: ${transcript
      .map((t) => `${t.role}: ${t.text}`)
      .join(' ')}`.slice(0, 1800)

    const titleRequestId = `meta-title-${sessionId}-${Date.now()}`
    const summaryRequestId = `meta-summary-${sessionId}-${Date.now()}`

    let title = ''
    if (allowTitleOverwrite) {
      title = await runAiOneShot(titlePrompt, titleRequestId)
      if (!title) title = heuristicTitle(firstUser?.text || lastUser?.text || '')
    }
    let summary = await runAiOneShot(summaryPrompt, summaryRequestId)
    if (!summary) summary = heuristicSummary(transcript)

    return {
      title: title.replace(/[\n\r]+/g, ' ').trim(),
      summary: summary.replace(/[\n\r]+/g, ' ').trim()
    }
  }

  function ensureSessionContainer(sessionId: string) {
    if (sessionContainers.has(sessionId)) {
      return
    }
    const container = document.createElement('div')
    container.className = 'h-full w-full'
    const root = createRoot(container)
    sessionContainers.set(sessionId, container)
    sessionRoots.set(sessionId, root)
    hiddenStorage?.appendChild(container)
    renderChat(sessionId)
  }

  async function hydrateSessionFromServer(sessionId: string) {
    console.log('ai:generate Hydrating session from server:', {
      sessionId,
      hydratedFromServer,
      authState
    })
    const api = (window as any)?.server?.chat
    if (!api || !authState?.authenticated) return
    if (!sessionId) return
    if (hydratedFromServer.has(sessionId)) return
    console.log('ai:generate Hydrating session from server 2:', { sessionId })

    // If we already have messages locally, we don't need to fetch.
    /* const localTranscript = getTranscriptForSession(sessionId)
    if (Array.isArray(localTranscript) && localTranscript.length) {
      hydratedFromServer.add(sessionId)
      return
    }  */
    console.log('ai:generate Hydrating session from server 3:', { sessionId })

    const response = await api.getSession({ sessionId })
    console.log('ai:generate Hydrating session from server response:', { response, sessionId })

    if (!response || response.ok === false) return

    const mapped = mapServerSession(response)
    if (mapped) {
      sessions = sessions.map((s) => (s.id === mapped.id ? { ...s, ...mapped } : s))
      persistSessions(sessions)
    }
    console.log('ai:generate Hydrating session from server mapped:', {
      mapped,
      response,
      sessionId
    })

    const transcript = parseServerTranscript(
      response?.transcript_json ||
        response?.transcriptJSON ||
        response?.TranscriptJSON ||
        response?.transcript
    )
    if (transcript.length) {
      const mergedTranscripts = { ...loadTranscripts(), [sessionId]: transcript }
      persistTranscripts(mergedTranscripts)
      transcriptBySession = { ...transcriptBySession, [sessionId]: transcript }
    }

    renderChat(sessionId)

    hydratedFromServer.add(sessionId)
  }

  async function setActiveSession(sessionId: string) {
    if (!sessionId) return
    if (activeSessionId === sessionId) return
    if (activeContainer && hiddenStorage) {
      hiddenStorage.appendChild(activeContainer)
    }
    ensureSessionContainer(sessionId)
    await hydrateSessionFromServer(sessionId)
    activeSessionId = sessionId
    activeContainer = sessionContainers.get(sessionId) || null
    attachActiveContainer()
    updateGlobalAttachments(sessionId)
    updateGlobalContext(sessionId, Boolean(contextEnabledBySession?.[sessionId]))
    persistLastActiveSession(getWorkspaceDatasetKey(), sessionId)
  }

  function attachActiveContainer() {
    if (!teleportTarget || !activeContainer) return
    teleportTarget.innerHTML = ''
    teleportTarget.appendChild(activeContainer)
  }

  function createSession(title?: string) {
    const id = generateId()
    const label = title?.trim() || `New chat ${sessions.length + 1}`
    const session: ChatSession = {
      id,
      title: label,
      difyId: '',
      createdAt: nowISO(),
      updatedAt: nowISO()
    }
    sessions = [session, ...sessions]
    persistSessions(sessions)
    transcriptBySession = { ...transcriptBySession, [id]: [] }
    persistTranscripts({ ...loadTranscripts(), [id]: [] })
    attachmentsBySession = { ...attachmentsBySession, [id]: [] }
    contextEnabledBySession = { ...contextEnabledBySession, [id]: false }
    ensureSessionContainer(id)
    setActiveSession(id)
    syncSessionToServer(id, [])
  }

  async function renameSession(session: ChatSession) {
    const updated = await openTextInputModal({
      title: 'Rename chat',
      message: 'Give this conversation a clearer name.',
      placeholder: session.title,
      confirmText: 'Rename'
    })
    if (!updated) return
    sessionTitleManuallySetById = { ...sessionTitleManuallySetById, [session.id]: true }
    sessions = sessions.map((item) =>
      item.id === session.id ? { ...item, title: updated, updatedAt: nowISO() } : item
    )
    persistSessions(sessions)
    scheduleSyncSession(session.id)
  }

  function removeSession(session: ChatSession) {
    sessions = sessions.filter((item) => item.id !== session.id)
    persistSessions(sessions)

    const container = sessionContainers.get(session.id)
    const root = sessionRoots.get(session.id)
    if (container && container.parentElement) {
      container.parentElement.removeChild(container)
    }
    root?.unmount()
    sessionContainers.delete(session.id)
    sessionRoots.delete(session.id)
    const updatedTranscripts = { ...loadTranscripts() }
    delete updatedTranscripts[session.id]
    persistTranscripts(updatedTranscripts)
    const nextTranscripts = { ...transcriptBySession }
    delete nextTranscripts[session.id]
    transcriptBySession = nextTranscripts
    const nextAttachments = { ...attachmentsBySession }
    delete nextAttachments[session.id]
    attachmentsBySession = nextAttachments
    const nextContext = { ...contextEnabledBySession }
    delete nextContext[session.id]
    contextEnabledBySession = nextContext
    const nextSummary = { ...sessionSummaryById }
    delete nextSummary[session.id]
    sessionSummaryById = nextSummary
    ;(window as any)?.server?.chat?.deleteSession?.({ sessionId: session.id })

    if (activeSessionId === session.id) {
      const fallback = sessions[0]?.id
      if (fallback) {
        setActiveSession(fallback)
      } else {
        createSession()
      }
    }
  }

  function teleport(node: HTMLElement) {
    teleportTarget = node
    attachActiveContainer()
    return {
      destroy() {
        if (activeContainer && hiddenStorage) {
          hiddenStorage.appendChild(activeContainer)
        }
        if (teleportTarget === node) {
          teleportTarget = null
        }
      }
    }
  }

  async function handleShare() {
    if (!activeSessionId) return
    const transcript = transcriptBySession?.[activeSessionId] || []
    const payload = JSON.stringify({
      type: 'dynadoc-ai-chat',
      sessionId: activeSessionId,
      title: sessions.find((s) => s.id === activeSessionId)?.title || 'Chat',
      workspace: activeWorkspace,
      datasetId: datasetIdOverride || '',
      updatedAt: nowISO(),
      messages: transcript
    })
    try {
      await EditorCommonUtils.copyToClipboard(payload)
      uploadStatus = 'Share link copied.'
      setTimeout(() => (uploadStatus = ''), 1400)
    } catch {
      await openAlertModal({
        title: 'Share',
        message: payload
      })
    }
  }

  async function handleDatasetConfig() {
    const value = await openTextInputModal({
      title: 'Dataset ID',
      message: 'Optional: override the default Dify dataset for uploads.',
      placeholder: datasetIdOverride || 'dataset-id',
      confirmText: 'Save'
    })
    if (value === null) return
    datasetIdOverride = value?.trim() || ''
  }

  function mapServerSession(serverSession: any): ChatSession | null {
    if (!serverSession) return null
    const id =
      serverSession.session_id ||
      serverSession.sessionId ||
      serverSession.SessionID ||
      serverSession.sessionID
    if (!id) return null
    let difyId = String(
      serverSession.difyId ||
        serverSession.dify_id ||
        serverSession.difyConversationId ||
        serverSession.conversationID ||
        serverSession.ConversationID ||
        serverSession.conversation_id ||
        serverSession.conversationId ||
        ''
    )
    if (!difyId) {
      const metaRaw =
        serverSession.metadata ||
        serverSession.metadata_json ||
        serverSession.metadataJSON ||
        serverSession.MetadataJSON ||
        null
      let meta: any = null
      if (metaRaw && typeof metaRaw === 'string') {
        try {
          meta = JSON.parse(metaRaw)
        } catch {
          meta = null
        }
      } else if (metaRaw && typeof metaRaw === 'object') {
        meta = metaRaw
      }
      if (meta) {
        difyId = String(meta.difyId || meta.conversation_id || meta.conversationId || '') || ''
      }
    }
    return {
      id: String(id),
      title: String(serverSession.title || 'New chat'),
      difyId,
      createdAt: serverSession.created_at || serverSession.createdAt || nowISO(),
      updatedAt: serverSession.updated_at || serverSession.updatedAt || nowISO()
    }
  }

  function parseServerTranscript(value: any): TranscriptEntry[] {
    if (!value) return []
    if (Array.isArray(value)) return value as TranscriptEntry[]
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  async function syncFromServer() {
    const api = (window as any)?.server?.chat
    if (!api || !authState?.authenticated) return
    serverSyncing = true
    serverSyncError = ''
    try {
      const response = await api.listSessions()
      if (!response?.ok) {
        serverSyncError = response?.message || 'Sync failed'
        return
      }
      const remoteSessionsRaw = Array.isArray(response?.sessions) ? response.sessions : []
      const remoteSessions: ChatSession[] = []
      const remoteTranscripts: Record<string, TranscriptEntry[]> = {}
      const remoteSummaries: Record<string, string> = {}

      for (const item of remoteSessionsRaw) {
        const mapped = mapServerSession(item)
        if (!mapped) continue
        remoteSessions.push(mapped)
        const transcript = parseServerTranscript(
          item?.transcript_json || item?.transcriptJSON || item?.TranscriptJSON || item?.transcript
        )
        if (transcript.length) remoteTranscripts[mapped.id] = transcript
        if (item?.summary) remoteSummaries[mapped.id] = String(item.summary)
      }

      const merged: ChatSession[] = []
      const localMap = new Map(sessions.map((s) => [s.id, s]))
      for (const remote of remoteSessions) {
        const local = localMap.get(remote.id)
        if (!local) {
          merged.push(remote)
          continue
        }
        const remoteUpdated = new Date(remote.updatedAt).getTime()
        const localUpdated = new Date(local.updatedAt).getTime()
        merged.push(remoteUpdated >= localUpdated ? remote : local)
        localMap.delete(remote.id)
      }
      merged.push(...Array.from(localMap.values()))
      merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

      sessions = merged
      persistSessions(sessions)

      if (Object.keys(remoteTranscripts).length) {
        const mergedTranscripts = { ...transcriptBySession, ...remoteTranscripts }
        transcriptBySession = mergedTranscripts
        persistTranscripts(mergedTranscripts)
      }
      if (Object.keys(remoteSummaries).length) {
        sessionSummaryById = { ...sessionSummaryById, ...remoteSummaries }
      }

      // Re-render existing session roots after transcripts merge, so React always sees the latest history + difyId.
      for (const s of merged) {
        renderChat(s.id)
      }
    } finally {
      serverSyncing = false
    }
  }

  async function syncSessionToServer(sessionId: string, transcript: TranscriptEntry[]) {
    const api = (window as any)?.server?.chat
    if (!api || !authState?.authenticated) return
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return
    const rawSummary = sessionSummaryById?.[sessionId] || ''
    const summary = rawSummary === SUMMARY_PENDING ? '' : rawSummary
    const payload = {
      sessionId: session.id,
      title: session.title,
      difyId: session.difyId || '',
      summary,
      transcript,
      messageCount: transcript.length,
      lastMessageAt: session.updatedAt,
      updatedAt: session.updatedAt,
      createdAt: session.createdAt,
      metadata: {
        workspace: activeWorkspace,
        datasetId: datasetIdOverride || '',
        difyId: session.difyId || '',
        attachments: attachmentsBySession?.[sessionId] || [],
        contextEnabled: contextEnabledBySession?.[sessionId] || false
      }
    }
    try {
      const safePayload = JSON.parse(JSON.stringify(payload))
      await api.upsertSession(safePayload)
      const pending = loadPendingSync()
      if (pending?.[sessionId]) {
        delete pending[sessionId]
        persistPendingSync(pending)
      }
    } catch {
      const pending = loadPendingSync()
      pending[sessionId] = { payload, updatedAt: nowISO() }
      persistPendingSync(pending)
      await api.upsertSession({
        sessionId: session.id,
        title: session.title,
        difyId: session.difyId || '',
        transcript: transcript.map((t) => ({ role: t.role, text: t.text })),
        messageCount: transcript.length,
        lastMessageAt: session.updatedAt,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt
      })
    }
  }

  async function flushPendingSync() {
    const api = (window as any)?.server?.chat
    if (!api || !authState?.authenticated) return
    const pending = loadPendingSync()
    const entries = Object.entries(pending || {})
    if (!entries.length) return
    for (const [sessionId, item] of entries) {
      try {
        const payload = item?.payload || item
        if (!payload?.sessionId) continue
        await api.upsertSession(payload)
        const next = loadPendingSync()
        if (next?.[sessionId]) {
          delete next[sessionId]
          persistPendingSync(next)
        }
      } catch {
        // keep for later retry
      }
    }
  }

  function getWorkspaceDatasetKey() {
    return activeWorkspace || 'default'
  }

  function loadDatasetSelections(): Record<string, string> {
    try {
      const raw = localStorage.getItem(datasetStorageKey)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  function saveDatasetSelections(map: Record<string, string>) {
    localStorage.setItem(datasetStorageKey, JSON.stringify(map))
  }

  async function refreshDatasets() {
    const listApi = (window as any)?.server?.dify?.listDatasets
    if (!listApi) return
    datasetsLoading = true
    try {
      const result = await listApi({ page: 1, limit: 100, scope: datasetScope })
      const payload = result?.data || result?.raw || result
      const items = payload?.datasets || payload?.data || payload?.items || []
      datasets = Array.isArray(items) ? items : []
    } finally {
      datasetsLoading = false
    }
  }

  function selectDataset(dataset: DatasetItem) {
    const selectionMap = loadDatasetSelections()
    const key = getWorkspaceDatasetKey()
    selectionMap[key] = dataset?.id || ''
    saveDatasetSelections(selectionMap)
    datasetIdOverride = dataset?.id || ''
    datasetMenuOpen = false
  }

  function clearDatasetSelection() {
    const selectionMap = loadDatasetSelections()
    const key = getWorkspaceDatasetKey()
    delete selectionMap[key]
    saveDatasetSelections(selectionMap)
    datasetIdOverride = ''
    datasetMenuOpen = false
  }

  async function handleUploadDocuments() {
    const openDialog = (window as any)?.api?.openDialogFiles
    const uploader = (window as any)?.server?.dify?.uploadDocuments
    if (!openDialog || !uploader) {
      await openAlertModal({
        title: 'Upload',
        message: 'Dataset upload is not available in this build.'
      })
      return
    }

    uploadStatus = 'Select files to upload...'
    const selection = await openDialog({
      filters: [
        {
          name: 'Documents',
          extensions: [
            Utils.FILE_TYPES.pdf,
            Utils.OFFICE_EXTENSIONS_FORMAT.word,
            'txt',
            'md',
            'html',
            Utils.OFFICE_EXTENSIONS_FORMAT.powerpoint,
            Utils.OFFICE_EXTENSIONS_FORMAT.excel
          ]
        },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    const filePaths = Array.isArray(selection)
      ? selection
      : Array.isArray(selection?.filePaths)
        ? selection.filePaths
        : []
    if (!filePaths.length) {
      uploadStatus = ''
      return
    }

    uploadStatus = 'Uploading...'
    const result = await uploader({
      localPaths: filePaths,
      datasetId: datasetIdOverride || undefined
    })
    if (!result?.ok) {
      uploadStatus = ''
      await openAlertModal({
        title: 'Upload failed',
        message: result?.message || 'Unable to upload documents.'
      })
      return
    }

    uploadStatus = `Uploaded ${result?.uploaded?.length || 0} files.`
    setTimeout(() => (uploadStatus = ''), 2000)
  }

  async function handleExport(format: 'json' | 'md') {
    if (!activeSessionId) return
    exportMenuOpen = false
    const transcript = transcriptBySession?.[activeSessionId] || []
    const title = sessions.find((s) => s.id === activeSessionId)?.title || 'Chat'

    let content = ''
    let defaultName = `${title.replace(/[^\w\-]+/g, '_') || 'chat'}`
    if (format === 'json') {
      content = JSON.stringify(
        {
          type: 'dynadoc-ai-chat',
          sessionId: activeSessionId,
          title,
          workspace: activeWorkspace,
          datasetId: datasetIdOverride || '',
          updatedAt: nowISO(),
          messages: transcript
        },
        null,
        2
      )
      defaultName += '.json'
    } else {
      const lines: string[] = []
      lines.push(`# ${title}`)
      lines.push(`- Workspace: ${activeWorkspace}`)
      lines.push(`- Dataset: ${datasetIdOverride || 'default'}`)
      lines.push(`- Updated: ${nowISO()}`)
      lines.push('')
      for (const entry of transcript) {
        const role = String(entry?.role || 'assistant')
        const text = String(entry?.text || '')
        lines.push(`## ${role === 'user' ? 'User' : 'Assistant'}`)
        lines.push(text)
        lines.push('')
      }
      content = lines.join('\n')
      defaultName += '.md'
    }

    const saveDialog = (window as any)?.api?.saveDialogFile
    // const  fs = (window as any)?.node?.fs
    if (!saveDialog || !nodeApi.fs?.writeFile) {
      await openAlertModal({
        title: 'Export',
        message: 'File export is not available in this build.'
      })
      return
    }

    const savePath = await saveDialog({
      title: 'Export Chat',
      defaultPath: defaultName,
      filters:
        format === 'json'
          ? [{ name: 'JSON', extensions: ['json'] }]
          : [{ name: 'Markdown', extensions: ['md'] }]
    })

    if (!savePath) return
    await new Promise<void>((resolve, reject) => {
      nodeApi.fs.writeFile(savePath, content, 'utf8', (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    uploadStatus = `Exported ${format.toUpperCase()}`
    setTimeout(() => (uploadStatus = ''), 1400)
  }

  onMount(() => {
    sessions = loadSessions()
    transcriptBySession = loadTranscripts()
    if (!sessions.length) {
      createSession('New chat')
    } else {
      const existing = conversationId && sessions.find((item) => item.id === conversationId)
      const saved = getLastActiveSessionId(getWorkspaceDatasetKey())
      const savedExists = saved && sessions.some((s) => s.id === saved)
      const initial = existing?.id || (savedExists ? saved : sessions[0].id)
      ensureSessionContainer(initial)
      void setActiveSession(initial)
    }

    const selectionMap = loadDatasetSelections()
    const saved = selectionMap[getWorkspaceDatasetKey()]
    datasetIdOverride = saved || ''
    refreshDatasets()
    syncFromServer()
    flushPendingSync()

    const uploader = (window as any)?.server?.dify?.onUploadProgress
    const off = uploader?.((payload: UploadProgress) => {
      uploadProgress = uploadProgress.filter((item) => item.file !== payload.file).concat(payload)
      if (payload.status === 'done' || payload.status === 'failed') {
        setTimeout(() => {
          uploadProgress = uploadProgress.filter((item) => item.file !== payload.file)
        }, 1800)
      }
    })

    const updateListener = (event: any) => {
      const detail = event?.detail || {}
      if (!detail?.sessionId) return
      const nextTranscript = Array.isArray(detail.transcript) ? detail.transcript : []
      const updatedMap = { ...loadTranscripts(), [detail.sessionId]: nextTranscript }
      persistTranscripts(updatedMap)
      transcriptBySession = { ...transcriptBySession, [detail.sessionId]: nextTranscript }

      sessions = sessions.map((item) => {
        if (item.id !== detail.sessionId) return item
        const shouldRename =
          item.title.toLowerCase().startsWith('new chat') ||
          item.title.toLowerCase().startsWith('untitled') ||
          item.title.toLowerCase().startsWith('chat ')
        const suggested = (detail.firstUserMessage || detail.lastUserMessage || '')
          .toString()
          .trim()
          .slice(0, 48)
        const title = shouldRename && suggested ? suggested : item.title
        return { ...item, title, updatedAt: detail.updatedAt || nowISO() }
      })
      persistSessions(sessions)

      const sessionId = detail.sessionId
      const metaKey = transcriptFingerprint(nextTranscript)
      const summaryExisting = sessionSummaryById?.[sessionId]
      const isPending = summaryExisting === SUMMARY_PENDING
      const shouldGenerate = nextTranscript.length >= 2

      if (shouldGenerate) {
        const previousKey = metaRequestKeyBySession.get(sessionId) || ''
        const shouldStartOrRestart =
          (!summaryExisting || isPending) && (!isPending || previousKey !== metaKey)

        if (shouldStartOrRestart) {
          metaRequestKeyBySession.set(sessionId, metaKey)
          // Mark as pending immediately to prevent duplicate triggers.
          sessionSummaryById = { ...sessionSummaryById, [sessionId]: SUMMARY_PENDING }

          generateTitleAndSummary(sessionId, nextTranscript).then((meta) => {
            // Ignore stale completions (user sent new messages while we were generating).
            if (metaRequestKeyBySession.get(sessionId) !== metaKey) return
            metaRequestKeyBySession.delete(sessionId)

            if (meta.title) {
              sessions = sessions.map((item) =>
                item.id === sessionId ? { ...item, title: meta.title, updatedAt: nowISO() } : item
              )
              persistSessions(sessions)
            }

            const nextSummary = meta.summary || ''
            sessionSummaryById = {
              ...sessionSummaryById,
              [sessionId]: nextSummary
            }
            scheduleSyncSession(sessionId)
          })
        }
      }

      scheduleSyncSession(sessionId)
    }
    window.addEventListener('ai:conversation-updated', updateListener)

    const difyIdListener = (event: any) => {
      const detail = event?.detail || {}
      const sessionId = String(detail.sessionId || '').trim()
      const difyId = String(
        detail.difyId || detail.conversation_id || detail.conversationId || ''
      ).trim()
      if (!sessionId || !difyId) return

      const existing = sessions.find((s) => s.id === sessionId)
      if (!existing) return
      if (existing.difyId === difyId) return

      sessions = sessions.map((s) =>
        s.id === sessionId ? { ...s, difyId, updatedAt: nowISO() } : s
      )
      persistSessions(sessions)
      scheduleSyncSession(sessionId)
    }
    window.addEventListener('ai:dify-id-updated', difyIdListener)

    const toastListener = (event: any) => {
      const message = event?.detail?.message
      if (!message) return
      uploadStatus = message
      setTimeout(() => (uploadStatus = ''), 1400)
    }
    window.addEventListener('ai:toast', toastListener)

    const attachListener = async (event: any) => {
      const detail = event?.detail || {}
      const sessionId = detail.sessionId || activeSessionId
      if (!sessionId) return
      const openDialog = (window as any)?.api?.openDialogFiles
      if (!openDialog) return
      const selection = await openDialog({
        filters: [{ name: 'All Files', extensions: ['*'] }]
      })
      const filePaths = Array.isArray(selection)
        ? selection
        : Array.isArray(selection?.filePaths)
          ? selection.filePaths
          : []
      if (!filePaths.length) return
      // const  fs = (window as any)?.node?.fs
      // const pathApi = (window as any)?.node?.path
      const nextAttachments = filePaths.map((filePath: string) => {
        let size = 0
        try {
          size = nodeApi.fs?.statSync?.(filePath)?.size || 0
        } catch {}
        return {
          path: filePath,
          name: nodeApi.path?.basename?.(filePath) || filePath,
          size,
          mime: ''
        }
      })
      attachmentsBySession = {
        ...attachmentsBySession,
        [sessionId]: (attachmentsBySession?.[sessionId] || []).concat(nextAttachments)
      }
      updateGlobalAttachments(sessionId)
      scheduleSyncSession(sessionId)
    }
    window.addEventListener('ai:attachments-request', attachListener)

    const removeAttachListener = (event: any) => {
      const detail = event?.detail || {}
      const sessionId = detail.sessionId || activeSessionId
      if (!sessionId) return
      const list = attachmentsBySession?.[sessionId] || []
      const index = Number(detail.index)
      if (Number.isNaN(index) || index < 0 || index >= list.length) return
      attachmentsBySession = {
        ...attachmentsBySession,
        [sessionId]: list.filter((_, idx) => idx !== index)
      }
      updateGlobalAttachments(sessionId)
      scheduleSyncSession(sessionId)
    }
    window.addEventListener('ai:attachments-remove', removeAttachListener)

    const contextToggleListener = (event: any) => {
      const detail = event?.detail || {}
      const sessionId = detail.sessionId || activeSessionId
      if (!sessionId) return
      const nextEnabled = !contextEnabledBySession?.[sessionId]
      contextEnabledBySession = { ...contextEnabledBySession, [sessionId]: nextEnabled }
      updateGlobalContext(sessionId, nextEnabled)
      scheduleSyncSession(sessionId)
    }
    window.addEventListener('ai:context-toggle', contextToggleListener)

    const syncListener = async (event: any) => {
      const text = String(event?.detail?.text || '').trim()
      if (!text) return
      try {
        await EditorCommonUtils.copyToClipboard(text)
        uploadStatus = 'Response copied. Paste into your document.'
      } catch {
        await openAlertModal({
          title: 'Sync to Document',
          message: text
        })
      }
      setTimeout(() => (uploadStatus = ''), 1600)
    }
    window.addEventListener('ai:sync-to-doc', syncListener)

    return () => {
      off?.()
      syncTimersBySession.forEach((timer) => clearTimeout(timer))
      syncTimersBySession.clear()
      metaRequestKeyBySession.clear()
      window.removeEventListener('ai:conversation-updated', updateListener)
      window.removeEventListener('ai:dify-id-updated', difyIdListener)
      window.removeEventListener('ai:toast', toastListener)
      window.removeEventListener('ai:attachments-request', attachListener)
      window.removeEventListener('ai:attachments-remove', removeAttachListener)
      window.removeEventListener('ai:context-toggle', contextToggleListener)
      window.removeEventListener('ai:sync-to-doc', syncListener)
    }
  })

  // $:

  $effect(() => {
    if (activeWorkspace) {
      const selectionMap = loadDatasetSelections()
      const saved = selectionMap[getWorkspaceDatasetKey()]
      if (!datasetIdOverride && saved) {
        datasetIdOverride = saved
      }
      if (getWorkspaceDatasetKey() !== lastWorkspaceKey) {
        lastWorkspaceKey = getWorkspaceDatasetKey()
        datasetPage = 1
        refreshDatasets()
      }
    }

    if (datasetSearch) {
      datasetPage = 1
    }
    if (authState?.authenticated) {
      syncFromServer()
      flushPendingSync()
    }
  })

  $effect(() => {
    if (!activeSessionId) return
    const enabled = Boolean(contextEnabledBySession?.[activeSessionId])
    if (!enabled) return
    updateGlobalContext(activeSessionId, true)
    const interval = window.setInterval(() => {
      updateGlobalContext(activeSessionId, true)
    }, 5000)
    return () => window.clearInterval(interval)
  })

  // $effect(() => {
  let filteredSessions = $derived.by(() => {
    // filteredSessions =
    return sessionFilter.trim() === ''
      ? sessions
      : sessions.filter((item) => item.title.toLowerCase().includes(sessionFilter.toLowerCase()))
  })

  let filteredDatasets = $derived.by(() => {
    const query = datasetSearch.trim().toLowerCase()
    if (!query) return datasets
    return datasets.filter((dataset) =>
      String(dataset?.name || dataset?.id || '')
        .toLowerCase()
        .includes(query)
    )
  })

  // $: if (datasetSearch) {
  //   datasetPage = 1
  // }

  let datasetPageCount = $derived.by(() =>
    Math.max(1, Math.ceil(filteredDatasets.length / datasetsPerPage))
  )

  let pagedDatasets = $derived.by(() => {
    const start = (datasetPage - 1) * datasetsPerPage
    return filteredDatasets.slice(start, start + datasetsPerPage)
  })
</script>

<div id="hidden-react-storage" style="display: none;" bind:this={hiddenStorage}></div>

<DetachedPanel title={$_('AI Chat')}>
  {#snippet children(isModal)}
    <div
      class="ai-chat-pane h-full w-full bg-base-100 text-[#d1d1d1] font-sans overflow-hidden flex flex-col border-l border-white/5 shadow-2xl relative"
    >
      <div class="flex items-center justify-between px-3 h-11 bg-base-100 border-b border-black/20">
        <div class="flex items-center gap-1">
          <button
            class="p-1.5 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-[4px] text-base-content/40 hover:text-primary transition-all"
            onclick={() => (sidebarOpen = !sidebarOpen)}
          >
            <i class={`ph-bold ${sidebarOpen ? 'ph-sidebar' : 'ph-sidebar-simple'} text-[18px]`}
            ></i>
          </button>
          <div
            class="h-4 w-px bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-1"
          ></div>
          <button
            class="flex items-center gap-2 px-2 py-1 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-[4px] group"
          >
            <i class="ph-bold ph-sparkle text-primary text-[14px]"></i>
            <span
              class="text-[10px] font-black tracking-widest text-base-content/60 group-hover:text-base-content"
            >
              {$_('Edem AI Assistant')}
            </span>
            <i class="ph-bold ph-caret-down text-[10px] opacity-30"></i>
          </button>
          <span class="ml-3 text-[10px] text-base-content/35 uppercase tracking-[0.12em]">
            {datasetLabel}
          </span>
          <span class="ml-2 text-[9px] uppercase tracking-[0.12em] text-base-content/30">
            {serverSyncing ? $_('Syncing...') : serverSyncError ? $_('Offline') : $_('Synced')}
          </span>
        </div>

        <div class="flex items-center gap-1">
          <button
            class="p-1.5 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-[4px] text-base-content/40 hover:text-base-content"
            onclick={handleShare}
          >
            <i class="ph-bold ph-share-network text-[18px]"></i>
          </button>
          <button
            class="p-1.5 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-[4px] text-base-content/40 hover:text-base-content"
            onclick={() => (exportMenuOpen = !exportMenuOpen)}
          >
            <i class="ph-bold ph-export text-[18px]"></i>
          </button>
          <button
            class="p-1.5 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-[4px] text-base-content/40 hover:text-base-content"
            onclick={handleUploadDocuments}
          >
            <i class="ph-bold ph-upload-simple text-[18px]"></i>
          </button>
          <button
            class="p-1.5 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-[4px] text-base-content/40 hover:text-base-content"
            onclick={() => (datasetMenuOpen = !datasetMenuOpen)}
          >
            <i class="ph-bold ph-database text-[18px]"></i>
          </button>
        </div>
      </div>

      {#if exportMenuOpen}
        <div
          class="absolute right-4 top-13 w-56 bg-[#1b1b1b] border border-white/10 rounded-lg shadow-xl z-20"
        >
          <div
            class="px-3 py-2 border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-base-content/50"
          >
            {$_('Export Chat')}
          </div>
          <div class="p-3 space-y-2">
            <button
              class="w-full px-2 py-1 rounded-md text-[11px] bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)]"
              onclick={() => handleExport('json')}
            >
              {$_('Export as JSON')}
            </button>
            <button
              class="w-full px-2 py-1 rounded-md text-[11px] bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)]"
              onclick={() => handleExport('md')}
            >
              {$_('Export as Markdown')}
            </button>
          </div>
        </div>
      {/if}

      {#if datasetMenuOpen}
        <div
          class="absolute right-4 top-13 w-72 bg-[#1b1b1b] border border-white/10 rounded-lg shadow-xl z-20"
        >
          <div
            class="px-3 py-2 border-b border-white/10 text-[10px] uppercase tracking-[0.14em] text-base-content/50"
          >
            {$_('Workspace Dataset')}
          </div>
          <div class="p-3 space-y-2">
            <div class="flex items-center gap-2">
              <input
                class="flex-1 bg-transparent border border-white/10 rounded-md px-2 py-1 text-[11px] text-base-content/70 focus:outline-none focus:border-primary/40"
                placeholder={$_('Search datasets')}
                bind:value={datasetSearch}
              />
              <select
                class="bg-transparent border border-white/10 rounded-md px-2 py-1 text-[11px] text-base-content/70 focus:outline-none focus:border-primary/40"
                bind:value={datasetScope}
                onchange={() => {
                  datasetPage = 1
                  refreshDatasets()
                }}
              >
                <option value="org">{$_('Org')}</option>
                <option value="user">{$_('User')}</option>
                <option value="all">{$_('All')}</option>
              </select>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-base-content/60">{$_('Selected')}</span>
              <span class="text-[11px] text-base-content">{datasetIdOverride || $_('Default')}</span
              >
            </div>
            <button
              class="w-full px-2 py-1 rounded-md text-[11px] bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)]"
              onclick={handleDatasetConfig}
            >
              {$_('Set custom dataset ID')}
            </button>
            <button
              class="w-full px-2 py-1 rounded-md text-[11px] text-amber-200 hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)]"
              onclick={clearDatasetSelection}
            >
              {$_('Use workspace default')}
            </button>
            <div class="mt-2 text-[10px] uppercase tracking-[0.12em] text-base-content/40">
              {$_('Datasets')}
            </div>
            {#if datasetsLoading}
              <div class="text-[11px] text-base-content/50">{$_('Loading datasets...')}</div>
            {:else if datasets.length === 0}
              <div class="text-[11px] text-base-content/50">{$_('No datasets found.')}</div>
            {:else}
              <div class="max-h-48 overflow-y-auto space-y-1">
                {#each pagedDatasets as dataset}
                  <button
                    class={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] ${
                      datasetIdOverride === dataset.id
                        ? 'bg-primary/20 text-primary'
                        : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)]'
                    }`}
                    onclick={() => selectDataset(dataset)}
                  >
                    <span class="truncate">{dataset.name || dataset.id}</span>
                    <span class="text-[10px] text-base-content/40">
                      {dataset.document_count ?? dataset.documents ?? 0}
                    </span>
                  </button>
                {/each}
              </div>
              <div class="mt-2 flex items-center justify-between text-[10px] text-base-content/50">
                <button
                  class="px-2 py-1 rounded-md hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] disabled:opacity-40"
                  disabled={datasetPage <= 1}
                  onclick={() => (datasetPage = Math.max(1, datasetPage - 1))}
                >
                  {$_('Prev')}
                </button>
                <span>{$_('Page')} {datasetPage} / {datasetPageCount}</span>
                <button
                  class="px-2 py-1 rounded-md hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] disabled:opacity-40"
                  disabled={datasetPage >= datasetPageCount}
                  onclick={() => (datasetPage = Math.min(datasetPageCount, datasetPage + 1))}
                >
                  {$_('Next')}
                </button>
              </div>
            {/if}
            <button
              class="w-full px-2 py-1 rounded-md text-[11px] text-base-content/60 hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)]"
              onclick={refreshDatasets}
            >
              {$_('Refresh list')}
            </button>
          </div>
        </div>
      {/if}

      <div class="flex flex-1 min-h-0">
        {#if sidebarOpen}
          <aside class="w-56 border-r border-white/5 bg-base-200 flex flex-col">
            <div class="p-3">
              <button
                class="w-full flex items-center justify-between px-3 py-2 rd-[6px] bg-primary/15 text-primary hover:bg-primary/25 text-[11px] font-800 uppercase tracking-[0.12em] transition"
                onclick={() => createSession($_('New chat'))}
              >
                <span>{$_('New Chat')}</span>
                <i class="ph-bold ph-plus text-[14px]"></i>
              </button>
              <input
                class="mt-3 w-full bg-transparent border border-white/10 rounded-md px-2 py-1 text-[11px] text-base-content/70 focus:outline-none focus:border-primary/40"
                placeholder={$_('Search chats')}
                bind:value={sessionFilter}
              />
            </div>

            <div class="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
              {#each filteredSessions as session}
                <div
                  class={`flex items-center justify-between px-2 py-2 rounded-md cursor-pointer ${
                    session.id === activeSessionId
                      ? 'bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content'
                      : 'text-base-content/60 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)]'
                  }`}
                  onclick={() => setActiveSession(session.id)}
                >
                  <div class="min-w-0">
                    <p class="text-[11px] font-700 truncate">{session.title}</p>
                    <p class="text-[9px] text-base-content/35 truncate">
                      {new Date(session.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      class="p-1 text-base-content/30 hover:text-base-content"
                      onclick={(e) => {
                        e.stopPropagation()
                        renameSession(session)
                      }}
                    >
                      <i class="ph-bold ph-pencil-simple text-[12px]"></i>
                    </button>
                    <button
                      class="p-1 text-base-content/30 hover:text-rose-300"
                      onclick={(e) => {
                        e.stopPropagation()
                        removeSession(session)
                      }}
                    >
                      <i class="ph-bold ph-x text-[12px]"></i>
                    </button>
                  </div>
                </div>
              {/each}
            </div>

            <div class="px-3 py-2 text-[9px] text-base-content/35 uppercase tracking-[0.12em]">
              Workspace: {activeWorkspace}
            </div>
          </aside>
        {/if}

        <div class="flex-1 min-w-0 flex flex-col">
          <div use:teleport class="h-full w-full"></div>
        </div>
      </div>

      {#if uploadStatus}
        <div
          class="absolute bottom-4 right-4 bg-black/70 text-base-content text-[10px] px-3 py-2 rounded-md border border-white/10"
        >
          {uploadStatus}
        </div>
      {/if}
      {#if uploadProgress.length}
        <div
          class="absolute top-13 right-4 w-72 bg-black/70 text-base-content text-[10px] px-3 py-2 rounded-md border border-white/10 space-y-1"
        >
          {#each uploadProgress as item}
            <div class="flex items-center justify-between">
              <span class="truncate">{item.file.split('/').pop()}</span>
              <span class="text-base-content/60">{item.status}</span>
            </div>
            <div
              class="h-1 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] rounded"
            >
              <div class="h-1 bg-primary rounded" style={`width:${item.percent || 0}%`}></div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}
</DetachedPanel>

<style>
  @media (max-width: 768px) {
    .ai-chat-pane {
      border-left: 0;
      box-shadow: none;
    }
    .ai-chat-pane .h-11 {
      height: 48px;
    }
  }
</style>
