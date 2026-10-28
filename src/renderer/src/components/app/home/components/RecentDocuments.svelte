<script>

  import Utils from '../../../../../utils/Utils'
  import { _ } from 'svelte-i18n'
  let { type; // Utils.FILE_TYPES.pdf, 'doc', 'sheet', name, date, size, location, colorMap; // Object mapping type to UnoCSS color classes } = $props()
  
  $: iconClass = {
    pdf: 'i-carbon-document-pdf',
    doc: 'i-carbon-document-word-processor',
    sheet: 'i-carbon-spreadsheet'
  }[type] || 'i-carbon-document';
  
  $: colorClass = colorMap[type] || 'bg-gray-400 text-base-content';
</script>

<div class="grid grid-cols-[1fr_80px_100px_100px_80px] items-center py-2 text-sm border-b border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer">
    
    <div class="flex items-center">
        <div class="w-5 h-5 rounded-sm flex items-center justify-center mr-3 {colorClass}">
            <span class="{iconClass} w-3 h-3"></span>
        </div>
        
        <div class="truncate text-sm">
            {name}
            {#if location === 'Local'}
                <span class="text-xs text-gray-400 ml-1">{$_('Local')}</span>
            {/if}
        </div>
    </div>
    
    <div class="text-xs text-gray-500 truncate">{location}</div>
    
    <div class="text-xs text-gray-500 truncate">{date}</div>
    
    <div class="text-xs text-gray-500 text-right truncate">{size}</div>

    <div class="flex justify-end pr-2">
        <button class="i-carbon-overflow-menu-vertical text-gray-400 hover:text-gray-700 w-4 h-4"></button>
    </div>
</div>
