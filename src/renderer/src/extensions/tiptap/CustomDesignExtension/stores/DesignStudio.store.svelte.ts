import { derived } from "svelte/store";
import type { ImageEditorEntry, ImageEditorInstance, Layer } from "../utils/utils";



// export let _$_imageEditorLayers: Layer[] = $state([])
// -------------------------------
// STATE
// -------------------------------

let _$_imageEditorEntries = $state<ImageEditorEntry[]>([])

// -------------------------------
// HELPERS
// -------------------------------

const clone = <T>(v: T): T => structuredClone(v)

const findIndex = (uuid: string) =>
  _$_imageEditorEntries.findIndex(e => e.uuid === uuid)

// -------------------------------
// ACTIONS
// -------------------------------

export const _addImageEditor = (editor: ImageEditorInstance) => {
  const exists = _$_imageEditorEntries.some(e => e.uuid === editor.id)

  if (!exists) {
    _$_imageEditorEntries = [
      ..._$_imageEditorEntries,
      {
        uuid: editor.id,
        editor,
        isActive: _$_imageEditorEntries.length === 0 // first editor auto-active
      }
    ]
  }
}

// ----------------------------------

export const _removeImageEditor = (uuid: string) => {
  _$_imageEditorEntries = _$_imageEditorEntries.filter(e => e.uuid !== uuid)
}

// ----------------------------------

export const _setActiveImageEditor = (uuid: string) => {
  _$_imageEditorEntries = _$_imageEditorEntries.map(e => ({
    ...e,
    isActive: e.uuid === uuid
  }))
}

// ----------------------------------

export const _addImageEditorLayer = (editorUuid: string, layer: Layer) => {
  const idx = findIndex(editorUuid)
  if (idx === -1) return

  const entry = clone(_$_imageEditorEntries[idx])
  entry.editor.layers = [...entry.editor.layers, layer]

  _$_imageEditorEntries = [
    ..._$_imageEditorEntries.slice(0, idx),
    entry,
    ..._$_imageEditorEntries.slice(idx + 1)
  ]
}

export const _getImageEditorLayers = (editorUuid: string): Layer[] => {
  const entry = _$_imageEditorEntries.find(e => e.uuid === editorUuid)
  return entry ? structuredClone(entry.editor.layers) : []
}


/* export const layersOf = (editorUuid: string) => {
  return derived(
    _$_imageEditorEntries,
    ($editors) => {
      const entry = $editors.find(e => e.uuid === editorUuid)
      return entry ? entry.editor.layers : []
    }
  )
} */


// ----------------------------------

export const _updateImageEditorLayer = (
  editorUuid: string,
  layerId: string,
  newProps: Partial<Layer>
) => {
  const idx = findIndex(editorUuid)
  if (idx === -1) return

  const entry = clone(_$_imageEditorEntries[idx])
  entry.editor.layers = entry.editor.layers.map(l =>
    l.id === layerId ? { ...l, ...newProps } : l
  )

  _$_imageEditorEntries = [
    ..._$_imageEditorEntries.slice(0, idx),
    entry,
    ..._$_imageEditorEntries.slice(idx + 1)
  ]
}

// ----------------------------------

export const _removeImageEditorLayer = (
  editorUuid: string,
  layerId: string
) => {
  const idx = findIndex(editorUuid)
  if (idx === -1) return

  const entry = clone(_$_imageEditorEntries[idx])
  entry.editor.layers = entry.editor.layers.filter(l => l.id !== layerId)

  _$_imageEditorEntries = [
    ..._$_imageEditorEntries.slice(0, idx),
    entry,
    ..._$_imageEditorEntries.slice(idx + 1)
  ]
}

// ----------------------------------

export const _setImageEditorLayers = (editorUuid: string, layers: Layer[]) => {
  const idx = findIndex(editorUuid)
  if (idx === -1) return

  const entry = clone(_$_imageEditorEntries[idx])
  entry.editor.layers = [...layers]

  _$_imageEditorEntries = [
    ..._$_imageEditorEntries.slice(0, idx),
    entry,
    ..._$_imageEditorEntries.slice(idx + 1)
  ]
}
