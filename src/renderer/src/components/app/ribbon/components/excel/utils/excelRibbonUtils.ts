import type { Item } from '../../utils/utils'
import type { GenericFormattingComponentType } from '../../../../../common/actions/formatting/types'
import {
  GenericFormattingComponentMap,
  TableLayoutFormattingMap,
  ExcelFormattingComponentMap
} from '../../../../../common/actions/formatting/GenericFormatingComponentMap'
import GenericFormattingComponent from '../../../../../common/actions/formatting/GenericFormattingComponent.svelte'
import Layout from '../../../../../common/layout/layout'

type RibbonComponentMap = Record<string, GenericFormattingComponentType>

type ItemOptions = {
  icon?: string
  props?: Record<string, any>
}

function wrapIcon(icon: string) {
  return `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${icon}</div>`
}

function createItem(map: RibbonComponentMap, key: string, options?: ItemOptions): Item {
  const config = map[key]
  if (!config) {
    return {
      id: key.toString(),
      variant: 'primary',
      body: {
        component: GenericFormattingComponent,
        props: {
          __icon: `<div class="text-base-content-600 w-[20px] h-[20px] rounded bg-white/10"></div>`,
          __label: key,
          __description: key,
          __layout: Layout.LAYOUT.ICON,
          __disabled: true
        }
      }
    }
  }

  const iconOverride = options?.icon ? { __icon: wrapIcon(options.icon) } : {}
  return {
    id: key.toString(),
    variant: 'primary',
    body: {
      component: config.component,
      props: {
        ...config.props,
        ...iconOverride,
        ...(options?.props ?? {})
      }
    }
  }
}

function isStaticDisabled(config: GenericFormattingComponentType | undefined): boolean {
  if (!config) return true
  const disabled = (config as any)?.props?.__disabled
  return disabled === true
}

export function createGenericItem(
  key: keyof typeof GenericFormattingComponentMap,
  options?: ItemOptions
): Item {
  return createItem(GenericFormattingComponentMap, key.toString(), options)
}

export function createExcelItem(
  key: keyof typeof ExcelFormattingComponentMap,
  options?: ItemOptions
): Item {
  return createItem(ExcelFormattingComponentMap, key.toString(), options)
}

export function createExcelItemSafe(
  key: keyof typeof ExcelFormattingComponentMap,
  options?: ItemOptions
): Item | null {
  const config = ExcelFormattingComponentMap[key.toString()]
  if (isStaticDisabled(config)) return null
  return createItem(ExcelFormattingComponentMap, key.toString(), options)
}

export function createTableItem(
  key: keyof typeof TableLayoutFormattingMap,
  options?: ItemOptions
): Item {
  return createItem(TableLayoutFormattingMap, key.toString(), options)
}
