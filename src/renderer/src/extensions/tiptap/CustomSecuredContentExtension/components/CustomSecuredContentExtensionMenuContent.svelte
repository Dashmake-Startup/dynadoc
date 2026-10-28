

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { mount } from 'svelte'
  import ProtectionPane from './ProtectionPane.svelte'

  let {
    __wrapperId,
    __node,
    __editor,
    __getPos,
    __author = 'Security System',
    __text = 'This content is protected.',
    __protectionPaneHTMLContainerRoot,
    __shieldMethod = 'lock',
    __securityMethod = null,
    __policyConfigured = false,
    __onUnset
  } = $props()

  function openProtectionPane() {
    const pane = __protectionPaneHTMLContainerRoot
    if (!pane) return
    pane.innerHTML = ''
    mount(ProtectionPane, {
      target: pane,
      props: { __wrapperId, __node, __editor, __getPos }
    })
  }

  function removeProtection() {
    __onUnset?.()
  }
</script>

<div class="w-80 bg-base-300 border border-base-100 shadow-2xl rounded-sm overflow-hidden font-sans">
  <div class="px-4 py-3 bg-neutral text-neutral-content flex justify-between items-center border-b border-white/5">
    <div class="flex items-center gap-2">
      <i class="ph-light ph-shield-checkered text-[14px] text-primary"></i>
      <div class="flex flex-col">
        <span class="text-[10px] font-black uppercase tracking-widest leading-none">{$_('Protected Content')}</span>
        <span class="text-[8px] opacity-50 font-mono">{String(__shieldMethod).toUpperCase()} · {__securityMethod ? String(__securityMethod).toUpperCase() : 'UNCONFIGURED'}</span>
      </div>
    </div>
    <div class="badge badge-outline border-white/20 text-[9px] font-mono text-base-content/50">
      {__policyConfigured ? 'Ready' : 'Needs setup'}
    </div>
  </div>

  <div class="p-4 bg-base-100/40 space-y-3">
    <div class="flex flex-col gap-1">
      <span class="text-[9px] font-bold uppercase tracking-tighter opacity-40">{$_('Policy author')}</span>
      <span class="text-[12px] font-medium">{__author}</span>
    </div>

    <div class="p-3 bg-base-300 rounded-sm border border-base-100 italic">
      <p class="text-[11px] leading-relaxed text-base-content/60">"{__text}"</p>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <button
        onclick={openProtectionPane}
        class="py-2 bg-primary hover:brightness-110 text-primary-content text-[10px] font-bold rounded-sm uppercase tracking-widest transition-all"
      >
        {$_('Configure Policy')}
      </button>
      <button
        onclick={removeProtection}
        class="py-2 bg-[#4b2e2e] hover:bg-[#5f3939] text-base-content text-[10px] font-bold rounded-sm uppercase tracking-widest transition-all"
      >
        {$_('Remove')}
      </button>
    </div>
  </div>
</div>
