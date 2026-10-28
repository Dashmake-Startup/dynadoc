<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { authStore, migrateWorkspaceRegion } from '../../../stores/auth.store'

  const { provisioning } = $authStore
  const regions = provisioning?.regions || ['swiss', 'us-east', 'asia-pacific']
  const currentRegion = provisioning?.region || 'swiss'

  let selectedRegion = $state(currentRegion)
  let loading = $state(false)
  let error = $state<string | null>(null)
  let success = $state(false)

  async function handleMigrate() {
    if (selectedRegion === currentRegion) return
    if (!confirm($_('Are you sure you want to migrate your data to another region? This process can take several minutes.'))) return

    loading = true
    error = null
    success = false
    try {
      await migrateWorkspaceRegion(selectedRegion)
      success = true
    } catch (e: any) {
      error = e.message || $_('Failed to initiate migration.')
    } finally {
      loading = false
    }
  }

  function getRegionLabel(id: string) {
    switch (id.toLowerCase()) {
      case 'swiss': return $_('Switzerland (Neutral Hub)')
      case 'us-east': return $_('United States (East)')
      case 'asia-pacific': return $_('Asia Pacific (Tokyo)')
      default: return id.toUpperCase()
    }
  }
</script>

<div class="space-y-8">
  <section>
    <h4 class="text-sm font-bold mb-4 uppercase tracking-wider opacity-50">{$_('Data Sovereignty & Locality')}</h4>
    <div class="bg-base-200/50 rounded-2xl p-6 border border-white/5">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <i class="ph-light ph-shield-check text-primary text-2xl"></i>
        </div>
        <div>
          <h5 class="font-bold">{$_('Current Data Region')}</h5>
          <p class="text-sm opacity-60 mt-1">
            {$_('Your workspace data is currently stored and processed in:')}
            <span class="text-primary font-semibold ml-1">{getRegionLabel(currentRegion)}</span>
          </p>
        </div>
      </div>
    </div>
  </section>

  <section>
    <h4 class="text-sm font-bold mb-4 uppercase tracking-wider opacity-50">{$_('Initiate Migration')}</h4>
    <p class="text-sm opacity-70 mb-6 leading-relaxed">
      {$_('If you need to move your data to a different sovereign region for compliance or performance reasons, select a new destination below.')}
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
      {#each regions as region}
        <button
          class="flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left"
          class:border-primary={selectedRegion === region}
          class:bg-primary/5={selectedRegion === region}
          class:border-base-300={selectedRegion !== region}
          class:opacity-50={currentRegion === region}
          disabled={currentRegion === region || loading}
          on:click={() => (selectedRegion = region)}
        >
          <span class="font-semibold text-sm">{getRegionLabel(region)}</span>
          {#if selectedRegion === region}
            <i class="ph-fill ph-check-circle text-primary text-xl"></i>
          {:else if currentRegion === region}
            <span class="text-[10px] uppercase font-bold opacity-40">{$_('Current')}</span>
          {/if}
        </button>
      {/each}
    </div>

    {#if selectedRegion !== currentRegion}
      <div class="bg-warning/10 border border-warning/20 rounded-xl p-5 mb-8">
        <div class="flex gap-4">
          <i class="ph-bold ph-warning-circle text-warning text-xl mt-1"></i>
          <div class="space-y-2">
            <h6 class="font-bold text-sm text-warning-content">{$_('Migration Warning')}</h6>
            <p class="text-xs leading-relaxed text-warning-content/80">
              {$_('Starting a migration will temporarily lock your workspace for a few minutes while we transfer your encrypted snapshots and files. You will be automatically redirected once the swap is complete.')}
            </p>
          </div>
        </div>
      </div>
    {/if}

    {#if error}
      <div class="p-4 bg-error/10 border border-error/20 rounded-xl text-error text-sm mb-6">
        {error}
      </div>
    {/if}

    {#if success}
      <div class="p-4 bg-success/10 border border-success/20 rounded-xl text-success text-sm mb-6 flex items-center gap-3">
        <i class="ph-bold ph-check-circle"></i>
        {$_('Migration initiated successfully! Please wait while we process your request.')}
      </div>
    {/if}

    <button
      class="btn btn-primary h-12 rounded-xl px-8 font-bold"
      disabled={loading || selectedRegion === currentRegion || success}
      on:click={handleMigrate}
    >
      {#if loading}
        <span class="loading loading-spinner loading-xs mr-2"></span>
        {$_('Migrating...')}
      {:else}
        {$_('Start Migration')}
      {/if}
    </button>
  </section>
</div>
