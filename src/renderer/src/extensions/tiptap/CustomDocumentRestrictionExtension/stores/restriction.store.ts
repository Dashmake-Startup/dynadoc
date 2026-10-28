import { writable, derived } from 'svelte/store'
import EditorHelpers from '../../../../utils/EditorHelpers'
import { type DocumentStats, type ComputeDocumentStatsOptions } from '../../../../utils/EditorHelpers'
import { EditorView } from "@tiptap/pm/view";
import { loadDocumentRestrictionRules, saveDocumentRestrictionRules, type DocumentRestrictionRules } from '../utils/common.utils';
// import { nodeApi } from '../../../../utils/shims/node'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

/* // Path for storing user-defined limits
export const nodeLimitationStorePath = nodeApi.path.resolve('limitations.json')

// --- Default: no restrictions ---
export const defaultLimits: DocumentLimitation = {
  tables: { min: 0, max: Infinity },
  images: { min: 0, max: Infinity },
  videos: { min: 0, max: Infinity },
  characters: { min: 0, max: Infinity },
  words: { min: 0, max: Infinity },
  sentences: { min: 0, max: Infinity },
  paragraphs: { min: 0, max: Infinity },
  pages: { min: 0, max: Infinity }, // optional: computed from paragraph/page size
  headings: { min: 0, max: Infinity }, // optional: computed from paragraph/page size
  lists: { min: 0, max: Infinity }, // optional: computed from paragraph/page size
  codeBlocks: { min: 0, max: Infinity }, // optional: computed from paragraph/page size
}

// 🧩 Load limits from file (if available)
function loadLimits(): DocumentLimitation {
  try {
    if (nodeApi.fs.existsSync(nodeLimitationStorePath)) {
      const data = JSON.parse(nodeApi.fs.readFileSync(nodeLimitationStorePath, 'utf-8'))
      return { ...defaultLimits, ...data }
    }
  } catch (err) {
    console.warn('⚠️ Failed to load node/text limits:', err)
  }
  return { ...defaultLimits }
}

// 💾 Save limits to file
export function saveNodeLimits(limits) {
  try {
    EditorHelpers.writeFileEnsuringDir(nodeLimitationStorePath, JSON.stringify(limits, null, 2), 'utf-8')
  } catch (err) {
    console.error('❌ Failed to save node/text limits:', err)
  }
} */

// --- Reactive Stores ---
export const basicNodeCounts = {
  characters: 0,
  words: 0,
  sentences: 0,
  paragraphs: 0,
};

export const structuralNodeCounts = {
  headings: 0,
  lists: 0,
  codeBlocks: 0,
  tables: 0,
  images: 0,
  videos: 0,
};

export const layoutNodeCounts = {
  totalHeight: 0,
  pageHeight: 0,
  pageCount: 0,
  averageWordsPerPage: 0,
  averageCharsPerPage: 0,
  isReconciling: false,
};

export const defaultStats = {
  ...basicNodeCounts,
  ...structuralNodeCounts,
  ...layoutNodeCounts,
};
/* export const nodeCounts = writable({
  ...basicNodeCounts,
  ...structuralNodeCounts,
  ...layoutNodeCounts,
}); */
function createMultiEditorStore() {
  // Store is a Record (Object) where keys are editorIds
  const { subscribe, set, update } = writable<Record<string, typeof defaultStats>>({});

  return {
    subscribe,
    /** Initialize or update an editor's stats */
    updateEditor: (id: string, statsOrFn: Partial<typeof defaultStats> | ((prev: typeof defaultStats) => Partial<typeof defaultStats>)) => {
      update(prev => {
        const currentStats = prev[id] || defaultStats;
        const newStats = typeof statsOrFn === 'function'
          ? statsOrFn(currentStats)
          : statsOrFn;

        return {
          ...prev,
          [id]: { ...currentStats, ...newStats }
        };
      });
    },

    /** Remove stats when editor is destroyed to prevent memory leaks */
    removeEditor: (id: string) => {
      update(prev => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    }
  };
}

export const nodeCounts = createMultiEditorStore();

/* export const nodeCounts = writable({
  ...basicNodeCounts,
  ...structuralNodeCounts,
  ...layoutNodeCounts,
}); */


/* export const nodeCounts = writable({
  characters: 0,
  words: 0,
  sentences: 0,
  paragraphs: 0,
  headings: 0,
  lists: 0,
  codeBlocks: 0,
  tables: 0,
  images: 0,
  videos: 0,
  totalHeight: 0,
  pageHeight: 0,
  pageCount: 0,
  averageWordsPerPage: 0,
  averageCharsPerPage: 0,
  isReconciling: false, // NEW: Background task indicator
}); */

export const nodeCounts1 = writable<DocumentStats>({
  characters: 0,
  words: 0,
  paragraphs: 0,
  sentences: 0,
  headings: 0,
  lists: 0,
  codeBlocks: 0,
  tables: 0,
  images: 0,
  videos: 0,
  totalHeight: 0,
  pageHeight: 0,
  pageCount: 0,
  averageWordsPerPage: 0,
  averageCharsPerPage: 0,
})

// export const documentRestrictionRules = writable<DocumentRestrictionRules>(loadDocumentRestrictionRules())
// export const documentRestrictionRules = loadDocumentRestrictionRules()
// export const nodeLimits = writable<{ min: number, max: number }>(loadLimits())

// 🔄 Automatically save whenever nodeLimits changes
// documentRestrictionRules.subscribe((v) => saveDocumentRestrictionRules())
// documentRestrictionRules.subscribe((v) => saveDocumentRestrictionRules(v))

// --- Utility functions to compute counts ---
export function computeTextCounts(view: EditorView,
  options: ComputeDocumentStatsOptions = {}
) {
  // export function computeTextCounts(doc) {
  const stats = EditorHelpers.computeDocumentStats(view)
  console.log('computeDocumentStats stats:', stats)

  /* const stats = { character: 0, word: 0, sentence: 0, paragraph: 0, page: 0 }

  doc.descendants((node) => {
    if (node.isText) {
      const text = node.text || ''
      stats.character += text.length
      stats.word += text.split(/\s+/).filter(Boolean).length
      stats.sentence += text.split(/[.!?]+/).filter(Boolean).length
    }
    if (node.type.name === 'paragraph') {
      stats.paragraph++
      stats.page = Math.ceil(stats.paragraph / 30) // example: 30 paragraphs per page
    }
    if (['table', 'image', 'video'].includes(node.type.name)) {
      stats[node.type.name] = (stats[node.type.name] || 0) + 1
    }
  }) */

  nodeCounts.set(stats)
  console.log('computeDocumentStats nodeCounts:', stats, nodeCounts)

}

// --- Derived stores ---

// Missing minimums
/* export const unmetMinimums = derived([nodeCounts, documentRestrictionRules], ([$counts, $limits]) =>
  Object.entries($limits)
    .filter(([type, limit]) => limit.min && ($counts[type] || 0) < limit.min)
    .map(([type, limit]) => ({
      name: type,
      current: $counts[type] || 0,
      required: limit.min,
    }))
)
 */
// Exceeded maximums
/* export const exceededMaximums = derived([nodeCounts, documentRestrictionRules], ([$counts, $limits]) =>
  Object.entries($limits)
    .filter(([type, limit]) => isFinite(limit.max) && ($counts[type] || 0) > limit.max)
    .map(([type, limit]) => ({
      name: type,
      current: $counts[type] || 0,
      max: limit.max,
    }))
)

// Node/Text status for toolbar
export const nodeStatus = derived([nodeCounts, documentRestrictionRules], ([$counts, $limits]) => {
  const result = {}

  for (const [type, limit] of Object.entries($limits)) {
    const count = $counts[type] || 0
    let color = 'text-gray-500'
    let label = 'OK'

    if (limit.min && count < limit.min) {
      color = 'text-red-500'
      label = `Need ≥ ${limit.min}`
    } else if (isFinite(limit.max) && count > limit.max) {
      color = 'text-yellow-500'
      label = `Over limit (${limit.max})`
    } else if (isFinite(limit.max) && count === limit.max) {
      color = 'text-orange-500'
      label = `At max`
    } else {
      color = 'text-green-600'
      label = 'Good'
    }

    result[type] = { count, ...limit, color, label }
  }

  return result
}) */