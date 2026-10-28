import { VariableManipulatorUtils } from '../stores/variableManipulator'

type VariableLike = {
  value?: any
  rawValue?: any
}

export function inferVariableType(value: any, explicitType?: string): string {
  if (explicitType) return explicitType
  if (value == null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  if (!isNaN(Number(value))) return 'number'
  if (typeof value === 'string' && value.includes('<p>')) {
    return VariableManipulatorUtils.VAR_TYPE.richtext
  }
  return typeof value
}

function stripHtml(value: string): string {
  if (!value || !value.includes('<')) return value
  const div = document.createElement('div')
  div.innerHTML = value
  return (div.textContent || div.innerText || '').trim()
}

export function getVariableDisplayValue(
  variable: VariableLike | null | undefined,
  options?: { plainText?: boolean }
): string {
  if (!variable) return ''
  const raw = variable.rawValue || {}
  const type = raw.type ?? inferVariableType(variable.value)

  let value = ''
  if (type === VariableManipulatorUtils.VAR_TYPE.file) {
    value = raw.url || variable.value || ''
  } else if (type === VariableManipulatorUtils.VAR_TYPE.folder) {
    value = raw.url || variable.value || ''
  } else if (type === VariableManipulatorUtils.VAR_TYPE.richtext) {
    value = raw.value ?? variable.value ?? ''
  } else if (type === VariableManipulatorUtils.VAR_TYPE.ai) {
    value = raw.value ?? variable.value ?? ''
  } else if (type === VariableManipulatorUtils.VAR_TYPE.text) {
    // Prefer keeping an editable/display formula (e.g. A1 refs) when internal storage
    // uses UUID brace refs for evaluation.
    if (typeof raw.displayFormula === 'string' && raw.displayFormula.trim()) {
      value = raw.displayFormula
    } else {
    value = VariableManipulatorUtils.formatValue(
      variable.value || raw.value,
      raw.format
    )
    }
  } else if (type === VariableManipulatorUtils.VAR_TYPE.datetime) {
    value = VariableManipulatorUtils.formatValue(
      raw.value ?? variable.value,
      raw.format,
      raw.autoUpdate
    )
  } else {
    value = variable.value ?? raw.value ?? ''
  }

  const output = String(value ?? '')
  return options?.plainText ? stripHtml(output) : output
}
