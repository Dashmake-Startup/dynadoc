<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { DocumentContentType } from '../../../models/Document'
  import EditorCommonUtils from '../../../utils/common.utils'
  import EditorHelpers from '../../../utils/EditorHelpers'
  import AnimatedContent from './components/AnimatedContent.svelte'
  import GenerativeCreationBar from './components/GenerativeCreationBar.svelte'

  // --- Props & State (Svelte 5) ---
  let searchQuery = $state('')
  let selectedCategory = $state('All')

  // const creationType = "text" |"design"|"slide"|"sheet"
  // type DocumentContentType = 'text' | 'design' | 'slide' | 'sheet'

  interface CreationType {
    id: DocumentContentType
    labelKey: string
    subKey: string
    icon: string
    color: string
  }
  const creationTypes: CreationType[] = [
    {
      id: 'text',
      labelKey: 'Document',
      subKey: 'Standard Text',
      icon: 'ph-article',
      color: 'text-blue-400'
    },
    {
      id: 'design',
      labelKey: 'Design',
      subKey: 'Layers & Vector',
      icon: 'ph-paint-brush-broad',
      color: 'text-purple-400'
    },
    {
      id: 'slide',
      labelKey: 'Presentation',
      subKey: 'Animated Slides',
      icon: 'ph-presentation-chart',
      color: 'text-orange-400'
    },
    {
      id: 'sheet',
      labelKey: 'Worksheet',
      subKey: 'Data & Formulas',
      icon: 'ph-table',
      color: 'text-green-400'
    },
    {
      id: 'form',
      labelKey: 'Form',
      subKey: 'Quiz & Surveys',
      icon: 'ph-textbox',
      color: 'text-red-400'
    },
    {
      id: 'meeting',
      labelKey: 'Meeting',
      subKey: 'Online Meetings',
      icon: 'ph-video-conference',
      color: 'text-yellow-400'
    }
  ]

  const templates = $state([
    {
      id: 1,
      titleKey: 'Annual Business Report',
      typeLabelKey: 'Document',
      img: 'https://placehold.co/200x260/2b2b2b/ccc?text=Report'
    },
    {
      id: 2,
      titleKey: 'Social Media Kit',
      typeLabelKey: 'Design',
      img: 'https://placehold.co/200x260/2b2b2b/ccc?text=Design'
    },
    {
      id: 3,
      titleKey: 'Product Pitch Deck',
      typeLabelKey: 'Presentation',
      img: 'https://placehold.co/200x260/2b2b2b/ccc?text=Deck'
    },
    {
      id: 4,
      titleKey: 'Financial Forecast',
      typeLabelKey: 'Worksheet',
      img: 'https://placehold.co/200x260/2b2b2b/ccc?text=Sheet'
    }
  ])

  let filteredTemplates = $derived(
    templates.filter((t) => t.titleKey.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  async function handleOnClick(type: DocumentContentType) {
    await EditorCommonUtils.addNewDocumentEditor(
      null,
      null,
      () => {
        // _canRenderComponents = true
      },
      type
      // null,
      // '',
      // associatedMeetingLinks
    )
  }
</script>

<!-- <div
  class="h-full w-full bg-base-100 text-base-content flex flex-col font-sans select-none overflow-hidden"
> -->
<div
  class="flex flex-col lg:flex-row bg-base-100 text-base-content font-sans selection:bg-primary/20 transition-colors duration-200"
>
  <header class="pt-4 pl-4 pb-4 pr-8 lg:pt-8 max-w-6xl mx-auto w-full flex-1">
    <div class="flex flex-col gap-6">
      <div class="space-y-1">
        <!-- <i class="ph-bold i-icon ph-sparkle animate-pulse33"></i> -->

        <!-- <h1 class="text-3xl font-bold tracking-tight text-base-content">Start writing something dynamically Amazing</h1> -->
        <AnimatedContent />
        <p class="text-base-content opacity-50 text-sm">
          {$_('Select a canvas, generate a document or search for a professional template.')}
        </p>
      </div>

      <!-- <div class="relative group">
        <div class="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <i class={'ph-bold i-icon ph-sparkle text-primary text-[18px]'}></i>
        </div>
        <input
          type="text"
          placeholder="Describe what you want to create (e.g. 'A 3-page flyer for a bake sale')"
          class="w-full bg-base-200 border-2 border-transparent focus:border-primary rounded-xl py-4 pl-12 pr-4 outline-none text-lg transition-all shadow-inner placeholder:opacity-30"
        />
        <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <kbd class="kbd kbd-sm bg-base-300">Enter</kbd>
        </div>
      </div> -->

      <GenerativeCreationBar />
    </div>
  </header>
  <section class="pt-4 pl-4 pb-4 pr-8 lg:pt-8 flex-1">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
        {$_('Blank Engine Presets')}
      </h2>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-2 gap-4">
      {#each creationTypes as type}
        <button
          class="cursor-pointer flex flex-col items-center justify-center gap-4 p-8 bg-base-200 hover:bg-base-300 border border-base-300 rounded-2xl transition-all group hover:-translate-y-1 active:scale-95 shadow-sm"
          onclick={() => {
            handleOnClick(type.id)
          }}
        >
          <div
            class="w-16 h-16 rounded-2xl bg-base-100 flex items-center justify-center shadow-lg group-hover:shadow-primary/20 transition-all"
          >
            <i class={'ph-light text-[xxx-large] ' + type.icon + '  ' + type.color}></i>
          </div>
          <div class="text-center">
            <div class="font-bold text-base">{$_(type.labelKey)}</div>
            <div class="text-[10px] opacity-40 uppercase tracking-wider">{$_(type.subKey)}</div>
          </div>
        </button>
      {/each}
    </div>
  </section>
</div>
<div>
  <main
    class="flex-grow overflow-y-auto custom-scrollbar p-8 pt-4 max-w-6xl mx-auto w-full space-y-12"
  >
    <section class="space-y-6">
      <div class="flex items-center justify-between border-b border-base-300 pb-4">
        <div class="flex gap-6">
          {#each ['All', 'Marketing', 'Education', 'Business', 'Personal'] as cat}
            <button
              onclick={() => (selectedCategory = cat)}
              class="text-sm font-bold transition-all relative
              {selectedCategory === cat
                ? 'text-primary'
                : 'text-base-content opacity-40 hover:opacity-100'}"
            >
              {$_(cat)}
              {#if selectedCategory === cat}
                <div class="absolute -bottom-[17px] left-0 w-full h-0.5 bg-primary"></div>
              {/if}
            </button>
          {/each}
        </div>

        <div class="flex items-center gap-2 text-sm opacity-60 hover:opacity-100 cursor-pointer">
          <span>{$_('Browse all templates')}</span>
          <i class={'ph-bold i-icon ph-arrow-right'}></i>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {#each filteredTemplates as temp}
          <div class="group cursor-pointer">
            <div
              class="aspect-[3/4] bg-base-300 rounded-lg overflow-hidden relative border border-base-300 shadow-sm transition-all group-hover:shadow-xl group-hover:border-primary/50"
            >
              <img
                src={temp.img}
                alt={temp.title}
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />

              <div
                class="absolute inset-0 bg-primary/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-4 transition-opacity duration-300 text-base-content"
              >
                <button
                  class="btn btn-sm btn-ghost border-white text-base-content rounded-full px-6"
                >
                  {$_('Use Template')}
                </button>
                <button
                  class="mt-2 text-[10px] font-bold uppercase tracking-widest opacity-80 hover:opacity-100"
                >
                  {$_('Quick Preview')}
                </button>
                >
              </div>

              <div class="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded-md">
                <i class={'ph-light i-icon ph-lightning text-yellow-400 text-[10px]'}></i>
              </div>
            </div>
            <div class="mt-3">
              <div class="text-sm font-bold truncate">{$_(temp.titleKey)}</div>
              <div class="text-[10px] opacity-40 uppercase font-bold">
                {$_(temp.typeLabelKey)}
              </div>
            </div>
          </div>
        {/each}

        <button
          class="aspect-[3/4] border-2 border-dashed border-base-300 rounded-lg flex flex-col items-center justify-center gap-3 opacity-40 hover:opacity-100 hover:border-primary hover:bg-primary/5 transition-all group"
        >
          <i class={'ph-bold i-icon ph-plus text-2xl group-hover:scale-110 transition-transform'}
          ></i>
          <span class="text-xs font-bold uppercase tracking-wider">{$_('Add Custom')}</span>
        </button>
      </div>
    </section>
  </main>
</div>

<style lang="postcss">
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: oklch(var(--b3));
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  /* Smooth entry for images */
  img {
    background: oklch(var(--b2));
  }
</style>
