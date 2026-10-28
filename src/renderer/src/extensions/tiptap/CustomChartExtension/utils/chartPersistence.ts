import { DocumentModel } from '../../../../models/Document'
import EditorHelpers from '../../../../utils/EditorHelpers'
import { nodeApi } from '../../../../utils/shims/node'

export type ChartConfigPayload = {
  id: string
  chartType: string
  sourceType?: string
  sourcePath: string
  sourceTableId?: string
  sampleData?: boolean
  range: string
  title?: string
  options?: Record<string, any> | null
  embedSync?: boolean
  embedAssetPath?: string
  updatedAt?: string
  version?: number
}

export async function resolveChartConfigPath(
  doc: DocumentModel | null,
  chartId: string
): Promise<string> {
  if (!doc || !chartId) return ''
  const result = await DocumentModel.getAssetFilePathFromDocument(
    DocumentModel.AssetType.CHART,
    doc,
    `${chartId}.json`
  )
  return result?.filePath || ''
}

export async function readChartConfig(path: string): Promise<ChartConfigPayload | null> {
  if (!path || !(await nodeApi.fsPromises?.exists(path))) return null
  try {
    const raw = await nodeApi.fsPromises?.readFile(path, 'utf-8')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeChartConfig(path: string, payload: ChartConfigPayload) {
  if (!path || !payload) return
  try {
    const next = {
      ...payload,
      updatedAt: new Date().toISOString(),
      version: (payload.version ?? 0) + 1
    }
    EditorHelpers.writeFileEnsuringDir(path, JSON.stringify(next, null, 2), 'utf-8')
  } catch {
    // ignore
  }
}

export function isPathInsideDoc(path: string, doc: DocumentModel | null): boolean {
  if (!path || !doc?.cachePath || !nodeApi?.path) return false
  const normalized = nodeApi.path.normalize(path)
  const root = nodeApi.path.normalize(doc.cachePath)
  return normalized.startsWith(root)
}
