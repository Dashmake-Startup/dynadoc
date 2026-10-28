<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { authStore, initializeAuthStore, switchWorkspace } from '../../../../../stores/auth.store'
  import DriveAccountPanel from './DriveAccountPanel.svelte'
  import type { AuthSession } from '../../../../../types/auth'

  let authState = $derived($authStore)
  const DEFAULT_ORG_KEYS = new Set(['dynadoc-org', 'default-org', 'default', 'dynadoc', 'public'])
  const isDefaultOrg = (value: string | null | undefined) => {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
    if (!normalized) return false
    return DEFAULT_ORG_KEYS.has(normalized)
  }

  let accountEntries = $derived(
    Object.entries(authState.workspaces || {}).filter(([key, session]) => {
      if (isDefaultOrg(key)) return false
      const orgLabel = session?.user?.organization || ''
      if (isDefaultOrg(orgLabel)) return false
      return true
    })
  )

  let activeAccount = $derived.by(() => {
    const candidate = authState.activeOrg || authState.user?.organization || 'personal'
    if (!isDefaultOrg(candidate)) return candidate
    const fallback = accountEntries.find(([key]) => !isDefaultOrg(key))?.[0]
    return fallback || 'personal'
  })
  let driveLabelPrefix = $derived($_('Drive'))

  type DriveSource = {
    orgKey: string
    session: AuthSession | null
    label: string
    email: string
    authenticated: boolean
  }

  const driveSources = $derived.by(() => {
    const sources: DriveSource[] = accountEntries
      .map(([orgKey, session]) => ({
        orgKey,
        session,
        label: session?.user?.organization || orgKey || $_('Personal Workspace'),
        email: session?.user?.email || session?.user?.username || '',
        authenticated: Boolean(session?.authenticated ?? true)
      }))
      .filter((source) => !isDefaultOrg(source.orgKey) && !isDefaultOrg(source.label))

    if (authState.authenticated) {
      const exists = sources.some((source) => source.orgKey === activeAccount)
      if (!exists) {
        if (!isDefaultOrg(activeAccount)) {
          sources.unshift({
            orgKey: activeAccount,
            session: {
              authenticated: authState.authenticated,
              user: authState.user
            },
            label: authState.user?.organization || activeAccount || $_('Personal Workspace'),
            email: authState.user?.email || authState.user?.username || '',
            authenticated: authState.authenticated
          })
        }
      }
    }

    return sources
  })

  async function handleActivateAccount(org: string) {
    if (!org || org === activeAccount) return
    await switchWorkspace(org)
  }

  $effect(() => {
    initializeAuthStore()
  })
</script>

<div class="h-full flex flex-col bg-base-200 font-sans select-none">
  <div class="flex items-center justify-between px-3.5 py-2.5">
    <span class="flex items-center gap-2 min-w-0">
      <i class="ph-light ph-hard-drives text-[15px] opacity-60" aria-hidden="true"></i>
      <span class="text-[10.5px] font-bold uppercase tracking-[0.1em] opacity-70 truncate">
        {$_('Cloud Drives')}
      </span>
    </span>
    <span class="text-[10.5px] font-bold opacity-70 shrink-0">{driveSources.length || 0}</span>
  </div>

  {#if !driveSources.length}
    <div class="drv-msg flex-1 flex flex-col items-center justify-center">
      <i class="ph-light ph-cloud-slash text-[24px] opacity-35" aria-hidden="true"></i>
      <p class="drv-msg__t mt-2">{$_('No drive connected')}</p>
      <p class="drv-msg__s">{$_('Sign in to connect your cloud drive.')}</p>
    </div>
  {:else}
    <!-- Le panneau est dessine pour 232 px ; integre en pleine largeur
         (section Cloud Documents de l'accueil), on borne la colonne
         plutot que d'etirer les compteurs sur 1 300 px. -->
    <div class="flex flex-col gap-2 px-2 pb-2 overflow-y-auto max-w-[460px]">
      {#each driveSources as source}
        <DriveAccountPanel
          accountOrg={source.orgKey}
          accountLabel={`${driveLabelPrefix} - ${source.label}`}
          accountEmail={source.email}
          authenticated={source.authenticated}
          isActive={source.orgKey === activeAccount}
          onActivate={handleActivateAccount}
        />
      {/each}
    </div>
  {/if}
</div>
