<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import React from 'react'
  import ReactDOM from 'react-dom/client'
  import { ComponentPacks } from './fields/libs/componentRegistry'
  import { NodeViewWrapper } from 'svelte-tiptap'

  import { FluentProvider, webLightTheme } from '@fluentui/react-components'

  // REQUIRED by SvelteNodeViewRenderer
  export let node: any
  export let editor: any
  export let view: any
  export let getPos: any
  export let decorations: any
  export let selected: boolean
  export let extension: any
  export let updateAttributes: any
  export let deleteNode: any

  let container
  let reactRoot

  const META_KEYS = new Set(['framework', 'pack', 'component'])

  function attrsToProps(attrs: Record<string, any>): Record<string, any> {
    const props: Record<string, any> = {}
    // const props = {}
    for (const key in attrs) {
      if (!META_KEYS.has(key)) {
        props[key] = attrs[key]
      }
    }

    // Fallback: use label as children if children is not provided
    if (props.children == null && props.label != null) {
      props.children = props.label || props.value
    }
    return props
  }
  // const props = attrsToProps(node.attrs)

  // console.log('mouuuunt11 ', props)

  onMount(() => {
    const { framework, pack, component } = node.attrs

    if (framework !== 'react' || !pack || !component) return

    const packModule = ComponentPacks.react[pack]?.()

    if (!packModule) return
    const def = packModule[component]
    if (!def) return
    const Comp = def.component
    // const Comp = packModule[component].component
    const props = def.mapAttrs(node.attrs)
    // const props = attrsToProps(node.attrs)

    console.log('mouuuunt ', props)

    reactRoot = ReactDOM.createRoot(container)
    // reactRoot.render(React.createElement(Comp, props))

    reactRoot.render(
      React.createElement(
        FluentProvider,
        { theme: webLightTheme },
        React.createElement(Comp, props)
      )
    )
  })

  onDestroy(() => {
    reactRoot?.unmount()
  })
</script>

<NodeViewWrapper>
  <div bind:this={container} contenteditable="false"></div>
</NodeViewWrapper>
