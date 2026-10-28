import { CustomAIExtensionProps } from '../../CustomAIExtension/utils/common.utils'
import { CustomMonacoCodeBlockExtensionProps } from '../../CustomMonacoCodeBlockExtension/utils/common.utils'

export type RestrictionLimit = { min: number; max: number }

export type DocumentRestrictionRules = {
  characters: RestrictionLimit
  words: RestrictionLimit
  sentences: RestrictionLimit
  pages: RestrictionLimit
  nodeCount: RestrictionLimit
  paragraph: RestrictionLimit
  heading: RestrictionLimit
  bulletList: RestrictionLimit
  orderedList: RestrictionLimit
  [CustomMonacoCodeBlockExtensionProps.name]: RestrictionLimit
  table: RestrictionLimit
  image: RestrictionLimit
  video: RestrictionLimit
  [CustomAIExtensionProps.name]: RestrictionLimit
  copyPaste: { copy: boolean; paste: boolean }
}

export const documentRestrictionRulesIcons: Partial<Record<keyof DocumentRestrictionRules, string>> = {
  characters: '<i class="ph-light ph-text-aa"></i>',
  words: '<i class="ph-light ph-text-t"></i>',
  paragraph: '<i class="ph-light ph-text-columns"></i>',
  sentences: '<i class="ph-light ph-quotes"></i>',
  heading: '<i class="ph-light ph-text-h"></i>',
  bulletList: '<i class="ph-light ph-list-bullets"></i>',
  orderedList: '<i class="ph-light ph-list-numbers"></i>',
  [CustomMonacoCodeBlockExtensionProps.name]: '<i class="ph-light ph-code-block"></i>',
  table: '<i class="ph-light ph-table"></i>',
  image: '<i class="ph-light ph-image"></i>',
  video: '<i class="ph-light ph-video-camera"></i>',
  pages: '<i class="ph-light ph-file-text"></i>',
  [CustomAIExtensionProps.name]: '<i class="ph-light ph-robot"></i>',
  nodeCount: '<i class="ph-light ph-graph"></i>'
}

export const documentRestrictionRulesLabels: Partial<Record<keyof DocumentRestrictionRules, string>> = {
  characters: 'Characters',
  words: 'Words',
  paragraph: 'Paragraphs',
  sentences: 'Sentences',
  heading: 'Headings',
  bulletList: 'Bullet Lists',
  orderedList: 'Numbered Lists',
  [CustomMonacoCodeBlockExtensionProps.name]: 'Code Blocks',
  table: 'Tables',
  image: 'Images',
  video: 'Videos',
  pages: 'Pages',
  [CustomAIExtensionProps.name]: 'AI Blocks',
  nodeCount: 'Nodes'
}

export const documentRestrictionRulesTypes = (
  Object.keys(documentRestrictionRulesLabels) as (keyof DocumentRestrictionRules)[]
).map((key) => ({
  key,
  label: documentRestrictionRulesLabels[key],
  icon: documentRestrictionRulesIcons[key]
}))

export const defaultDocumentRestrictionRules: DocumentRestrictionRules = {
  characters: { min: 0, max: Infinity },
  words: { min: 0, max: Infinity },
  sentences: { min: 0, max: Infinity },
  pages: { min: 0, max: Infinity },
  nodeCount: { min: 0, max: Infinity },
  paragraph: { min: 0, max: Infinity },
  heading: { min: 0, max: Infinity },
  bulletList: { min: 0, max: Infinity },
  orderedList: { min: 0, max: Infinity },
  [CustomMonacoCodeBlockExtensionProps.name]: { min: 0, max: Infinity },
  table: { min: 0, max: Infinity },
  image: { min: 0, max: Infinity },
  video: { min: 0, max: Infinity },
  [CustomAIExtensionProps.name]: { min: 0, max: Infinity },
  copyPaste: { copy: true, paste: true }
}
