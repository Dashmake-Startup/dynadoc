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
  import UpgradeNotice from '../../../common/upgrade/UpgradeNotice.svelte'

  let activeTab = $state('hub') // 'hub' | 'meetings' | 'draft' | 'tasks'
  let isMinimized = $state(false)

  // Note: Assuming Phosphor Icons are available via a component library or CDN
  // Example: import Icon from 'phosphor-svelte'

  // --- Svelte 5 Runes: Reactive State ---
  let searchQuery = $state('')
  let filterType = $state('all') // 'all' | 'video' | 'voice'
  let selectedId = $state(null)

  let isMicMuted = $state(false)
  let isPrivacyMode = $state(false)
  let hasBeenDragged = $state(false)

  // Calculate default position: Bottom Right
  // screenWidth - windowWidth - margin
  let initialX = $derived(typeof window !== 'undefined' ? window.innerWidth - 320 - 24 : 0)
  let initialY = $derived(typeof window !== 'undefined' ? window.innerHeight - 180 - 24 : 0)
  let showConfirmClose = $state(false) // Local state for the confirmation modal

  let generatedRoomId = $state('')
  let showJoinPrompt = $state(false)
  let showTurnCurrentDocumentToMeetingNoteModal = $state(false)
  let showJoinModal = $state(false)
  let inputRoomId = $state('')
  let currentRoomId = $state('')
  let joinMeetingUrl = $state('')
  let meetings = $state([
    {
      id: 1,
      name: 'Meeting 1',
      peers: 4,
      active: true,
      time: '12m ago',
      health: 98,
      type: 'video'
    },
    {
      id: 2,
      name: 'Meeting Design Review',
      peers: 0,
      active: false,
      time: '1h ago',
      health: 0,
      type: 'voice'
    },
    {
      id: 3,
      name: 'Meeting Product Standup',
      peers: 8,
      active: true,
      time: 'Now',
      health: 92,
      type: 'video'
    }
  ])

  // Use the store to check if we are in a meeting
  // let isMeetingActive = $derived(!!meetingStore.joinMeetingUrl);
  // --- Derived State (Runes) ---
  let filteredMeetings = $derived(
    meetings.filter((m) => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = filterType === 'all' || m.type === filterType
      return matchesSearch && matchesType
    })
  )

  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let _activeEditor = $derived($activeDocumentEditorStore)

  let _activeWysiwyg = $derived(
    _activeEditor ? _$_wysiwygEditorsList.getEntryStore(_activeEditor?.id.toString()) : null
  )

  // let { currentRoomId } = $props();

  // Transcription WebSocket endpoint — provided at build time, never hardcoded.
  const TRANSCRIBE_WS_URL = import.meta.env?.VITE_TRANSCRIBE_WS_URL ?? ''

  // Start the worker immediately when the meeting page loads
  $effect(() => {
    if (currentRoomId && TRANSCRIBE_WS_URL) {
      transcriptionStore.init(currentRoomId, TRANSCRIBE_WS_URL)
    }
  })

  // let _activeNodeview = $derived(
  //   _activeWysiwyg ? _$_wysiwygEditorsList.getActiveNodeviewStore($_activeWysiwyg?.id) : null
  // )

  const toggleInspect = (id) => {
    selectedId = selectedId === id ? null : id
  }

  // Generates a Google Meet style ID: xxx-xxxx-xxx
  function generateId() {
    const part1 = Math.random().toString(36).substring(2, 5)
    const part2 = Math.random().toString(36).substring(2, 6)
    const part3 = Math.random().toString(36).substring(2, 5)
    generatedRoomId = `${part1}-${part2}-${part3}`
  }

  async function joinMeetingNow() {
    showTurnCurrentDocumentToMeetingNoteModal = false
    // const url = `https://meeting.dynadoc.dashmake.com/join/?room=${currentRoomId}`
    const url = `https://meeting.dynadoc.dashmake.com/${currentRoomId}`
    // window.meetingAPI.openMeeting(url)
    joinMeetingUrl = url
    await meetingStore.startMeeting(currentRoomId) // Call the store

    showJoinModal = false
    inputRoomId = ''
  }
  function joinMeeting(roomId) {
    if (!roomId) return
    currentRoomId = roomId
    showJoinModal = false
    showTurnCurrentDocumentToMeetingNoteModal = true
  }
  function turnCurrentDocumentToMeetingNote1() {
    _activeEditor.document.associatedMeetingLinks = [
      ..._activeEditor.document.associatedMeetingLinks,
      currentRoomId
    ]

    showTurnCurrentDocumentToMeetingNoteModal = false
    joinMeetingNow()
  }

  function handleCloseRequest() {
    if (isMinimized) {
      // If minimized, just close directly or expand first?
      // Usually, direct exit is fine for PIP.
      joinMeetingUrl = null
    } else {
      showConfirmClose = true
    }
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

  function turnCurrentDocumentToMeetingNote() {
    if (!_activeEditor) return

    // Use the store helper to update instead of direct mutation
    _$_documentEditorsList.addMeetingLink(_activeEditor.id, currentRoomId)

    showTurnCurrentDocumentToMeetingNoteModal = false
    joinMeetingNow()
  }
</script>

<DetachedPanel title={$_('Meeting Pane')}>
  <!-- <aside
  class="h-full w-full flex flex-col bg-base-100 border-l border-white/5 font-sans select-none overflow-hidden"
> -->
  <aside
    class="meeting-pane h-full w-full flex flex-col border-l border-white/5 font-sans select-none overflow-hidden"
  >
    <div class="flex border-b border-white/5 bg-black/20">
      {#each ['hub', 'meetings', 'draft', 'tasks'] as tab}
        <button
          onclick={() => (activeTab = tab)}
          class="flex-1 py-3 text-[9px] font-900 uppercase tracking-widest transition-all
        {activeTab === tab
            ? 'text-base-300 border-b-2 border-base-300'
            : 'text-base-content/30 hover:text-base-content/60'}"
        >
          {tab}
        </button>
      {/each}
    </div>

    <div class="p-3 border-b border-white/5">
      <UpgradeNotice
        title={$_('Meeting Access Control')}
        message={$_(
          'Free meetings are link-open. Upgrade to enforce lobby approvals, host-only controls, and role-based speaking permissions.'
        )}
        highlight="corporate"
        compact={true}
      />
    </div>

    <div class="flex-1 overflow-hidden">
      {#if activeTab === 'hub'}
        <header
          class="p-5 space-y-4 bg-gradient-to-b from-white/[0.03] to-transparent border-b border-white/5"
        >
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <i class="ph-light ph-projector-screen text-base-300 text-lg"></i>
              <h2 class="text-[10px] font-800 uppercase tracking-[0.15em] text-[#888]">
                {$_('Meeting Hub')}
              </h2>
            </div>
            <div
              class="flex items-center gap-2 px-2 py-1 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-full"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-[#2D9D78]"></div>
              <span class="text-[9px] font-700 text-[#666] uppercase">{$_('Live')}</span>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-2">
                <button
                  onclick={generateId}
                  class="flex items-center justify-center gap-2 py-2.5 rounded-md bg-base-300 hover:bg-base-300/10 transition-all shadow-[0_4px_12px_rgba(2,101,210,0.2)] active:scale-95 group"
                >
                  <i
                    class="ph-light ph-plus-circle text-base-content group-hover:rotate-90 transition-transform"
                  ></i>
                  <span class="text-[11px] font-700 text-base-content">{$_('New Room')}</span>
                </button>

                {#if generatedRoomId}
                  <div
                    class="flex items-center justify-between p-2 bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-base-300/30 rounded text-[10px] text-base-content animate-in fade-in slide-in-from-top-1"
                  >
                    <span>{$_('ID')}: <strong>{generatedRoomId}</strong></span>
                    <button
                      onclick={() => joinMeeting(generatedRoomId)}
                      class="text-base-300 font-bold hover:underline">{$_('Join Now')}</button
                    >
                  </div>
                {/if}
              </div>

              <button
                onclick={() => (showJoinModal = true)}
                class="flex items-center self-start justify-center gap-2 py-2.5 rounded-md bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 hover:border-base-300/50 transition-all active:scale-95"
              >
                <i class="ph-light ph-identification-card text-base-300"></i>
                <span class="text-[11px] font-700 text-base-content">{$_('Join ID')}</span>
              </button>
            </div>
          </div>
        </header>

        <div class="flex-1 p-4 space-y-3">
          <div class="max-h-60 overflow-y-auto">
            <MeetingDraft />
          </div>
          <div class="max-h-60 overflow-y-auto">
            <MeetingTasks />
          </div>
        </div>
      {:else if activeTab === 'meetings'}
        <header
          class="p-5 space-y-4 bg-gradient-to-b from-white/[0.03] to-transparent border-b border-white/5"
        >
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <i class="ph-light ph-projector-screen text-base-300 text-lg"></i>
              <h2 class="text-[10px] font-800 uppercase tracking-[0.15em] text-[#888]">
                {$_('Meetings List')}
              </h2>
            </div>
            <!-- <div class="flex items-center gap-2 px-2 py-1 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-full">
              <div class="w-1.5 h-1.5 rounded-full bg-[#2D9D78]"></div>
              <span class="text-[9px] font-700 text-[#666] uppercase">{$_('Live')}</span>
            </div> -->
          </div>

          <div class="space-y-2">
            <div class="relative group">
              <i
                class="ph-light ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#444] group-focus-within:text-base-300 transition-colors"
              ></i>
              <input
                bind:value={searchQuery}
                placeholder={$_('Search sessions...')}
                class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] border border-white/5 rounded-md py-2 pl-9 pr-4 text-xs text-[#eee] outline-none focus:border-base-300/50 focus:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] transition-all placeholder-[#444]"
              />
            </div>

            <div class="flex bg-black/40 p-1 rounded-md border border-white/5">
              {#each ['all', 'video', 'voice'] as type}
                <button
                  onclick={() => (filterType = type)}
                  class="flex-1 py-1 text-[9px] font-800 uppercase tracking-tighter rounded transition-all
            {filterType === type
                    ? 'bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-base-content shadow-sm'
                    : 'text-[#555] hover:text-[#888]'}"
                >
                  {$_(type)}
                </button>
              {/each}
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-2">
                <button
                  onclick={generateId}
                  class="flex items-center justify-center gap-2 py-2.5 rounded-md bg-base-300 hover:bg-base-300/10 transition-all shadow-[0_4px_12px_rgba(2,101,210,0.2)] active:scale-95 group"
                >
                  <i
                    class="ph-light ph-plus-circle text-base-content group-hover:rotate-90 transition-transform"
                  ></i>
                  <span class="text-[11px] font-700 text-base-content">{$_('New Room')}</span>
                </button>

                {#if generatedRoomId}
                  <div
                    class="flex items-center justify-between p-2 bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-base-300/30 rounded text-[10px] text-base-content animate-in fade-in slide-in-from-top-1"
                  >
                    <span>{$_('ID')}: <strong>{generatedRoomId}</strong></span>
                    <button
                      onclick={() => joinMeeting(generatedRoomId)}
                      class="text-base-300 font-bold hover:underline">{$_('Join Now')}</button
                    >
                  </div>
                {/if}
              </div>

              <button
                onclick={() => (showJoinModal = true)}
                class="flex items-center self-start justify-center gap-2 py-2.5 rounded-md bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 hover:border-base-300/50 transition-all active:scale-95"
              >
                <i class="ph-light ph-identification-card text-base-300"></i>
                <span class="text-[11px] font-700 text-base-content">{$_('Join ID')}</span>
              </button>
            </div>
          </div>
        </header>

        <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {#each filteredMeetings as meeting (meeting.id)}
            <div
              class="group relative bg-base-200 border border-white/[0.03] rounded-lg p-4 hover:bg-base-100 transition-all cursor-pointer
        {selectedId === meeting.id
                ? 'border-base-300/50 bg-base-200 shadow-[0_8px_20px_rgba(0,0,0,0.4)]'
                : ''}"
              onclick={() => toggleInspect(meeting.id)}
            >
              <div class="flex justify-between items-start">
                <div class="flex items-start gap-3">
                  <div class="mt-1 p-2 rounded-md bg-black/40 border border-white/5">
                    <i
                      class="ph-light {meeting.type === 'video'
                        ? 'ph-video-camera'
                        : 'ph-microphone-stage'} text-[#666] group-hover:text-base-300 transition-colors"
                    ></i>
                  </div>
                  <div>
                    <h3
                      class="text-sm font-700 text-[#ddd] group-hover:text-base-content transition-colors leading-tight"
                    >
                      {meeting.name}
                    </h3>
                    <p class="text-[10px] font-600 text-[#555] mt-1 uppercase tracking-tighter">
                      {meeting.time} • {meeting.peers}
                      {$_('Members')}
                    </p>
                  </div>
                </div>

                {#if meeting.active}
                  <div class="flex flex-col items-end gap-1">
                    <span class="text-[8px] font-900 text-[#2D9D78] bg-[#2D9D78]/10 px-1 rounded"
                      >{$_('HEALTH')} {meeting.health}%</span
                    >
                  </div>
                {/if}
              </div>

              {#if selectedId === meeting.id}
                <div
                  transition:slide={{ duration: 300, easing: cubicOut }}
                  class="pt-4 mt-4 border-t border-white/5 space-y-4"
                >
                  <div class="grid grid-cols-2 gap-2">
                    <div class="p-2 bg-black/40 rounded border border-white/5">
                      <p class="text-[8px] text-[#555] uppercase font-800 tracking-widest">
                        {$_('Encryption')}
                      </p>
                      <p class="text-[10px] font-700 text-[#2D9D78] flex items-center gap-1">
                        <i class="ph-light ph-shield-checkered"></i>
                        {$_('E2EE Active')}
                      </p>
                    </div>
                    <div class="p-2 bg-black/40 rounded border border-white/5">
                      <p class="text-[8px] text-[#555] uppercase font-800 tracking-widest">
                        {$_('Region')}
                      </p>
                      <p class="text-[10px] font-700 text-[#eee]">{$_('AWS-West-1')}</p>
                    </div>
                  </div>
                  <button
                    class="w-full py-2.5 bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] text-black text-[10px] font-900 uppercase tracking-[0.2em] rounded hover:bg-base-300 hover:text-base-content transition-all"
                  >
                    {$_('Join')}
                  </button>
                </div>
              {/if}
            </div>
          {:else}
            <div
              class="h-48 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-xl opacity-40"
              in:fade
            >
              <i class="ph-light ph-selection-background text-3xl mb-2"></i>
              <p class="text-[10px] font-800 uppercase tracking-widest">{$_('Workspace Empty')}</p>
            </div>
          {/each}
        </div>
      {:else if activeTab === 'draft'}
        <MeetingDraft />
        <!-- <MeetingDraft romId={currentRoomId} /> -->
      {:else if activeTab === 'tasks'}
        <MeetingTasks />
      {/if}
    </div>
  </aside>
</DetachedPanel>

{#if showJoinModal}
  <div
    class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
  >
    <div
      class="w-full max-w-[320px] bg-[#1e1e1e] border border-white/10 rounded-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
    >
      <h3 class="text-base-content text-lg font-600 mb-1">{$_('Join a Room')}</h3>
      <p class="text-base-content/50 text-[11px] mb-4">
        {$_('Enter the code provided by the organizer.')}
      </p>

      <input
        bind:value={inputRoomId}
        placeholder={$_('abc-defg-hij')}
        class="w-full bg-[color-mix(in_srgb,var(--color-base-white)_4%,transparent)] border border-white/10 rounded-md py-2 px-3 text-base-content text-[13px] focus:outline-none focus:border-base-300 mb-4"
      />

      <div class="flex justify-end gap-2">
        <button
          onclick={() => (showJoinModal = false)}
          class="px-4 py-2 text-[11px] text-base-content/70 hover:text-base-content transition-colors"
        >
          {$_('Cancel')}
        </button>
        <button
          onclick={() => joinMeeting(inputRoomId)}
          class="px-4 py-2 bg-base-300 rounded-md text-[11px] text-base-content font-700 hover:bg-base-300/10"
        >
          {$_('Join Now')}
        </button>
      </div>
    </div>
  </div>
{/if}
{#if showTurnCurrentDocumentToMeetingNoteModal}
  <div
    transition:fade={{ duration: 150 }}
    class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-md px-4"
  >
    <div
      class="w-full max-w-[340px] bg-[#1e1e1e] border border-white/10 rounded-2xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200"
    >
      <div class="mb-6 flex flex-col items-center text-center">
        <h3 class="text-base-content text-xl font-700 tracking-tight mb-2">
          {$_('Sync Document')}
        </h3>
        <p class="text-base-content/50 text-xs leading-relaxed">
          {$_('Would you like to associate this document with')}
          <span class="text-base-300 font-600"
            >{$_('Room: {room}', { values: { room: currentRoomId } })}</span
          >?
        </p>
      </div>

      <div class="space-y-3">
        <button
          onclick={() => turnCurrentDocumentToMeetingNote()}
          class="w-full py-3 bg-base-300 rounded-xl text-sm text-base-content font-600 hover:bg-base-300/10 active:scale-[0.98] transition-all"
        >
          {$_('Yes, sync and join')}
        </button>

        <button
          onclick={() => joinMeetingNow()}
          class="w-full py-3 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] rounded-xl text-sm text-base-content/70 hover:bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] transition-all"
        >
          {$_('Join without syncing')}
        </button>

        <button
          onclick={() => {
            showTurnCurrentDocumentToMeetingNoteModal = false
          }}
          class="w-full py-2 text-[11px] text-base-content/30 hover:text-base-content/60 transition-colors"
        >
          {$_('Cancel')}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if false}
  <!-- {#if joinMeetingUrl} -->
  <div
    use:dragMinimizedWindow={{ isMinimized, onDragStart: () => (hasBeenDragged = true) }}
    class="fixed z-1000 bg-black/70 overflow-hidden flex items-center justify-center transition-all duration-400 ease-[cubic-bezier(0.2,1,0.2,1)] {isMinimized
      ? 'top-0 left-0 w-[320px] h-[180px] rd-4 shadow-2xl border-2 border-white/10'
      : 'inset-0 w-full h-full backdrop-blur-md shadow-[0_0_0_100vmax_rgba(0,0,0,0.7)]'}"
    style={isMinimized && !hasBeenDragged
      ? `transform: translate3d(${initialX}px, ${initialY}px, 0)`
      : ''}
  >
    <!-- <div
      class="absolute top-0 left-0 right-0 h-10 z-1000 flex items-center justify-between px-4 cursor-grab bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 {isMinimized ? 'opacity-100' : 'opacity-0 hover:opacity-100'}"
    >
      <div class="w-10 h-1 bg-[color-mix(in_srgb,var(--color-base-white)_20%,transparent)] rd-1"></div>
      <button
        onclick={() => (isMinimized = !isMinimized)}
        class="text-base-content hover:text-base-400 transition-colors bg-transparent border-none cursor-pointer"
      >
        <i class={isMinimized ? 'ph-bold ph-corners-out' : 'ph-bold ph-corners-in'}></i>
      </button>
    </div> -->
    <div
      class="drag-handle absolute top-0 left-0 right-0 h-10 z-1000 flex items-center justify-end px-4 cursor-grab bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 {isMinimized
        ? 'opacity-100'
        : 'opacity-0 hover:opacity-100'}"
    >
      <div class="flex items-center gap-2">
        <button
          onclick={() => (isMinimized = !isMinimized)}
          class="text-base-content/80 hover:text-base-400 transition-colors bg-transparent border-none cursor-pointer p-1"
        >
          <i class="text-lg {isMinimized ? 'ph-bold ph-corners-out' : 'ph-bold ph-corners-in'}"></i>
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
                joinMeetingUrl = null
                showConfirmClose = false
              }}
              class="px-4 py-2 rd-2 bg-red-600 text-base-content hover:bg-red-700 transition-colors border-none cursor-pointer font-600"
            >
              End Session
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- <div
      class="transition-all duration-300 {isMinimized
        ? 'w-full h-full'
        : 'w-[95%] h-[90%] rd-4 overflow-hidden shadow-2xl'}"
      class:pointer-events-none={isMinimized}
    >
      <MeetingWindow meetingUrl={joinMeetingUrl} {isMinimized} />
    </div> -->

    {#if isMinimized}
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

<style lang="postcss">
  @media (max-width: 768px) {
    .meeting-pane {
      border-left: 0;
    }
    .meeting-pane header {
      padding: 16px;
    }
    .meeting-pane .p-3 {
      padding: 12px;
    }
  }

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
</style>
