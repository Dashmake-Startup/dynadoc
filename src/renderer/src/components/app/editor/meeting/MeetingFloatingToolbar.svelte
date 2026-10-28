<script>
  import { _ } from 'svelte-i18n'
  let isExpanded = $state(true)
  let isMicMuted = $state(false)
  let isLaserActive = $state(false)
  let isSpotlightActive = $state(false)
  let isAnnotationActive = $state(false)
  let isMagnifierActive = $state(false)
  let isPrivacyMode = $state(false)

  // Mute Logic
  const toggleMute = () => {
    isMicMuted = !isMicMuted
    window.meetingAPI.toggleMic(isMicMuted)
  }

  // Innovative: Drawing Mode
  const toggleAnnotations = () => {
    isAnnotationActive = !isAnnotationActive
    window.meetingAPI.toggleAnnotations(isAnnotationActive)
  }

  // Innovative: Magnifier (Zoom into a portion of the screen)
  const toggleMagnifier = () => {
    isMagnifierActive = !isMagnifierActive
    window.meetingAPI.toggleMagnifier(isMagnifierActive)
  }

  const toggleLaser = () => {
    isLaserActive = !isLaserActive
    window.meetingAPI.toggleLaser(isLaserActive)
  }

  const toggleSpotlight = () => {
    isSpotlightActive = !isSpotlightActive
    window.meetingAPI.toggleSpotlight(isSpotlightActive)
  }

  const togglePrivacy = () => {
    isPrivacyMode = !isPrivacyMode
    // Tells MiroTalk/Webview to show a blur overlay
    window.meetingAPI.sendToMeeting('privacy-blur', isPrivacyMode)
  }

  const stopSharing = () => window.meetingAPI.stopSharing()
</script>

<div class="toolbar-container" class:collapsed={!isExpanded}>
  <button class="drag-handle" onclick={() => (isExpanded = !isExpanded)}>
    <div class="dot"></div>
  </button>

  <div class="toolbar-pill">
    <section class="status-group">
      <div class="status-indicator" class:privacy={isPrivacyMode}></div>
      <!-- <div class="status-indicator animate-pulse" class:privacy={isPrivacyMode}></div> -->
      {#if isExpanded}
        <span class="label">{isPrivacyMode ? $_('Paused') : $_('Live')}</span>
      {/if}
    </section>

    <div class="divider"></div>

    <div class="button-group">
      <!-- <button class="action-btn" class:active={!isMicMuted} onclick={() => isMicMuted = !isMicMuted} title="Mute/Unmute">
        <i class="ph-light {isMicMuted ? 'ph-microphone-slash' : 'ph-microphone'}"></i>
      </button> -->
      <button class="action-btn" class:muted={isMicMuted} onclick={toggleMute} title={$_('Mute/Unmute')}>
        <div class="icon-wrapper">
          <i class="ph-light {isMicMuted ? 'ph-microphone-slash' : 'ph-microphone'}"></i>
          {#if isMicMuted}<div class="mute-slash"></div>{/if}
        </div>
      </button>

      <button
        class="action-btn"
        class:active={isLaserActive}
        onclick={toggleLaser}
        title={$_('Laser Pointer (L)')}
      >
        <i class="ph-light ph-magic-wand"></i>
      </button>

      <button
        class="action-btn"
        class:active={isSpotlightActive}
        onclick={toggleSpotlight}
        title={$_('Spotlight Mode (S)')}
      >
        <i class="ph-light ph-flashlight"></i>
      </button>

      <!-- <button
        class="action-btn"
        class:active={isPrivacyMode}
        onclick={togglePrivacy}
        title="Privacy Blur"
      >
        <i class="ph-light {isPrivacyMode ? 'ph-eye-slash' : 'ph-eye'}"></i>
      </button> -->
    </div>

    <div class="divider"></div>
    <div class="button-group">
      <button
        class="action-btn"
        class:active={isAnnotationActive}
        onclick={toggleAnnotations}
        title={$_('Draw on Screen')}
      >
        <i class="ph-light ph-scribble-loop"></i>
      </button>

      <button
        class="action-btn"
        class:active={isMagnifierActive}
        onclick={toggleMagnifier}
        title={$_('Magnifier Zoom')}
      >
        <i class="ph-light ph-magnifying-glass-plus"></i>
      </button>
      <button
        class="action-btn"
        class:active={isPrivacyMode}
        onclick={togglePrivacy}
        title={$_('Privacy Blur')}
      >
        <i class="ph-light {isPrivacyMode ? 'ph-eye-slash' : 'ph-eye'}"></i>
      </button>
    </div>
    <div class="divider"></div>

    <button class="action-btn stop" onclick={stopSharing}>
      <i class="ph-light ph-stop-circle"></i>
      {#if isExpanded}<span>{$_('Stop')}</span>{/if}
    </button>
  </div>
</div>

<style>
  .toolbar-container {
    display: flex;
    align-items: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toolbar-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(20, 20, 20, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(20px);
    padding: 6px 12px;
    border-radius: 14px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    -webkit-app-region: no-drag;
  }

  .drag-handle {
    width: 24px;
    height: 40px;
    background: rgba(40, 40, 40, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-right: none;
    border-radius: 10px 0 0 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-app-region: drag;
  }

  .action-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: #999;
    transition: all 0.2s;
    cursor: pointer;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }
  .action-btn.active {
    color: #0265d2;
    background: rgba(2, 101, 210, 0.1);
  }
  .action-btn.stop {
    color: #ff3b30;
    width: auto;
    padding: 0 8px;
  }

  .status-indicator {
    width: 6px;
    height: 6px;
    background: #30ff49;
    border-radius: 50%;
  }
  .status-indicator.privacy {
    background: #ff9500;
  }

  .collapsed .label,
  .collapsed span {
    display: none;
  }




  .action-btn.muted {
    color: #ff3b30;
    background: rgba(255, 59, 48, 0.1);
  }

  .mini-divider {
    width: 1px;
    height: 16px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 4px;
  }

  /* Mute slash animation */
  .icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn:hover {
    transform: translateY(-2px);
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
  }
</style>
