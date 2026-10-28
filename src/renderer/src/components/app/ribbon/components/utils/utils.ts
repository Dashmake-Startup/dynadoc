import type { ComponentType, SvelteComponent } from "svelte"

  export type Item = {
    id: string
    label?: string
    icon?: string
    body?: {
      component: ComponentType<SvelteComponent>
      props?: Record<string, any>
    } | null
    // body?: {ComponentType} | null
    hotkey?: string
    variant?: 'primary' | 'ghost'
    big?: boolean
    // rowspan?: number
    // colspan?: number
    disabled?: boolean
  }

  export type Group = {
    id: string
    title: string
    layout?: string
    items: Item[]
  }