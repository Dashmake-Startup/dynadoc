import { convertPresentationJsonToSlidesHtml } from './presentationImport'
import { nodeApi } from '../../../../utils/shims/node'
import { convertPptxFileToPresentation } from '../../../../services/conversion/officeConversion.service'

// const fs = nodeApi.fs
// const path = nodeApi.path

// const fs = window.node?.fs
// const path = window.node?.path

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

type AssetPathResolver = (
  assetType: string,
  mainFilePath?: string,
  fileName?: string
) => Promise<{ filePath: string } | null>

export async function convertPptxToSlidesHtml(
  pptxPath: string,
  tempDir: string,
  mainFilePath: string,
  resolveAssetPath: AssetPathResolver,
  slideAssetType: string
): Promise<string> {
  const baseName = nodeApi.path.basename(pptxPath, nodeApi.path.extname(pptxPath))
  const outputDir =
    nodeApi.path.basename(tempDir) === baseName ? nodeApi.path.dirname(tempDir) : tempDir

  await convertPptxFileToPresentation(pptxPath, outputDir)

  const candidates = [
    nodeApi.path.join(tempDir, 'presentation.json'),
    nodeApi.path.join(tempDir, baseName, 'presentation.json'),
    nodeApi.path.join(tempDir, baseName, baseName, 'presentation.json'),
    nodeApi.path.join(outputDir, baseName, 'presentation.json')
  ]
  const presentationJsonPath = candidates.find((candidate) => nodeApi.fs.existsSync(candidate))

  if (!presentationJsonPath) {
    throw new Error(
      `PPTX conversion did not produce presentation.json. Checked: ${candidates.join(', ')}`
    )
  }

  const htmlPath = await convertPresentationJsonToSlidesHtml(
    presentationJsonPath,
    tempDir,
    mainFilePath,
    resolveAssetPath,
    slideAssetType
  )
  // Best-effort tidying of the conversion's temporary artefacts. existsSync
  // stays synchronous -- it keeps its signature on the IPC surface -- while the
  // calls that change the disk go through fsPromises, and so through the path
  // policy.
  //
  // rmdir is deliberately not used: it is not one of the routed methods, so it
  // would reach the disk without passing the policy. fsPromises.rm with
  // recursive is the routed equivalent, and it is equivalent here in fact as
  // well, because both call sites have already established that the directory
  // is empty before removing it.
  try {
    if (nodeApi.fs.existsSync(presentationJsonPath)) {
      await nodeApi.fsPromises.unlink(presentationJsonPath)
    }
    const mediaDir = nodeApi.path.join(tempDir, 'assets', 'slide', 'media')
    if (
      nodeApi.fs.existsSync(mediaDir) &&
      (await nodeApi.fsPromises.readdir(mediaDir)).length === 0
    ) {
      await nodeApi.fsPromises.rm(mediaDir, { recursive: true })
    }
    const legacyIndexDir = nodeApi.path.join(tempDir, 'index')
    if (nodeApi.fs.existsSync(legacyIndexDir)) {
      const entries = await nodeApi.fsPromises.readdir(legacyIndexDir)
      if (entries.length === 1 && entries[0] === 'index.html') {
        await nodeApi.fsPromises.unlink(nodeApi.path.join(legacyIndexDir, 'index.html'))
        await nodeApi.fsPromises.rm(legacyIndexDir, { recursive: true })
      }
    }
  } catch {
    // Swallowed on purpose, and this one is justified rather than habitual:
    // every call above removes a temporary artefact of the conversion. Failing
    // to delete a scratch file must not fail an import that has already
    // succeeded, and the caller receives the HTML either way. Nothing here
    // reads a value back, so there is no empty result to mistake for data --
    // which is what made the other silent catches in this codebase dangerous.
  }
  return htmlPath
}
