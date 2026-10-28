<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { authStore, finishProvisioning } from '../../../stores/auth.store'
  import Platform from '../../../libs/platform'

  const { provisioning } = $authStore
  const regions = provisioning?.regions || ['swiss', 'us-east', 'asia-pacific']
  const defaultRegion = provisioning?.default_region || regions[0]

  let selectedRegion = $state(defaultRegion)
  let loading = $state(false)
  let error = $state<string | null>(null)
  let displayName = $state($authStore.user?.displayName || $authStore.user?.name || '')
  let searchQuery = $state('')

  type RegionMeta = {
    flag: string
    label: string
    tagline: string
    badges: string[]
  }

  // NOTE: badges/taglines below are illustrative copy — verify each claim (SOC 2, HIPAA,
  // FADP, APPI, ISO 27001, etc.) against your actual audited certifications and current
  // legal counsel guidance before shipping. Asserting a compliance certification you don't
  // hold is a real liability, not just a copy choice.
  function getRegionMeta(id: string): RegionMeta {
    switch (id.toLowerCase()) {
      case 'swiss':
        return {
          flag: '🇨🇭',
          label: $_('Switzerland (Neutral Hub)'),
          tagline: $_('Swiss Federal Data Protection Act · neutral, non-aligned jurisdiction'),
          badges: [$_('FADP'), $_('GDPR-aligned'), $_('Neutral jurisdiction')]
        }
      case 'us-east':
        return {
          flag: '🇺🇸',
          label: $_('United States (East)'),
          tagline: $_('SOC 2 Type II infrastructure, HIPAA-ready'),
          badges: [$_('SOC 2'), $_('HIPAA-ready'), $_('CCPA')]
        }
      case 'asia-pacific':
      case 'ap':
        return {
          flag: '🇯🇵',
          label: $_('Asia Pacific (Tokyo)'),
          tagline: $_('APPI-compliant hosting · low latency across APAC'),
          badges: [$_('APPI'), $_('ISO 27001'), $_('Low latency APAC')]
        }
      default:
        return {
          flag: '🌐',
          label: id.toUpperCase(),
          tagline: $_('ISO 27001-certified regional infrastructure'),
          badges: [$_('ISO 27001')]
        }
    }
  }

  let filteredRegions = $derived(
    regions.filter((id) => {
      const query = searchQuery.trim().toLowerCase()
      if (!query) return true
      const meta = getRegionMeta(id)
      return meta.label.toLowerCase().includes(query) || id.toLowerCase().includes(query)
    })
  )
  let selectedMeta = $derived(getRegionMeta(selectedRegion))
  let showSearch = $derived(regions.length > 6)
  let listIsScrollable = $derived(regions.length > 4)

  async function handleConfirm() {
    loading = true
    error = null
    try {
      await finishProvisioning({
        region: selectedRegion,
        account_type: 'individual',
        display_name: displayName,
        email: $authStore.user?.email || ''
      })
    } catch (e: any) {
      error = e.message || $_('Failed to complete provisioning.')
    } finally {
      loading = false
    }
  }
</script>

<div
  class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
>
  <div
    class="bg-base-100 w-full max-w-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[92vh] flex flex-col"
  >
    <div class="p-7 pb-5 overflow-y-auto region-scroll">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-none">
          <i class="ph-light ph-globe text-primary text-2xl"></i>
        </div>
        <div class="min-w-0">
          <h2 class="text-lg font-bold tracking-tight leading-tight">
            {$_('Choose Your Data Region')}
          </h2>
          <p class="text-[11px] opacity-55">{$_('One-time setup · permanent selection')}</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-1.5 mb-4">
        <span class="trust-chip"
          ><i class="ph-fill ph-lock-key"></i>{$_('End-to-end encrypted')}</span
        >
        <span class="trust-chip"
          ><i class="ph-fill ph-eye-slash"></i>{$_('Never shared or sold')}</span
        >
        <span class="trust-chip"
          ><i class="ph-fill ph-certificate"></i>{$_('Independently audited')}</span
        >
      </div>

      <p class="text-[13px] leading-relaxed mb-5 opacity-75">
        {$_(
          'Your documents live only in the region you choose — not replicated, not moved, not shared with third parties. Pick the jurisdiction that matches your compliance needs and where your team actually works.'
        )}
      </p>

      <div class="mb-5">
        <label
          for="display-name-input"
          class="block text-[11px] font-bold uppercase tracking-wider opacity-70 mb-2"
        >
          {$_('Confirm Display Name')}
        </label>
        <input
          id="display-name-input"
          type="text"
          class="w-full px-4 py-3 bg-base-200 border border-base-300 focus:border-primary rounded-xl text-sm font-semibold focus:outline-none transition-all duration-200"
          placeholder={$_('Enter display name')}
          bind:value={displayName}
        />
      </div>

      <div class="flex items-center justify-between mb-2">
        <span class="block text-[11px] font-bold uppercase tracking-wider opacity-70">
          {$_('Data Region')}
        </span>
        {#if regions.length > 1}
          <span class="text-[10px] opacity-40">{filteredRegions.length}/{regions.length}</span>
        {/if}
      </div>

      {#if showSearch}
        <div class="relative mb-2.5">
          <i
            class="ph-light ph-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-sm"
          ></i>
          <input
            type="text"
            class="w-full pl-8 pr-3 py-2 bg-base-200 border border-base-300 focus:border-primary rounded-lg text-xs focus:outline-none transition-all duration-200"
            placeholder={$_('Search regions...')}
            bind:value={searchQuery}
          />
        </div>
      {/if}

      <div
        class="region-list space-y-2 mb-3 pr-1 -mr-1"
        class:overflow-y-auto={listIsScrollable}
        style={listIsScrollable ? 'max-height: 15.5rem;' : ''}
      >
        {#each filteredRegions as region (region)}
          {@const meta = getRegionMeta(region)}
          <button
            type="button"
            class="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
            class:border-primary={selectedRegion === region}
            class:bg-primary-5={selectedRegion === region}
            class:border-base-300={selectedRegion !== region}
            on:click={() => (selectedRegion = region)}
          >
            <span class="text-xl flex-none">{meta.flag}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="font-semibold text-[12.5px] truncate">{meta.label}</span>
                {#if region === defaultRegion}
                  <span class="suggested-tag">{$_('Suggested')}</span>
                {/if}
              </div>
              <p class="text-[10.5px] opacity-55 truncate mt-0.5">{meta.tagline}</p>
            </div>
            {#if selectedRegion === region}
              <i class="ph-fill ph-check-circle text-primary text-lg flex-none"></i>
            {:else}
              <i class="ph-light ph-circle opacity-20 text-lg flex-none"></i>
            {/if}
          </button>
        {:else}
          <p class="text-xs opacity-50 text-center py-4">{$_('No regions match your search.')}</p>
        {/each}
      </div>

      <div class="compliance-panel mb-5">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-base">{selectedMeta.flag}</span>
          <span class="text-[11.5px] font-bold">{selectedMeta.label}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          {#each selectedMeta.badges as badge}
            <span class="compliance-badge">{badge}</span>
          {/each}
        </div>
      </div>

      <div class="bg-warning/10 border border-warning/20 rounded-lg p-3.5 mb-2">
        <div class="flex gap-2.5">
          <i class="ph-bold ph-warning-circle text-warning mt-0.5 flex-none"></i>
          <p class="text-[10.5px] leading-tight text-warning-content font-medium">
            <strong>{$_('Permanent Choice:')}</strong>
            {$_(
              'Your data will be locked to this region. Changing regions later requires a manual migration process.'
            )}
          </p>
        </div>
      </div>

      {#if error}
        <div class="mt-3 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-xs">
          {error}
        </div>
      {/if}
    </div>

    <div class="p-7 pt-4 border-t border-base-300 flex-none">
      <button
        class="btn btn-primary w-full rounded-xl h-12 font-bold"
        disabled={loading || !selectedRegion}
        on:click={handleConfirm}
      >
        {#if loading}
          <span class="loading loading-spinner loading-xs mr-2"></span>
          {$_('Provisioning...')}
        {:else}
          {$_('Confirm & Enter App')}
        {/if}
      </button>
      <p class="text-center text-[10px] opacity-40 mt-2.5 flex items-center justify-center gap-1">
        <i class="ph-light ph-lock-simple"></i>
        {$_('Your data never leaves {region} once confirmed.', {
          values: { region: selectedMeta.label }
        })}
      </p>
    </div>
  </div>
</div>

<style>
  .trust-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--color-base-300, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-base-content, #fff) 5%, transparent);
    font-size: 10px;
    font-weight: 600;
    opacity: 0.85;
  }
  .trust-chip i {
    color: var(--color-primary);
    font-size: 11px;
  }

  .suggested-tag {
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .compliance-panel {
    padding: 0.75rem;
    border: 1px solid var(--color-base-300, rgba(255, 255, 255, 0.1));
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--color-base-content, #fff) 4%, transparent);
  }

  .compliance-badge {
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--color-base-300, rgba(255, 255, 255, 0.1));
    border-radius: 999px;
    background: var(--color-base-100, transparent);
    font-size: 9.5px;
    font-weight: 600;
    opacity: 0.75;
  }

  .region-scroll::-webkit-scrollbar,
  .region-list::-webkit-scrollbar {
    width: 5px;
  }
  .region-scroll::-webkit-scrollbar-thumb,
  .region-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 999px;
  }
  .region-scroll::-webkit-scrollbar-thumb:hover,
  .region-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.22);
  }
</style>
