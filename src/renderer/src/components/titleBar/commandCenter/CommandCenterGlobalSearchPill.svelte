<script>
  import { _ } from 'svelte-i18n'
</script>

<!--
 Copyright (C) 2024 Dashmake Inc.

 This file is part of DDoc Office.

 DDoc Office is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 DDoc Office is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
-->


<div
  class="search-pill group flex items-center gap-3 px-[5px] py-[1px] rounded
            bg-[color-mix(in_srgb,var(--color-base-white)_3%,transparent)] border border-white/10 hover:border-primary/50
            transition-all duration-300 cursor-pointer w-full"
>
  <i
    class="ph-bold ph-magnifying-glass text-base-content/20 group-hover:text-primary transition-colors text-sm"
  ></i>

  <div class="flex-1 flex items-center justify-between overflow-hidden">
    <span class="text-[11px] font-bold text-base-content/30 truncate tracking-widest">
      {$_('Search...')}
    </span>

    <div class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
      <kbd
        class="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[9px] font-black text-base-content/40"
        >⌘</kbd
      >
      <kbd
        class="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-[9px] font-black text-base-content/40"
        >{$_('P')}</kbd
      >
    </div>
  </div>
</div>

<style>
  .search-pill {
    backdrop-filter: blur(10px);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05);
  }
</style>
