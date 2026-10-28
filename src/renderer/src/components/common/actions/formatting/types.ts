import type { Component, ComponentType, SvelteComponent } from 'svelte'
import Layout from '../../layout/layout'

export interface GenericFormattingProps {
  __icon?: string
  __iconClass?: string
  __label?: string
  __value?: string
  __labelClass?: string
  __class?: string
  __layout?: keyof typeof Layout.LAYOUT_COMPONENTS
  __direction?: string
  __isActiveFunc?: Function
  __disabled?: boolean
  __description?: string
  __keybinding?: string
  __separator?: boolean
  __onClick?: Function
  __onOtherActions?: {}
  __nodeOrMarkName?: string
  __nodeOrMarkAttributes?: {}
  __selectData?: GenericFormattingProps[] | ComponentType<SvelteComponent> | Component<any>
  __selectDataProps?: Record<string, any>
}

/**
 * A props factory takes partial props (everything optional) and returns full props.
 */
export type GenericFormattingPropsFactory = (
  props: Partial<GenericFormattingProps>
) => GenericFormattingProps

export interface GenericFormattingComponentType {
  component: any
  props: GenericFormattingProps | GenericFormattingPropsFactory
}
