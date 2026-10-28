<script lang="ts" context="module">
  import { writable } from 'svelte/store'

  export const listStyleGalleryRecentIds = writable<string[]>([])
</script>

<script lang="ts">
  import { get } from 'svelte/store'
  import { _ } from 'svelte-i18n'

  type GalleryItem = {
    __label: string
    __onClick: () => void
    __preview?: {
      kind: 'bullet' | 'number' | 'legal' | 'outline' | 'task'
      style?: string
    }
    __group?: 'gallery' | 'actions'
    __disabled?: boolean
    __id?: string
  }

  let {
    __title = '',
    __items = [],
    __compact = false,
    __recentTitle = 'Recently Used',
    __maxRecent = 6,
    __closeContextMenu = () => {}
  } = $props()

  const galleryItems = () => __items.filter((item) => item.__group !== 'actions')
  const actionItems = () => __items.filter((item) => item.__group === 'actions')

  const getItemId = (item: GalleryItem) =>
    item.__id ??
    `${item.__preview?.kind ?? 'style'}:${item.__preview?.style ?? 'default'}:${item.__label}`

  const recordRecent = (item: GalleryItem) => {
    if (item.__group === 'actions') return
    const id = getItemId(item)
    const current = get(listStyleGalleryRecentIds)
    const next = [id, ...current.filter((entry) => entry !== id)].slice(0, __maxRecent)
    listStyleGalleryRecentIds.set(next)
  }

  const recentItems = () => {
    const ids = get(listStyleGalleryRecentIds)
    if (!ids.length) return []
    const map = new Map(galleryItems().map((item) => [getItemId(item), item]))
    return ids.map((id) => map.get(id)).filter(Boolean) as GalleryItem[]
  }

  const handleClick = (item: GalleryItem) => {
    recordRecent(item)
    item.__onClick?.()
    __closeContextMenu?.()
  }
</script>

<div class="gallery {__compact ? 'compact' : ''}">
  {#if __title}
    <div class="title">{__title}</div>
  {/if}

  {#if recentItems().length}
    <div class="recent-title">{__recentTitle}</div>
    <div class="recent-row">
      {#each recentItems() as item}
        <button class="card compact" on:click={() => handleClick(item)} disabled={item.__disabled}>
          <div class="preview" data-kind={item.__preview?.kind} data-style={item.__preview?.style}>
            {#if item.__preview?.kind === 'number' || item.__preview?.kind === 'outline'}
              <ol class="preview-list">
                <li>{$_('Alpha')}</li>
                <li>{$_('Beta')}</li>
                <li>{$_('Gamma')}</li>
              </ol>
            {:else if item.__preview?.kind === 'legal'}
              <ol class="preview-list legal">
                <li>1.1</li>
                <li>1.2</li>
                <li>1.3</li>
              </ol>
            {:else if item.__preview?.kind === 'task'}
              <ul class="preview-list task">
                <li><span class="task-box"></span>{$_('Task')}</li>
                <li><span class="task-box checked"></span>{$_('Done')}</li>
                <li><span class="task-box"></span>{$_('Next')}</li>
              </ul>
            {:else}
              <ul class="preview-list">
                <li>{$_('Alpha')}</li>
                <li>{$_('Beta')}</li>
                <li>{$_('Gamma')}</li>
              </ul>
            {/if}
          </div>
          <div class="label">{$_(item.__label)}</div>
        </button>
      {/each}
    </div>
  {/if}

  <div class="grid">
    {#each galleryItems() as item}
      <button class="card" on:click={() => handleClick(item)} disabled={item.__disabled}>
        <div class="preview" data-kind={item.__preview?.kind} data-style={item.__preview?.style}>
          {#if item.__preview?.kind === 'number' || item.__preview?.kind === 'outline'}
            <ol class="preview-list">
              <li>{$_('Alpha')}</li>
              <li>{$_('Beta')}</li>
              <li>{$_('Gamma')}</li>
            </ol>
          {:else if item.__preview?.kind === 'legal'}
            <ol class="preview-list legal">
              <li>1.1</li>
              <li>1.2</li>
              <li>1.3</li>
            </ol>
          {:else if item.__preview?.kind === 'task'}
            <ul class="preview-list task">
              <li><span class="task-box"></span>{$_('Task')}</li>
              <li><span class="task-box checked"></span>{$_('Done')}</li>
              <li><span class="task-box"></span>{$_('Next')}</li>
            </ul>
          {:else}
            <ul class="preview-list">
              <li>{$_('Alpha')}</li>
              <li>{$_('Beta')}</li>
              <li>{$_('Gamma')}</li>
            </ul>
          {/if}
        </div>
        <div class="label">{$_(item.__label)}</div>
      </button>
    {/each}
  </div>

  {#if actionItems().length}
    <div class="actions">
      {#each actionItems() as item}
        <button
          class="action"
          on:click={() => {
            item.__onClick?.()
            __closeContextMenu?.()
          }}
          disabled={item.__disabled}
        >
          {$_(item.__label)}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .gallery {
    width: 420px;
    padding: 12px;
    background: #1f1f1f;
    border: 1px solid #2b2b2b;
    border-radius: 12px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  }

  .title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 10px;
  }

  .recent-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(255, 255, 255, 0.35);
    margin-bottom: 6px;
  }

  .recent-row {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 8px;
    margin-bottom: 12px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .gallery.compact {
    width: 300px;
    padding: 10px;
  }

  .gallery.compact .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .gallery.compact .preview {
    min-height: 44px;
  }

  .card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px;
    text-align: left;
    color: #f2f2f2;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card.compact .preview {
    min-height: 44px;
  }

  .card:hover {
    border-color: rgba(88, 166, 255, 0.5);
    box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.15);
  }

  .preview {
    background: #121212;
    border-radius: 8px;
    padding: 6px 8px;
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-list {
    margin: 0;
    padding-left: 18px;
    font-size: 10px;
    color: #d2d2d2;
  }

  .preview[data-style='disc'] .preview-list {
    list-style-type: disc;
  }

  .preview[data-style='circle'] .preview-list {
    list-style-type: circle;
  }

  .preview[data-style='square'] .preview-list {
    list-style-type: square;
  }

  .preview[data-style='dash'] .preview-list {
    list-style-type: '– ';
  }

  .preview[data-style='decimal'] .preview-list {
    list-style-type: decimal;
  }

  .preview[data-style='upper-alpha'] .preview-list {
    list-style-type: upper-alpha;
  }

  .preview[data-style='lower-alpha'] .preview-list {
    list-style-type: lower-alpha;
  }

  .preview[data-style='upper-roman'] .preview-list {
    list-style-type: upper-roman;
  }

  .preview[data-style='lower-roman'] .preview-list {
    list-style-type: lower-roman;
  }

  .preview-list.legal {
    list-style: none;
    padding-left: 4px;
  }

  .preview-list.task {
    list-style: none;
    padding-left: 0;
  }

  .task-box {
    width: 10px;
    height: 10px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    display: inline-block;
    margin-right: 6px;
  }

  .task-box.checked {
    background: #4c9ffe;
    border-color: #4c9ffe;
  }

  .label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
  }

  .actions {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .action {
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    font-size: 10px;
    color: #d0d0d0;
    cursor: pointer;
  }
</style>
