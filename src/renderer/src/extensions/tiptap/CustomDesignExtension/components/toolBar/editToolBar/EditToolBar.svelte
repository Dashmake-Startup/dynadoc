

<script lang="ts">
  import { _ } from 'svelte-i18n'
</script>

<div class="h-8 bg-gray-700 flex items-center p-x-4 border-b border-gray-900 flex-shrink-0 text-xs">
  <div class="flex items-center space-x-4">
    <div class="flex items-center space-x-1">
      <input
        type="checkbox"
        id="auto-select"
        class="rounded border-gray-500 bg-gray-600 focus:ring-blue-500"
      />
      <label for="auto-select" class="text-gray-200">{$_('Auto-Select')}</label>
    </div>
    <div class="flex items-center space-x-1">
      <input
        type="checkbox"
        id="transform"
        class="rounded border-gray-500 bg-gray-600 focus:ring-blue-500"
      />
      <label for="transform" class="text-gray-200">{$_('Show Transform Controls')}</label>
    </div>
  </div>
</div>

<style>
</style>
