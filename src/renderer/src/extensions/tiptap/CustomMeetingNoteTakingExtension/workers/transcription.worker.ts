// transcription.worker.ts
import { initDB, deleteOldMeetings } from '../dbs/db';

let db: any;
let activeSegments = new Map(); // Sliding window of the last 100 segments
let batchText = "";
let currentRoom = "";

// Initialize Worker
self.onmessage = async (e) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'START':
            db = await initDB();
            currentRoom = payload.room;

            // 1. Run maintenance: Clear data older than 30 days
            try {
                await deleteOldMeetings(db);
            } catch (err) {
                console.error("Cleanup failed:", err);
            }

            // 2. Connect to the WebSocket
            connectWebSocket(payload.url, payload.room);
            break;

        case 'QUERY_HISTORY':
            // Pulls historical data from Disk (IndexedDB) based on time range
            const history = await getHistoryByTime(payload.start, payload.end);
            self.postMessage({ type: 'HISTORY_DATA', payload: history });
            break;

        case 'FORCE_FLUSH':
            flush();
            break;
    }
};

/**
 * WebSocket Connection Logic
 */
function connectWebSocket(url: string, room: string) {
    const ws = new WebSocket(url);

    ws.onopen = () => {
        console.log(`[Worker] Connected to Room: ${room}`);
        // console.log("associatedMeetingLinks Worker WS open:", e);
        // Tell the Python server which room we are interested in
        ws.send(`SUBSCRIBE:${room}`);
        // ws.send(JSON.stringify({ type: 'SUBSCRIBE', room: room }));
    };

    ws.onmessage = async (msg) => {
        try {
            const data = JSON.parse(msg.data);

            // Filter out non-transcription messages
            if (data.target && data.target !== 'liveTranscription') return;

            // Process the segment
            await processIncomingData({
                id: data.id || crypto.randomUUID(), // Ensure unique ID for Map/DB
                room: room,
                peerName: data.peerName || 'Unknown',
                text: data.text,
                isFinal: data.isFinal || false,
                timeObj: new Date() // For Indexing and Filtering
            });

        } catch (err) {
            console.error("[Worker] Error parsing WS message:", err);
        }
    };

    ws.onerror = (err) => console.error("[Worker] WS Error:", err);
    ws.onclose = () => {
        console.warn("[Worker] WS Closed. Attempting reconnect in 3s...");
        setTimeout(() => connectWebSocket(url, room), 3000);
    };
}

/**
 * Persistence & Memory Management Layer
 */
async function processIncomingData(segment: any) {
    // 1. Save to Disk (IndexedDB) - Absolute data safety
    await db.put('transcripts', segment);

    // 2. Update Hot RAM Cache (Map)
    // If it's a 'partial' update with the same ID, .set() overwrites automatically
    activeSegments.set(segment.id, segment);

    // 3. Sliding Window: Keep only last 100 entries in RAM
    if (activeSegments.size > 100) {
        const oldestKey = activeSegments.keys().next().value;
        activeSegments.delete(oldestKey);
    }

    // 4. Send "Hot" updates to the UI thread
    self.postMessage({
        type: 'LIVE_UPDATE',
        payload: Array.from(activeSegments.values())
    });

    // 5. If it's final, we can trigger specific logic (like AI Action Detection)
    if (segment.isFinal) {
        self.postMessage({ type: 'SEGMENT_FINALIZED', payload: segment });
    }
}

/**
 * Database Query Functions
 */
async function getHistoryByTime(start: Date, end: Date) {
    try {
        // Use the 'timestamp' (timeObj) index for efficient range queries
        const range = IDBKeyRange.bound(new Date(start), new Date(end));
        return await db.getAllFromIndex('transcripts', 'timestamp', range);
    } catch (err) {
        console.error("[Worker] History Query Failed:", err);
        return [];
    }
}

function flush() {
    // Logic for manually pushing remaining batch data if needed
    if (batchText.length > 0) {
        console.log("[Worker] Manual Flush Triggered");
        // Implementation depends on if you want to force-close a sentence
    }
}