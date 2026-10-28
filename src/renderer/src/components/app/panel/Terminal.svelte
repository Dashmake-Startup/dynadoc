<!--
 Copyright (C) 2025 Dashmake Inc.

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

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, tick } from 'svelte'
  import { Terminal } from '@xterm/xterm'
  import { FitAddon } from '@xterm/addon-fit'
  import '@xterm/xterm/css/xterm.css'
  import { _$_terminalsList } from '../../../stores/terminal.store'
  import { _$_documentEditorsList } from '../../../stores/editor.store'
  import { get } from 'svelte/store'
  import DetachedPanel from '../../../extensions/tiptap/components/common/DetachedPanel.svelte'

  async function createNewTerminal(folder?: string) {
    if (!folder) {
      const activeStore = _$_documentEditorsList.getActive()
      const active = get(activeStore)
      folder = active?.document?.dirPath || '~/'
    }

    const { id, folderPath } = await window.terminal.open(folder)

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: '"Fira Code", monospace',
      theme: {
        background: '#181818',
        foreground: '#cccccc',
        cursor: '#0265D2',
        selectionBackground: 'rgba(2, 101, 210, 0.3)'
      },
      allowTransparency: true
    })

    const fitAddon = new FitAddon()
    // fitAddon.fit()
    term.loadAddon(fitAddon)

    // terminalFitAddon = new FitAddon()

    // terminalFitAddon.fit()

    // terminal.loadAddon(terminalFitAddon)

    // Update store
    _$_terminalsList.addTerminal(id, folderPath, term, fitAddon)
    _$_terminalsList.setActive(id)

    // SVELTE 5 FIX: Wait for DOM to sync
    await tick()

    const container = document.getElementById(`terminal-${id}`)
    if (container) {
      term.open(container)
      fitAddon.fit()
      term.focus() // Auto-focus on creation
    }

    term.onData((data) => window.terminal.sendInput({ id, data }))

    window.terminal.onOutput(({ id: outId, data }) => {
      if (outId === id) term.write(data)
    })
  }

  // Focus and fit when switching tabs
  async function switchTerminal(id: string) {
    _$_terminalsList.setActive(id)
    await tick()
    const activeTerm = _$_terminalsList.getTerminal(id)
    if (activeTerm) {
      activeTerm.fitAddon.fit()
      activeTerm.instance.focus()
    }
  }

  function handleResize() {
    $_$_terminalsList.forEach((t) => t.fitAddon?.fit())
  }

  onMount(() => {
    if ($_$_terminalsList.length === 0) createNewTerminal()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  })
</script>

<DetachedPanel title={$_('Terminal')}>
  <div class="flex flex-col h-full bg-[#181818] border-t border-white/5 font-sans overflow-hidden">
    <div class="flex items-center justify-between px-2 h-9 bg-base-100 border-b border-black/20">
      <div class="flex items-center h-full overflow-x-auto no-scrollbar gap-px">
        {#each $_$_terminalsList as t (t.id)}
          <button
            onclick={() => switchTerminal(t.id)}
            class="h-full px-3 flex items-center gap-2 group transition-all border-r border-white/5 relative
                 {t.isActive
              ? 'bg-[#181818] text-primary'
              : 'hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-base-content/40'}"
          >
            <i class="ph-bold ph-terminal-window text-[12px] {t.isActive ? 'text-primary' : ''}"
            ></i>
            <span class="text-[10px] font-black uppercase tracking-widest truncate max-w-[120px]">
              {t.folder.split(/[\\/]/).pop() || 'sh'}
            </span>

            {#if t.isActive}
              <div class="absolute bottom-0 left-0 right-0 h-[2px] bg-primary"></div>
            {/if}

            <div
              onclick={(e) => {
                e.stopPropagation()
                window.terminal.kill(t.id)
                _$_terminalsList.removeTerminal(t.id)
              }}
              class="opacity-0 group-hover:opacity-100 hover:text-error p-0.5 transition-opacity"
            >
              <i class="ph-bold ph-x text-[9px]"></i>
            </div>
          </button>
        {/each}

        <button
          onclick={() => createNewTerminal()}
          class="px-3 h-full hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] text-base-content/30 hover:text-primary transition-all"
          title={$_('Open New Session')}
        >
          <i class="ph-bold ph-plus text-[12px]"></i>
        </button>
      </div>

      <div class="flex items-center gap-1 pr-1">
        <button class="theme-icon-btn" onclick={handleResize} title={$_('Fit Terminal')}
          ><i class="ph-light ph-frame-corners"></i></button
        >
        <button class="theme-icon-btn" title={$_('Split Panel (coming soon)')}
          ><i class="ph-light ph-columns"></i></button
        >
        <div class="h-4 w-px bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)] mx-1"></div>
        <button class="theme-icon-btn text-error/60 hover:text-error" title={$_('Kill All')}
          ><i class="ph-light ph-power"></i></button
        >
      </div>
    </div>

    <div class="flex-grow relative bg-[#181818]">
      {#each $_$_terminalsList as t (t.id)}
        <div
          id="terminal-{t.id}"
          class="absolute inset-0 p-1 transition-opacity duration-75 {t.isActive
            ? 'opacity-100 z-10'
            : 'opacity-0 z-0 pointer-events-none'}"
        ></div>
      {/each}
    </div>
  </div>
</DetachedPanel>

<style>
  /* Xterm precision padding */
  :global(.xterm) {
    padding: 12px;
  }

  :global(.xterm-viewport::-webkit-scrollbar) {
    width: 6px;
  }

  :global(.xterm-viewport::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  .theme-icon-btn {
    @apply p-1.5 rounded-[3px] text-[var(--color-base-content)]/40 hover:bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] hover:text-primary transition-all;
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
</style>
