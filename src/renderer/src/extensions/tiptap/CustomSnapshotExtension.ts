import { Extension } from '@tiptap/core'

interface Snapshot {
  id: string
  content: string
  createdAt: number
}

const STORAGE_KEY = 'tiptap_snapshots'

export const CustomSnapshotExtension = Extension.create({
  name: 'snapshot',

  addOptions() {
    return {
      maxSnapshots: 50
    }
  },

  addStorage() {
    return {
      snapshots: [] as Snapshot[]
    }
  },

  onCreate() {
    console.log("oncreate snap")
    
    // onCreate({ storage }) {
    // Load saved snapshots from localStorage
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      this.storage.snapshots = JSON.parse(saved)
    }
  },
  addCommands() {
    return {
      saveSnapshot:
        () =>
        ({ editor }) => {
          const content = editor.getHTML()
          const snapshot: Snapshot = {
            id: Date.now().toString(),
            content,
            createdAt: Date.now()
          }

          // access storage via this.storage
          this.storage.snapshots.push(snapshot)

          // enforce maxSnapshots
          if (this.storage.snapshots.length > this.options.maxSnapshots) {
            this.storage.snapshots.shift()
          }

          // persist to localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.storage.snapshots))

          return true
        },

      restoreSnapshot:
        (id: string) =>
        ({ editor }) => {
          const snapshot = this.storage.snapshots.find((s) => s.id === id)
          if (!snapshot) return false
          editor.commands.setContent(snapshot.content)
          return true
        },

      listSnapshots: () => () => {
        return this.storage.snapshots
      },

      clearSnapshots: () => () => {
        this.storage.snapshots = []
        localStorage.removeItem(STORAGE_KEY)
        return true
      }
    }
  }

  /* addCommands() {
    return {
      saveSnapshot:
        () =>
        ({ editor, storage }) => {
          const content = editor.getHTML()
          const snapshot: Snapshot = {
            id: Date.now().toString(),
            content,
            createdAt: Date.now()
          }

          storage.snapshots.push(snapshot)

          // enforce maxSnapshots
          if (storage.snapshots.length > this.options.maxSnapshots) {
            storage.snapshots.shift()
          }

          // persist to localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(storage.snapshots))

          return true
        },

      restoreSnapshot:
        (id: string) =>
        ({ editor, storage }) => {
          const snapshot = storage.snapshots.find((s) => s.id === id)
          if (!snapshot) return false
          editor.commands.setContent(snapshot.content)
          return true
        },

      listSnapshots:
        () =>
        ({ storage }) => {
          return storage.snapshots
        },

      clearSnapshots:
        () =>
        ({ storage }) => {
          storage.snapshots = []
          localStorage.removeItem(STORAGE_KEY)
          return true
        }
    }
  } */
})
