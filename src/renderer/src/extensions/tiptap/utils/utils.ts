// import { _ as base_, isLoading } from 'svelte-i18n'
import { get } from 'svelte/store'
import { DocumentEditorModel, DocumentModel } from '../../../models/Document'
import { _$_documentEditorsList } from '../../../stores/editor.store'
import EditorHelpers from '../../../utils/EditorHelpers'
import Utils from '../../../utils/Utils'
import { nodeApi } from '../../../utils/shims/node'

// const _ = get(base_)
// const fs = nodeApi.fs
// const path = nodeApi.path

// const fs = window.node?.fs
// const path = window.node?.path
// const fs = window.node?.fs
// const path = window.node?.path

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

export interface DragParams {
  isMinimized: boolean;
  onDragStart?: () => void;
}

export async function ensureNodeViewSrc1(_src: string, baseName: string,
  assetType: typeof DocumentModel.AssetType[keyof typeof DocumentModel.AssetType],
  document?: DocumentModel | string,
  subfolders?: [any]
): Promise<string> {
  // if (_src) return
  if (_src && await nodeApi.fsPromises.exists(_src)) {
    return _src
  }
  if (!_src) {
    // Base translatable name
    // const baseName = _('Sheet')

    // Get base cache dir
    // const ddocCacheDir =
    // '~/Library/Application Support/ddoc-office/ddoc-office/test/'
    const ddocCacheDir = await window.api.getCacheDir()
    if (!ddocCacheDir) {
      throw new Error('Cache directory not available')
    }

    let documentEditor: DocumentEditorModel
    if (document && typeof document === "string") {
      documentEditor = get(_$_documentEditorsList.get(document))
      document = null
    }
    documentEditor = documentEditor || get(_$_documentEditorsList.getActive())

    document = (document || documentEditor?.document) as DocumentModel
    // Active editor
    // const activeEditorStore = _$_documentEditorsList.getActive()
    // const activeEditor = get(activeEditorStore)

    const parentDir = document?.getAsset(assetType)
    // const parentDir = activeEditor?.document?.getAsset(assetType)
    // const parentDir = activeEditor?.document?.getAsset(DocumentModel.AssetType.SHEET)

    if (!parentDir) {
      throw new Error('Parent directory not resolved')
    }
    // 1. Determine the name of the "Collection" folder (e.g., "Survey")
    // If subfolders is [$_('Survey')], we use that as the base for the unique folder.
    const collectionBaseName = (subfolders && subfolders.length > 0)
      ? subfolders[0]
      : 'Folder';

    // 2. Generate a unique FOLDER name (e.g., "Survey", "Survey 2")
    // We pass NO extension here because we want a directory.
    const uniqueFolderName = await EditorHelpers.generateUniqueNameAsync({
      baseName: collectionBaseName,
      parentDir: parentDir,
      extension: ""
    });

    const fullFolderPath = nodeApi.path.join(parentDir, uniqueFolderName);

    // 3. Append the fixed index.json filename
    // baseName passed from the component is "index"
    const fileName = `${baseName}${Utils.SERIALIZATION_FILE_EXTENSION}`; // index.json

    _src = nodeApi.path.join(parentDir, ...finalSubfolders, folderName)
    // _src = nodeApi.path.join(parentDir, ...(subfolders || []), folderName)
  }

  if (!(await nodeApi.fsPromises.exists(_src))) {
    EditorHelpers.writeFileEnsuringDir(_src, '', 'utf8')
  }

  // keep Tiptap node attrs in sync
  // updateAttributes({ src: _src })
  return _src
}

// INNOVATIVE FIX: Use a lock mechanism to prevent race conditions 
// when multiple nodes are inserted simultaneously and need unique sequential names.
const creationLocks = new Map<string, Promise<void>>();

export async function ensureNodeViewSrc(
  _src: string,
  baseName: string, // "index" or "slide" or "survey"
  assetType: typeof DocumentModel.AssetType[keyof typeof DocumentModel.AssetType],
  document?: DocumentModel | string,
  subfolders?: string[], // e.g., ["assets", "surveys"],
  defaultContent?: string
): Promise<string> {

  if (_src && await nodeApi.fsPromises.exists(_src)) {
    return _src;
  }

  if (!_src) {
    const ddocCacheDir = await window.api.getCacheDir();
    if (!ddocCacheDir) throw new Error('Cache directory not available');

    let documentEditor: DocumentEditorModel;
    if (document && typeof document === "string") {
      documentEditor = get(_$_documentEditorsList.get(document));
      document = null;
    }
    documentEditor = documentEditor || get(_$_documentEditorsList.getActive());
    document = (document || documentEditor?.document) as DocumentModel;

    let currentPath = document?.getAsset(assetType);
    if (!currentPath) throw new Error('Parent directory not resolved');

    // Build the asset directory path with subfolder structure
    if (subfolders && subfolders.length > 0) {
      for (let i = 0; i < subfolders.length; i++) {
        currentPath = nodeApi.path.join(currentPath, subfolders[i]);
      }
    }

    // Await any existing lock for this directory to ensure sequential name generation
    const lockKey = currentPath;
    while (creationLocks.has(lockKey)) {
      await creationLocks.get(lockKey);
    }

    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    creationLocks.set(lockKey, lockPromise);

    try {
      // Generate a unique FILENAME (not folder) at the asset root level
      // This will create: slide.json, slide2.json, slide3.json etc.
      const uniqueFileName = await EditorHelpers.generateUniqueNameAsync({
        baseName: baseName,
        parentDir: currentPath,
        extension: Utils.SERIALIZATION_FILE_EXTENSION,
        separator: ''
      });

      _src = nodeApi.path.join(currentPath, uniqueFileName);

      // Create the file immediately while holding the lock to "reserve" the name
      if (!(await nodeApi.fsPromises.exists(_src))) {
        EditorHelpers.writeFileEnsuringDir(_src, defaultContent || '{}', 'utf8');
      }
    } finally {
      // Release the lock
      creationLocks.delete(lockKey);
      resolveLock!();
    }
  } else {
     // If _src was provided but doesn't exist yet, create it
     if (!(await nodeApi.fsPromises.exists(_src))) {
        EditorHelpers.writeFileEnsuringDir(_src, defaultContent || '{}', 'utf8');
     }
  }

  return _src;
}

export async function ensureNodeViewSrc1111(
  _src: string,
  baseName: string, // "index"
  assetType: typeof DocumentModel.AssetType[keyof typeof DocumentModel.AssetType],
  document?: DocumentModel | string,
  subfolders?: string[] // e.g., ["assets", "survey", "Survey"]
): Promise<string> {

  if (_src && await nodeApi.fsPromises.exists(_src)) {
    return _src;
  }

  if (!_src) {
    const ddocCacheDir = await window.api.getCacheDir();
    if (!ddocCacheDir) throw new Error('Cache directory not available');

    let documentEditor: DocumentEditorModel;
    if (document && typeof document === "string") {
      documentEditor = get(_$_documentEditorsList.get(document));
      document = null;
    }
    documentEditor = documentEditor || get(_$_documentEditorsList.getActive());
    document = (document || documentEditor?.document) as DocumentModel;

    let currentPath = document?.getAsset(assetType);
    if (!currentPath) throw new Error('Parent directory not resolved');

    if (subfolders && subfolders.length > 0) {
      // 1. Traverse/Create all subfolders EXCEPT the last one statically
      for (let i = 0; i < subfolders.length - 1; i++) {
        currentPath = nodeApi.path.join(currentPath, subfolders[i]);
        await nodeApi.fsPromises.mkdir(currentPath, { recursive: true });
      }

      // 2. The LAST subfolder in the array is the "Unique" one (e.g., "Survey")
      const targetBaseName = subfolders[subfolders.length - 1];

      const uniqueFolderName = await EditorHelpers.generateUniqueNameAsync({
        baseName: targetBaseName,
        parentDir: currentPath,
        extension: "" // Folders have no extension
      });

      currentPath = nodeApi.path.join(currentPath, uniqueFolderName);
    }

    // 3. Append the filename (index.json)
    const fileName = `${baseName}${Utils.SERIALIZATION_FILE_EXTENSION}`;
    _src = nodeApi.path.join(currentPath, fileName);
  }

  // Final Safety: Ensure the directory and the index file exist
  if (!(await nodeApi.fsPromises.exists(_src))) {
    EditorHelpers.writeFileEnsuringDir(_src, '{}', 'utf8');
  }

  return _src;
}

export function dragMinimizedWindow(node: HTMLElement, params: DragParams) {
  let x = 0;
  let y = 0;
  let translateX = 0;
  let translateY = 0;

  const handleMousedown = (e: MouseEvent) => {
    if (!params.isMinimized || !(e.target as HTMLElement).closest('.drag-handle')) return;

    e.preventDefault();
    params.onDragStart?.(); // Notify Svelte that manual dragging has begun

    // Sync current position
    const style = window.getComputedStyle(node);
    const matrix = new DOMMatrixReadOnly(style.transform);
    translateX = matrix.m41;
    translateY = matrix.m42;

    x = e.clientX;
    y = e.clientY;

    node.style.transition = 'none';
    window.addEventListener('mousemove', handleMousemove);
    window.addEventListener('mouseup', handleMouseup);
  };

  const handleMousemove = (e: MouseEvent) => {
    const dx = e.clientX - x;
    const dy = e.clientY - y;

    translateX += dx;
    translateY += dy;

    x = e.clientX;
    y = e.clientY;

    node.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    window.dispatchEvent(new CustomEvent('embedded-view:update'));
  };

  const handleMouseup = () => {
    window.removeEventListener('mousemove', handleMousemove);
    window.removeEventListener('mouseup', handleMouseup);

    const rect = node.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // Corner Snapping Logic
    const distLeft = rect.left;
    const distRight = winW - rect.right;
    const distTop = rect.top;
    const distBottom = winH - rect.bottom;

    // Adjust translateX/Y for 24px padding snaps
    if (distLeft < distRight) translateX -= (distLeft - 24);
    else translateX += (distRight - 24);

    if (distTop < distBottom) translateY -= (distTop - 24);
    else translateY += (distBottom - 24);

    node.style.transition = 'transform 0.5s cubic-bezier(0.19, 1, 0.22, 1)';
    node.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    window.dispatchEvent(new CustomEvent('embedded-view:update'));
  };

  node.addEventListener('mousedown', handleMousedown);

  return {
    update(newParams: DragParams) {
      params = newParams;
      // If we go back to full screen, clear the inline transform
      if (!params.isMinimized) {
        node.style.transform = '';
      }
    },
    destroy() {
      node.removeEventListener('mousedown', handleMousedown);
    }
  };
}
