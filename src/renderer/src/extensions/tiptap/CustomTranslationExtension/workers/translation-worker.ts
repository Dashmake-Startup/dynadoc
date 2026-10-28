import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();

// --- Shared State ---
const tabStates = new Map<string, { hashes: Map<string, string>, stale: Set<string> }>();
const htmlCache = new Map<string, string>();
const pendingChanges = new Map<string, any>();
let saveTimeout: any = null;
const SAVE_DEBOUNCE_MS = 1000;
const originalContentIndex = new Map<string, any>();

// Utility for Adobe rendering
function generateAdobeThemedHtml1(content: any): string {
  const body = typeof content === 'string' ? md.render(content) : "No Content";
  return `<div class="adobe-static-preview">${body}</div>`;
}
// Inside translation-worker.ts
function generateAdobeThemedHtml(content: any): string {
  // If content is Tiptap JSON (object), we extract text or use a simple serializer
  if (typeof content === 'object' && content !== null) {
    // Basic fallback: extract text from paragraph nodes
    const text = content.content?.map((n: any) => n.text).join(' ') || "";
    return `<div class="adobe-static-preview">${text}</div>`;
  }

  const body = typeof content === 'string' ? md.render(content) : "";
  return `<div class="adobe-static-preview">${body}</div>`;
}
// --- Shared State ---
const connections = new Set<MessagePort>(); // Track all open tabs

// Unified Connection Handler

self.onconnect = (e: MessageEvent) => {
  const port = e.ports[0];
  connections.add(port); // Add new tab to the broadcast list

  // Unified Connection Handler
  // self.onconnect = (e: MessageEvent) => {
  // const port = e.ports[0];

  port.onmessage = async (msg: MessageEvent) => {
    // console.log("WorkerSync onmessage", {msg})

    const data = msg.data;
    const { type, tabId, id, payload, html } = data;
    // console.log("WorkerSync onmessage data", {data})

    // ---  BROADCAST SOURCE_CHANGED ---
    /*  if (type === 'SOURCE_CHANGED') {
       console.log(`[Worker] Broadcasting source change for node: ${id}`);
       // Send to EVERY connected tab EXCEPT the one that sent it (optional)
       connections.forEach(conn => {
         // if (conn !== port) // Uncomment to avoid echoing back to sender
         conn.postMessage({ type: 'SOURCE_CHANGED', id, html });
       });
       return; // Stop processing further for this type
     } */

    switch (type) {
      // 1. STALE TRACKING LOGIC
      case 'NODE_DELETED': {
        connections.forEach(conn => {
          conn.postMessage({ type: 'NODE_DELETED', id: data.id });
        });
        break;
      }
      case 'NODE_SYNC': {
        connections.forEach(conn => {
          conn.postMessage({
            type: 'NODE_SYNC',
            id: data.id,
            html: data.html,
            prevId: data.prevId, // 👈 Send the neighbor's ID for relative positioning
            nodeType: data.nodeType,
            json: data.json
          });
        });
        break;
      }
      case 'FULL_VIEW_UPDATE': {
        const { id, html, json } = data;
        // Broadcast to all tabs (specifically the Side-by-Side Virtual List)
        connections.forEach(conn => {
          conn.postMessage({
            type: 'SYNC_FROM_FULL_VIEW',
            id,
            html,
            json
          });
        });
        break;
      }
      case 'SYNC_TO_FULL_VIEW': {
        connections.forEach(conn => {
          // Broadcast to the Full Editor tab
          conn.postMessage({
            type: 'SYNC_FROM_LIST_VIEW',
            id: data.id,
            json: data.json
          });
        });
        break;
      }
      /* case 'GET_ALL_ORIGINALS': {
        // Convert our Map of originals to a plain object for the port
        const mapObj = Object.fromEntries(originalContentIndex);
        port.postMessage({ type: 'ALL_ORIGINALS_RESPONSE', map: mapObj });
        break;
      } */
      /* case 'SYNC_ORIGINAL': {
        // When the Main Editor seeds the document, store originals here
        payload.forEach(item => {
          originalContentIndex.set(item.id, item.html);
        });
        break;
      } */

      /* case 'GET_ORIGINAL_CONTENT': {
        const html = originalContentIndex.get(data.id) || "Content not found";
        port.postMessage({
          type: 'ORIGINAL_CONTENT_RESPONSE',
          id: data.id,
          html
        });
        break;
      } */

      case 'SYNC_ORIGINAL': {
        console.log("WorkerSync SYNC_ORIGINAL", { payload })
        payload.forEach(item => {
          // Store as an object containing both HTML and JSON
          originalContentIndex.set(item.id, {
            html: item.html,
            json: item.json
          });
        });
        break;
      }

      case 'GET_ALL_ORIGINALS': {
        const mapObj = Object.fromEntries(originalContentIndex);
        port.postMessage({ type: 'ALL_ORIGINALS_RESPONSE', map: mapObj });
        break;
      }

      case 'GET_ORIGINAL_CONTENT': {
        const dataStore = originalContentIndex.get(data.id);
        port.postMessage({
          type: 'ORIGINAL_CONTENT_RESPONSE',
          id: data.id,
          html: dataStore ? dataStore.html : "Content not found"
        });
        break;
      }

      /* case 'SYNC_ORIGINAL': {
        const state = tabStates.get(tabId) || { hashes: new Map(), stale: new Set() };
        const newStale: string[] = [];

        payload.forEach(({ id, hash }: { id: string, hash: string }) => {
          if (state.hashes.has(id) && state.hashes.get(id) !== hash) {
            state.stale.add(id);
            newStale.push(id);
          }
          state.hashes.set(id, hash);
        });

        tabStates.set(tabId, state);
        port.postMessage({ type: 'STALE_UPDATED', ids: newStale });
        break;
      } */

      case 'RESOLVE_STALE': {
        const state = tabStates.get(tabId);
        if (state) state.stale.delete(id);
        break;
      }

      // 2. PRE-RENDERING LOGIC (Phantom Sync)
      case 'PRE_RENDER_REQUEST': {
        if (htmlCache.has(id)) {
          port.postMessage({ type: 'PRE_RENDER_COMPLETE', id, html: htmlCache.get(id) });
        } else {
          const renderedHtml = generateAdobeThemedHtml(data.content);
          htmlCache.set(id, renderedHtml);
          port.postMessage({ type: 'PRE_RENDER_COMPLETE', id, html: renderedHtml });
        }
        break;
      }

      // 3. DEBOUNCED SAVE LOGIC
      case 'SAVE_TRANSLATION': {
        const { nodeId, json, filePath, translatedFilePath } = payload;
        console.log('TranslationSyncControllerImpl SAVE_TRANSLATION  ', {
          filePath,
          translatedFilePath,
          json
        })

        // Update the cache so the preview is immediately correct next time it renders
        const previewHtml = generateAdobeThemedHtml(json);
        htmlCache.set(nodeId, previewHtml);

        pendingChanges.set(nodeId, { json, filePath, translatedFilePath });

        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          commitChangesToDisk(port); // Pass port to communicate back to main thread
        }, SAVE_DEBOUNCE_MS);
        break;
      }
    }
  };

  // Clean up when tab closes
  port.addEventListener('close', () => {
    connections.delete(port);
  });
};

async function commitChangesToDisk(port: MessagePort) {
  if (pendingChanges.size === 0) return;

  const changesToProcess = Array.from(pendingChanges.entries());
  pendingChanges.clear();

  console.log(`[Worker] Committing ${changesToProcess.length} nodes to disk...`);

  try {
    // NOTE: SharedWorkers use port.postMessage to talk to the tab that triggered the save
    // Or self.postMessage if the environment supports it broadcast-style
    port.postMessage({
      type: 'DISK_WRITE_BATCH',
      changes: changesToProcess
    });
  } catch (err) {
    console.error("Failed to save translations:", err);
  }
}