import { tick } from 'svelte';
// '82242NewSquid'

class TranscriptionStore {
    historicalFeed = $state([]);
    liveFeed = $state([]);
    worker = $state<Worker | null>(null);
    isInitialized = $state(false);

    queryHistory(start: Date, end: Date) {
        this.worker?.postMessage({
            type: 'QUERY_HISTORY',
            payload: { start, end }
        });
    }

    init(roomId: string, wsUrl: string) {
        if (this.isInitialized) return;

        this.worker = new Worker(
            new URL('../workers/transcription.worker.ts', import.meta.url),
            { type: 'module' }
        );

        this.worker.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'LIVE_UPDATE') {
                this.liveFeed = payload;
            }
            if (type === 'HISTORY_DATA') this.historicalFeed = payload

        };

        this.worker.postMessage({
            type: 'START',
            payload: { url: wsUrl, room: roomId }
        });

        this.isInitialized = true;
    }

    terminate() {
        this.worker?.terminate();
        this.isInitialized = false;
        this.liveFeed = [];
        this.historicalFeed = [];
    }
}

export const transcriptionStore = new TranscriptionStore();