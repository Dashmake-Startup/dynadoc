import Utils from "../../../../utils/Utils";
import ISO6391 from 'iso-639-1'
import { nodeApi } from '../../../../utils/shims/node'

// const fs = nodeApi.fs
// const path = nodeApi.path

// const fs = window.node?.fs
// const path = window.node?.path

// const fs = window.node?.fs
// const path = window.node?.path

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

export const translateRegions: Record<string, string[]> = {
  en: ['US', 'GB', 'CA', 'AU', 'IN', 'IE', 'NZ', 'SG'],
  fr: ['FR', 'CA', 'BE', 'CH', 'LU'],
  es: ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'US'],
  pt: ['PT', 'BR', 'AO', 'MZ'],
  zh: ['CN', 'TW', 'HK', 'SG'],
  de: ['DE', 'AT', 'CH'],
  ar: ['SA', 'EG', 'AE'],
  it: ['IT', 'CH'],
  nl: ['NL', 'BE'],
  ja: ['JP'],
  ko: ['KR'],
  ru: ['RU'],
  hi: ['IN'],
  tr: ['TR'],
  vi: ['VN'],
  th: ['TH'],
  id: ['ID'],
  ms: ['MY', 'SG'],
  sw: ['KE', 'TZ'],
  ur: ['PK', 'IN']
}

export const getTranslationLanguages = () => {
  const baseCodes = ISO6391.getAllCodes()
  const list: { name: string; code: string }[] = []

  const getFullNativeName = (locale: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: 'language' }).of(locale)
    } catch {
      return null
    }
  }

  for (const code of baseCodes) {
    const nativeName = ISO6391.getNativeName(code)
    list.push({ name: nativeName, code })

    if (translateRegions[code]) {
      translateRegions[code].forEach((region) => {
        const fullCode = `${code}-${region}`
        const regionalName = getFullNativeName(fullCode)
        list.push({
          name: regionalName || `${nativeName} (${region})`,
          code: fullCode
        })
      })
    }
  }
  return list
}

export const getTranslationLanguageName = (code: string) => {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) || code
  } catch {
    return code
  }
}

export interface TranslationUnit {
  id: string; // The UUID
  originalHtml: string;
  originalJson: any;
  translatedJson: any;
  translatedHtml: any;
  isStale: boolean;
}

const malformedDocOnce = new Set<string>()

const isLikelyJson = (value: string) => {
  const trimmed = value.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

const emptyDoc = () => ({ type: 'doc', content: [] })

const safeParseDoc = (raw: string, filePath: string) => {
  if (!raw || !isLikelyJson(raw)) {
    if (filePath && !malformedDocOnce.has(filePath)) {
      malformedDocOnce.add(filePath)
      console.warn('Translation doc is not JSON. Initializing new doc structure.', { filePath })
    }
    return emptyDoc()
  }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.content)) {
      if (filePath && !malformedDocOnce.has(filePath)) {
        malformedDocOnce.add(filePath)
        console.warn('Malformed Tiptap file. Initializing new doc structure.', { filePath })
      }
      return emptyDoc()
    }
    return parsed
  } catch {
    if (filePath && !malformedDocOnce.has(filePath)) {
      malformedDocOnce.add(filePath)
      console.warn('Malformed Tiptap file. Initializing new doc structure.', { filePath })
    }
    return emptyDoc()
  }
}

function saveTranslationBatchForPath(changes, translatedFilePath: string) {
  if (!translatedFilePath || typeof translatedFilePath !== 'string') return null

  try {
    let doc = emptyDoc()

    // 1. Read existing Tiptap Doc
    if (nodeApi.fs.existsSync(translatedFilePath)) {
      const fileContent = nodeApi.fs.readFileSync(translatedFilePath, 'utf-8')
      doc = safeParseDoc(fileContent, translatedFilePath)
    }

    // 2. Create a Map of the updates for O(1) lookup during the merge
    const updates = new Map(
      changes
        .map(([id, data]) => [id, data?.json])
        .filter(([id, json]) => Boolean(id) && Boolean(json))
    )
    if (updates.size === 0) return { success: true }

    // 3. Update existing nodes or Add new ones
    let foundIds = new Set()

    doc.content = (doc.content || []).map((node: any) => {
      const nodeUuid = node.attrs?.uuid || node.attrs?.uid
      if (updates.has(nodeUuid)) {
        foundIds.add(nodeUuid)
        const updatedNode = updates.get(nodeUuid)
        if (updatedNode && updatedNode.attrs) {
          updatedNode.attrs.uuid = updatedNode.attrs.uuid || nodeUuid
          updatedNode.attrs.uid = updatedNode.attrs.uid || nodeUuid
        }
        return updatedNode
      }
      return node
    })

    // 4. Append missing
    updates.forEach((newNode, uuid) => {
      if (!foundIds.has(uuid)) {
        if (newNode && newNode.attrs) {
          newNode.attrs.uuid = newNode.attrs.uuid || uuid
          newNode.attrs.uid = newNode.attrs.uid || uuid
        }
        doc.content.push(newNode)
      }
    })

    // 5. Write back to disk
    const updatedContent = JSON.stringify(doc, null, 2)
    Utils.saveToFileDebounced(translatedFilePath, updatedContent, () => {
      console.log(`✅ Patched ${changes.length} nodes in Tiptap doc.`)
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to batch save Tiptap doc:', error)
    return { success: false }
  }
}

export function saveTranslationBatch(changes) {
  // changes is: [ [nodeId, { json, translatedFilePath }], ... ]
  if (!changes || changes.length === 0) return null

  const grouped = new Map<string, any[]>()
  changes.forEach(([id, data]) => {
    const translatedFilePath = data?.translatedFilePath
    if (!translatedFilePath) return
    const list = grouped.get(translatedFilePath) || []
    list.push([id, data])
    grouped.set(translatedFilePath, list)
  })

  if (grouped.size === 0) return null

  let allOk = true
  grouped.forEach((groupChanges, translatedFilePath) => {
    const result = saveTranslationBatchForPath(groupChanges, translatedFilePath)
    if (result?.success === false) allOk = false
  })

  return { success: allOk }
}

export const getFlagEmoji1 = (pathOrLocale: string ) => {
  const parts = pathOrLocale.split('.')
  // Assumes format path: name.locale.json
  // Assumes format locale: en or en-GB
  const locale = parts.length > 2 ? parts[parts.length - 2] : ''
  if (!locale) return '🌐'

  const region = locale.includes('-') ? locale.split('-')[1] : locale
  const map: Record<string, string> = {
    en: 'US',
    fr: 'FR',
    es: 'ES',
    pt: 'PT',
    de: 'DE',
    zh: 'CN',
    ja: 'JP',
    ar: 'SA',
    it: 'IT',
    nl: 'NL',
    ko: 'KR',
    ru: 'RU',
    hi: 'IN',
    tr: 'TR',
    vi: 'VN',
    th: 'TH',
    id: 'ID',
    ms: 'MY',
    sw: 'KE',
    ur: 'PK'
  };

  const code = (region.length === 2 ? region : map[region.toLowerCase()] || '').toUpperCase()

  return code.replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
}

export const getFlagEmoji = (pathOrLocale: string) => {
  const parts = pathOrLocale.split('.');
  
  // 1. Extract Locale: Handle "name.en-US.json" or just "en-US"
  let locale = parts.length >= 2 ? parts[parts.length - 2] : pathOrLocale;
  if (!locale || locale.includes('/') || locale.includes('\\')) {
     // Fallback for raw strings that aren't paths
     locale = pathOrLocale; 
  }

  // 2. Extract Region or Language
  // If "en-GB", region is "GB". If "en", region is "en".
  const regionOrLang = locale.includes('-') ? locale.split('-')[1] : locale;

  const map: Record<string, string> = {
    en: 'US', // Default 'en' to US
    fr: 'FR',
    es: 'ES',
    pt: 'PT',
    de: 'DE',
    zh: 'CN',
    ja: 'JP',
    ar: 'SA',
    it: 'IT',
    nl: 'NL',
    ko: 'KR',
    ru: 'RU',
    hi: 'IN',
    tr: 'TR',
    vi: 'VN',
    th: 'TH',
    id: 'ID',
    ms: 'MY',
    sw: 'KE',
    ur: 'PK'
  };

  // 3. Logic Correction:
  // If the regionOrLang is a known language key, use the map.
  // Otherwise, if it's a 2-letter code, assume it's already a Region (like GB, US, FR).
  const cleanKey = regionOrLang.toLowerCase();
  const countryCode = (map[cleanKey] || (regionOrLang.length === 2 ? regionOrLang : ''))
    .toUpperCase();

  if (!countryCode || countryCode.length !== 2) return '🌐';

  // 4. Convert to Regional Indicator Symbols
  // 127397 is the offset between 'A' (65) and 🇦 (127462)
  return countryCode.replace(/./g, (char) => 
    String.fromCodePoint(char.charCodeAt(0) + 127397)
  );
};
