import type { Editor } from '@tiptap/core'
import Platform from '../../libs/platform'
import { resolveApiBaseUrl } from '../../lib/api/shared/baseUrl'

type FontResolution = {
  requested: string
  alias: string
  realName: string
  url: string
}

const CORE_EQUIVALENTS: Record<string, { realName: string; fallbackUrl?: string }> = {
  Calibri: { realName: 'Carlito', fallbackUrl: '/fonts/croscore/Carlito-Regular.ttf' },
  Cambria: { realName: 'Caladea', fallbackUrl: '/fonts/croscore/Caladea-Regular.ttf' },
  Arial: { realName: 'Arimo', fallbackUrl: '/fonts/croscore/Arimo-Regular.ttf' },
  'Times New Roman': { realName: 'Tinos', fallbackUrl: '/fonts/croscore/Tinos-Regular.ttf' },
  Consolas: { realName: 'Cousine', fallbackUrl: '/fonts/croscore/Cousine-Regular.ttf' },
  'Lucida Handwriting': { realName: 'Lumanosimo', fallbackUrl: '/fonts/croscore/Lumanosimo-Regular.ttf' }
}

const loadedFonts = new Set<string>()
const inflightFonts = new Map<string, Promise<void>>()
let pendingFonts = new Set<string>()
let resolveTimer: number | null = null

function normalizeFontName(value: string) {
  return value.replace(/["']/g, '').trim()
}

function extractFontsFromStyle(styleValue: string) {
  const match = styleValue.match(/font-family\s*:\s*([^;]+)/i)
  if (!match?.[1]) return []
  return match[1]
    .split(',')
    .map((entry) => normalizeFontName(entry))
    .filter(Boolean)
}

function collectFontsFromNode(node: any, fonts: Set<string>) {
  if (!node || typeof node !== 'object') return
  const attrs = node.attrs || {}
  if (typeof attrs.fontFamily === 'string') {
    normalizeFontName(attrs.fontFamily)
      .split(',')
      .map((entry) => normalizeFontName(entry))
      .filter(Boolean)
      .forEach((font) => fonts.add(font))
  }
  if (typeof attrs.style === 'string') {
    extractFontsFromStyle(attrs.style).forEach((font) => fonts.add(font))
  }
  if (Array.isArray(node.marks)) {
    node.marks.forEach((mark: any) => {
      const markAttrs = mark?.attrs || {}
      if (typeof markAttrs.fontFamily === 'string') {
        normalizeFontName(markAttrs.fontFamily)
          .split(',')
          .map((entry) => normalizeFontName(entry))
          .filter(Boolean)
          .forEach((font) => fonts.add(font))
      }
      if (typeof markAttrs.style === 'string') {
        extractFontsFromStyle(markAttrs.style).forEach((font) => fonts.add(font))
      }
    })
  }
  if (Array.isArray(node.content)) {
    node.content.forEach((child: any) => collectFontsFromNode(child, fonts))
  }
}

function extractFontsFromJson(doc: any): string[] {
  const fonts = new Set<string>()
  collectFontsFromNode(doc, fonts)
  return Array.from(fonts).filter(Boolean)
}

async function resolveFontsFromBackend(fonts: string[]): Promise<FontResolution[]> {
  const payload = {
    fonts,
    platform: Platform.getPlatform?.() || 'unknown',
    os: navigator?.platform || 'unknown'
  }
  const serverFonts = (window as any).server?.fonts?.resolve
  if (serverFonts) {
    const result = await serverFonts(payload)
    if (Array.isArray(result?.fonts)) return result.fonts
    if (Array.isArray(result?.data)) return result.data
    return []
  }

  const url = `${resolveApiBaseUrl()}/api/fonts/resolve`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) return []
  const data = await res.json().catch(() => ({}))
  return Array.isArray(data?.fonts) ? data.fonts : []
}

async function loadFontFace(alias: string, url: string) {
  if (!url) return
  if (document?.fonts?.check?.(`12px "${alias}"`)) {
    loadedFonts.add(alias)
    return
  }
  const font = new FontFace(alias, `url(${url})`)
  await font.load()
  document.fonts.add(font)
  loadedFonts.add(alias)
}

async function resolveAndLoadFonts(fonts: string[]) {
  const normalized = fonts.map((font) => normalizeFontName(font)).filter(Boolean)
  const missing = normalized.filter((font) => !loadedFonts.has(font))
  if (!missing.length) return

  const resolutions = await resolveFontsFromBackend(missing)
  const resolvedMap = new Map(resolutions.map((res) => [normalizeFontName(res.requested), res]))

  await Promise.all(
    missing.map(async (fontName) => {
      if (loadedFonts.has(fontName)) return
      if (inflightFonts.has(fontName)) return inflightFonts.get(fontName)
      const task = (async () => {
        const resolution = resolvedMap.get(fontName)
        if (resolution?.url) {
          await loadFontFace(fontName, resolution.url)
          return
        }
        const fallback = CORE_EQUIVALENTS[fontName]
        if (fallback?.fallbackUrl) {
          await loadFontFace(fontName, fallback.fallbackUrl)
        }
      })()
      inflightFonts.set(fontName, task)
      try {
        await task
      } finally {
        inflightFonts.delete(fontName)
      }
    })
  )
}

function scheduleResolve() {
  if (resolveTimer != null) return
  resolveTimer = window.setTimeout(async () => {
    const fonts = Array.from(pendingFonts)
    pendingFonts = new Set()
    resolveTimer = null
    if (!fonts.length) return
    await resolveAndLoadFonts(fonts)
  }, 300)
}

export function queueFontResolveFromJson(doc: any) {
  const fonts = extractFontsFromJson(doc)
  if (!fonts.length) return
  fonts.forEach((font) => pendingFonts.add(font))
  scheduleResolve()
}

export function queueFontResolveFromEditor(editor: Editor | null | undefined) {
  if (!editor) return
  try {
    queueFontResolveFromJson(editor.getJSON())
  } catch {
    // ignore
  }
}
