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
  import { onDestroy, onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import DetachedPanel from '../../../extensions/tiptap/components/common/DetachedPanel.svelte'
  import { mountEmbeddedView, navigateEmbeddedView } from '../../browser/embeddedViewHost'
  import UpgradeNotice from '../upgrade/UpgradeNotice.svelte'
  import { cryptoRandomUUID } from '../../../utils/common.utils'

  // Persistent reference to the chat DOM node
  let sourceContainer: HTMLDivElement
  let chatElement: any = $state(null)
  let viewContainer: HTMLDivElement | null = null
  let embeddedId: string | null = null
  let disposeEmbedded: (() => void) | null = null
  let chatUrl = $state('')
  // let chatUrl = 'https://chat.dynadoc.dashmake.com'
  let unsubscribeAuth: (() => void) | null = null

  async function prepareMattermostSession() {
          console.log('Mattermost auto-login prepareMattermostSession')

    try {
      const result = await (window as any)?.server?.mattermost?.prepareSession?.()
      if (result?.ok && result?.baseUrl) {
        chatUrl = result.baseUrl
      }
      console.log('Mattermost auto-login result', {result})
    } catch (error) {
      console.warn('Mattermost auto-login failed', error)
    }
  }

  onMount(async () => {
    await prepareMattermostSession()

    const serverAuth = (window as any)?.server?.auth
    if (serverAuth?.onSessionChanged) {
      unsubscribeAuth = serverAuth.onSessionChanged((session: any) => {
        if (session?.authenticated) {
          prepareMattermostSession()
        }
      })
    }

    embeddedId = cryptoRandomUUID()
    if (viewContainer && embeddedId) {
      const preloadPath = await window.api?.getPreloadPath?.('embedded-var')
      disposeEmbedded = await mountEmbeddedView(viewContainer, {
        id: embeddedId,
        url: chatUrl || 'about:blank',
        partition: 'persist:mattermost',
        preloadPath,
        enableVarDropdown: true,
        onEvent: (payload) => {
          if (payload.type === 'dom-ready') {
            window.api?.embedded?.insertCSS?.({
              id: embeddedId!,
              css: `html, body { height: 100vh !important; width: 100vw !important; overflow: auto; }`
            })
          }
        }
      })
    }

  })

  onDestroy(() => {
    if (unsubscribeAuth) unsubscribeAuth()
    disposeEmbedded?.()
    disposeEmbedded = null
  })

  $effect(() => {
    if (embeddedId && viewContainer && chatUrl) {
      navigateEmbeddedView(viewContainer, embeddedId, chatUrl)
    }
  })

  function teleport(node: HTMLElement) {
    // Physically move the sourceContainer into the current active slot
    node.appendChild(sourceContainer)

    return {
      destroy() {
        // When the current slot (sidebar or modal) unmounts,
        // move the chat back to the hidden storage to keep it alive
        const storage = document.getElementById('chat-hidden-storage')
        if (storage) storage.appendChild(sourceContainer)
      }
    }
  }
</script>

<div id="chat-hidden-storage" style="display: none;">
  <div bind:this={sourceContainer} class="h-full w-full">
    <div
      bind:this={viewContainer}
      class="absolute inset-0 w-full h-full border-none outline-none flex"
      style="width: 100%; height: 100vh;"
    ></div>
  </div>
</div>

<DetachedPanel title={$_('Chat')}>
  {#snippet children()}
    <div class="chat-pane h-full w-full flex flex-col gap-3">
      <UpgradeNotice
        title={$_('Chat Governance')}
        message={$_('Upgrade to Pro to enable identity-bound chat, retention policies, and exportable audit trails. Keep every conversation compliant and discoverable.')}
        highlight="pro"
        compact={true}
      />
      <div use:teleport class="h-full w-full overflow-hidden"></div>
    </div>
  {/snippet}
</DetachedPanel>

<style>
  @media (max-width: 768px) {
    .chat-pane {
      gap: 10px;
    }
  }
</style>
