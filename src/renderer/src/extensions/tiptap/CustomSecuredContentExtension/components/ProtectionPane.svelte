

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import DetachedPanel from '../../components/common/DetachedPanel.svelte'
  import InfoPopover from '../../../../components/common/info/InfoPopover.svelte'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import { authStore } from '../../../../stores/auth.store'
  import { get } from 'svelte/store'

  let {
    __wrapperId = '',
    __node = null,
    __editor = null,
    __getPos = null,
    __onApplied = null
  } = $props<{
    __wrapperId?: string
    __node?: any
    __editor?: any
    __getPos?: (() => number) | null
    __onApplied?: ((payload: any) => void) | null
  }>()

  type Scope = 'selection' | 'word' | 'sentence' | 'paragraph' | 'section' | 'document'
  type ShieldMethod = 'hidden' | 'lock' | 'blur'
  type AuthMethod = 'none' | 'password' | '2fa' | 'biometric'
  type DocumentTab = 'content' | 'document'
  type EphemeralMode = 'absolute' | 'afterCreated' | 'afterFirstRead' | 'afterFirstWrite'
  type DurationUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

  const SCOPES: Array<{ id: Scope; label: string; hint: string }> = [
    { id: 'selection', label: 'Selection', hint: 'Protect current selection as a single unit' },
    { id: 'word', label: 'Word', hint: 'Protect each word in selected/active paragraph' },
    { id: 'sentence', label: 'Sentence', hint: 'Protect sentence chunks in selected scope' },
    { id: 'paragraph', label: 'Paragraph', hint: 'Protect complete intersecting paragraphs' },
    { id: 'section', label: 'Section', hint: 'Protect all paragraphs between selection boundaries' },
    { id: 'document', label: 'Document', hint: 'Protect all text blocks in current document' }
  ]

  const AUTH_METHODS: Array<{ id: AuthMethod; label: string; icon: string; description: string }> = [
    { id: 'none', label: 'No Auth', icon: 'ph-shield', description: 'Visual protection only' },
    { id: 'password', label: 'Password', icon: 'ph-key', description: 'Password required to unlock' },
    { id: '2fa', label: '2-Factor', icon: 'ph-shield-check', description: 'Time-based verification' },
    { id: 'biometric', label: 'Biometric', icon: 'ph-fingerprint', description: 'Reserved for local biometric flow' }
  ]

  let selectedScope = $state<Scope>('selection')
  let protectionType = $state<ShieldMethod>('lock')
  let authMethod = $state<AuthMethod>('none')
  let secret = $state('')
  let infoMessage = $state('')
  let errorMessage = $state('')
  let activePolicies = $state<Array<{ id: string; shieldMethod: string; securityMethod: string; preview: string }>>([])
  let activeTab = $state<DocumentTab>('content')
  let contentIncludeUsers = $state('')
  let contentExcludeUsers = $state('')
  let contentIncludeGroups = $state('')
  let contentExcludeGroups = $state('')

  const activeDocStore = _$_documentEditorsList.getActive()
  let activeDoc = $derived($activeDocStore)

  let docOwnerEmail = $state('')
  let docOwnerUsers = $state('')
  let docOwnerGroups = $state('')
  let docAuthMethod = $state<AuthMethod>('none')
  let docRequire2fa = $state(false)
  let docPasswordHint = $state('')
  let docReaders = $state('')
  let docWriters = $state('')
  let docExemptUsers = $state('')

  let ephemeralEnabled = $state(false)
  let ephemeralMode = $state<EphemeralMode>('afterCreated')
  let ephemeralDeadline = $state('')
  let ephemeralDurationValue = $state(7)
  let ephemeralDurationUnit = $state<DurationUnit>('day')
  let ephemeralDeleteForOwner = $state(false)
  let ephemeralDeleteOnExpire = $state(true)
  let ephemeralExemptUsers = $state('')
  let ephemeralMaxReads = $state<number | ''>('')
  let ephemeralMaxWrites = $state<number | ''>('')

  const normalizeEmailList = (value: string) =>
    (value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

  const normalizeListValue = (value: any) => {
    if (Array.isArray(value)) return value.filter(Boolean).join(', ')
    if (typeof value === 'string') return value
    return ''
  }

  const getCurrentUserEmail = () => {
    const state = get(authStore)
    return (state?.user?.email || state?.user?.name || '').toString().trim().toLowerCase()
  }

  const syncDocumentSecurity = () => {
    const doc = activeDoc?.document
    if (!doc) return
    const security = doc.config?.security ?? {}
    docOwnerEmail = security.ownerEmail || getCurrentUserEmail()
    docOwnerUsers = (security.owners || []).join(', ')
    docOwnerGroups = (security.ownerGroups || []).join(', ')
    docAuthMethod = security.auth?.method || 'none'
    docRequire2fa = !!security.auth?.require2fa
    docPasswordHint = security.auth?.passwordHint || ''
    docReaders = (security.permissions?.readers || []).join(', ')
    docWriters = (security.permissions?.writers || []).join(', ')
    docExemptUsers = (security.exemptUsers || []).join(', ')

    const ephemeral = security.ephemeral ?? {}
    ephemeralEnabled = !!ephemeral.enabled
    const rule = (ephemeral.rules || [])[0]
    if (rule) {
      ephemeralMode = rule.mode || 'afterCreated'
      ephemeralDeleteForOwner = !!rule.deleteForOwner
      ephemeralDeleteOnExpire = rule.deleteOnExpire !== false
      ephemeralExemptUsers = (rule.exemptUsers || []).join(', ')
      ephemeralMaxReads = typeof rule.maxReads === 'number' ? rule.maxReads : ''
      ephemeralMaxWrites = typeof rule.maxWrites === 'number' ? rule.maxWrites : ''
      if (rule.deadlineAt) {
        const local = new Date(rule.deadlineAt)
        if (!Number.isNaN(local.getTime())) {
          const iso = new Date(local.getTime() - local.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
          ephemeralDeadline = iso
        }
      }
      if (rule.duration?.value) {
        ephemeralDurationValue = rule.duration.value
        ephemeralDurationUnit = rule.duration.unit || 'day'
      }
    }
  }

  const applyDocumentSecurity = () => {
    const editor = activeDoc
    if (!editor?.id) return
    _$_documentEditorsList.updateDocumentConfig(editor.id, (doc) => {
      doc.config.security = doc.config.security || {
        ownerEmail: '',
        owners: [],
        ownerGroups: [],
        exemptUsers: [],
        auth: { method: 'none', require2fa: false },
        permissions: { readers: [], writers: [] },
        ephemeral: { enabled: false, rules: [], accessLog: {}, auditLog: [] }
      }
      const security = doc.config.security
      security.ownerEmail = docOwnerEmail || getCurrentUserEmail()
      security.owners = normalizeEmailList(docOwnerUsers)
      security.ownerGroups = normalizeEmailList(docOwnerGroups)
      security.exemptUsers = normalizeEmailList(docExemptUsers)
      security.auth = {
        method: docAuthMethod,
        passwordHint: docPasswordHint,
        require2fa: docRequire2fa
      }
      security.permissions = {
        readers: normalizeEmailList(docReaders),
        writers: normalizeEmailList(docWriters)
      }
      security.ephemeral = security.ephemeral || { enabled: false, rules: [], accessLog: {}, auditLog: [] }
      security.ephemeral.enabled = ephemeralEnabled

      const rules = security.ephemeral.rules || []
      const primaryRule = rules[0] || {
        id: 'default',
        enabled: true,
        mode: ephemeralMode
      }
      primaryRule.enabled = ephemeralEnabled
      primaryRule.mode = ephemeralMode
      primaryRule.deleteForOwner = ephemeralDeleteForOwner
      primaryRule.deleteOnExpire = ephemeralDeleteOnExpire
      primaryRule.exemptUsers = normalizeEmailList(ephemeralExemptUsers)
      const parsedMaxReads = Number(ephemeralMaxReads)
      const parsedMaxWrites = Number(ephemeralMaxWrites)
      primaryRule.maxReads =
        Number.isFinite(parsedMaxReads) && parsedMaxReads > 0 ? parsedMaxReads : undefined
      primaryRule.maxWrites =
        Number.isFinite(parsedMaxWrites) && parsedMaxWrites > 0 ? parsedMaxWrites : undefined

      if (ephemeralMode === 'absolute') {
        primaryRule.deadlineAt = ephemeralDeadline
          ? new Date(ephemeralDeadline).toISOString()
          : undefined
        primaryRule.duration = undefined
        primaryRule.durationMs = undefined
      } else {
        primaryRule.deadlineAt = undefined
        primaryRule.duration = {
          value: Number(ephemeralDurationValue || 0),
          unit: ephemeralDurationUnit
        }
        primaryRule.durationMs = undefined
      }

      security.ephemeral.rules = [primaryRule, ...rules.slice(1)]
    })
    infoMessage = $_('Document protection policy updated.')
    errorMessage = ''
  }

  function getNodePos() {
    if (typeof __getPos === 'function') {
      try {
        return __getPos()
      } catch {
        return null
      }
    }
    return null
  }

  function applyPolicyToSelection() {
    if (!__editor?.commands?.applySecuredContentPolicy) {
      errorMessage = 'Editor security command is not available.'
      return
    }

    if (selectedScope === 'selection' && __editor?.state?.selection?.empty) {
      errorMessage = $_('Select text to protect.')
      return
    }

    const securityMethod = authMethod === 'none' ? null : authMethod
    const ok = __editor.commands.applySecuredContentPolicy({
      scope: selectedScope,
      shieldMethod: protectionType,
      securityMethod,
      securitySecret: secret,
      author: 'Security Policy',
      includeUsers: normalizeEmailList(contentIncludeUsers),
      excludeUsers: normalizeEmailList(contentExcludeUsers),
      includeGroups: normalizeEmailList(contentIncludeGroups),
      excludeGroups: normalizeEmailList(contentExcludeGroups)
    })

    if (!ok) {
      errorMessage = 'Unable to apply policy on the current scope.'
      return
    }

    infoMessage = `Applied ${protectionType} + ${authMethod.toUpperCase()} on ${selectedScope}.`
    errorMessage = ''
    __onApplied?.({ mode: 'selection', scope: selectedScope, shieldMethod: protectionType, authMethod })
  }

  function updateCurrentNodePolicy() {
    if (!__node || !__editor?.commands?.updateSecuredContentPolicy) {
      errorMessage = 'No secured node selected for policy update.'
      return
    }

    const pos = getNodePos()
    if (typeof pos !== 'number') {
      errorMessage = 'Unable to resolve secured node position.'
      return
    }

    const securityMethod = authMethod === 'none' ? null : authMethod
    const ok = __editor.commands.updateSecuredContentPolicy(pos, {
      shieldMethod: protectionType,
      securityMethod,
      securitySecret: secret,
      author: 'Security Policy',
      includeUsers: normalizeEmailList(contentIncludeUsers),
      excludeUsers: normalizeEmailList(contentExcludeUsers),
      includeGroups: normalizeEmailList(contentIncludeGroups),
      excludeGroups: normalizeEmailList(contentExcludeGroups)
    })

    if (!ok) {
      errorMessage = 'Failed to update current secured node policy.'
      return
    }

    infoMessage = 'Current secured node policy has been updated.'
    errorMessage = ''
    __onApplied?.({ mode: 'node', shieldMethod: protectionType, authMethod })
  }

  function removeCurrentProtection() {
    if (!__node || !__editor?.commands?.unsetSecuredContent) {
      errorMessage = 'No secured node selected.'
      return
    }

    const pos = getNodePos()
    if (typeof pos !== 'number') {
      errorMessage = 'Unable to resolve secured node position.'
      return
    }

    const sourceValue = __node?.attrs?.decryptedValue || __node?.attrs?.value || ''
    const ok = __editor.commands.unsetSecuredContent(sourceValue, pos, __wrapperId)
    if (!ok) {
      errorMessage = 'Failed to remove protection from this secured node.'
      return
    }

    infoMessage = 'Protection removed from selected secured node.'
    errorMessage = ''
    __onApplied?.({ mode: 'remove' })
  }

  function refreshActivePolicies() {
    const editor = __editor
    if (!editor?.state?.doc) {
      activePolicies = []
      return
    }

    const next: Array<{ id: string; shieldMethod: string; securityMethod: string; preview: string }> = []
    editor.state.doc.descendants((node, pos) => {
      if (node?.type?.name !== 'shield') return
      const raw = String(node?.attrs?.value || '')
      next.push({
        id: `${pos}`,
        shieldMethod: String(node?.attrs?.shieldMethod || 'lock'),
        securityMethod: String(node?.attrs?.securityMethod || 'none'),
        preview: raw.slice(0, 42)
      })
    })
    activePolicies = next
  }

  $effect(() => {
    const editor = __editor
    if (!editor) return
    const onChange = () => refreshActivePolicies()
    editor.on('transaction', onChange)
    refreshActivePolicies()
    return () => {
      editor.off('transaction', onChange)
    }
  })

  $effect(() => {
    syncDocumentSecurity()
  })

  $effect(() => {
    if (!__node) return
    contentIncludeUsers = normalizeListValue(__node?.attrs?.includeUsers)
    contentExcludeUsers = normalizeListValue(__node?.attrs?.excludeUsers)
    contentIncludeGroups = normalizeListValue(__node?.attrs?.includeGroups)
    contentExcludeGroups = normalizeListValue(__node?.attrs?.excludeGroups)
  })


  let activeProtections = $state([
    { id: 1, scope: 'Whole Document', type: 'Lock', method: '2FA', target: 'Global' },
    { id: 2, scope: 'Paragraph', type: 'Blur', method: 'Password', target: 'Section 4.2' }
  ])
</script>

<DetachedPanel title={$_('Protection Pane')}>

  <!-- <div
  class="h-full flex flex-col bg-base-200 text-[#ccc] font-sans select-none overflow-hidden border-l bg-base-400"
>
  <header
    class="flex items-center justify-between px-3 py-2 bg-base-200 border-b bg-base-400"
  >
    <div class="flex items-center gap-2">
      <i class={'ph-bold i-icon ph-shield-star text-primary text-[14px]'}></i>
      <span class="text-[10px] font-bold uppercase tracking-widest text-base-content"
        >Protection Engine</span
      >
    </div>
    <i class={'ph-bold i-icon ph-info text-[14px] opacity-40 hover:opacity-100 cursor-help'}></i>
  </header>

  <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-6">
    <section class="space-y-2">
      <label class="text-[9px] font-bold uppercase text-[#888] tracking-tighter"
        >Protection Scope</label
      >
      <div class="grid grid-cols-2 gap-1">
        {#each SCOPES as scope}
          <button
            class="px-2 py-1.5 text-[10px] rounded-sm border transition-all text-left flex items-center justify-between
            {true
              ? 'bg-primary border-transparent text-base-content'
              : 'bg-base-100 border-[#3e3e3e] hover:border-[#555]'}"
          >
            {scope}
            {#if true}<i class={'ph-bold i-icon ph-check text-[10px]'}></i>{/if}
          </button>
        {/each}
      </div>
    </section>

    <section class="space-y-2">
      <label class="text-[9px] font-bold uppercase text-[#888] tracking-tighter"
        >Visual Treatment</label
      >
      <div class="flex bg-base-100 p-0.5 rounded-sm border border-[#3e3e3e]">
        {#each ['Hidden', 'Lock', 'Blur'] as type}
          <button
            class="flex-1 py-1 text-[10px] rounded-[1px] transition-all
            {protectionType === type
              ? 'bg-base-200 text-base-content shadow-sm'
              : 'text-[#666] hover:text-[#aaa]'}"
          >
            {type}
          </button>
        {/each}
      </div>

      {#if true}
        <div class="flex items-center gap-3 px-1 py-2">
          <i class={'ph-light i-icon ph-drop text-[12px]'}></i>
          <input
            type="range"
            class="flex-grow accent-primary h-1 bg-base-100 appearance-none rounded-full"
          />
        </div>
      {/if}
    </section>

    <section class="space-y-2">
      <label class="text-[9px] font-bold uppercase text-[#888] tracking-tighter"
        >Authentication Requirement</label
      >
      <div class="space-y-1">
        {#each AUTH_METHODS as method}
          <button
            onclick={() => (authMethod = method.id)}
            class="w-full flex items-center gap-3 px-3 py-2 bg-base-100 border rounded-sm transition-all
            {authMethod === method.id
              ? 'border-primary bg-[#252a33]'
              : 'border-[#3e3e3e] hover:bg-base-100'}"
          >
            <i
              class={'ph-bold i-icon ' +
                method.icon +
                (authMethod === method.id ? ' text-primary' : '')}
            ></i>
            <span class="text-[11px] {authMethod === method.id ? 'text-base-content' : 'text-[#aaa]'}"
              >{method.label}</span
            >
          </button>
        {/each}
      </div>
    </section>

    <hr class="bg-base-400 mx-[-12px]" />

    <section class="space-y-2">
      <label class="text-[9px] font-bold uppercase text-[#888] tracking-tighter"
        >Active Protection Policies</label
      >
      <div class="space-y-1">
        {#each activeProtections as policy}
          <div class="p-2 bg-base-100 border-l-2 border-primary rounded-sm group relative">
            <div class="flex justify-between items-start">
              <span class="text-[11px] font-bold text-[#eee]">{policy.scope}: {policy.target}</span>
              <button class="opacity-0 group-hover:opacity-100 text-red-400 transition-opacity">
                <i class={'ph-bold i-icon ph-x text-[10px]'}></i>
              </button>
            </div>
            <div class="flex gap-2 mt-1 opacity-50 text-[9px] uppercase font-bold">
              <span class="flex items-center gap-1"
                ><i class={'ph-regular ph-eye-slash'}></i> {policy.type}</span
              >
              <span class="flex items-center gap-1"
                ><i class={'ph-regular ph-shield'}></i> {policy.method}</span
              >
            </div>
          </div>
        {/each}
      </div>
    </section>
  </div>

  <footer class="p-3 bg-base-200 border-t bg-base-400">
    <button
      class="w-full py-2 bg-primary hover:bg-[#1473e6] text-base-content text-[10px] font-bold rounded-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg"
    >
      <i class={'ph-bold i-icon ph-lock-key-open text-[14px]'}></i>
      Apply Protection
    </button>
  </footer>
</div> -->



  <div class="h-full flex flex-col bg-base-200 text-base-content/80 font-sans select-none overflow-hidden border-l border-base-content/10">
    <header class="flex items-center justify-between px-3 py-2 bg-base-300/60 border-b border-base-content/10">
      <div class="flex items-center gap-2">
        <i class="ph-bold i-icon ph-shield-star text-primary text-[14px]"></i>
        <span class="text-[10px] font-bold uppercase tracking-widest text-base-content/90">{$_('Protection Engine')}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-[9px] opacity-60">{$_('Enterprise Policy')}</div>
        <InfoPopover title={$_('What is document protection?')} maxWidth={420}>
          <div>
            <div class="font-700 text-base-content/85">{$_('Protection is how you control who can read or edit sensitive content.')}</div>
            <ul>
              <li>{$_('Use “Content Protection” to protect specific parts (selection, paragraph, section).')}</li>
              <li>{$_('Use “Document Security” to set global rules: owners, readers, writers, and expiry policies.')}</li>
            </ul>
            <div class="mt-2 font-700 text-base-content/85">{$_('Concrete examples')}</div>
            <ul>
              <li>{$_('HR: hide salary fields unless the viewer is in the HR group.')}</li>
              <li>{$_('Legal: lock clauses so only approved editors can modify them.')}</li>
              <li>{$_('Finance: blur account numbers during screen share, then unlock when needed.')}</li>
            </ul>
            <div class="mt-2 font-700 text-base-content/85">{$_('Tip')}</div>
            <div>
              {$_('Start with visual protection (blur/lock), then add authentication (password/2FA) for high‑risk sections.')}
            </div>
          </div>
        </InfoPopover>
      </div>
    </header>

    <div class="flex items-center gap-1 px-3 py-2 bg-base-200 border-b border-base-content/10 text-[10px] uppercase tracking-widest">
      <button
        class="px-2 py-1 rounded-sm border {activeTab === 'content'
          ? 'border-primary text-base-content bg-base-content/12'
          : 'border-transparent text-base-content/50 hover:text-base-content'}"
        onclick={() => (activeTab = 'content')}
      >
        {$_('Content Protection')}
      </button>
      <button
        class="px-2 py-1 rounded-sm border {activeTab === 'document'
          ? 'border-primary text-base-content bg-base-content/12'
          : 'border-transparent text-base-content/50 hover:text-base-content'}"
        onclick={() => (activeTab = 'document')}
      >
        {$_('Document Security')}
      </button>
    </div>

    <div class="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-5">
      {#if activeTab === 'content'}
      <section class="space-y-2">
        <label class="text-[9px] font-bold uppercase text-base-content/40 tracking-tighter">{$_('Protection Scope')}</label>
        <div class="grid grid-cols-2 gap-1">
          {#each SCOPES as scope}
            <button
              onclick={() => (selectedScope = scope.id)}
              class="px-2 py-1.5 text-[10px] rounded-sm border transition-all text-left
              {selectedScope === scope.id
                ? 'bg-primary border-transparent text-base-content'
                : 'bg-base-100 border-base-content/15 hover:border-base-content/30'}"
              title={scope.hint}
            >
              {scope.label}
            </button>
          {/each}
        </div>
      </section>

      <section class="space-y-2">
        <label class="text-[9px] font-bold uppercase text-base-content/40 tracking-tighter">{$_('Visual Treatment')}</label>
        <div class="flex bg-base-100 p-0.5 rounded-sm border border-base-content/15">
          {#each ['hidden', 'lock', 'blur'] as type}
            <button
              onclick={() => (protectionType = type as ShieldMethod)}
              class="flex-1 py-1 text-[10px] rounded-[1px] transition-all
              {protectionType === type ? 'bg-base-content/15 text-base-content shadow-sm' : 'text-base-content/35 hover:text-base-content/60'}"
            >
              {type}
            </button>
          {/each}
        </div>
      </section>

      <section class="space-y-2">
        <label class="text-[9px] font-bold uppercase text-base-content/40 tracking-tighter">{$_('Authentication Requirement')}</label>
        <div class="space-y-1">
          {#each AUTH_METHODS as method}
            <button
              onclick={() => (authMethod = method.id)}
              class="w-full flex items-center justify-between px-3 py-2 bg-base-100 border rounded-sm transition-all
              {authMethod === method.id ? 'border-primary bg-primary/10' : 'border-base-content/15 hover:bg-base-content/8'}"
            >
              <span class="flex items-center gap-2 text-[11px]">
                <i class={'ph-bold i-icon ' + method.icon + (authMethod === method.id ? ' text-primary' : '')}></i>
                {method.label}
              </span>
              <span class="text-[9px] opacity-60">{method.description}</span>
            </button>
          {/each}
        </div>

        {#if authMethod !== 'none'}
          <input
            bind:value={secret}
            class="w-full bg-base-100 border border-base-content/15 rounded-sm px-2 py-1 text-[11px] outline-none focus:border-primary"
            placeholder={authMethod === 'password' ? 'Password / key' : 'Shared secret / policy token'}
          />
        {/if}
      </section>

      <section class="space-y-2">
        <label class="text-[9px] font-bold uppercase text-base-content/40 tracking-tighter">{$_('Policy Access')}</label>
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <div class="text-[10px] text-base-content/50">{$_('Include users')}</div>
            <input
              class="w-full bg-base-100 border border-base-content/15 rounded-sm px-2 py-1 text-[11px] outline-none focus:border-primary"
              placeholder={$_('email1, email2')}
              bind:value={contentIncludeUsers}
            />
          </div>
          <div class="space-y-1">
            <div class="text-[10px] text-base-content/50">{$_('Exclude users')}</div>
            <input
              class="w-full bg-base-100 border border-base-content/15 rounded-sm px-2 py-1 text-[11px] outline-none focus:border-primary"
              placeholder={$_('email1, email2')}
              bind:value={contentExcludeUsers}
            />
          </div>
          <div class="space-y-1">
            <div class="text-[10px] text-base-content/50">{$_('Include groups')}</div>
            <input
              class="w-full bg-base-100 border border-base-content/15 rounded-sm px-2 py-1 text-[11px] outline-none focus:border-primary"
              placeholder={$_('groupA, groupB')}
              bind:value={contentIncludeGroups}
            />
          </div>
          <div class="space-y-1">
            <div class="text-[10px] text-base-content/50">{$_('Exclude groups')}</div>
            <input
              class="w-full bg-base-100 border border-base-content/15 rounded-sm px-2 py-1 text-[11px] outline-none focus:border-primary"
              placeholder={$_('groupA, groupB')}
              bind:value={contentExcludeGroups}
            />
          </div>
        </div>
        <div class="text-[9px] text-base-content/35">
          {$_('Leave empty to allow everyone. Exclusions take priority over inclusions.')}
        </div>
      </section>

      {#if errorMessage}
        <div class="text-[10px] text-red-300 bg-red-500/12 border border-red-500/30 rounded px-2 py-1">{errorMessage}</div>
      {/if}

      {#if infoMessage}
        <div class="text-[10px] text-emerald-300 bg-emerald-500/12 border border-emerald-500/30 rounded px-2 py-1">{infoMessage}</div>
      {/if}

      <section class="space-y-2">
        <label class="text-[9px] font-bold uppercase text-base-content/40 tracking-tighter">{$_('Active Protection Policies')}</label>
        {#if activePolicies.length === 0}
          <div class="text-[10px] text-base-content/45 bg-base-content/6 border border-base-content/10 rounded px-2 py-1">
            {$_('No secured segments in current document.')}
          </div>
        {:else}
          <div class="space-y-1 max-h-34 overflow-y-auto custom-scrollbar">
            {#each activePolicies as policy}
              <div class="text-[10px] bg-base-content/6 border border-base-content/10 rounded px-2 py-1 flex items-center justify-between gap-2">
                <span class="truncate">{policy.preview || '[secured]'}</span>
                <span class="opacity-70 whitespace-nowrap">{policy.shieldMethod}/{policy.securityMethod}</span>
              </div>
            {/each}
          </div>
        {/if}
      </section>
      {:else}
        <section class="space-y-2">
          <label class="text-[9px] font-bold uppercase text-base-content/40 tracking-tighter">{$_('Owner & Exemptions')}</label>
          <input
            bind:value={docOwnerEmail}
            class="w-full bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px] outline-none focus:border-primary"
            placeholder={$_('owner@email.com')}
          />
          <input
            bind:value={docOwnerUsers}
            class="w-full bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px] outline-none focus:border-primary"
            placeholder={$_('Owner users (emails or ids)')}
          />
          <input
            bind:value={docOwnerGroups}
            class="w-full bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px] outline-none focus:border-primary"
            placeholder={$_('Owner groups (comma-separated)')}
          />
          <input
            bind:value={docExemptUsers}
            class="w-full bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px] outline-none focus:border-primary"
            placeholder={$_('Exempt users (comma-separated emails)')}
          />
        </section>

        <section class="space-y-2">
          <label class="text-[9px] font-bold uppercase text-[#888] tracking-tighter">{$_('Ephemeral Documents')}</label>
          <label class="flex items-center gap-2 text-[10px]">
            <input type="checkbox" bind:checked={ephemeralEnabled} />
            {$_('Enable auto-deletion rules')}
          </label>
          <div class="grid grid-cols-2 gap-2">
            <select
              bind:value={ephemeralMode}
              class="bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px]"
            >
              <option value="absolute">{$_('Absolute deadline')}</option>
              <option value="afterCreated">{$_('After creation')}</option>
              <option value="afterFirstRead">{$_('After first read')}</option>
              <option value="afterFirstWrite">{$_('After first write')}</option>
            </select>
            {#if ephemeralMode === 'absolute'}
              <input
                type="datetime-local"
                bind:value={ephemeralDeadline}
                class="bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px]"
              />
            {:else}
              <div class="flex gap-1">
                <input
                  type="number"
                  min="1"
                  bind:value={ephemeralDurationValue}
                  class="w-16 bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px]"
                />
                <select
                  bind:value={ephemeralDurationUnit}
                  class="flex-1 bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px]"
                >
                  <option value="minute">{$_('Minutes')}</option>
                  <option value="hour">{$_('Hours')}</option>
                  <option value="day">{$_('Days')}</option>
                  <option value="week">{$_('Weeks')}</option>
                  <option value="month">{$_('Months')}</option>
                  <option value="year">{$_('Years')}</option>
                </select>
              </div>
            {/if}
          </div>
          <div class="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="1"
              bind:value={ephemeralMaxReads}
              class="bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px]"
              placeholder={$_('Max reads')}
            />
            <input
              type="number"
              min="1"
              bind:value={ephemeralMaxWrites}
              class="bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px]"
              placeholder={$_('Max writes')}
            />
          </div>
          <input
            bind:value={ephemeralExemptUsers}
            class="w-full bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px] outline-none focus:border-primary"
            placeholder={$_('Exempt users for this rule')}
          />
          <label class="flex items-center gap-2 text-[10px]">
            <input type="checkbox" bind:checked={ephemeralDeleteForOwner} />
            {$_('Delete for owner too')}
          </label>
          <label class="flex items-center gap-2 text-[10px]">
            <input type="checkbox" bind:checked={ephemeralDeleteOnExpire} />
            {$_('Delete file on expiration')}
          </label>
          <div class="text-[9px] text-[#888] bg-base-200 border border-[#2d3342] rounded px-2 py-1">
            {$_('Expired documents are deleted on open; audit metadata is kept without content.')}
          </div>
        </section>

        <section class="space-y-2">
          <label class="text-[9px] font-bold uppercase text-[#888] tracking-tighter">{$_('Access Controls')}</label>
          <div class="grid grid-cols-2 gap-2">
            <input
              bind:value={docReaders}
              class="bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px]"
              placeholder={$_('Readers (emails)')}
            />
            <input
              bind:value={docWriters}
              class="bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px]"
              placeholder={$_('Writers (emails)')}
            />
          </div>
        </section>

        <section class="space-y-2">
          <label class="text-[9px] font-bold uppercase text-[#888] tracking-tighter">{$_('Authentication')}</label>
          <select
            bind:value={docAuthMethod}
            class="w-full bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px]"
          >
            <option value="none">{$_('None')}</option>
            <option value="password">{$_('Password')}</option>
            <option value="2fa">{$_('2-Factor')}</option>
            <option value="biometric">{$_('Biometric')}</option>
          </select>
          <input
            bind:value={docPasswordHint}
            class="w-full bg-base-100 border border-[#3e3e3e] rounded-sm px-2 py-1 text-[11px]"
            placeholder={$_('Password hint / policy label')}
          />
          <label class="flex items-center gap-2 text-[10px]">
            <input type="checkbox" bind:checked={docRequire2fa} />
            {$_('Require 2FA for unlock')}
          </label>
        </section>
      {/if}
    </div>

    <footer class="p-3 bg-base-300/55 border-t border-base-content/10 space-y-2">
      {#if activeTab === 'content'}
        <button
          class="w-full py-2 bg-primary hover:bg-[#1473e6] text-base-content text-[10px] font-bold rounded-sm uppercase tracking-widest transition-all"
          onclick={applyPolicyToSelection}
        >
          {$_('Apply To Selection Scope')}
        </button>

        {#if __node}
          <button
            class="w-full py-2 bg-[#3f4a5c] hover:bg-[#4b5a70] text-base-content text-[10px] font-bold rounded-sm uppercase tracking-widest transition-all"
            onclick={updateCurrentNodePolicy}
          >
            {$_('Update Current Secured Node')}
          </button>
          <button
            class="w-full py-2 bg-[#4b2e2e] hover:bg-[#5f3939] text-base-content text-[10px] font-bold rounded-sm uppercase tracking-widest transition-all"
            onclick={removeCurrentProtection}
          >
            {$_('Remove Current Protection')}
          </button>
        {/if}
      {:else}
        <button
          class="w-full py-2 bg-primary hover:bg-[#1473e6] text-base-content text-[10px] font-bold rounded-sm uppercase tracking-widest transition-all"
          onclick={applyDocumentSecurity}
        >
          {$_('Apply Document Security')}
        </button>
      {/if}
    </footer>
  </div>
</DetachedPanel>
<style lang="postcss">
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(var(--theme-text-rgb), 0.24);
    border-radius: 2px;
  }
</style>
