import { writable, get } from 'svelte/store'
import { hashNode, TranslationSyncControllerImpl } from '../utils/utils'
import { _$_documentEditorsList } from '../../../../stores/editor.store'
import type { forEach } from 'mathjs'
import type { forEachChild } from 'typescript'
import Utils from '../../../../utils/Utils'

/* ---------------------------------------
 * TYPES
 * -------------------------------------*/

// type OriginalAddedListener = (uuid: string, node: any) => void
// type OriginalUpdatedListener = (uuid: string, node: any) => void
// type OriginalRemovedListener = (uuid: string) => void

/* ---------------------------------------
 * LISTENER TYPES (file-aware)
 * -------------------------------------*/

type OriginalAddedListener = (
  fileId: string,
  uuid: string,
  node: any
) => void

type OriginalUpdatedListener = (
  fileId: string,
  uuid: string,
  node: any
) => void

type OriginalRemovedListener = (
  fileId: string,
  uuid: string
) => void

export interface TranslationPair {
  id: string // Translation file path
  uuid: string
  original: any | null
  // translated: any | null
  translated: Map<string, any | null> | null

  json: any | null
  isEmpty: boolean
}

/**
 * fileId (path or doc id) → uuid → TranslationPair
 */
export type TranslationPairsMap = Map<
  string,
  Map<string, TranslationPair>
>

/* ---------------------------------------
 * STORE
 * -------------------------------------*/

export const _$_translationPairsMap =
  writable<TranslationPairsMap>(new Map())

/* ---------------------------------------
 * INTERNAL HELPERS
 * -------------------------------------*/

export function getOrCreateFileMap(fileId: string, map: TranslationPairsMap = null): Map<string, TranslationPair> {
  map = map || get(_$_translationPairsMap)
  // const map = get(_$_translationPairsMap)

  // console.log('TranslationSyncControllerImpl existingTranslations fileId:', JSON.stringify(fileId), map)
  // console.log('TranslationSyncControllerImpl existingTranslations keys:', [...map.keys()].map(k => JSON.stringify(k)))
  // console.log('TranslationSyncControllerImpl existingTranslations equal?', [...map.keys()].some(k => k === fileId))


  if (!map.has(fileId)) {
    map.set(fileId, new Map())
    _$_translationPairsMap.set(map)
  }

  return map.get(fileId)!
}

export function getOrCreateFileMap22(fileId: string) {
  let fileMap: Map<string, TranslationPair>
  const map = get(_$_translationPairsMap)

  // _$_translationPairsMap.update(map => {

  // console.log('TranslationSyncControllerImpl existingTranslations fileId:', JSON.stringify(fileId), map)
  // console.log('TranslationSyncControllerImpl existingTranslations keys:', [...map.keys()].map(k => JSON.stringify(k)))
  // console.log('TranslationSyncControllerImpl existingTranslations equal?', [...map.keys()].some(k => k === fileId))

  if (!map.has(fileId)) {
    map.set(fileId, new Map())
  }

  fileMap = map.get(fileId)!
  // return new Map(map) // force reactivity
  // })

  return fileMap!
}


/* ---------------------------------------
 * PAIRS MANAGEMENT
 * -------------------------------------*/

export function setPairs(
  fileId: string,
  pairs: TranslationPair[]
) {
  // console.log('TranslationSyncControllerImpl loadFiles setPairs1 ', { fileId, pairs })
  // return

  _$_translationPairsMap.update(map => {
    // console.log('TranslationSyncControllerImpl loadFiles setPairs2 ', { fileId, pairs, map })

    map.set(
      fileId,
      new Map(pairs.map(p => [p.uuid, p]))
    )
    // console.log('TranslationSyncControllerImpl loadFiles setPairs3 ', {
    //   fileId, pairs, map, 
    //   // "ff":
    //     // Array.from(get(_$_translationPairsMap).get(fileId).values())
    // })

    return map
  })


  // console.log('TranslationSyncControllerImpl loadFiles setPairs4 ', {
  //   "ff":
  //     Array.from(get(_$_translationPairsMap).get(fileId).values())
  // })
}

export function updateTranslation(
  fileId: string,
  translatedFileId: string,
  uuid: string,
  json: any,
  isEmpty: boolean
) {
  console.log('TranslationSyncControllerImpl updateTranslation  ', { fileId, translatedFileId, json })
  // return
  _$_translationPairsMap.update(map => {
    const fileMap = getOrCreateFileMap(fileId, map)
    // get the pair with the id = translatedFileId
    const pair = fileMap.get(uuid)

    console.log('TranslationSyncControllerImpl updateTranslation enter1 ', { pair, fileMap, translatedFileId, map, "h": map.get(fileId) })

    if (!pair) return map
    // 🔒 Only update if this pair belongs to the translated file
    if (pair.id !== translatedFileId) return map

    const translatedMap = new Map<string, any>()

    translatedMap.set(translatedFileId, json)

    const updated = {
      ...pair,
      id: translatedFileId,
      json,
      translated: translatedMap,
      // translated: json,
      isEmpty,
    }
    console.log('TranslationSyncControllerImpl updateTranslation enter2 ', { updated, fileMap })


    fileMap.set(uuid, updated)
    console.log('TranslationSyncControllerImpl updateTranslation enter3 ', { map, fileMap })

    return map
  })

  const hash = hashNode(json)
  _$_translationSyncController.updateTranslated(fileId, translatedFileId, uuid, hash, json)

  // Save the file
  Utils.saveAllTranslationsFor(fileId, translatedFileId)

  // Utils.saveToFileDebounced(translatedFileId, JSON.stringify(json))
  // saveContentDebounced(editor)

  // persistStore<TranslationPairsMap>(translatedFileId, _$_translationPairsMap, null, null, false)
}

/* export function addExistingOrEmptyTranslation(
  fileId: string,
  // translatedFileId: string | null,
  uuid: string,
  originalNode: any
) {
  console.log('TranslationSyncControllerImpl existingTranslations  ', { fileId, })

  _$_translationPairsMap.update(map => {
    // const fileMap = map

    // if (!map.has(fileId)) {
    //   map.set(fileId, new Map())
    // }

    // return map.get(fileId)!

    // const fileMap = map.get(fileId)
    const fileMap = getOrCreateFileMap(fileId)
    console.log('TranslationSyncControllerImpl existingTranslations y122  ', { fileId, fileMap, map, "h": map.get(fileId) })

    if (fileMap.has(uuid)) return map

    const translatedFileIds = _$_documentEditorsList.getItem(fileId).document?.getDocumentTranslationsFilePaths()
    console.log('TranslationSyncControllerImpl existingTranslations y1  ', { fileId, fileMap, map, translatedFileIds })

    // translatedFileIds
    for (let index = 0; index < translatedFileIds.length; index++) {
      const translatedFileId = translatedFileIds[index];
      // const map = get(_$_translationPairsMap)

      const existingTranslations = fileMap.get(uuid)?.translated?.keys || []
      console.log('TranslationSyncControllerImpl existingTranslations y  ', { fileId, translatedFileId, existingTranslations })

      for (let i = 0; i < existingTranslations.length; i++) {
        const existingTranslation = existingTranslations[i];
        let translated = null
        let json = {
          type: 'paragraph',
          attrs: { uuid },
          content: [],
        }
        let isEmpty = true
        if (existingTranslation == translatedFileId) {
          translated = fileMap.get(uuid).translated.get(translatedFileId)
          json = translated
          isEmpty = false
        }

        fileMap.set(uuid, {
          id: translatedFileId,
          uuid,
          original: originalNode,
          translated: translated,
          json: json,
          isEmpty: isEmpty,
        })
      }
    }

    return map
  })
} */

export function addExistingOrEmptyTranslation(
  fileId: string,
  // translatedFileId: string | null,
  uuid: string,
  originalNode: any
) {
  // return
  _$_translationPairsMap.update(map => {
    const fileMap = getOrCreateFileMap(fileId)
    // const fileMap = getOrCreateFileMap(fileId, map)

    // get the pair with the id = translatedFileId
    const pair = fileMap.get(uuid)

    console.log('TranslationSyncControllerImpl addExistingOrEmptyTranslation enter1 ', { uuid, pair, fileMap, map, "h": map.get(fileId) })

    if (pair) return map
    // 🔒 Only update if this pair belongs to the translated file
    // if (pair.id !== translatedFileId) return map



    // if (fileMap.has(uuid)) return map

    const translatedFileIds = _$_documentEditorsList.getItem(fileId).document?.getDocumentTranslationsFilePaths()



    // translatedFileIds
    for (let index = 0; index < translatedFileIds.length; index++) {
      const translatedFileId = translatedFileIds[index];
      const translatedMap = new Map<string, any>()

      //   const translatedRaw = await window.api.node.fsPromises.readFile(translatedFileId, 'utf-8')
      // const translatedJson = JSON.parse(translatedRaw)

      translatedMap.set(translatedFileId, originalNode)

      fileMap.set(uuid, {
        id: translatedFileId,
        uuid,
        original: originalNode,
        translated: translatedMap,
        json: originalNode,
        isEmpty: true,
      })
    }
    console.log('TranslationSyncControllerImpl addExistingOrEmptyTranslation enter12 ', { uuid, pair, fileMap, map, "h": map.get(fileId) })


    return map
  })
}

/* export function addExistingOrEmptyTranslation2(
  fileId: string,
  // translatedFileId: string | null,
  uuid: string,
  originalNode: any
) {
  return
  _$_translationPairsMap.update(map => {
    const fileMap = getOrCreateFileMap(fileId)

    if (fileMap.has(uuid)) return map

    const translatedFileIds = _$_documentEditorsList.getItem(fileId).document?.getDocumentTranslationsFilePaths()

    // translatedFileIds
    for (let index = 0; index < translatedFileIds.length; index++) {
      const translatedFileId = translatedFileIds[index];
      fileMap.set(uuid, {
        id: translatedFileId,
        uuid,
        original: originalNode,
        translated: null,
        json: {
          type: 'paragraph',
          attrs: { uuid },
          // content: [{
          //           "type": "text",
          //           "text": "kjjj"
          //       }],
          content: [],
        },
        isEmpty: true,
      })
    }

    return map
  })
} */

export function removeTranslation(
  fileId: string,
  // translatedFileId: string | null,
  uuid: string
) {
  // return
  _$_translationPairsMap.update(map => {
    map.get(fileId)?.delete(uuid)
    return map
  })
  // Save the file
  Utils.saveAllTranslationsFor(fileId, null)

}




/* ---------------------------------------
 * FACTORY
 * -------------------------------------*/

export function createTranslationSyncController() {
  const controller = new TranslationSyncControllerImpl()

  const originalAddedListeners = new Set<OriginalAddedListener>()
  const originalUpdatedListeners = new Set<OriginalUpdatedListener>()
  const originalRemovedListeners = new Set<OriginalRemovedListener>()

  // Used only to trigger Svelte reactivity
  const { subscribe, set } = writable(0)
  const notify = () => set(Date.now())

  return {
    subscribe,

    /* -----------------------------------
     * SYNC (fileId-aware)
     * ---------------------------------*/

    updateOriginal(
      fileId: string,
      uuid: string,
      hash: string,
      node: any
    ) {
      controller.updateOriginal(fileId, uuid, hash, node)
      notify()
    },

    updateTranslated(
      fileId: string, translatedFileId: string | null,
      uuid: string,
      hash: string,
      node: any
    ) {
      controller.updateTranslated(fileId, translatedFileId, uuid, hash, node)
      notify()
    },

    isOutdated(fileId: string, uuid: string) {
      return controller.isOutdated(fileId, uuid)
    },

    isTranslationOutdated(fileId: string, translatedFileId: string | null, uuid: string) {
      return controller.isTranslationOutdated(fileId, translatedFileId, uuid)
    },

    getRecord(fileId: string, uuid: string) {
      return controller.getRecord(fileId, uuid)
    },

    /* -----------------------------------
     * EVENTS (fileId-aware)
     * ---------------------------------*/

    onOriginalAdded(fn: OriginalAddedListener) {
      originalAddedListeners.add(fn)
      return () => originalAddedListeners.delete(fn)
    },

    onOriginalUpdated(fn: OriginalUpdatedListener) {
      originalUpdatedListeners.add(fn)
      return () => originalUpdatedListeners.delete(fn)
    },

    onOriginalRemoved(fn: OriginalRemovedListener) {
      originalRemovedListeners.add(fn)
      return () => originalRemovedListeners.delete(fn)
    },

    notifyOriginalAdded(
      fileId: string,
      uuid: string,
      node: any
    ) {
      originalAddedListeners.forEach(fn =>
        fn(fileId, uuid, node)
      )
    },

    notifyOriginalUpdated(
      fileId: string,
      uuid: string,
      node: any
    ) {
      originalUpdatedListeners.forEach(fn =>
        fn(fileId, uuid, node)
      )
    },

    notifyOriginalRemoved(
      fileId: string,
      uuid: string
    ) {
      originalRemovedListeners.forEach(fn =>
        fn(fileId, uuid)
      )
    },

    /* -----------------------------------
     * CALLED BY EXTENSION
     * ---------------------------------*/

    originalParagraphSeen(
      fileId: string,
      uuid: string,
      originalNode: any
    ) {
      controller.originalParagraphSeen(fileId, uuid, originalNode)
      addExistingOrEmptyTranslation(fileId, uuid, originalNode)
      // addEmptyTranslation(fileId,null, uuid, originalNode)

      this.notifyOriginalAdded(fileId, uuid, originalNode)
      notify()
    },

    originalParagraphUpdated(
      fileId: string,
      uuid: string,
      originalNode: any
    ) {
      this.notifyOriginalUpdated(fileId, uuid, originalNode)
    },

    originalParagraphRemoved(
      fileId: string,
      // translatedFileId: string | null,
      uuid: string
    ) {
      removeTranslation(fileId, uuid)
      this.notifyOriginalRemoved(fileId, uuid)
    },
  }
}


/* ---------------------------------------
 * SINGLETON
 * -------------------------------------*/

export const _$_translationSyncController =
  createTranslationSyncController()
