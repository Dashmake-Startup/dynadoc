import { v4 as uuidv4 } from 'uuid'
import {
  FormComponentFrameWorks,
  FormComponentNames,
  FormComponentPacks
} from '../../CustomFormFieldExtension/components/fields/libs/componentRegistry'

export type SurveyQuestionType =
  | 'short_text'
  | 'long_text'
  | 'single_choice'
  | 'multiple_choice'
  | 'dropdown'
  | 'date'
  | 'switch'
  | 'slider'
  | 'file_upload'
  | 'section_header'


export type SurveyDocV1 = {
  version: 1
  title: string
  description: string
  updatedAt: number
  publish?: {
    shareId?: string
    link?: string
    docDrivePath?: string
    surveyDrivePath?: string
    publishedAt?: string
  }
  settings: {
    showProgressBar: boolean
    shuffleQuestions: boolean
    collectEmail: boolean
    requireSignIn: boolean
    limitOneResponse: boolean
    isPublished: boolean
    isOpen: boolean
    deadlineAt?: string // ISO string
    maxResponses?: number | null
  }
  theme: {
    accent: string // css color
  }
  sections: SurveySectionV1[]
}

export type SurveySectionV1 = {
  id: string
  title: string
  description: string
  questions: SurveyQuestionV1[]
}
export type SurveyActions = {
  addQuestion: (type?: SurveyQuestionType) => void
  patchQuestion: (questionId: string, patch: any) => void
  deleteQuestion: (questionId: string) => void
  duplicateQuestion: (q: any) => void
  moveQuestion: (questionId: string, dir: -1 | 1) => void
  addSection: () => void
  patchSection: (sectionId: string, patch: any) => void
  deleteSection: (sectionId: string) => void
  setPublished?: (published: boolean) => Promise<void> | void
  scheduleSave: () => void
  exportJsonToClipboard?: () => void
  importJsonFromClipboard?: () => void
}

export type SurveyQuestionV1 = {
  id: string
  type: SurveyQuestionType
  title: string
  description?: string
  required: boolean
  // When this survey is rendered as actual form elements, we can reuse the
  // existing FormField component definitions.
  component: {
    framework: keyof typeof FormComponentFrameWorks
    pack: keyof typeof FormComponentPacks
    name: keyof typeof FormComponentNames
  }
  placeholder?: string
  options?: Array<{ id: string; label: string; value: string }>
  // Optional advanced field for future-proofing (validation, branching, etc.)
  meta?: Record<string, any>
}

export function defaultSurveyDocV1(): SurveyDocV1 {
  return {
    version: 1,
    title: 'Untitled Survey',
    description: '',
    updatedAt: Date.now(),
    settings: {
      showProgressBar: true,
      shuffleQuestions: false,
      collectEmail: false,
      requireSignIn: false,
      limitOneResponse: false,
      isPublished: false,
      isOpen: true,
      deadlineAt: '',
      maxResponses: null
    },
    theme: {
      accent: 'var(--color-primary-500)'
    },
    sections: [defaultSectionV1('Section 1')]
  }
}

export function defaultSectionV1(title = 'Section'): SurveySectionV1 {
  return {
    id: uuidv4(),
    title,
    description: '',
    questions: [defaultQuestionV1('short_text')]
  }
}

export function defaultQuestionV1(type: SurveyQuestionType): SurveyQuestionV1 {
  const base: SurveyQuestionV1 = {
    id: uuidv4(),
    type,
    title: type === 'section_header' ? 'Section title' : 'Question',
    description: '',
    required: false,
    component: {
      framework: 'svelte',
      pack: 'fluent',
      name: 'TextField'
    },
    placeholder: ''
  }

  if (type === 'short_text') {
    base.component.name = 'TextField'
    base.placeholder = 'Short answer'
  } else if (type === 'long_text') {
    base.component.name = 'TextField'
    base.placeholder = 'Long answer'
    base.meta = { multiline: true }
  } else if (type === 'single_choice') {
    base.component.name = 'RadioGroup'
    base.options = [
      { id: uuidv4(), label: 'Option 1', value: 'option_1' },
      { id: uuidv4(), label: 'Option 2', value: 'option_2' }
    ]
  } else if (type === 'multiple_choice') {
    base.component.name = 'Checkbox'
    base.options = [
      { id: uuidv4(), label: 'Option 1', value: 'option_1' },
      { id: uuidv4(), label: 'Option 2', value: 'option_2' }
    ]
    base.meta = { multiple: true }
  } else if (type === 'dropdown') {
    base.component.name = 'Select'
    base.options = [
      { id: uuidv4(), label: 'Option 1', value: 'option_1' },
      { id: uuidv4(), label: 'Option 2', value: 'option_2' }
    ]
  } else if (type === 'date') {
    base.component.name = 'DatePicker'
  } else if (type === 'switch') {
    base.component.name = 'Switch'
    base.title = 'Yes / No'
  } else if (type === 'slider') {
    base.component.name = 'Slider'
    base.meta = { min: 0, max: 10, step: 1 }
  } else if (type === 'file_upload') {
    base.component.name = 'Button'
    base.title = 'Upload a file'
    base.meta = { accept: '*/*', maxSizeMB: 25 }
  } else if (type === 'section_header') {
    base.component.name = 'Button'
    base.required = false
    base.meta = { displayOnly: true }
  }

  return base
}

export function coerceSurveyDoc(input: any): SurveyDocV1 {
  if (!input || typeof input !== 'object') return defaultSurveyDocV1()
  if (input.version !== 1) {
    // best-effort fallback: accept older data as v1-ish.
  }
  const doc: SurveyDocV1 = {
    ...defaultSurveyDocV1(),
    ...input,
    version: 1,
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : Date.now(),
    publish: input.publish && typeof input.publish === 'object' ? input.publish : undefined,
    settings: { ...defaultSurveyDocV1().settings, ...(input.settings || {}) },
    theme: { ...defaultSurveyDocV1().theme, ...(input.theme || {}) },
    sections: Array.isArray(input.sections) && input.sections.length ? input.sections : defaultSurveyDocV1().sections
  }
  // Ensure IDs exist
  doc.sections = doc.sections.map((s: any, index: number) => ({
    id: s?.id || uuidv4(),
    title: typeof s?.title === 'string' ? s.title : `Section ${index + 1}`,
    description: typeof s?.description === 'string' ? s.description : '',
    questions: Array.isArray(s?.questions) && s.questions.length ? s.questions : [defaultQuestionV1('short_text')]
  }))
  doc.sections = doc.sections.map((s) => ({
    ...s,
    questions: s.questions.map((q: any) => ({
      ...defaultQuestionV1((q?.type as SurveyQuestionType) || 'short_text'),
      ...q,
      id: q?.id || uuidv4(),
      required: Boolean(q?.required),
      component: {
        ...defaultQuestionV1((q?.type as SurveyQuestionType) || 'short_text').component,
        ...(q?.component || {})
      },
      options: Array.isArray(q?.options) ? q.options : undefined
    }))
  }))
  return doc
}

// ─── Types ────────────────────────────────────────────────────────────────
export interface Answer {
  questionId: string
  type: string
  value: string | string[]
  label?: string | string[]
}

export interface ResponseFile {
  responseId: string
  surveyId: string
  metadata: {
    submittedAt: number
    durationSeconds: number
    ipAddress?: string
    userAgent?: string
  }
  answers: Answer[]
}

export interface StatItem {
  label: string
  value: string
  count: number
  percentage: number
}

export interface QuestionStat {
  questionId: string
  chartType: 'pie' | 'bar' | 'word_cloud' | 'timeline' | 'number' | 'list'
  totalVotes?: number
  data?: StatItem[]
  latestResponses?: string[]
  average?: number
  min?: number
  max?: number
}

export interface Analytics {
  surveyId: string
  totalResponses: number
  stats: QuestionStat[]
}

export interface SurveyQuestion {
  id: string
  title: string
  type: string
  description?: string
  required?: boolean
  options?: { value: string; label: string }[]
}

export interface SurveySection {
  id: string
  title: string
  questions: SurveyQuestion[]
}

export interface SurveyDoc {
  title: string
  description?: string
  sections: SurveySection[]
}


