type RangeIndex = { sr: number; sc: number; er: number; ec: number }

export type ChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'scatter'
  | 'stacked-bar'
  | 'stacked-area'

export const CHART_TYPE_ORDER: ChartType[] = [
  'bar',
  'line',
  'area',
  'stacked-bar',
  'stacked-area',
  'pie',
  'scatter'
]

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: 'Bar Chart',
  line: 'Line Chart',
  area: 'Area Chart',
  'stacked-bar': 'Stacked Bar',
  'stacked-area': 'Stacked Area',
  pie: 'Pie Chart',
  scatter: 'Scatter'
}

export const getChartTypeLabel = (type: ChartType) => CHART_TYPE_LABELS[type] || type

const columnLabelToIndex = (label: string) => {
  let result = 0
  const upper = label.toUpperCase()
  for (let i = 0; i < upper.length; i++) {
    const code = upper.charCodeAt(i)
    if (code < 65 || code > 90) return 0
    result = result * 26 + (code - 64)
  }
  return Math.max(0, result - 1)
}

const indexToColumnLabel = (index: number) => {
  let result = ''
  let current = index + 1
  while (current > 0) {
    const mod = (current - 1) % 26
    result = String.fromCharCode(65 + mod) + result
    current = Math.floor((current - 1) / 26)
  }
  return result
}

export const buildA1Range = (range: RangeIndex) =>
  `${indexToColumnLabel(range.sc)}${range.sr + 1}:${indexToColumnLabel(range.ec)}${range.er + 1}`

export const parseA1Range = (input?: string | null): RangeIndex | null => {
  if (!input) return null
  const clean = input.trim()
  const parts = clean.split(':')
  const parseRef1 = (ref: string) => {
    const match = ref.trim().match(/^([A-Za-z]+)(\\d+)$/)
    if (!match) return null
    const [, col, row] = match
    return { r: Math.max(0, parseInt(row, 10) - 1), c: columnLabelToIndex(col) }
  }

  const parseRef = (ref: string) => {
  // Change \\d to \d
  const match = ref.trim().match(/^([A-Za-z]+)(\d+)$/)
  if (!match) return null
  const [, col, row] = match
  return { r: Math.max(0, parseInt(row, 10) - 1), c: columnLabelToIndex(col) }
}
  const start = parseRef(parts[0])
  const end = parseRef(parts[1] ?? parts[0])
  if (!start || !end) return null
  return {
    sr: Math.min(start.r, end.r),
    sc: Math.min(start.c, end.c),
    er: Math.max(start.r, end.r),
    ec: Math.max(start.c, end.c)
  }
}

const coerceCellValue = (cell: any) => {
  if (cell == null) return null
  if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean') return cell
  if (cell.v != null) {
    if (typeof cell.v === 'object') {
      if (cell.v.m != null) return cell.v.m
      if (cell.v.v != null) return cell.v.v
    }
    return cell.v
  }
  if (cell.m != null) return cell.m
  return cell
}

export const getTableFromRange = (
  methods: { getCellsByRange?: (range: any, options?: any) => any[][] } | null,
  range: RangeIndex | null
) => {
  if (!methods?.getCellsByRange || !range) return null
  const selection = { row: [range.sr, range.er], column: [range.sc, range.ec] }
  const raw = methods.getCellsByRange(selection) || []
  return raw.map((row) => (row || []).map(coerceCellValue))
}

const isNumericValue = (value: any) => {
  if (value == null || value === '') return false
  if (typeof value === 'number') return Number.isFinite(value)
  const parsed = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed)
}

const isTextValue = (value: any) =>
  typeof value === 'string' && value.trim().length > 0 && !isNumericValue(value)

const looksLikeHeaderRow = (row: any[]) => {
  const textCount = row?.filter(isTextValue).length ?? 0
  const numericCount = row?.filter(isNumericValue).length ?? 0
  return textCount >= 2 && textCount >= numericCount
}

const looksLikeHeaderColumn = (table: any[][]) => {
  const firstCol = table.map((row) => row?.[0])
  const textCount = firstCol.filter(isTextValue).length
  const numericCount = firstCol.filter(isNumericValue).length
  return textCount >= 2 && textCount >= numericCount
}

const normalizeTable = (table: any[][]) => {
  if (!table?.length) return { header: null, body: [], orientation: 'columns' as const, headerColumn: false }
  const firstRow = table[0] || []
  const hasHeaderRow = looksLikeHeaderRow(firstRow)
  const hasHeaderCol = looksLikeHeaderColumn(table)

  if (hasHeaderRow && !hasHeaderCol) {
    return { header: firstRow, body: table.slice(1), orientation: 'rows' as const, headerColumn: false }
  }

  if (hasHeaderRow) {
    return { header: firstRow, body: table.slice(1), orientation: 'columns' as const, headerColumn: true }
  }

  return { header: null, body: table, orientation: 'columns' as const, headerColumn: hasHeaderCol }
}

const toNumber = (value: any) => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return value
  const parsed = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

const buildSeriesFromTable = (chartType: ChartType, table: any[][]) => {
  const { header, body, orientation } = normalizeTable(table)
  if (!body.length) return { series: [], categories: [], dataset: [] }

  if (chartType === 'scatter') {
    const trimmed = body.filter((row) => row?.length >= 2)
    const data = trimmed.map((row) => [toNumber(row?.[0]), toNumber(row?.[1])])
    return {
      series: [{ type: 'scatter', data }],
      categories: [],
      dataset: []
    }
  }

  if (chartType === 'pie' && orientation === 'rows') {
    const seriesRow = body[0] || []
    const categories = header ? header.slice(1) : []
    const data = categories.map((label, idx) => ({
      name: label || `Item ${idx + 1}`,
      value: toNumber(seriesRow[idx + 1])
    }))
    return {
      series: [
        {
          type: 'pie',
          radius: ['35%', '70%'],
          data
        }
      ],
      categories: [],
      dataset: []
    }
  }

  if (orientation === 'rows') {
    const categoryLabels = header ? header.slice(1) : []
    const series = body.map((row, idx) => {
      const name = row?.[0] ?? `Series ${idx + 1}`
      const values = row?.slice(1).map((value) => toNumber(value))
      const stacked = chartType === 'stacked-bar' || chartType === 'stacked-area'
      const isArea = chartType === 'area' || chartType === 'stacked-area'
      const type = chartType.includes('line') || chartType.includes('area') ? 'line' : 'bar'
      return {
        name,
        type,
        stack: stacked ? 'total' : undefined,
        areaStyle: isArea ? {} : undefined,
        data: values
      }
    })
    return { series, categories: categoryLabels, dataset: [] }
  }

  const categoryLabels = body.map((row) => row?.[0] ?? '')
  const columnCount = Math.max(...body.map((row) => row?.length ?? 0))
  const seriesNames = header
    ? header.slice(1, columnCount)
    : Array.from({ length: Math.max(0, columnCount - 1) }, (_, i) => `Series ${i + 1}`)

  const valuesBySeries = seriesNames.map((_, index) =>
    body.map((row) => toNumber(row?.[index + 1]))
  )

  if (chartType === 'pie') {
    const data = body.map((row, idx) => ({
      name: row?.[0] ?? `Item ${idx + 1}`,
      value: toNumber(row?.[1])
    }))
    return {
      series: [
        {
          type: 'pie',
          radius: ['35%', '70%'],
          data
        }
      ],
      categories: [],
      dataset: []
    }
  }

  const stacked = chartType === 'stacked-bar' || chartType === 'stacked-area'
  const isArea = chartType === 'area' || chartType === 'stacked-area'
  const type = chartType.includes('line') || chartType.includes('area') ? 'line' : 'bar'

  const series = valuesBySeries.map((values, index) => ({
    name: seriesNames[index] ?? `Series ${index + 1}`,
    type,
    stack: stacked ? 'total' : undefined,
    areaStyle: isArea ? {} : undefined,
    data: values
  }))

  return { series, categories: categoryLabels, dataset: [] }
}

export const buildChartOption = (
  chartType: ChartType,
  table: any[][],
  overrides: Record<string, any> | null
) => {
  const safeType: ChartType = chartType || 'bar'
  const { series, categories } = buildSeriesFromTable(safeType, table)

  const base: Record<string, any> = {
    tooltip: { trigger: safeType === 'pie' ? 'item' : 'axis' },
    grid: { left: 36, right: 24, top: 32, bottom: 36 },
    legend: { top: 6 },
    xAxis: safeType === 'pie' ? undefined : { type: 'category', data: categories },
    yAxis: safeType === 'pie' ? undefined : { type: 'value' },
    series
  }

  return overrides ? { ...base, ...overrides } : base
}
