import * as Y from 'yjs'

export function encodeSnapshot(ydoc: Y.Doc): string {
  const update = Y.encodeStateAsUpdate(ydoc)
  return Buffer.from(update).toString('base64')
}
