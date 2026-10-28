// stores/meeting.store.svelte.ts
import { get } from 'svelte/store'
import { authStore, initializeAuthStore } from '../../../../stores/auth.store'

const DEFAULT_JITSI_BASE_URL = 'https://meeting.dynadoc.dashmake.com'

function buildDisplayName(user: any): string {
  if (!user) return ''
  const displayName = String(user.displayName || '').trim()
  if (displayName) return displayName

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  if (fullName) return fullName

  return String(user.name || user.email || '').trim()
}

function buildFallbackMeetingUrl(roomId: string, user: any) {
  const safeRoom = String(roomId || '').trim()
  const base = DEFAULT_JITSI_BASE_URL.replace(/\/$/, '')
  const url = `${base}/${safeRoom}`

  const params = new URLSearchParams()
  params.set('config.prejoinPageEnabled', 'false')

  const displayName = buildDisplayName(user)
  if (displayName) {
    params.set('userInfo.displayName', displayName)
  }
  if (user?.email) {
    params.set('userInfo.email', String(user.email))
  }

  const hash = params.toString()
  return hash ? `${url}#${hash}` : url
}

class MeetingStore {
  joinMeetingUrl = $state(null)
  currentRoomId = $state('')
  isMinimized = $state(false)
  secondsElapsed = $state(0)
  private timerInterval: any = null
  isLive = $derived(!!this.joinMeetingUrl)

  async startMeeting(roomId: string) {
    this.currentRoomId = roomId

    let user = get(authStore)?.user
    let joinUrl = buildFallbackMeetingUrl(roomId, user)

    try {
      await initializeAuthStore()
      user = get(authStore)?.user
      joinUrl = buildFallbackMeetingUrl(roomId, user)
    } catch (error) {
      console.warn('Meeting auth bootstrap failed', error)
    }

    try {
      const response = await (window as any)?.server?.jitsi?.getJoinUrl?.({ room: roomId })
      if (response?.ok && response?.url) {
        joinUrl = response.url
      }
    } catch (error) {
      console.warn('Jitsi auto-join failed', error)
    }

    this.joinMeetingUrl = joinUrl
    this.secondsElapsed = 0
    if (this.timerInterval) clearInterval(this.timerInterval)

    // Start the heartbeat
    this.timerInterval = setInterval(() => {
      this.secondsElapsed++
    }, 1000)
  }

  stopMeeting() {
    this.joinMeetingUrl = null
    this.currentRoomId = ''

    if (this.timerInterval) clearInterval(this.timerInterval)
    this.secondsElapsed = 0
  }

  // Format seconds into MM:SS
  formattedDuration = $derived(() => {
    const mins = Math.floor(this.secondsElapsed / 60)
    const secs = this.secondsElapsed % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  })
}

export const meetingStore = new MeetingStore()
