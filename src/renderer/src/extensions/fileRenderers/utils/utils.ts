import { nodeApi } from '../../../utils/shims/node'

// const fs = window.api.node?.fs
// const path = window.api.node?.path

// const fs = window.node?.fs
// const path = window.node?.path
// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

/**
 * Detect if a local .webm file is audio or video.
 * @param {string} path - Path to the .webm file
 * @returns {'audio' | 'video' | 'audio+video' | 'unknown'}
 */
export async function isWebmVideoType(path) {
    if (!(await nodeApi.fsPromises?.exists(path))) {
        throw new Error('File does not exist: ' + path);
    }

    const buffer = await nodeApi.fsPromises?.readFile(path);
    if (!buffer) return null

    // Convert first 64KB to string for quick EBML inspection
    const headerStr = buffer.slice(0, 64 * 1024).toString('utf8');

    let hasAudio = false;
    let hasVideo = false;

    // Check for WebM codec identifiers inside container
    if (headerStr.includes('A_OPUS') || headerStr.includes('A_VORBIS')) {
        hasAudio = true;
        return false;
    }
    if (headerStr.includes('V_VP8') || headerStr.includes('V_VP9') || headerStr.includes('V_AV1')) {
        hasVideo = true;
        return true;
    }

    if (hasAudio && !hasVideo) return 'audio';
    if (!hasAudio && hasVideo) return 'video';
    if (hasAudio && hasVideo) return 'audio+video';
    return null;
}

// Example usage
// const filePath = './music/song.webm';
// const type = detectWebmTypeFromFile(filePath);
// console.log(`${filePath} is ${type}`);

export function getFileName(src) {
  // Remove query/hash first
  const cleanSrc = src.split('?')[0].split('#')[0];
  return nodeApi.path.basename(cleanSrc);
}
