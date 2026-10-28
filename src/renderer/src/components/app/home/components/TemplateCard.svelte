<script>

  import { _ } from 'svelte-i18n'
  let { icon, title, description, color } = $props()
</script>

<div class="bg-[color-mix(in_srgb,var(--color-base-white)_100%,transparent)] p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer">
  <div class="flex items-center mb-2">
    <span class="{icon} w-6 h-6 mr-3 {color}"></span>
    <h3 class="text-sm font-semibold">{title}</h3>
  </div>
  <p class="text-xs text-gray-500">{description}</p>
</div>