import type { Variable } from '../stores/variableManipulator'
import { getVariableDisplayValue } from './variableDisplay.utils'

export type VarDropdownItem = {
  id?: string
  name: string
  displayName?: string
  value?: any
  type?: string
  aliases?: string[]
  rawValue?: any
  displayValue?: string
  source?: string
}

export function buildVarDropdownItems(vars: Variable[], query: string): VarDropdownItem[] {
  const needle = (query || '').toLowerCase()
  return (vars || [])
    .map((v) => ({
      id: v.name,
      name: v.rawValue?.name || v.name,
      displayName: v.rawValue?.name || v.name,
      value: v.value,
      type: v.rawValue?.type,
      aliases: v.rawValue?.aliases || [],
      rawValue: v.rawValue,
      displayValue: getVariableDisplayValue(v, { plainText: true }),
      source: v.rawValue?.source || 'user'
    }))
    .filter((v) => {
      if (!needle) return true
      if (v.name?.toLowerCase().includes(needle)) return true
      return v.aliases?.some((alias) => alias?.toLowerCase().includes(needle))
    })
    .sort((a, b) => {
      const aRank = a.source === 'ai' ? 1 : 0
      const bRank = b.source === 'ai' ? 1 : 0
      if (aRank !== bRank) return aRank - bRank
      return (a.displayName || a.name).localeCompare(b.displayName || b.name)
    })
}
