import { createRoot } from "react-dom/client";
import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import "../../libs/fortune-sheet/app.css";
import React, { useEffect, useRef, useState } from "react"
import * as Y from "yjs";
import { createSheetYjs } from "../../collab/collab";
import { nodeApi } from '../../../../../utils/shims/node'
import { awaitDriveReady } from '../../../../../utils/driveReady'
// import '../../../../../components/common/web-component/vscode-elements/dist/bundled.js'


// const fs = nodeApi.fs
// const path = nodeApi.path

type Props = {
  sheetName?: string
  rootPath: string
  disableCollab?: boolean
  readOnly?: boolean
  parentDoc?: any
  userInfo?: { name: string; color: string }
  theme?: string
}

export default function ReactSpreadsheetEditor({
  sheetName,
  rootPath,
  disableCollab,
  readOnly,
  parentDoc,
  userInfo,
  theme
}: Props) {
  const LOCAL_ORIGIN = useRef(Symbol("local")).current

  const safeRoot = (rootPath && rootPath !== 'undefined') ? rootPath : ''
  sheetName = (sheetName && sheetName !== 'undefined')
    ? sheetName
    : (safeRoot ? nodeApi.path.basename(safeRoot, nodeApi.path.extname(safeRoot)) : 'Sheet1')

  const workbookRef = useRef<any>(null)

  const ydocRef = useRef<Y.Doc | null>(null)
  const yOpsRef = useRef<Y.Array<any> | null>(null)
  const ySnapshotRef = useRef<Y.Map<any> | null>(null)

  const applyingRemoteRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [initialData, setInitialData] = useState<any[] | null>(null)

  const snapshotTimer = useRef<any>(null)
  const metadataTimer = useRef<any>(null)
  const lastMetaSignature = useRef<string | null>(null)
  const syncTimer = useRef<any>(null)

  const dispatchBridgeEvent = (name: string, detail: Record<string, any>) => {
    if (typeof window === "undefined") return;
    const evt = new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true,
    });
    window.dispatchEvent(evt);
  };

  const emitSheetMetadata = () => {
    if (!workbookRef.current) return;
    const sheets = workbookRef.current?.getAllSheets?.() || [];
    const normalized = sheets.map((s: any) => ({
      id: s.id,
      name: s.name,
    }));
    dispatchBridgeEvent("dynadoc-sheet-metadata", { rootPath, sheets: normalized });
  };

  const scheduleMetadataEmit = () => {
    clearTimeout(metadataTimer.current);
    metadataTimer.current = setTimeout(() => {
      if (!workbookRef.current) return;
      const sheets = workbookRef.current?.getAllSheets?.() || [];
      const signature = JSON.stringify(
        sheets.map((s: any) => ({ id: s.id || "", name: s.name || "" }))
      );
      if (signature === lastMetaSignature.current) return;
      lastMetaSignature.current = signature;
      const normalized = sheets.map((s: any) => ({
        id: s.id,
        name: s.name,
      }));
      dispatchBridgeEvent("dynadoc-sheet-metadata", { rootPath, sheets: normalized });
    }, 250);
  };

  const scheduleSyncEmit = () => {
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      if (!workbookRef.current) return;
      const sheets = workbookRef.current?.getAllSheets?.() || [];
      const payload = JSON.parse(JSON.stringify(sheets || []));
      dispatchBridgeEvent("dynadoc-sheet-sync", { rootPath, sheets: payload });
    }, 120);
  };

  /* -------------------------------------------
   * Init Yjs + load snapshot BEFORE mount
   * -----------------------------------------*/
  useEffect(() => {
    let cancelled = false
    let collabRef: Awaited<ReturnType<typeof createSheetYjs>> | null = null
    let opsObserver: ((event: Y.YArrayEvent<any>) => void) | null = null

    const run = async () => {
      await awaitDriveReady().catch(() => {})
      if (cancelled) return
      if (disableCollab) {
        setInitialData([{ id: "sheet-1", name: sheetName, celldata: [], data: [] }])
        return
      }
      const collab = await createSheetYjs(rootPath, parentDoc, userInfo)
      if (cancelled) { collab.destroy(); return }

      collabRef = collab
      ydocRef.current = collab.ydoc
      yOpsRef.current = collab.yOps
      ySnapshotRef.current = collab.ydoc.getMap("snapshot")

      const snapshot = ySnapshotRef.current.get("sheets")
      if (snapshot) {
        setInitialData(snapshot)
      } else {
        setInitialData([{ id: "sheet-1", name: sheetName, celldata: [] }])
      }

      /* -------------------------------------------
       * Observe remote ops — use workbookRef (stable ref) instead of
       * ready state to avoid stale closure and double-observer on re-run
       * -----------------------------------------*/
      opsObserver = (event: Y.YArrayEvent<any>) => {
        if (!workbookRef.current) return
        if (event.transaction.origin === LOCAL_ORIGIN) return

        const ops: any[] = []
        event.changes.added.forEach(item => {
          ops.push(...item.content.getContent())
        })
        if (!ops.length) return

        applyingRemoteRef.current = true
        workbookRef.current.applyOp(ops)
        applyingRemoteRef.current = false
      }
      collab.yOps.observe(opsObserver)
    }

    void run()

    return () => {
      cancelled = true
      if (opsObserver && collabRef) {
        collabRef.yOps.unobserve(opsObserver)
      }
      collabRef?.destroy()
    }
  }, [rootPath, disableCollab])

  function sheetDataToCelldata(sheet: any) {
    const celldata: any[] = []

    if (!sheet?.data) return celldata

    for (let r = 0; r < sheet.data.length; r++) {
      const row = sheet.data[r]
      if (!row) continue

      for (let c = 0; c < row.length; c++) {
        let cell = row[c]
        if (cell != null) {
          if (cell && typeof cell === 'object' && cell.f) {
            cell = { ...cell, v: undefined }
          }
          celldata.push({ r, c, v: cell })
        }
      }
    }

    return celldata
  }


  /* -------------------------------------------
   * Snapshot saver (debounced)
   * -----------------------------------------*/
  const scheduleSnapshot = () => {
    clearTimeout(snapshotTimer.current)

    snapshotTimer.current = setTimeout(() => {
      if (!workbookRef.current || !ydocRef.current || !ySnapshotRef.current)
        return

      const sheets = workbookRef.current.getAllSheets()

      const normalized = sheets.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        // celldata: s.data ?? []
        celldata: sheetDataToCelldata(s)
      }))

      ydocRef.current.transact(() => {
        ySnapshotRef.current!.set("sheets", normalized)
        // ySnapshotRef.current!.set("sheets", sheets)
      }, LOCAL_ORIGIN)

      console.log("[Sheet] snapshot saved", { sheets, normalized })
      emitSheetMetadata()
    }, 800)
  }

  /*  const scheduleSnapshot2 = () => {
     clearTimeout(snapshotTimer.current);
 
     snapshotTimer.current = setTimeout(() => {
       if (!workbookRef.current || !ydocRef.current || !ySnapshotRef.current) return;
 
       // Get current data
       const allSheets = workbookRef.current.getAllSheets();
 
       // Yjs Map only supports plain JS objects/arrays
       // Ensure we are saving a clean deep copy
       const dataToSave = JSON.parse(JSON.stringify(allSheets));
 
       ydocRef.current.transact(() => {
         ySnapshotRef.current!.set("sheets", dataToSave);
       }, LOCAL_ORIGIN);
 
       console.log("[Sheet] Snapshot saved to Y.Map");
     }, 1000); // 1 second debounce
   }; */

  useEffect(() => {
    if (!ready || !workbookRef.current) return;

    const methods = {
      undo: () => workbookRef.current?.undo?.(),
      redo: () => workbookRef.current?.redo?.(),
      getSelection: () => workbookRef.current?.getSelection?.(),
      getSelectionCoordinates: () => workbookRef.current?.getSelectionCoordinates?.(),
      getFlattenRange: (range: any) => workbookRef.current?.getFlattenRange?.(range),
      getCellsByRange: (range: any, options?: any) => workbookRef.current?.getCellsByRange?.(range, options),
      getCellValue: (row: number, column: number, options?: any) =>
        workbookRef.current?.getCellValue?.(row, column, options),
      setCellValue: (row: number, column: number, value: any, options?: any) =>
        workbookRef.current?.setCellValue?.(row, column, value, options),
      clearCell: (row: number, column: number, options?: any) =>
        workbookRef.current?.clearCell?.(row, column, options),
      setCellFormat: (row: number, column: number, attr: string, value: any, options?: any) =>
        workbookRef.current?.setCellFormat?.(row, column, attr, value, options),
      setCellFormatByRange: (attr: string, value: any, range: any, options?: any) =>
        workbookRef.current?.setCellFormatByRange?.(attr, value, range, options),
      setCellValuesByRange: (data: any[][], range: any, options?: any) =>
        workbookRef.current?.setCellValuesByRange?.(data, range, options),
      setSelection: (range: any, options?: any) => workbookRef.current?.setSelection?.(range, options),
      mergeCells: (ranges: any[], type: string = "merge-all", options?: any) =>
        workbookRef.current?.mergeCells?.(ranges, type, options),
      cancelMerge: (ranges: any[], options?: any) =>
        workbookRef.current?.cancelMerge?.(ranges, options),
      freeze: (type: "row" | "column" | "both", range: { row: number; column: number }, options?: any) =>
        workbookRef.current?.freeze?.(type, range, options),
      setRowHeight: (rowInfo: Record<string, number>, options?: any) =>
        workbookRef.current?.setRowHeight?.(
          rowInfo ? JSON.parse(JSON.stringify(rowInfo)) : rowInfo,
          options
        ),
      setColumnWidth: (columnInfo: Record<string, number>, options?: any) =>
        workbookRef.current?.setColumnWidth?.(
          columnInfo ? JSON.parse(JSON.stringify(columnInfo)) : columnInfo,
          options
        ),
      getRowHeight: (rows: number[], options?: any) => workbookRef.current?.getRowHeight?.(rows, options),
      getColumnWidth: (columns: number[], options?: any) => workbookRef.current?.getColumnWidth?.(columns, options),
      hideRowOrColumn: (rowOrColInfo: string[], type: "row" | "column") =>
        workbookRef.current?.hideRowOrColumn?.(rowOrColInfo, type),
      showRowOrColumn: (rowOrColInfo: string[], type: "row" | "column") =>
        workbookRef.current?.showRowOrColumn?.(rowOrColInfo, type),
      insertRowOrColumn: (
        type: "row" | "column",
        index: number,
        count: number,
        direction?: "lefttop" | "rightbottom",
        options?: any
      ) => workbookRef.current?.insertRowOrColumn?.(type, index, count, direction, options),
      deleteRowOrColumn: (type: "row" | "column", start: number, end: number, options?: any) =>
        workbookRef.current?.deleteRowOrColumn?.(type, start, end, options),
      autoFillCell: (
        copyRange: { row: number[]; column: number[] },
        applyRange: { row: number[]; column: number[] },
        direction: "up" | "down" | "left" | "right"
      ) => workbookRef.current?.autoFillCell?.(copyRange, applyRange, direction),
      // getAllSheets: () => workbookRef.current?.getAllSheets?.(),
      // Inside your React component's useEffect where 'methods' is defined
      getAllSheets: () => {
        const sheets = workbookRef.current?.getAllSheets?.();
        // We MUST deep clone here because FortuneSheet's internal 
        // state can be mutated, which breaks Svelte's change detection.
        return JSON.parse(JSON.stringify(sheets || []));
        // return sheets
      },
      getSheet: (options?: any) => workbookRef.current?.getSheet?.(options),
      updateSheet: (data: any[]) => workbookRef.current?.updateSheet?.(data),
      addSheet: (sheetId?: string) => workbookRef.current?.addSheet?.(sheetId),
      deleteSheet: (options?: any) => workbookRef.current?.deleteSheet?.(options),
      setSheetName: (name: string, options?: any) => workbookRef.current?.setSheetName?.(name, options),
      calculateFormula: (id?: string, range?: any) => workbookRef.current?.calculateFormula?.(id, range),
      scroll: (options: { scrollLeft?: number; scrollTop?: number; targetRow?: number; targetColumn?: number }) =>
        workbookRef.current?.scroll?.(options),
    };

    dispatchBridgeEvent("dynadoc-sheet-ready", { rootPath, methods });
    emitSheetMetadata();

    return () => {
      dispatchBridgeEvent("dynadoc-sheet-destroy", { rootPath });
    };
  }, [ready, rootPath]);

  useEffect(() => {
    if (!ready || readOnly) return;
    const timer = window.setInterval(() => {
      scheduleMetadataEmit();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ready, readOnly, rootPath]);

  useEffect(() => {
    if (!ready || !workbookRef.current) return
    const t = setTimeout(() => workbookRef.current?.calculateFormula?.(), 80)
    return () => clearTimeout(t)
  }, [ready])

  useEffect(() => {
    if (!readOnly) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as any;
      if (!detail?.rootPath || detail.rootPath !== rootPath) return;
      if (!workbookRef.current?.updateSheet) return;
      const sheets = detail?.sheets || [];
      const payload = JSON.parse(JSON.stringify(sheets || []));
      workbookRef.current.updateSheet(payload);
    };
    window.addEventListener("dynadoc-sheet-sync", handler as any);
    return () => window.removeEventListener("dynadoc-sheet-sync", handler as any);
  }, [readOnly, rootPath]);

  /* -------------------------------------------
   * Wait until snapshot ready
   * -----------------------------------------*/
  // if (!initialData) return null
  // Use a key that combines the path and a "loaded" state
  const instanceKey = `${rootPath}-${!!initialData}`;

  if (!initialData) {
    return <div className="loading-spinner"><vscode-progress-ring></vscode-progress-ring></div>;
  }

  /* -------------------------------------------
   * Render FortuneSheet ONCE
   * -----------------------------------------*/
  return (
    <div
      className={`w-full h-full fortune-theme-${theme || 'dark'} ${readOnly ? "sheet-readonly" : ""}`}
      onPointerDownCapture={(event) => {
        if (readOnly) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      onKeyDownCapture={(event) => {
        if (readOnly) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      onContextMenu={(event) => {
        if (readOnly) {
          event.preventDefault()
          event.stopPropagation()
        } else {
          // Allow fortune sheet to handle it internally, 
          // but don't let it bubble to Tiptap's NodeViewWrapper
          event.stopPropagation();
        }
      }}
    >
      <Workbook
        key={sheetName}
        ref={instance => {
          workbookRef.current = instance
          if (instance && !ready) setReady(true)
        }}
        data={initialData}
        showToolbar={false}
        showFormulaBar={true}
        onOp={ops => {
        if (disableCollab || readOnly) return
        if (!ydocRef.current || !yOpsRef.current) return
        if (applyingRemoteRef.current) return

          ydocRef.current.transact(() => {
            yOpsRef.current!.push(ops)
          }, LOCAL_ORIGIN)

          scheduleSnapshot()
          scheduleMetadataEmit()
          dispatchBridgeEvent("dynadoc-sheet-dirty", { rootPath })
          scheduleSyncEmit()
        }}
      />
    </div>
  )
}



class ReactSpreadsheetEditorElement extends HTMLElement {
  _rootPath: string = "";
  _sheetName: string | undefined;
  _disableCollab = false;
  _readOnly = false;
  _theme: string = "dark";
  _parentDoc: any = null;
  _userInfo: any = null;
  _container: HTMLDivElement | null = null;
  _root: ReturnType<typeof createRoot> | null = null;

  static get observedAttributes() {
    return ["root-path", "sheet-name", "disable-collab", "read-only", "theme"];
  }

  connectedCallback() {
    // Re-attached before the deferred disconnect cleanup ran — keep the
    // existing React root instead of mounting a duplicate.
    if (this._root) return;

    const rootPath = this.getAttribute("root-path") || "Sheet1";
    const sheetName = this.getAttribute("sheet-name") || undefined;
    const disableCollab = this.hasAttribute("disable-collab");
    const readOnly = this.hasAttribute("read-only");
    const theme = this.getAttribute("theme") || "dark";
    const parentDoc = (this as any).parentDoc;
    const userInfo = (this as any).userInfo;

    this._rootPath = rootPath;
    this._sheetName = sheetName;
    this._disableCollab = disableCollab;
    this._readOnly = readOnly;
    this._theme = theme;
    this._parentDoc = parentDoc;
    this._userInfo = userInfo;

    this.addEventListener("mousedown", () => {
      if (typeof window === "undefined") return;
      const evt = new CustomEvent("dynadoc-sheet-focus", {
        detail: { rootPath: this._rootPath },
        bubbles: true,
        composed: true,
      });
      window.dispatchEvent(evt);
    });

    // container directly inside the custom element (no shadow root)
    this._container = document.createElement("div");
    this._container.style.width = "100%";
    this._container.style.height = "100%";
    this.appendChild(this._container);

    // create React root
    this._root = createRoot(this._container);

    this._render(rootPath, sheetName, disableCollab, readOnly, parentDoc, userInfo, theme);
  }

  disconnectedCallback() {
    // Unmount the React tree so effect cleanups run (collab/Yjs providers
    // are destroyed); otherwise every closed sheet leaks its connection.
    // Deferred: ProseMirror node views can detach/re-attach the element
    // while dragging, which must not tear the editor down.
    setTimeout(() => {
      if (this.isConnected) return;
      const root = this._root;
      const container = this._container;
      this._root = null;
      this._container = null;
      root?.unmount();
      container?.remove();
    }, 0);
  }

  set parentDoc(value: any) {
    this._parentDoc = value;
    if (this._root) {
      this._render(this._rootPath, this._sheetName, this._disableCollab, this._readOnly, this._parentDoc, this._userInfo, this._theme);
    }
  }

  set userInfo(value: any) {
    this._userInfo = value;
    if (this._root) {
      this._render(this._rootPath, this._sheetName, this._disableCollab, this._readOnly, this._parentDoc, this._userInfo, this._theme);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._root || newValue === oldValue) return;
    if (name === "root-path") {
      this._rootPath = newValue;
      this._render(this._rootPath, this._sheetName, this._disableCollab, this._readOnly, this._parentDoc, this._userInfo, this._theme);
    }
    if (name === "sheet-name") {
      this._sheetName = newValue || undefined;
      this._render(this._rootPath, this._sheetName, this._disableCollab, this._readOnly, this._parentDoc, this._userInfo, this._theme);
    }
    if (name === "disable-collab") {
      this._disableCollab = this.hasAttribute("disable-collab");
      this._render(this._rootPath, this._sheetName, this._disableCollab, this._readOnly, this._parentDoc, this._userInfo, this._theme);
    }
    if (name === "read-only") {
      this._readOnly = this.hasAttribute("read-only");
      this._render(this._rootPath, this._sheetName, this._disableCollab, this._readOnly, this._parentDoc, this._userInfo, this._theme);
    }
    if (name === "theme") {
      this._theme = newValue;
      this._render(this._rootPath, this._sheetName, this._disableCollab, this._readOnly, this._parentDoc, this._userInfo, this._theme);
    }
  }

  _render(rootPath, sheetName, disableCollab, readOnly, parentDoc, userInfo, theme) {
    if (!this._root) return;
    this._root.render(
      <ReactSpreadsheetEditor
        key={`${rootPath}-${sheetName || ""}-${disableCollab ? "nc" : "c"}-${readOnly ? "ro" : "rw"}`}
        rootPath={rootPath}
        sheetName={sheetName}
        disableCollab={disableCollab}
        readOnly={readOnly}
        parentDoc={parentDoc}
        userInfo={userInfo}
        theme={theme}
      />
    );
  }
}

customElements.define(
  "react-spreadsheet-editor",
  ReactSpreadsheetEditorElement
);
