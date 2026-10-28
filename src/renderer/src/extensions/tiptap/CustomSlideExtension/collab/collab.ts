import { DocumentModel } from '../../../../models/Document'
import { createCanvas, type CollaborativeCanvas } from '../../../../utils/canvas.utils'
import { ensureNodeViewSrc } from '../../utils/utils'

export async function createSlide(slideId: string, slidePath: string, parentDoc?: any, userInfo?: { name: string, color: string }): Promise<CollaborativeCanvas> {
    let resolvedPath = slidePath
    if (!resolvedPath) {
        // INNOVATIVE FIX: Use flat naming (slide.json, slide2.json) for cleaner asset management
        resolvedPath = await ensureNodeViewSrc(
            '',  // Empty to generate new file
            'slide',  // Use 'slide' instead of UUID for human-readable naming
            DocumentModel.AssetType.SLIDE,
            undefined,
            ['slides'],
            '{}'
        )
    }

    return await createCanvas(DocumentModel.AssetType.SLIDE, slideId, resolvedPath, {
        lazyLoad: true,
        connectOnLoad: true,
        updateChunkSize: 20,
        yieldMs: 8,
        progressive: true,
        enableCache: true,
        cacheMax: 6
    }, parentDoc, userInfo)

}
