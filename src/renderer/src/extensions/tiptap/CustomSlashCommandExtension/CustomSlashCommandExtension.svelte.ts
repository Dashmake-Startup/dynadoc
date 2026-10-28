import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { computePosition, shift, flip, offset } from '@floating-ui/dom'
import { mount, unmount } from 'svelte'
import SlashCommandDropdown from './components/SlashCommandDropdown.svelte'
import { GenericFormatingEditorCommands } from '../../../components/common/actions/formatting/commands/GenericFormatingEditorCommands.svelte'
import { CustomSlashCommandExtensionProps } from './utils/common.utils'

async function getMenuPosition(editor, container, range) {
  if (!container || !range) return { x: 0, y: 0 }

  const virtualEl = {
    getBoundingClientRect: () => {
      const start = editor.view.coordsAtPos(range.from)
      const end = editor.view.coordsAtPos(range.to)
      return {
        top: start.top,
        bottom: end.bottom,
        left: start.left,
        right: end.right,
        width: end.right - start.left,
        height: end.bottom - start.top,
        x: start.left,
        y: start.top
      }
    }
  }

  const { x, y } = await computePosition(virtualEl, container, {
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      offset(10),
      flip({
        padding: 10,
        fallbackPlacements: ['top-start', 'bottom-end', 'top-end']
      }),
      shift({ padding: 15 })
    ]
  })

  return { x, y }
}

export const CustomSlashCommandExtension = Extension.create({
  name: CustomSlashCommandExtensionProps.name,

  addProseMirrorPlugins() {
    const suggestionPluginKey = new PluginKey('slash-command-suggestion')

    return [
      Suggestion({
        editor: this.editor,
        char: CustomSlashCommandExtensionProps.suggestion.char,
        allowSpaces: true,
        pluginKey: suggestionPluginKey,

        items: ({ query }) => {
          const allCommands = GenericFormatingEditorCommands.getCommandPaletteItems?.() || []
          const q = query.toLowerCase()
          return allCommands
            .filter(item => 
              item.title.toLowerCase().includes(q) || 
              (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
              (item.tags && item.tags.some(tag => tag.toLowerCase().includes(q)))
            )
            .slice(0, 10)
        },

        command: ({ editor, range, props }) => {
          // Remove the slash and the query
          editor.chain().focus().deleteRange(range).run()
          
          // Execute the command with a tiny delay to let ProseMirror update
          if (props.action) {
            setTimeout(() => {
              props.action()
            }, 10)
          }
        },

        render: () => {
          let component: any
          let svelteProps = $state({
            items: [],
            activeIndex: 0,
            query: '',
            position: null,
            selectItem: (item) => {}
          })
          let container: HTMLElement
          let cleanupOutsideHandlers: (() => void) | null = null
          const editor = this.editor

          return {
            onStart: async (props) => {
              container = document.createElement('div')
              container.style.position = 'fixed'
              container.style.zIndex = '1000'
              document.body.appendChild(container)

              const handlePointerDown = (event: Event) => {
                const target = event.target as Node | null
                if (!target) return
                if (container?.contains(target)) return
                if (editor?.view?.dom?.contains(target)) return
                // exitSuggestion is not directly exported but we can simulate it
                // by dispatching a transaction that moves selection
              }
              document.addEventListener('pointerdown', handlePointerDown, true)
              cleanupOutsideHandlers = () => {
                document.removeEventListener('pointerdown', handlePointerDown, true)
              }

              svelteProps.items = props.items
              svelteProps.activeIndex = 0
              svelteProps.query = props.query
              svelteProps.selectItem = (item) => {
                props.command(item)
              }

              component = mount(SlashCommandDropdown, {
                target: container,
                props: svelteProps
              })

              requestAnimationFrame(async () => {
                const pos = await getMenuPosition(editor, container, props.range)
                svelteProps.position = pos
              })
            },

            onUpdate: async (props) => {
              svelteProps.items = props.items
              svelteProps.query = props.query
              svelteProps.selectItem = (item) => {
                props.command(item)
              }

              const pos = await getMenuPosition(editor, container, props.range)
              svelteProps.position = pos
            },

            onKeyDown: (props) => {
              if (props.event.key === 'ArrowDown') {
                svelteProps.activeIndex = (svelteProps.activeIndex + 1) % svelteProps.items.length
                return true
              }
              if (props.event.key === 'ArrowUp') {
                svelteProps.activeIndex = (svelteProps.activeIndex - 1 + svelteProps.items.length) % svelteProps.items.length
                return true
              }
              if (props.event.key === 'Enter') {
                const item = svelteProps.items[svelteProps.activeIndex]
                if (item) {
                  props.command(item)
                  return true
                }
              }
              if (props.event.key === 'Escape') {
                return false // Let Tiptap handle it
              }
              return false
            },

            onExit: () => {
              if (component) unmount(component)
              container?.remove()
              cleanupOutsideHandlers?.()
            }
          }
        }
      })
    ]
  }
})
