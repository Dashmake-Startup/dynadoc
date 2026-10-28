// hyperVariableEngine.js
import HyperFormula, { type CellValue } from 'hyperformula'
import { FormulaTranslator, Registry, SyncManager } from './variableEngine'
import { get } from 'svelte/store'
import { nodeApi } from '../../../../utils/shims/node'
// import { _$_activeDocumentVars, computedVars } from './vars.store'
import { _$_documentEditorsList } from '../../../../stores/editor.store'
import { sheetRegistry } from '../../../../stores/sheetBridge.store'
import { Node, mergeAttributes, InputRule, Editor } from '@tiptap/core'
import SSF from 'ssf'
// import { persistStore } from '../../../../../utils/storePersistenceePersistence'
import Utils from '../../../../utils/Utils'
import { runAI } from '../../CustomAIExtension/utils/utils'
import type { DocumentEditorModel } from '../../../../models/Document'
import EditorHelpers from '../../../../utils/EditorHelpers'
import { CustomVarExtensionProps } from '../utils/common.utils'
import { v4 as uuidv4 } from 'uuid'
// import Utils from '../../../../../utils/Utils/utils/Utils'

// const  fs = (window as any)?.node?.fs || null
// const  path = (window as any)?.node?.path || null

// In-memory stacks
// --- Stacks ---
const undoStack = []
const redoStack = []

export class VariableManipulatorUtils {
  static sheetName = 'VarSheet'
  static VAR_UPDATE_TYPE = {
    value: 'value',
    name: 'name',
    delete: 'delete'
  }
  static VAR_TYPE = {
    text: 'text',
    file: 'file',
    folder: 'folder',
    richtext: 'richtext',
    ai: 'ai',
    datetime: 'datetime',
    spreadsheet: 'spreadsheet'
  } as const
  static VAR_LABELS = {
    text: 'Text',
    ai: 'AI Prompt',
    file: 'File',
    folder: 'Folder',
    richtext: 'Rich Text',
    datetime: 'Date & Time',
    spreadsheet: 'Spreadsheet'
  } as const

  //     static VAR_TYPE = {
  //     text: 'text',
  //     file: 'file',
  //     folder: 'folder',
  //     richtext: 'richtext',
  //     ai: 'ai',
  //     datetime: 'datetime',
  //     number: 'number', // Added for Excel-like formatting
  // } as const;

  // static VAR_LABELS = {
  //     text: 'Text',
  //     ai: 'AI Prompt',
  //     file: 'File',
  //     folder: 'Folder',
  //     richtext: 'Rich Text',
  //     datetime: 'Date/Time',
  //     number: 'Number/Format',
  // } as const;

  /* static EXCEL_FORMATS = {
        NONE: 'none',
        CURRENCY_USD: 'currency_usd',
        CURRENCY_EUR: 'currency_eur',
        PERCENT: 'percent',
        DATE_SHORT: 'date_short',
        DATE_LONG: 'date_long',
        TIME: 'time',
        SCIENTIFIC: 'scientific',
        ACCOUNTING: 'accounting'
    } as const; */

  // static FORMAT_LABELS = {
  //     none: 'General',
  //     currency_usd: 'Currency ($)',
  //     currency_eur: 'Currency (€)',
  //     percent: 'Percentage (%)',
  //     date_short: 'Short Date (m/d/yy)',
  //     date_long: 'Long Date (mmm d, yyyy)',
  //     time: 'Time (h:mm AM/PM)',
  //     scientific: 'Scientific',
  //     accounting: 'Accounting'
  // };
  // Persistent file name
  static VAR_STACK_FILE_NAME = 'undo_redo_stack.json'
  static MAX_STACK_LENGTH = 100

  // like {C1} or {B2}...
  // static FORMULA_VAR_REGEX = = new RegExp(`\\b${escapeRegex(vName)}\\b`, 'g')
  // like {varName} or {var Name}...
  // static VAR_REGEX = new RegExp(`\\{${escapeRegex(vName)}\\}`, 'g')

  // Standard Excel Format IDs
  static EXCEL_FORMATS = {
    // General
    GENERAL: 'General',

    // Number
    NUMBER_INT: '0',
    NUMBER_DEC: '0.00',
    NUMBER_COMMA: '#,##0.00',
    NUMBER_COMMA_INT: '#,##0',

    // Currency
    CURRENCY_USD: '"$"#,##0.00',
    CURRENCY_USD_NEG: '"$"#,##0.00;[Red]"$"#,##0.00',
    CURRENCY_EUR: '#,##0.00"€"',
    CURRENCY_GBP: '£#,##0.00',
    CURRENCY_JPY: '¥#,##0',
    CURRENCY_CAD: '"C$"#,##0.00',
    CURRENCY_AUD: '"A$"#,##0.00',
    CURRENCY_CHF: '"CHF "#,##0.00',
    CURRENCY_CNY: '"¥"#,##0.00',
    CURRENCY_INR: '"₹"#,##0.00',

    // Accounting
    ACCOUNTING: '_("$"* #,##0.00_);_("$"* (#,##0.00);_("$"* "-"??_);_(@_)',

    // Date
    DATE_SHORT: 'm/d/yy',
    DATE_MED: 'd-mmm-yy',
    DATE_LONG: 'mmmm d, yyyy',
    DATE_ISO: 'yyyy-mm-dd',

    // Time
    TIME_12H: 'h:mm AM/PM',
    TIME_24H: 'HH:mm',
    TIME_FULL: 'h:mm:ss AM/PM',
    DATETIME: 'm/d/yy h:mm AM/PM',

    // Percentage
    PERCENT_INT: '0%',
    PERCENT_DEC: '0.00%',

    // Scientific & Fraction
    SCIENTIFIC: '0.00E+00',
    FRACTION: '# ?/?',
    FRACTION_PRECISION: '# ??/??',

    // Special
    TEXT: '@'
  } as const

  static FORMAT_LABELS = {
    // General
    GENERAL: 'General (No specific format)',

    // Numbers
    NUMBER_INT: 'Number (Integer)',
    NUMBER_DEC: 'Number (2 Decimal)',
    NUMBER_COMMA: 'Number (1,000.00)',
    NUMBER_COMMA_INT: 'Number (1,000)',

    // Currency
    CURRENCY_USD: 'Currency (USD $)',
    CURRENCY_USD_NEG: 'Currency (USD Red Negatives)',
    CURRENCY_EUR: 'Currency (EUR €)',
    CURRENCY_GBP: 'Currency (GBP £)',
    CURRENCY_JPY: 'Currency (JPY ¥)',
    CURRENCY_CAD: 'Currency (CAD C$)',
    CURRENCY_AUD: 'Currency (AUD A$)',
    CURRENCY_CHF: 'Currency (CHF)',
    CURRENCY_CNY: 'Currency (CNY ¥)',
    CURRENCY_INR: 'Currency (INR ₹)',

    // Accounting
    ACCOUNTING: 'Accounting',

    // Dates
    DATE_SHORT: 'Short Date (12/31/25)',
    DATE_MED: 'Medium Date (31-Dec-25)',
    DATE_LONG: 'Long Date (December 31, 2025)',
    DATE_ISO: 'ISO Date (2025-12-31)',

    // Time
    TIME_12H: 'Time (1:30 PM)',
    TIME_24H: 'Time (13:30)',
    TIME_FULL: 'Time (1:30:45 PM)',
    DATETIME: 'Date & Time',

    // Percents
    PERCENT_INT: 'Percentage (0%)',
    PERCENT_DEC: 'Percentage (0.00%)',

    // Science/Math
    SCIENTIFIC: 'Scientific',
    FRACTION: 'Fraction (1/2)',
    FRACTION_PRECISION: 'Fraction (Precision)',

    // Text
    TEXT: 'Text (Plain string)'
  } as const

  static POPULAR_FORMAT_KEYS = [
    'GENERAL',
    'NUMBER_DEC',
    'NUMBER_COMMA',
    'CURRENCY_USD',
    'CURRENCY_EUR',
    'PERCENT_DEC',
    'DATE_SHORT',
    'DATE_LONG',
    'TIME_12H',
    'DATETIME',
    'TEXT'
  ] as const

  static FORMAT_CATEGORIES = [
    {
      id: 'general',
      label: 'General',
      items: [{ key: 'GENERAL', label: 'General', format: 'General' }]
    },
    {
      id: 'number',
      label: 'Number',
      items: [
        { key: 'NUMBER_INT', label: 'Number (Integer)', format: '0' },
        { key: 'NUMBER_DEC', label: 'Number (2 Decimal)', format: '0.00' },
        { key: 'NUMBER_COMMA_INT', label: 'Number (1,000)', format: '#,##0' },
        { key: 'NUMBER_COMMA', label: 'Number (1,000.00)', format: '#,##0.00' }
      ]
    },
    {
      id: 'currency',
      label: 'Currency',
      items: [
        { key: 'CURRENCY_USD', label: 'USD ($)', format: '"$"#,##0.00' },
        {
          key: 'CURRENCY_USD_NEG',
          label: 'USD (Red Negatives)',
          format: '"$"#,##0.00;[Red]"$"#,##0.00'
        },
        { key: 'CURRENCY_EUR', label: 'EUR (€)', format: '#,##0.00"€"' },
        { key: 'CURRENCY_GBP', label: 'GBP (£)', format: '£#,##0.00' },
        { key: 'CURRENCY_JPY', label: 'JPY (¥)', format: '¥#,##0' },
        { key: 'CURRENCY_CAD', label: 'CAD (C$)', format: '"C$"#,##0.00' },
        { key: 'CURRENCY_AUD', label: 'AUD (A$)', format: '"A$"#,##0.00' },
        { key: 'CURRENCY_CHF', label: 'CHF', format: '"CHF "#,##0.00' },
        { key: 'CURRENCY_CNY', label: 'CNY (¥)', format: '"¥"#,##0.00' },
        { key: 'CURRENCY_INR', label: 'INR (₹)', format: '"₹"#,##0.00' }
      ]
    },
    {
      id: 'accounting',
      label: 'Accounting',
      items: [
        {
          key: 'ACCOUNTING',
          label: 'Accounting',
          format: '_("$"* #,##0.00_);_("$"* (#,##0.00);_("$"* "-"??_);_(@_)'
        }
      ]
    },
    {
      id: 'date',
      label: 'Date',
      items: [
        { key: 'DATE_SHORT', label: 'Short Date (12/31/25)', format: 'm/d/yy' },
        { key: 'DATE_MED', label: 'Medium Date (31-Dec-25)', format: 'd-mmm-yy' },
        { key: 'DATE_LONG', label: 'Long Date (December 31, 2025)', format: 'mmmm d, yyyy' },
        { key: 'DATE_ISO', label: 'ISO Date (2025-12-31)', format: 'yyyy-mm-dd' }
      ]
    },
    {
      id: 'time',
      label: 'Time',
      items: [
        { key: 'TIME_12H', label: 'Time (1:30 PM)', format: 'h:mm AM/PM' },
        { key: 'TIME_24H', label: 'Time (13:30)', format: 'HH:mm' },
        { key: 'TIME_FULL', label: 'Time (1:30:45 PM)', format: 'h:mm:ss AM/PM' },
        { key: 'DATETIME', label: 'Date & Time', format: 'm/d/yy h:mm AM/PM' }
      ]
    },
    {
      id: 'percentage',
      label: 'Percentage',
      items: [
        { key: 'PERCENT_INT', label: 'Percentage (0%)', format: '0%' },
        { key: 'PERCENT_DEC', label: 'Percentage (0.00%)', format: '0.00%' }
      ]
    },
    {
      id: 'scientific',
      label: 'Scientific',
      items: [{ key: 'SCIENTIFIC', label: 'Scientific', format: '0.00E+00' }]
    },
    {
      id: 'fraction',
      label: 'Fraction',
      items: [
        { key: 'FRACTION', label: 'Fraction (1/2)', format: '# ?/?' },
        { key: 'FRACTION_PRECISION', label: 'Fraction (Precision)', format: '# ??/??' }
      ]
    },
    {
      id: 'text',
      label: 'Text',
      items: [{ key: 'TEXT', label: 'Text (Plain string)', format: '@' }]
    }
  ] as const

  static FORMAT_LOCALES = [
    {
      code: 'en-US',
      label: 'English (US)',
      decimal: '.',
      thousand: ',',
      currencySymbol: '$'
    },
    {
      code: 'en-GB',
      label: 'English (UK)',
      decimal: '.',
      thousand: ',',
      currencySymbol: '£'
    },
    {
      code: 'en-CA',
      label: 'English (Canada)',
      decimal: '.',
      thousand: ',',
      currencySymbol: 'C$'
    },
    {
      code: 'en-AU',
      label: 'English (Australia)',
      decimal: '.',
      thousand: ',',
      currencySymbol: 'A$'
    },
    {
      code: 'fr-FR',
      label: 'Français (FR)',
      decimal: ',',
      thousand: ' ',
      currencySymbol: '€'
    },
    {
      code: 'de-DE',
      label: 'Deutsch (DE)',
      decimal: ',',
      thousand: '.',
      currencySymbol: '€'
    },
    {
      code: 'es-ES',
      label: 'Español (ES)',
      decimal: ',',
      thousand: '.',
      currencySymbol: '€'
    },
    {
      code: 'it-IT',
      label: 'Italiano (IT)',
      decimal: ',',
      thousand: '.',
      currencySymbol: '€'
    },
    {
      code: 'pt-BR',
      label: 'Português (BR)',
      decimal: ',',
      thousand: '.',
      currencySymbol: 'R$'
    },
    {
      code: 'nl-NL',
      label: 'Nederlands (NL)',
      decimal: ',',
      thousand: '.',
      currencySymbol: '€'
    },
    {
      code: 'sv-SE',
      label: 'Svenska (SE)',
      decimal: ',',
      thousand: ' ',
      currencySymbol: 'kr'
    },
    {
      code: 'pl-PL',
      label: 'Polski (PL)',
      decimal: ',',
      thousand: ' ',
      currencySymbol: 'zł'
    },
    {
      code: 'ru-RU',
      label: 'Русский (RU)',
      decimal: ',',
      thousand: ' ',
      currencySymbol: '₽'
    },
    {
      code: 'tr-TR',
      label: 'Türkçe (TR)',
      decimal: ',',
      thousand: '.',
      currencySymbol: '₺'
    },
    {
      code: 'zh-CN',
      label: '中文 (CN)',
      decimal: '.',
      thousand: ',',
      currencySymbol: '¥'
    },
    {
      code: 'ja-JP',
      label: '日本語 (JP)',
      decimal: '.',
      thousand: ',',
      currencySymbol: '¥'
    },
    {
      code: 'ko-KR',
      label: '한국어 (KR)',
      decimal: '.',
      thousand: ',',
      currencySymbol: '₩'
    },
    {
      code: 'hi-IN',
      label: 'हिंदी (IN)',
      decimal: '.',
      thousand: ',',
      currencySymbol: '₹'
    },
    {
      code: 'id-ID',
      label: 'Bahasa (ID)',
      decimal: ',',
      thousand: '.',
      currencySymbol: 'Rp'
    },
    {
      code: 'th-TH',
      label: 'ไทย (TH)',
      decimal: '.',
      thousand: ',',
      currencySymbol: '฿'
    },
    {
      code: 'vi-VN',
      label: 'Tiếng Việt (VN)',
      decimal: ',',
      thousand: '.',
      currencySymbol: '₫'
    },
    {
      code: 'ar-EG',
      label: 'العربية (EG)',
      decimal: '.',
      thousand: ',',
      currencySymbol: 'ج.م'
    },
    {
      code: 'ar-SA',
      label: 'العربية (SA)',
      decimal: '.',
      thousand: ',',
      currencySymbol: 'ر.س'
    }
  ] as const

  static getFormatLabel(format: string): string | null {
    if (!format) return null
    for (const category of VariableManipulatorUtils.FORMAT_CATEGORIES) {
      for (const item of category.items) {
        if (item.format === format) return item.label
      }
    }
    return null
  }

  /**
   * @param value The raw value
   * @param format The Excel format string (e.g., "#,##0.00") or ID
   */
  /* static formatValue1(value: any, format: string | number): any {
        console.log("formatValueformatValue emt", { value, format })
        // value = 99888777
        if (!format) {
            return (value)
        }
        const parsed = Number(value);
        // const parsed = parseFloat(value);
        const isNumeric = !isNaN(parsed) && isFinite(parsed);
        value = isNumeric ? Number(value) : value

        try {
            console.log("formatValueformatValue form", { value, format, parsed, isNumeric, "flor": parseFloat(value), "nan": isNaN(parsed), "inf": isFinite(parsed) }, SSF.format(format, value))
            // SSF handles numbers, dates (as serials), and percentages
            return SSF.format(format, value);
        } catch (e) {
            console.log("formatValueformatValue err", { e })
            return String(value);
        }
    } */

  static formatValue(value: any, format: string | number, autoUpdate?: boolean): any {
    if (!format || value === null || value === undefined || value === '') {
      return value
    }
    if (typeof value === 'string' && value.trim().startsWith('#')) {
      return value
    }

    let processingValue = value

    // 1. Try to treat it as a number first (Excel's native way)
    const parsedNum = Number(value)
    const isNumeric = !isNaN(parsedNum) && isFinite(parsedNum) && typeof value !== 'boolean'

    if (isNumeric) {
      processingValue = parsedNum
    } else {
      // 2. If it's a string, check if it's a valid Date
      // Handle Auto-update trigger
      if (autoUpdate) {
        processingValue = new Date() // Use current system time
      } else {
        const parsedDate = new Date(value)
        if (parsedDate instanceof Date && !isNaN(parsedDate.getTime())) {
          processingValue = parsedDate
        }
      }
    }

    try {
      // SSF.format(format, processingValue)
      // will now correctly handle Numbers OR Date Objects
      return SSF.format(format, processingValue)
    } catch (e) {
      console.error('formatValue error', e)
      return String(value)
    }
  }

  /**
   * For localized names of months/days, use the native Intl API
   * combined with the value before sending to SSF if needed.
   */
  static getLocalizedDisplay(value: any, locale: string = 'en-US') {
    const date = new Date(value)
    return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date)
  }

  /**
   * Get all variables in a string like {C18}, {C17} and check if they exist in knownVars
   * @param text - input string containing {variables}
   * @param knownVars - array of variable names like ['C18', 'C17', ...]
   * @returns array of found variables that exist in knownVars
   */
  public static extractExistingVars(text: string, knownVars: string[]): string[] {
    // Regex to match {VAR_NAME} pattern
    // const regex = /\{([A-Za-z0-9_]+)\}/g;
    const regex = /\{([^}]+)\}/g

    const found: string[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      const varName = match[1] // e.g., "C18"
      if (knownVars.includes(varName)) {
        found.push(varName)
      }
    }
    console.log('listVariables extractExistingVars', { found })

    return found
  }
}

export type VariableMap = {
  row: number
  col: number
  rawValue: any
}
export type Variable = {
  name: string // the variable generated unique name. it is an uuid
  value: any
  rawValue: any
  // rawValue:  VariableValue | number | string,
  formula?: any
}
export type VariableValue = {
  documentId: string // id of the document the variable is declared for.
  nodeId?: string // id of the node in which the variable is declared. Ex: For spreadsheet custom node
  row?: number // optional row coordinate for group mappings
  col?: number // optional column coordinate for group mappings
  coord?: string // optional A1-style coordinate for group mappings
  name: string // the variable name provided by user. should be unique per document (and node if exists). So check if another var with the same name and same documentId (and same nodeId if exists) exists before saving new one
  aliases?: string[] // Advanced settings. For aliases for the same var. Should also be taken into account during var search
  description?: any // Advanced settings. Any description for finding the var easily when searching
  visibility?: string // Advanced settings. document (only currently file document), package (default behavior, whole document with all children folders and files), desktop (all documents on user desktop can use it), cloud (all documents created by the user on desktop/drive... can use it)
  permissions?: {
    // Advanced settings.
    access?: string[] // all users emails that can see the var. The var should be hidden in var list and not usable/callable if user is not allowed. null value means everyone can. empty value  means no one except the document owner. default is null
    read?: string[] // all users emails that can use the var in readonly mode. null value means everyone can. empty value  means no one except the document owner. default is null
    write?: string[] // all users emails that can use and modify the var. null value means everyone can. empty value  means no one except the document owner. default is null
  }
  type: keyof typeof VariableManipulatorUtils.VAR_TYPE | number | string
  // type: keyof typeof VariableManipulatorUtils.VAR_TYPE | 'number' | 'object',
  value: any
  // rawValue: any,
  url?: any // for file/folder
  prompt?: any // for ai
  format?: any // for text into money,hour...format
  autoUpdate?: boolean // for datetime
  translations?: any // for translations. Can be like {en:'valueInEnglish',fr:'valueInFrench',...}
  source?: 'user' | 'ai' | string // how the variable was created
  generatedAt?: string // for AI-generated vars
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeText = (value: any): string =>
  value === null || value === undefined ? '' : String(value).trim()

const normalizeName = (value: any): string => normalizeText(value).toLowerCase()

const isUuid = (value: any): boolean => typeof value === 'string' && UUID_REGEX.test(value)

const resolveDocumentEditor = (
  editor?: DocumentEditorModel | string
): DocumentEditorModel | null => {
  const resolved =
    typeof editor === 'string'
      ? get(_$_documentEditorsList.get(editor)) || null
      : editor || get(_$_documentEditorsList.getActive()) || null

  if (!resolved?.document) return resolved

  const doc = resolved.document
  const parentPath = doc.parentPath
  if (parentPath && parentPath !== doc.path) {
    const normalizedParent = nodeApi?.path?.normalize?.(parentPath) || parentPath
    const list = _$_documentEditorsList.getList()
    const parentEditor = list.find((candidate) => {
      const candidateDoc = candidate?.document
      if (!candidateDoc) return false
      const mainPath = candidateDoc.getMainFilePath?.() || candidateDoc.path
      if (!mainPath) return false
      const normalizedMain = nodeApi?.path?.normalize?.(mainPath) || mainPath
      return normalizedMain === normalizedParent
    })
    if (parentEditor) return parentEditor
  }

  return resolved
}

const getDocumentId = (editor?: DocumentEditorModel | null): string => {
  if (!editor) return ''
  return editor.document?.uuid || editor.uuid || editor.id || ''
}

const getYjsVarStore = (editor?: DocumentEditorModel | null) => {
  return null // for now
  const store = (window as any)?._varStore
  if (!store) return null
  const storeDocId = (window as any)?._varStoreDocId
  const editorDocId = getDocumentId(editor || null)
  if (storeDocId && editorDocId && storeDocId !== editorDocId) return null
  return store
}

const syncVarsToYjsStore = (vars: Record<string, any>, editor?: DocumentEditorModel | null) => {
  return null // for now
  const store = getYjsVarStore(editor)
  if (!store || typeof store.set !== 'function' || typeof store.delete !== 'function') return
  const current = store.all || {}
  const nextKeys = new Set(Object.keys(vars || {}))
  for (const key of Object.keys(current)) {
    if (!nextKeys.has(key)) store.delete(key)
  }
  for (const [key, value] of Object.entries(vars || {})) {
    store.set(key, value)
  }
}

const getVarsForEditor = async (
  editor?: DocumentEditorModel | null
): Promise<Record<string, VariableValue>> => {
  const yjsStore = getYjsVarStore(editor)
  if (yjsStore?.all) return yjsStore.all as Record<string, VariableValue>
  return ((await editor?.document?.getVars?.()) || {}) as Record<string, VariableValue>
}

export function ensureVariableGroup(nodeId: string, documentEditor: DocumentEditorModel | string) {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor || !nodeId) return
  const documentId = getDocumentId(resolvedEditor)
  if (!documentId) return
  const engine = getEngine(documentId)
  engine.registry.ensureGroup(nodeId)
}

const getVariableNames = (data?: VariableValue | null, fallback?: string): string[] => {
  const names = new Set<string>()
  if (data?.name) names.add(data.name)
  if (Array.isArray(data?.aliases)) {
    data.aliases.forEach((alias) => alias && names.add(alias))
  }
  if (fallback) names.add(fallback)
  return Array.from(names)
}

const getPrimaryVariableName = (data?: VariableValue | null, fallback?: string): string => {
  return data?.name || fallback || ''
}

const findVariableByName = (
  vars: Record<string, VariableValue>,
  name: string,
  documentId?: string,
  nodeId?: string
): { id: string; data: VariableValue } | null => {
  const target = normalizeName(name)
  if (!target) return null
  for (const [id, data] of Object.entries(vars)) {
    if (!data) continue
    if (documentId && data.documentId && data.documentId !== documentId) continue
    if (nodeId && data.nodeId && data.nodeId !== nodeId) continue
    const candidates = getVariableNames(data)
    if (candidates.some((candidate) => normalizeName(candidate) === target)) {
      return { id, data }
    }
  }
  return null
}

const resolveVariableId = (
  nameOrId: string,
  editor: DocumentEditorModel | null,
  nodeId?: string
): string | null => {
  if (!nameOrId) return null
  const vars = getVarsForEditor(editor)
  if (vars[nameOrId]) return nameOrId
  if (isUuid(nameOrId)) return nameOrId
  const docId = getDocumentId(editor)
  const match = findVariableByName(vars, nameOrId, docId, nodeId)
  if (match?.id) return match.id

  const variableMap = docId ? _variableMaps.get(docId) : null
  if (variableMap) {
    const target = normalizeName(nameOrId)
    for (const [id, entry] of variableMap.entries()) {
      const names = getVariableNames(entry.rawValue as VariableValue)
      if (names.some((candidate) => normalizeName(candidate) === target)) {
        return id
      }
    }
  }
  return null
}

export function getVariableId(
  nameOrId: string,
  documentEditor: DocumentEditorModel | string,
  nodeId?: string
): string | null {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return null
  return resolveVariableId(nameOrId, resolvedEditor, nodeId)
}

const normalizeVariableValue = (
  exprOrValue: any,
  {
    nameHint,
    documentId,
    nodeId,
    existing
  }: {
    nameHint?: string
    documentId: string
    nodeId?: string
    existing?: VariableValue | null
  }
): VariableValue => {
  const baseName = existing?.name || nameHint || 'Variable'
  if (exprOrValue && typeof exprOrValue === 'object' && 'type' in exprOrValue) {
    const data = exprOrValue as VariableValue
    return {
      documentId: data.documentId || documentId,
      nodeId: data.nodeId || nodeId,
      row: typeof data.row === 'number' ? data.row : existing?.row,
      col: typeof data.col === 'number' ? data.col : existing?.col,
      coord: data.coord ?? existing?.coord,
      name: data.name || baseName,
      aliases: data.aliases ?? existing?.aliases ?? [],
      description: data.description ?? existing?.description,
      visibility: data.visibility ?? existing?.visibility,
      permissions: data.permissions ?? existing?.permissions,
      type: data.type,
      value: data.value,
      url: data.url,
      prompt: data.prompt,
      format: data.format,
      autoUpdate: data.autoUpdate,
      translations: data.translations,
      source: data.source ?? existing?.source,
      generatedAt: data.generatedAt ?? existing?.generatedAt
    }
  }
  return {
    documentId,
    nodeId,
    row: existing?.row,
    col: existing?.col,
    coord: existing?.coord,
    name: baseName,
    type: VariableManipulatorUtils.VAR_TYPE.text,
    value: exprOrValue,
    format: undefined,
    autoUpdate: undefined,
    translations: undefined,
    source: existing?.source ?? 'user',
    generatedAt: existing?.generatedAt
  }
}

const resolveCoordinateFromValue = (value: VariableValue | null) => {
  if (!value) return null
  const row =
    typeof value.row === 'number'
      ? value.row
      : typeof value.row === 'string'
        ? Number(value.row)
        : null
  const col =
    typeof value.col === 'number'
      ? value.col
      : typeof value.col === 'string'
        ? Number(value.col)
        : null
  if (Number.isFinite(row) && Number.isFinite(col)) {
    return { row, col }
  }
  if (typeof value.coord === 'string' && value.coord.trim()) {
    return value.coord.trim()
  }
  return null
}

const buildNamedExpressionContent = (
  value: VariableValue,
  engine: VariableEngine,
  resolveId: (nameOrId: string) => string | null
) => {
  const translate = (expression: string) =>
    engine.translator.translateFormula(expression, {
      resolveId,
      contextNodeId: value?.nodeId
    })

  if (value?.type === VariableManipulatorUtils.VAR_TYPE.text) {
    const raw = value.value
    if (typeof raw === 'string') {
      const trimmed = raw.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('=')) {
        if (!value?.nodeId) {
          const hasA1 = /\b[A-Z]+[1-9]\d*(?::[A-Z]+[1-9]\d*)?\b/.test(trimmed)
          if (hasA1) return '=#REF!'
        }
        return translate(trimmed)
      }
      if (/\{[^}]+\}/.test(trimmed)) {
        return translate(`=${trimmed}`)
      }
      const parsed = Number(trimmed)
      if (trimmed !== '' && Number.isFinite(parsed) && !Number.isNaN(parsed)) {
        return parsed
      }
      return raw
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      return raw
    }
    if (raw === null || raw === undefined) return ''
    return String(raw)
  }

  if (value?.type === VariableManipulatorUtils.VAR_TYPE.richtext) {
    return value.value ?? ''
  }

  if (
    value?.type === VariableManipulatorUtils.VAR_TYPE.file ||
    value?.type === VariableManipulatorUtils.VAR_TYPE.folder
  ) {
    return value.value ?? ''
  }

  if (value?.type === VariableManipulatorUtils.VAR_TYPE.ai) {
    return value.prompt ?? ''
  }

  if (value?.value !== undefined) {
    return value.value
  }

  return ''
}

type VariableEngine = {
  hf: HyperFormula
  registry: Registry
  translator: FormulaTranslator
  sync: SyncManager
}

const _engines = new Map<string, VariableEngine>()

const getEngine = (documentId: string): VariableEngine => {
  let engine = _engines.get(documentId)
  if (engine) return engine

  const hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' })
  const registry = new Registry(hf)
  const translator = new FormulaTranslator(registry)
  const sync = new SyncManager(hf, registry, translator)

  engine = { hf, registry, translator, sync }
  _engines.set(documentId, engine)
  return engine
}

// const sheetName = VariableManipulatorUtils
// const sheetName = 'VarSheet'
// const sheetName = 'Sheet1'
// const sheetId = hyperFormula.addSheet(VariableManipulatorUtils.sheetName)

// const variableMap = new Map() // name -> cell {row, col}

/**
 * Global variable maps:
 * _variableMap     → active variable set (name → VariableMap)
 * _variableMaps    → multiple variable sets (docId → Map)
 */
// const _variableMap = new Map<string, VariableMap>()
const _variableMaps = new Map<string, Map<string, VariableMap>>()
// const _variableMaps = new Map<string, Array<Map<string, VariableMap>>>()

// Listeners
const listeners = new Set()
const syncingDocuments = new Set<string>()

type SpreadsheetPointer = {
  id: string
  name?: string
  path: string
  type?: string
  sheetId?: string
  workbookId?: string
}

const _spreadsheetRegistries = new Map<string, Map<string, SpreadsheetPointer>>()
const _spreadsheetCellCache = new Map<
  string,
  {
    value: any
    status: 'loading' | 'ready' | 'error'
    updatedAt: number
    path: string
    documentId: string
    ref: string
    sheetId: string
    cellRef: string
  }
>()
const _spreadsheetRefsByPath = new Map<string, Set<string>>()
let _spreadsheetWatcherInitialized = false
let _spreadsheetDirtyListenerInitialized = false

export function makeSpreadsheetSheetVarId(
  workbookId: string,
  sheetId?: string,
  sheetName?: string
) {
  const token = sheetId || sheetName || 'Sheet1'
  return `${workbookId}::${token}`
}

/**
 * Helper — ensure a variable exists.
 * Does NOT overwrite existing variables.
 */
/* function ensureVariable(name: string, rawValue: any): VariableMap {
    if (!_variableMap.has(name)) {
        const col = _variableMap.size
        const newVar: VariableMap = { row: 0, col, rawValue }
        _variableMap.set(name, newVar)
        return newVar
    }
    return _variableMap.get(name)!
} */

// helper to convert col number to A1 style
function colToLetter(col: number) {
  let s = ''
  let c = col + 1
  while (c > 0) {
    const m = (c - 1) % 26
    s = String.fromCharCode(65 + m) + s
    c = Math.floor((c - m) / 26)
  }
  return s
}
// Output ["A1", "B5", "C10", "D1", "E2", "E4"]
function detectFormulaReferences(str: string): string[] {
  const NORMAL_REGEX = /\b[A-Z]+[1-9][0-9]*\b/g
  const STRICT_REGEX1 = /(?<![A-Za-z0-9_])[A-Z]+[1-9][0-9]*(?![A-Za-z0-9_])/g
  const STRICT_REGEX = /\b[A-Z]+[1-9][0-9]*(?::[A-Z]+[1-9][0-9]*)?\b/g

  return str.match(STRICT_REGEX) || []
}

// Output ["A1:B5", "C10", "D1", "E2:E4"]
function detectFormulaWholeReferences(str: string): string[] {
  const WHOLE_RANGE_REGEX = /\b[A-Z]+[1-9][0-9]*(?::[A-Z]+[1-9][0-9]*)?\b/g

  return str.match(WHOLE_RANGE_REGEX) || []
}

// Detect if a string contains ANY A1 style references: works for SUM(B3:B5)...
function hasFormulaReferences(str: string): boolean {
  const STRICT_REGEX = /\b[A-Z]+[1-9][0-9]*(?::[A-Z]+[1-9][0-9]*)?\b/g

  return STRICT_REGEX.test(str)
}

/**
 * Safely escape variable names for use in regex.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Load variables from vars.json (if exists)
 * @param {string} filePath
 * @returns {Promise<Record<string, any>>}
 */
export async function loadVarsFromFile(filePath: string): Promise<Record<string, any>> {
  try {
    if (!nodeApi.fs || !nodeApi.path) return {}
    if (await nodeApi.fsPromises?.exists(filePath)) {
      const raw = await nodeApi.fsPromises?.readFile(filePath, 'utf-8')
      const data = JSON.parse(raw)
      try {
        if (typeof window !== 'undefined' && (window as any).__DDOC_VARSFILE_DEBUG__ === true) {
          console.log('📥 Loaded vars from', filePath, data)
        } else if (
          typeof localStorage !== 'undefined' &&
          localStorage.getItem('ddoc.debug.varsFile') === 'true'
        ) {
          console.log('📥 Loaded vars from', filePath, data)
        }
      } catch {
        // ignore
      }
      return data
    }
  } catch (err) {
    console.error('Error loading vars.json:', err)
  }
  return {}
}

/**
 * Save variables to vars.json (pretty formatted)
 * @param {string} filePath
 * @param {Record<string, any>} vars
 */
export async function saveVarsToFile2(
  filePath: string,
  vars: Record<string, any>,
  areVarsAlreadyEscaped: boolean = true
): Promise<void> {
  try {
    const yjsStore = getYjsVarStore(null)
    if (yjsStore) {
      syncVarsToYjsStore(vars, null)
      return
    }
    if (!nodeApi.fs || !nodeApi.path) return
    const dir = nodeApi.path.dirname(filePath)
    if (!(await nodeApi.fsPromises?.exists(dir)))
      await nodeApi.fsPromises?.mkdir(dir, { recursive: true })
    let existing: Record<string, any> = {}
    if (await nodeApi.fsPromises?.exists(filePath)) {
      try {
        const raw = await nodeApi.fsPromises?.readFile(filePath, 'utf-8')
        existing = JSON.parse(raw) || {}
      } catch {
        existing = {}
      }
    }
    const merged = {
      ...existing,
      ...vars
    }
    const payload = areVarsAlreadyEscaped
      ? Utils.unescapeString(JSON.stringify(merged, null, 2))
      : JSON.stringify(merged, null, 2)
    await EditorHelpers.writeFileEnsuringDirAsync(filePath, payload, 'utf-8')
    try {
      if (typeof window !== 'undefined' && (window as any).__DDOC_VARSFILE_DEBUG__ === true) {
        console.log('💾 Saved vars to', filePath, vars)
      } else if (
        typeof localStorage !== 'undefined' &&
        localStorage.getItem('ddoc.debug.varsFile') === 'true'
      ) {
        console.log('💾 Saved vars to', filePath, vars)
      }
    } catch {
      // ignore
    }
  } catch (err) {
    console.error('Error saving vars.json:', err)
  }
}

/**
 * Save variables to a JSON file (pretty formatted)
 * Preserves actual line breaks for multiline strings
 * @param filePath - full path to the JSON file
 * @param vars - object of variables to save
 */
export function saveVarsToFile(filePath: string, vars: Record<string, any>): void {
  // Coalesce frequent updates (typing/editing can call setVariable many times).
  // Keeps UI responsive and prevents write+watcher feedback storms.
  const shouldDebug = () => {
    try {
      if (typeof window !== 'undefined' && (window as any).__DDOC_VARSFILE_DEBUG__ === true)
        return true
      if (typeof localStorage !== 'undefined')
        return localStorage.getItem('ddoc.debug.varsFile') === 'true'
    } catch {
      // ignore
    }
    return false
  }

  // Module-level caches (safe: filePath-keyed).
  const anyGlobal = globalThis as any
  if (!anyGlobal.__DDOC_VARSFILE_SAVE_QUEUE__) {
    anyGlobal.__DDOC_VARSFILE_SAVE_QUEUE__ = new Map<
      string,
      { timer: any; vars: Record<string, any> }
    >()
  }
  if (!anyGlobal.__DDOC_VARSFILE_LAST_WRITTEN__) {
    anyGlobal.__DDOC_VARSFILE_LAST_WRITTEN__ = new Map<string, string>()
  }
  const queue: Map<string, { timer: any; vars: Record<string, any> }> =
    anyGlobal.__DDOC_VARSFILE_SAVE_QUEUE__
  const lastWritten: Map<string, string> = anyGlobal.__DDOC_VARSFILE_LAST_WRITTEN__

  if (!filePath || !vars) return
  const existingEntry = queue.get(filePath)
  if (existingEntry) {
    existingEntry.vars = { ...existingEntry.vars, ...vars }
    return
  }

  queue.set(filePath, {
    timer: setTimeout(async () => {
      const entry = queue.get(filePath)
      queue.delete(filePath)
      if (!entry) return

      try {
        const yjsStore = getYjsVarStore(null)
        if (yjsStore) {
          syncVarsToYjsStore(entry.vars, null)
          return
        }

        if (!nodeApi.fs || !nodeApi.path) return

        const dir = nodeApi.path.dirname(filePath)
        if (!(await nodeApi.fsPromises?.exists(dir)))
          await nodeApi.fsPromises?.mkdir(dir, { recursive: true })

        let existing: Record<string, any> = {}
        let existingRaw = ''
        if (await nodeApi.fsPromises?.exists(filePath)) {
          try {
            existingRaw = String((await nodeApi.fsPromises?.readFile(filePath, 'utf-8')) || '')
            existing = JSON.parse(existingRaw) || {}
          } catch {
            existing = {}
            existingRaw = ''
          }
        }

        const merged = {
          ...existing,
          ...entry.vars
        }

        const jsonString = JSON.stringify(
          merged,
          (_key, value) => (typeof value === 'string' ? value.replace(/\r\n/g, '\n') : value),
          2
        )

        // Skip no-op writes (prevents re-triggering file watchers).
        const last = lastWritten.get(filePath)
        if (last === jsonString || existingRaw === jsonString) {
          return
        }

        await EditorHelpers.writeFileEnsuringDirAsync(filePath, jsonString, 'utf-8')
        lastWritten.set(filePath, jsonString)

        if (shouldDebug()) console.log('💾 Saved vars to', filePath, entry.vars)
      } catch (err) {
        console.error('Error saving vars.json:', err)
      }
    }, 180),
    vars: { ...vars }
  })
}

// --- Helper: get full path for stack storage ---
function getStackFilePath(): string {
  const activeEditor = get(_$_documentEditorsList.getActive())
  if (!activeEditor || !activeEditor.document.getVarsFilePath() || !nodeApi.path) return null
  const baseDir = nodeApi.path.dirname(activeEditor.document.getVarsFilePath())
  return nodeApi.path.join(baseDir, VariableManipulatorUtils.VAR_STACK_FILE_NAME)
}

async function loadSpreadsheetRegistry(editor?: DocumentEditorModel | null) {
  const resolved = resolveDocumentEditor(editor)
  if (!resolved) return
  const documentId = getDocumentId(resolved)
  const varsPath = resolved.document?.getVarsFilePath?.()
  if (!varsPath) return
  try {
    const varsFromMemory = await getVarsForEditor(resolved)
    const varsFromDisk = Object.keys(varsFromMemory || {}).length
      ? varsFromMemory
      : nodeApi.fs && (await nodeApi.fsPromises?.exists(varsPath))
        ? await loadVarsFromFile(varsPath)
        : {}

    const map = new Map<string, SpreadsheetPointer>()
    const seenByPathAndName = new Map<string, string>()
    Object.entries(varsFromDisk || {}).forEach(([id, entry]: any) => {
      const type = entry?.type || entry?.rawValue?.type
      if (type !== VariableManipulatorUtils.VAR_TYPE.spreadsheet) return
      const pathValue = entry?.path || entry?.value
      if (!pathValue) return
      const sheetId = entry?.sheetId || entry?.rawValue?.sheetId
      const workbookId = entry?.workbookId || entry?.rawValue?.workbookId
      const normalizedName = String(entry?.name || id)
        .trim()
        .toLowerCase()
      const dedupeKey = `${pathValue}::${normalizedName}`
      if (seenByPathAndName.has(dedupeKey)) {
        deleteVariable(id, resolved)
        return
      }
      seenByPathAndName.set(dedupeKey, id)
      map.set(id, {
        id,
        name: entry?.name || id,
        path: pathValue,
        type: VariableManipulatorUtils.VAR_TYPE.spreadsheet,
        sheetId,
        workbookId
      })
    })

    _spreadsheetRegistries.set(documentId, map)
    try {
      map.forEach((entry) => {
        window.api?.spreadsheetWatch?.({ path: entry.path })
      })
    } catch {
      // ignore
    }
  } catch (err) {
    console.error('Error loading spreadsheets registry from vars.json', err)
  }
}

function saveSpreadsheetRegistry(editor?: DocumentEditorModel | null) {
  // No-op: spreadsheet pointers are stored as normal vars (type: spreadsheet).
  // Registry is rebuilt from vars.json when needed.
}

export async function registerSpreadsheetPointer(
  pointer: SpreadsheetPointer,
  editor?: DocumentEditorModel | string
) {
  const resolved = resolveDocumentEditor(editor)
  if (!resolved || !pointer?.id || !pointer?.path) return
  const documentId = getDocumentId(resolved)
  if (!_spreadsheetRegistries.has(documentId)) {
    await loadSpreadsheetRegistry(resolved)
  }
  const registry = _spreadsheetRegistries.get(documentId) || new Map<string, SpreadsheetPointer>()
  registry.set(pointer.id, pointer)
  _spreadsheetRegistries.set(documentId, registry)
  setVariable(
    pointer.id,
    {
      type: VariableManipulatorUtils.VAR_TYPE.spreadsheet,
      name: pointer.name || pointer.id,
      value: pointer.path,
      path: pointer.path,
      sheetId: pointer.sheetId,
      workbookId: pointer.workbookId
    },
    resolved
  )
  try {
    window.api?.spreadsheetWatch?.({ path: pointer.path })
  } catch {
    // ignore
  }
}

export async function registerSpreadsheetWorkbookSheets(
  options: { workbookId: string; path: string; sheets: Array<{ id?: string; name?: string }> },
  editor?: DocumentEditorModel | string
) {
  const resolved = resolveDocumentEditor(editor)
  if (!resolved || !options?.workbookId || !options?.path) return
  const { workbookId, path, sheets } = options
  if (!Array.isArray(sheets) || sheets.length === 0) return
  const documentId = getDocumentId(resolved)
  if (!_spreadsheetRegistries.has(documentId)) {
    await loadSpreadsheetRegistry(resolved)
  }
  const registry = _spreadsheetRegistries.get(documentId) || new Map<string, SpreadsheetPointer>()
  const nextIds = new Set<string>()

  const normalizeSheetName = (value?: string) =>
    String(value || '')
      .trim()
      .toLowerCase()
  const findExistingForSheet = (sheet: { id?: string; name?: string }) => {
    const targetName = normalizeSheetName(sheet?.name)
    let match: string | null = null
    registry.forEach((pointer, id) => {
      if (pointer.type !== VariableManipulatorUtils.VAR_TYPE.spreadsheet) return
      if (pointer.path !== path) return
      if (pointer.sheetId && sheet?.id && pointer.sheetId === sheet.id) {
        match = id
      } else if (targetName && normalizeSheetName(pointer.name) === targetName) {
        match = id
      }
    })
    return match
  }

  sheets.forEach((sheet) => {
    const sheetId = sheet?.id || sheet?.name || 'Sheet1'
    const existingId = findExistingForSheet(sheet)
    const varId = existingId || makeSpreadsheetSheetVarId(workbookId, sheetId, sheet?.name)
    const displayName = sheet?.name || sheetId || varId
    nextIds.add(varId)
    const pointer: SpreadsheetPointer = {
      id: varId,
      name: displayName,
      path,
      type: VariableManipulatorUtils.VAR_TYPE.spreadsheet,
      sheetId,
      workbookId
    }
    registry.set(varId, pointer)
    setVariable(
      varId,
      {
        type: VariableManipulatorUtils.VAR_TYPE.spreadsheet,
        name: displayName,
        value: path,
        path,
        sheetId,
        workbookId
      },
      resolved
    )
  })

  registry.forEach((pointer, id) => {
    if (pointer.type !== VariableManipulatorUtils.VAR_TYPE.spreadsheet) return
    if (pointer.path !== path) return
    if (nextIds.has(id)) return
    registry.delete(id)
    deleteVariable(id, resolved)
  })

  _spreadsheetRegistries.set(documentId, registry)
  try {
    window.api?.spreadsheetWatch?.({ path })
  } catch {
    // ignore
  }
}

// Remove every spreadsheet pointer (and its variable) tied to a given workbook
// or asset path. Called when a spreadsheet node is deleted from the document so
// references like {spreadsheet} stop resolving to the now-dangling file path.
export async function unregisterSpreadsheet(
  options: { workbookId?: string; path?: string },
  editor?: DocumentEditorModel | string
) {
  const resolved = resolveDocumentEditor(editor)
  if (!resolved) return
  const { workbookId, path } = options
  if (!workbookId && !path) return
  const documentId = getDocumentId(resolved)
  if (!_spreadsheetRegistries.has(documentId)) {
    await loadSpreadsheetRegistry(resolved)
  }
  const registry = _spreadsheetRegistries.get(documentId)
  if (!registry) return
  registry.forEach((pointer, id) => {
    if (pointer.type !== VariableManipulatorUtils.VAR_TYPE.spreadsheet) return
    const matchesWorkbook =
      !!workbookId && (pointer.workbookId === workbookId || pointer.id === workbookId)
    const matchesPath = !!path && pointer.path === path
    if (!matchesWorkbook && !matchesPath) return
    registry.delete(id)
    deleteVariable(id, resolved)
  })
  _spreadsheetRegistries.set(documentId, registry)
}

export function listSpreadsheetPointers(
  editor?: DocumentEditorModel | string
): SpreadsheetPointer[] {
  const resolved = resolveDocumentEditor(editor)
  if (!resolved) return []
  const documentId = getDocumentId(resolved)
  if (!_spreadsheetRegistries.has(documentId)) {
    loadSpreadsheetRegistry(resolved)
  }
  const registry = _spreadsheetRegistries.get(documentId)
  if (!registry) return []
  return Array.from(registry.values()).sort((a, b) => {
    const pathA = a.path || ''
    const pathB = b.path || ''
    if (pathA !== pathB) return pathA.localeCompare(pathB)
    const nameA = a.name || ''
    const nameB = b.name || ''
    return nameA.localeCompare(nameB)
  })
}

export function cleanupSpreadsheetVariablesForPath(
  spreadsheetPath: string,
  editor?: DocumentEditorModel | string,
  workbookId?: string | null
): void {
  const resolved = resolveDocumentEditor(editor)
  if (!resolved || !spreadsheetPath) return
  const documentId = getDocumentId(resolved)
  if (!documentId) return
  const variableMap = _variableMaps.get(documentId)
  if (!variableMap) return

  const normalizedPath = String(spreadsheetPath || '')
  const idsToDelete: string[] = []
  for (const [id, entry] of variableMap.entries()) {
    const raw = entry?.rawValue as any
    if (!raw || typeof raw !== 'object') continue
    if (raw.type !== VariableManipulatorUtils.VAR_TYPE.spreadsheet) continue
    const rawPath = String(raw.path || raw.value || '')
    const rawWorkbook = raw.workbookId ? String(raw.workbookId) : ''
    if (rawPath && rawPath === normalizedPath) {
      idsToDelete.push(id)
    } else if (workbookId && rawWorkbook && rawWorkbook === String(workbookId)) {
      idsToDelete.push(id)
    }
  }

  if (!idsToDelete.length) return

  idsToDelete.forEach((id) => {
    try {
      deleteVariable(id, resolved)
    } catch {
      // ignore
    }
  })

  try {
    const varsPath = resolved.document?.getVarsFilePath?.()
    if (varsPath) {
      saveVarsToFile(varsPath, serializeVariables(variableMap))
    }
  } catch {
    // ignore
  }
}

export function cleanupTableCellVariablesForSheet(
  sheetName: string,
  editor?: DocumentEditorModel | string
): void {
  const resolved = resolveDocumentEditor(editor)
  if (!resolved || !sheetName) return
  const documentId = getDocumentId(resolved)
  if (!documentId) return
  const variableMap = _variableMaps.get(documentId)
  if (!variableMap) return

  const idsToDelete: string[] = []
  for (const [id, entry] of variableMap.entries()) {
    const raw = entry?.rawValue as any
    if (!raw || typeof raw !== 'object') continue
    // Table cell variables are normal text vars with nodeId + row/col.
    if (raw.nodeId !== sheetName) continue
    if (!Number.isFinite(Number(raw.row)) || !Number.isFinite(Number(raw.col))) continue
    idsToDelete.push(id)
  }

  if (!idsToDelete.length) return
  idsToDelete.forEach((id) => {
    try {
      deleteVariable(id, resolved)
    } catch {
      // ignore
    }
  })

  try {
    const varsPath = resolved.document?.getVarsFilePath?.()
    if (varsPath) {
      saveVarsToFile(varsPath, serializeVariables(variableMap))
    }
  } catch {
    // ignore
  }
}

function getSpreadsheetPointer(
  id: string,
  editor?: DocumentEditorModel | string
): SpreadsheetPointer | null {
  const resolved = resolveDocumentEditor(editor)
  if (!resolved || !id) return null
  const documentId = getDocumentId(resolved)
  if (!_spreadsheetRegistries.has(documentId)) {
    loadSpreadsheetRegistry(resolved)
  }
  const registry = _spreadsheetRegistries.get(documentId)
  return registry?.get(id) || null
}

function getSpreadsheetPointerByDocumentId(
  documentId: string,
  sheetId: string
): SpreadsheetPointer | null {
  if (!_spreadsheetRegistries.has(documentId)) return null
  return _spreadsheetRegistries.get(documentId)?.get(sheetId) || null
}

function parseSpreadsheetRef(ref: string) {
  const parts = ref.split('!')
  if (parts.length < 2) return null
  const sheetId = parts[0]
  if (!sheetId) return null
  if (parts.length >= 3) {
    const sheetName = parts[1]?.trim()
    const expression = parts.slice(2).join('!')?.trim()
    if (!expression) return null
    return { sheetId, sheetName, expression }
  }
  const expression = parts.slice(1).join('!')?.trim()
  if (!expression) return null
  return { sheetId, sheetName: null, expression }
}

const CELL_REF_REGEX = /^[A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?$/i
const FUNC_EXPR_REGEX = /^([A-Z]+)\s*\((.*)\)$/i

function splitFormulaArgs(input: string): string[] {
  if (!input) return []
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function flattenRangeValue(value: any): number[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenRangeValue(item))
  }
  if (typeof value === 'number') return [value]
  if (typeof value === 'string') {
    return value
      .split(/[\t\n\r]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => Number(entry))
      .filter((num) => Number.isFinite(num))
  }
  return []
}

function parseA1Ref(ref: string): { row: number; col: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref.trim())
  if (!match) return null
  const letters = match[1].toUpperCase()
  const row = parseInt(match[2], 10) - 1
  let col = 0
  for (let i = 0; i < letters.length; i++) {
    col *= 26
    col += letters.charCodeAt(i) - 64
  }
  return { row, col: col - 1 }
}

function parseRangeRef(ref: string) {
  const parts = ref.split(':')
  if (parts.length !== 2) return null
  const start = parseA1Ref(parts[0])
  const end = parseA1Ref(parts[1])
  if (!start || !end) return null
  return {
    start: {
      row: Math.min(start.row, end.row),
      col: Math.min(start.col, end.col)
    },
    end: {
      row: Math.max(start.row, end.row),
      col: Math.max(start.col, end.col)
    }
  }
}

function getLiveSheetEntry(path: string) {
  try {
    const map = sheetRegistry.getSnapshot()
    return map?.[path] || null
  } catch {
    return null
  }
}

function resolveLiveSheetId(entry: any, sheetName?: string | null) {
  if (!entry?.methods || !sheetName) return sheetName || undefined
  try {
    const sheets = entry.methods?.getAllSheets?.() || []
    const match = sheets.find((s: any) => s?.id === sheetName || s?.name === sheetName)
    return match?.id || sheetName
  } catch {
    return sheetName || undefined
  }
}

async function getLiveCellValue(path: string, cellRef: string, sheetName?: string | null) {
  const entry = getLiveSheetEntry(path)
  if (!entry?.methods) return null
  const resolvedSheetId = resolveLiveSheetId(entry, sheetName)

  if (cellRef.includes(':')) {
    const range = parseRangeRef(cellRef)
    if (!range) return null
    const rows: string[] = []
    for (let r = range.start.row; r <= range.end.row; r++) {
      const cols: string[] = []
      for (let c = range.start.col; c <= range.end.col; c++) {
        const value = entry.methods?.getCellValue?.(
          r,
          c,
          resolvedSheetId ? { id: resolvedSheetId } : {}
        )
        cols.push(value == null ? '' : String(value))
      }
      rows.push(cols.join('\\t'))
    }
    return rows.join('\\n')
  }

  const pos = parseA1Ref(cellRef)
  if (!pos) return null
  return entry.methods?.getCellValue?.(
    pos.row,
    pos.col,
    resolvedSheetId ? { id: resolvedSheetId } : {}
  )
}

async function getSpreadsheetNumericValue(
  path: string,
  cellRef: string,
  sheetName?: string | null
): Promise<number | null> {
  const liveValue = await getLiveCellValue(path, cellRef, sheetName)
  const resolvedValue = liveValue != null ? liveValue : undefined
  let values = flattenRangeValue(resolvedValue)
  if (resolvedValue === undefined) {
    const targetRef = sheetName ? `${sheetName}!${cellRef}` : cellRef
    const result = await window.api?.spreadsheetGetCell?.({ path, cellRef: targetRef })
    if (!result || result.status !== 'ok') return null
    values = flattenRangeValue(result.value)
    if (values.length === 0) {
      const scalar = Number(result.value)
      return Number.isFinite(scalar) ? scalar : null
    }
  }

  if (values.length === 0) {
    const scalar = Number(resolvedValue)
    return Number.isFinite(scalar) ? scalar : null
  }
  if (CELL_REF_REGEX.test(cellRef)) {
    return Number.isFinite(values[0]) ? values[0] : null
  }
  // Range -> default to SUM for arithmetic contexts
  return values.reduce((sum, item) => sum + item, 0)
}

function parseSheetQualifiedRef(value: string): { sheet: string | null; ref: string } {
  const parts = value.split('!')
  if (parts.length >= 2) {
    const sheet = parts.shift()?.trim() || ''
    const ref = parts.join('!').trim()
    return { sheet: sheet || null, ref }
  }
  return { sheet: null, ref: value.trim() }
}

async function evaluateSpreadsheetExpression(
  path: string,
  expression: string,
  sheetName?: string | null
): Promise<number | string | null> {
  let trimmed = expression.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('=')) trimmed = trimmed.slice(1).trim()

  if (CELL_REF_REGEX.test(trimmed)) {
    return await getSpreadsheetNumericValue(path, trimmed, sheetName)
  }

  const funcMatch = trimmed.match(FUNC_EXPR_REGEX)
  if (funcMatch) {
    const func = funcMatch[1].toUpperCase()
    const args = splitFormulaArgs(funcMatch[2])
    const numbers: number[] = []
    for (const arg of args) {
      if (!arg) continue
      const { sheet, ref } = parseSheetQualifiedRef(arg)
      const num = CELL_REF_REGEX.test(ref)
        ? await getSpreadsheetNumericValue(path, ref, sheet || sheetName)
        : Number(ref)
      if (Number.isFinite(num)) numbers.push(num as number)
    }
    if (!numbers.length) return null
    switch (func) {
      case 'SUM':
        return numbers.reduce((sum, val) => sum + val, 0)
      case 'AVG':
      case 'AVERAGE':
        return numbers.reduce((sum, val) => sum + val, 0) / numbers.length
      case 'MIN':
        return Math.min(...numbers)
      case 'MAX':
        return Math.max(...numbers)
      default:
        return null
    }
  }

  // Simple arithmetic expression with cell refs: replace refs with values and eval
  const sheetRefRegex = /([A-Za-z0-9 _-]+)![A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?/gi
  let resolvedExpr = trimmed
  const sheetMatches = trimmed.match(sheetRefRegex) || []
  for (const ref of new Set(sheetMatches)) {
    const { sheet, ref: pureRef } = parseSheetQualifiedRef(ref)
    const value = await getSpreadsheetNumericValue(path, pureRef, sheet || sheetName)
    const safeValue = Number.isFinite(value) ? String(value) : '0'
    resolvedExpr = resolvedExpr.replace(
      new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      safeValue
    )
  }

  const refMatches = resolvedExpr.match(/[A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?/gi) || []
  const uniqueRefs = Array.from(new Set(refMatches))
  for (const ref of uniqueRefs) {
    const value = await getSpreadsheetNumericValue(path, ref, sheetName)
    const safeValue = Number.isFinite(value) ? String(value) : '0'
    resolvedExpr = resolvedExpr.replace(
      new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      safeValue
    )
  }

  if (!/^[0-9+\-*/().\s]+$/.test(resolvedExpr)) return null
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${resolvedExpr});`)()
    return Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

async function requestSpreadsheetValue(
  ref: string,
  documentId: string,
  pointer: SpreadsheetPointer,
  expression: string,
  sheetName?: string | null
) {
  const cacheKey = `${documentId}::${ref}`
  setSpreadsheetCache(cacheKey, {
    value: '#LOADING',
    status: 'loading',
    path: pointer.path,
    documentId,
    ref,
    sheetId: pointer.id,
    cellRef: expression,
    sheetName
  })

  try {
    let value: any = null
    if (CELL_REF_REGEX.test(expression) || expression.includes('(') || /[+\-*/]/.test(expression)) {
      value = await evaluateSpreadsheetExpression(pointer.path, expression, sheetName)
    }
    if (value === null || value === undefined) {
      const liveValue = await getLiveCellValue(pointer.path, expression, sheetName)
      if (liveValue !== null && liveValue !== undefined) {
        value = liveValue
      } else {
        const targetRef = sheetName ? `${sheetName}!${expression}` : expression
        const result = await window.api?.spreadsheetGetCell?.({
          path: pointer.path,
          cellRef: targetRef
        })
        value = result?.value ?? '#REF_ERROR!'
      }
    }

    setSpreadsheetCache(cacheKey, {
      value,
      status: 'ready',
      path: pointer.path,
      documentId,
      ref,
      sheetId: pointer.id,
      cellRef: expression,
      sheetName
    })
    listeners.forEach((fn) => fn(ref, value, VariableManipulatorUtils.VAR_UPDATE_TYPE.value))
  } catch (err) {
    setSpreadsheetCache(cacheKey, {
      value: '#REF_ERROR!',
      status: 'error',
      path: pointer.path,
      documentId,
      ref,
      sheetId: pointer.id,
      cellRef: expression,
      sheetName
    })
    listeners.forEach((fn) =>
      fn(ref, '#REF_ERROR!', VariableManipulatorUtils.VAR_UPDATE_TYPE.value)
    )
  }
}

function ensureSpreadsheetWatcher() {
  const handleSpreadsheetChange = (filePath?: string) => {
    if (!filePath) return
    const keys = _spreadsheetRefsByPath.get(filePath)
    if (!keys || keys.size === 0) return

    for (const cacheKey of keys) {
      const cached = _spreadsheetCellCache.get(cacheKey)
      if (!cached) continue
      _spreadsheetCellCache.delete(cacheKey)
      const ref = cached.ref
      const pointer = getSpreadsheetPointerByDocumentId(cached.documentId, cached.sheetId)
      if (!pointer) {
        listeners.forEach((fn) =>
          fn(ref, '#REF_ERROR!', VariableManipulatorUtils.VAR_UPDATE_TYPE.value)
        )
        continue
      }
      void requestSpreadsheetValue(
        ref,
        cached.documentId,
        pointer,
        cached.cellRef,
        cached.sheetName
      )
    }
  }

  if (!_spreadsheetDirtyListenerInitialized && typeof window !== 'undefined') {
    _spreadsheetDirtyListenerInitialized = true
    window.addEventListener('dynadoc-sheet-dirty', (event: any) => {
      const detail = event?.detail
      handleSpreadsheetChange(detail?.rootPath)
    })
  }

  // Desktop/Electron: listen for file changes from the main process watcher.
  // Web/Mobile: `window.api.onSpreadsheetFileChanged` is not available, but the
  // `dynadoc-sheet-dirty` bridge event (emitted by the embedded spreadsheet) still is.
  if (_spreadsheetWatcherInitialized) return
  if (!window.api?.onSpreadsheetFileChanged) return
  _spreadsheetWatcherInitialized = true
  window.api.onSpreadsheetFileChanged((payload) => {
    handleSpreadsheetChange(payload?.path)
  })
}

function setSpreadsheetCache(
  cacheKey: string,
  payload: {
    value: any
    status: 'loading' | 'ready' | 'error'
    path: string
    documentId: string
    ref: string
    sheetId: string
    cellRef: string
    sheetName?: string | null
  }
) {
  _spreadsheetCellCache.set(cacheKey, { ...payload, updatedAt: Date.now() })
  const set = _spreadsheetRefsByPath.get(payload.path) || new Set<string>()
  set.add(cacheKey)
  _spreadsheetRefsByPath.set(payload.path, set)
}

function getSpreadsheetCache(cacheKey: string) {
  return _spreadsheetCellCache.get(cacheKey)
}

function pushToStack(stack, item, persit: boolean = true): void {
  stack.push(item)
  if (stack.length > VariableManipulatorUtils.MAX_STACK_LENGTH) {
    stack.shift() // remove oldest
  }
  if (persit) saveStacks() // 🧠 persist again
}

// --- Save stacks to disk ---
async function saveStacks(): Promise<void> {
  const filePath = getStackFilePath()
  if (!filePath) return
  const data = {
    undoStack,
    redoStack,
    timestamp: Date.now()
  }
  try {
    await EditorHelpers.writeFileEnsuringDirAsync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error('❌ Failed to save stacks:', err)
  }
}

// --- Load stacks from disk ---
export async function loadStacks(): Promise<void> {
  const filePath = getStackFilePath()
  if (!filePath || !nodeApi.fs || !(await nodeApi.fsPromises?.exists(filePath))) return

  try {
    const raw = await nodeApi.fsPromises?.readFile(filePath, 'utf-8')
    const data = JSON.parse(raw)
    if (Array.isArray(data.undoStack)) {
      undoStack.splice(0, undoStack.length, ...data.undoStack)
    }
    if (Array.isArray(data.redoStack)) {
      redoStack.splice(0, redoStack.length, ...data.redoStack)
    }
    console.log(`✅ Loaded undo/redo stacks: ${undoStack.length} undo, ${redoStack.length} redo.`)
  } catch (err) {
    console.error('⚠️ Failed to load undo/redo stacks:', err)
  }
}

export function loadAndDefineVariablesOfAllOpenDocumentEditors(): void {
  const documentEditorsList = _$_documentEditorsList.getList()
  documentEditorsList.forEach((documentEditor) => {
    // console.log('loadAndDefineVariablesOfAllOpenDocumentEditors ', documentEditorsList)
    loadAndDefineVariables(documentEditor)
  })
}

/**
 * Load all variables from the current Svelte document store (_$_activeDocumentVars)
 * and define them inside the HyperFormula variable system.
 *
 * This function:
 *  - Reads the current store values
 *  - Calls `defineVariable(name, value)` for each
 *  - Reacts to any further store updates automatically
 */
export async function loadAndDefineVariables(
  activeEditor?: DocumentEditorModel | string,
  forceDefine: boolean = false
) {
  // export function loadAndDefineVariables(activeEditor?: DocumentEditorModel | string, editorId?: string): void {
  // Load initial variables

  activeEditor = resolveDocumentEditor(activeEditor)
  const vars = await getVarsForEditor(activeEditor)
  // const vars = get(_$_activeDocumentVars)
  try {
    if (typeof window !== 'undefined' && (window as any).__DDOC_VARS_DEBUG__ === true) {
      console.log('loadAndDefineVariables vars', { vars, activeEditor })
    } else if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('ddoc.debug.vars') === 'true'
    ) {
      console.log('loadAndDefineVariables vars', { vars, activeEditor })
    }
  } catch {
    // ignore
  }
  if (!activeEditor || !vars) return
  await loadSpreadsheetRegistry(activeEditor)
  ensureSpreadsheetWatcher()

  // _variableMap.clear()
  // _variableMaps.clear()
  const documentId = getDocumentId(activeEditor)
  if (!documentId || syncingDocuments.has(documentId)) {
    return
  }
  syncingDocuments.add(documentId)
  try {
    if (forceDefine || !_variableMaps?.has(documentId)) {
      const migratedVars: Record<string, VariableValue> = {}
      let didMigrate = false
      const nameToId = new Map<string, string>()

      for (const [varId, val] of Object.entries(vars)) {
        const normalizedId = isUuid(varId) ? varId : uuidv4()
        if (!isUuid(varId)) didMigrate = true

        const normalizedValue = normalizeVariableValue(val, {
          nameHint: (val as VariableValue)?.name || varId,
          documentId
        })

        migratedVars[normalizedId] = normalizedValue
        defineVariable(normalizedId, normalizedValue, false, activeEditor)

        const rawNames = getVariableNames(normalizedValue, varId)
        for (const name of rawNames) {
          if (!name) continue
          nameToId.set(name, normalizedId)
          nameToId.set(normalizeName(name), normalizedId)
        }
      }

      let didMigrateFormulas = false
      const replaceBraceRefs = (text: string): string => {
        if (!text) return text
        return text.replace(/\{([^}]+)\}/g, (match, raw) => {
          const token = String(raw).trim()
          if (!token) return match
          if (isUuid(token)) return `{${token}}`
          const mapped = nameToId.get(token) || nameToId.get(normalizeName(token))
          if (!mapped) return match
          didMigrateFormulas = true
          return `{${mapped}}`
        })
      }

      for (const [id, entry] of _variableMaps.get(documentId) || []) {
        const raw = entry.rawValue as VariableValue
        if (!raw) continue

        if (raw.type === VariableManipulatorUtils.VAR_TYPE.text && typeof raw.value === 'string') {
          const updated = replaceBraceRefs(raw.value)
          if (updated !== raw.value) {
            entry.rawValue = { ...raw, value: updated }
            defineVariable(id, entry.rawValue, false, activeEditor)
          }
        } else if (
          raw.type === VariableManipulatorUtils.VAR_TYPE.ai &&
          typeof raw.prompt === 'string'
        ) {
          const updated = replaceBraceRefs(raw.prompt)
          if (updated !== raw.prompt) {
            entry.rawValue = { ...raw, prompt: updated }
            defineVariable(id, entry.rawValue, false, activeEditor)
          }
        }
      }

      if (didMigrate) {
        const varStorePath = activeEditor?.document?.getVarsFilePath()
        if (varStorePath) {
          saveVarsToFile(varStorePath, migratedVars)
        }
      } else if (didMigrateFormulas) {
        const varStorePath = activeEditor?.document?.getVarsFilePath()
        const variableMap = _variableMaps.get(documentId)
        if (varStorePath && variableMap) {
          saveVarsToFile(varStorePath, serializeVariables(variableMap))
        }
      }
    }
  } finally {
    syncingDocuments.delete(documentId)
  }

  // return
  /* for (const [name, val] of Object.entries(vars)) {

        defineVariable(name, val)
        // return
    } */
}

/**
 * Load variables from Svelte store.
 * DOES NOT clear existing variable map.
 * Adds only new variables.
 */
/* export function loadAndDefineVariables(): void {
    const vars = get(_$_activeDocumentVars)
    console.log('loadAndDefineVariables vars', vars)

_variableMaps

    for (const [name, val] of Object.entries(vars)) {
        // Only define if not already defined
        if (!_variableMap.has(name)) {
            defineVariable(name, val, false)
        }
    }
} */

/**
 * Define or update a variable with any kind of value.
 *
 * Supports:
 * - defineVariable('x', 10)
 * - defineVariable('y', '=A1+1')
 * - defineVariable('calc', 'x + y')
 * - defineVariable('user name', 'John')
 * - defineVariable('obj', {a:1})
 */
export function defineVariable1(
  name: string,
  exprOrValue: any,
  persist: boolean = false,
  documentEditor: DocumentEditorModel | string,
  onComplete?: Function
) {
  return defineVariable(name, exprOrValue, persist, documentEditor, onComplete)
}

export function defineVariable(
  nameOrId: string,
  exprOrValue: any,
  persist: boolean = false,
  documentEditor: DocumentEditorModel | string,
  onComplete?: Function
): string | null {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return null

  const documentId = getDocumentId(resolvedEditor)
  if (!documentId) return null

  let variableMap = _variableMaps.get(documentId) || new Map<string, VariableMap>()
  const nodeId =
    typeof exprOrValue === 'object' ? (exprOrValue as VariableValue)?.nodeId : undefined
  const existingId = resolveVariableId(nameOrId, resolvedEditor, nodeId)
  const variableId = existingId || (isUuid(nameOrId) ? nameOrId : uuidv4())
  const existingCell = variableMap.get(variableId)

  const normalizedValue = normalizeVariableValue(exprOrValue, {
    nameHint: !isUuid(nameOrId) ? nameOrId : undefined,
    documentId,
    nodeId,
    existing: (existingCell?.rawValue as VariableValue) || null
  })

  if (!normalizedValue.name) {
    normalizedValue.name = getPrimaryVariableName(
      existingCell?.rawValue as VariableValue,
      variableId
    )
  }

  const nextRow = existingCell?.row ?? 0
  const nextCol = existingCell?.col ?? variableMap.size

  variableMap.set(variableId, {
    row: nextRow,
    col: nextCol,
    rawValue: normalizedValue
  })
  _variableMaps.set(documentId, variableMap)

  const engine = getEngine(documentId)
  const coord = resolveCoordinateFromValue(normalizedValue)

  const resolveId = (value: string) =>
    resolveVariableId(value, resolvedEditor, normalizedValue.nodeId)
  const content = buildNamedExpressionContent(normalizedValue, engine, resolveId)
  const changes = engine.sync.setVariableExpression(variableId, content, {
    nodeId: normalizedValue.nodeId,
    coord
  })
  const affectedIds = engine.registry.getUuidsFromChanges(changes)
  notifyValueChange(resolvedEditor, affectedIds.length ? affectedIds : variableId)

  if (persist) {
    const varStorePath = resolvedEditor?.document?.getVarsFilePath()
    if (varStorePath) {
      saveVarsToFile(varStorePath, serializeVariables(variableMap))
    }
  }

  onComplete?.()
  return variableId
}

// export function setVariable(name: string, value: VariableValue | string, valueContainsVarExpression: boolean = false) {
export function setVariable(
  name: string,
  value: VariableValue | string,
  documentEditor: DocumentEditorModel | string,
  onComplete?: Function
) {
  return defineVariable(name, value, true, documentEditor, onComplete)
}

export function renameVariable(
  oldNameOrId: string,
  newName: string,
  documentEditor: DocumentEditorModel | string
) {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return

  const documentId = getDocumentId(resolvedEditor)
  const variableMap = _variableMaps.get(documentId)
  if (!variableMap) return

  const variableId = resolveVariableId(oldNameOrId, resolvedEditor)
  if (!variableId) {
    console.warn(`Variable "${oldNameOrId}" does not exist.`)
    return
  }

  const cell = variableMap.get(variableId)
  if (!cell) return
  const raw = typeof cell.rawValue === 'object' ? (cell.rawValue as VariableValue) : null
  if (raw?.nodeId && Number.isFinite(raw?.row) && Number.isFinite(raw?.col)) {
    return
  }

  const currentName = getPrimaryVariableName(cell.rawValue as VariableValue, oldNameOrId)
  const nextName = normalizeText(newName)

  if (!nextName || normalizeName(nextName) === normalizeName(currentName)) {
    return
  }

  const vars = getVarsForEditor(resolvedEditor)
  const dupe = findVariableByName(
    vars,
    nextName,
    documentId,
    (cell.rawValue as VariableValue)?.nodeId
  )
  if (dupe && dupe.id !== variableId) {
    console.warn(`Variable "${nextName}" already exists. Choose another name.`)
    return
  }

  cell.rawValue = {
    ...(cell.rawValue as VariableValue),
    name: nextName
  }

  variableMap.set(variableId, cell)
  _variableMaps.set(documentId, variableMap)

  const escapedOld = escapeRegex(currentName)
  const escapedNew = nextName
  const braceRegex = new RegExp(`\\{${escapedOld}\\}`, 'g')
  const wordRegex = /\s/.test(currentName) ? null : new RegExp(`\\b${escapedOld}\\b`, 'g')

  const replaceExpression = (expr?: string): string => {
    if (!expr) return expr
    let updated = expr.replace(braceRegex, `{${escapedNew}}`)
    if (wordRegex) {
      updated = updated.replace(wordRegex, escapedNew)
    }
    return updated
  }

  for (const [id, entry] of variableMap.entries()) {
    if (!entry?.rawValue || id === variableId) continue
    const raw = entry.rawValue as VariableValue
    if (raw.type === VariableManipulatorUtils.VAR_TYPE.text && typeof raw.value === 'string') {
      const updated = replaceExpression(raw.value)
      if (updated !== raw.value) {
        entry.rawValue = { ...raw, value: updated }
        defineVariable(id, entry.rawValue, false, resolvedEditor)
      }
    } else if (
      raw.type === VariableManipulatorUtils.VAR_TYPE.ai &&
      typeof raw.prompt === 'string'
    ) {
      const updated = replaceExpression(raw.prompt)
      if (updated !== raw.prompt) {
        entry.rawValue = { ...raw, prompt: updated }
        defineVariable(id, entry.rawValue, false, resolvedEditor)
      }
    }
  }

  defineVariable(variableId, cell.rawValue, true, resolvedEditor)
  notifyNameChange(variableId, nextName, resolvedEditor)
}

export function renameVariableInEditor(editor: Editor, oldName: string, newName: string) {
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === CustomVarExtensionProps.name && node.attrs.name === oldName) {
      // Replace the node with updated attrs (keeping value)
      const updatedNode = editor.state.schema.nodes.variable.create({
        ...node.attrs,
        name: newName
      })
      const tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, updatedNode)
      editor.view.dispatch(tr)
    }
  })
}

export function getVariable(
  nameOrId: string,
  documentEditor: DocumentEditorModel | string,
  getFlatCellValue: boolean = true
): CellValue | object {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return undefined

  const documentId = getDocumentId(resolvedEditor)

  const sheetRef = parseSpreadsheetRef(nameOrId)
  if (sheetRef) {
    const pointer = getSpreadsheetPointer(sheetRef.sheetId, resolvedEditor)
    if (!pointer) return '#REF_ERROR!'
    const resolvedSheetName = sheetRef.sheetName || pointer.name || null
    const cacheKey = `${documentId}::${nameOrId}`
    const cached = getSpreadsheetCache(cacheKey)
    if (cached?.status === 'ready') return cached.value
    if (!cached) {
      void requestSpreadsheetValue(
        nameOrId,
        documentId,
        pointer,
        sheetRef.expression,
        resolvedSheetName
      )
      return '#LOADING'
    }
    return cached.value ?? '#LOADING'
  }

  const variableMap = _variableMaps.get(documentId)
  if (!variableMap) return undefined

  const variableId = resolveVariableId(nameOrId, resolvedEditor)
  if (!variableId || !variableMap.has(variableId)) return undefined

  const cell = variableMap.get(variableId)
  if (!cell) return undefined

  const engine = getEngine(documentId)

  if (typeof cell.rawValue === 'object') {
    const raw = cell.rawValue as VariableValue
    if (raw.type === VariableManipulatorUtils.VAR_TYPE.text && getFlatCellValue) {
      return engine.sync.getValue(variableId)
    }
    return raw
  }

  return engine.sync.getValue(variableId)
}

export function getVariableType(
  name: string,
  documentEditor: DocumentEditorModel | string
): string | undefined {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return undefined

  const documentId = getDocumentId(resolvedEditor)
  const variableMap = _variableMaps.get(documentId)
  const variableId = resolveVariableId(name, resolvedEditor)

  if (!variableMap || !variableId || !variableMap.has(variableId)) {
    return undefined
  }

  const cell = variableMap.get(variableId)

  if (cell?.rawValue && typeof cell.rawValue === 'object') {
    return 'object'
  }

  const engine = getEngine(documentId)
  const value = engine.sync.getValue(variableId)
  return typeof value

  // Infer primitive type
  // switch (typeof value) {
  //     case "string":
  //         return VariableManipulatorUtils.VAR_TYPE.text
  //     case "number":
  //         return "number"
  //     case "boolean":
  //         return VariableManipulatorUtils.VAR_TYPE.boolean
  //     default:
  //         return "unknown"
  // }
}

export function isVariableSyncInProgress(documentEditor?: DocumentEditorModel | string): boolean {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return false
  const documentId = getDocumentId(resolvedEditor)
  if (!documentId) return false
  return syncingDocuments.has(documentId)
}

function notifyValueChange(
  documentEditor: DocumentEditorModel | string,
  variableIds?: string | string[]
) {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return

  const documentId = getDocumentId(resolvedEditor)
  if (documentId && syncingDocuments.has(documentId)) return
  const variableMap = _variableMaps.get(documentId)
  if (!variableMap) return

  const ids = Array.isArray(variableIds) ? variableIds : variableIds ? [variableIds] : []

  if (ids.length) {
    for (const id of ids) {
      if (!variableMap.has(id)) continue
      listeners.forEach((fn) =>
        fn(id, getVariable(id, resolvedEditor), VariableManipulatorUtils.VAR_UPDATE_TYPE.value)
      )
    }
    return
  }

  for (const [id] of variableMap) {
    listeners.forEach((fn) =>
      fn(id, getVariable(id, resolvedEditor), VariableManipulatorUtils.VAR_UPDATE_TYPE.value)
    )
  }
}

function notifyNameChange(
  variableId: string,
  newName: string,
  documentEditor: DocumentEditorModel | string
) {
  if (typeof documentEditor === 'string') {
    documentEditor = get(_$_documentEditorsList.get(documentEditor))
  }
  // for (const [name] of variableMap) {
  listeners.forEach((fn) => fn(variableId, newName, VariableManipulatorUtils.VAR_UPDATE_TYPE.name))
  // }
}

export function onVariableChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function validateFormulaInput(
  input: string,
  documentEditor: DocumentEditorModel | string,
  options?: { contextNodeId?: string }
): { valid: boolean; error?: string; translated?: string } {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) {
    return { valid: false, error: 'No active document' }
  }
  const documentId = getDocumentId(resolvedEditor)
  if (!documentId) {
    return { valid: false, error: 'No document id' }
  }
  const engine = getEngine(documentId)
  const contextNodeId = options?.contextNodeId
  const resolveId = (nameOrId: string) => resolveVariableId(nameOrId, resolvedEditor, contextNodeId)
  return engine.sync.validateFormula(input, { resolveId, contextNodeId })
}

// Export/import
/* export function exportVariables() {
    const obj = {}
    for (const [name] of _variableMap) {
        if (!hyperFormula.doesSheetExist(VariableManipulatorUtils.sheetName)) hyperFormula.addSheet(VariableManipulatorUtils.sheetName)
        const sheetId = hyperFormula.getSheetId(VariableManipulatorUtils.sheetName)

        if (sheetId === undefined) throw new Error(`Sheet "${VariableManipulatorUtils.sheetName}" does not exist!`)


        obj[name] = hyperFormula.getCellFormula({ sheet: sheetId, row: 0, col: _variableMap.get(name).col })
    }
    return JSON.stringify(obj, null, 2)
} */

/* export function importVariables(json) {
    const data = JSON.parse(json)
    for (const [name, val] of Object.entries(data)) {
        defineVariable(name, val)
    }
} */

export function listVariables(
  changedVarsName: string[] = [],
  documentEditor: DocumentEditorModel | string
): Variable[] {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return []

  const documentId = getDocumentId(resolvedEditor)
  const variableMap = _variableMaps.get(documentId)
  const vars: Variable[] = []
  const changedNames = Array.isArray(changedVarsName) ? changedVarsName : []

  if (!variableMap) return vars
  const engine = getEngine(documentId)

  for (const [id, cell] of variableMap) {
    if (typeof cell.rawValue === 'object') {
      const raw = cell.rawValue as VariableValue

      if (
        changedNames.length &&
        raw.type === VariableManipulatorUtils.VAR_TYPE.text &&
        typeof raw.value === 'string' &&
        VariableManipulatorUtils.extractExistingVars(raw.value, changedNames).length > 0
      ) {
        // no-op: values are recalculated in HyperFormula
      } else if (
        changedNames.length &&
        raw.type === VariableManipulatorUtils.VAR_TYPE.ai &&
        typeof raw.prompt === 'string' &&
        VariableManipulatorUtils.extractExistingVars(raw.prompt, changedNames).length > 0
      ) {
        runAI(
          raw.prompt,
          resolvedEditor,
          () => {},
          () => {},
          (dataOnDone) => {
            const newData: VariableValue = {
              ...raw,
              value: dataOnDone
            }
            setVariable(id, newData, resolvedEditor)
          }
        )
      }
    }

    vars.push({
      name: id,
      value: getVariable(id, resolvedEditor),
      rawValue: cell.rawValue,
      formula: engine.sync.getFormula(id)
    })
  }

  return vars
}

export function deleteVariable(nameOrId: string, documentEditor: DocumentEditorModel | string) {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return

  const documentId = getDocumentId(resolvedEditor)
  const variableMap = _variableMaps.get(documentId)
  if (!variableMap) return

  const variableId = resolveVariableId(nameOrId, resolvedEditor)
  if (!variableId || !variableMap.has(variableId)) {
    console.warn(`Variable "${nameOrId}" does not exist.`)
    return
  }

  const cell = variableMap.get(variableId)
  if (!cell) return

  const displayName = getPrimaryVariableName(cell.rawValue as VariableValue, nameOrId)
  const engine = getEngine(documentId)

  redoStack.length = 0
  pushToStack(undoStack, {
    type: 'delete',
    name: variableId,
    snapshot: { ...cell },
    timestamp: Date.now()
  })

  engine.sync.removeVariable(variableId)
  variableMap.delete(variableId)

  const escaped = escapeRegex(displayName)
  const braceRegex = new RegExp(`\\{${escaped}\\}`, 'g')
  const wordRegex = /\s/.test(displayName) ? null : new RegExp(`\\b${escaped}\\b`, 'g')

  for (const [id, vCell] of variableMap.entries()) {
    const raw = vCell.rawValue as VariableValue
    if (!raw) continue

    if (raw.type === VariableManipulatorUtils.VAR_TYPE.text && typeof raw.value === 'string') {
      let updatedExpr = raw.value.replace(braceRegex, '#REF!')
      if (wordRegex) {
        updatedExpr = updatedExpr.replace(wordRegex, '#REF!')
      }
      if (updatedExpr !== raw.value) {
        vCell.rawValue = { ...raw, value: updatedExpr }
        defineVariable(id, vCell.rawValue, false, resolvedEditor)
      }
    }

    if (raw.type === VariableManipulatorUtils.VAR_TYPE.ai && typeof raw.prompt === 'string') {
      let updatedPrompt = raw.prompt.replace(braceRegex, '#REF!')
      if (wordRegex) {
        updatedPrompt = updatedPrompt.replace(wordRegex, '#REF!')
      }
      if (updatedPrompt !== raw.prompt) {
        vCell.rawValue = { ...raw, prompt: updatedPrompt }
        defineVariable(id, vCell.rawValue, false, resolvedEditor)
      }
    }
  }

  const varStorePath = resolvedEditor?.document?.getVarsFilePath()
  if (varStorePath) {
    saveVarsToFile(varStorePath, serializeVariables(variableMap))
  }

  listeners.forEach((fn) =>
    fn(variableId, undefined, VariableManipulatorUtils.VAR_UPDATE_TYPE.delete)
  )
}

// --- Undo ---

export function undoLastDelete(documentEditor: DocumentEditorModel | string) {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return

  if (undoStack.length === 0) {
    console.warn('Nothing to undo.')
    return
  }

  const { type, name: variableId, snapshot } = undoStack.pop()
  if (type !== 'delete') {
    console.warn('Top of undo stack is not a delete action.')
    return
  }

  const documentId = getDocumentId(resolvedEditor)
  const variableMap = _variableMaps.get(documentId)
  if (!variableMap) return

  variableMap.set(variableId, snapshot)
  _variableMaps.set(documentId, variableMap)

  defineVariable(variableId, snapshot.rawValue, true, resolvedEditor)

  const displayName = getPrimaryVariableName(snapshot.rawValue as VariableValue, variableId)

  for (const [id, vCell] of variableMap.entries()) {
    const raw = vCell.rawValue as VariableValue
    if (!raw) continue

    if (raw.type === VariableManipulatorUtils.VAR_TYPE.text && typeof raw.value === 'string') {
      const restored = raw.value.replace(/#REF!/g, displayName)
      if (restored !== raw.value) {
        vCell.rawValue = { ...raw, value: restored }
        defineVariable(id, vCell.rawValue, false, resolvedEditor)
      }
    }

    if (raw.type === VariableManipulatorUtils.VAR_TYPE.ai && typeof raw.prompt === 'string') {
      const restored = raw.prompt.replace(/#REF!/g, displayName)
      if (restored !== raw.prompt) {
        vCell.rawValue = { ...raw, prompt: restored }
        defineVariable(id, vCell.rawValue, false, resolvedEditor)
      }
    }
  }

  pushToStack(redoStack, { type: 'restore', name: variableId, snapshot })

  const varStorePath = resolvedEditor?.document?.getVarsFilePath()
  if (varStorePath) {
    saveVarsToFile(varStorePath, serializeVariables(variableMap))
  }

  listeners.forEach((fn) =>
    fn(variableId, snapshot.rawValue, VariableManipulatorUtils.VAR_UPDATE_TYPE.value)
  )
}

// --- Redo ---]

export function redoLastDelete(documentEditor: DocumentEditorModel | string) {
  const resolvedEditor = resolveDocumentEditor(documentEditor)
  if (!resolvedEditor) return

  if (redoStack.length === 0) {
    console.warn('Nothing to redo.')
    return
  }

  const { type, name: variableId, snapshot } = redoStack.pop()
  if (type !== 'restore') {
    console.warn('Top of redo stack is not a restore action.')
    return
  }

  const documentId = getDocumentId(resolvedEditor)
  const variableMap = _variableMaps.get(documentId)
  if (!variableMap) return

  pushToStack(undoStack, { type: 'delete', name: variableId, snapshot })

  const engine = getEngine(documentId)
  engine.sync.removeVariable(variableId)
  variableMap.delete(variableId)

  const displayName = getPrimaryVariableName(snapshot.rawValue as VariableValue, variableId)
  const escaped = escapeRegex(displayName)
  const braceRegex = new RegExp(`\\{${escaped}\\}`, 'g')
  const wordRegex = /\s/.test(displayName) ? null : new RegExp(`\\b${escaped}\\b`, 'g')

  for (const [id, vCell] of variableMap.entries()) {
    const raw = vCell.rawValue as VariableValue
    if (!raw) continue

    if (raw.type === VariableManipulatorUtils.VAR_TYPE.text && typeof raw.value === 'string') {
      let updatedExpr = raw.value.replace(braceRegex, '#REF!')
      if (wordRegex) {
        updatedExpr = updatedExpr.replace(wordRegex, '#REF!')
      }
      if (updatedExpr !== raw.value) {
        vCell.rawValue = { ...raw, value: updatedExpr }
        defineVariable(id, vCell.rawValue, false, resolvedEditor)
      }
    }

    if (raw.type === VariableManipulatorUtils.VAR_TYPE.ai && typeof raw.prompt === 'string') {
      let updatedPrompt = raw.prompt.replace(braceRegex, '#REF!')
      if (wordRegex) {
        updatedPrompt = updatedPrompt.replace(wordRegex, '#REF!')
      }
      if (updatedPrompt !== raw.prompt) {
        vCell.rawValue = { ...raw, prompt: updatedPrompt }
        defineVariable(id, vCell.rawValue, false, resolvedEditor)
      }
    }
  }

  const varStorePath = resolvedEditor?.document?.getVarsFilePath()
  if (varStorePath) {
    saveVarsToFile(varStorePath, serializeVariables(variableMap))
  }

  listeners.forEach((fn) =>
    fn(variableId, undefined, VariableManipulatorUtils.VAR_UPDATE_TYPE.delete)
  )
}

export function serializeVariables(variableMap: Map<string, VariableMap>) {
  if (!variableMap) return {}

  const vars: Record<string, any> = {}
  for (const [id, cell] of variableMap) {
    vars[id] = cell.rawValue
  }
  return vars
}
