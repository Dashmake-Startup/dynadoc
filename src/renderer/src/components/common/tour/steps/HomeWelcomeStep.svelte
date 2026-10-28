<script lang="ts">
  import icon from '@resources/img/icon.png'

  import { _ } from 'svelte-i18n'
</script>

<div class="flex flex-col gap-4">
  <!-- Hero Section -->
  <div class="p-4 rd-xl bg-primary/5 border border-primary/10 relative overflow-hidden">
    <div class="relative z-10">
      <div class="flex items-center gap-3 mb-2">
        <!-- <div
          class="size-8 rd-lg bg-primary text-primary-content flex items-center justify-center shadow-lg shadow-primary/20"
        > -->
        <!-- <i class="ph-fill ph-rocket-launch text-xl"></i> -->
        <img src={icon} alt="" class="w-10 h-10" />
        <!-- </div> -->
        <!-- <div class="flex items-center gap-2 mb-8">
        <img src={icon} alt="" class="w-10 h-10" />
        <span class="font-bold tracking-tight text-lg text-primary">{$_('ddoc-office')}</span> -->
        <!-- </div> -->
        <h3 class="text-lg font-900 tracking-tight text-base-content">
          {$_('Welcome to dynadoc')}
        </h3>
      </div>

      <p class="text-sm leading-relaxed text-primary max-w-md">
        {$_('Text. Spreadsheets. Slides. Design. In one document.')}
      </p>

      <p class="mt-2 text-xs leading-relaxed text-base-content/80 italic max-w-lg">
        "{$_(
          'A new productivity workspace built for structured knowledge, collaborative creation, and sovereign data ownership.'
        )}"
      </p>
    </div>

    <!-- Background "Blueprint" Decor -->
    <i class="ph ph-cpu absolute -right-4 -bottom-4 text-7xl opacity-5 rotate-12"></i>
  </div>

  <!-- Feature Logs -->
  <div class="flex gap-2">
    <div class="space-y-3">
      <div class="flex items-start gap-3 p-2 rd-lg hover:bg-base-content/5 transition-colors">
        <i class="ph-bold ph-stack text-primary mt-0.5"></i>
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wide text-base-content/90">
            {$_('Unified Creative Workspace')}
          </div>
          <div class="text-[10px] text-base-content/50">
            {$_(
              'Write documents, build spreadsheets, create presentations, design visuals, and structure data — all inside the same living file.'
            )}
          </div>
        </div>
      </div>

      <div class="flex items-start gap-3 p-2 rd-lg hover:bg-base-content/5 transition-colors">
        <i class="ph-bold ph-database text-accent mt-0.5"></i>
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wide text-base-content/90">
            {$_('Structured & Connected Data')}
          </div>
          <div class="text-[10px] text-base-content/50">
            {$_(
              'Variables, references, tables, layouts, and components stay synchronized across your entire workspace in real time.'
            )}
          </div>
        </div>
      </div>

      <div class="flex items-start gap-3 p-2 rd-lg hover:bg-base-content/5 transition-colors">
        <i class="ph-bold ph-sparkle text-warning mt-0.5"></i>
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wide text-base-content/90">
            {$_('AI Integrated Natively')}
          </div>
          <div class="text-[10px] text-base-content/50">
            {$_(
              'Automate repetitive work, generate content, analyze data, and accelerate workflows with integrated AI assistance.'
            )}
          </div>
        </div>
      </div>
    </div>
    <div class="space-y-3">
      <div class="flex items-start gap-3 p-2 rd-lg hover:bg-base-content/5 transition-colors">
        <i class="ph-bold ph-shield-checkered text-secondary mt-0.5"></i>
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wide text-base-content/90">
            {$_('Privacy & Ownership First')}
          </div>
          <div class="text-[10px] text-base-content/50">
            {$_(
              'Your files remain under your control. Dynadoc is designed around data privacy, local-first workflows, encryption, and sovereign ownership.'
            )}
          </div>
        </div>
      </div>

      <div class="flex items-start gap-3 p-2 rd-lg hover:bg-base-content/5 transition-colors">
        <i class="ph-bold ph-cloud-arrow-down text-info mt-0.5"></i>
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wide text-base-content/90">
            {$_('Sovereign Infrastructure')}
          </div>
          <div class="text-[10px] text-base-content/50">
            {$_(
              'Choose where your data is stored — cloud, private infrastructure, regional servers, or on-premise deployment.'
            )}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Dynamic Tip/Action -->
  <!-- <div
    class="mt-2 flex items-center justify-between p-2 rd-md border border-dashed border-base-content/20 bg-base-200/50"
  >
    <div class="flex items-center gap-2 text-[9px] font-mono text-base-content/40">
      <i class="ph ph-command"></i>
      <span
        >{$_('Press')} <kbd class="kbd kbd-xs">Ctrl</kbd> + <kbd class="kbd kbd-xs">K</kbd>
        {$_('to search, navigate and access commands')}</span
      >
    </div>
    <div class="badge badge-outline badge-xs opacity-50 font-mono">v1.2.4-stable</div>
  </div> -->
</div>
