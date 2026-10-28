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
<!-- TitleBar.svelte -->
<script lang="ts">
// import { nodeApi } from '../../../utils/shims/node'
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'

  // let _wysiwygEditor = _$_wysiwygEditorsList.get(__wysiwygEditorId)

  import ChatWidget from '../../common/chat/ChatWidget.svelte'
  import ActionBar from './ActionBar.svelte'
  // import { createVariableInspector } from '../../../extensions/tiptap/CustomVarExtension.svelte'
  import DocumentRestrictionWidget from './components/DocumentRestrictionWidget.svelte'
  import VariableInspectorWidget from './components/VariableInspectorWidget.svelte'
  import ProtectionPane from '../../../extensions/tiptap/CustomSecuredContentExtension/components/ProtectionPane.svelte'
  import {
    _$_documentEditorsList,
    _$_wysiwygEditorsList,
    type WysiwygEditorEntry,
    type WysiwygEditorNodeviewEntry
  } from '../../../stores/editor.store'
  import { get } from 'svelte/store'
  import Utils from '../../../utils/Utils'
  import {
    _$_activeSecondarySidebarItem,
    _$_secondarySidebarVisible
  } from '../../../stores/common.store'
  import Layers from '../../../extensions/tiptap/CustomDesignExtension/components/secondarySideBar/components/Layers.svelte'
  import SecondarySideBar from '../../../extensions/tiptap/CustomDesignExtension/components/secondarySideBar/SecondarySideBar.svelte'
  import { CustomDesignExtensionProps } from '../../../extensions/tiptap/CustomDesignExtension/utils/common.utils'
  import ChatView from '../../common/chat/ai/react/AIChatView.svelte'
  import TranslationPane from '../../../extensions/tiptap/CustomTranslationExtension/components/TranslationPane.svelte'
  import LayersPane from './components/LayersPane.svelte'
  import FormInsertionPane from '../../app/ribbon/components/form/FormInsertionPane.svelte'
  import FilesManager from './components/FilesManager.svelte'
  import MeetingPaneWidget from './components/MeetingPaneWidget.svelte'
  import ReviewPane from './components/ReviewPane.svelte'
  import LazyPersistent from '../../../extensions/tiptap/components/common/LazyPersistent.svelte'
  import BrowserWidget from '../../browser/BrowserWidget.svelte'
  import ChartInspectorPane from './components/ChartInspectorPane.svelte'

  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let activeEditor = $derived($activeDocumentEditorStore)
  let activeWysiwyg: WysiwygEditorEntry, activeNodeview: WysiwygEditorNodeviewEntry
  // $:
  $effect(() => {
    if ($_$_wysiwygEditorsList) {
      // const unsubscribe = _$_wysiwygEditorsList.subscribe((value) => {
      activeWysiwyg = _$_wysiwygEditorsList.getEntry(activeEditor?.id)

      //  activeWysiwyg = value[activeEditor?.id]

      activeNodeview = _$_wysiwygEditorsList.getActiveNodeview(activeWysiwyg?.id)
      console.log(
        ' yes focus activeNodeview acti',
        activeWysiwyg,
        activeNodeview,
        _$_wysiwygEditorsList.getList()
      )
      // })
    }
  })

  // const activeEditor = get(activeDocumentEditorStore)
  onMount(() => {
    //  const activeEditorStore = _$_documentEditorsList.getActive()
    // const activeEditor = _$_documentEditorsList.getActive()
    // const activeEditor = get(activeEditorStore) // unwrap derived store    // const dir = path.join(process.cwd(), node.attrs.path)
    // 3️⃣ Create the variable inspector panel
    // Optionally, pass a container element instead of defaulting to document.body
    // const inspector = createVariableInspector(document.getElementById("variable-inspector-pane"))
    // const inspector = createVariableInspector(document.body)
  })

  // console.lo
</script>

<div
  id="secondary-side-bar"
  class="secondary-side-bar"
  class:mobile-sidebar-open={$_$_secondarySidebarVisible}
>
  <!-- {#if Object.values(Utils.IMAGE_EXTENSIONS).includes(activeEditor?.document?.extension) || activeNodeview?.type == CustomDesignExtensionProps.name} -->
  <div id="image-editor-secondary-side-bar-pane" class="hidden">
    <SecondarySideBar></SecondarySideBar>
    <!-- <Layers></Layers> -->
  </div>
  <!-- {:else} -->
  <div id="wysiwyg-secondary-side-bar-pane" class="h-full min-h-0 flex flex-col">
    <!-- <div class="sidebar-content scrollable-section"> -->
    <!-- <h2 class="text-xl font-bold mb-4">Right second Sidebar</h2> -->
    <!-- {#if $_$_activeSecondarySidebarItem} -->
    <!-- {#if $_$_activeSecondarySidebarItem === 'protectionPane'} -->
    <div id="document-protection-pane">
      {#if $_$_activeSecondarySidebarItem === 'protectionPane'}
        <ProtectionPane />
      {/if}
    </div>
    <!-- {:else if $_$_activeSecondarySidebarItem === 'variablesManager'} -->

    <div id="variable-inspector-pane">
      <!-- {#if $_$_activeSecondarySidebarItem === 'variablesManager'} -->
      <div
        class="variable-inspector {$_$_activeSecondarySidebarItem === 'variablesManager'
          ? '!block'
          : '!hidden'}"
      >
        <VariableInspectorWidget></VariableInspectorWidget>
      </div>

      <!-- <div>Search Widget Placeholder</div> -->
      <!-- {/if} -->
    </div>

    <div id="limitation-manager-pane">
      {#if $_$_activeSecondarySidebarItem === 'limitationManager'}
        <DocumentRestrictionWidget />
      {/if}
    </div>

    <div id="extensions-pane">
      {#if $_$_activeSecondarySidebarItem === 'extensions'}
        <div>{$_('Extensions Widget Placeholder')}</div>
      {/if}
    </div>

    <div id="meeting-pane" class="secondary-pane">
      <!-- {#if $_$_activeSecondarySidebarItem === 'meeting'} -->
      <!-- <div>Chat Widget Placeholder</div> -->
      <!-- <MeetingPaneWidget></MeetingPaneWidget> -->
      <LazyPersistent __isVisible={$_$_activeSecondarySidebarItem === 'meeting'}>
        <MeetingPaneWidget />
      </LazyPersistent>

      <!-- {/if} -->
    </div>

    <div id="chat-pane" class="secondary-pane">
      <!-- {#if $_$_activeSecondarySidebarItem === 'chat'} -->
      <!-- <div>Chat Widget Placeholder</div> -->
      <!-- <ChatWidget></ChatWidget> -->
      <LazyPersistent __isVisible={$_$_activeSecondarySidebarItem === 'chat'}>
        <ChatWidget />
      </LazyPersistent>
      <!-- {/if} -->
    </div>

    <div id="chat-ai-pane" class="secondary-pane">
      <!-- {#if $_$_activeSecondarySidebarItem === 'chat-ai'} -->
      <!-- <div>AI Chat Widget Placeholder</div> -->
      <!-- <ChatView conversationId={'1'} /> -->
      <LazyPersistent __isVisible={$_$_activeSecondarySidebarItem === 'chat-ai'}>
        <ChatView conversationId={'1'} />
      </LazyPersistent>
      <!-- <ChatView conversationId={$activeConversationId} /> -->
      <!-- {/if} -->
    </div>

    <div id="files-manager-pane" class="secondary-pane">
      {#if $_$_activeSecondarySidebarItem === 'filesManager'}
        <FilesManager />
        <!-- <div>File used in the document manager Widget Placeholder</div> -->
      {/if}
    </div>

    <div id="layers-pane" class="secondary-pane">
      {#if $_$_activeSecondarySidebarItem === 'layers'}
        <LayersPane></LayersPane>
        <!-- <div>Layers used in slides or text (if possible)</div> -->
      {/if}
    </div>

    <div id="translate-pane" class="secondary-pane">
      {#if $_$_activeSecondarySidebarItem === 'translate'}
        <TranslationPane></TranslationPane>
        <!-- <div>Translate and insert pane like iin MS word</div> -->
      {/if}
    </div>
    <div id="form-pane" class="secondary-pane">
      {#if $_$_activeSecondarySidebarItem === 'form'}
        <FormInsertionPane layout="pane"></FormInsertionPane>
        <!-- <div>Translate and insert pane like iin MS word</div> -->
      {/if}
    </div>

    <div id="browser-pane" class="secondary-pane">
    <!-- <div id="browser-pane" class="secondary-pane h-full min-h-0"> -->
      <LazyPersistent __isVisible={$_$_activeSecondarySidebarItem === 'browser'}>
        <BrowserWidget __isVisible={$_$_activeSecondarySidebarItem === 'browser'} />
      </LazyPersistent>
    </div>

    <div id="review-pane" class="secondary-pane">
      <LazyPersistent __isVisible={$_$_activeSecondarySidebarItem === 'review'}>
        <ReviewPane />
      </LazyPersistent>
    </div>

    <div id="chart-inspector-pane" class="secondary-pane">
      <LazyPersistent __isVisible={$_$_activeSecondarySidebarItem === 'chartInspector'}>
        <ChartInspectorPane />
      </LazyPersistent>
    </div>
    <!-- {/if} -->

    <!-- <ChatWidget></ChatWidget> -->
    <!-- <ProtectionPane></ProtectionPane> -->
    <!-- <p>Content for the second sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
  <p>Content for the second sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
  <p>Content for the second sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
  <p>Content for the second sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
  <p>Content for the second sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
  <p>Content for the second sidebar.</p>
  <br /><br /><br /><br /><br /><br /><br /><br /><br /><br /> -->
    <!--right side bar... -->
  </div>
  <!-- {/if} -->
</div>

<style>
</style>
