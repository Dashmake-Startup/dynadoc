import HyperFormula, { type ExportedChange } from 'hyperformula'

type RawCellContent = any

type GroupEntry = {
    nodeId: string
    sheetName: string
    sheetId: number
    coords: Map<string, { row: number; col: number }>
}

export type RangeResolution = {
    nodeId: string
    sheetName: string
    start: string
    end: string
}

const normalizeNamedExpression = (uuid: string): string => {
    const safe = String(uuid || '')
        .replace(/[^A-Za-z0-9_]/g, '_')
        .replace(/_{2,}/g, '_')
    return safe.startsWith('_') ? safe : `_v_${safe}`
}

const hashString = (value: string): string => {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i)
        hash |= 0
    }
    return Math.abs(hash).toString(36)
}

const sanitizeSheetName = (nodeId: string): string => {
    const safe = (nodeId || 'group').replace(/[^A-Za-z0-9_]/g, '_')
    const trimmed = safe.slice(0, 18) || 'group'
    return `G_${trimmed}_${hashString(nodeId).slice(0, 6)}`
}

const colToLetter = (col: number) => {
    let s = ''
    let c = col + 1
    while (c > 0) {
        const m = (c - 1) % 26
        s = String.fromCharCode(65 + m) + s
        c = Math.floor((c - m) / 26)
    }
    return s
}

const a1ToRowCol = (coord: string): { row: number; col: number } | null => {
    const match = /^([A-Z]+)([1-9]\d*)$/i.exec(coord.trim())
    if (!match) return null
    const [, colLetters, rowStr] = match
    let col = 0
    const letters = colLetters.toUpperCase()
    for (let i = 0; i < letters.length; i += 1) {
        col = col * 26 + (letters.charCodeAt(i) - 64)
    }
    return { row: Number(rowStr) - 1, col: col - 1 }
}

const rowColToA1 = (row: number, col: number) => `${colToLetter(col)}${row + 1}`

export class Registry {
    private groups = new Map<string, GroupEntry>()
    private variableToGroup = new Map<string, string>()
    private namedExpressions = new Map<string, string>()
    private nameToUuid = new Map<string, string>()

    constructor(private hf: HyperFormula) {}

    getNamedExpressionName(uuid: string): string {
        let name = this.namedExpressions.get(uuid)
        if (name) return name
        name = normalizeNamedExpression(uuid)
        this.namedExpressions.set(uuid, name)
        this.nameToUuid.set(name.toLowerCase(), uuid)
        return name
    }

    getUuidForNamedExpression(name: string): string | null {
        if (!name) return null
        return this.nameToUuid.get(name.toLowerCase()) || null
    }

    hasNamedExpression(uuid: string): boolean {
        const name = this.getNamedExpressionName(uuid)
        return Boolean(this.hf.getNamedExpression(name))
    }

    ensureNamedExpression(uuid: string, content: RawCellContent): ExportedChange[] {
        const name = this.getNamedExpressionName(uuid)
        if (this.hf.getNamedExpression(name)) {
            return this.hf.changeNamedExpression(name, content)
        }
        return this.hf.addNamedExpression(name, content)
    }

    removeNamedExpression(uuid: string): void {
        const name = this.getNamedExpressionName(uuid)
        if (this.hf.getNamedExpression(name)) {
            this.hf.removeNamedExpression(name)
        }
    }

    unregisterVariable(uuid: string): void {
        const nodeId = this.variableToGroup.get(uuid)
        if (nodeId) {
            const group = this.groups.get(nodeId)
            group?.coords.delete(uuid)
            this.variableToGroup.delete(uuid)
        }
    }

    getUuidsFromChanges(changes?: ExportedChange[] | null): string[] {
        if (!Array.isArray(changes)) return []
        const result = new Set<string>()
        for (const change of changes) {
            if (!change || typeof change !== 'object') continue
            if ('name' in change && typeof change.name === 'string') {
                const uuid = this.getUuidForNamedExpression(change.name)
                if (uuid) result.add(uuid)
            }
        }
        return Array.from(result)
    }

    ensureGroup(nodeId: string): GroupEntry {
        let group = this.groups.get(nodeId)
        if (group) return group

        const sheetName = sanitizeSheetName(nodeId)
        if (!this.hf.doesSheetExist(sheetName)) {
            this.hf.addSheet(sheetName)
        }

        const sheetId = this.hf.getSheetId(sheetName)
        if (sheetId === undefined) {
            throw new Error(`Sheet "${sheetName}" could not be created`)
        }

        group = {
            nodeId,
            sheetName,
            sheetId,
            coords: new Map()
        }
        this.groups.set(nodeId, group)
        return group
    }

    getSheetName(nodeId: string): string | null {
        const group = this.groups.get(nodeId)
        return group?.sheetName || null
    }

    registerVariable(
        uuid: string,
        nodeId?: string,
        coord?: { row: number; col: number } | string | null
    ): void {
        if (!nodeId) return
        this.setCoordinate(uuid, nodeId, coord)
    }

    setCoordinate(
        uuid: string,
        nodeId: string,
        coord?: { row: number; col: number } | string | null
    ): void {
        const group = this.ensureGroup(nodeId)
        const previousGroup = this.variableToGroup.get(uuid)
        if (previousGroup && previousGroup !== nodeId) {
            const prev = this.groups.get(previousGroup)
            prev?.coords.delete(uuid)
        }
        this.variableToGroup.set(uuid, nodeId)

        if (!group.coords.has(uuid)) {
            let resolved = coord
            if (typeof resolved === 'string') {
                resolved = a1ToRowCol(resolved)
            }
            if (!resolved || typeof resolved !== 'object') {
                resolved = { row: 0, col: group.coords.size }
            }
            group.coords.set(uuid, resolved)
        } else if (coord) {
            let resolved = coord
            if (typeof resolved === 'string') {
                resolved = a1ToRowCol(resolved)
            }
            if (resolved && typeof resolved === 'object') {
                group.coords.set(uuid, resolved)
            }
        }

        const location = group.coords.get(uuid)
        if (!location) return
        const namedExpression = this.getNamedExpressionName(uuid)
        const cellAddress = { sheet: group.sheetId, row: location.row, col: location.col }
        this.hf.setCellContents(cellAddress, `=${namedExpression}`)
    }

    getCoordinate(uuid: string): { sheetName: string; row: number; col: number; nodeId: string } | null {
        const nodeId = this.variableToGroup.get(uuid)
        if (!nodeId) return null
        const group = this.groups.get(nodeId)
        if (!group) return null
        const coord = group.coords.get(uuid)
        if (!coord) return null
        return { sheetName: group.sheetName, row: coord.row, col: coord.col, nodeId }
    }

    resolveRange(uuidA: string, uuidB: string): RangeResolution | null {
        const coordA = this.getCoordinate(uuidA)
        const coordB = this.getCoordinate(uuidB)
        if (!coordA || !coordB) return null
        if (coordA.nodeId !== coordB.nodeId) return null
        const startRow = Math.min(coordA.row, coordB.row)
        const endRow = Math.max(coordA.row, coordB.row)
        const startCol = Math.min(coordA.col, coordB.col)
        const endCol = Math.max(coordA.col, coordB.col)
        return {
            nodeId: coordA.nodeId,
            sheetName: coordA.sheetName,
            start: rowColToA1(startRow, startCol),
            end: rowColToA1(endRow, endCol)
        }
    }
}

export class FormulaTranslator {
    constructor(private registry: Registry) {}

    private toAbsoluteRef(ref: string): string {
        const match = /^([A-Z]+)([1-9]\d*)$/i.exec(ref)
        if (!match) return ref
        return `$${match[1].toUpperCase()}$${match[2]}`
    }

    private toAbsoluteRange(ref: string): string {
        if (!ref) return ref
        if (!ref.includes(':')) return this.toAbsoluteRef(ref)
        const [start, end] = ref.split(':')
        return `${this.toAbsoluteRef(start)}:${this.toAbsoluteRef(end)}`
    }

    translateFormula(
        input: string,
        options?: {
            resolveId?: (nameOrId: string) => string | null
            contextNodeId?: string
        }
    ): string {
        if (!input) return ''
        const trimmed = input.trim()
        const hasEquals = trimmed.startsWith('=')
        let expr = hasEquals ? trimmed.slice(1) : trimmed

        const resolveId = options?.resolveId

        expr = expr.replace(/\{([^}]+)\}\s*:\s*\{([^}]+)\}/g, (match, rawStart, rawEnd) => {
            const startId = resolveId ? resolveId(rawStart.trim()) : rawStart.trim()
            const endId = resolveId ? resolveId(rawEnd.trim()) : rawEnd.trim()
            if (!startId || !endId) return '#REF!'
            const range = this.registry.resolveRange(startId, endId)
            if (!range) return '#REF!'
            const absolute = this.toAbsoluteRange(`${range.start}:${range.end}`)
            return `${range.sheetName}!${absolute}`
        })

        expr = expr.replace(/\{([^}]+)\}/g, (match, rawId) => {
            const resolved = resolveId ? resolveId(rawId.trim()) : rawId.trim()
            if (!resolved) return '#NAME?'
            return this.registry.getNamedExpressionName(resolved)
        })

        const contextSheet = options?.contextNodeId
            ? this.registry.getSheetName(options.contextNodeId)
            : null
        if (contextSheet) {
            const rangeRegex = /\b[A-Z]+[1-9]\d*(?::[A-Z]+[1-9]\d*)?\b/g
            expr = expr.replace(rangeRegex, (match, offset, full) => {
                if (offset > 0 && full[offset - 1] === '!') return match
                return `${contextSheet}!${this.toAbsoluteRange(match)}`
            })
        }

        return hasEquals ? `=${expr}` : expr
    }
}

export class SyncManager {
    constructor(
        private hf: HyperFormula,
        private registry: Registry,
        private translator: FormulaTranslator
    ) {}

    private validationSheetId: number | null = null

    private ensureValidationSheet(): number {
        if (this.validationSheetId !== null) return this.validationSheetId
        const name = '__validation__'
        if (!this.hf.doesSheetExist(name)) {
            this.hf.addSheet(name)
        }
        const sheetId = this.hf.getSheetId(name)
        this.validationSheetId = typeof sheetId === 'number' ? sheetId : this.hf.addSheet(name)
        return this.validationSheetId
    }

    validateFormula(
        input: string,
        options?: { resolveId?: (nameOrId: string) => string | null; contextNodeId?: string }
    ): { valid: boolean; error?: string; translated?: string } {
        const trimmed = (input || '').trim()
        if (!trimmed) return { valid: true, translated: trimmed }
        const translated = this.translator.translateFormula(trimmed, options)
        const sheetId = this.ensureValidationSheet()
        const addr = { sheet: sheetId, row: 0, col: 0 }

        try {
            this.hf.setCellContents(addr, translated)
            const value = this.hf.getCellValue(addr) as any
            const isError =
                (typeof value === 'string' && value.trim().startsWith('#')) ||
                (value && typeof value === 'object' && ('type' in value || 'message' in value))
            if (isError) {
                const error = typeof value === 'string' ? value : value?.message || 'Invalid formula'
                this.hf.setCellContents(addr, null)
                return { valid: false, error, translated }
            }
            this.hf.setCellContents(addr, null)
            return { valid: true, translated }
        } catch (error: any) {
            const message = error?.message || 'Invalid formula'
            try {
                this.hf.setCellContents(addr, null)
            } catch {
                // ignore cleanup error
            }
            return { valid: false, error: message, translated }
        }
    }

    setVariableExpression(
        uuid: string,
        content: RawCellContent,
        options?: { nodeId?: string; coord?: { row: number; col: number } | string | null }
    ): ExportedChange[] {
        if (options?.nodeId) {
            this.registry.registerVariable(uuid, options.nodeId, options.coord ?? null)
        }
        return this.registry.ensureNamedExpression(uuid, content)
    }

    getValue(uuid: string) {
        const name = this.registry.getNamedExpressionName(uuid)
        return this.hf.getNamedExpressionValue(name)
    }

    getFormula(uuid: string) {
        const name = this.registry.getNamedExpressionName(uuid)
        return this.hf.getNamedExpressionFormula(name)
    }

    removeVariable(uuid: string): void {
        this.registry.removeNamedExpression(uuid)
        this.registry.unregisterVariable(uuid)
    }

    translateFormula(
        input: string,
        resolveId?: (nameOrId: string) => string | null
    ): string {
        return this.translator.translateFormula(input, { resolveId })
    }
}
