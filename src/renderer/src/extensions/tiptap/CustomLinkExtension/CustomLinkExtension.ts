import Link from '@tiptap/extension-link'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { openLinkPreview } from '../../../stores/linkPreview.store'

const CUSTOM_LINK_PLUGIN_KEY = new PluginKey('customLinkClickHandler')

export const CustomLinkExtension = Link.extend({
  name: 'link',

  addOptions() {
    return {
      ...(this.parent?.() ?? {}),
      openOnClick: false,
      HTMLAttributes: {
        class: 'rm-link',
        rel: 'noopener noreferrer'
      }
    }
  },

  addProseMirrorPlugins() {
    const parent = this.parent?.() ?? []

    return [
      ...parent,
      new Plugin({
        key: CUSTOM_LINK_PLUGIN_KEY,
        props: {
          handleClick: (_view, _pos, event) => {
            const target = event.target as HTMLElement | null
            const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
            if (!anchor) return false

            event.preventDefault()
            event.stopPropagation()

            const href = anchor.getAttribute('href')
            if (!href) return true

            if (event.metaKey || event.ctrlKey) {
              const api = (window as any).api
              if (api?.openExternal) {
                api.openExternal(href)
              } else {
                window.open(href, '_blank')
              }
              return true
            }

            openLinkPreview({
              href,
              x: event.clientX + 8,
              y: event.clientY + 8
            })
            return true
          }
        }
      })
    ]
  }
})

export default CustomLinkExtension
