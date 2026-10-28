<script lang="ts">
  import { onMount } from 'svelte'
  import { _, locale as svelteLocale } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import {
    authStore,
    initializeAuthStore,
    logoutAuth,
    refreshAuthSession,
    startAuth,
    switchWorkspace,
    joinWorkspace,
    joinWorkspaceByInvite,
    createWorkspace,
    usePersonalWorkspace
  } from '../../../stores/auth.store'
  import { openTextInputModal } from '../../../stores/textInputModal.store'
  import { openAlertModal } from '../../../stores/alertModal.store'
  import { openConfirmModal } from '../../../stores/confirmModal.store'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import type { AuthIntent, AuthUser } from '../../../types/auth'
  import EditorCommonUtils from '../../../utils/common.utils'
  import { DriveActions } from '../../../utils/driveActions'
  import ContextMenu from '../contextMenu/ContextMenu.svelte'
  import { setLocale } from '../../../libs/i18n'
  import { getFlagEmoji } from '../../../extensions/tiptap/CustomTranslationExtension/utils/utils'
  import {
    _$_resolvedTheme,
    _$_themeMode,
    themeOptions,
    type ThemeMode
  } from '../../../stores/theme.store'
  import { openSettingsModal } from '../../../stores/settingsModal.store'

  let authState = $derived($authStore)
  let identityCopied = $state(false)
  let busyAction = $state('')

  onMount(() => {
    initializeAuthStore()
  })

  let user = $derived(authState.user)
  let displayName = $derived(resolveDisplayName(user))
  let identityLine = $derived(resolveIdentityLine(user))
  let securityScore = $derived(resolveSecurityScore(authState.authenticated, user))
  let securityTone = $derived(
    securityScore >= 80
      ? 'text-emerald-500 dark:text-emerald-400'
      : securityScore >= 55
        ? 'text-amber-500 dark:text-amber-400'
        : 'text-rose-500 dark:text-rose-400'
  )
  let rolesLine = $derived(formatList(user?.roles))
  let groupsLine = $derived(formatList(user?.groups))
  let sessionExpiry = $derived(formatDate(authState?.user?.lastLoginAt))
  let subscription = $derived(authState.subscription)
  let effectivePlanType = $derived(authState.effectivePlanType || authState.planType)
  let effectiveSubscription = $derived(authState.effectiveSubscription || subscription)
  let subscriptionStatus = $derived(
    subscription?.status || (authState.subscriptionActive ? t('Active') : t('Inactive'))
  )
  let subscriptionPlan = $derived(
    effectiveSubscription?.plan || effectiveSubscription?.tier || effectivePlanType || t('Standard')
  )
  let subscriptionRenews = $derived(
    formatDate(
      subscription?.currentPeriodEnd || subscription?.expiresAt || authState.offlineDeadline
    )
  )
  let renewalTimestamp = $derived(
    subscription?.currentPeriodEnd || subscription?.expiresAt || authState.offlineDeadline || ''
  )
  let renewalCountdown = $derived(getRenewalCountdown(renewalTimestamp))
  let renewalWarning = $derived(
    renewalCountdown.daysRemaining !== null && renewalCountdown.daysRemaining <= 7
  )
  let subscriptionSeats = $derived(
    subscription?.seats?.total
      ? `${subscription?.seats?.used ?? 0}/${subscription?.seats?.total}`
      : t('N/A')
  )
  let subscriptionFeatures = $derived(resolveFeatureFlags(effectiveSubscription))
  let workspaceEntries = $derived(Object.entries(authState.workspaces || {}))
  let activeWorkspace = $derived(authState.activeOrg || user?.organization || 'personal')
  const t = get(_)

  let workspaceHint = $derived(
    authState.authenticated
      ? `${t('Active')}: ${activeWorkspace}`
      : t('Sign in to manage workspaces')
  )

  function resolveDisplayName(user: AuthUser | null) {
    return user?.displayName || user?.name || user?.username || user?.email || t('Guest Workspace')
  }

  function resolveIdentityLine(user: AuthUser | null) {
    return user?.email || user?.username || user?.id || t('No account linked yet')
  }

  function resolveSecurityScore(authenticated: boolean, user: AuthUser | null) {
    if (!authenticated) return 32
    let score = 55
    if (user?.email) score += 20
    if (user?.id) score += 10
    if (user?.avatar) score += 8
    return Math.min(score, 100)
  }

  function formatList(list: string[] | undefined) {
    if (!Array.isArray(list) || !list.length) return t('N/A')
    return list.slice(0, 3).join(', ')
  }

  function formatDate(value: string | undefined) {
    if (!value) return t('N/A')
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString()
  }

  function getRenewalCountdown(value: string | undefined) {
    if (!value) return { label: t('N/A'), daysRemaining: null }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return { label: value, daysRemaining: null }
    const diffMs = date.getTime() - Date.now()
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (days < 0) return { label: t('Expired'), daysRemaining: days }
    if (days === 0) return { label: t('Renews today'), daysRemaining: 0 }
    if (days === 1) return { label: t('Renews in 1 day'), daysRemaining: 1 }
    return { label: t('Renews in {days} days', { values: { days } }), daysRemaining: days }
  }

  function resolveFeatureFlags(subscription: any) {
    const features = subscription?.features || {}
    const plan = (subscription?.plan || subscription?.tier || effectivePlanType || '').toLowerCase()
    const hasAI =
      Boolean(features?.ai || features?.assistant || features?.gen) ||
      ['pro', 'business', 'enterprise', 'corporate', 'onprem'].some((tier) => plan.includes(tier))
    const hasSecureSave =
      Boolean(features?.secureSave || features?.secureWriting || features?.sddoc) ||
      ['pro', 'business', 'enterprise', 'corporate', 'onprem', 'secure'].some((tier) =>
        plan.includes(tier)
      )
    const seatsEnabled = Boolean(subscription?.seats?.total)

    return [
      { id: 'secureSave', label: t('Secure Save'), enabled: hasSecureSave },
      { id: 'ai', label: t('AI Assist'), enabled: hasAI },
      { id: 'seats', label: t('Team Seats'), enabled: seatsEnabled }
    ]
  }

  function getInitials(label: string) {
    const parts = label.trim().split(/\s+/).filter(Boolean).slice(0, 2)
    if (!parts.length) return t('GU')
    return parts.map((part) => part[0]?.toUpperCase() || '').join('')
  }

  function resolveAccountLabel(session: AuthUser | null, orgKey: string) {
    return (
      session?.displayName ||
      session?.name ||
      session?.username ||
      session?.email ||
      orgKey ||
      t('Account')
    )
  }

  async function handleAddAccount() {
    busyAction = 'add-account'
    try {
      await startAuth('signin')
    } catch (error) {
      console.error('Add account error:', error)
    } finally {
      busyAction = ''
    }
  }

  async function handleAddWorkspaceAccount() {
    const org = await openTextInputModal({
      title: t('Add workspace account'),
      message: t('Enter the organization/workspace identifier to add.'),
      placeholder: t('acme-workspace'),
      confirmText: t('Add account')
    })
    if (!org) return
    busyAction = 'add-workspace'
    try {
      await startAuth('signin', org)
    } catch (error) {
      await openAlertModal({
        title: t('Add workspace failed'),
        message: error instanceof Error ? error.message : t('Unable to add workspace account.')
      })
    } finally {
      busyAction = ''
    }
  }

  async function handleRemoveAccount(orgKey: string) {
    if (!orgKey) return
    const ok = await openConfirmModal({
      title: t('Remove account?'),
      message: t('You can add it again later by signing in.'),
      confirmText: t('Remove'),
      destructive: true
    })
    if (!ok) return
    busyAction = 'logout'
    try {
      await logoutAuth(orgKey)
    } catch (error) {
      await openAlertModal({
        title: t('Remove account failed'),
        message: error instanceof Error ? error.message : t('Unable to remove account.')
      })
    } finally {
      busyAction = ''
    }
  }

  function onRoadmapClick(feature: string) {
    const titles: Record<string, string> = {
      'directory-sync': t('Directory Sync (SCIM)'),
      roles: t('Roles & Access Policies'),
      profile: t('Profile Center'),
      passkeys: t('Passkeys & MFA'),
      'audit-log': t('Audit Log'),
      'learn-more': t('Learn More'),
      help: t('Help & Support')
    }
    const featureTitle = titles[feature] || feature
    openAlertModal({
      title: featureTitle,
      message: t(
        '{feature} is currently on the product roadmap and will be available in an upcoming update.',
        {
          values: { feature: featureTitle }
        }
      )
    })
  }

  async function handleStart(intent: AuthIntent) {
    busyAction = intent
    try {
      await startAuth(intent)
    } catch (error) {
      console.error('Auth start error:', error)
    } finally {
      busyAction = ''
    }
  }

  async function handleJoinWorkspace() {
    const org = await openTextInputModal({
      title: t('Join Workspace'),
      message: t('Enter the organization/workspace identifier to join.'),
      placeholder: t('acme-workspace'),
      confirmText: t('Join')
    })
    if (!org) return
    busyAction = 'join'
    try {
      await joinWorkspace(org)
    } catch (error) {
      await openAlertModal({
        title: t('Join failed'),
        message: error instanceof Error ? error.message : t('Unable to join workspace.')
      })
    } finally {
      busyAction = ''
    }
  }

  async function handleJoinInvite() {
    const code = await openTextInputModal({
      title: t('Join by Invite Code'),
      message: t('Paste the invite code you received from a workspace admin.'),
      placeholder: t('Invite code'),
      confirmText: t('Join')
    })
    if (!code) return
    busyAction = 'invite'
    try {
      await joinWorkspaceByInvite(code)
    } catch (error) {
      await openAlertModal({
        title: t('Invite failed'),
        message:
          error instanceof Error ? error.message : t('Unable to join workspace with this code.')
      })
    } finally {
      busyAction = ''
    }
  }

  async function handleCreateWorkspace() {
    const org = await openTextInputModal({
      title: t('Create Workspace'),
      message: t('Provide a new organization/workspace identifier.'),
      placeholder: t('new-workspace'),
      confirmText: t('Create')
    })
    if (!org) return
    busyAction = 'create'
    try {
      await createWorkspace(org)
    } catch (error) {
      await openAlertModal({
        title: t('Create failed'),
        message: error instanceof Error ? error.message : t('Unable to create workspace.')
      })
    } finally {
      busyAction = ''
    }
  }

  async function handleSwitchWorkspace(org: string) {
    if (!org || org === activeWorkspace) return
    busyAction = 'switch'
    try {
      await switchWorkspace(org)
    } catch (error) {
      await openAlertModal({
        title: t('Switch failed'),
        message: error instanceof Error ? error.message : t('Unable to switch workspace.')
      })
    } finally {
      busyAction = ''
    }
  }

  async function handlePersonalWorkspace() {
    busyAction = 'personal'
    try {
      await usePersonalWorkspace()
    } catch (error) {
      await openAlertModal({
        title: t('Personal workspace failed'),
        message:
          error instanceof Error ? error.message : t('Unable to switch to personal workspace.')
      })
    } finally {
      busyAction = ''
    }
  }

  async function handleMigrateToWorkspace() {
    if (!authState.authenticated) return
    const activeDoc = _$_documentEditorsList.getActiveSync?.()
    const cachePath = activeDoc?.document?.cachePath
    if (!cachePath) {
      await openAlertModal({
        title: t('Migration'),
        message: t('Open a document to migrate its workspace data.')
      })
      return
    }
    if (!DriveActions.syncDoc) {
      await openAlertModal({
        title: t('Migration'),
        message: t('Workspace migration is not available in this build.')
      })
      return
    }
    busyAction = 'migrate'
    try {
      const result = await DriveActions.syncDoc({ cachePath })
      if (!result?.ok) {
        await openAlertModal({
          title: t('Migration failed'),
          message: result?.message || t('Unable to migrate document data.')
        })
        return
      }
      await openAlertModal({
        title: t('Migration completed'),
        message: t('Uploaded {uploaded} of {total} items.', {
          values: { uploaded: result?.uploadedCount || 0, total: result?.totalCount || 0 }
        })
      })
    } catch (error) {
      await openAlertModal({
        title: t('Migration error'),
        message:
          error instanceof Error
            ? error.message
            : t('An unexpected error occurred during migration.')
      })
    } finally {
      busyAction = ''
    }
  }

  async function handleRefresh() {
    busyAction = 'refresh'
    try {
      await refreshAuthSession()
    } finally {
      busyAction = ''
    }
  }

  async function handleLogout() {
    busyAction = 'logout'
    try {
      await logoutAuth()
    } finally {
      busyAction = ''
    }
  }

  async function handleOpenWorkspace() {
    busyAction = 'workspace'
    try {
      const rootPath = await DriveActions.getRoot()
      if (rootPath) {
        await EditorCommonUtils.openDriveItem({ rootPath, path: rootPath, isFolder: true })
      }
    } catch (error) {
      await openAlertModal({
        title: t('Open workspace failed'),
        message: error instanceof Error ? error.message : t('Unable to open cloud workspace.')
      })
    } finally {
      busyAction = ''
    }
  }

  async function copyIdentity() {
    const value = identityLine
    if (!value || value === t('No account linked yet')) return
    await EditorCommonUtils.copyToClipboard(value)
    identityCopied = true
    setTimeout(() => (identityCopied = false), 1100)
  }

  async function handleManageSubscription() {
    const billingApi = (window as any)?.server?.billing
    if (billingApi?.openPortal) {
      await billingApi.openPortal()
      await refreshAuthSession()
      return
    }
    if (billingApi?.openCustomerPortal) {
      await billingApi.openCustomerPortal()
      await refreshAuthSession()
      return
    }
    await openAlertModal({
      title: t('Manage Subscription'),
      message: t('Subscription management is not available in this build.')
    })
  }

  let currentLocale = $derived($svelteLocale)
  let languageOptions = $derived([
    { code: 'en', label: $_('English'), native: 'English' },
    { code: 'fr', label: $_('French'), native: 'Français' },
    { code: 'ja', label: $_('Japanese'), native: '日本語' }
  ])
  let themeMode = $derived($_$_themeMode)
  let resolvedTheme = $derived($_$_resolvedTheme)
  let themeIcon = $derived(
    themeMode === 'system'
      ? 'ph-desktop'
      : resolvedTheme === 'dark'
        ? 'ph-moon-stars'
        : 'ph-sun-dim'
  )
  let themeLabel = $derived(
    themeMode === 'system' ? $_('Auto') : resolvedTheme === 'dark' ? $_('Dark') : $_('Light')
  )

  function setThemeMode(mode: ThemeMode) {
    _$_themeMode.set(mode)
  }

  let isBusy = $derived(authState.loading || busyAction !== '')
</script>

<div class="auth-menu">
  {#if authState.authenticated}
    <header class="auth-menu-header">
      {#if user?.avatar}
        <img src={user.avatar} alt={displayName} class="auth-avatar" />
      {:else}
        <div class="auth-avatar auth-avatar-fallback">{getInitials(displayName)}</div>
      {/if}
      <div class="min-w-0 flex-1">
        <div class="auth-name">{displayName}</div>
        <div class="auth-identity-row">
          <span class="auth-identity">{identityLine}</span>
          <button
            class="auth-copy-btn"
            onclick={copyIdentity}
            title={identityCopied ? $_('Copied') : $_('Copy ID')}
            aria-label={$_('Copy ID')}
          >
            <i class={identityCopied ? 'ph-bold ph-check text-emerald-400' : 'ph-light ph-copy'}
            ></i>
          </button>
        </div>
        <div class="auth-session-badge">
          <span
            class="auth-session-dot {authState.authenticated ? 'bg-emerald-400' : 'bg-amber-400'}"
          ></span>
          <span>{authState.authenticated ? $_('Authenticated Session') : $_('Local Session')}</span>
        </div>
      </div>
      <div class="auth-security">
        <div class="flex items-center justify-end gap-1 {securityTone}">
          <i class="ph-bold ph-shield-check"></i>{securityScore}%
        </div>
        <span>{$_('Security')}</span>
      </div>
    </header>

    <section class="auth-menu-section">
      <button class="auth-menu-row" onclick={() => handleStart('signin')} disabled={isBusy}>
        <i class="ph-light ph-users-three text-indigo-400"></i>
        <span>{$_('Switch Account')}</span>
        <i class="ph-light ph-caret-right auth-menu-arrow"></i>
      </button>

      <button class="auth-menu-row" onclick={() => openSettingsModal('general')}>
        <i class="ph-light ph-user-circle text-sky-400"></i>
        <span>{$_('Account Settings')}</span>
        <i class="ph-light ph-caret-right auth-menu-arrow"></i>
      </button>

      <ContextMenu __placement="left-start" __offset={[4, 4]}>
        <button class="auth-menu-row">
          <i class="ph-light ph-identification-badge text-cyan-400"></i>
          <span>{$_('Account Details')}</span>
          <i class="ph-light ph-caret-right auth-menu-arrow"></i>
        </button>
        <svelte:fragment slot="content">
          <div class="auth-submenu auth-submenu-wide">
            <div class="auth-submenu-title">{$_('Account Details')}</div>
            <div class="auth-kv-block">
              <div class="auth-kv">
                <span>{$_('Username')}</span>
                <span>{user?.username || $_('N/A')}</span>
              </div>
              <div class="auth-kv">
                <span>{$_('Email')}</span>
                <span>{user?.email || $_('N/A')}</span>
              </div>
              <div class="auth-kv">
                <span>{$_('Organization')}</span>
                <span>{user?.organization || $_('N/A')}</span>
              </div>
              <div class="auth-kv">
                <span>{$_('Roles')}</span>
                <span>{rolesLine}</span>
              </div>
              <div class="auth-kv">
                <span>{$_('Groups')}</span>
                <span>{groupsLine}</span>
              </div>
              <div class="auth-kv">
                <span>{$_('Session Expires')}</span>
                <span>{formatDate(authState.expiresAt)}</span>
              </div>
              <div class="auth-kv">
                <span>{$_('Last Login')}</span>
                <span>{sessionExpiry}</span>
              </div>
            </div>
          </div>
        </svelte:fragment>
      </ContextMenu>

      <ContextMenu __placement="left-start" __offset={[4, 4]}>
        <button class="auth-menu-row">
          <i class="ph-light ph-crown-simple text-amber-400"></i>
          <span>{$_('Subscription')}</span>
          <span class="auth-menu-value">{subscriptionPlan}</span>
          <i class="ph-light ph-caret-right auth-menu-arrow"></i>
        </button>
        <svelte:fragment slot="content">
          <div class="auth-submenu auth-submenu-wide">
            <div class="auth-submenu-title">{$_('Subscription')}</div>
            <div class="auth-kv-block">
              <div class="auth-kv">
                <span>{$_('Plan')}</span>
                <span>{subscriptionPlan}</span>
              </div>
              <div class="auth-kv">
                <span>{$_('Status')}</span>
                <span>{subscriptionStatus}</span>
              </div>
              <div class="auth-kv">
                <span>{$_('Renews')}</span>
                <span>{subscriptionRenews}</span>
              </div>
              <div class="auth-kv">
                <span>{$_('Renewal status')}</span>
                <span class:auth-kv-warning={renewalWarning}>{renewalCountdown.label}</span>
              </div>
              <div class="auth-kv">
                <span>{$_('Seats')}</span>
                <span>{subscriptionSeats}</span>
              </div>
            </div>

            <div class="auth-submenu-subtitle">{$_('Feature Access')}</div>
            <div class="auth-feature-badges">
              {#each subscriptionFeatures as feature}
                <span class="auth-feature-badge" class:enabled={feature.enabled}>
                  {feature.label}
                </span>
              {/each}
            </div>

            <button
              class="auth-submenu-action"
              onclick={handleManageSubscription}
              disabled={!authState.authenticated || isBusy}
            >
              <i class="ph-light ph-credit-card text-cyan-400"></i>
              {$_('Manage subscription')}
            </button>
          </div>
        </svelte:fragment>
      </ContextMenu>

      <ContextMenu __placement="left-start" __offset={[4, 4]}>
        <button class="auth-menu-row">
          <i class="ph-light ph-buildings text-violet-400"></i>
          <span>{$_('Workspaces')}</span>
          <span class="auth-menu-value">{activeWorkspace}</span>
          <i class="ph-light ph-caret-right auth-menu-arrow"></i>
        </button>
        <svelte:fragment slot="content">
          <div class="auth-submenu auth-submenu-wide">
            <div class="auth-submenu-title">{$_('Workspaces')}</div>
            <div class="auth-kv">
              <span>{$_('Active account')}</span>
              <span>{workspaceHint}</span>
            </div>

            <div class="auth-quick-grid">
              <button onclick={handleAddAccount} disabled={!authState.authenticated || isBusy}>
                <i class="ph-light ph-user-plus text-cyan-400"></i>
                {$_('Add account')}
              </button>
              <button
                onclick={handleAddWorkspaceAccount}
                disabled={!authState.authenticated || isBusy}
              >
                <i class="ph-light ph-buildings text-sky-400"></i>
                {$_('Add workspace')}
              </button>
              <button onclick={handleJoinWorkspace} disabled={!authState.authenticated || isBusy}>
                <i class="ph-light ph-sign-in text-indigo-400"></i>
                {$_('Join workspace')}
              </button>
              <button onclick={handleJoinInvite} disabled={!authState.authenticated || isBusy}>
                <i class="ph-light ph-ticket text-amber-400"></i>
                {$_('Join by invite')}
              </button>
              <button onclick={handleCreateWorkspace} disabled={!authState.authenticated || isBusy}>
                <i class="ph-light ph-plus-circle text-emerald-400"></i>
                {$_('Create workspace')}
              </button>
              <button
                onclick={handlePersonalWorkspace}
                disabled={!authState.authenticated || isBusy}
              >
                <i class="ph-light ph-user-focus text-violet-400"></i>
                {$_('Personal workspace')}
              </button>
              <button
                onclick={handleMigrateToWorkspace}
                disabled={!authState.authenticated || isBusy}
              >
                <i class="ph-light ph-cloud-arrow-up text-amber-400"></i>
                {$_('Migrate data')}
              </button>
              <button onclick={handleOpenWorkspace} disabled={!authState.authenticated || isBusy}>
                <i class="ph-light ph-folders text-teal-400"></i>
                {$_('Open cloud workspace')}
              </button>
            </div>

            {#if workspaceEntries.length}
              <div class="auth-submenu-subtitle">{$_('Signed-in accounts')}</div>
              <div class="auth-workspace-list">
                {#each workspaceEntries as [orgKey, session]}
                  <div class="auth-workspace-item">
                    <button
                      class="auth-workspace-switch"
                      onclick={() => handleSwitchWorkspace(orgKey)}
                      disabled={isBusy || orgKey === activeWorkspace}
                    >
                      <i class="ph-light ph-buildings text-indigo-400"></i>
                      <span class="auth-workspace-meta">
                        <span class="auth-workspace-name">
                          {resolveAccountLabel(session?.user || null, orgKey)}
                        </span>
                        <span class="auth-workspace-org">{orgKey}</span>
                      </span>
                      <span class="auth-workspace-status">
                        {orgKey === activeWorkspace ? $_('Active') : $_('Switch')}
                      </span>
                    </button>
                    <button
                      class="auth-workspace-remove"
                      title={$_('Remove account')}
                      aria-label={$_('Remove account')}
                      onclick={() => handleRemoveAccount(orgKey)}
                      disabled={isBusy}
                    >
                      <i class="ph-light ph-x"></i>
                    </button>
                  </div>
                {/each}
              </div>
            {/if}

            <div class="auth-submenu-subtitle">{$_('Enterprise Roadmap')}</div>
            <button
              class="auth-submenu-row-roadmap"
              onclick={() => onRoadmapClick('directory-sync')}
            >
              <i class="ph-light ph-database text-indigo-300"></i>
              <span>{$_('Directory Sync (SCIM)')}</span>
              <span class="auth-badge-roadmap">{$_('Roadmap')}</span>
            </button>
            <button class="auth-submenu-row-roadmap" onclick={() => onRoadmapClick('roles')}>
              <i class="ph-light ph-shield-star text-blue-300"></i>
              <span>{$_('Roles & Access Policies')}</span>
              <span class="auth-badge-roadmap">{$_('Roadmap')}</span>
            </button>
          </div>
        </svelte:fragment>
      </ContextMenu>

      <ContextMenu __placement="left-start" __offset={[4, 4]}>
        <button class="auth-menu-row">
          <i class="ph-light ph-shield-check text-emerald-400"></i>
          <span>{$_('Identity & Security')}</span>
          <i class="ph-light ph-caret-right auth-menu-arrow"></i>
        </button>
        <svelte:fragment slot="content">
          <div class="auth-submenu">
            <div class="auth-submenu-title">{$_('Identity & Security')}</div>
            <button class="auth-submenu-row-roadmap" onclick={() => onRoadmapClick('profile')}>
              <i class="ph-light ph-id-card text-sky-400"></i>
              <span>{$_('Profile Center')}</span>
              <span class="auth-badge-roadmap">{$_('Roadmap')}</span>
            </button>
            <button class="auth-submenu-row-roadmap" onclick={() => onRoadmapClick('passkeys')}>
              <i class="ph-light ph-key text-teal-400"></i>
              <span>{$_('Passkeys & MFA')}</span>
              <span class="auth-badge-roadmap">{$_('Roadmap')}</span>
            </button>
            <button class="auth-submenu-row-roadmap" onclick={() => onRoadmapClick('audit-log')}>
              <i class="ph-light ph-clock-counter-clockwise text-blue-400"></i>
              <span>{$_('Audit Log')}</span>
              <span class="auth-badge-roadmap">{$_('Roadmap')}</span>
            </button>
          </div>
        </svelte:fragment>
      </ContextMenu>
    </section>
  {:else}
    <header class="auth-menu-header auth-menu-header-guest">
      <div class="auth-avatar auth-avatar-guest"><i class="ph-light ph-user-plus"></i></div>
      <div class="min-w-0 flex-1">
        <div class="auth-name">{$_('Welcome to Dynadoc')}</div>
        <div class="auth-identity">
          {$_('Sign in to access your documents, settings and more.')}
        </div>
      </div>
    </header>
    <div class="auth-menu-guest-action">
      <button class="auth-sign-in" onclick={() => handleStart('signin')} disabled={isBusy}>
        <i class="ph-light ph-sign-in"></i>
        {$_('Sign In / Create Account')}
      </button>
      <div class="auth-guest-secondary">
        <button onclick={() => handleStart('signup')} disabled={isBusy}>
          {$_('Create Account')}
        </button>
        <span class="auth-guest-divider">•</span>
        <button onclick={() => handleStart('register')} disabled={isBusy}>
          {$_('Register Organization')}
        </button>
      </div>
    </div>
  {/if}

  <section class="auth-menu-section auth-menu-preferences">
    <ContextMenu __placement="left-start" __offset={[4, 4]}>
      <button class="auth-menu-row">
        <i class="ph-light ph-globe-hemisphere-west text-blue-400"></i>
        <span>{$_('Language')}</span>
        <span class="auth-menu-value">
          {getFlagEmoji(currentLocale || 'en')}
          {languageOptions.find((option) => option.code === currentLocale)?.label || $_('English')}
        </span>
        <i class="ph-light ph-caret-right auth-menu-arrow"></i>
      </button>
      <svelte:fragment slot="content">
        <div class="auth-submenu">
          <div class="auth-submenu-title">{$_('Language')}</div>
          {#each languageOptions as language}
            <button
              class="auth-submenu-row"
              class:active={currentLocale === language.code}
              onclick={() => setLocale(language.code)}
            >
              <span>{getFlagEmoji(language.code)}</span>
              <span>{language.label}</span>
              <span class="auth-submenu-meta">{language.native}</span>
              {#if currentLocale === language.code}
                <i class="ph-bold ph-check text-primary"></i>
              {/if}
            </button>
          {/each}
        </div>
      </svelte:fragment>
    </ContextMenu>

    <ContextMenu __placement="left-start" __offset={[4, 4]}>
      <button class="auth-menu-row">
        <i class={`ph-light ${themeIcon} text-amber-400`}></i>
        <span>{$_('Theme')}</span>
        <span class="auth-menu-value">{themeLabel}</span>
        <i class="ph-light ph-caret-right auth-menu-arrow"></i>
      </button>
      <svelte:fragment slot="content">
        <div class="auth-submenu">
          <div class="auth-submenu-title">{$_('Appearance')}</div>
          {#each themeOptions as option}
            <button
              class="auth-submenu-row"
              class:active={themeMode === option.mode}
              onclick={() => setThemeMode(option.mode)}
            >
              <i class={`ph-light ${option.icon}`}></i>
              <span>
                {option.mode === 'system'
                  ? $_('Automatic')
                  : option.mode === 'light'
                    ? $_('Light')
                    : $_('Dark')}
              </span>
              {#if themeMode === option.mode}
                <i class="ph-bold ph-check text-primary"></i>
              {/if}
            </button>
          {/each}
        </div>
      </svelte:fragment>
    </ContextMenu>
  </section>

  {#if !authState.authenticated}
    <section class="auth-menu-benefits">
      <div>
        <i class="ph-light ph-shield-check"></i>
        <span>
          <b>{$_('Secure & Encrypted')}</b>
          {$_('Your data is always protected')}
        </span>
      </div>
      <div>
        <i class="ph-light ph-devices"></i>
        <span>
          <b>{$_('Access Anywhere')}</b>
          {$_('Work from any device, anytime')}
        </span>
      </div>
      <div>
        <i class="ph-light ph-cube"></i>
        <span>
          <b>{$_('All Features')}</b>
          {$_('Unlock all premium features')}
        </span>
      </div>
    </section>
  {/if}

  {#if authState.error}
    <div class="auth-menu-error">
      <i class="ph-light ph-warning-circle text-rose-400"></i>
      <span class="flex-1">{authState.error}</span>
    </div>
  {/if}

  <footer class="auth-menu-footer">
    {#if authState.authenticated}
      <button onclick={handleRefresh} disabled={isBusy}>
        <i class="ph-light ph-arrows-clockwise text-cyan-400"></i>
        {$_('Refresh Session')}
        <span class="auth-live-dot"></span>
        <small>{$_('Live')}</small>
      </button>
      <button class="auth-logout" onclick={handleLogout} disabled={isBusy}>
        {$_('Logout')}
        <i class="ph-light ph-sign-out"></i>
      </button>
    {:else}
      <button onclick={() => onRoadmapClick('learn-more')}>{$_('Learn more')}</button>
      <button onclick={() => onRoadmapClick('help')}>
        <i class="ph-light ph-question"></i>
        {$_('Help')}
      </button>
    {/if}
  </footer>
</div>

<style>
  .auth-menu {
    width: min(30rem, calc(100vw - 24px));
    overflow: hidden;
    border: 1px solid var(--color-base-300);
    border-radius: 0.75rem;
    background: var(--color-base-100);
    color: var(--color-base-content);
    box-shadow: 0 18px 44px color-mix(in srgb, black 23%, transparent);
  }

  .auth-menu-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-bottom: 1px solid var(--color-base-300);
  }

  .auth-menu-header-guest {
    border-bottom: 0;
  }

  .auth-avatar {
    width: 2.6rem;
    height: 2.6rem;
    flex: none;
    border-radius: 999px;
    object-fit: cover;
  }

  .auth-avatar-fallback,
  .auth-avatar-guest {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(
      135deg,
      var(--color-primary),
      color-mix(in srgb, var(--color-primary) 45%, var(--color-base-300))
    );
    color: var(--color-primary-content);
    font-size: 1rem;
    font-weight: 700;
  }

  .auth-avatar-guest {
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-base-100));
    color: var(--color-primary);
    font-size: 1.35rem;
  }
  .auth-name {
    overflow: hidden;
    font-size: 13px;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .auth-identity-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.15rem;
  }
  .auth-identity {
    overflow: hidden;
    color: color-mix(in srgb, var(--color-base-content) 62%, transparent);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .auth-copy-btn {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 0.3rem;
    color: color-mix(in srgb, var(--color-base-content) 55%, transparent);
    font-size: 11px;
    transition:
      color 140ms ease,
      background-color 140ms ease;
  }
  .auth-copy-btn:hover {
    background: var(--color-base-200);
    color: var(--color-primary);
  }
  .auth-session-badge {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.2rem;
    color: color-mix(in srgb, var(--color-base-content) 55%, transparent);
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .auth-session-dot {
    width: 0.35rem;
    height: 0.35rem;
    border-radius: 999px;
  }
  .auth-security {
    text-align: right;
    color: color-mix(in srgb, var(--color-base-content) 60%, transparent);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .auth-security > span {
    font-size: 9px;
    color: var(--color-primary);
  }

  .auth-menu-section {
    padding: 0.4rem;
    border-bottom: 1px solid var(--color-base-300);
  }
  .auth-menu-preferences {
    padding-top: 0.4rem;
    padding-bottom: 0.4rem;
  }
  .auth-menu-row {
    display: flex;
    width: 100%;
    min-height: 2.45rem;
    align-items: center;
    gap: 0.7rem;
    padding: 0.45rem 0.6rem;
    border-radius: 0.42rem;
    font-size: 12px;
    text-align: left;
    transition: background-color 140ms ease;
  }
  .auth-menu-row:hover {
    background: var(--color-base-200);
  }
  .auth-menu-row:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .auth-menu-row > i:first-child {
    width: 1.05rem;
    font-size: 16px;
  }
  .auth-menu-value {
    margin-left: auto;
    overflow: hidden;
    max-width: 9rem;
    color: color-mix(in srgb, var(--color-base-content) 58%, transparent);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .auth-menu-arrow {
    color: color-mix(in srgb, var(--color-base-content) 45%, transparent);
    font-size: 12px;
  }

  .auth-menu-guest-action {
    padding: 0 1rem 0.85rem;
  }
  .auth-sign-in {
    display: flex;
    width: 100%;
    min-height: 2.4rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border-radius: 0.4rem;
    background: var(--color-primary);
    color: var(--color-primary-content);
    font-size: 12px;
    font-weight: 700;
    transition: filter 140ms ease;
  }
  .auth-sign-in:hover {
    filter: brightness(1.06);
  }
  .auth-guest-secondary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 0.55rem;
  }
  .auth-guest-secondary button {
    color: color-mix(in srgb, var(--color-base-content) 62%, transparent);
    font-size: 11px;
    font-weight: 600;
  }
  .auth-guest-secondary button:hover {
    color: var(--color-primary);
  }
  .auth-guest-divider {
    color: color-mix(in srgb, var(--color-base-content) 30%, transparent);
    font-size: 10px;
  }

  .auth-menu-benefits {
    display: grid;
    gap: 0.65rem;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--color-base-300);
  }
  .auth-menu-benefits > div {
    display: flex;
    gap: 0.7rem;
    align-items: center;
  }
  .auth-menu-benefits > div > i {
    width: 1rem;
    color: var(--color-primary);
    font-size: 16px;
  }
  .auth-menu-benefits span {
    display: grid;
    color: color-mix(in srgb, var(--color-base-content) 62%, transparent);
    font-size: 10px;
  }
  .auth-menu-benefits b {
    color: var(--color-base-content);
    font-size: 11px;
    font-weight: 600;
  }

  .auth-menu-error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.6rem 0.7rem 0;
    padding: 0.55rem 0.7rem;
    border: 1px solid color-mix(in srgb, #e85b66 28%, transparent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, #e85b66 12%, transparent);
    color: #f3b3b8;
    font-size: 11px;
  }

  .auth-menu-footer {
    display: flex;
    min-height: 3.1rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 1rem;
  }
  .auth-menu-footer button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: color-mix(in srgb, var(--color-base-content) 75%, transparent);
    font-size: 11px;
  }
  .auth-menu-footer button:hover {
    color: var(--color-primary);
  }
  .auth-logout {
    color: #e85b66 !important;
  }
  .auth-live-dot {
    width: 0.35rem;
    height: 0.35rem;
    border-radius: 999px;
    background: #22c55e;
  }
  .auth-menu-footer small {
    color: color-mix(in srgb, var(--color-base-content) 55%, transparent);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .auth-submenu {
    min-width: 15rem;
    overflow: hidden;
    border: 1px solid var(--color-base-300);
    border-radius: 0.55rem;
    background: var(--color-base-100);
    box-shadow: 0 12px 28px color-mix(in srgb, black 20%, transparent);
  }
  .auth-submenu-wide {
    width: 19rem;
    padding: 0 0 0.5rem;
  }
  .auth-submenu-title {
    padding: 0.65rem 0.75rem 0.35rem;
    color: color-mix(in srgb, var(--color-base-content) 56%, transparent);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .auth-submenu-subtitle {
    padding: 0.7rem 0.75rem 0.3rem;
    color: color-mix(in srgb, var(--color-base-content) 50%, transparent);
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .auth-submenu-row {
    display: flex;
    width: 100%;
    min-height: 2.25rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.75rem;
    font-size: 12px;
    text-align: left;
  }
  .auth-submenu-row:hover,
  .auth-submenu-row.active {
    background: var(--color-base-200);
  }
  .auth-submenu-row > i:last-child {
    margin-left: auto;
    color: var(--color-primary);
  }
  .auth-submenu-meta {
    margin-left: auto;
    color: color-mix(in srgb, var(--color-base-content) 52%, transparent);
    font-size: 10px;
  }

  .auth-submenu-row-roadmap {
    display: flex;
    width: 100%;
    min-height: 2.25rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.75rem;
    font-size: 12px;
    text-align: left;
  }
  .auth-submenu-row-roadmap:hover {
    background: var(--color-base-200);
  }
  .auth-badge-roadmap {
    margin-left: auto;
    color: color-mix(in srgb, #f5c25a 85%, transparent);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .auth-kv-block {
    margin: 0.15rem 0.75rem 0;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--color-base-300);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--color-base-content) 4%, transparent);
  }
  .auth-kv {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.2rem 0;
    font-size: 11px;
  }
  .auth-kv > span:first-child {
    flex: none;
    color: color-mix(in srgb, var(--color-base-content) 52%, transparent);
  }
  .auth-kv > span:last-child {
    overflow: hidden;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .auth-kv-warning {
    color: #f5c25a !important;
  }

  .auth-feature-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0.4rem 0.75rem 0.15rem;
  }
  .auth-feature-badge {
    padding: 0.25rem 0.55rem;
    border: 1px solid var(--color-base-300);
    border-radius: 999px;
    color: color-mix(in srgb, var(--color-base-content) 42%, transparent);
    font-size: 10px;
    background: color-mix(in srgb, var(--color-base-content) 4%, transparent);
  }
  .auth-feature-badge.enabled {
    border-color: color-mix(in srgb, #34d399 45%, transparent);
    background: color-mix(in srgb, #34d399 12%, transparent);
    color: #6ee7b7;
  }

  .auth-submenu-action {
    display: flex;
    width: calc(100% - 1.5rem);
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    margin: 0.5rem 0.75rem 0;
    padding: 0.5rem;
    border: 1px solid var(--color-base-300);
    border-radius: 0.45rem;
    color: var(--color-base-content);
    font-size: 11.5px;
    font-weight: 600;
    transition: background-color 140ms ease;
  }
  .auth-submenu-action:hover {
    background: var(--color-base-200);
  }
  .auth-submenu-action:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .auth-quick-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    margin: 0.5rem 0.75rem 0.15rem;
  }
  .auth-quick-grid button {
    display: flex;
    min-height: 2.1rem;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--color-base-300);
    border-radius: 0.4rem;
    color: color-mix(in srgb, var(--color-base-content) 78%, transparent);
    font-size: 10.5px;
    text-align: left;
    transition: background-color 140ms ease;
  }
  .auth-quick-grid button:hover {
    background: var(--color-base-200);
  }
  .auth-quick-grid button:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
  .auth-quick-grid button > i {
    flex: none;
    font-size: 13px;
  }

  .auth-workspace-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0.2rem 0.75rem 0;
  }
  .auth-workspace-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.35rem;
  }
  .auth-workspace-switch {
    display: flex;
    min-height: 2.3rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.55rem;
    border: 1px solid var(--color-base-300);
    border-radius: 0.4rem;
    text-align: left;
    transition: background-color 140ms ease;
  }
  .auth-workspace-switch:hover {
    background: var(--color-base-200);
  }
  .auth-workspace-switch:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .auth-workspace-switch > i:first-child {
    flex: none;
    font-size: 14px;
  }
  .auth-workspace-meta {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    line-height: 1.2;
  }
  .auth-workspace-name {
    overflow: hidden;
    font-size: 11px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .auth-workspace-org {
    overflow: hidden;
    color: color-mix(in srgb, var(--color-base-content) 45%, transparent);
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .auth-workspace-status {
    flex: none;
    color: color-mix(in srgb, var(--color-base-content) 48%, transparent);
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .auth-workspace-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.3rem;
    border: 1px solid var(--color-base-300);
    border-radius: 0.4rem;
    color: color-mix(in srgb, var(--color-base-content) 55%, transparent);
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }
  .auth-workspace-remove:hover {
    background: color-mix(in srgb, #e85b66 12%, transparent);
    color: #e85b66;
  }
  .auth-workspace-remove:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  /* scrollbar behavior */
  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
