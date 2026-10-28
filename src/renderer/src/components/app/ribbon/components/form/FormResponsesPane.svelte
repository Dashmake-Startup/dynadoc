<script lang="ts">
  // const nodeApi =
  //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
  // const fs = nodeApi?.fs
  // const path = nodeApi?.path
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { authStore } from '../../../../../stores/auth.store'
  import { _$_documentEditorsList } from '../../../../../stores/editor.store'
  import {
    getDeviceIdSync,
    getOrCreateDeviceId,
    isIdentityOwnerOfDocument
  } from '../../../../../services/identity/identity.service'
  import {
    listFormResponses,
    listFormHistory,
    startFormStream
  } from '../../../../../services/forms/forms.service'
  import { nodeApi } from '../../../../../utils/shims/node'

  let loading = $state(false)
  let error = $state('')
  let responses = $state<any[]>([])
  let selectedId = $state<string | null>(null)
  let selectedHistory = $state<any[]>([])
  let previewOpen = $state(false)
  let previewIndex = $state(0)
  let streamStatus = $state<{ connected: boolean; message?: string }>({ connected: false })
  let chartExpanded = $state(true)
  let historyExpanded = $state(true)
  let autoRefresh = $state(true)
  let timer: ReturnType<typeof setInterval> | null = null
  let streamHandle: { close: () => void } | null = null
  let fileWatchHandle: (() => void) | null = null

  const activeDocStore = _$_documentEditorsList.getActive()
  const activeDoc = $derived($activeDocStore?.document || null)
  const docUuid = $derived(activeDoc?.uuid || '')

  const isAuthenticated = $derived($authStore?.authenticated)
  const currentUserId = $derived(
    ($authStore?.user?.id ||
      ($authStore as any)?.user?.uuid ||
      ($authStore as any)?.user?.uid ||
      ($authStore as any)?.user?.userId) ??
      null
  )
  let deviceId = $state<string>(getDeviceIdSync() || '')
  onMount(() => {
    if (!deviceId) {
      void getOrCreateDeviceId().then((id) => {
        deviceId = id
      })
    }
  })
  const ownerIds = $derived((activeDoc?.config?.security?.owners || []).map((v) => String(v)))
  const ownerGroups = $derived(
    (activeDoc?.config?.security?.ownerGroups || []).map((v) => String(v))
  )
  const ownerPrimary = $derived(activeDoc?.info?.createdBy ? String(activeDoc.info.createdBy) : '')
  const ownerPrimaryTemp = $derived(
    activeDoc?.info?.createdByTemp ? String(activeDoc.info.createdByTemp) : ''
  )
  const userGroups = $derived(($authStore?.user?.groups || []).map((v) => String(v)))
  const userEmails = $derived(
    [
      $authStore?.user?.email,
      $authStore?.user?.username,
      $authStore?.user?.name,
      $authStore?.user?.displayName
    ]
      .filter(Boolean)
      .map((v) => String(v).trim().toLowerCase())
  )

  const isOwner = $derived.by(() =>
    isIdentityOwnerOfDocument(
      {
        authenticated: Boolean(isAuthenticated),
        userId: currentUserId ? String(currentUserId) : '',
        deviceId,
        userEmails,
        userGroups
      },
      {
        createdBy: ownerPrimary,
        createdByTemp: ownerPrimaryTemp,
        ownerIds,
        ownerGroups
      }
    )
  )

  const selected = $derived(responses.find((item) => item.id === selectedId) || null)
  const selectedResponder = $derived(selected?.responderId || selected?.responderName || '')
  const previewItems = $derived(
    previewOpen ? (selectedHistory.length ? selectedHistory : responses) : responses
  )
  const previewItem = $derived(previewItems[previewIndex] || null)

  const chartData = $derived(() => {
    const counts: Record<string, Record<string, number>> = {}
    responses.forEach((item) => {
      const answers = Array.isArray(item.answers) ? item.answers : []
      answers.forEach((answer) => {
        const label = String(answer.label || answer.name || '')
        const value =
          typeof answer.value === 'object'
            ? JSON.stringify(answer.value)
            : String(answer.value ?? '')
        if (!label) return
        if (!counts[label]) counts[label] = {}
        counts[label][value] = (counts[label][value] || 0) + 1
      })
    })
    return counts
  })

  $effect(() => {
    if (docUuid) {
      refresh()
    }
  })

  $effect(() => {
    if (!docUuid || !isOwner) {
      streamHandle?.close?.()
      streamHandle = null
      fileWatchHandle?.()
      fileWatchHandle = null
      return
    }
    startStream()
  })

  async function refresh() {
    if (!docUuid || !isOwner) return
    loading = true
    error = ''
    const result = await listFormResponses({ docUuid })
    loading = false
    if (!result?.ok) {
      error = result?.message || $_('Unable to load responses')
      responses = []
      return
    }
    responses = Array.isArray(result?.items) ? result.items : []
    if (!selectedId && responses.length) {
      selectedId = responses[0].id
    }
    await cacheResponses()
  }

  async function loadHistory() {
    if (!docUuid || !selectedResponder) {
      selectedHistory = []
      return
    }
    const result = await listFormHistory({ docUuid, responderId: selectedResponder })
    if (result?.ok && Array.isArray(result?.items)) {
      selectedHistory = result.items
    } else {
      selectedHistory = []
    }
  }

  function toCsv() {
    if (!responses.length) return ''
    const headers = [
      'submissionId',
      'submittedAt',
      'responderId',
      'responderName',
      'field',
      'value'
    ]
    const rows: string[] = [headers.join(',')]
    responses.forEach((item) => {
      const answers = Array.isArray(item.answers) ? item.answers : []
      if (!answers.length) {
        rows.push(
          [
            item.id,
            item.submittedAt || '',
            item.responderId || '',
            item.responderName || '',
            '',
            ''
          ]
            .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
            .join(',')
        )
        return
      }
      answers.forEach((answer: any) => {
        rows.push(
          [
            item.id,
            item.submittedAt || '',
            item.responderId || '',
            item.responderName || '',
            answer.label || answer.name || '',
            typeof answer.value === 'object'
              ? JSON.stringify(answer.value)
              : String(answer.value ?? '')
          ]
            .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
            .join(',')
        )
      })
    })
    return rows.join('\n')
  }

  async function exportJson() {
    if (!responses.length) return
    const savePath = await window.api?.saveDialogFile?.({
      title: $_('Export responses'),
      defaultPath: `form-responses-${docUuid}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (!savePath) return
    await nodeApi?.fsPromises?.writeFile?.(savePath, JSON.stringify(responses, null, 2), 'utf-8')
  }

  async function cacheResponses() {
    try {
      const cacheDir = await window.api?.getCacheDir?.()
      // const nodeApi =
      //   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
      // const fs = nodeApi?.fs
      // const path = nodeApi?.path
      if (!cacheDir || !nodeApi.fsPromises || !nodeApi.path) return
      const docDir = nodeApi.path.join(cacheDir, docUuid || 'forms')
      await nodeApi.fsPromises.mkdir(docDir, { recursive: true })
      const filePath = nodeApi.path.join(docDir, 'owner-form-responses.json')
      await nodeApi.fsPromises.writeFile(filePath, JSON.stringify(responses, null, 2), 'utf-8')
      await watchFile(filePath)
    } catch {
      // ignore
    }
  }

  async function watchFile(filePath: string) {
    if (!window.api?.watchFile || !window.api?.onFileChange) return
    if (fileWatchHandle) return
    const watchId = `forms-responses-${docUuid}`
    await window.api.watchFile(filePath, watchId)
    const off = window.api.onFileChange((content, callerId) => {
      if (callerId !== watchId) return
      try {
        const parsed = JSON.parse(content || '[]')
        if (Array.isArray(parsed)) {
          responses = parsed
        }
      } catch {
        // ignore
      }
    })
    fileWatchHandle = off
  }

  function openPreviewAll() {
    previewOpen = true
    previewIndex = 0
  }

  function closePreview() {
    previewOpen = false
  }

  function nextPreview() {
    if (!previewItems.length) return
    previewIndex = (previewIndex + 1) % previewItems.length
  }

  function prevPreview() {
    if (!previewItems.length) return
    previewIndex = (previewIndex - 1 + previewItems.length) % previewItems.length
  }

  async function printAll() {
    if (!responses.length) return
    const html = `
      <html>
        <head><meta charset="utf-8" /><title>${$_('Responses')}</title></head>
        <body>
          ${responses
            .map(
              (item) => `
              <section style="margin-bottom:24px;">
                <h3>${item.responderName || item.responderId || $_('Anonymous')} (${item.submittedAt || ''})</h3>
                <ul>
                  ${(item.answers || [])
                    .map(
                      (answer) =>
                        `<li><strong>${answer.label || answer.name}</strong>: ${typeof answer.value === 'object' ? JSON.stringify(answer.value) : String(answer.value ?? '')}</li>`
                    )
                    .join('')}
                </ul>
              </section>
            `
            )
            .join('')}
        </body>
      </html>
    `
    try {
      const tempDir = await window.api?.getTempDir?.()
      // The guard tests what the branch actually uses. It used to read
      // `tempDir && fs && path && ...`, and neither `fs` nor `path` is declared
      // anywhere in this component -- svelte-check reports "Cannot find name
      // 'path'" on that line. Evaluating it threw a ReferenceError, which the
      // catch below swallowed, so printing did not fall back to the browser:
      // it did nothing at all, silently. Found while converting the write on
      // the next line, which could never run.
      if (tempDir && nodeApi.fsPromises && nodeApi.path && window.api?.printFile) {
        const filePath = nodeApi.path.join(tempDir, `form-responses-${docUuid}.html`)
        await nodeApi.fsPromises.writeFile(filePath, html, 'utf-8')
        await window.api.printFile(filePath)
      } else {
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(html)
          win.document.close()
          win.focus()
          win.print()
        }
      }
    } catch (error) {
      // Logged rather than ignored. A bare `// ignore` here is what hid the
      // broken guard above for as long as it existed: the user pressed Print,
      // nothing happened, and nothing anywhere said why.
      console.error('Failed to print form responses:', error)
    }
  }

  async function startStream() {
    if (!docUuid || !isOwner) return
    streamHandle?.close?.()
    streamHandle = await startFormStream(
      { docUuid },
      (items) => {
        responses = items
      },
      (status) => {
        streamStatus = status
      }
    )
  }

  async function exportCsv() {
    if (!responses.length) return
    const csv = toCsv()
    const savePath = await window.api?.saveDialogFile?.({
      title: $_('Export responses'),
      defaultPath: `form-responses-${docUuid}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!savePath) return
    await nodeApi?.fsPromises?.writeFile?.(savePath, csv, 'utf-8')
  }

  onMount(() => {
    refresh()
    timer = setInterval(() => {
      if (autoRefresh) refresh()
    }, 15000)
  })

  onDestroy(() => {
    if (timer) clearInterval(timer)
    streamHandle?.close?.()
    fileWatchHandle?.()
  })

  $effect(() => {
    if (selectedResponder) {
      loadHistory()
    }
  })
</script>

<div class="flex flex-col h-full bg-base-200 text-base-content">
  <div class="flex items-center justify-between px-3 py-2 border-b border-base-300">
    <div class="text-[11px] font-semibold uppercase tracking-wider">{$_('Responses')}</div>
    <div class="flex items-center gap-2">
      <span class="text-[9px] opacity-60">
        {streamStatus.connected ? $_('Live') : $_('Offline')}
      </span>
      <label class="text-[9px] flex items-center gap-1 opacity-70">
        <input type="checkbox" class="checkbox checkbox-xs" bind:checked={autoRefresh} />
        {$_('Auto refresh')}
      </label>
      <button class="btn btn-xs" onclick={refresh}>{$_('Refresh')}</button>
    </div>
  </div>

  {#if !isOwner}
    <div class="p-3 text-xs text-warning">{$_('Only the owner can view responses.')}</div>
  {:else if loading}
    <div class="p-3 text-xs opacity-60">{$_('Loading responses...')}</div>
  {:else if error}
    <div class="p-3 text-xs text-error">{error}</div>
  {:else if !responses.length}
    <div class="p-3 text-xs opacity-60">{$_('No responses yet.')}</div>
  {:else}
    {#if chartExpanded}
      <div class="px-3 py-2 border-b border-base-300">
        <div class="text-[10px] font-semibold mb-2">{$_('Charts')}</div>
        <div class="grid grid-cols-1 gap-2">
          {#each Object.entries(chartData) as [label, values]}
            <div class="bg-base-100 border border-base-300 rounded p-2">
              <div class="text-[10px] font-semibold mb-1">{label}</div>
              {#each Object.entries(values).slice(0, 4) as [value, count]}
                <div class="flex items-center justify-between text-[9px]">
                  <span class="truncate max-w-[70%]">{value}</span>
                  <span>{count}</span>
                </div>
              {/each}
            </div>
          {/each}
        </div>
      </div>
    {/if}
    <div class="flex flex-1 min-h-0">
      <div class="w-2/5 border-r border-base-300 overflow-y-auto">
        {#each responses as item}
          <button
            class="w-full text-left px-3 py-2 border-b border-base-300 hover:bg-base-300/40"
            class:bg-base-300-60={selectedId === item.id}
            onclick={() => (selectedId = item.id)}
          >
            <div class="text-xs font-semibold">
              {item.responderName || item.responderId || $_('Anonymous')}
            </div>
            <div class="text-[10px] opacity-60">{item.submittedAt || ''}</div>
          </button>
        {/each}
      </div>
      <div class="flex-1 p-3 overflow-y-auto">
        {#if selected}
          <div class="text-xs font-semibold mb-2">{$_('Response Preview')}</div>
          <div class="flex flex-col gap-2">
            {#each selected.answers || [] as answer}
              <div class="p-2 bg-base-100 rounded border border-base-300">
                <div class="text-[10px] font-semibold">{answer.label || answer.name}</div>
                <div class="text-xs opacity-80">
                  {typeof answer.value === 'object'
                    ? JSON.stringify(answer.value)
                    : String(answer.value ?? '')}
                </div>
              </div>
            {/each}
          </div>
        {/if}
        {#if historyExpanded}
          <div class="text-xs font-semibold mt-4 mb-2">{$_('History')}</div>
          {#if !selectedHistory.length}
            <div class="text-[10px] opacity-60">{$_('No responses yet.')}</div>
          {:else}
            <div class="flex flex-col gap-2">
              {#each selectedHistory as history}
                <div class="p-2 bg-base-100 rounded border border-base-300">
                  <div class="text-[10px] font-semibold">{history.submittedAt || ''}</div>
                  <div class="text-[10px] opacity-70">{history.id || ''}</div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
    <div class="flex items-center justify-end gap-2 p-2 border-t border-base-300">
      <button class="btn btn-xs" onclick={openPreviewAll}>{$_('Preview all')}</button>
      <button class="btn btn-xs" onclick={printAll}>{$_('Print all')}</button>
      <button class="btn btn-xs" onclick={exportJson}>{$_('Export JSON')}</button>
      <button class="btn btn-xs" onclick={exportCsv}>{$_('Export CSV')}</button>
    </div>
  {/if}
</div>

{#if previewOpen}
  <div class="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center">
    <div
      class="bg-base-100 border border-base-300 rounded-lg w-[70vw] max-w-3xl max-h-[80vh] overflow-hidden"
    >
      <div class="flex items-center justify-between px-3 py-2 border-b border-base-300">
        <div class="text-xs font-semibold">{$_('Response Preview')}</div>
        <button class="btn btn-xs" onclick={closePreview}>×</button>
      </div>
      <div class="p-4 overflow-y-auto max-h-[60vh]">
        {#if previewItem}
          <div class="text-xs font-semibold mb-2">
            {previewItem.responderName || previewItem.responderId || $_('Anonymous')} · {previewItem.submittedAt ||
              ''}
          </div>
          <div class="flex flex-col gap-2">
            {#each previewItem.answers || [] as answer}
              <div class="p-2 bg-base-200 rounded border border-base-300">
                <div class="text-[10px] font-semibold">{answer.label || answer.name}</div>
                <div class="text-xs opacity-80">
                  {typeof answer.value === 'object'
                    ? JSON.stringify(answer.value)
                    : String(answer.value ?? '')}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="flex items-center justify-between px-4 py-2 border-t border-base-300">
        <button class="btn btn-xs" onclick={prevPreview}>{$_('Previous')}</button>
        <div class="text-[10px] opacity-60">
          {previewIndex + 1} / {previewItems.length}
        </div>
        <button class="btn btn-xs" onclick={nextPreview}>{$_('Next')}</button>
      </div>
    </div>
  </div>
{/if}
