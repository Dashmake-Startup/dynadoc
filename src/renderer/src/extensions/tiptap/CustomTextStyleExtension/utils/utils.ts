export function sentenceCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase())
}

export function toggleCase(text: string): string {
  return text
    .split('')
    .map(c =>
      c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()
    )
    .join('')
}

export function capitalizeWords(text: string): string {
  return text.replace(/\b\w/g, c => c.toUpperCase())
}

function getSelectedText(editor) {
  const { state } = editor
  const { from, to, empty } = state.selection

  if (empty) return ''

  return state.doc.textBetween(from, to, ' ')
}

function isLowerCase(text: string) {
  return text && text === text.toLowerCase()
}

function isUpperCase(text: string) {
  return text && text === text.toUpperCase()
}

function isSentenceCase(text: string) {
  return text === sentenceCase(text)
}

function isCapitalized(text: string) {
  return text === capitalizeWords(text)
}

export type CaseMode =
  | 'sentence'
  | 'lower'
  | 'upper'
  | 'capitalize'
  | 'mixed'
  | null

export function getActiveCaseMode(editor): CaseMode {
  const text = getSelectedText(editor)

  if (!text) return null

  if (isUpperCase(text)) return 'upper'
  if (isLowerCase(text)) return 'lower'
  if (isSentenceCase(text)) return 'sentence'
  if (isCapitalized(text)) return 'capitalize'

  return 'mixed'
}

export const CaseUIState = {
  isSentence: (editor) => getActiveCaseMode(editor) === 'sentence',
  isLower: (editor) => getActiveCaseMode(editor) === 'lower',
  isUpper: (editor) => getActiveCaseMode(editor) === 'upper',
  isCapitalize: (editor) => getActiveCaseMode(editor) === 'capitalize',
  isMixed: (editor) => getActiveCaseMode(editor) === 'mixed',
}
