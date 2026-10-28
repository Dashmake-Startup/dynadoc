// import Utils from '../../../../../utils/Utils'
import React, { useEffect, useState } from 'react'
import Utils from '../../../../../utils/Utils'
import React, { useState, useEffect, useRef } from 'react'
import * as ReactDOM from 'react-dom/client'
import { useTree } from '@headless-tree/react'
import { v4 as uuid } from 'uuid'
import { nodeApi } from '../../../../utils/shims/node'
// import { syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature } from '@headless-tree/core'
import { asyncDataLoaderFeature, selectionFeature, hotkeysCoreFeature } from '@headless-tree/core'

import { FileIcon, defaultStyles } from 'react-file-icon'

import '@phosphor-icons/web/light'
import '@phosphor-icons/web/bold'
// import '../../../../components/common/web-component/vscode-elements/dist/bundled.js'


type FileNode = { name: string; path: string; isFolder: boolean }
// import fileIcons from 'file-icons-js'

// function getFileIconClass(fileName: string, isFolder: boolean) {
//   if (isFolder) return 'ph-folder-bold' // or any folder icon
//   return fileIcons.className(fileName) || 'ph-file-bold'
// }

// import { className as getFileIconClass } from 'file-icons-js'
// import 'file-icons-js/dist/style.css'
// import '@uiw/file-icons/fonts/ffont.css'

// var fs = nodeApi.fs
// var path = nodeApi.path

import * as icons from 'simple-icons'
import EditorHelpers from '../../../../utils/EditorHelpers'
import { mountSvelteComponent } from './utils/utils.js'
import ContextMenu from '../../contextMenu/ContextMenu.svelte'
import ContextMenuWidget from '../../contextMenu/components/ContextMenuWidget.svelte'
import type { ContextMenuItem } from '../../contextMenu/utils/utils.js'
import EditorCommonUtils from '../../../../utils/common.utils.js'
import { openConfirmModal } from '../../../../stores/confirmModal.store'
import { openAlertModal } from '../../../../stores/alertModal.store'

// const iconClass = 'ffont ' + getClass('example.js')

// import * as fileIcons from 'file-icons-js'

declare global {
  interface Window {
    actionMap: Record<string, () => void>
  }
}

function getFileIcon(fileName: string, isFolder: boolean) {
  const extension = fileName.split('.').pop()

  var icon = isFolder ? (
    <i className={'ph-light ph-folder-bold'}></i>
  ) : (
    <i className={`ph-light ph-file-${extension}`}></i>
    // <i className={`ph-light ph-file-${extension} text-xl`}></i>
    // <FileIcon
    //   extension={extension}
    //   color="#f1c40f"
    //   glyphColor="#c0392b"
    //   foldColor="#d35400"
    //   {...defaultStyles[extension]}
    // />
  )
  return <div style={{ display: 'inline-block' }}>{icon}</div>
  // return <div style={{ display: 'inline-block', width: '10px' }}>{icon}</div>
  // return icon
}

// Render a .docx icon with default styles
{
  /* <FileIcon extension={Utils.OFFICE_EXTENSIONS_FORMAT.word} {...defaultStyles.docx} />; */
}

/* function getFileIconClass(fileName: string, isFolder: boolean) {
  // function getFileIconClass(item: any, isFolder: boolean) {
  var r = isFolder ? 'ph-folder-bold' : 'ffont ' + getClass('example.js') || 'ph-file-bold'
  // var r = isFolder ? 'ph-folder-bold' : fileIcons.getClass(fileName) || 'ph-file-bold'
  console.log('Icon class for', fileName, isFolder, 'ffont ' + getClass('example.js'), r)
  // console.log('Icon class for', fileName, isFolder, fileIcons.getClass(fileName), r)
  return r
} */

// import Utils from '../../../../../utils/Utils'
import React, { useState, useEffect, useRef } from 'react'

async function createNestedEntry(parent: string, raw: string, type: 'file' | 'folder') {
  const parts = raw.split('/').filter(Boolean)

  let current = parent

  // create every folder except last if file
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const isLast = i === parts.length - 1

    if (!isLast || type === 'folder') {
      // folder
      const folderPath = `${current}/${part}`
      await nodeApi.fs.mkdir(folderPath) // you must implement mkdirSafe (mkdir if not exist)
      // await window.api.mkdirSafe(folderPath) // you must implement mkdirSafe (mkdir if not exist)
      current = folderPath
    } else {
      // file
      const filePath = `${current}/${part}`
      await nodeApi.fs.api.writeFileSync(filePath)
      // await window.api.createFile(filePath)
      return filePath
    }
  }

  // if type === folder and single-level
  return `${current}/${parts[parts.length - 1]}`
}

async function nameExists(parentDir: string, name: string) {
  const children = await window.api.readDir(parentDir)
  return children.some((c) => c.name === name)
}

type TreeProps = {
  rootPath: string;
  rootParentPath: string;
  includeExtensions?: string[]; // e.g., ['.json', '.ts']
  excludeExtensions?: string[]; // e.g., ['.tmp', '.log']
};

function ReactTree({
  rootPath,
  rootParentPath,
  includeExtensions = [],
  excludeExtensions = []
}: TreeProps) {
  // function ReactTree({ rootPath, rootParentPath }: { rootPath: string, rootParentPath: string }) {
  const [items, setItems] = useState<Record<string, FileNode[]>>({})

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState<string>('')
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)
  const [typeAhead, setTypeAhead] = useState<string>('')
  const typeAheadTimeout = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [creatingItem, setCreatingItem] = useState<{
    parent: string
    type: 'file' | 'folder'
  } | null>(null)

  const [createValue, setCreateValue] = useState('')


  // const loadChildren = async (itemId: string) => {
  const loadChildren1 = async (itemId: string) => {
    var children = await window.api.readDir(itemId)
    /* const children = await window.api.readDir(dirPath, {
      sort: true,
      showHidden: false,
      showSystemHidden: false
    }) */
    children = children as FileNode[]
    console.log('Loading children for', itemId, children)
    var resultToReturn = []
    children.forEach((element) => {
      resultToReturn.push({ id: element.path, data: element })
    })
    return resultToReturn // <--- return directly
    // return { id: itemId, data: children } // <--- return directly
    // return children // <--- return directly
    // return { name: itemId, path: itemId, isFolder: true }
  }

const loadChildren = async (itemId: string) => {
  let children = await window.api.readDir(itemId);
  children = children as FileNode[];

  const filteredChildren = children.filter((file) => {
    console.log("filteredChildrenfile",{file})
    // 1. RULE: Folders always pass the filter
    if (file.isFolder) return true;

    const fileName = file.name.toLowerCase();

    // 2. RULE: Check Exclusions (Hide these specific files)
    if (excludeExtensions.length > 0) {
      const isExcluded = excludeExtensions.some(ext => 
        fileName.endsWith(ext.toLowerCase())
      );
      if (isExcluded) return false;
    }

    // 3. RULE: Check Inclusions (If list exists, file MUST be in it)
    if (includeExtensions.length > 0) {
      return includeExtensions.some(ext => 
        fileName.endsWith(ext.toLowerCase())
      );
    }

    // 4. Default: Show all files if no inclusion list is provided
    return true;
  });

  return filteredChildren.map((element) => ({
    id: element.path,
    data: element
  }));
};

  const tree = useTree<FileNode>({
    rootItemId: rootPath,
    // getItemName: (item){
    //   return ''
    // },
    getItemName: (item) => item.getItemData().name,
    // getItemName: (item) => item.getItemData().name + " " + item.getItemData().isFolder,
    // getItemName: (item) => JSON.stringify( item),
    // getItemName: (item) => item.name,
    // isItemFolder: (item) => true,
    isItemFolder: (item) => item.getItemData().isFolder,
    /* dataLoader: {
      getItem: (itemId) => {
        console.log('dataLoader getItem', itemId, items, rootPath)
        for (const key in items) {
          const found = items[key].find((i) => i.path === itemId)
          if (found) return found
        }
        return { name: itemId, path: itemId, isFolder: true }
      },
      // getChildren: (itemId) => ['x']
      getChildren: loadChildren // async is fine now
    }, */
    dataLoader: {
      getItem: async (itemId) => {
        console.log('dataLoader getItem', { itemId, items, rootPath, rootParentPath })
        // Root item
        if (itemId === rootPath) {
          return { name: itemId, path: itemId, isFolder: true }
        }
        // Child item
        const parentDir = itemId.split('/').slice(0, -1).join('/') || rootPath
        const children = await window.api.readDir(parentDir)
        const found = children.find((i) => i.path === itemId)
        console.log('dataLoader found', found, itemId)
        return found || { name: itemId, path: itemId, isFolder: true }
      },
      getChildrenWithData: loadChildren
      // getChildren: loadChildren
    },

    indent: 20,
    // features: [asyncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
    features: [asyncDataLoaderFeature, selectionFeature, hotkeysCoreFeature]
  })

  // Click to open file/folder
  const handleClick = async (item: FileNode) => {
    if (item.isFolder) { await window.api.openFile(item.path) }
    else { await EditorCommonUtils.addNewDocumentEditor(item.path, rootParentPath) }
    // if (!item.isFolder) await EditorHelpers.addNewDocumentEditor(item.path)
  }

  // Rename file/folder
  /* const handleRename = async (item: FileNode) => {
    const newName = await openTextInputModal({
      title: 'Rename',
      message: 'Enter new name',
      defaultValue: item.name
    })
    if (newName && newName !== item.name) {
      const newPath = await window.api.renameFile(item.path, newName)
      if (newPath) {
        await loadChildren(item.path.split('/').slice(0, -1).join('/')) // reload parent
      }
    }
  } */

  // Delete file/folder
  const handleDelete = async (item: FileNode) => {
    const confirmed = await openConfirmModal({
      title: 'Delete item',
      message: `Delete ${item.name}?`,
      confirmText: 'Delete',
      destructive: true
    })
    if (!confirmed) return

    const ok = await window.api.deleteFile(item.path)
    if (ok) {
      await loadChildren(item.path.split('/').slice(0, -1).join('/'))
    }
  }

  // Drag & Drop handlers
  const handleDragStart = (event: React.DragEvent, item: FileNode) => {
    event.dataTransfer.setData('text/plain', item.path)
  }

  const handleDrop = async (event: React.DragEvent, targetItem: FileNode) => {
    event.preventDefault()
    const srcPath = event.dataTransfer.getData('text/plain')
    const destPath = targetItem.isFolder
      ? targetItem.path
      : targetItem.path.split('/').slice(0, -1).join('/')
    const newPath = await window.api.moveFile(srcPath, destPath)
    if (newPath) {
      // Reload parent directories
      await loadChildren(srcPath.split('/').slice(0, -1).join('/'))
      await loadChildren(destPath)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }
  function startNewItem(
    type: 'file' | 'folder',
    parentDir: string
  ) {
    setCreatingItem({ parent: parentDir, type })
    setCreateValue('')
    setRenamingId(null) // avoid conflict
  }

  async function finishCreate(commit: boolean) {
    if (!creatingItem) return

    const { parent, type } = creatingItem
    const input = createValue.trim()

    // Cancel
    if (!commit || !input) {
      setCreatingItem(null)
      return
    }

    // Extract top-level name for conflict test
    const firstPart = input.split('/')[0]

    if (await nameExists(parent, firstPart)) {
      await openAlertModal({
        title: 'Create item',
        message: `"${firstPart}" already exists in this folder.`
      })
      return // ⛔ prevent commit
    }

    // Perform nested creation
    const createdPath = await createNestedEntry(parent, input, type)

    setCreatingItem(null)
    setCreateValue('')

    // Reload parent
    await loadChildren(parent)

    EditorHelpers.ensureDocumentMarkerInCache(rootPath)

    // Automatically open file after creation
    if (type === 'file') EditorCommonUtils.addNewDocumentEditor(createdPath, rootParentPath)
  }


  const startRename = (item: FileNode) => {
    setRenamingId(item.path)
    setRenameValue(item.name)
  }

  const finishRename = async (item: FileNode, commit: boolean) => {
    if (commit && renameValue && renameValue !== item.name) {
      const newPath = await window.api.renameFile(item.path, renameValue)
      console.log('Renamed to', newPath)
      if (newPath) {
        await loadChildren(item.path.split('/').slice(0, -1).join('/'))
      }
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    var items = tree.getItems()
    if (renamingId) return // Ignore tree navigation while renaming
    if (!focusedItemId && e.key.length === 1) {
      // Type-ahead
      setTypeAhead((prev) => prev + e.key.toLowerCase())
      if (typeAheadTimeout.current) clearTimeout(typeAheadTimeout.current)
      typeAheadTimeout.current = setTimeout(() => setTypeAhead(''), 1000)
      // const match = tree.getItems().find((item) =>
      const match = items.find((item) =>
        item
          .getItemName()
          .toLowerCase()
          .startsWith(typeAhead + e.key.toLowerCase())
      )
      if (match) setFocusedItemId(match.getId())
      return
    }

    const index = items.findIndex((item) => item.getId() === focusedItemId)
    if (index === -1) return

    switch (e.key) {
      case 'ArrowDown': {
        const next = items[index + 1]
        if (next) setFocusedItemId(next.getId())
        e.preventDefault()
        break
      }
      case 'ArrowUp': {
        const prev = items[index - 1]
        if (prev) setFocusedItemId(prev.getId())
        e.preventDefault()
        break
      }
      case 'Enter':
      case 'F2': {
        const item = items[index]
        startRename(item.getItemData())
        e.preventDefault()
        break
      }
      case 'ArrowRight': {
        const item = items[index]
        if (item.isFolder) {
          // if (item.isFolder && item.getIsOpen && !item.getIsOpen()) {
          // item.toggleOpen?.()
        }
        e.preventDefault()
        break
      }
      case 'ArrowLeft': {
        const item = items[index]
        // if (item.isFolder && item.getIsOpen && item.getIsOpen()) {
        //   item.toggleOpen?.()
        // }
        e.preventDefault()
        break
      }
    }
  }

  const handleOnContextMenu = (file: FileNode, e: React.MouseEvent, item: any) => {
    e.preventDefault()

    // const file = item.getItemData()

    // Same logic you used in Svelte
    const renameId = uuid()
    const translateId = uuid()
    const deleteId = uuid()
    const openId = uuid()

    // Local map of actions (React side)
    // Could also store in a global actionMap if you want cross-framework reuse
    window.actionMap ??= {}
    window.actionMap[renameId] = () => startRename(file)
    // window.actionMap[renameId] = () => window.api.renameFile(file.path, 'newName')
    window.actionMap[deleteId] = () => window.api.deleteFile(file.path)
    window.actionMap[translateId] = () => EditorHelpers.convertFileToTipTapJson(file.path)
    window.actionMap[openId] = () => handleClick(file)
    // window.actionMap[translateId] = () => window.api.translateFile(file.path)

    const templateFileAndFolder: ContextMenuItem[] = [
      {
        label: 'Open',
        // clickId: openId,
        shortcut: 'Enter',
        icon: '/path/to/dynadoc/src/renderer/src/assets/img/common/clipboard.png',
        action() {
          handleClick(file)
        },
      }, {
        label: 'Rename',
        // clickId: renameId,
        shortcut: 'F2',
        action() {
          startRename(file)
        }
      },
      {
        label: 'Delete',
        // clickId: deleteId,
        shortcut: 'Del',
        action() {
          window.api.deleteFile(file.path)
        }
      },
      {
        label: 'New File…',
        shortcut: 'Ctrl+N',
        icon: 'file-icon.svg',
        action() {
          // startNewItem('file', file.directory)
          // const parent = item.isFolder() ? file.path : file.directory
          // startNewItem('file', parent)
          startNewItem('file', file.path)

        }
      },
      {
        label: 'New Folder…',
        shortcut: 'Ctrl+Shift+N',
        icon: 'folder-icon.svg',
        action() {
          // const parent = item.isFolder() ? file.path : file.directory
          // startNewItem('folder', parent)
          startNewItem('folder', file.path)
        }
      }
    ]
    const templateFolder: ContextMenuItem[] = []
    const templateFile: ContextMenuItem[] = [
      {
        label: 'Translate',
        // clickId: translateId,
        shortcut: 'F3',
        action() {
        }
      }
    ]

    const template = [
      ...templateFileAndFolder,
      ...(item.isFolder() ? templateFolder : templateFile)
    ]

    // Call into your preload-exposed API
    // window.api.showContextMenu(template)
    mountSvelteComponent(ContextMenuWidget, {
      __menuItems: template,
      __x: e.clientX,
      __y: e.clientY,
      __show: true
    })


  }

  useEffect(() => {
    console.log('useEffect ')
    if (!focusedItemId && items.length > 0) {
      setFocusedItemId(items[0].getId())
    }

    const listener = (event: any, id: string) => {
      const action = window.actionMap?.[id]
      if (action) action()
    }

    const menuActionCleanup = window.api.onInvokeMenuAction(listener)

    return () => {
      menuActionCleanup?.()
    }

    // const handler = (event, id) => {
    // console.log('useEffect handler', id, window.actionMap)
    //   if (window.actionMap[id]) {
    //     window.actionMap[id]()
    //   }
    // }
    // console.log('useEffect registerMenuAction')

    // window.api.registerMenuAction(handler) // preload exposes ipcRenderer.on
    // return () => {
    //   window.api.offInvokeMenuAction(handler)
    // }
  }, [items])



  /* function TreeItem({
    item,
    focusedItemId,
    renamingId,
    renameValue,
    setFocusedItemId,
    setRenameValue,
    finishRename,
    handleClick,
    handleOnContextMenu
  }) { */
  function TreeItem1({ item, ...handlers }) {
    const {
      focusedItemId,
      renamingId,
      renameValue,
      setFocusedItemId,
      setRenameValue,
      finishRename,
      handleClick,
      handleOnContextMenu
    } = handlers
    const isFocused = focusedItemId === item.getId()
    const isRenaming = renamingId === item.getItemData().path
    const hasChildren = item.hasChildren && item.hasChildren() // async tree libs usually expose this
    const isExpanded = item.isExpanded()

    const toggleExpand = async () => {
      if (isExpanded) {
        item.collapse()
      } else {
        if (!item.hasLoadedChildren?.()) {
          // 👇 async load children here
          await item.loadChildren?.()
        }
        item.expand()
      }
    }

    return (
      // <vscode-tree-item>
      <li
        key={item.getId()}
        style={{ paddingLeft: `${item.getItemMeta().level * 0.5}rem` }}
        onClick={() => setFocusedItemId(item.getId())}
      >
        {/* <div
          key={item.getId()}
          style={{ paddingLeft: `${item.getItemMeta().level * 0.5}rem` }}
          onClick={() => setFocusedItemId(item.getId())}
        > */}
        {isRenaming ? (
          // <vscode-textfield></vscode-textfield>
          <input
            autoFocus
            value={renameValue}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => finishRename(item.getItemData(), true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishRename(item.getItemData(), true)
              if (e.key === 'Escape') finishRename(item.getItemData(), false)
            }}
            className=" w-full"
          // className="input input-xs w-full"
          />
        ) : item.isFolder() ? (
          <details open={isExpanded}>

            <summary
              className={`flex items-center gap-2 cursor-pointer ${isFocused ? 'bg-primary/20' : ''
                }`}
              onClick={toggleExpand}
              onContextMenu={(e) => handleOnContextMenu(item.getItemData(), e, item)}
            >
              <i className={`ph-bold ${isExpanded ? 'ph-folder-open' : 'ph-folder'}`}></i>
              {/* <i className={`ph-bold ${isExpanded ? 'ph-caret-down' : 'ph-caret-right'}`}></i> */}
              {getFileIcon(item.getItemName(), true)}
              <span>{item.getItemName()}</span>
              {item.isLoading() && <span className="loading loading-spinner loading-xs"></span>}
            </summary>

            {creatingItem &&
              creatingItem.parent === item.getItemData().path && (
                <li className="pl-4">
                  <input
                    autoFocus
                    className="w-full border rounded px-1 py-0.5"
                    placeholder={
                      creatingItem.type === 'file'
                        ? 'New file...'
                        : 'New folder...'
                    }
                    value={createValue}
                    onChange={(e) => setCreateValue(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') await finishCreate(true)
                      if (e.key === 'Escape') finishCreate(false)
                    }}
                    onBlur={() => finishCreate(true)}
                  />
                </li>
              )}


            {/* render children only if expanded */}
            {isExpanded && (
              <ul>
                {item.getChildren().map((child) => (
                  <TreeItem
                    key={child.getId()}
                    item={child}
                    focusedItemId={focusedItemId}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    setFocusedItemId={setFocusedItemId}
                    setRenameValue={setRenameValue}
                    finishRename={finishRename}
                    handleClick={handleClick}
                    handleOnContextMenu={handleOnContextMenu}
                  />
                ))}
              </ul>
            )}
          </details>
        ) : (
          <a
            className={`flex items-center gap-2 cursor-pointer ${isFocused ? 'bg-primary/20' : ''}`}
            onClick={() => handleClick(item.getItemData())}
            onContextMenu={(e) => handleOnContextMenu(item.getItemData(), e, item)}
          >
            {getFileIcon(item.getItemName(), false)}
            <span>{item.getItemName()}</span>
            {item.isLoading() && <span className="loading loading-spinner loading-xs"></span>}
          </a>
        )}
        {/* </div> */}
      </li>
      // </vscode-tree-item>
    )
  }

  const Tree = ({ tree, ...handlers }) => {
    return (

      // <ul
      //   className="menu menu-xs bg-base-200 rounded-box max-w-xs w-full"
      //   {...tree.getContainerProps()}
      //   ref={containerRef}
      //   tabIndex={0}
      //   onKeyDown={handleKeyDown}
      // >

      <ul
        className=" w-full"
        {...tree.getContainerProps()}
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >

        {/* <div
          className="w-full"
          {...tree.getContainerProps()}
          ref={containerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        > */}
        {/* <vscode-tree> */}
        {/* <vscode-tree> */}
        {tree.getItems().map((rootItem) => (
          <TreeItem key={rootItem.getId()} item={rootItem} {...handlers} />
        ))}
        {/* </vscode-tree> */}
        {/* </vscode-tree> */}
        {/* </div> */}
      </ul>

    )
  }


  function TreeItem({ item, ...handlers }) {
    const {
      focusedItemId,
      renamingId,
      renameValue,
      setFocusedItemId,
      setRenameValue,
      finishRename,
      handleClick,
      handleOnContextMenu,
      creatingItem
    } = handlers;

    const isFocused = focusedItemId === item.getId();
    const isRenaming = renamingId === item.getItemData().path;
    const isExpanded = item.isExpanded();
    const level = item.getItemMeta().level;

    // INNOVATIVE FEATURE: Status Indicators (Linked to your Secured Content)
    const isSecured = item.getItemName().endsWith(Utils.DYNADOC_EXTENSIONS.secured) || item.getItemName().endsWith(Utils.DYNADOC_EXTENSIONS.default);
    const lastModified = "2m ago"; // Mock metadata

    const toggleExpand = async (e) => {
      e.stopPropagation();
      if (isExpanded) {
        item.collapse();
      } else {
        if (!item.hasLoadedChildren?.()) await item.loadChildren?.();
        item.expand();
      }
    };

    return (
      <li key={item.getId()} className="list-none select-none">
        <div
          className={`
          group relative flex items-center h-7 px-2 transition-all duration-150 cursor-pointer
          ${isFocused ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-white/5 border-l-2 border-transparent'}
        `}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => {
            setFocusedItemId(item.getId());
            if (!item.isFolder()) handleClick(item.getItemData());
          }}
          onContextMenu={(e) => handleOnContextMenu(item.getItemData(), e, item)}
        >
          {/* INDENTATION GUIDE: Adobe 2025 Visual Breadcrumb */}
          {level > 0 && (
            <div
              className="absolute top-0 bottom-0 border-l border-white/5"
              style={{ left: `${level * 12 - 4}px` }}
            />
          )}

          {/* EXPAND ICON */}
          {item.isFolder() && (
            <button
              onClick={toggleExpand}
              className="p-1 mr-1 text-base-content/30 hover:text-base-content transition-colors"
            >
              <i className={`ph-bold text-[10px] ${isExpanded ? 'ph-caret-down' : 'ph-caret-right'}`}></i>
            </button>
          )}

          {/* FILE/FOLDER ICON */}
          <div className={`mr-2 flex items-center ${isFocused ? 'text-primary' : 'text-base-content/50'}`}>
            {item.isFolder() ? (
              <i className={`ph-light ${isExpanded ? 'ph-folder-open' : 'ph-folder'}`}></i>
            ) : (
              <i className={`ph-bold ${isSecured ? 'ph-shield-checkered text-primary' : 'ph-file-text'}`}></i>
            )}
          </div>

          {/* ITEM NAME / RENAME INPUT */}
          <div className="flex-grow flex items-center min-w-0">
            {isRenaming ? (
              <input
                autoFocus
                value={renameValue}
                className="bg-base-200 border border-primary outline-none text-[11px] px-1 py-0.5 w-full rounded-sm"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => finishRename(item.getItemData(), true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishRename(item.getItemData(), true);
                  if (e.key === 'Escape') finishRename(item.getItemData(), false);
                }}
              />
            ) : (
              <span className={`text-[11px] font-medium truncate ${isFocused ? 'text-base-content' : 'text-base-content/60'}`}>
                {item.getItemName()}
              </span>
            )}
          </div>

          {/* INNOVATIVE FEATURE: Inline Metadata Overlays */}
          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
            {isSecured && (
              <div className="badge badge-outline border-primary/30 text-primary text-[8px] font-black tracking-tighter h-4">SECURE</div>
            )}
            <span className="text-[9px] text-base-content/20 font-mono italic">{lastModified}</span>

            {/* QUICK ACTIONS */}
            <button className="text-base-content/30 hover:text-base-content"><i className="ph-bold ph-dots-three"></i></button>
          </div>

          {item.isLoading() && <span className="loading loading-spinner loading-[10px] ml-2"></span>}
        </div>

        {/* CREATE NEW ITEM INPUT */}
        {creatingItem && creatingItem.parent === item.getItemData().path && (
          <div className="py-1" style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}>
            <div className="flex items-center gap-2 bg-primary/5 p-1 border border-primary/20 rounded-sm">
              <i className={`ph-bold text-[11px] ${creatingItem.type === 'file' ? 'ph-file-plus' : 'ph-folder-plus'}`}></i>
              <input
                autoFocus
                className="bg-transparent outline-none text-[11px] w-full text-base-content/80"
                placeholder={`New ${creatingItem.type}...`}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') await handlers.finishCreate(true);
                  if (e.key === 'Escape') handlers.finishCreate(false);
                }}
              />
            </div>
          </div>
        )}

        {/* CHILDREN RENDERING */}
        {isExpanded && item.getChildren && (
          <ul className="m-0 p-0">
            {item.getChildren().map((child) => (
              <TreeItem key={child.getId()} item={child} {...handlers} />
            ))}
          </ul>
        )}
      </li>
    );
  }
  // useEffect(() => {
  //   const handler = (event, id) => {
  //     if (window.actionMap[id]) {
  //       window.actionMap[id]()
  //     }
  //   }
  //   window.api.onInvokeMenuAction(handler) // preload exposes ipcRenderer.on
  //   return () => {
  //     window.api.offInvokeMenuAction(handler)
  //   }
  // }, [])

  // Bundle all handlers to pass as props
  const treeHandlers = {
    focusedItemId,
    renamingId,
    renameValue,
    setFocusedItemId,
    setRenameValue,
    finishRename,
    handleClick,
    handleOnContextMenu
  }
  return <Tree tree={tree} {...treeHandlers} />

}

// Custom element wrapper
/* class ReactTreeElement extends HTMLElement {
  connectedCallback() {
    const rootPath = this.getAttribute('root-path') || '/'
    if (!this._root) {
      this._root = ReactDOM.createRoot(this)
      this._root.render(<ReactTree rootPath={rootPath} />)
    }
  }

  static get observedAttributes() {
    return ['root-path']
  }

  // connectedCallback() {
  //   const rootPath = this.getAttribute('root-path') || '/'
  //   this._root = ReactDOM.createRoot(this)
  //   this._root.render(<ReactTree rootPath={rootPath} />)
  // }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'root-path' && this._root && newValue !== oldValue) {
      this._root.render(<ReactTree rootPath={newValue} />)
    }
  }
}

customElements.define('react-tree', ReactTreeElement) */

class ReactTreeElement extends HTMLElement {
  static get observedAttributes() {
    // return ['root-path', 'root-parent-path'];
    return ['root-path', 'root-parent-path', 'include-ext', 'exclude-ext'];
  }

  constructor() {
    super();
    this._root = null;
  }

  connectedCallback() {
    // Initialize the root only once
    if (!this._root) {
      this._root = ReactDOM.createRoot(this);
    }
    this._render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // Only re-render if the value actually changed and we are connected
    if (this._root && oldValue !== newValue) {
      this._render();
    }
  }

  disconnectedCallback() {
    // Clean up React tree when element is removed from DOM to prevent memory leaks
    if (this._root) {
      this._root.unmount();
      this._root = null;
    }
  }

  _render1() {
    // Always pull the latest attributes directly from the element
    const rootPath = this.getAttribute('root-path') || '/';
    const rootParentPath = this.getAttribute('root-parent-path') || '/';

    this._root.render(
      <ReactTree
        key={rootPath}
        rootPath={rootPath}
        rootParentPath={rootParentPath}
      />
    );
  }

  _render() {
    const rootPath = this.getAttribute('root-path') || '/';
    const rootParentPath = this.getAttribute('root-parent-path') || '/';

    // Parse strings like ".json,.ts" into arrays
    const includeExt = this.getAttribute('include-ext')?.split(',').map(s => s.trim()) || [];
    const excludeExt = this.getAttribute('exclude-ext')?.split(',').map(s => s.trim()) || [];

    this._root.render(
      <ReactTree
        key={`${rootPath}-${includeExt.join('')}`} // Key change triggers fresh load
        rootPath={rootPath}
        rootParentPath={rootParentPath}
        includeExtensions={includeExt}
        excludeExtensions={excludeExt}
      />
    );
  }
}

/* class ReactTreeElement extends HTMLElement {
  static get observedAttributes() {
    return ['root-path', 'root-parent-path']
  }

  connectedCallback() {
    const rootPath = this.getAttribute('root-path') || '/'
    const rootParentPath = this.getAttribute('root-parent-path') || '/'
    this._root = ReactDOM.createRoot(this)
    this._render(rootPath, rootParentPath)
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'root-path' && this._root && newValue !== oldValue) {
      this._render(newValue)
    } else
      if (name === 'root-parent-path' && this._root && newValue !== oldValue) {
        this._render(newValue)
      }
  }

  _render(rootPath, rootParentPath) {
    // Using key forces React to unmount/remount the tree
    this._root.render(<ReactTree key={rootPath} rootPath={rootPath} rootParentPath={rootParentPath} />)
  }
}
 */
customElements.define('react-tree', ReactTreeElement)
