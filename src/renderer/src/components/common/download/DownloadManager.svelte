<script lang="ts">
  import { _$_downloadManager } from '../../../stores/downloadManager.store'
  import Utils from '../../../utils/Utils'
  import { _ } from 'svelte-i18n'
  import { slide, fly } from 'svelte/transition'

  const manager = _$_downloadManager

  // Function to determine icon based on file extension
  function getFileIcon(label: string) {
    const ext = label.split('.').pop()?.toLowerCase()
    switch (ext) {
      case Utils.FILE_TYPES.pdf: return 'ph-file-pdf'
      case Utils.OFFICE_EXTENSIONS_FORMAT.word:
      case 'doc': return 'ph-file-doc'
      case Utils.OFFICE_EXTENSIONS_FORMAT.excel: return 'ph-file-xls'
      case 'zip':
      case 'rar': return 'ph-file-zip'
      case 'jpg':
      case 'png': return 'ph-file-image'
      default: return 'ph-file'
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  function formatDuration(seconds?: number) {
    if (seconds == null || Number.isNaN(seconds)) return '—'
    if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  function formatSpeed(bps?: number) {
    if (!bps || bps <= 0) return '—'
    return `${formatBytes(bps)}/s`
  }

  function formatJobSize(job: any) {
    const received = job?.bytesReceived ?? 0
    const total = job?.bytesTotal
    if (total) return `${formatBytes(received)} / ${formatBytes(total)}`
    if (received) return `${formatBytes(received)}`
    return '—'
  }

  function formatJobDuration(job: any) {
    if (!job?.startedAt) return '—'
    const start = new Date(job.startedAt).getTime()
    const end = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now()
    if (!start) return '—'
    const seconds = Math.max(0, Math.round((end - start) / 1000))
    return formatDuration(seconds)
  }
</script>

{#if $manager.open}
  <div class="adobe-dm-panel bg-base-100" transition:fly={{ y: 20, duration: 300 }}>
    <header class="dm-header">
      <div class="title-area">
        <i class="ph-bold ph-tray-arrow-down text-primary"></i>
        <h1>{$_('Downloads')}</h1>
        <span class="badge">{$manager.jobs.filter(j => j.status === 'running').length}</span>
      </div>
      
      <div class="header-actions">
        <button class="icon-btn" title={$_('Clear completed')} on:click={() => manager.clearCompleted()}>
          <i class="ph-light ph-broom"></i>
        </button>
        <button class="icon-btn" title={$_('Hide')} on:click={() => manager.close()}>
          <i class="ph-light ph-x"></i>
        </button>
      </div>
    </header>

    {#if $manager.running}
      <div class="global-progress">
        <div class="progress-fill indeterminate"></div>
      </div>
    {/if}

    <div class="dm-toolbar">
      <button class="text-link" on:click={() => ($manager.paused ? manager.resume() : manager.pause())}>
        <i class="ph-bold {$manager.paused ? 'ph-play' : 'ph-pause'}"></i>
        {$manager.paused ? $_('Resume All') : $_('Pause All')}
      </button>
      <div class="divider"></div>
      <button class="text-link" on:click={() => manager.retryFailed()}>
        {$_('Retry Failed')}
      </button>
    </div>

    <div class="dm-list custom-scrollbar">
      {#if $manager.jobs.length === 0}
        <div class="empty-state">
          <i class="ph-light ph-cloud-arrow-down"></i>
          <p>{$_('No active downloads')}</p>
        </div>
      {:else}
        {#each $manager.jobs as job (job.id)}
          <div class="job-card" class:failed={job.status === 'failed'} transition:slide>
            <div class="job-icon-container">
              <i class="ph-bold {getFileIcon(job.label)}"></i>
            </div>

            <div class="job-details">
              <div class="job-row-top">
                <span class="job-name" title={job.label}>{job.label}</span>
                <span class="job-percent">{job.progress}%</span>
              </div>

              <div class="adobe-progress-track">
                <div class="adobe-progress-bar" 
                     class:running={job.status === 'running'}
                     class:done={job.status === 'done'}
                     style="width: {job.progress}%">
                </div>
              </div>

              <div class="job-meta">
                {#if job.status === 'running'}
                  <span class="size">{formatJobSize(job)}</span>
                  <span class="dot">•</span>
                  <span class="speed"><i class="ph-light ph-lightning"></i> {formatSpeed(job.speedBps)}</span>
                  <span class="dot">•</span>
                  <span class="eta">{formatDuration(job.etaSeconds)} left</span>
                {:else if job.status === 'failed'}
                  <span class="error-msg text-red-400">{job.error || $_('Connection lost')}</span>
                {:else if job.status === 'done'}
                  <span class="done-msg text-green-400">
                    <i class="ph-light ph-check-circle"></i>
                    {$_('Completed')} • {formatJobSize(job)} • {formatJobDuration(job)}
                  </span>
                {/if}
              </div>
            </div>

            <div class="job-actions">
              {#if job.status === 'done'}
                <button class="action-btn primary" title={$_('Open File')}>
                  <i class="ph-bold ph-folder-open"></i>
                </button>
              {:else if job.status === 'failed'}
                <button class="action-btn" on:click={() => manager.retryJob(job.id)}>
                  <i class="ph-bold ph-arrows-clockwise"></i>
                </button>
              {/if}
              <button class="action-btn hover:text-red-400" on:click={() => manager.removeJob(job.id)}>
                <i class="ph-light ph-trash"></i>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

<style lang="postcss">
  .adobe-dm-panel {
    @apply fixed right-4 bottom-4 w-[420px] max-h-[500px] flex flex-col
           bg-[var(--color-base-100)]/95 border border-white/10 rd-12px overflow-hidden z-[1200];
    backdrop-filter: blur(12px);
    box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.5);
  }

  /* Header */
  .dm-header {
    @apply flex items-center justify-between p-4 border-b border-white/5;
  }
  .title-area {
    @apply flex items-center gap-3;
    h1 { @apply text-[14px] font-700 tracking-tight text-[var(--color-base-content)]/90; }
  }
  .badge {
    @apply bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rd-4px font-800;
  }

  /* Toolbar */
  .dm-toolbar {
    @apply flex items-center gap-4 px-4 py-2 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)];
  }
  .text-link {
    @apply flex items-center gap-1.5 text-[11px] font-600 text-[var(--color-base-content)]/40 hover:text-[var(--color-base-content)] transition-colors;
  }
  .divider { @apply w-[1px] h-3 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)]; }

  /* Job List */
  .dm-list {
    @apply flex-1 overflow-y-auto p-2 flex flex-col gap-1;
  }

  .job-card {
    @apply flex items-center gap-3 p-3 rd-8px transition-all border border-transparent
           hover:(bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] border-white/5);
  }
  .job-card.failed { @apply bg-red-500/5; }

  .job-icon-container {
    @apply size-10 rd-6px bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] flex items-center justify-center text-xl text-[var(--color-base-content)]/60;
  }

  .job-details { @apply flex-1 min-w-0; }
  
  .job-row-top {
    @apply flex justify-between items-center mb-1.5;
    .job-name { @apply text-[12px] font-600 text-[var(--color-base-content)]/80 truncate pr-2; }
    .job-percent { @apply text-[10px] font-mono text-[var(--color-base-content)]/40; }
  }

  /* Adobe Styled Progress */
  .adobe-progress-track {
    @apply w-full h-[3px] bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] rd-full overflow-hidden mb-1.5;
  }
  .adobe-progress-bar {
    @apply h-full bg-[color-mix(in_srgb,var(--color-base-white)_30%,transparent)] transition-all duration-300;
  }
  .adobe-progress-bar.running { @apply bg-primary shadow-[0_0_8px_rgba(0,190,172,0.4)]; }
  .adobe-progress-bar.done { @apply bg-green-500; }

  .job-meta {
    @apply flex items-center gap-2 text-[10px] text-[var(--color-base-content)]/30 font-medium;
  }

  .job-actions {
    @apply flex items-center gap-1 opacity-0 transition-opacity;
  }
  .job-card:hover .job-actions { @apply opacity-100; }

  .action-btn {
    @apply size-7 rd-4px flex items-center justify-center text-[var(--color-base-content)]/40 
           hover:(bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] text-[var(--color-base-content)]) transition-all;
  }
  .action-btn.primary { @apply text-primary hover:bg-primary hover:text-black; }

  /* Scrollbar */
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { @apply bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] rd-full; }

  .empty-state {
    @apply flex flex-col items-center justify-center py-10 text-[var(--color-base-content)]/20 gap-2;
    i { @apply text-4xl; }
    p { @apply text-[12px] font-medium; }
  }

  /* Global Progress Indeterminate */
  .global-progress { @apply h-[2px] w-full bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] overflow-hidden; }
  .progress-fill.indeterminate {
    @apply w-1/2 h-full bg-primary;
    animation: indeterminate 1.5s infinite linear;
  }

  @keyframes indeterminate {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }
</style>
