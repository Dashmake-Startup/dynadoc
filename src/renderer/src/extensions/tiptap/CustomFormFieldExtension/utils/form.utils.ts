import type { Editor as TiptapEditor } from '@tiptap/core'
import { extensionName } from '../CustomFormFieldExtension.svelte'

export type FormFieldOption = { value: string; label?: string }

export type FormFieldSchema = {
  id: string
  name: string
  label: string
  component: string
  type?: string
  required?: boolean
  options?: FormFieldOption[]
  placeholder?: string
  helper?: string
  min?: number | string | null
  max?: number | string | null
  step?: number | string | null
  pattern?: string
}

export type FormSchema = {
  id: string
  docUuid?: string
  fields: FormFieldSchema[]
}

export type FormResponse = {
  fieldId: string
  name: string
  label: string
  value: any
}

export type FormSubmissionPayload = {
  docUuid: string
  ownerId?: string
  responderId?: string
  responderName?: string
  submittedAt?: string
  answers: FormResponse[]
  schema: FormFieldSchema[]
  metadata?: Record<string, any>
}

const normalizeOptions = (raw: any): FormFieldOption[] => {
  if (!Array.isArray(raw)) return []
  return raw.map((opt) =>
    typeof opt === 'string'
      ? { value: opt, label: opt }
      : { value: String(opt?.value ?? ''), label: String(opt?.label ?? opt?.value ?? '') }
  )
}

export function extractFormSchema(editor: TiptapEditor | null | undefined): FormSchema {
  if (!editor) return { id: '', fields: [] }
  const fields: FormFieldSchema[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name !== extensionName) return
    const attrs: any = node.attrs || {}
    const fieldId = String(attrs.id || '')
    const label = String(attrs.label || attrs.name || 'Field')
    const name =
      String(attrs.name || '')
        .trim()
        .replace(/\s+/g, '_') || fieldId

    fields.push({
      id: fieldId,
      name,
      label,
      component: String(attrs.component || attrs.type || 'TextField'),
      type: String(attrs.type || ''),
      required: Boolean(attrs.required),
      options: normalizeOptions(attrs.options),
      placeholder: attrs.placeholder || '',
      helper: attrs.helper || '',
      min: attrs.min ?? null,
      max: attrs.max ?? null,
      step: attrs.step ?? null,
      pattern: attrs.pattern || ''
    })
  })
  return { id: editor?.id || '', fields }
}

export function normalizeFieldValue(component: string, rawValue: any): any {
  switch (component) {
    case 'Checkbox':
    case 'Switch':
      return Boolean(rawValue)
    case 'Select':
    case 'RadioGroup':
    case 'DatePicker':
    case 'TextField':
    default:
      return rawValue ?? ''
  }
}

export function buildFormSubmissionPayload(
  editor: TiptapEditor | null | undefined,
  values: Record<string, Record<string, any>>,
  options: {
    docUuid?: string
    ownerId?: string
    responderId?: string
    responderName?: string
    metadata?: Record<string, any>
  } = {}
): FormSubmissionPayload | null {
  if (!editor) return null
  const schema = extractFormSchema(editor)
  const answers: FormResponse[] = schema.fields.map((field) => ({
    fieldId: field.id,
    name: field.name,
    label: field.label,
    value: normalizeFieldValue(field.component, values?.[field.id]?.value)
  }))
  return {
    docUuid: options.docUuid || '',
    ownerId: options.ownerId,
    responderId: options.responderId,
    responderName: options.responderName,
    submittedAt: new Date().toISOString(),
    answers,
    schema: schema.fields,
    metadata: options.metadata || {}
  }
}

export function validateFormSubmission(schema: FormSchema, values: Record<string, Record<string, any>>) {
  const errors: { fieldId: string; message: string }[] = []
  schema.fields.forEach((field) => {
    if (!field.required) return
    const raw = values?.[field.id]?.value
    const value = normalizeFieldValue(field.component, raw)
    const isEmpty =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    if (isEmpty) {
      errors.push({ fieldId: field.id, message: `${field.label || field.name} is required` })
    }
  })
  return errors
}

