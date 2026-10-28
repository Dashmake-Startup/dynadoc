import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import chokidar from 'chokidar'
import * as Y from 'yjs'
import type { WebContents } from 'electron'

export type SpreadsheetCellRequest = {
  path: string
  cellRef: string
}

type CacheEntry = {
  sheets: any[]
  updatedAt: number
  cellIndex: Map<string, Map<string, any>>
}

class LruCache<K, V> {
  private maxSize: number
  private map: Map<K, V>

  constructor(maxSize: number) {
    this.maxSize = maxSize
    this.map = new Map()
  }

  get(key: K): V | undefined {
    const value = this.map.get(key)
    if (!value) return undefined
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V) {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
  }

  delete(key: K) {
    this.map.delete(key)
  }
}

export class SpreadsheetManager {
  private cache = new LruCache<string, CacheEntry>(12)
  private watcher = chokidar.watch([], { ignoreInitial: true })
  private watchers = new Map<string, Set<number>>()
  private webContents = new Map<number, WebContents>()

  constructor() {
    this.watcher.on('change', (filePath) => {
      this.cache.delete(filePath)
      const targets = this.watchers.get(filePath)
      if (!targets) return
      for (const id of targets) {
        const wc = this.webContents.get(id)
        if (wc && !wc.isDestroyed()) {
          wc.send('spreadsheet:file-changed', { path: filePath })
        }
      }
    })
  }

  async getCellValue(payload: SpreadsheetCellRequest) {
    const filePath = payload.path
    if (!filePath) return { value: '#REF_ERROR!' }
    if (!fsSync.existsSync(filePath)) return { value: '#FILE_NOT_FOUND!' }

    const { sheetName, cellRef } = this.parseCellRef(payload.cellRef)
    const entry = await this.getOrLoad(filePath)
    const sheet = this.resolveSheet(entry.sheets, sheetName)
    if (!sheet) return { value: '#REF_ERROR!' }

    const sheetKey = sheet.name || sheet.id || 'sheet'
    const sheetIndex = entry.cellIndex.get(sheetKey)
    if (!sheetIndex) return { value: '#REF_ERROR!' }

    if (cellRef.includes(':')) {
      const range = this.parseRange(cellRef)
      if (!range) return { value: '#REF_ERROR!' }
      const rows: string[] = []
      for (let r = range.start.row; r <= range.end.row; r++) {
        const cols: string[] = []
        for (let c = range.start.col; c <= range.end.col; c++) {
          const cellKey = `${r}:${c}`
          const cell = sheetIndex.get(cellKey)
          if (!cell) {
            cols.push('')
          } else if (typeof cell === 'object' && cell !== null) {
            cols.push(String((cell as any).v ?? (cell as any).m ?? ''))
          } else {
            cols.push(String(cell))
          }
        }
        rows.push(cols.join('\t'))
      }
      return { value: rows.join('\n') }
    }

    const pos = this.parseA1(cellRef)
    if (!pos) return { value: '#REF_ERROR!' }

    const cellKey = `${pos.row}:${pos.col}`
    const cell = sheetIndex.get(cellKey)

    if (!cell) return { value: '' }
    if (typeof cell === 'object' && cell !== null) {
      return { value: (cell as any).v ?? (cell as any).m ?? '' }
    }
    return { value: cell }
  }

  async getCellsValues(requests: SpreadsheetCellRequest[]) {
    const results: Record<string, any> = {}
    for (const req of requests) {
      const res = await this.getCellValue(req)
      results[`${req.path}!${req.cellRef}`] = res.value
    }
    return results
  }

  async atomicWrite(targetPath: string, data: string | Buffer) {
    const dir = path.dirname(targetPath)
    if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true })
    const tempPath = `${targetPath}.tmp-${Date.now()}`
    await fs.writeFile(tempPath, data)
    await fs.rename(tempPath, targetPath)
    return { ok: true }
  }

  watch(filePath: string, sender: WebContents) {
    if (!filePath) return
    const id = sender.id
    this.webContents.set(id, sender)
    if (!this.watchers.has(filePath)) {
      this.watchers.set(filePath, new Set())
      this.watcher.add(filePath)
    }
    this.watchers.get(filePath)!.add(id)
  }

  unwatch(filePath: string, sender: WebContents) {
    const id = sender.id
    const set = this.watchers.get(filePath)
    if (!set) return
    set.delete(id)
    if (set.size === 0) {
      this.watchers.delete(filePath)
      this.watcher.unwatch(filePath)
    }
  }

  private async getOrLoad(filePath: string): Promise<CacheEntry> {
    const cached = this.cache.get(filePath)
    if (cached) return cached
    const sheets = await this.loadSheets(filePath)
    const cellIndex = this.buildIndex(sheets)
    const entry: CacheEntry = { sheets, updatedAt: Date.now(), cellIndex }
    this.cache.set(filePath, entry)
    return entry
  }

  private async loadSheets(filePath: string): Promise<any[]> {
    const raw = await fs.readFile(filePath)
    const text = raw.toString('utf8')
    try {
      const json = JSON.parse(text)
      if (Array.isArray(json)) return json
      if (Array.isArray(json?.sheets)) return json.sheets
      return []
    } catch {
      try {
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(raw))
        const snapshot = ydoc.getMap('snapshot').get('sheets') as any
        if (Array.isArray(snapshot)) return snapshot
        return []
      } catch {
        return []
      }
    }
  }

  private buildIndex(sheets: any[]) {
    const index = new Map<string, Map<string, any>>()
    for (const sheet of sheets || []) {
      const map = new Map<string, any>()
      const sheetKey = sheet?.name || sheet?.id || 'sheet'
      const cells = sheet?.celldata || []
      for (const cell of cells) {
        if (!cell) continue
        const key = `${cell.r}:${cell.c}`
        map.set(key, cell.v ?? cell)
      }
      index.set(sheetKey, map)
    }
    return index
  }

  private resolveSheet(sheets: any[], sheetName?: string) {
    if (!sheets?.length) return null
    if (!sheetName) return sheets[0]
    return (
      sheets.find((s) => s?.name === sheetName || s?.id === sheetName) ||
      sheets[0]
    )
  }

  private parseCellRef(cellRef: string) {
    if (!cellRef) return { sheetName: undefined, cellRef: '' }
    const parts = cellRef.split('!')
    if (parts.length >= 2) {
      return { sheetName: parts[0], cellRef: parts.slice(1).join('!') }
    }
    return { sheetName: undefined, cellRef }
  }

  private parseA1(ref: string) {
    const match = /^([A-Z]+)(\d+)$/i.exec(ref.trim())
    if (!match) return null
    const letters = match[1].toUpperCase()
    const row = parseInt(match[2], 10) - 1
    let col = 0
    for (let i = 0; i < letters.length; i++) {
      col = col * 26 + (letters.charCodeAt(i) - 64)
    }
    return { row, col: col - 1 }
  }

  private parseRange(ref: string) {
    const parts = ref.split(':')
    if (parts.length !== 2) return null
    const start = this.parseA1(parts[0])
    const end = this.parseA1(parts[1])
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
}
