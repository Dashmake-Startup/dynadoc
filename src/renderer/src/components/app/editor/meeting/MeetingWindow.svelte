<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onDestroy, onMount } from 'svelte'
  import ScreenSharePicker from './ScreenSharePicker.svelte'
  import { meetingStore } from '../../../../extensions/tiptap/CustomMeetingNoteTakingExtension/stores/meeting.store.svelte'
  import { mountEmbeddedView, postMessageToEmbeddedView } from '../../../browser/embeddedViewHost'
  import { cryptoRandomUUID } from '../../../../utils/common.utils'

  let { meetingUrl, isMinimized = $bindable(false) } = $props<{
    meetingUrl: string
    isMinimized?: boolean
  }>()

  let viewContainer = $state<HTMLDivElement | null>(null)
  let embeddedId = $state('')
  let disposeEmbedded: (() => void) | null = null
  let isDomReady = $state(false)
  let isScribing = $state(false)

  // Transcription WebSocket endpoint — provided at build time, never hardcoded.
  const TRANSCRIBE_WS_URL = (import.meta as any).env?.VITE_TRANSCRIBE_WS_URL ?? ''
  const isElectronBridge = Boolean(window.api?.embedded)
  // const bridgeLabel = isElectronBridge ? 'Isolated BrowserView' : 'Secure iframe sandbox'

  function getTargetOrigin() {
    try {
      return new URL(meetingUrl || 'about:blank', window.location.href).origin
    } catch {
      return '*'
    }
  }

  function buildDesktopCommandScript(action: string, data: any = {}) {
    return `
      (function() {
        const payload = ${JSON.stringify(data)};

        const stopScreenShare = () => {
          if (typeof toggleScreenSharing === 'function' && typeof isScreenStreaming !== 'undefined' && isScreenStreaming) {
            toggleScreenSharing();
          }

          const streams = [window.localStream, window.screenStream, window.localMediaStream];
          streams.forEach((stream) => {
            stream?.getTracks?.().forEach((track) => {
              const label = String(track?.label || '').toLowerCase();
              if (track.kind === 'video' && label.includes('screen')) {
                track.stop();
              }
            });
          });

          const stopBtn =
            document.getElementById('shareScreenBtn') ||
            document.querySelector('button[title*="Stop"]');
          stopBtn?.click?.();
        };

        const setMute = (muted) => {
          try {
            const localTrack = window.APP?.conference?.getLocalAudioTrack?.();
            if (localTrack?.mute && localTrack?.unmute) {
              muted ? localTrack.mute() : localTrack.unmute();
            }
          } catch {
            // ignore Jitsi API errors and fall back to track toggling
          }

          window.localMediaStream?.getAudioTracks?.().forEach((track) => {
            track.enabled = !muted;
          });
        };

        const setLowPowerMode = (enabled) => {
          document.documentElement.dataset.dynadocLowPower = enabled ? 'true' : 'false';
          document.querySelectorAll('video').forEach((video) => {
            const isLocal = video.closest('[class*="local"], [data-testid*="local"], .local-video');
            if (!isLocal) {
              video.style.visibility = enabled ? 'hidden' : 'visible';
              video.style.opacity = enabled ? '0' : '1';
            }
          });
        };

        const ensureScribeBridge = () => {
          if (window.__dynadocScribeStart && window.__dynadocScribeStop) return;

          window.__dynadocScribeState = window.__dynadocScribeState || {
            ws: null,
            audioContext: null,
            processors: new Map(),
            sources: new Map(),
            activeTrackIds: new Set(),
            roomId: '',
            wsUrl: ''
          };

          const sendChunk = (peerName, room, pcmBuffer) => {
            const state = window.__dynadocScribeState;
            if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
            const metadata = JSON.stringify({ peerName, room });
            const metaBytes = new TextEncoder().encode(metadata);
            const delimiter = new TextEncoder().encode('|||');
            const pcmBytes = new Uint8Array(pcmBuffer);
            const payloadBytes = new Uint8Array(metaBytes.length + delimiter.length + pcmBytes.length);
            payloadBytes.set(metaBytes, 0);
            payloadBytes.set(delimiter, metaBytes.length);
            payloadBytes.set(pcmBytes, metaBytes.length + delimiter.length);
            state.ws.send(payloadBytes);
          };

          const attachTrack = (track) => {
            if (!track || (track.getType && track.getType() !== 'audio')) return;
            const trackId = track.getId ? track.getId() : track.id;
            if (!trackId || window.__dynadocScribeState.activeTrackIds.has(trackId)) return;
            window.__dynadocScribeState.activeTrackIds.add(trackId);

            const stream = track.getOriginalStream ? track.getOriginalStream() : (track.stream || null);
            if (!stream) return;

            const peerName = track.getParticipantId ? (track.getParticipantId() || 'unknown') : 'unknown';
            const roomId = window.__dynadocScribeState.roomId || 'default';

            if (!window.__dynadocScribeState.audioContext) {
              window.__dynadocScribeState.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
              });
            }

            const audioContext = window.__dynadocScribeState.audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            source.connect(processor);
            processor.connect(audioContext.destination);
            processor.onaudioprocess = (event) => {
              const input = event.inputBuffer.getChannelData(0);
              const pcm = new Int16Array(input.length);
              for (let i = 0; i < input.length; i += 1) {
                pcm[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
              }
              sendChunk(peerName, roomId, pcm.buffer);
            };

            window.__dynadocScribeState.sources.set(trackId, source);
            window.__dynadocScribeState.processors.set(trackId, processor);
          };

          window.__dynadocScribeStart = (wsUrl, roomId) => {
            const state = window.__dynadocScribeState;
            state.roomId = roomId || state.roomId;
            state.wsUrl = wsUrl || state.wsUrl;
            if (!state.ws || state.ws.readyState > 1) {
              state.ws = new WebSocket(state.wsUrl);
            }

            const JitsiMeetJS = window.JitsiMeetJS;
            const room = window.APP?.conference?.getRoom?.() || window.APP?.conference?._room;
            if (room && JitsiMeetJS?.events?.conference?.TRACK_ADDED) {
              room.on(JitsiMeetJS.events.conference.TRACK_ADDED, attachTrack);
            }

            const existingTracks = window.APP?.conference?.getTracks?.() || room?.getTracks?.() || [];
            existingTracks.forEach(attachTrack);
          };

          window.__dynadocScribeStop = () => {
            const state = window.__dynadocScribeState;
            state.ws?.close?.();
            state.processors.forEach((processor) => processor.disconnect());
            state.sources.forEach((source) => source.disconnect());
            state.processors.clear();
            state.sources.clear();
            state.activeTrackIds.clear();
            if (state.audioContext) {
              state.audioContext.close();
              state.audioContext = null;
            }
          };
        };

        window.dispatchdynadoc = window.dispatchdynadoc || function(action, details) {
          ensureScribeBridge();

          switch (action) {
            case 'START_TRANSCRIPTION':
              window.__dynadocScribeStart?.(details.wsUrl, details.roomId);
              break;
            case 'STOP_TRANSCRIPTION':
              window.__dynadocScribeStop?.();
              break;
            case 'SET_MUTE':
              setMute(Boolean(details.muted));
              break;
            case 'STOP_SCREENSHARE':
              stopScreenShare();
              break;
            case 'SET_LOW_POWER_MODE':
              setLowPowerMode(Boolean(details.enabled));
              break;
            default:
              break;
          }
        };

        if (!window.__dynadocPostMessageBridge) {
          window.__dynadocPostMessageBridge = true;
          window.addEventListener('message', (event) => {
            if (event?.data?.type !== 'DYNADOC_CMD') return;
            window.dispatchdynadoc?.(event.data.action, event.data.data || {});
          });
        }

        window.dispatchdynadoc(${JSON.stringify(action)}, payload);
      })();
    `
  }

  function sendCommand(action: string, data: any = {}) {
    if (!isDomReady || !embeddedId) return

    if (isElectronBridge) {
      window.api?.embedded?.executeJavaScript?.({
        id: embeddedId,
        script: buildDesktopCommandScript(action, data)
      })
      return
    }

    postMessageToEmbeddedView(
      viewContainer,
      embeddedId,
      {
        type: 'DYNADOC_CMD',
        action,
        data
      },
      getTargetOrigin()
    )
  }

  function toggleScribe() {
    isScribing = !isScribing
    sendCommand(isScribing ? 'START_TRANSCRIPTION' : 'STOP_TRANSCRIPTION', {
      wsUrl: TRANSCRIBE_WS_URL,
      roomId: meetingStore.currentRoomId
    })
  }

  onMount(async () => {
    embeddedId = cryptoRandomUUID()

    if (viewContainer) {
      const preloadPath = await window.api?.getPreloadPath?.('embedded-var')
      disposeEmbedded = await mountEmbeddedView(viewContainer, {
        id: embeddedId,
        url: meetingUrl || 'about:blank',
        preloadPath,
        permissions: ['media', 'camera', 'microphone'],
        enableVarDropdown: isElectronBridge,
        onEvent: (payload) => {
          console.log('mountEmbeddedView iframe payload', { payload })

          if (payload.type === 'dom-ready') {
            isDomReady = true
          }
        }
      })
    }

    window.meetingAPI?.onMicAction?.((muted: boolean) => {
      sendCommand('SET_MUTE', { muted })
    })

    window.meetingAPI?.onStopStream?.(() => {
      sendCommand('STOP_SCREENSHARE')
    })
  })

  onDestroy(() => {
    if (isScribing) {
      sendCommand('STOP_TRANSCRIPTION')
    }
    disposeEmbedded?.()
    disposeEmbedded = null
  })

  $effect(() => {
    if (embeddedId && meetingUrl && isElectronBridge) {
      window.api?.embedded?.navigate?.({ id: embeddedId, url: meetingUrl })
    }
  })

  $effect(() => {
    if (!isDomReady) return
    sendCommand('SET_LOW_POWER_MODE', { enabled: isMinimized })
  })
</script>

{#if meetingUrl}
  <div class="meeting-shell">
    {#if !isDomReady}
      <div class="meeting-status">
        <i class="ph-light ph-circle-notch animate-spin text-[16px]"></i>
        <span>{$_('Initializing meeting...')}</span>
      </div>
    {/if}

    <!-- <div class="bridge-badge">
      <span class="bridge-dot"></span>
      <span>{bridgeLabel}</span>
    </div> -->

    <div
      bind:this={viewContainer}
      class="meeting-viewport"
      class:meeting-viewport-minimized={isMinimized}
    ></div>

    <!-- {#if isDomReady && !isMinimized}
      <div class="meeting-pillbar">
        <button
          onclick={toggleScribe}
          class="scribe-chip"
          class:scribe-chip-live={isScribing}
        >
          {isScribing ? $_('AI Scribe Live') : $_('Start Scribe')}
        </button>
      </div>
    {/if} -->

    <ScreenSharePicker />
  </div>
{/if}

<style>
  .meeting-shell {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background:
      radial-gradient(circle at top, rgba(0, 190, 172, 0.18), transparent 32%),
      linear-gradient(180deg, rgba(3, 7, 18, 0.96), rgba(2, 6, 23, 1));
  }

  .meeting-viewport {
    width: 100%;
    height: 100%;
    transition:
      transform 260ms ease,
      opacity 260ms ease,
      filter 260ms ease;
  }

  .meeting-viewport-minimized {
    transform: scale(0.965);
    opacity: 0.86;
    filter: saturate(0.82);
  }

  .meeting-status {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    letter-spacing: 0.02em;
    background: linear-gradient(180deg, rgba(2, 6, 23, 0.82), rgba(2, 6, 23, 0.6));
    backdrop-filter: blur(8px);
  }

  .bridge-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 5;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(2, 6, 23, 0.54);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.72);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    backdrop-filter: blur(18px);
  }

  .bridge-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(135deg, --color-base-300, #7dd3fc);
    box-shadow: 0 0 18px rgba(0, 190, 172, 0.45);
  }

  .meeting-pillbar {
    position: absolute;
    top: 16px;
    left: 50%;
    z-index: 5;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 999px;
    background: rgba(2, 6, 23, 0.56);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(18px);
  }

  .scribe-chip {
    padding: 8px 14px;
    border: none;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.86);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition:
      transform 180ms ease,
      background 180ms ease,
      color 180ms ease;
    cursor: pointer;
  }

  .scribe-chip:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.14);
  }

  .scribe-chip-live {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(217, 70, 239, 0.92));
    color: white;
    box-shadow: 0 12px 30px rgba(239, 68, 68, 0.32);
  }
</style>
