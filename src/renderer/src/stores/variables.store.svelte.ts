import * as Y from 'yjs'

export function createVariableStore(
  ydoc: Y.Doc,
  onChange?: (vars: Record<string, any>) => void
) {
  const ymap = ydoc.getMap('variables')

  let variables = $state<Record<string, any>>(ymap.toJSON())

  const notify = () => {
    if (onChange) onChange(variables)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dynadoc:variables:change', { detail: variables }))
    }
  }

  ymap.observe(() => {
    variables = ymap.toJSON()
    notify()
  })

  notify()

  return {
    get all() {
      return variables
    },

    set(key: string, value: any) {
      ymap.set(key, value)
    },

    delete(key: string) {
      ymap.delete(key)
    },

    inject(text: string) {
      return text.replace(/\{\{(.*?)\}\}/g, (_, key) => variables[key.trim()] || `{{${key}}}`)
    }
  }
}
