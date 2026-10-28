<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import { basicNodeCounts, defaultStats, nodeCounts } from '../stores/restriction.store'
  import {
    // defaultDocumentRestrictionRules,
    // documentRestrictionRulesIcons,
    // documentRestrictionRulesLabels,
    loadDocumentRestrictionRules
  } from '../utils/common.utils'
  import { fade } from 'svelte/transition'
  // import { toast } from 'svelte-hot-french-toast'
  import toast from 'svelte-hot-french-toast'
  import { onMount } from 'svelte'
  import {
    defaultDocumentRestrictionRules,
    documentRestrictionRulesIcons,
    documentRestrictionRulesLabels
  } from '../utils/restriction.defaults'

  let { editorId } = $props() // Svelte 5 prop

  // 1. Get current counts from store
  // let counts = $derived($nodeCounts)

  // 2. Load rules (limits)
  // Note: Depending on your setup, you might pass the document ID as a prop
  // let rules = $derived(loadDocumentRestrictionRules())
  // Select only this editor's data from the map
  // let counts = $derived($nodeCounts[editorId] || defaultStats);
  // let rules = $derived(loadDocumentRestrictionRules(editorId));

  // 1. Subscribe to active ID
  //currentActiveDocument =  Get active translatiion in _$_documentEditorsList, if nothing foound use _$_documentEditorsList.getAtive
  // currentActiveId = _$_wysiwygEditorsList.get(currentActiveDocument.id).id
  // let currentActiveId = $derived($activeEditorId);
  // 1. Get the globally active translation (Reacts to setActiveTranslation)
  const activeTranslation = _$_documentEditorsList.getActiveTranslation()
  const activeDocStore = _$_documentEditorsList.getActive()

  // 2. Derive the current active ID from the translation path
  // If no translation is active, fallback to the active document editor's ID
  const normalizedEditorId = $derived(String(editorId ?? ''))

  let currentActiveId = $derived.by(() => {
    if ($activeTranslation) return $activeTranslation.path

    // const activeDoc = _$_documentEditorsList.getActiveSync()
    // return activeDoc?.id || null

    // Fallback to the main document editor
    const activeDoc = $activeDocStore
    if (!activeDoc) return null

    // IMPORTANT: Check if your editorId is the filePath or the numeric ID
    // We try to match both possibilities
    return activeDoc.id?.toString() || activeDoc.document?.getMainFilePath?.() || null
  })

  // Consider both editor.id and file path based IDs
  const isActiveView = $derived.by(() => {
    const activeId = currentActiveId
    if (!activeId || !normalizedEditorId) return false
    if (activeId === normalizedEditorId) return true
    const activeMainPath = $activeDocStore?.document?.getMainFilePath?.()
    return activeMainPath === normalizedEditorId
  })

  // 2. Only compute stats if we are the active tab (saves performance)
  let counts = $derived(isActiveView ? $nodeCounts[normalizedEditorId] || defaultStats : null)
  let rules = $state({ ...defaultDocumentRestrictionRules })

  // 3. Derive Counts from your existing nodeCounts store
  // let counts = $derived(isActiveView ? $nodeCounts[editorId] || defaultStats : null)

  // 1. Get the active translation store
  /* const activeTranslation = _$_documentEditorsList.getActiveTranslation();
  const activeDocStore = _$_documentEditorsList.getActive();

  // 2. Derive the ID of what the user is ACTUALLY looking at
  // If a translation is active, that path is the ID.
  // If NOT, the active document's ID (or its main file path) is the ID.
  let currentActiveId = $derived.by(() => {
    if ($activeTranslation) return $activeTranslation.path;
    
    // Fallback to the main document editor
    const activeDoc = $activeDocStore;
    if (!activeDoc) return null;

    // IMPORTANT: Check if your editorId is the filePath or the numeric ID
    // We try to match both possibilities
    return activeDoc.id?.toString();
  });

  // 3. Performance Check
  // We check if the currentActiveId matches THIS toolbar's editorId
  let isActiveView = $derived(currentActiveId === editorId);

  // 4. Data Streams
  let counts = $derived(isActiveView ? $nodeCounts[editorId] || defaultStats : null);
  let rules = $derived(isActiveView ? loadDocumentRestrictionRules(editorId) : null);
 */

  onMount(() => {
    const handleWarning = (e: any) => {
      const warningEditorId = String(e?.detail?.editorId ?? '')
      if (!warningEditorId || !isActiveView || warningEditorId !== normalizedEditorId) return
      const message = e?.detail?.message
      if (!message) return
      toast.error(message, {
        // position: 'bottom-right',
        // position: 'bottom-start',
        position: 'bottom-center'
        // style: 'background: var(--danger); color: #fff; font-size: 12px; border: 1px solid #f44336;'
        // style: 'background: #333; color: #fff; font-size: 12px; border: 1px solid #f44336;'
      })
      // toast.success('Hello, World!')
      // console.log('handleWarning toast', { toast })
    }

    window.addEventListener('restriction-warning', handleWarning)
    return () => window.removeEventListener('restriction-warning', handleWarning)
  })

  // Keep toolbar rules in sync on active-tab changes.
  // We rehydrate from the active document source to avoid stale nested-config references.
  $effect(() => {
    if (!isActiveView) return
    const activeDoc = $activeDocStore?.document
    rules = {
      ...defaultDocumentRestrictionRules,
      ...loadDocumentRestrictionRules(activeDoc || normalizedEditorId)
    }
  })

  $effect(() => {
    // console.log('currentActiveId', { isActiveView, editorId })
  })

  // 3. Helper to determine status color
  function getStatus1(key: string, count: number) {
    const rule = rules[key]
    if (!rule) return 'normal'

    // Danger state (Hard limits)
    if ((rule.max && count > rule.max) || (rule.min && count < rule.min)) {
      return 'danger'
    }

    // Warning state (Soft limit - 90% of max reached)
    if (rule.max && count >= rule.max * 0.9) {
      return 'warning'
    }

    return 'normal'
  }

  // 3. Helper to determine status color
  function getStatus(key: string, count: number) {
    if (!rules || !rules[key]) return 'normal'
    const rule = rules[key]

    if ((rule.max && count > rule.max) || (rule.min && count < rule.min)) return 'danger'
    if (rule.max && count >= rule.max * 0.9) return 'warning'

    return 'normal'
  }

  export const basicKeys = Object.keys(basicNodeCounts) as (keyof typeof basicNodeCounts)[]
</script>

{#if counts}
  <div class="restriction-toolbar">
    <!-- {JSON.stringify(currentActiveId)} -->
    <div class="stats-group">
      <!-- {@const  basicKeys = Object.keys(basicNodeCounts) as (keyof typeof basicNodeCounts)[]} -->
      <!-- {#each Object.entries(documentRestrictionRulesLabels).filter(([key]) => basicKeys.includes(key)) as [key, label]} -->

      <!-- {@const basicKeys = Object.keys(basicNodeCounts) as (keyof typeof basicNodeCounts)[]}
 -->

      {#each Object.entries(documentRestrictionRulesLabels).filter( ([key]) => basicKeys.includes(key as keyof typeof basicNodeCounts) ) as [key, label]}
        <!-- {#each Object.entries(documentRestrictionRulesLabels) as [key, label]} -->
        {@const count = counts[key] || 0}
        {@const status = getStatus(key, count)}

        <div class="stat-item {status}" title="{label}: {count}">
          <span class="icon">{@html documentRestrictionRulesIcons[key]}</span>

          <span class="value {counts.isReconciling ? 'reconciling' : ''}">
            {count}
          </span>

          {#if status === 'danger'}
            <div class="dot dot-danger"></div>
          {:else if status === 'warning'}
            <div class="dot dot-warning"></div>
          {/if}
        </div>
      {/each}
    </div>

    {#if counts?.isReconciling}
      <div class="reconciling-indicator" transition:fade={{ duration: 200 }}>
        <div class="spinner"></div>
        <span>...</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .restriction-toolbar {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 1rem;
    height: 32px; /* Fixed height for header/footer alignment */
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px;
  }

  .stats-group {
    display: flex;
    height: 100%;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.75rem;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    transition: background 0.2s;
  }

  .stat-item:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .value {
    color: #f8fafc;
    font-weight: 600;
  }

  .value.reconciling {
    opacity: 0.5;
  }

  /* Status Colors & Dots */
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .stat-item.danger .value {
    color: #f87171; /* red-400 */
  }
  .dot-danger {
    background: #ef4444;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
    /* animation: pulse 2s infinite; */
  }

  .stat-item.warning .value {
    color: #fbbf24; /* amber-400 */
  }
  .dot-warning {
    background: #f59e0b;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }

  /* Reconciling Spinner */
  .reconciling-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
    color: #3b82f6;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .spinner {
    width: 10px;
    height: 10px;
    border: 2px solid rgba(59, 130, 246, 0.2);
    border-top-color: #3b82f6;
    border-radius: 50%;
    /* animation: spin 0.8s linear infinite; */
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
