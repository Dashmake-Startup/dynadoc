import { derived, writable } from "svelte/store";
import type { SuggestionItemsType } from "../utils/utils";

/**
 * Global Bus: Used to notify Svelte NodeViews when specific UUIDs change.
 * This prevents every reference from re-scanning the doc on every keystroke.
 */
export const _$_referenceUpdates = writable<string>('');


// A Map where key = editorId, value = Map<uuid, SuggestionItemsType>
export const _$_wysiwygEditorDynamicReferenceIndexes = writable<Map<string, Map<any, SuggestionItemsType>>>(new Map());

// A derived helper to get a flattened index of ALL nodes across ALL editors
export const _$_wysiwygEditorDynamicReferenceAllNodesIndex = derived(_$_wysiwygEditorDynamicReferenceIndexes, ($indexes) => {
    const combined = new Map<any, SuggestionItemsType>();
    $indexes.forEach((editorMap) => {
        editorMap.forEach((data, id) => combined.set(id, data));
    });
    return combined;
});