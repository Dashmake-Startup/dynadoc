

<script lang="ts">
import { nodeApi } from '../../../../utils/shims/node'
  import { _ } from 'svelte-i18n'
  import { fade, slide, scale } from 'svelte/transition';
  import PhotoSwipeLightbox from 'photoswipe/lightbox';
  import { toAssetUrl } from '../../../../utils/assetUrl'
  import 'photoswipe/style.css';

  // --- Runes & Props ---
  let { __src } = $props();
  // const { fs, path } = window.api.node;

  let gridDensity = $state(4);
  let searchQuery = $state('');
  let selectedId = $state(null); // Track ID instead of object for cleaner reactivity

  // --- 1. Pure Data Fetching (Non-Reactive Helper) ---
  const loadAssets1 = async (dir: string): Promise<any[]> => {
    if (!dir) return [];
    try {
      const entries = await nodeApi.fsPromises.readdir(dir)
      const items = await Promise.all(entries.map(async (entryName) => {
          const fullPath = nodeApi.path.join(dir, entryName);
          const stat = await nodeApi.fsPromises.stat(fullPath).catch(() => null)
          if (!stat || stat.isDirectory() || entryName.startsWith('.')) return null
          const ext = nodeApi.path.extname(entryName).toLowerCase();
          const isVideo = ['.mp4', '.webm'].includes(ext);
          if (!['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'].includes(ext)) return null;

          return {
            id: btoa(fullPath),
            name: entryName,
            src: toAssetUrl(fullPath),
            type: isVideo ? 'video' : 'image',
            ext: ext.slice(1).toUpperCase(),
            size: (stat.size / (1024 * 1024)).toFixed(2) + ' MB'
          };
        }))
      return items.filter(Boolean);
    } catch (e) { return []; }
  };
  const loadAssets = async (dir: string): Promise<any[]> => {
  if (!dir) return [];

  // Recursive worker to crawl subdirectories
  const walk = async (currentDir: string): Promise<any[]> => {
    try {
      const entries = await nodeApi.fsPromises.readdir(currentDir)
      const results = await Promise.all(entries.map(async (entryName) => {
        const fullPath = nodeApi.path.join(currentDir, entryName);
        const stat = await nodeApi.fsPromises.stat(fullPath).catch(() => null)
        if (!stat) return []

        // 1. If it's a directory, dive deeper
        if (stat.isDirectory()) {
          return await walk(fullPath);
        }

        // 2. Ignore hidden files (Adobe/System junk)
        if (entryName.startsWith('.')) return [];

        const ext = nodeApi.path.extname(entryName).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
        const isVideo = ['.mp4', '.webm', '.ogg'].includes(ext);

        if (!isImage && !isVideo) return [];

        // 3. Gather metadata for the flat list
        return {
          id: btoa(fullPath), // Unique ID based on full path
          name: entryName,
          folder: nodeApi.path.basename(currentDir), // Innovation: track containing folder
          src: toAssetUrl(fullPath),
          type: isVideo ? 'video' : 'image',
          ext: ext.slice(1).toUpperCase(),
          size: (stat.size / (1024 * 1024)).toFixed(2) + ' MB'
        };
      }))
      return results.flat();
    } catch (e) {
      console.error(`Error scanning ${currentDir}:`, e);
      return [];
    }
  };

  return await walk(dir);
};

  // --- 2. Derived State (The Engine) ---
  // This automatically updates when __src or searchQuery changes without an $effect
  let rawItems = $state<any[]>([]);
  $effect(() => {
    const dir = __src
    void loadAssets(dir).then((items) => {
      rawItems = items
    })
  })
  let displayItems = $derived(
    rawItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  let selectedItem = $derived(displayItems.find(i => i.id === selectedId));

  // --- 3. Action-Based PhotoSwipe (No $effect for logic) ---
  // We use a Svelte Action (use:pswipe) to handle the 3rd party library
  function pswipe(node: HTMLElement) {
    const lightbox = new PhotoSwipeLightbox({
      gallery: node,
      children: '.pswipe-target',
      pswpModule: () => import('photoswipe'),
      bgOpacity: 0.98,
      padding: { top: 20, bottom: 20, left: 20, right: 20 }
    });

    // Innovation: Dynamic Video Handling inside the Action
    lightbox.on('contentLoad', (e) => {
      const { content } = e;
      if (content.data.type === 'video') {
        e.preventDefault();
        content.el = document.createElement('div');
        content.el.className = 'pswp__video-container flex items-center justify-center h-full w-full p-10';
        content.el.innerHTML = `<video controls autoplay class="max-w-full max-h-full shadow-2xl"><source src="${content.data.src}"></video>`;
      }
    });

    lightbox.init();
    return { destroy: () => lightbox.destroy() };
  }
</script>

<div class="adobe-media-manager bg-base-200 text-[#eee] rounded-lg border border-white/10 overflow-hidden flex flex-col h-[650px] font-sans shadow-2xl">
  
  <header class="flex items-center justify-between p-3 bg-base-200 border-b border-white/5">
    <div class="flex items-center gap-3">
      <div class="p-1.5 bg-base-300 rounded-md shadow-[0_0_10px_rgba(0,190,172,0.3)]">
        <i class="ph-light ph-film-slate text-[#141414] text-xs"></i>
      </div>
      <div>
        <h1 class="text-[10px] font-black uppercase tracking-[0.2em] text-base-300">{$_('Assets')}</h1>
        <p class="text-[11px] font-bold opacity-60 truncate max-w-[180px]">{nodeApi.path.basename(__src || '')}</p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <div class="relative">
        <i class="ph ph-magnifying-glass absolute left-2 top-1/2 -translate-y-1/2 text-[10px] opacity-30"></i>
        <input bind:value={searchQuery} placeholder={$_('Filter...')} 
          class="bg-black/40 border border-white/5 rounded-md py-1.5 pl-8 pr-2 text-[10px] focus:border-base-300/50 outline-none w-36 transition-all" />
      </div>
      <div class="flex items-center gap-2 px-2 py-1.5 bg-black/20 rounded-md border border-white/5">
        <input type="range" min="2" max="10" bind:value={gridDensity} class="w-16 h-1 accent-base-300" />
      </div>
    </div>
  </header>

  <main class="flex flex-1 overflow-hidden">
    <div 
      use:pswipe
      class="flex-1 p-4 overflow-y-auto grid gap-2 align-content-start scrollbar-hide"
      style="grid-template-columns: repeat({gridDensity}, minmax(0, 1fr));"
    >
      {#each displayItems as item (item.id)}
        <!-- <div 
          class="group relative aspect-square bg-base-100 rounded-md border border-white/5 hover:border-base-300/50 transition-all cursor-pointer"
          onmouseenter={() => selectedId = item.id}
        > -->
        <div 
          class="group relative aspect-square bg-base-100 rounded-md border border-white/5 hover:border-base-300/50 transition-all cursor-pointer"
          onmouseenter={() => selectedId = item.id}
        >
          <a href={item.src} class="pswipe-target block w-full h-full" data-type={item.type} target="_blank">
            {#if item.type === 'image'}
              <img src={item.src} alt="" class="w-full h-full object-cover rounded-[3px] group-hover:opacity-80 transition-opacity" loading="lazy" />
            {:else}
              <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-t from-black/40 to-transparent">
                <i class="ph-light ph-play text-2xl text-base-300"></i>
                <span class="absolute top-1 right-1 text-[7px] font-black bg-base-300 text-black px-1 rounded">{item.ext}</span>
              </div>
            {/if}
          </a>
          
          {#if selectedId === item.id}
            <div class="absolute inset-0 border-2 border-base-300 rounded-md pointer-events-none" in:fade={{duration: 100}}></div>
          {/if}
        </div>
      {/each}
    </div>

    {#if selectedItem}
      <aside transition:slide={{ axis: 'x', duration: 250 }} class="w-52 bg-base-200 border-l border-white/5 p-4 flex flex-col gap-4">
        <div class="aspect-square bg-black/40 rounded border border-white/5 flex items-center justify-center p-2 shadow-inner">
          <img src={selectedItem.src} alt="" class="max-w-full max-h-full object-contain" />
        </div>
        
        <div class="space-y-4">
          <section>
            <label class="text-[8px] font-black text-[#555] uppercase block mb-1">{$_('Name')}</label>
            <p class="text-[10px] font-bold leading-tight truncate">{selectedItem.name}</p>
          </section>
          
          <div class="grid grid-cols-2 gap-2">
            <section>
              <label class="text-[8px] font-black text-[#555] uppercase block mb-1">{$_('Ext')}</label>
              <p class="text-[10px] font-mono text-base-300">{selectedItem.ext}</p>
            </section>
            <section>
              <label class="text-[8px] font-black text-[#555] uppercase block mb-1">{$_('Size')}</label>
              <p class="text-[10px] font-mono">{selectedItem.size}</p>
            </section>
          </div>
        </div>

        <button class="mt-auto group flex items-center justify-center gap-2 w-full py-2.5 bg-base-300 text-[#141414] text-[10px] font-black uppercase rounded hover:shadow-[0_0_15px_rgba(0,190,172,0.4)] transition-all">
          <i class="ph-bold ph-plus"></i>
          {$_('Insert Media')}
        </button>
      </aside>
    {/if}
  </main>
</div>

<style>
  /* Custom Scrollbar for Adobe Look */
  .scrollbar-hide::-webkit-scrollbar { width: 4px; }
  .scrollbar-hide::-webkit-scrollbar-thumb { background: rgba(0, 190, 172, 0.2); border-radius: 10px; }
  .scrollbar-hide::-webkit-scrollbar-thumb:hover { background: var(--color-base-300); }

  input[type='range'] { -webkit-appearance: none; background: #333; height: 2px; border-radius: 2px; }
  
  :global(.pswp__bg) { backdrop-filter: blur(10px); }
  :global(.pswp__img) { border: 1px solid rgba(255,255,255,0.1); shadow: 0 30px 60px rgba(0,0,0,0.5); }
</style>
