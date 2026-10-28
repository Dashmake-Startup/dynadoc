import { Extension, mergeAttributes } from '@tiptap/core'
import { TextStyle } from '@tiptap/extension-text-style'
import { capitalizeWords, sentenceCase, toggleCase } from './utils/utils'
// import TextStyle from '@tiptap/extension-text-style'

export interface FontSizeOptions {
  step: number // px increment/decrement (can be fractional)
  defaultSize: string
  allowedSizes: number[] // optional dropdown sizes
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSizeControl: {
      increaseFontSize: () => ReturnType
      decreaseFontSize: () => ReturnType
      //   setFontSize: (size: string) => ReturnType
      //   unsetFontSize: () => ReturnType
      setNextAllowedSize: (direction: 'up' | 'down') => ReturnType
      clearAllFormatting: () => ReturnType
    }
    textStyle: {
      toggleBold: () => ReturnType
      toggleItalic: () => ReturnType
      toggleUnderline: () => ReturnType
      _setUnderline: (attributes?: {
        style?: 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy' | 'thick'
        color?: string | null
      }) => ReturnType
      // setUnderliness:  (attributes?: {
      //   style?: 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy' | 'thick'
      //   color?: string | null
      // }) => ReturnType
      toggleStrike: () => ReturnType
      toggleSuperscript: () => ReturnType
      toggleSubscript: () => ReturnType
    }
  }
}

export const CustomFontSizeExtension = Extension.create<FontSizeOptions>({
  name: 'CustomFontSizeExtension',

  addOptions() {
    return {
      step: 1,
      defaultSize: '14px',
      allowedSizes: [8, 10, 12, 14, 16, 18, 24, 36, 48]
    }
  },

  addCommands() {
    const apply = (transform: (text: string) => string) => {
      return ({ state, chain }) => {
        const { from, to, empty } = state.selection

        if (empty) return false

        const text = state.doc.textBetween(from, to, '\n')
        const transformed = transform(text)

        // return
        //  chain()
        // .insertContentAt({ from, to }, transformed)
        // .run()

        const newTo = from + transformed.length

        return chain()
          .insertContentAt({ from, to }, transformed)
          .setTextSelection({ from, to: newTo })
          .run()

        // return true
      }
    }

    return {
      changeCaseSentence: () => apply(sentenceCase),

      changeCaseLower: () => apply((text) => text.toLowerCase()),

      changeCaseUpper: () => apply((text) => text.toUpperCase()),

      changeCaseToggle: () => apply(toggleCase),

      changeCaseCapitalize: () => apply(capitalizeWords),
      /* setFontSize:
              (size: string) =>
              ({ commands }) => {
                return commands.setMark('textStyle', { fontSize: size })
              },
      
            unsetFontSize:
              () =>
              ({ commands }) => {
                return commands.unsetMark('textStyle', { fontSize: null })
              }, */

      /* increaseFontSize:
                (_step?: number) =>
                    ({ state, commands }) => {
                        let { step, defaultSize } = this.options
                        if (_step) { step = _step }
                        const currentMark = state.storedMarks?.find(mark => mark.type.name === 'textStyle')
                        const currentSize = currentMark?.attrs.fontSize || defaultSize
                        const newSize = `${parseInt(currentSize) + step}px`
                        return commands.setMark('textStyle', { fontSize: newSize })
                    },

            decreaseFontSize:
                (_step?: number) =>
                    ({ state, commands }) => {
                        let { step, defaultSize } = this.options
                        if (_step) { step = _step }
                        const currentMark = state.storedMarks?.find(mark => mark.type.name === 'textStyle')
                        const currentSize = currentMark?.attrs.fontSize || defaultSize
                        let newSize = parseInt(currentSize) - step
                        if (newSize < 1) newSize = 1
                        return commands.setMark('textStyle', { fontSize: `${newSize}px` })
                    }, */
      increaseFontSize:
        () =>
        ({ state, commands }) => {
          console.log('top increaseFontSize 1')

          const current = getCurrentFontSize(state, this.options.defaultSize)
          const newSize = current + this.options.step
          return commands.setMark('textStyle', { fontSize: `${newSize}px` })
        },

      decreaseFontSize:
        () =>
        ({ state, commands }) => {
          console.log('top decreaseFontSize 1')

          let current = getCurrentFontSize(state, this.options.defaultSize)
          let newSize = current - this.options.step
          if (newSize < 1) newSize = 1
          return commands.setMark('textStyle', { fontSize: `${newSize}px` })
        },

      setNextAllowedSize:
        (direction: 'up' | 'down') =>
        ({ state, commands }) => {
          const { allowedSizes } = this.options
          let current = getCurrentFontSize(state, parseInt(this.options.defaultSize))
          let newSize = current

          if (direction === 'up') {
            for (const size of allowedSizes) {
              if (size > current) {
                newSize = size
                break
              }
            }
          } else {
            for (let i = allowedSizes.length - 1; i >= 0; i--) {
              if (allowedSizes[i] < current) {
                newSize = allowedSizes[i]
                break
              }
            }
          }

          return commands.setMark('textStyle', { fontSize: `${newSize}px` })
        },
      clearAllFormatting:
        () =>
        ({ state, commands }) => {
          const { from, to } = state.selection

          // 1. Remove all marks in selection
          commands.unsetAllMarks()

          // 2. Normalize block nodes if needed
          // This will turn things like headings, blockquotes, lists etc into paragraphs
          commands.clearNodes()

          // Focus or cursor reset if needed
          return true
        }
    }
  }
})

// Helper to get current font size (selection or cursor)
function getCurrentFontSize(state: any, defaultSize: string | number): number {
  let size: number | null = null
  const { from, to } = state.selection

  if (from === to && !state.storedMarks?.length) {
    size = typeof defaultSize === 'string' ? parseFloat(defaultSize) : defaultSize
  } else {
    state.doc.nodesBetween(from, to, (node) => {
      node.marks.forEach((mark) => {
        if (mark.type.name === 'textStyle' && mark.attrs.fontSize) {
          const markSize = parseFloat(mark.attrs.fontSize)
          if (size === null || markSize > size) size = markSize
        }
      })
    })
    if (size === null)
      size = typeof defaultSize === 'string' ? parseFloat(defaultSize) : defaultSize
  }

  return size
}

type AttrMap = Record<string, string>
type StyleMap = Record<string, string>

type TextStyleAttrs = {
  fontWeight: string | null
  fontStyle: string | null
  textDecoration: string | null
  underlineStyle: string | null
  underlineColor: string | null
  underlineThickness: string | null
  color: string | null
  backgroundColor: string | null
  fontSize: string | null
  fontFamily: string | null
  letterSpacing: string | null
  verticalAlign: string | null
  dataAttrs: AttrMap | null
}

const LEGACY_TEXT_ATTRS = [
  'fontweight',
  'fontstyle',
  'textdecoration',
  'fontsize',
  'fontfamily',
  'backgroundcolor',
  'letterspacing',
  'verticalalign',
  'color'
]

const parseStyleText = (styleText: string | undefined | null): StyleMap => {
  if (!styleText) return {}
  const map: StyleMap = {}
  for (const part of styleText.split(';')) {
    const [rawKey, ...rest] = part.split(':')
    if (!rawKey || !rest.length) continue
    const key = rawKey.trim().toLowerCase()
    const value = rest.join(':').trim()
    if (!key || !value) continue
    map[key] = value
  }
  return map
}

const styleMapToText = (styleMap: StyleMap): string => {
  return Object.entries(styleMap)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ')
}

const collectAttributes = (element: HTMLElement): AttrMap | null => {
  const attrs: AttrMap = {}
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name
    const value = attr.value
    if (!name) continue
    if (/^on/i.test(name)) continue
    if ((name === 'href' || name === 'src') && /^\\s*javascript:/i.test(value)) {
      continue
    }
    attrs[name] = value
  }
  return Object.keys(attrs).length ? attrs : null
}

const mergeDataAttrs = (HTMLAttributes: Record<string, any>) => {
  const merged = { ...HTMLAttributes }
  const dataAttrs = merged.dataAttrs
  delete merged.dataAttrs
  if (dataAttrs && typeof dataAttrs === 'object') {
    Object.assign(merged, dataAttrs)
  }
  Object.keys(merged).forEach((key) => {
    if (merged[key] === '' || merged[key] === null || merged[key] === undefined) {
      delete merged[key]
    }
  })
  return merged
}

const normalizeTextDecoration = (value: string | null | undefined): string => {
  if (!value) return ''
  return value
    .split(/\\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' ')
}

const addTextDecoration = (base: string, addition: string): string => {
  const existing = new Set(normalizeTextDecoration(base).split(/\\s+/).filter(Boolean))
  addition
    .split(/\\s+/)
    .filter(Boolean)
    .forEach((entry) => existing.add(entry))
  return Array.from(existing).join(' ')
}

const removeTextDecoration = (base: string, removal: string): string => {
  const existing = new Set(normalizeTextDecoration(base).split(/\\s+/).filter(Boolean))
  removal
    .split(/\\s+/)
    .filter(Boolean)
    .forEach((entry) => existing.delete(entry))
  return Array.from(existing).join(' ')
}

const isBoldValue = (value: string | null | undefined): boolean => {
  if (!value) return false
  if (value === 'bold' || value === 'bolder') return true
  const numeric = Number.parseInt(value, 10)
  return Number.isFinite(numeric) && numeric >= 600
}

const isItalicValue = (value: string | null | undefined): boolean => {
  if (!value) return false
  return value === 'italic' || value === 'oblique'
}

const normalizeFontSizeFromHtml = (sizeValue: string | null): string | null => {
  if (!sizeValue) return null
  const numeric = Number.parseInt(sizeValue, 10)
  if (!Number.isFinite(numeric)) return null
  const map: Record<number, string> = {
    1: '8pt',
    2: '10pt',
    3: '12pt',
    4: '14pt',
    5: '18pt',
    6: '24pt',
    7: '36pt'
  }
  return map[numeric] ?? null
}

const extractTextStyleAttrs = (
  element: HTMLElement,
  extra: Partial<TextStyleAttrs> = {}
): Partial<TextStyleAttrs> => {
  const dataAttrs = collectAttributes(element) || undefined
  const style = parseStyleText(dataAttrs?.style || element.getAttribute('style'))
  const legacyFontWeight = dataAttrs?.fontweight || element.getAttribute('fontweight') || undefined
  const legacyFontStyle = dataAttrs?.fontstyle || element.getAttribute('fontstyle') || undefined
  const legacyTextDecoration =
    dataAttrs?.textdecoration || element.getAttribute('textdecoration') || undefined
  const legacyFontSize = dataAttrs?.fontsize || element.getAttribute('fontsize') || undefined
  const legacyFontFamily = dataAttrs?.fontfamily || element.getAttribute('fontfamily') || undefined
  const legacyBackgroundColor =
    dataAttrs?.backgroundcolor || element.getAttribute('backgroundcolor') || undefined
  const legacyLetterSpacing =
    dataAttrs?.letterspacing || element.getAttribute('letterspacing') || undefined
  const legacyVerticalAlign =
    dataAttrs?.verticalalign || element.getAttribute('verticalalign') || undefined
  const legacyColor = dataAttrs?.color || element.getAttribute('color') || undefined
  const baseDecoration = style['text-decoration'] || style['text-decoration-line'] || ''
  const extraDecoration = extra.textDecoration || ''
  const mergedDecoration = extraDecoration
    ? addTextDecoration(baseDecoration, extraDecoration)
    : baseDecoration

  const attrs: Partial<TextStyleAttrs> = {
    dataAttrs,
    fontWeight: style['font-weight'] || legacyFontWeight || extra.fontWeight || undefined,
    fontStyle: style['font-style'] || legacyFontStyle || extra.fontStyle || undefined,
    textDecoration: mergedDecoration || legacyTextDecoration || undefined,
    underlineStyle: style['text-decoration-style'] || undefined,
    underlineColor: style['text-decoration-color'] || undefined,
    underlineThickness: style['text-decoration-thickness'] || undefined,
    color: style.color || legacyColor || extra.color || undefined,
    backgroundColor:
      style['background-color'] || legacyBackgroundColor || extra.backgroundColor || undefined,
    fontSize: style['font-size'] || legacyFontSize || extra.fontSize || undefined,
    fontFamily: style['font-family'] || legacyFontFamily || extra.fontFamily || undefined,
    letterSpacing:
      style['letter-spacing'] || legacyLetterSpacing || extra.letterSpacing || undefined,
    verticalAlign:
      style['vertical-align'] || legacyVerticalAlign || extra.verticalAlign || undefined
  }

  return Object.fromEntries(
    Object.entries(attrs).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  )
}

const hasTextStyleCarrier = (element: HTMLElement | null): boolean => {
  if (!element) return false
  const tag = element.tagName?.toLowerCase()
  if (tag !== 'span' && tag !== 'font') return false
  if (element.getAttribute('style')) return true
  return LEGACY_TEXT_ATTRS.some((attr) => element.hasAttribute(attr))
}

export const CustomTextStyleExtension = TextStyle.extend({
  name: 'textStyle',

  addAttributes() {
    return {
      fontWeight: { default: null },
      fontStyle: { default: null },
      textDecoration: { default: null },
      underlineStyle: { default: null },
      underlineColor: { default: null },
      underlineThickness: { default: null },
      color: { default: null },
      backgroundColor: { default: null },
      fontSize: { default: null },
      fontFamily: { default: null },
      letterSpacing: { default: null },
      verticalAlign: { default: null },
      dataAttrs: {
        default: null,
        parseHTML: (element) => collectAttributes(element as HTMLElement),
        renderHTML: (attrs) => attrs?.dataAttrs || {}
      }
    }
  },

  parseHTML() {
    const fromStyleTag = (tag: string, extra: Partial<TextStyleAttrs> = {}) => ({
      tag,
      getAttrs: (element: HTMLElement) => {
        if (tag === 'span' && element.hasAttribute('data-word-comment-id')) return false
        if (tag === 'u' && hasTextStyleCarrier(element.parentElement)) {
          // Merge underline into parent styles to avoid dropping existing attrs.
          return extractTextStyleAttrs(element.parentElement as HTMLElement, {
            textDecoration: 'underline'
          })
        }
        return extractTextStyleAttrs(element, extra)
      }
    })

    return [
      fromStyleTag('span'),
      fromStyleTag('strong', { fontWeight: 'bold' }),
      fromStyleTag('b', { fontWeight: 'bold' }),
      fromStyleTag('em', { fontStyle: 'italic' }),
      fromStyleTag('i', { fontStyle: 'italic' }),
      fromStyleTag('u', { textDecoration: 'underline' }),
      fromStyleTag('s', { textDecoration: 'line-through' }),
      fromStyleTag('strike', { textDecoration: 'line-through' }),
      fromStyleTag('del', { textDecoration: 'line-through' }),
      fromStyleTag('sup', { verticalAlign: 'super' }),
      fromStyleTag('sub', { verticalAlign: 'sub' }),
      {
        tag: 'font',
        getAttrs: (element: HTMLElement) => {
          const extra: Partial<TextStyleAttrs> = {}
          const color = element.getAttribute('color')
          const face = element.getAttribute('face')
          const size = element.getAttribute('size')
          if (color) extra.color = color
          if (face) extra.fontFamily = face
          const normalizedSize = normalizeFontSizeFromHtml(size)
          if (normalizedSize) extra.fontSize = normalizedSize
          return extractTextStyleAttrs(element, extra)
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const merged = mergeDataAttrs(HTMLAttributes)
    const dataAttrs = (HTMLAttributes?.dataAttrs as AttrMap) || null
    const styleMap = parseStyleText(dataAttrs?.style || merged.style)

    const applyOrRemove = (key: string, value: string | null | undefined) => {
      if (value === null || value === undefined || value === '') {
        delete styleMap[key]
      } else {
        styleMap[key] = value
      }
    }

    applyOrRemove('font-weight', HTMLAttributes.fontWeight)
    applyOrRemove('font-style', HTMLAttributes.fontStyle)
    if (HTMLAttributes.textDecoration) {
      applyOrRemove('text-decoration', normalizeTextDecoration(HTMLAttributes.textDecoration))
    } else if (HTMLAttributes.textDecoration === null) {
      delete styleMap['text-decoration']
      delete styleMap['text-decoration-line']
    }
    applyOrRemove('text-decoration-style', HTMLAttributes.underlineStyle)
    applyOrRemove('text-decoration-color', HTMLAttributes.underlineColor)
    applyOrRemove('text-decoration-thickness', HTMLAttributes.underlineThickness)
    applyOrRemove('color', HTMLAttributes.color)
    applyOrRemove('background-color', HTMLAttributes.backgroundColor)
    applyOrRemove('font-size', HTMLAttributes.fontSize)
    applyOrRemove('font-family', HTMLAttributes.fontFamily)
    applyOrRemove('letter-spacing', HTMLAttributes.letterSpacing)
    applyOrRemove('vertical-align', HTMLAttributes.verticalAlign)

    if (dataAttrs && dataAttrs.style) {
      delete merged.style
    }

    const finalStyle = styleMapToText(styleMap)
    if (finalStyle) {
      merged.style = finalStyle
    } else {
      delete merged.style
    }

    for (const legacyAttr of LEGACY_TEXT_ATTRS) {
      delete merged[legacyAttr]
    }

    return ['span', mergeAttributes(this.options.HTMLAttributes, merged), 0]
  },

  addCommands() {
    const getTextStyleAttrs = (state: any): TextStyleAttrs => {
      const stored = state?.storedMarks?.find((mark: any) => mark.type.name === 'textStyle')?.attrs
      if (stored) return stored as TextStyleAttrs
      const marksAtCursor = state?.selection?.$from?.marks?.() || []
      const mark = marksAtCursor.find((m: any) => m.type.name === 'textStyle')
      return (mark?.attrs || {}) as TextStyleAttrs
    }

    // A toolbar toggle must consider the whole selected range. Looking only at
    // `$from.marks()` fails whenever the range starts at a mark boundary, so a
    // second click can incorrectly apply the style again instead of removing
    // it. Mixed selections intentionally resolve to "apply" (the usual word
    // processor behaviour); fully styled selections resolve to "remove".
    const selectionFullyMatches = (
      state: any,
      matches: (attrs: TextStyleAttrs) => boolean
    ): boolean => {
      const { from, to, empty } = state.selection
      if (empty) return matches(getTextStyleAttrs(state))

      let hasText = false
      let allTextMatches = true
      state.doc.nodesBetween(from, to, (node: any) => {
        if (!node.isText) return
        hasText = true
        const mark = node.marks?.find((item: any) => item.type.name === 'textStyle')
        if (!matches((mark?.attrs || {}) as TextStyleAttrs)) {
          allTextMatches = false
        }
      })

      return hasText && allTextMatches
    }

    const toggleFontWeight = ({ state, commands }: any) => {
      console.log('top toggleFontWeight 11')

      const isBold = selectionFullyMatches(state, (attrs) => isBoldValue(attrs.fontWeight))
      return commands.setMark('textStyle', { fontWeight: isBold ? null : 'bold' })
    }

    const toggleFontStyle = ({ state, commands }: any) => {
      const isItalic = selectionFullyMatches(state, (attrs) => isItalicValue(attrs.fontStyle))
      return commands.setMark('textStyle', { fontStyle: isItalic ? null : 'italic' })
    }

    const toggleDecoration =
      (token: string) =>
      ({ state, commands }: any) => {
        console.log('top toggleDecoration')

        const attrs = getTextStyleAttrs(state)
        const current = normalizeTextDecoration(attrs.textDecoration || '')
        const hasDecoration = selectionFullyMatches(state, (selectionAttrs) =>
          normalizeTextDecoration(selectionAttrs.textDecoration || '').includes(token)
        )
        const next = hasDecoration
          ? removeTextDecoration(current, token)
          : addTextDecoration(current, token)
        const isUnderline = token === 'underline'
        return commands.setMark('textStyle', {
          textDecoration: next || null,
          ...(isUnderline && !next.includes('underline')
            ? { underlineStyle: null, underlineColor: null, underlineThickness: null }
            : {})
        })
      }

    const _setUnderline =
      (
        attributes: {
          style?: 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy' | 'thick'
          color?: string | null
        } = {}
      ) =>
      ({ state, commands }: any) => {
        console.log('_setUnderline here', attributes)
        const attrs = getTextStyleAttrs(state)
        const style =
          attributes.style ?? (attrs.underlineThickness ? 'thick' : attrs.underlineStyle) ?? 'solid'
        const decorationStyle = style === 'thick' ? 'solid' : style
        return commands.setMark('textStyle', {
          textDecoration: addTextDecoration(
            normalizeTextDecoration(attrs.textDecoration || ''),
            'underline'
          ),
          underlineStyle: decorationStyle,
          underlineColor: attributes.color ?? attrs.underlineColor ?? null,
          underlineThickness: style === 'thick' ? '2px' : null
        })
      }

    const toggleVerticalAlign =
      (value: 'super' | 'sub') =>
      ({ state, commands }: any) => {
        console.log('top toggleVerticalAlign')
        const isActive = selectionFullyMatches(state, (attrs) => attrs.verticalAlign === value)
        const next = isActive ? null : value
        return commands.setMark('textStyle', { verticalAlign: next })
      }

    return {
      toggleBold: () => (props: any) => toggleFontWeight(props),
      toggleItalic: () => (props: any) => toggleFontStyle(props),
      toggleUnderline: () => (props: any) => toggleDecoration('underline')(props),
      _setUnderline: (attributes) => (props: any) => _setUnderline(attributes)(props),
      // setUnderliness: (attributes) => (props: any) => _setUnderline(attributes)(props),
      toggleStrike: () => (props: any) => toggleDecoration('line-through')(props),
      toggleSuperscript: () => (props: any) => toggleVerticalAlign('super')(props),
      toggleSubscript: () => (props: any) => toggleVerticalAlign('sub')(props)
    }
  }
})
