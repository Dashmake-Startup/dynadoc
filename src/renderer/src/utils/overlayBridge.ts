import { _$_confirmModal } from '../stores/confirmModal.store'
import { _$_alertModal } from '../stores/alertModal.store'
import { _$_textInputModal } from '../stores/textInputModal.store'
import { _$_exportOptionsModal } from '../stores/exportOptionsModal.store'

type ModalName = 'confirm' | 'alert' | 'textInput' | 'exportOptions'

const channelName = 'dynadoc-overlay'

export function isOverlayMode() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('overlay') === '1'
}

function postMessage(payload: any) {
  try {
    const channel = new BroadcastChannel(channelName)
    channel.postMessage(payload)
    channel.close()
  } catch {
    // ignore
  }
}

export function sendOverlayAction(modal: ModalName, action: string, value?: any) {
  postMessage({ type: 'action', modal, action, value })
}

export function setupOverlaySource() {
  const channel = new BroadcastChannel(channelName)

  const sendState = (modal: ModalName, state: any) => {
    channel.postMessage({ type: 'state', modal, state })
  }

  const unsubConfirm = _$_confirmModal.subscribe((state) => sendState('confirm', state))
  const unsubAlert = _$_alertModal.subscribe((state) => sendState('alert', state))
  const unsubText = _$_textInputModal.subscribe((state) => sendState('textInput', state))
  const unsubExport = _$_exportOptionsModal.subscribe((state) => sendState('exportOptions', state))

  channel.onmessage = (event) => {
    const payload = event.data
    if (!payload || payload.type !== 'action') return
    const { modal, action, value } = payload
    if (modal === 'confirm') {
      if (action === 'confirm') _$_confirmModal.confirm()
      if (action === 'cancel') _$_confirmModal.cancel()
      if (action === 'extra') _$_confirmModal.runExtraAction?.()
      return
    }
    if (modal === 'alert') {
      if (action === 'close') _$_alertModal.close()
      return
    }
    if (modal === 'textInput') {
      if (action === 'confirm') _$_textInputModal.confirm(value ?? '')
      if (action === 'cancel') _$_textInputModal.cancel()
      return
    }
    if (modal === 'exportOptions') {
      if (action === 'confirm') _$_exportOptionsModal.confirm(value ?? null)
      if (action === 'cancel') _$_exportOptionsModal.cancel()
    }
  }

  return () => {
    unsubConfirm()
    unsubAlert()
    unsubText()
    unsubExport()
    channel.close()
  }
}

export function setupOverlayReceiver() {
  const channel = new BroadcastChannel(channelName)

  channel.onmessage = (event) => {
    const payload = event.data
    if (!payload || payload.type !== 'state') return
    const { modal, state } = payload
    if (modal === 'confirm') {
      _$_confirmModal.setExternalState?.(state)
      return
    }
    if (modal === 'alert') {
      _$_alertModal.setExternalState?.(state)
      return
    }
    if (modal === 'textInput') {
      _$_textInputModal.setExternalState?.(state)
      return
    }
    if (modal === 'exportOptions') {
      _$_exportOptionsModal.setExternalState?.(state)
    }
  }

  return () => channel.close()
}
