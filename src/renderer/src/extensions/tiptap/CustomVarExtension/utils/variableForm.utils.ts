import { VariableManipulatorUtils } from '../stores/variableManipulator'

export function normalizeVariableName(name: string): string {
  return name.trim()
}

export function requiresValue(type: string): boolean {
  return ![VariableManipulatorUtils.VAR_TYPE.richtext].includes(type)
}

export function isNameTaken(name: string, vars: { name: string; rawValue?: any }[]): boolean {
  const normalized = name.toLowerCase()
  return vars.some((v) => {
    const displayName = (v?.rawValue?.name || v?.name || '').toLowerCase()
    return displayName === normalized
  })
}

export function buildVariablePayload(
  type: string,
  input: string,
  existingRawValue?: any,
  format?: string,
  autoUpdate?: boolean
) {
  const base = { ...(existingRawValue || {}) }
  const source = base.source || 'user'

  if (type === VariableManipulatorUtils.VAR_TYPE.ai) {
    return { ...base, type, prompt: input, value: input, source }
  }

  if (type === VariableManipulatorUtils.VAR_TYPE.file || type === VariableManipulatorUtils.VAR_TYPE.folder) {
    return { ...base, type, url: input, value: input, source }
  }

  if (type === VariableManipulatorUtils.VAR_TYPE.spreadsheet) {
    return { ...base, type, path: input, value: input, source }
  }

  if (type === VariableManipulatorUtils.VAR_TYPE.datetime) {
    return { ...base, type, value: input, format: format || base.format, autoUpdate, source }
  }

  if (type === VariableManipulatorUtils.VAR_TYPE.richtext) {
    return { ...base, type, value: input, source }
  }

  return { ...base, type, value: input, format: format || base.format, source }
}
