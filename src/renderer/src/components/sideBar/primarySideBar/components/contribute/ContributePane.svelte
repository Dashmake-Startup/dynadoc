<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import EditorCommonUtils from '../../../../../utils/common.utils'

  const t = get(_)

  const defaultRepoUrl = 'https://github.com/dashmake/dynadoc'
  const repoUrl = (import.meta as any)?.env?.VITE_DYNADOC_REPO_URL || defaultRepoUrl

  let copied = $state<'repo' | 'clone' | null>(null)

  function setCopied(value: 'repo' | 'clone') {
    copied = value
    setTimeout(() => (copied = null), 900)
  }

  /* async function openRepo() {
    try {
      await (window as any)?.api?.openExternal?.(repoUrl)
      return
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') window.open(repoUrl, '_blank', 'noopener')
  } */

  async function copyRepo() {
    await EditorCommonUtils.copyToClipboard(repoUrl)
    setCopied('repo')
  }

  async function copyClone() {
    const clone = `git clone ${repoUrl}`
    await EditorCommonUtils.copyToClipboard(clone)
    setCopied('clone')
  }
</script>

<div class="h-full w-full p-3">
  <div class="flex items-center justify-between mb-2">
    <div class="text-[12px] font-800 tracking-[0.12em] uppercase text-base-content/55">
      {t('Contribute')}
    </div>
    <button
      class="px-2 py-1 rd-[6px] border border-white/10 bg-base-content/5 text-[10px] font-700 text-base-content/70 hover:(bg-base-content/10 text-base-content) transition"
      type="button"
      onclick={() => EditorCommonUtils.openRepo()}
    >
      {t('Open GitHub')}
    </button>
  </div>

  <div class="rd-[12px] border border-white/10 bg-base-100/40 p-3">
    <div class="flex items-start gap-3">
      <div class="size-10 rd-[10px] bg-gradient-to-br from-slate-400/20 via-indigo-400/10 to-cyan-400/20 border border-white/10 flex items-center justify-center shrink-0">
        <i class="ph-light ph-github-logo text-[20px] text-base-content/80"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[13px] font-800 text-base-content/90">{t('Build dynadoc with us')}</div>
        <div class="text-[11px] mt-0.5 text-base-content/65 leading-snug">
          {t('dynadoc is open-source and under active development. If you hit rough edges, your issues and PRs genuinely help.')}
        </div>
      </div>
    </div>

    <div class="mt-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="text-[11px] text-base-content/65 truncate">{repoUrl}</div>
        <button
          class="px-2 py-1 rd-[6px] border border-white/10 bg-base-content/5 text-[10px] font-700 text-base-content/70 hover:(bg-base-content/10 text-base-content) transition"
          type="button"
          onclick={copyRepo}
        >
          {copied === 'repo' ? t('Copied') : t('Copy link')}
        </button>
      </div>

      <div class="flex items-center justify-between gap-2">
        <code class="text-[10px] text-base-content/70 truncate select-text">git clone {repoUrl}</code>
        <button
          class="px-2 py-1 rd-[6px] border border-white/10 bg-base-content/5 text-[10px] font-700 text-base-content/70 hover:(bg-base-content/10 text-base-content) transition"
          type="button"
          onclick={copyClone}
        >
          {copied === 'clone' ? t('Copied') : t('Copy')}
        </button>
      </div>
    </div>
  </div>

  <div class="mt-3 rd-[12px] border border-white/10 bg-base-100/30 p-3">
    <div class="text-[12px] font-800 text-base-content/85">{t('High-impact ways to help')}</div>
    <ul class="mt-2 space-y-1 text-[11px] text-base-content/65 leading-snug">
      <li class="flex items-start gap-2">
        <i class="ph-light ph-bug text-[14px] mt-[1px] text-rose-300"></i>
        <span>{t('Report bugs with steps + screenshots, especially for Web/Mobile parity.')}</span>
      </li>
      <li class="flex items-start gap-2">
        <i class="ph-light ph-magic-wand text-[14px] mt-[1px] text-cyan-300"></i>
        <span>{t('Pick a “rough edge” and polish UX: empty states, loading, error messaging, accessibility.')}</span>
      </li>
      <li class="flex items-start gap-2">
        <i class="ph-light ph-shield-check text-[14px] mt-[1px] text-emerald-300"></i>
        <span>{t('Add guardrails: safe defaults, telemetry-free diagnostics, and predictable offline behavior.')}</span>
      </li>
    </ul>
  </div>
</div>

