<!--
 Copyright (C) 2024 Dashmake Inc.

 This file is part of DDoc Office.

 DDoc Office is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 DDoc Office is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
-->

<script lang="ts">
  import { onMount } from 'svelte'
  import { _$_activeSecondarySidebarItem, toggle } from '../../../stores/common.store'
  import { _$_ribbbonVisible } from '../../../stores/ribbon.store'
  import {
    _$_leftSidebarVisible,
    _$_primarySidebarVisible,
    _$_rightSidebarVisible,
    _$_secondarySidebarVisible,
    _$_terminalVisible
  } from '../../../stores/common.store'
  import { fluentUIcons } from '../../common/icons/Icons'
  import { meetingStore } from '../../../extensions/tiptap/CustomMeetingNoteTakingExtension/stores/meeting.store.svelte'
  import { slide } from 'svelte/transition'
  import { authStore, initializeAuthStore } from '../../../stores/auth.store'
  import { openUpgradePlanModal } from '../../../stores/upgradePlanModal.store'
  import ContextMenu from '../../common/contextMenu/ContextMenu.svelte'
  import AuthMenu from '../../common/auth/AuthMenu.svelte'
  import Platform from '../../../libs/platform'
  import { _, locale as svelteLocale } from 'svelte-i18n'
  import { setLocale } from '../../../libs/i18n'
  import { getFlagEmoji } from '../../../extensions/tiptap/CustomTranslationExtension/utils/utils'
  import {
    _$_resolvedTheme,
    _$_themeMode,
    themeOptions,
    type ThemeMode
  } from '../../../stores/theme.store'
  import EditorCommonUtils from '../../../utils/common.utils'

  /* let {
    __onAdd = null,
    __onAddFileToDocument = null
  } = $props<{
    __onAdd?: (() => void) | null
    __onAddFileToDocument?: (() => void) | null
  }>()

   */

  // --- Runes: Reactive State ---
  // Using $derived to clean up the template logic
  let ribbonActive = $derived($_$_ribbbonVisible)
  let terminalActive = $derived($_$_terminalVisible)
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  // Reusable class for layout buttons
  const btnClass =
    'relative flex items-center justify-center w-8 h-8 rd-[6px] text-base-content/70 hover:text-primary transition-all duration-200 cursor-pointer border-none bg-transparent'
  const activeBtnClass = 'text-primary bg-base-300/10'

  let authState = $derived($authStore)
  let currentLocale = $derived($svelteLocale)
  let isPremiumPlan = $derived(
    ['pro', 'corporate', 'onprem', 'business', 'enterprise'].includes(
      (authState?.effectivePlanType || authState?.planType || '').toLowerCase()
    )
  )
  let user = $derived(authState.user)

  // We use $derived because the labels need to update
  // automatically whenever the $t store changes.
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
  let translatedThemeOptions = $derived(
    themeOptions.map((option) => ({
      ...option,
      translatedLabel:
        option.mode === 'system'
          ? $_('Automatic')
          : option.mode === 'light'
            ? $_('Light')
            : $_('Dark'),
      translatedDescription:
        option.mode === 'system'
          ? $_('Follow your device appearance in real time.')
          : option.mode === 'light'
            ? $_('Bright canvas for daylight work.')
            : $_('Focused low-glare workspace.')
    }))
  )

  onMount(() => {
    initializeAuthStore()
  })

  function setThemeMode(mode: ThemeMode) {
    _$_themeMode.set(mode)
  }
</script>

<div
  class="titlebar-quick-access flex items-center justify-between shrink-0 select-none px-2 h-10 backdrop-blur-md"
>
  <div class="flex items-center gap-1">
    <button
      class="px-2 py-1 rd-[4px] border border-white/10 bg-base-content/5 text-[10px] font-700 text-base-content/70 hover:(bg-base-content/10 text-base-content) transition"
      type="button"
      onclick={() => EditorCommonUtils.openRepo()}
    >
      <i class="ph-light ph-github-logo text-[18px]"></i>
    </button>
    <!-- <button
      class="{btnClass} ribbon-toggle {ribbonActive ? activeBtnClass : ''}"
      onclick={() => toggle('ribbon')}
      title={$_('Toggle Ribbon HUD')}
    >
      <i class="ph-light {ribbonActive ? 'ph-caret-double-up' : 'ph-caret-double-down'} text-[18px]"
      ></i>
      {#if ribbonActive}
        <div
          class="absolute bottom-1 w-0.8 h-0.8 rd-full bg-base-300 shadow-[0_0_6px_#3b82f6]"
        ></div>
      {/if}
    </button> -->

    <div
      class="w-[1px] h-3.5 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-1"
    ></div>

    <div
      class="flex items-center gap-1 px-1 bg-[color-mix(in_srgb,var(--color-base-white)_2%,transparent)] rd-md border border-white/5 editor-controls"
    >
      <button
        class="{btnClass} group code-editor-toggle"
        onclick={() => toggle('documentCodeEditor')}
      >
        <span class="size-4 opacity-60 group-hover:opacity-100 transition-opacity">
          {@html fluentUIcons.fluentUIconCodeBlock}
        </span>
      </button>
      {#if isDesktopPlatform}
        <button
          class="{btnClass} group console-toggle {terminalActive ? activeBtnClass : ''}"
          onclick={() => toggle('terminal')}
        >
          <span class="size-4 opacity-60 group-hover:opacity-100 transition-opacity">
            {@html fluentUIcons.fluentUIconWindowConsole}
          </span>
        </button>
      {/if}
    </div>
  </div>

  <div class="m-x-1 flex-1 flex justify-center items-center pointer-events-none">
    {#if meetingStore.isLive}
      <div
        transition:slide={{ axis: 'y' }}
        class="pointer-events-auto flex items-center gap-2 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rd-full backdrop-blur-sm"
      >
        <div class="flex items-center gap-2 pr-2 border-r border-white/10">
          <div class="w-1.5 h-1.5 rd-full bg-emerald-500 animate-pulse"></div>
          <span class="font-mono text-[11px] font-700 text-emerald-500 min-w-[35px]">
            {meetingStore.formattedDuration()}
          </span>
        </div>

        <button
          onclick={() => ($_$_activeSecondarySidebarItem = 'meeting')}
          class="bg-transparent border-none text-emerald-500/70 hover:text-emerald-500 cursor-pointer flex p-0.5 transition-colors"
        >
          <i class="ph-light ph-projector-screen text-[16px]"></i>
        </button>

        <button
          onclick={() => meetingStore.stopMeeting()}
          class="w-6 h-6 rd-full bg-red-500 text-base-content flex items-center justify-center border-none hover:bg-red-600 hover:scale-110 transition-all cursor-pointer"
        >
          <i class="ph-bold ph-phone-disconnect text-[10px]"></i>
        </button>
      </div>
    {/if}
  </div>

  <div class="flex items-center gap-1">
    {#if !isPremiumPlan}
      <button
        class="wps-buy-now mr-1"
        onclick={() => openUpgradePlanModal({ source: 'titlebar', highlight: 'pro' })}
        title={$_('Upgrade')}
      >
        <i class="ph-bold ph-crown-simple text-[15px]"></i>
        <span class="titlebar-action-label titlebar-buy-label">{$_('Buy Now')}</span>
      </button>
      <div
        class="w-[1px] h-3.5 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-1"
      ></div>
    {/if}
    <!-- <button
      class="{btnClass} {$_$_leftSidebarVisible ? activeBtnClass : ''}"
      onclick={() => toggle('leftSidebar')}
    >
      <i class="ph-light ph-sidebar-simple text-[18px]"></i>
    </button>
    <button
      class="{btnClass} {$_$_primarySidebarVisible ? activeBtnClass : ''}"
      onclick={() => toggle('primarySidebar')}
    >
      <i class="ph-light ph-columns text-[18px]"></i>
    </button>
    <button
      class="{btnClass} scale-x--1 {$_$_secondarySidebarVisible ? activeBtnClass : ''}"
      onclick={() => toggle('secondarySidebar')}
    >
      <i class="ph-light ph-sidebar-simple text-[18px]"></i>
    </button>
    <button
      class="{btnClass} {$_$_rightSidebarVisible ? activeBtnClass : ''}"
      onclick={() => toggle('rightSidebar')}
    >
      <i class="ph-light ph-layout text-[18px]"></i>
    </button>

    <div
      class="w-[1px] h-3.5 bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-1"
    ></div> -->

    <!-- This iis the laguage switcher cchange accordingly -->
    <!-- <ContextMenu>
      <button class="{btnClass} group" title={$_('Switch language')}>
        <span class="text-[14px]">{getFlagEmoji(currentLocale || 'en')}</span>
        <i class="ph-light ph-caret-down text-[10px] opacity-60 ml-1"></i>
      </button>
      <svelte:fragment slot="content">
        <div class="quick-menu">
          <div class="quick-header">
            <span class="quick-title">{$_('Language')}</span>
            <span class="quick-sub">{$_('Current language')}</span>
          </div>
          {#each languageOptions as lang}
            <button
              class="quick-item {currentLocale === lang.code ? 'active' : ''}"
              onclick={() => setLocale(lang.code)}
            >
              <span class="quick-flag">{getFlagEmoji(lang.code)}</span>
              <span class="quick-name">{lang.label}</span>
              <span class="quick-meta">{lang.native}</span>
              {#if currentLocale === lang.code}
                <i class="ph-bold ph-check text-[12px] text-emerald-400"></i>
              {/if}
            </button>
          {/each}
        </div>
      </svelte:fragment>
    </ContextMenu>

    <ContextMenu>
      <button
        class="{btnClass} theme-switcher group gap-1 px-2 w-auto min-w-10"
        title={$_('Switch theme')}
      >
        <i class="ph-light {themeIcon} text-[16px]"></i>
        <span
          class="titlebar-action-label titlebar-theme-label text-[10px] font-700 uppercase tracking-[0.08em] opacity-55"
        >
          {themeLabel}
        </span>
      </button>
      <svelte:fragment slot="content">
        <div class="quick-menu theme-menu">
          <div class="quick-header">
            <span class="quick-title">{$_('Appearance')}</span>
            <span class="quick-sub">
              {themeMode === 'system'
                ? $_('Following system {theme}', {
                    values: { theme: resolvedTheme === 'dark' ? $_('dark') : $_('light') }
                  })
                : $_('Pinned to {theme}', {
                    values: { theme: resolvedTheme === 'dark' ? $_('dark') : $_('light') }
                  })}
            </span>
          </div>

          <div class="theme-preview-row">
            <div class="theme-preview {resolvedTheme === 'dark' ? 'active' : ''}">
              <span class="theme-preview-dot dark"></span>
              <span>{$_('Dark canvas')}</span>
            </div>
            <div class="theme-preview {resolvedTheme === 'light' ? 'active' : ''}">
              <span class="theme-preview-dot light"></span>
              <span>{$_('Light canvas')}</span>
            </div>
          </div>

          {#each translatedThemeOptions as option}
            <button
              class="quick-item theme-item {themeMode === option.mode ? 'active' : ''}"
              onclick={() => setThemeMode(option.mode)}
            >
              <span class="theme-icon-wrap">
                <i class="ph-light {option.icon} text-[15px]"></i>
              </span>
              <span class="quick-name">{option.translatedLabel}</span>
              <span class="quick-meta theme-description">{option.translatedDescription}</span>
              {#if themeMode === option.mode}
                <i class="ph-bold ph-check text-[12px] text-emerald-400"></i>
              {/if}
            </button>
          {/each}
        </div>
      </svelte:fragment>
    </ContextMenu> -->

    <ContextMenu>
      <button
        class="{btnClass} hover:text-orange-400 {authState.authenticated
          ? 'text-green-500'
          : '!w-auto px-2 gap-1.5'}"
        title={authState.authenticated ? $_('Logout') : $_('Sign in / Sign up')}
        disabled={authState.loading && !authState.initializing}
      >
        {#if user?.avatar}
          <img
            src={user.avatar}
            alt={user.name ?? 'User avatar'}
            class="h-5 w-5 rounded-full object-cover"
          />
        {:else}
          <i
            class="ph-light {authState.authenticated
              ? 'ph-user-circle-check'
              : 'ph-user-circle-gear'} text-[18px]"
          ></i>
        {/if}
        {#if !authState.authenticated}
          <span class="titlebar-action-label titlebar-signin-label text-[12px] font-500"
            >{$_('Sign In')}</span
          >
        {/if}
      </button>
      <svelte:fragment slot="content">
        <AuthMenu></AuthMenu>
      </svelte:fragment>
    </ContextMenu>
  </div>
</div>

<style>
  .titlebar-quick-access {
    width: auto;
    min-width: 0;
  }

  .wps-buy-now {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .wps-buy-now > i {
    display: none;
  }

  @media (max-width: 1220px) {
    .wps-buy-now > i {
      display: inline-block;
    }

    .titlebar-buy-label {
      display: none;
    }

    .wps-buy-now {
      width: 2rem;
      height: 2rem;
      justify-content: center;
      margin-right: 0;
      padding: 0;
    }
  }

  @media (max-width: 1080px) {
    .titlebar-theme-label,
    .titlebar-signin-label {
      display: none;
    }

    .theme-switcher {
      width: 2rem !important;
      min-width: 2rem !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
  }

  @media (max-width: 880px) {
    .titlebar-quick-access > div:first-child > .editor-controls,
    .titlebar-quick-access > div:first-child > div:not(.editor-controls) {
      display: none;
    }

    .titlebar-quick-access {
      padding-left: 0.15rem;
      padding-right: 0.15rem;
    }
  }

  @media (max-width: 780px) {
    .titlebar-quick-access > div:first-child > button {
      display: none;
    }

    .titlebar-quick-access > div:last-child > button:nth-of-type(-n + 2) {
      display: none;
    }
  }

  .quick-menu {
    @apply w-64 rounded-lg overflow-hidden font-sans;
    background: var(--theme-popover-bg);
    border: 1px solid var(--theme-border-subtle);
    box-shadow: var(--theme-popover-shadow);
    color: var(--theme-text-1);
  }

  .quick-header {
    @apply px-3 py-2 flex flex-col gap-0.5;
    border-bottom: 1px solid var(--theme-border-subtle);
    background: var(--theme-elevated-strong);
  }

  .quick-title {
    @apply text-[10px] font-black uppercase tracking-[0.2em];
    color: var(--theme-elevated-text);
    /* color: var(--theme-text-muted); */
  }

  .quick-sub {
    @apply text-[10px];
    color: color-mix(in srgb, var(--theme-text-1) 45%, transparent);
  }

  .quick-item {
    @apply w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors;
    color: color-mix(in srgb, var(--theme-text-1) 72%, transparent);
  }

  .quick-item:hover {
    background: var(--theme-elevated-strong);
  }

  .quick-item.active {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    color: var(--theme-text-1);
  }

  .quick-flag {
    @apply text-[14px] w-5 text-center;
  }

  .quick-name {
    @apply font-700;
  }

  .quick-meta {
    @apply ml-auto;
    color: var(--theme-text-muted);
  }

  .theme-menu {
    @apply w-76;
  }

  .theme-preview-row {
    @apply flex gap-2 px-3 pt-3 pb-2;
  }

  .theme-preview {
    @apply flex-1 flex items-center gap-2 px-2.5 py-2 rounded-md text-[10px] font-700 uppercase tracking-[0.08em];
    background: color-mix(in srgb, var(--theme-elevated), transparent 80%);
    /* background: var(--theme-elevated); */
    color: var(--theme-text-muted);
    border: 1px solid transparent;
  }

  .theme-preview.active {
    color: var(--theme-text-1);
    border-color: color-mix(in srgb, var(--color-primary) 38%, transparent);
  }

  .theme-preview-dot {
    @apply w-2 h-2 rounded-full;
  }

  .theme-preview-dot.dark {
    background: linear-gradient(135deg, #0f172a, #1f2937);
  }

  .theme-preview-dot.light {
    background: linear-gradient(135deg, #ffffff, #dbe4f0);
    border: 1px solid rgba(15, 23, 42, 0.15);
  }

  .theme-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    column-gap: 10px;
  }

  .theme-icon-wrap {
    @apply w-7 h-7 rounded-md flex items-center justify-center;
    /* background: var(--theme-elevated); */
    /* background: color-mix(in srgb, var(--theme-elevated), transparent 80%); */
    color: var(--color-primary);
  }

  .theme-description {
    @apply text-right max-w-[120px];
  }
</style>
