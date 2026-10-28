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
  import { computePosition, flip, shift } from '@floating-ui/dom'
  import { posToDOMRect } from '@tiptap/core'

  /* ------------------------------
     Inline CommandsList Component
  ------------------------------ */
  const CommandsList = (target: HTMLElement, props) => {
    let selectedIndex = 0
    let { items = [], command } = props

    const container = document.createElement('div')
    container.className = 'dropdown-menu'

    const render = () => {
      container.innerHTML = ''
      if (items.length === 0) {
        const div = document.createElement('div')
        div.className = 'item'
        div.textContent = 'No result'
        container.appendChild(div)
        return
      }

      items.forEach((item, index) => {
        const btn = document.createElement('button')
        btn.textContent = item.title
        btn.classList.toggle('is-selected', index === selectedIndex)
        btn.onclick = () => selectItem(index)
        container.appendChild(btn)
      })
    }

    const selectItem = (index: number) => {
      const item = items[index]
      if (item) command(item)
    }

    const onKeyDown = ({ event }) => {
      if (event.key === 'ArrowUp') {
        selectedIndex = (selectedIndex + items.length - 1) % items.length
        render()
        return true
      }
      if (event.key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % items.length
        render()
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    }

    const update = (newProps) => {
      items = newProps.items
      command = newProps.command
      selectedIndex = 0
      render()
    }

    const destroy = () => container.remove()

    render()
    target.appendChild(container)
    return { element: container, onKeyDown, update, destroy }
  }

  /* ------------------------------
     Floating logic and render
  ------------------------------ */
  function updatePosition(editor, element) {
    const virtualElement = {
      getBoundingClientRect: () =>
        posToDOMRect(editor.view, editor.state.selection.from, editor.state.selection.to)
    }

    computePosition(virtualElement, element, {
      placement: 'bottom-start',
      strategy: 'absolute',
      middleware: [shift(), flip()]
    }).then(({ x, y, strategy }) => {
      element.style.width = 'max-content'
      element.style.position = strategy
      element.style.left = `${x}px`
      element.style.top = `${y}px`
    })
  }

  // export default
  /*  {
    items: ({ query }) =>
      [
        {
          title: 'Heading 1',
          command: ({ editor, range }) =>
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
        },
        {
          title: 'Heading 2',
          command: ({ editor, range }) =>
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
        },
        {
          title: 'Bold',
          command: ({ editor, range }) =>
            editor.chain().focus().deleteRange(range).setMark('bold').run()
        },
        {
          title: 'Italic',
          command: ({ editor, range }) =>
            editor.chain().focus().deleteRange(range).setMark('italic').run()
        }
      ]
        .filter((item) => item.title.toLowerCase().startsWith(query.toLowerCase()))
        .slice(0, 10),

    render: () => {
      let component

      return {
        onStart: (props) => {
          component = CommandsList(document.body, props)
          if (props.clientRect) updatePosition(props.editor, component.element)
        },
        onUpdate: (props) => {
          component.update(props)
          if (props.clientRect) updatePosition(props.editor, component.element)
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            component.destroy()
            return true
          }
          return component.onKeyDown(props)
        },
        onExit: () => component.destroy()
      }
    } */
  // }
</script>

<style>
  .dropdown-menu {
    background: var(--white);
    border: 1px solid var(--gray-1);
    border-radius: 0.7rem;
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    overflow: auto;
    padding: 0.4rem;
    position: relative;
    z-index: 9999;
  }

  button {
    align-items: center;
    background-color: transparent;
    display: flex;
    gap: 0.25rem;
    text-align: left;
    width: 100%;
    border: none;
    padding: 0.4rem 0.6rem;
  }

  button:hover,
  button.is-selected {
    background-color: var(--gray-3);
  }
</style>
