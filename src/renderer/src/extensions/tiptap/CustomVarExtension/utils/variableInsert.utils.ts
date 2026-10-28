type VariableInsertItem = {
  name?: string
  id?: string
  displayName?: string
  value?: any
  displayValue?: string
}

export function formatVariableInsertText(item: VariableInsertItem, template: string): string {
  const displayName = item?.displayName || item?.name || ''
  const id = item?.id || item?.name || ''
  const value = item?.displayValue || item?.value || ''

  if (!template) return String(value)
  if (template === 'name') return displayName
  if (template === 'value') return String(value)
  if (template === '@value') return `@${value}`
  if (template === '@name') return `@${displayName}`
  if (template === '{value}') return `{${value}}`
  if (template === '{name}') return `{${id}}`

  return template
    .replace(/\{value\}/g, String(value))
    .replace(/\{name\}/g, id)
    .replace(/@value/g, `@${value}`)
    .replace(/@name/g, `@${displayName}`)
}
