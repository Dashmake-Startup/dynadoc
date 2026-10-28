import type { faker as FakerType } from '@faker-js/faker'
import type { EditorState } from '@tiptap/pm/state'

const fakerCache = new Map<string, typeof FakerType>()

export async function getFakerByLocale(locale?: string) {
  const normalized = (locale || 'en').replace('-', '_')

  if (fakerCache.has(normalized)) {
    return fakerCache.get(normalized)!
  }

  try {
    // Dynamic locale import
    const module = await import(
      /* @vite-ignore */
      `@faker-js/faker/locale/${normalized}`
    )

    const faker = module.faker
    fakerCache.set(normalized, faker)
    return faker
  } catch {
    // Fallback to EN — loaded on demand like the locale modules above, so
    // @faker-js/faker (~0.5 MB) doesn't sit on the first-render critical
    // path for documents that never use dummy-content generation.
    const { faker: baseFaker } = await import('@faker-js/faker')
    fakerCache.set(normalized, baseFaker)
    return baseFaker
  }
}



export function detectLocale(
  state: EditorState,
  editorElement?: HTMLElement
): string {
  const { selection, doc } = state

  // 1️⃣ Document language
  const docLang = doc.attrs?.lang
  if (docLang) return normalizeLocale(docLang)

  // 2️⃣ Closest parent node language
  const $from = selection.$from
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)
    const lang = node.attrs?.lang
    if (lang) return normalizeLocale(lang)
  }

  // 3️⃣ HTML lang on editor root
  if (editorElement) {
    const htmlLang = editorElement.getAttribute('lang')
    if (htmlLang) return normalizeLocale(htmlLang)
  }

  // 4️⃣ Browser / OS language
  if (typeof navigator !== 'undefined') {
    return normalizeLocale(navigator.language)
  }

  // 5️⃣ Final fallback
  return 'en'
}

function normalizeLocale(locale: string): string {
  // Convert: en-US → en_US (faker format)
  return locale.replace('-', '_')
}
