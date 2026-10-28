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
<script lang="ts">

  import { onMount } from 'svelte'
  import type { ComponentType, SvelteComponent } from 'svelte'

  import { _ } from 'svelte-i18n'
  import Layout from '../../layout/layout'
  import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../stores/editor.store'
  import { get } from 'svelte/store'
  import LayoutSelect from '../../layout/LayoutSelect.svelte'
  import type { GenericFormattingProps } from './types'
  import LayoutButtonPicker from '../../layout/LayoutButtonPicker.svelte'
  import { debounce } from 'lodash'
  // let { __icon = '', __label = '', __direction = Layout.DIRECTION.HORIZONTAL, __class = '', __description = '', __disabled = false, __isActiveFunc = > boolean = null, __nodeOrMarkName = '' //  Name of the node or mark tiptap, __nodeOrMarkAttributes = {} // Optional Attributes of the node or mark tiptap, __selectData = [] // Optional data for select components, __contextMenudata = null // Optional data for select components, __selectDataProps = {} // Props to pass to component, __onClick = > void = () => {} }: { __icon?: string, __label?: string, __direction: any, __class?: string, __description?: string, __disabled?: boolean, __isActiveFunc?: (), __nodeOrMarkName?: string, __nodeOrMarkAttributes?: object, __selectData?: GenericFormattingProps[] | ComponentType<SvelteComponent>, __contextMenudata?: ComponentType<SvelteComponent>, __selectDataProps?: Record<string, any>, __onClick?: (event: MouseEvent | CustomEvent) } = $props()

  /* export let __layout: keyof typeof Layout.LAYOUT_COMPONENTS = Layout.LAYOUT.COLUMN


  // export let isActive: boolean = false
  // export let onClick: (event: MouseEvent) => void = () => {}
 */

  interface Props {
    __layout?: keyof typeof Layout.LAYOUT_COMPONENTS
    __icon?: string
    __label?: string
    __direction?: any // Matches Layout.DIRECTION.HORIZONTAL type
    __class?: string
    __description?: string
    __disabled?: boolean
    __isActiveFunc?: (() => boolean) | null
    __nodeOrMarkName?: string
    __nodeOrMarkAttributes?: object
    __selectData?: GenericFormattingProps[] | ComponentType
    __contextMenudata?: ComponentType | null
    __selectDataProps?: Record<string, any>
    __onClick?: (event: MouseEvent | CustomEvent) => void
  }

  // Destructure props with default values
  let {
    __layout = Layout.LAYOUT.COLUMN,
    __icon = '',
    __label = '',
    __direction = Layout.DIRECTION.HORIZONTAL,
    __class = '',
    __description = '',
    __disabled = false,
    __isActiveFunc = null,
    __nodeOrMarkName = null,
    __nodeOrMarkAttributes = null,
    __selectData = [],
    __contextMenudata = null,
    __selectDataProps = {},
    __onClick = () => {}
  }: Props = $props()
  let nodeOrMarkStatus = $state({ active: false, can: true })

  let _labelText = $derived(__label ? $_(__label) : '')
  let _descriptionText = $derived(__description ? $_(__description) : '')
  export function editorStatus2(
    node: HTMLElement,
    options: {
      editor: any
      name: string
      attrs?: any
      delay?: number
      onStatusChange: (status: { active: false; can: true }) => void
    }
  ) {
    let { editor, name, attrs, delay, onStatusChange } = options

    // 1. Define the core logic
    const executeCheck = () => {
      if (!editor || !name) return
      const active = editor.isActive(name, attrs || {})
      onStatusChange(active)
    }

    // 2. Create the debounced wrapper
    // We use a default of 0 if no delay is provided (effectively sync/next-tick)
    let debouncedCheck = debounce(executeCheck, delay ?? 0, {
      leading: true,
      trailing: true
    })

    function bind() {
      if (editor) {
        editor.on('selectionUpdate', debouncedCheck)
        editor.on('blur', debouncedCheck)
        executeCheck() // Check immediately on bind
      }
    }

    function unbind() {
      if (editor) {
        editor.off('selectionUpdate', debouncedCheck)
        editor.off('blur', debouncedCheck)
      }
      debouncedCheck.cancel() // Lodash's built-in cleanup
    }

    bind()

    return {
      update(newOptions) {
        // If the delay or editor changes, we need to refresh the debounce instance
        const delayChanged = newOptions.delay !== delay
        const editorChanged = newOptions.editor !== editor

        if (delayChanged || editorChanged) {
          unbind()
          ;({ editor, name, attrs, delay, onStatusChange } = newOptions)

          // Re-create the debounce function with the new delay
          debouncedCheck = debounce(executeCheck, delay ?? 0, {
            leading: true,
            trailing: true
          })

          bind()
        } else {
          // Just update internal refs if only name/attrs changed
          ;({ name, attrs, onStatusChange } = newOptions)
          executeCheck()
        }
      },
      destroy() {
        unbind()
      }
    }
  }

  export function editorStatus(
    node: HTMLElement,
    options: {
      editor: any
      name?: string
      attrs?: any
      command?: string // New: specify the command to check (e.g., 'toggleBold')
      delay?: number
      onStatusChange: (status: { active: boolean; can: boolean }) => void
    }
  ) {
    // return
    /* console.log(
      'update getActive handleOnWysiwygEditorupdate',
      'changed',

      __nodeOrMarkName

      // get(_$_documentEditorsList.getActive())
    ) */
    let { editor, name, attrs, command, delay, onStatusChange } = options

    const isBoldValue = (value?: string | null) => {
      if (!value) return false
      if (value === 'bold' || value === 'bolder') return true
      const numeric = Number.parseInt(value, 10)
      return Number.isFinite(numeric) && numeric >= 600
    }

    const isItalicValue = (value?: string | null) => {
      if (!value) return false
      return value === 'italic' || value === 'oblique'
    }

    const hasDecoration = (value: string | null | undefined, token: string) => {
      if (!value) return false
      return value.split(/\s+/).some((entry) => entry === token)
    }

    const resolveTextStyleActive = (target: string) => {
      const attrs = editor?.getAttributes?.('textStyle') || {}
      if (target === 'bold') return isBoldValue(attrs.fontWeight)
      if (target === 'italic') return isItalicValue(attrs.fontStyle)
      if (target === 'underline') return hasDecoration(attrs.textDecoration, 'underline')
      if (target === 'strike') return hasDecoration(attrs.textDecoration, 'line-through')
      if (target === 'superscript') return attrs.verticalAlign === 'super'
      if (target === 'subscript') return attrs.verticalAlign === 'sub'
      return false
    }

    const executeCheck = () => {
      // if (!editor) return
      if (!editor || (!name && !attrs)) return
      // if (!editor || !name) return

      // 1. Check if the mark/node is active
      let active = false
      if (name && ['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript'].includes(name)) {
        active = resolveTextStyleActive(name)
      } else if (!name) {
        active = editor.isActive(attrs || {})
      } else {
        active = editor.isActive(name, attrs || {})
      }
      console.log(
        'update getActive handleOnWysiwygEditorupdate',
        { active, __nodeOrMarkName, name, __nodeOrMarkAttributes }

        // get(_$_documentEditorsList.getActive())
      )
      // 2. Check if the command can be executed
      // We default the command to `toggle + Name` (e.g., 'bold' -> 'toggleBold')
      let can = true
      /* const cmdName = command || `toggle${name.charAt(0).toUpperCase() + name.slice(1)}`

      let can = true
      if (editor.commands[cmdName]) {
        can = editor
          .can()
          .chain()
          .focus()
          [cmdName](attrs || {})
          .run()
      } */

      onStatusChange({ active, can })
    }

    let debouncedCheck = debounce(executeCheck, delay ?? 0, {
      leading: true,
      trailing: true
    })

    function bind() {
      if (editor) {
        editor?.on('selectionUpdate', debouncedCheck)
        editor?.on('blur', debouncedCheck)
        executeCheck()
      }
    }

    function unbind() {
      if (editor) {
        editor?.off('selectionUpdate', debouncedCheck)
        editor?.off('blur', debouncedCheck)
      }
      debouncedCheck.cancel()
    }

    bind()

    return {
      update(newOptions) {
        if (newOptions.delay !== delay || newOptions.editor !== editor) {
          unbind()
          ;({ editor, name, attrs, command, delay, onStatusChange } = newOptions)
          debouncedCheck = debounce(executeCheck, delay ?? 0, { leading: true, trailing: true })
          bind()
        } else {
          ;({ name, attrs, command, onStatusChange } = newOptions)
          executeCheck()
        }
      },
      destroy() {
        unbind()
      }
    }
  }

  // $: LayoutComponent = Layout.LAYOUT_COMPONENTS[__layout]
  // This will automatically re-calculate whenever __layout changes
  const LayoutComponent = $derived(Layout.LAYOUT_COMPONENTS[__layout])

  // $: _isActive = __isActiveFunc?.()
  // export let icon
  // let _wysiwygEditor
  // let wysiwygEditorStore
  let _isActive = $derived(__isActiveFunc?.() ?? false)
  // const activeDocumentEditor = get(_$_documentEditorsList.getActive()) // get active document editor
  // // if (!activeDocumentEditor) return false

  // _wysiwygEditor = _$_wysiwygEditorsList.get(activeDocumentEditor.id)

  // Subscribe to the active document + wysiwyg editor
  // ✅ Use store subscription to react when active document changes
  const _activeDocumentEditorStore = _$_documentEditorsList.getActive()
  // let _activeDocumentEditor = $_activeDocumentEditorStore
  // Track the previously bound editor to remove listeners
  let _lastBoundEditor = null
  // const id = ""
  /* $: if ($_activeDocumentEditorStore) {
    _activeDocumentEditor = $_activeDocumentEditorStore

    wysiwygEditorStore = _$_wysiwygEditorsList.get(_activeDocumentEditor?.id)
    _wysiwygEditor = $wysiwygEditorStore
  } */

  // 1. Get the active editor data
  const _activeDocumentEditor = $derived($_activeDocumentEditorStore)

  // 2. Get the specific WYSIWYG store based on the active ID
  // We use the optional chain ?. to stay safe if no editor is active
  const wysiwygEditorStore =
    // $derived(
    // _activeDocumentEditor ?
    _$_wysiwygEditorsList.getActive()
  // : null
  // _activeDocumentEditor ? _$_wysiwygEditorsList.get(_activeDocumentEditor.id) : null
  // )

  // 3. Get the actual editor instance ($ is still used to auto-subscribe to the store)
  const _wysiwygEditor = $derived(wysiwygEditorStore ? $wysiwygEditorStore : null)

  // const _activeWysiwygEditor = $derived(_wysiwygEditor.ac ? $wysiwygEditorStore : null)

  /* $: if ($_activeDocumentEditorStore) {
    _activeDocumentEditor = $_activeDocumentEditorStore
    // _wysiwygEditor = _$_wysiwygEditorsList.get(activeDocumentEditor.id)
  
  // }

  // $: if ($_$_wysiwygEditorsList) {
    wysiwygEditorStore = _$_wysiwygEditorsList.get(_activeDocumentEditor?.id)
    _wysiwygEditor = $wysiwygEditorStore
    // id =

    console.log('update getActive new _wysiwygEditor', {_wysiwygEditor,__nodeOrMarkName})
    // optional: rebind listeners when editor changes
    _wysiwygEditor?.on('selectionUpdate', (e) => {
      handleOnWysiwygEditorupdate(e, _activeDocumentEditor.id, 'selectionUpdate')
    })
    _wysiwygEditor?.on('transaction', (e) => {
      // handleOnWysiwygEditorupdate(e, _activeDocumentEditor.id, 'transaction')
    })
    _wysiwygEditor?.on('update', (e) => {
      // handleOnWysiwygEditorupdate(e, _activeDocumentEditor.id, 'update')
    })
    _wysiwygEditor?.on('blur', (e) => {
      // requestAnimationFrame(() => {
      handleOnWysiwygEditorupdate(e, _activeDocumentEditor.id, 'blur')
      // })
    })
  } */

  /*  function unbindListeners(editor) {
    if (!editor) return
    editor.off('selectionUpdate', handleOnWysiwygEditorupdate)
    editor.off('blur', handleOnWysiwygEditorupdate)
    // Add any other events you previously bound here
  } */

  /*  $: if (false) {
    // $: if ($_activeDocumentEditorStore && $wysiwygEditorStore) {

    const nextEditor = $wysiwygEditorStore

    // Only re-bind if the editor instance has actually changed
    if (nextEditor !== _lastBoundEditor) {
      // 1. Remove listeners from the old instance to prevent memory leaks
      unbindListeners(_lastBoundEditor)

      // 2. Bind to the new instance
      nextEditor.on('selectionUpdate', (e) =>
        handleOnWysiwygEditorupdate(e, $_activeDocumentEditorStore.id, 'selectionUpdate')
      )
      nextEditor.on('blur', (e) =>
        handleOnWysiwygEditorupdate(e, $_activeDocumentEditorStore.id, 'blur')
      )

      // 3. Update references
      _lastBoundEditor = nextEditor
      _wysiwygEditor = nextEditor

      // Initial check so UI is correct immediately
      handleOnWysiwygEditorupdate(null, $_activeDocumentEditorStore.id, 'init')
    }
  } */

  // Use a simple throttle or requestAnimationFrame to keep UI smooth
  /* function handleOnWysiwygEditorupdate(e, id?: string, event?: string): void {
    return
    if (!__nodeOrMarkName || !_wysiwygEditor) return

    // requestAnimationFrame ensures we don't choke the main thread during heavy typing
    requestAnimationFrame(() => {
      console.log(
        'update getActive handleOnWysiwygEditorupdate',
        _isActive,
        id,
        __nodeOrMarkName,
        event
        // get(_$_documentEditorsList.getActive())
      )

      const newIsActive = _wysiwygEditor.isActive(__nodeOrMarkName, __nodeOrMarkAttributes || {})

      // Only update state if the value actually changed (prevents Svelte re-render loops)
      if (_isActive !== newIsActive) {
        _isActive = newIsActive
      }
    })
  } */

  /*  function handleOnWysiwygEditorupdate2(e, id?: string, event?: string): void {
    console.log(
      'update getActive handleOnWysiwygEditorupdate',
      _isActive,
      id,
      __nodeOrMarkName,
      event
      // get(_$_documentEditorsList.getActive())
    )
    if (__nodeOrMarkName) {
      _isActive = _wysiwygEditor?.isActive(__nodeOrMarkName, __nodeOrMarkAttributes || {})
      // console.log('uodate refresh', _isActive)
    }
    // refresh++ // triggers re-render when editor updates
  } */
  onMount(() => {
    // const activeDocumentEditor = get(_$_documentEditorsList.getActive()) // get active document editor
    // if (!activeDocumentEditor) return false
    // wysiwygEditor = _$_wysiwygEditorsList.get(activeDocumentEditor.id)
    // if (!wysiwygEditor) return false
    // return wysiwygEditor.isActive('italic')
    // _wysiwygEditor?.on('selectionUpdate', handleOnWysiwygEditorupdate)
    // _wysiwygEditor?.on('transaction', handleOnWysiwygEditorupdate)
    // _wysiwygEditor?.on('update', handleOnWysiwygEditorupdate)
  })
</script>

<!-- <div
  on:click={(e) => {
    if (!__disabled) __onClick(e)
  }}
  disabled={__disabled}
  class:bg-blue-500={_isActive}
  class:text-base-content={_isActive}
  class:is-active={_isActive}

  use:editorStatus={{ 
    editor, 
    name: 'heading', 
    attrs: { level: 1 }, 
    delay: 150, // Waits for 150ms of "silence" before checking
    onStatusChange: (active) => (nodeOrMarkStatus = active) 
  }}
> -->
<div
  on:click={(e) => {
    if (!__disabled) __onClick(e)
  }}
  class="rounded-[2px] m-[1px]"
  disabled={nodeOrMarkStatus.can}
  class:bg-base-300={nodeOrMarkStatus.active}
  class:text-base-content={nodeOrMarkStatus.active}
  class:is-active={nodeOrMarkStatus.active}
  use:editorStatus={{
    editor: _wysiwygEditor?.editor,
    name: __nodeOrMarkName,
    attrs: __nodeOrMarkAttributes,
    delay: 150, // Waits for 150ms of "silence" before checking
    onStatusChange: (active) => (nodeOrMarkStatus = active)
  }}
>
  <!-- {@html __icon} -->
  <!-- {@html reactiveIcon.html} -->
  <!-- <div
  on:click={(e) => {
    __onClick(e)
    _isActive = __isActiveFunc?.()
  }}
  disabled={__disabled}
  isActive={_isActive}
  class:is-active={_isActive}
> -->
  {#if __layout == Layout.LAYOUT.SELECT}
    <LayoutSelect
      {__disabled}
      __isActive={_isActive}
      __label={_labelText}
      __description={_descriptionText}
      {__icon}
      {__direction}
      __data={__selectData}
      {__selectDataProps}
    >
      <svelte:fragment slot="icon">{@html __icon}</svelte:fragment>
    </LayoutSelect>
  {:else if __layout == Layout.LAYOUT.BUTTON_PICKER}
    <LayoutButtonPicker
      {__disabled}
      __isActive={_isActive}
      __label={_labelText}
      __description={_descriptionText}
      {__direction}
      __data={__selectData}
      {__selectDataProps}
      {__contextMenudata}
    >
      <svelte:fragment slot="icon">{@html __icon}</svelte:fragment>
    </LayoutButtonPicker>
  {:else}
    <svelte:component
      this={LayoutComponent}
      {__disabled}
      __isActive={_isActive}
      {__direction}
      __label={_labelText}
      {__icon}
      __description={_descriptionText}
    >
      <svelte:fragment slot="icon">{@html __icon}</svelte:fragment>
      <svelte:fragment slot="label">
        {@html _labelText}
      </svelte:fragment>
    </svelte:component>
  {/if}
</div>

<style>
</style>
