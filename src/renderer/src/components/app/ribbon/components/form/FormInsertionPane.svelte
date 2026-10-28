<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import {
    FormComponentFrameWorks,
    FormComponentNames,
    FormComponentPacks
  } from '../../../../../extensions/tiptap/CustomFormFieldExtension/components/fields/libs/componentRegistry'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import { authStore } from '../../../../../stores/auth.store'
  import {
    getDeviceIdSync,
    getOrCreateDeviceId,
    isIdentityOwnerOfDocument
  } from '../../../../../services/identity/identity.service'

  // --- Component Props ---
  let {
    layout = 'pane',
    allowInsert = true
  }: {
    layout: 'pane' | 'ribbon'
    allowInsert: boolean
  } = $props()

  // --- State ---
  let activeTab: 'fluent' | 'antd' | 'mui' = $state('fluent') 
  let _wysiwygEditor
  let formRequireAuth = $state(false)
  let formIsOpen = $state(true)
  let formAllowAnonymous = $state(true)
  let formOneResponse = $state(false)
  let formDeadline = $state('')
  let formMaxResponses = $state<number | ''>('')

  // --- Optimized Data Factory ---
  /* // Instead of 3 arrays, we define the base definitions and map them to packs
  const baseDefinitions = [
    { label: 'Input', icon: 'i-carbon-input-field', comp: FormComponentNames.TextField },
    { label: 'Radio Group', icon: 'i-carbon-radio-button', comp: FormComponentNames.RadioGroup },
    { label: 'Switch', icon: 'i-carbon-toggle-on', comp: FormComponentNames.Switch },
    { label: 'Date', icon: 'i-carbon-calendar', comp: FormComponentNames.DatePicker },
    { label: 'Checkbox', icon: 'i-carbon-checkbox', comp: FormComponentNames.Checkbox },
    { label: 'Button', icon: 'i-carbon-button-centred', comp: FormComponentNames.Button },
    { label: 'Select', icon: 'i-carbon-list-dropdown', comp: FormComponentNames.Select }
  ] */

  const baseDefinitions = [
    { label: 'Input', icon: 'ph-light ph-textbox', comp: FormComponentNames.TextField },
    { label: 'Radio Group', icon: 'ph-light ph-radio-button', comp: FormComponentNames.RadioGroup },
    { label: 'Switch', icon: 'ph-light ph-toggle-left', comp: FormComponentNames.Switch },
    { label: 'Date', icon: 'ph-light ph-calendar', comp: FormComponentNames.DatePicker },
    { label: 'Checkbox', icon: 'ph-light ph-check-square', comp: FormComponentNames.Checkbox },
    { label: 'Button', icon: 'ph-light ph-rectangle', comp: FormComponentNames.Button },
    { label: 'Select', icon: 'ph-light ph-caret-down', comp: FormComponentNames.Select }
  ]

  // Derived list based on active tab
  const activeComponents = $derived.by(() =>
    baseDefinitions.map((d) => ({
      label: d.label,
      icon: d.icon,
      pack: FormComponentPacks[activeTab],
      component: d.comp
    }))
  )

  let wysiwygEditorStore
  // --- Editor Logic ---
  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let _activeEditor = $derived($activeDocumentEditorStore)
  let _activeDoc = $derived(_activeEditor?.document || null)
  $effect(() => {
    const active = $activeDocumentEditorStore
    if (active) {
      wysiwygEditorStore = _$_wysiwygEditorsList.get(active.id)
      _wysiwygEditor = _$_wysiwygEditorsList.getActive()
    }
  })

  $effect(() => {
    if (_$_wysiwygEditorsList) {
      wysiwygEditorStore = _$_wysiwygEditorsList.getActive()
      const _wysiwygEditoEntry = $wysiwygEditorStore
      _wysiwygEditor = _wysiwygEditoEntry?.editor
    }
  })

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
  const ownerIds = $derived((_activeDoc?.config?.security?.owners || []).map((v) => String(v)))
  const ownerGroups = $derived(
    (_activeDoc?.config?.security?.ownerGroups || []).map((v) => String(v))
  )
  const ownerPrimary = $derived(
    _activeDoc?.info?.createdBy ? String(_activeDoc.info.createdBy) : ''
  )
  const ownerPrimaryTemp = $derived(
    _activeDoc?.info?.createdByTemp ? String(_activeDoc.info.createdByTemp) : ''
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

  console.log('Ownership Check:', {
    isAuthenticated,
    currentUserId,
    deviceId,
    ownerPrimary,
    ownerPrimaryTemp,
    ownerIds,
    ownerGroups,
    userEmails,
    userGroups,
    isOwner
  })

  $effect(() => {
    formRequireAuth = Boolean(_activeDoc?.config?.form?.requireAuth)
    formIsOpen = _activeDoc?.config?.form?.isOpen !== false
    formAllowAnonymous = _activeDoc?.config?.form?.allowAnonymous !== false
    formOneResponse = Boolean(_activeDoc?.config?.form?.oneResponsePerUser)
    formDeadline = _activeDoc?.config?.form?.deadlineAt || ''
    formMaxResponses = _activeDoc?.config?.form?.maxResponses ?? ''
  })

  function updateFormConfig(patch: {
    requireAuth?: boolean
    isOpen?: boolean
    allowAnonymous?: boolean
    oneResponsePerUser?: boolean
    deadlineAt?: string
    maxResponses?: number | null
  }) {
    if (!_activeEditor?.id) return
    _$_documentEditorsList.updateDocumentConfig(_activeEditor.id, (doc) => {
      doc.config.form = doc.config.form || {}
      if (patch.requireAuth !== undefined) doc.config.form.requireAuth = patch.requireAuth
      if (patch.isOpen !== undefined) doc.config.form.isOpen = patch.isOpen
      if (patch.allowAnonymous !== undefined) doc.config.form.allowAnonymous = patch.allowAnonymous
      if (patch.oneResponsePerUser !== undefined)
        doc.config.form.oneResponsePerUser = patch.oneResponsePerUser
      if (patch.deadlineAt !== undefined) doc.config.form.deadlineAt = patch.deadlineAt
      if (patch.maxResponses !== undefined)
        doc.config.form.maxResponses = patch.maxResponses ?? undefined
    })
  }

  // const wysiwygEditorStore =
  // $derived(
  // _activeDocumentEditor ?
  // _$_wysiwygEditorsList.getActive()
  // : null
  // _activeDocumentEditor ? _$_wysiwygEditorsList.get(_activeDocumentEditor.id) : null
  // )

  // 3. Get the actual editor instance ($ is still used to auto-subscribe to the store)
  // const _wysiwygEditor = $derived(wysiwygEditorStore ? $wysiwygEditorStore : null)

  function insertComponent(componentInfo: any) {
    if (!_wysiwygEditor || !allowInsert || !isOwner) return
    const defaultOptions = [
      { value: 'Option 1', label: 'Option 1' },
      { value: 'Option 2', label: 'Option 2' }
    ]
    _wysiwygEditor.commands.insertFormField({
      label: componentInfo.label,
      value: '',
      framework: FormComponentFrameWorks.svelte,
      pack: componentInfo.pack,
      component: componentInfo.component,
      placeholder: componentInfo.component === FormComponentNames.TextField ? 'Enter text...' : '',
      options:
        componentInfo.component === FormComponentNames.Select ||
        componentInfo.component === FormComponentNames.RadioGroup
          ? defaultOptions
          : []
    })
  }

  // --- Adobe Spectrum 2 Style Tokens ---
  const adobeColors = {
    bg: 'bg-base-200', // Main Panel
    header: 'bg-base-300/60', // Section Header
    input: 'bg-base-100', // Recessed areas
    accent: 'text-primary', // Adobe Blue
    border: 'border-base-content/10', // Deep divider
    text: 'text-base-content/80' // Muted text
  }
</script>

<div
  class="flex flex-col h-full {adobeColors.bg} {adobeColors.text} {layout === 'pane'
    ? 'w-full border-l ' + adobeColors.border
    : 'w-auto rounded-sm shadow-xl'}"
>
  {#if layout === 'pane'}
    <div
      class="flex items-center justify-between px-3 py-2 {adobeColors.header} border-b {adobeColors.border}"
    >
      <span class="text-[10px] font-bold uppercase tracking-widest text-[#e1e1e1]"
        >{$_('Form Elements')}</span
      >
      <div class="i-theme-workflow:form w-4 h-4 opacity-50"></div>
    </div>

    <div class="px-3 py-2 text-[10px] border-b {adobeColors.border} {adobeColors.header} space-y-2">
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          bind:checked={formIsOpen}
          on:change={() => updateFormConfig({ isOpen: formIsOpen })}
          disabled={!isOwner}
        />
        {$_('Form is open')}
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          bind:checked={formRequireAuth}
          on:change={() => updateFormConfig({ requireAuth: formRequireAuth })}
          disabled={!isOwner}
        />
        {$_('Require sign-in to fill this form')}
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          bind:checked={formAllowAnonymous}
          on:change={() => updateFormConfig({ allowAnonymous: formAllowAnonymous })}
          disabled={!isOwner}
        />
        {$_('Allow anonymous responses')}
      </label>
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          bind:checked={formOneResponse}
          on:change={() => updateFormConfig({ oneResponsePerUser: formOneResponse })}
          disabled={!isOwner}
        />
        {$_('Limit to one response per user')}
      </label>
      <label class="flex items-center gap-2">
        <span class="w-20">{$_('Deadline')}</span>
        <input
          type="datetime-local"
          class="input input-xs bg-base-100"
          bind:value={formDeadline}
          on:change={() => updateFormConfig({ deadlineAt: formDeadline || undefined })}
          disabled={!isOwner}
        />
      </label>
      <label class="flex items-center gap-2">
        <span class="w-20">{$_('Max responses')}</span>
        <input
          type="number"
          min="1"
          class="input input-xs bg-base-100 w-24"
          bind:value={formMaxResponses}
          on:change={() =>
            updateFormConfig({
              maxResponses: formMaxResponses === '' ? null : Number(formMaxResponses)
            })}
          disabled={!isOwner}
        />
      </label>
      {#if !isOwner}
        <div class="mt-1 text-[9px] text-[#b88d3c]">
          {$_('Sign in as the document owner to edit form settings.')}
        </div>
      {/if}
    </div>
  {/if}

  <div class="flex p-1 gap-1 {adobeColors.input} border-b {adobeColors.border}">
    {#each ['fluent', 'antd', 'mui'] as tab}
      <button
        on:click={() => (activeTab = tab)}
        class="flex-1 px-2 py-1 text-[11px] font-bold rounded-sm transition-all uppercase tracking-tighter
               {activeTab === tab
          ? 'bg-[#454545] text-base-content shadow-inner'
          : 'text-[#888] hover:text-[#bbb] hover:bg-[#333]'}"
        disabled={!isOwner || !allowInsert}
      >
        {tab}
      </button>
    {/each}
  </div>

  <div class="p-3 overflow-y-auto custom-scrollbar flex-grow">
    <div class={layout === 'pane' ? 'grid grid-cols-2 gap-2' : 'flex gap-1.5'}>
      {#each activeComponents as component}
        <button
          on:click={() => insertComponent(component)}
          class="group relative flex flex-col items-center justify-center border border-[#3e3e3e] bg-base-200
                 transition-all hover:border-primary hover:bg-[#3d3d3d] active:scale-95
                 {layout === 'pane' ? 'h-20 rounded-sm' : 'p-2 w-12 h-12 rounded-sm'}"
          disabled={!isOwner || !allowInsert}
        >
          <div
            class="absolute top-0 left-0 w-full h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left"
          ></div>

          <span
            class="{component.icon} {layout === 'pane'
              ? 'w-5 h-5 mb-2'
              : 'w-4 h-4'} text-[#959595] group-hover:text-base-content transition-colors"
          ></span>

          {#if layout === 'pane'}
            <span class="text-[10px] font-medium text-[#aaa] group-hover:text-base-content"
              >{component.label}</span
            >
          {/if}

          {#if layout === 'ribbon'}
            <div
              class="absolute -bottom-8 bg-black text-base-content text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50"
            >
              Insert {component.label}
            </div>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  {#if layout === 'pane'}
    <div class="p-2 text-[9px] text-[#666] italic border-t {adobeColors.border} bg-base-100">
      {isOwner ? $_('Add fields to build your form.') : $_('Only the owner can add form fields.')}
    </div>
  {/if}
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 2px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
</style>
