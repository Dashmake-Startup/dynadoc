import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'MeetingArchive';
const STORE_NAME = 'transcripts';
const RETENTION_DAYS = 30;

/**
 * Initializes the IndexedDB with necessary indices for 
 * fast filtering by room and timestamp.
 */
export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      // Create the store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        
        // Index for filtering by Meeting ID/Room
        store.createIndex('room', 'room');
        
        // Index for Time-based filtering and Cleanup
        store.createIndex('timestamp', 'timeObj');
      }
    },
  });
}

/**
 * Removes segments older than the retention period.
 * Runs in the background thread of the worker.
 */
export async function deleteOldMeetings(db: IDBPDatabase) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const tx = db.transaction(STORE_NAME, 'readwrite');
  const index = tx.store.index('timestamp');
  
  // Select all records from the beginning of time up to the cutoff
  let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff));

  let deletedCount = 0;
  while (cursor) {
    await cursor.delete();
    deletedCount++;
    cursor = await cursor.continue();
  }
  
  await tx.done;
  if (deletedCount > 0) {
    console.log(`🧹 DB Cleanup: Purged ${deletedCount} stale segments older than ${RETENTION_DAYS} days.`);
  }
}

/**
 * Optional: Clear all segments for a specific meeting room
 */
export async function clearRoom(db: IDBPDatabase, roomName: string) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const index = tx.store.index('room');
  let cursor = await index.openCursor(IDBKeyRange.only(roomName));

  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
  console.log(`🗑️ Room ${roomName} cleared from local storage.`);
}