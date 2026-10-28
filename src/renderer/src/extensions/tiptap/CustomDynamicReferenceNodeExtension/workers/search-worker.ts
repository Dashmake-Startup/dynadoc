// search-worker.ts
let editorIndexes = new Map(); // key: editorId, value: SuggestionItemsType[]

self.onmessage = function (e) {
    const { type, payload, requestId, editorId: directEditorId } = e.data;

    // 1. Handle Index Updates
    if (type === 'UPDATE_INDEX') {
        // Use either the top-level editorId or the one inside payload
        const id = directEditorId || e.data.payload.editorId; 
        editorIndexes.set(id, payload);
        return;
    }

    // 2. Handle Editor Cleanup
    if (type === 'CLEAR_EDITOR') {
        const id = directEditorId || payload?.editorId;
        editorIndexes.delete(id);
        console.log(`Worker: Cleared index for ${id}`);
        return;
    }

    // 3. Handle Scoped Search
    if (type === 'SEARCH') {
        const { query, limit = 20, editorId: searchEditorId } = payload;
        const search = query.toLowerCase();
        const results = [];

        // FIX: Get items ONLY for the requested editorId
        const items = editorIndexes.get(searchEditorId) || [];

        for (const item of items) {
            // Check if the search term matches the 'text' (our Search Surface)
            if (item.text.toLowerCase().includes(search)) {
                results.push({ 
                    ...item, 
                    sourceEditorId: searchEditorId 
                });
            }
            if (results.length >= limit) break;
        }

        self.postMessage({ type: 'RESULTS', results, requestId });
    }
};