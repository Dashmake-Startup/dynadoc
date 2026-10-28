<script>
  import { slide, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import ScreenSharePicker from '../../../app/editor/meeting/ScreenSharePicker.svelte'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import MeetingWindow from '../../../app/editor/meeting/MeetingWindow.svelte'
  import { dragMinimizedWindow } from '../../../../extensions/tiptap/utils/utils'
  import MeetingDraft from '../../../../extensions/tiptap/CustomMeetingNoteTakingExtension/components/MeetingDraft.svelte'
  import MeetingTasks from '../../../../extensions/tiptap/CustomMeetingNoteTakingExtension/components/MeetingTasks.svelte'
  import { transcriptionStore } from '../../../../extensions/tiptap/CustomMeetingNoteTakingExtension/stores/transcription.store.svelte'
  import DetachedPanel from '../../../../extensions/tiptap/components/common/DetachedPanel.svelte'
  import { _ } from 'svelte-i18n'
  import { meetingStore } from '../../../../extensions/tiptap/CustomMeetingNoteTakingExtension/stores/meeting.store.svelte'

  // Note: Assuming Phosphor Icons are available via a component library or CDN
  // Example: import Icon from 'phosphor-svelte'

  // --- Svelte 5 Runes: Reactive State ---

  let isMicMuted = $state(false)
  let isPrivacyMode = $state(false)
  let hasBeenDragged = $state(false)

  // Calculate default position: Bottom Right
  // screenWidth - windowWidth - margin
  let initialX = $derived(typeof window !== 'undefined' ? window.innerWidth - 320 - 24 : 0)
  let initialY = $derived(typeof window !== 'undefined' ? window.innerHeight - 180 - 24 : 0)
  let showConfirmClose = $state(false) // Local state for the confirmation modal

  let currentRoomId = $state('')
  // let joinMeetingUrl = $state('')

  // const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  // let _activeEditor = $derived($activeDocumentEditorStore)

  // let _activeWysiwyg = $derived(
  //   _activeEditor ? _$_wysiwygEditorsList.getEntryStore(_activeEditor?.id.toString()) : null
  // )

  // let { currentRoomId } = $props();

  // Transcription WebSocket endpoint — provided at build time, never hardcoded.
  const TRANSCRIBE_WS_URL = import.meta.env?.VITE_TRANSCRIBE_WS_URL ?? ''

  // Start the worker immediately when the meeting page loads
  $effect(() => {
    if (currentRoomId && TRANSCRIBE_WS_URL) {
      transcriptionStore.init(currentRoomId, TRANSCRIBE_WS_URL)
    }
  })

  function handleCloseRequest() {
    if (meetingStore.isMinimized) {
      // If minimized, just close directly or expand first?
      // Usually, direct exit is fine for PIP.
      // joinMeetingUrl = null
    } else {
      showConfirmClose = true
    }
    meetingStore.stopMeeting()
  }

  // Mute Logic
  const toggleMute = () => {
    isMicMuted = !isMicMuted
    window.meetingAPI.toggleMic(isMicMuted)
  }

  const togglePrivacy = () => {
    isPrivacyMode = !isPrivacyMode
    // Tells MiroTalk/Webview to show a blur overlay
    window.meetingAPI.sendToMeeting('privacy-blur', isPrivacyMode)
  }
</script>

<!-- {#if joinMeetingUrl} -->
{#if meetingStore.joinMeetingUrl}
  <div
    use:dragMinimizedWindow={{
      isMinimized: meetingStore.isMinimized,
      onDragStart: () => (hasBeenDragged = true)
    }}
    class="fixed z-1000 bg-black/70 overflow-hidden flex items-center justify-center transition-all duration-400 ease-[cubic-bezier(0.2,1,0.2,1)] {meetingStore.isMinimized
      ? 'top-0 left-0 w-[320px] h-[180px] rd-4 shadow-2xl border-2 border-white/10'
      : 'inset-0 w-full h-full backdrop-blur-md shadow-[0_0_0_100vmax_rgba(0,0,0,0.7)]'}"
    style={meetingStore.isMinimized && !hasBeenDragged
      ? `transform: translate3d(${initialX}px, ${initialY}px, 0)`
      : ''}
  >
    <!-- <div
      class="absolute top-0 left-0 right-0 h-10 z-1000 flex items-center justify-between px-4 cursor-grab bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 {meetingStore.isMinimized ? 'opacity-100' : 'opacity-0 hover:opacity-100'}"
    >
      <div class="w-10 h-1 bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)] rd-1"></div>
      <button
        onclick={() => (meetingStore.isMinimized = !meetingStore.isMinimized)}
        class="text-base-content hover:text-base-400 transition-colors bg-transparent border-none cursor-pointer"
      >
        <i class={meetingStore.isMinimized ? 'ph-bold ph-corners-out' : 'ph-bold ph-corners-in'}></i>
      </button>
    </div> -->
    <div
      class="drag-handle absolute top-0 left-0 right-0 h-10 z-1000 flex items-center justify-end px-4 cursor-grab bg-gradient-to-b from-black/70 to-transparent opacity-100"
    >
      <div class="flex items-center gap-2">
        <button
          onclick={() => (meetingStore.isMinimized = !meetingStore.isMinimized)}
          class="text-base-content/80 hover:text-base-400 transition-colors bg-transparent border-none cursor-pointer p-1"
        >
          <i
            class="text-lg {meetingStore.isMinimized
              ? 'ph-bold ph-corners-out'
              : 'ph-bold ph-corners-in'}"
          ></i>
        </button>

        <div
          class="w-[1px] h-4 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-1"
        ></div>

        <button
          onclick={handleCloseRequest}
          class="text-base-content/70 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer p-1 flex items-center"
          title={$_('Close Meeting')}
        >
          <i class="ph-bold ph-x text-lg"></i>
        </button>
      </div>
    </div>

    {#if showConfirmClose}
      <div
        transition:fade={{ duration: 150 }}
        class="absolute inset-0 z-2000 flex items-center justify-center bg-black/80 backdrop-blur-sm rd-6"
      >
        <div class="bg-base-100 p-6 rd-4 border border-white/10 shadow-2xl max-w-sm text-center">
          <h3 class="text-base-content text-lg font-600 mb-2">{$_('End Meeting?')}</h3>
          <p class="text-base-content/60 text-sm mb-6">
            {$_(
              'Are you sure you want to leave the current session? This will stop the AI transcription.'
            )}
          </p>

          <div class="flex gap-3 justify-center">
            <button
              onclick={() => (showConfirmClose = false)}
              class="px-4 py-2 rd-2 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-base-content hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] transition-colors border-none cursor-pointer"
            >
              Stay
            </button>
            <button
              onclick={() => {
                // joinMeetingUrl = null
                // showConfirmClose = false
                handleCloseRequest()
              }}
              class="px-4 py-2 rd-2 bg-red-600 text-base-content hover:bg-red-700 transition-colors border-none cursor-pointer font-600"
            >
              End Session
            </button>
          </div>
        </div>
      </div>
    {/if}

    <div
      class="meeting-frame transition-all duration-300 {meetingStore.isMinimized
        ? 'meeting-frame--min w-full h-full'
        : 'meeting-frame--full w-[95%] h-[90%] rd-4 overflow-hidden shadow-2xl'}"
      class:pointer-events-none={meetingStore.isMinimized}
    >
      <div class="meeting-frame__content">
        <MeetingWindow
          meetingUrl={meetingStore.joinMeetingUrl}
          isMinimized={meetingStore.isMinimized}
        />
      </div>
    </div>

    {#if meetingStore.isMinimized}
      <div
        transition:fade={{ duration: 200 }}
        class="absolute bottom-3 -translate-x-1/2 flex items-center gap-2 z-1001 bg-black/40 backdrop-blur-md p-1.5 rd-full border border-white/10"
      >
        <button
          onclick={toggleMute}
          class="w-8 h-8 rd-full flex items-center justify-center border-none transition-all duration-200 cursor-pointer
        {isMicMuted
            ? 'bg-red-500/80 text-base-content'
            : 'bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content hover:bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)]'}"
          title={isMicMuted ? 'Unmute' : 'Mute'}
        >
          <i class="ph-bold {isMicMuted ? 'ph-microphone-slash' : 'ph-microphone'} text-sm"></i>
        </button>

        <button
          onclick={togglePrivacy}
          class="w-8 h-8 rd-full flex items-center justify-center border-none transition-all duration-200 cursor-pointer
        {isPrivacyMode
            ? 'bg-red-500/80 text-base-content'
            : 'bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content hover:bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)]'}"
          title={isPrivacyMode ? 'Start Video' : 'Stop Video'}
        >
          <i class="ph-bold {isPrivacyMode ? 'ph-video-slash' : 'ph-video'} text-sm"></i>
        </button>

        <button
          onclick={handleCloseRequest}
          class="w-8 h-8 rd-full bg-red-600 text-base-content flex items-center justify-center border-none hover:bg-red-700 hover:scale-110 transition-all cursor-pointer shadow-lg shadow-red-900/20"
          title={$_('End Meeting')}
        >
          <i class="ph-bold ph-phone-disconnect text-sm"></i>
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 2px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(2, 101, 210, 0.2);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: var(--bg-primary);
  }

  .meeting-frame {
    position: relative;
    width: 100%;
    height: 100%;
    --meeting-top: 44px;
    --meeting-bottom: 16px;
  }

  .meeting-frame--min {
    --meeting-top: 36px;
    --meeting-bottom: 64px;
  }

  .meeting-frame__content {
    position: absolute;
    left: 0;
    right: 0;
    top: var(--meeting-top);
    bottom: var(--meeting-bottom);
  }
</style>
