import { writable } from 'svelte/store'
import { DriveActions } from '../utils/driveActions'

export type DownloadStatus = 'pending' | 'running' | 'done' | 'failed'

export interface DownloadJobPayload {
  path?: string
  paths?: string[]
  archive?: boolean
  name?: string
  accountOrg?: string
}

export interface DownloadJob {
  id: string
  label: string
  payload: DownloadJobPayload
  status: DownloadStatus
  progress: number
  bytesReceived?: number
  bytesTotal?: number
  speedBps?: number
  etaSeconds?: number
  createdAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
}

export interface DownloadManagerState {
  open: boolean
  running: boolean
  paused: boolean
  jobs: DownloadJob[]
}

const INITIAL_STATE: DownloadManagerState = {
  open: false,
  running: false,
  paused: false,
  jobs: []
}

const store = writable<DownloadManagerState>(INITIAL_STATE)

let runnerActive = false

function updateState(patch: Partial<DownloadManagerState>) {
  store.update((state) => ({ ...state, ...patch }))
}

function updateJob(id: string, patch: Partial<DownloadJob>) {
  store.update((state) => ({
    ...state,
    jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job))
  }))
}

function nextPendingJob(jobs: DownloadJob[]) {
  return jobs.find((job) => job.status === 'pending') || null
}

async function runQueue() {
  if (runnerActive) return
  runnerActive = true
  updateState({ running: true })

  while (true) {
    let job: DownloadJob | null = null
    let paused = false
    store.update((state) => {
      paused = state.paused
      job = nextPendingJob(state.jobs)
      return state
    })

    if (paused || !job) break

    const startTime = new Date().toISOString()
    updateJob(job.id, {
      status: 'running',
      progress: 5,
      startedAt: startTime,
      error: '',
      bytesReceived: 0,
      bytesTotal: undefined,
      speedBps: undefined,
      etaSeconds: undefined
    })

    try {
      let lastBytes = 0
      let lastAt = Date.now()
      let lastEmit = 0
      const result = await DriveActions.downloadItemWithProgress(job.payload, (info) => {
        const now = Date.now()
        const received = Math.max(0, info.received || 0)
        const total = info.total && info.total > 0 ? info.total : undefined
        if (now - lastEmit < 200 && total && received < total) return
        const deltaBytes = received - lastBytes
        const deltaTime = (now - lastAt) / 1000
        const speed = deltaTime > 0 ? Math.max(0, deltaBytes / deltaTime) : undefined
        const eta =
          total && speed && speed > 0 ? Math.max(0, Math.round((total - received) / speed)) : undefined
        const progress = total ? Math.min(99, Math.round((received / total) * 100)) : 10
        updateJob(job!.id, {
          bytesReceived: received,
          bytesTotal: total,
          speedBps: speed,
          etaSeconds: eta,
          progress
        })
        lastBytes = received
        lastAt = now
        lastEmit = now
      })
      if (!result?.ok) {
        throw new Error(result?.message || 'Download failed')
      }
      updateJob(job.id, {
        status: 'done',
        progress: 100,
        bytesReceived: job.bytesTotal || job.bytesReceived,
        bytesTotal: job.bytesTotal,
        speedBps: undefined,
        etaSeconds: 0,
        finishedAt: new Date().toISOString()
      })
    } catch (error: any) {
      updateJob(job.id, {
        status: 'failed',
        progress: 0,
        speedBps: undefined,
        etaSeconds: undefined,
        error: error?.message || 'Download failed',
        finishedAt: new Date().toISOString()
      })
    }
  }

  runnerActive = false
  updateState({ running: false })
}

function enqueue(payloads: DownloadJobPayload[], labels?: string[]) {
  if (!payloads.length) return
  const now = new Date().toISOString()
  store.update((state) => ({
    ...state,
    open: true,
    jobs: [
      ...state.jobs,
      ...payloads.map((payload, index) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: labels?.[index] || payload?.name || payload?.path || 'Download',
        payload,
        status: 'pending',
        progress: 0,
        createdAt: now
      }))
    ]
  }))
  runQueue()
}

function pause() {
  updateState({ paused: true })
}

function resume() {
  updateState({ paused: false })
  runQueue()
}

function retryJob(id: string) {
  updateJob(id, { status: 'pending', progress: 0, error: '', finishedAt: undefined })
  runQueue()
}

function retryFailed() {
  store.update((state) => ({
    ...state,
    jobs: state.jobs.map((job) =>
      job.status === 'failed'
        ? { ...job, status: 'pending', progress: 0, error: '', finishedAt: undefined }
        : job
    )
  }))
  runQueue()
}

function removeJob(id: string) {
  store.update((state) => ({ ...state, jobs: state.jobs.filter((job) => job.id !== id) }))
}

function clearCompleted() {
  store.update((state) => ({ ...state, jobs: state.jobs.filter((job) => job.status !== 'done') }))
}

function clearAll() {
  store.set({ ...INITIAL_STATE, open: true })
}

function open() {
  updateState({ open: true })
}

function close() {
  updateState({ open: false })
}

export const _$_downloadManager = {
  subscribe: store.subscribe,
  enqueue,
  pause,
  resume,
  retryJob,
  retryFailed,
  removeJob,
  clearCompleted,
  clearAll,
  open,
  close
}

export function enqueueDownloadJobs(payloads: DownloadJobPayload[], labels?: string[]) {
  return _$_downloadManager.enqueue(payloads, labels)
}

export function openDownloadManager() {
  _$_downloadManager.open()
}
