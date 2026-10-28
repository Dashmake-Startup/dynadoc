import { writable, derived } from 'svelte/store'

// ----------------------
// Global Monaco Editor Store for editing code in the app globally
// ----------------------

export interface MonacoModalData {
  filePath: string;
  fileRelativePath: string;
  language: string;
  /** Inline mode: initial code content when no file is backing the node. */
  content?: string;
  onSave?: (newCode: string, filePath: string, fileRelativePath: string) => void;
  onClose?: (newCode: string, filePath: string, fileRelativePath: string) => void;
}

/*
MonacoModal.open({
      filePath: '/path/to/file.ts',
      language: 'typescript',
      onSave: (newCode) => console.log('Saved!', newCode),
    });

 $MonacoModal.visible
*/
export const _$_monacoEditorModal = (() => {
  const visible = writable(false);
  const data = writable<MonacoModalData | null>(null);

  function open(modalData: MonacoModalData) {
    data.set(modalData);
    visible.set(true);
  }

  function close() {
    visible.set(false);
    data.set(null);
  }

  return {
    visible,
    data,
    open,
    close,
  };
})();