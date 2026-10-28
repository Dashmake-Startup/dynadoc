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
  import { _ } from 'svelte-i18n'
  // import { truncate } from 'fs'
  import { createEventDispatcher, onDestroy } from 'svelte'
  import EditorHelpers from '../../../../../utils/EditorHelpers.js'
  import type { Editor } from '@tiptap/core'
  // let searchVisible = false
  // let __searchQuery = ''
  // let items = ['Button 1', 'Button 2', 'Button 3']

  let {
    __parentEditorInstance,
    __parentEditorHTMLElement,
    __onThesePropsUpdate,
    __searchQuery = '',
    __varData = {}
  } = $props()
  // Reactive statement to watch changes in __searchQuery
  $effect(() => {
    if (__onThesePropsUpdate) {
      __onThesePropsUpdate(__searchQuery)
    }
  })
  // export let items = []
  // export let position = { top: '0px', left: '0px' }
  // Receives _var from the parent component
  const __varDataKeys = $derived.by(() => Object.keys(__varData))

  let _domExpressionsListItem
  let _isUserWritingExpression = true
  let _expressionContainerTag
  let _selectedItemIndex = 0

  const _dispatch = createEventDispatcher()

  /* let filteredVarData = __varData

  const filterItems = (query) => {
    console.log('filterItems  ' + query)
    if (query.trim() == '') {
      return filteredVarData
    }
    // filteredVarData = __varData.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
    filteredVarData = Object.keys(__varData).filter((key) => key.includes(query))
  } */

  onDestroy(() => {
    _isUserWritingExpression = false
  })

  /* const handleSearchInput = (event) => {
    __searchQuery = event.target.value
    filterItems(__searchQuery)
  } */

  // $: filterItems(__searchQuery)
  const filteredKeys = $derived.by(() =>
    __varDataKeys.filter((key) =>
      key
        .trim()
        .toLowerCase()
        .includes(EditorHelpers.removeOperators(__searchQuery.trim().toLowerCase()))
    )
  )

  // Handle item interaction (both click and keyboard)
  const handleItemInteraction = (event, index) => {
    console.log(`handleItemInteraction:`)
    _isUserWritingExpression = true
    if (event.type === 'keydown') {
      if (event.key === 'Enter') {
        event.preventDefault()
        selectItem(index)
      } else if (event.key === 'ArrowDown' || event.key === 'Tab') {
        console.log(`ArrowDown: ArrowDown`)
        event.preventDefault()
        navigateItems(1)
      } else if (event.key === 'ArrowUp') {
        console.log(`ArrowUp: ArrowUp`)
        event.preventDefault()
        navigateItems(-1)
      } else if (
        event.key === 'Backspace' ||
        event.key === 'Delete' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'Escape'
      ) {
        console.log(`Delete: Delete`)
        event.preventDefault()
        _dispatch('destroy') // destroy the element
      }

      // Check if the key is a printable character
      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
        __searchQuery += event.key.trim()
        // console.log(`__parentEditorHTMLElement: focus`)
        __parentEditorHTMLElement.focus()
      }
    } else if (event.type === 'click') {
      console.log(`handleItemInteraction: click`)
      selectItem(index)
    }
  }

  function handleExpressionContainerTagKeydown(event) {
    console.log('------handleExpressionContainerTagKeydown  ')
    if (_isUserWritingExpression) {
      // setExpressionInserterPosition()
      // __searchQuery += event.key
      // console.log('__searchQuery  ' + __searchQuery)
      // Get the current selection
      /* const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        let currentTagElement = range.commonAncestorContainer.parentElement

        console.log(
          'isOperator  >>>>' + event.key.trim() + '<',
          EditorHelpers.isOperator(event.key.trim())
        )
        if (EditorHelpers.isOperator(event.key.trim())) {
          console.log('currentTagElement  >>>>' + currentTagElement.textContent + '<')
          if (
            currentTagElement &&
            currentTagElement.getAttribute(EditorHelpers.varTagDataCodeAttributeName) &&
            currentTagElement.getAttribute(EditorHelpers.varTagDataValueAttributeName)
          ) {
            currentTagElement.setAttribute(
              EditorHelpers.varTagDataCodeAttributeName,
              `${currentTagElement.getAttribute(EditorHelpers.varTagDataCodeAttributeName)}${event.key.trim()}`
            )
            currentTagElement.setAttribute(
              EditorHelpers.varTagDataValueAttributeName,
              `${currentTagElement.getAttribute(EditorHelpers.varTagDataValueAttributeName)}${event.key.trim()}`
            )
          }
        }
      } */
    }
  }

  // Handle item selection
  const selectItem = (index) => {
    console.log(`handleItemInteraction:`, filteredKeys.length)
    console.log(`__parentEditorInstance:`, __parentEditorInstance.isActive('var'))
    if (index >= 0 && index < filteredKeys.length) {
      // console.log('__searchQuery  ' + __searchQuery)
      // Perform action with the selected item
      // console.log(`Selected item: ${__varData[index]}`)
      // const item = items[index]
      // const key = Object.keys(__varData)[index]

      // Delete the search query typed by the user in the parent editor
      /* EditorHelpers.deletePreviousCharacters(
        __parentEditorHTMLElement,
        EditorHelpers.removeOperators(__searchQuery).length
      ) */

      //  _editor.commands.deleteNode(EditorHelpers.varTagName) // Delete the var tag at the current selection

      // Reset the query search
      __searchQuery = ''

      const key = filteredKeys[index]
      const code = `_var['${key}']`
      const value = __varData[key]
      console.log('key  ' + key)

      if (__parentEditorInstance.isActive(EditorHelpers.varTagName)) {
        //  If inside an existing <var> tag, append the content
        
      } else {
        // Create a new <var> tag at the cursor position
        __parentEditorInstance.commands._insertNode({
          nodeName: EditorHelpers.varTagName,
          attrs: {
            [EditorHelpers.varTagDataCodeAttributeName]: code,
            [EditorHelpers.varTagDataValueAttributeName]: value,
            class: 'brackets'
          },
          text: key,
          deleteCharacters: 1 // Delete the previous character typed by the user. is likely a @ or #
        })
      }

      return
      // const code = _domExpressionsListItem[index].getAttribute('data-code')
      // const value = _domExpressionsListItem[index].getAttribute('data-value')

      // Get the current selection and range
      const selection = window.getSelection()
      const range = selection.getRangeAt(0)
      // const parentElement = range.commonAncestorContainer.parentElement
      // _expressionContainerTag = range.commonAncestorContainer.parentElement

      if (_expressionContainerTag && _expressionContainerTag.tagName === EditorHelpers.varTagName) {
        // If inside an existing <var> tag, append the content
        _expressionContainerTag.setAttribute(
          EditorHelpers.varTagDataCodeAttributeName,
          `${_expressionContainerTag.getAttribute(EditorHelpers.varTagDataCodeAttributeName)} ${code}`
        )
        _expressionContainerTag.setAttribute(
          EditorHelpers.varTagDataValueAttributeName,
          `${_expressionContainerTag.getAttribute(EditorHelpers.varTagDataValueAttributeName)} ${value}`
        )
        _expressionContainerTag.textContent += key
      } else {
        // Create a new <var> tag at the cursor position
        // const varElement = document.createElement(EditorHelpers.varTagName)
        _expressionContainerTag = document.createElement(EditorHelpers.varTagName)
        _expressionContainerTag.setAttribute(EditorHelpers.varTagDataValueAttributeName, value)
        _expressionContainerTag.setAttribute(EditorHelpers.varTagDataCodeAttributeName, code)
        _expressionContainerTag.classList.add('brackets')
        _expressionContainerTag.textContent = key
        // _expressionContainerTag.removeEventListener('keydown')
        // Remove any existing handleExpressionContainerTagKeydown listener
        /* _expressionContainerTag.removeEventListener('keydown', handleExpressionContainerTagKeydown)
        // Add a new  handleExpressionContainerTagKeydown listener
        _expressionContainerTag.addEventListener('keydown', handleExpressionContainerTagKeydown)
        EditorHelpers.triggerKeyEvent(_expressionContainerTag, 'keydown') */
        // }
        range.deleteContents()
        range.insertNode(_expressionContainerTag)
        // EditorHelpers.triggerClick(__parentEditorHTMLElement)
      }
      // Move the cursor after the (newly inserted) or (previously inserted) <var> element)
      range.setStartAfter(_expressionContainerTag)
      range.setEndAfter(_expressionContainerTag)
      selection.removeAllRanges()
      selection.addRange(range)
      // }

      // _expressionContainerTag.removeEventListener('keydown')
      // Remove any existing handleExpressionContainerTagKeydown listener
      /* _expressionContainerTag.removeEventListener('keydown', handleExpressionContainerTagKeydown)
      // Add a new  handleExpressionContainerTagKeydown listener
      _expressionContainerTag.addEventListener('keydown', handleExpressionContainerTagKeydown)
      EditorHelpers.triggerKeyEvent(_expressionContainerTag, 'keydown') */
    }

    // _expressionContainerTag.removeEventListener('keydown', handleExpressionContainerTagKeydown)
    // _expressionContainerTag.addEventListener('keydown', handleExpressionContainerTagKeydown)
  }

  // Navigate through items using arrow keys
  const navigateItems = (direction) => {
    if (direction === 1) {
      _selectedItemIndex = (_selectedItemIndex + 1) % filteredKeys.length
    } else if (direction === -1) {
      _selectedItemIndex = (_selectedItemIndex - 1 + filteredKeys.length) % filteredKeys.length
    }
    focusItem(_selectedItemIndex)
  }

  // Focus an item
  const focusItem = (index) => {
    const item = document.querySelector(`.expressionInserterItems[data-index="${index}"]`)
    console.log(`item  ${index} ` + item.innerHTML)
    if (item) {
      item.focus()
    }
  }
  // Focus an item
  const unfocusItem = (index) => {
    const item = document.querySelector(`.expressionInserterItems[data-index="${index}"]`)
    console.log(`item  ${index} ` + item.innerHTML)
    if (item) {
      item.unfocus()
    }
  }
</script>

<!-- <div> -->
<!-- {#if searchVisible} -->
<!-- <div class="container" style="top: {position.top}; left: {position.left};"> -->
<div class="container">
  <!-- <input
    class="search"
    type="text"
    placeholder="Search..."
    bind:value={__searchQuery}
    on:input={handleSearchInput}
  />

  <h3>Variables</h3> -->

  <!-- {#if __varDataKeys.length > 0} -->
  <div>
    <!-- {#each __varDataKeys as key, index} -->
    {#each filteredKeys as key, index}
      <div
        class="expressionInserterItems"
        tabindex="0"
        data-index={index}
        data-code="_var['{key}']"
        data-value={__varData[key]}
        on:keydown={(event) => handleItemInteraction(event, index)}
        on:click={(event) => handleItemInteraction(event, index)}
      >
        <strong>{key}:</strong>
        {__varData[key]}
      </div>

      <!-- <li class="entry">
          <strong>{key}:</strong>
          {__varData[key]}
        </li> -->
    {/each}
  </div>
  <!-- {:else}
    <p>No variables found.</p>
  {/if} -->
</div>

<!-- {/if} -->
<!-- </div> -->

<style>
  .expressionInserterItems {
    padding: 5px;
    margin: 2px;
    border: 1px solid #ddd;
    border-radius: 3px;
    cursor: pointer;
  }

  .expressionInserterItems:focus {
    outline: 2px solid blue;
  }
  .container {
    display: flex;
    flex-direction: column;
    width: 200px;
    border: 1px solid #ccc;
    padding: 10px;
    background-color: white;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    position: absolute;
    top: 60px;
    left: 0;
    z-index: 1000;
  }
  .buttons {
    display: flex;
    flex-direction: column;
    margin-top: 10px;
  }
  .button {
    margin: 5px 0;
  }
  .search {
    margin-bottom: 10px;
  }
</style>
