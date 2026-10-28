import { writable } from 'svelte/store'
import { _$_activePrimarySidebarItem, _$_primarySidebarVisible } from './common.store'

export type SearchMode = 'text' | 'variable'
export type SearchScopeType = 'workspace' | 'folder' | 'file'

export type SearchRequest = {
  id: number
  query: string
  mode: SearchMode
  scopePath: string | null
  scopeType: SearchScopeType
  sourcePath: string | null
  autoFocus: boolean
}

function createInitialRequest(): SearchRequest {
  return {
    id: 0,
    query: '',
    mode: 'text',
    scopePath: null,
    scopeType: 'workspace',
    sourcePath: null,
    autoFocus: false
  }
}

export const _$_searchRequest = writable<SearchRequest>(createInitialRequest())

export function openPrimarySearchPane(partial: Partial<SearchRequest> = {}) {
  _$_primarySidebarVisible.set(true)
  _$_activePrimarySidebarItem.set('search')
  _$_searchRequest.update((prev) => ({
    ...prev,
    ...partial,
    id: Date.now(),
    autoFocus: partial.autoFocus ?? true
  }))
}

