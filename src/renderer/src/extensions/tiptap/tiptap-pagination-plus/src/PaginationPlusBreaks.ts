/* 
https://github.com/miquik/tiptap-pagination-plus-breaks/tree/main
https://github.com/RomikMakavana/tiptap-pagination-plus/issues/3
*/

import { Editor, Extension } from "@tiptap/core";
import { EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  PageInfo,
  PaginationPlusOptions,
  PaginationPlusStorageOptions,
  VDivInfo,
} from "./types";
import {
  waiter
} from "./helper/paginationHelper";

let debugCounter = 0;
const MIN_H_GUARD = 4;

declare module "@tiptap/core" {
  interface Storage {
    pplusb: PaginationPlusStorageOptions;
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    PaginationPlusV4: {
      initPagination: () => ReturnType;
    };
  }
}

/*
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraph: {
      setParagraph: () => ReturnType;
    };
  }
}
*/

export type DecoSets = {
  vdivs: DecorationSet; //
  pageCount: DecorationSet; // es: pageCount
  decoVersion: number;
  initialize: boolean;
};

type MetaPayload = {
  flag: number;
  numPages?: number;
  reset?: string;
};

const PaginationPluginKey = new PluginKey<DecoSets>("pagination");

function mergeSets(
  doc: ProseMirrorNode,
  a: DecorationSet,
  b: DecorationSet,
  endDeco: Decoration
): DecorationSet {
  // `find()` senza argomenti restituisce tutte le decorazioni del set
  const all = [...a.find(), ...b.find(), endDeco];
  return DecorationSet.create(doc, all);
}

const vdivsMustBeRecalculated = (
  pbs: NodeListOf<Element>,
  vdivs: VDivInfo[]
) => {
  if (pbs.length === 0) {
    return vdivs.length > 0;
  }

  // il numero di pbs è cambiato
  if (pbs.length != vdivs.length) {
    return true;
  }
  // offsetTop di qualche pbs è cambiato
  let index = 0;
  for (const pb of pbs) {
    const pbElement = pb as HTMLElement;
    const br = vdivs[index];
    if (
      !br ||
      Math.abs(pbElement.offsetTop + pbElement.offsetHeight - br.lastBottom) >
        MIN_H_GUARD
    ) {
      return true;
    }
    index++;
  }

  // la struttura dei pbs non è più corretta (vdiv-spacer deve essere il vicino superiore o inferiore del pb)
  for (const pb of pbs) {
    if (
      pb.nextElementSibling?.classList.contains("vdiv-spacer") === false &&
      pb.previousElementSibling?.classList.contains("vdiv-spacer") === false
    ) {
      return true;
    }
  }

  return false;
};

const getBoundingClientRect = (el: HTMLElement) => {
  if (!el || el.children.length === 0) {
    return el.getBoundingClientRect();
  }

  const computedStyle = window.getComputedStyle(el);
  if (computedStyle.display !== "contents") {
    return el.getBoundingClientRect();
  }

  let rects = Array.from(el.children).map((child) =>
    child.getBoundingClientRect()
  );

  let x1 = Math.min(...rects.map((r) => r.left));
  let y1 = Math.min(...rects.map((r) => r.top));
  let x2 = Math.max(...rects.map((r) => r.right));
  let y2 = Math.max(...rects.map((r) => r.bottom));

  return new DOMRect(x1, y1, x2 - x1, y2 - y1);
};

const refreshPage = (targetNode: HTMLElement) => {
  const paginationElement = targetNode.querySelector("[data-rm-pagination]");
  if (paginationElement) {
    const lastPageBreak = paginationElement.lastElementChild?.querySelector(
      ".breaker"
    ) as HTMLElement;
    if (lastPageBreak) {
      const minHeight = lastPageBreak.offsetTop + lastPageBreak.offsetHeight;
      targetNode.style.minHeight = `${minHeight}px`;
    }
  }
};

const initializePagination = (
  editor: Editor,
  editorView: EditorView,
  pageOptions: PaginationPlusOptions
) => {
  waiter(editorView.dom).then(() => {
    editor.storage.pplusb.existingPageCount = 0;
    editor.storage.pplusb.breaksToUpdate = 0;

    const decoToUpdate = domWorkBeforeDecorations(
      editorView,
      editor.storage.pplusb,
      pageOptions
    );
    // Chiedi ricalcolo decorazioni (non cambia doc → niente loop)
    editorView.dispatch(
      editorView.state.tr.setMeta(PaginationPluginKey, {
        ...decoToUpdate,
      } as MetaPayload)
    );
  });
};

const initializeState = (
  editor: Editor,
  state: EditorState,
  pageOptions: PaginationPlusOptions
): DecoSets => {
  const widgetList = createDecoration(editor, state, pageOptions, 1, true);
  return {
    vdivs: DecorationSet.empty,
    pageCount: DecorationSet.create(state.doc, [...widgetList]),
    decoVersion: 0,
    initialize: true,
  };
};

export const PaginationPlusBreaks = Extension.create<
  PaginationPlusOptions,
  PaginationPlusStorageOptions
>({
  name: "pplusb",
  addOptions() {
    return {
      pageHeight: 800,
      pageWidth: 600,
      pageGap: 50,
      pageGapBorderSize: 1,
      pageBreakBackground: "#ffffff",
      pageHeaderHeight: 30,
      pageFooterHeight: 30,
      footerRight: "{page}",
      footerLeft: "",
      headerRight: "",
      headerLeft: "",
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 50,
      marginRight: 50,
      contentMarginTop: 10,
      contentMarginBottom: 10,
      showDividerDebug: false,
      initializeOnPaste: true,
    };
  },
  addStorage() {
    return {
      vdivs: [] as VDivInfo[],
    } as PaginationPlusStorageOptions;
  },
  onCreate() {
    const targetNode = this.editor.view.dom;
    targetNode.classList.add("rm-with-pagination");
    targetNode.style.width =
      this.options.pageWidth -
      this.options.marginLeft -
      this.options.marginRight +
      "px";
    targetNode.style.marginLeft = this.options.marginLeft + "px";
    targetNode.style.marginRight = this.options.marginRight + "px";
    // const config = { attributes: true };
    const headerFooterHeight =
      this.options.pageHeaderHeight + this.options.pageFooterHeight;
    const _pageContentHeight =
      this.options.pageHeight -
      headerFooterHeight -
      this.options.contentMarginTop -
      this.options.contentMarginBottom -
      this.options.marginTop -
      this.options.marginBottom;

    const style = document.createElement("style");
    style.dataset.rmPaginationStyle = "";

    style.textContent = `
      .rm-with-pagination {
        counter-reset: page-number;
      }
      .rm-with-pagination .image-plus-wrapper,
      .rm-with-pagination .table-plus td,
      .rm-with-pagination .table-plus th {
        max-height: ${_pageContentHeight - 10}px;
        overflow-y: auto;
      }
      .rm-with-pagination .image-plus-wrapper {
        overflow-y: visible;
      }
      .rm-with-pagination .rm-page-footer {
        counter-increment: page-number;
        margin-bottom: ${this.options.marginBottom}px;
      }
      .rm-with-pagination .rm-page-break:last-child .rm-pagination-gap {
        display: none;
      }
      .rm-with-pagination .rm-page-break:last-child .rm-page-header {
        display: none;
      }
      
      .rm-with-pagination table tr td,
      .rm-with-pagination table tr th {
        word-break: break-all;
      }
      .rm-with-pagination table > tr {
        display: grid;
        min-width: 100%;
      }
      .rm-with-pagination table {
        border-collapse: collapse;
        width: 100%;
        display: contents;
      }
      .rm-with-pagination table tbody{
        display: table;
        max-height: 300px;
        overflow-y: auto;
      }
      .rm-with-pagination table tbody > tr{
        display: table-row !important;
      }
      .rm-with-pagination p:has(br.ProseMirror-trailingBreak:only-child) {
        display: table;
        width: 100%;
      }
      .rm-with-pagination .table-row-group {
        max-height: ${_pageContentHeight}px;
        overflow-y: auto;
        width: 100%;
      }
      .rm-with-pagination .rm-page-footer-left,
      .rm-with-pagination .rm-page-footer-right,
      .rm-with-pagination .rm-page-header-left,
      .rm-with-pagination .rm-page-header-right {
        display: inline-block;
      }
      
      .rm-with-pagination .rm-page-header-left,
      .rm-with-pagination .rm-page-footer-left{
        float: left;
        margin-left: ${this.options.marginLeft}px;
      }
      .rm-with-pagination .rm-page-header-right,
      .rm-with-pagination .rm-page-footer-right{
        float: right;
        margin-right: ${this.options.marginRight}px;
      }
      .rm-with-pagination .rm-page-number::before {
        content: counter(page-number);
      }
      .rm-with-pagination .rm-first-page-header{
        display: inline-flex;
        justify-content: space-between;
        width: 100%;
      }
      .rm-with-pagination .rm-page-header,
      .rm-with-pagination .rm-first-page-header{
        margin-bottom: ${this.options.contentMarginTop}px !important;
        margin-top: ${this.options.marginTop}px !important;
      }
      .rm-with-pagination .rm-page-footer{
        margin-top: ${this.options.contentMarginBottom}px !important;
        margin-bottom: ${this.options.marginBottom}px !important;
      }
    `;
    document.head.appendChild(style);
  },
  onUpdate() {
    const targetNode = this.editor.view.dom;
    const headerFooterHeight =
      this.options.pageHeaderHeight + this.options.pageFooterHeight;
    const _pageContentHeight =
      this.options.pageHeight -
      headerFooterHeight -
      this.options.contentMarginTop -
      this.options.contentMarginBottom -
      this.options.marginTop -
      this.options.marginBottom;
    this.editor.storage.pplusb.pageContentHeight = _pageContentHeight;
    this.editor.storage.pplusb.pageContentWidth = this.options.pageWidth;
  },
  addCommands() {
    return {
      initPagination:
        () =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;
          dispatch(
            state.tr.setMeta(PaginationPluginKey, {
              reset: "command",
            })
          );
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    const pageOptions = this.options;
    const editor = this.editor;
    return [
      new Plugin<DecoSets>({
        key: PaginationPluginKey,

        state: {
          init(_, state) {
            const headerFooterHeight =
              pageOptions.pageHeaderHeight + pageOptions.pageFooterHeight;
            const _pageContentHeight =
              pageOptions.pageHeight -
              headerFooterHeight -
              pageOptions.contentMarginTop -
              pageOptions.contentMarginBottom -
              pageOptions.marginTop -
              pageOptions.marginBottom;

            editor.storage.pplusb.pageContentHeight = _pageContentHeight;
            editor.storage.pplusb.pageContentWidth = pageOptions.pageWidth;
            return initializeState(editor, state, pageOptions);
          },
          apply(tr, oldDeco, oldState, newState) {
            let { vdivs, pageCount, decoVersion } = oldDeco;
            if (tr.docChanged) {
              vdivs = vdivs.map(tr.mapping, tr.doc);
              pageCount = pageCount.map(tr.mapping, tr.doc);
            }

            const meta = tr.getMeta(PaginationPluginKey) as MetaPayload;

            if (meta?.reset) {
              // resettiamo il plugin
              return initializeState(editor, newState, pageOptions);
            }

            // if (tr.getMeta(vdivs_meta_key)) {
            if (meta && (meta.flag & 1) !== 0) {
              const widgetList = createDividerDecoration(
                editor,
                newState,
                pageOptions.showDividerDebug
              );
              vdivs = DecorationSet.create(newState.doc, [...widgetList]);
              decoVersion = decoVersion + 1;
            }

            // if (tr.getMeta(page_count_meta_key)) {
            if (meta && (meta.flag & 2) !== 0) {
              const widgetList = createDecoration(
                editor,
                newState,
                pageOptions,
                meta.numPages ?? 1
              );
              pageCount = DecorationSet.create(newState.doc, [...widgetList]);
              decoVersion = decoVersion + 1;
            }
            return { vdivs, pageCount, decoVersion, initialize: false };
          },
        },

        props: {
          decorations(state: EditorState) {
            const s = this.getState(state);
            if (!s) return null;
            // ricrea sempre il widget in fondo
            const at = state.doc.content.size;

            const endDeco = Decoration.widget(at, (view) => {
              let fillHeight = 1;
              const div = document.createElement("div");
              div.className = "rm-end-document";
              div.style.height = fillHeight + "px";
              if (pageOptions.showDividerDebug)
                div.style.backgroundColor = "yellow";
              return div;
            });

            return mergeSets(state.doc, s.vdivs, s.pageCount, endDeco);
          },
          handlePaste(view: EditorView, _event, _slice) {
            if (!pageOptions.initializeOnPaste) {
              return false; // non fare nulla di speciale
            }
            // Innesca reset, poi lascia che TipTap gestisca l'incolla normalmente
            const tr = view.state.tr.setMeta(PaginationPluginKey, {
              reset: "paste",
            });
            view.dispatch(tr);
            return false; // false = non consumare, continua il paste standard
          },
        },

        view(editorView: EditorView) {
          // Manteniamo l’ultima versione vista per capire quando le deco sono state applicate
          let seenDecoVersion =
            PaginationPluginKey.getState(editorView.state)?.decoVersion ?? 0;

          // prima misura
          let isFirstMeasure = true;

          initializePagination(editor, editorView, pageOptions);

          return {
            update(view, prevState) {
              const prevPS = PaginationPluginKey.getState(prevState);
              const curPS = PaginationPluginKey.getState(view.state);

              // 1) STEP PRE-DECORAZIONI: quando cambia il DOC (esclude cambi selezione)
              if (!prevState.doc.eq(view.state.doc)) {
                const decoToUpdate = domWorkBeforeDecorations(
                  view,
                  editor.storage.pplusb,
                  pageOptions
                );
                if (decoToUpdate) {
                  // Chiedi ricalcolo decorazioni (non cambia doc → niente loop)
                  view.dispatch(
                    view.state.tr.setMeta(PaginationPluginKey, {
                      ...decoToUpdate,
                    } as MetaPayload)
                  );
                }
              }

              if (
                prevPS &&
                curPS &&
                prevPS.initialize !== curPS.initialize &&
                !prevPS.initialize
              ) {
                initializePagination(editor, view, pageOptions);
              }

              // 2) STEP POST-DECORAZIONI: quando aumenta decoVersion
              const prevVersion = prevPS?.decoVersion ?? seenDecoVersion;
              const curVersion = curPS?.decoVersion ?? prevVersion;

              if (curVersion > prevVersion || isFirstMeasure) {
                seenDecoVersion = curVersion;
                isFirstMeasure = false;

                // Assicurati che il layout sia stabile prima di misurare
                // (spesso non serve, ma con overlay/immagini è più robusto)
                // requestAnimationFrame(() => {
                refreshPage(view.dom);
                // });
              }
            },
            destroy() {},
          };
        },
      }),
    ];
  },
});

const domWorkBeforeDecorations = (
  view: EditorView,
  storage: PaginationPlusStorageOptions,
  options: PaginationPlusOptions
) => {
  let flag = 0;

  const currentPageCount = getExistingPageCount(view);
  let pageCount = calculatePageCount(view, options);

  const pbs = view.dom.querySelectorAll("[data-break]");
  if (vdivsMustBeRecalculated(pbs, storage.vdivs)) {
    // determiniamo quanti divider abbiamo
    storage.vdivs = [];
    view.state.doc.descendants((node, offset) => {
      if (node.attrs && node.attrs?.bt) {
        storage.vdivs.push({
          dir: node.attrs.bt === "before" ? -1 : 1,
          height: -1,
          lastBottom: -1,
          decoPos: node.attrs.bt === "before" ? offset : offset + node.nodeSize,
        });
      }
    });

    pageCount = calculateVDivsHeight(view, storage, options, pageCount);
    flag |= 1;
  }

  if (currentPageCount !== pageCount) {
    if (options.showDividerDebug) {
      console.log(
        "pageCount: %d - exist: %d - calc: %d",
        debugCounter++,
        currentPageCount,
        pageCount
      );
    }
    flag |= 2;
  }
  return { flag: flag !== 0 ? flag : undefined, numPages: pageCount };
};

const getExistingPageCount = (view: EditorView) => {
  const editorDom = view.dom;
  const paginationElement = editorDom.querySelector("[data-rm-pagination]");
  if (paginationElement) {
    return paginationElement.children.length;
  }
  return 0;
};
const calculatePageCount = (
  view: EditorView,
  pageOptions: PaginationPlusOptions
) => {
  const editorDom = view.dom;
  const scrollTop = editorDom.scrollTop;
  const offsetTop = editorDom.offsetTop;
  const _pageHeaderHeight =
    pageOptions.pageHeaderHeight +
    pageOptions.contentMarginTop +
    pageOptions.marginTop;
  const _pageFooterHeight =
    pageOptions.pageFooterHeight +
    pageOptions.contentMarginBottom +
    pageOptions.marginBottom;
  const pageContentAreaHeight =
    pageOptions.pageHeight - _pageHeaderHeight - _pageFooterHeight;
  const paginationElement = editorDom.querySelector("[data-rm-pagination]");
  const currentPageCount = getExistingPageCount(view);
  if (paginationElement) {
    const lastElementOfEditor = editorDom.lastElementChild;
    let lastPageBreak =
      paginationElement.lastElementChild?.querySelector(".breaker");
    if (lastElementOfEditor && lastPageBreak) {
      const lastElementOfEditorRect =
        lastElementOfEditor.getBoundingClientRect();
      let lastPageBreakRect = lastPageBreak.getBoundingClientRect();

      if (lastElementOfEditorRect.bottom > lastPageBreakRect.bottom) {
        // l'ultimo elemento dell'editor è più in basso dell'ultima page-break
        // aggiungiamo incrementalmente altre pagine fino a che non abbiamo
        // il contrario.
        while (lastElementOfEditorRect.bottom > lastPageBreakRect.bottom) {
          const emptyPageBreak = emptyPageBreakDefinition(
            pageOptions,
            view.dom.clientWidth
          );
          paginationElement.appendChild(emptyPageBreak);
          lastPageBreakRect = emptyPageBreak
            .querySelector(".breaker")!
            .getBoundingClientRect();
        }
        return paginationElement.children.length;
      } else {
        // l'ultimo elemento dell'editor è più in alto dell'ultima page-break
        // togliamo incrementalmente fino a che non abbiamo il contrario
        let lastIndex = paginationElement.children.length - 1;
        lastPageBreak =
          paginationElement.children[lastIndex].querySelector(".breaker")!;
        lastPageBreakRect = lastPageBreak.getBoundingClientRect();

        while (
          lastElementOfEditorRect.bottom < lastPageBreakRect.bottom &&
          lastIndex > 0
        ) {
          lastIndex--;
          lastPageBreak =
            paginationElement.children[lastIndex].querySelector(".breaker")!;
          lastPageBreakRect = lastPageBreak.getBoundingClientRect();
        }
        // lastIndex + 1 è l'ultima pagina da mantenere ... cancelliamo tutte le altre se ci sono
        for (
          let i = paginationElement.children.length - 1;
          i > lastIndex + 1; // !!!
          i--
        ) {
          paginationElement.children[i].remove();
        }
        return paginationElement.children.length;
      }
    }
    return 1;
  } else {
    const editorHeight = editorDom.scrollHeight;
    const pageCount = Math.ceil(editorHeight / pageContentAreaHeight);
    return pageCount <= 0 ? 1 : pageCount;
  }
};

function addTempBreakElement(bid: string, breakHeight: number) {
  const pageVDiv = document.createElement("div");
  pageVDiv.classList.add("vdiv-spacer");
  pageVDiv.style.width = "100%";
  pageVDiv.style.backgroundColor = "green";
  pageVDiv.style.height = (breakHeight || 0) + "px";
  pageVDiv.dataset["bid"] = bid;
  return pageVDiv;
}

function getDividerPosition(bottom: number, pageHeight: number): PageInfo {
  return {
    index: Math.floor(bottom / pageHeight),
    mt: bottom % pageHeight,
    cis: -1,
    cie: -1,
  };
}

const calculateVDivsHeight = (
  view: EditorView,
  storage: PaginationPlusStorageOptions,
  pageOptions: PaginationPlusOptions,
  pageCount: number
) => {
  // L'idea è quella di modificare le altezze dei vdiv-spacer esistenti
  // const storage = store.pplusb as PaginationPlusStorageOptions
  const editorDom = view.dom;

  const _pageGap = pageOptions.pageGap;
  const _pageHeaderHeight =
    pageOptions.pageHeaderHeight +
    pageOptions.contentMarginTop +
    pageOptions.marginTop;
  // const _pageFooterHeight = (pageOptions.pageFooterHeight + pageOptions.contentMarginBottom + pageOptions.marginBottom);
  // const _pageHeight = pageOptions.pageHeight - _pageHeaderHeight - _pageFooterHeight;

  // const headerFooterHeight = _pageHeaderHeight + _pageFooterHeight + _pageGap

  const paginationElement = editorDom.querySelector("[data-rm-pagination]");
  // const HEADING = editorDom.querySelector(".heading") as HTMLElement;

  const DEBUG = editorDom.querySelectorAll("img");

  if (paginationElement) {
    // const existingPage = getExistingPageCount(view);

    const pbs = editorDom.querySelectorAll("[data-break]");
    if (pbs && pbs.length > 0) {
      // cancelliamo anche pageVDivs esistenti
      editorDom
        .querySelectorAll<HTMLElement>(".vdiv-spacer")
        .forEach((el) => el.remove());

      // 1. Stimiamo una quantità di pagine che potrebbero risultare dopo l'algoritmo
      // let pageCount = existingPage; // calculatePageCount(view, pageOptions);
      pageCount += pbs.length;

      // 2. Se serve, aggiungiamo PageBreakDefinition che mancano
      if (paginationElement.children.length < pageCount) {
        const existingPage = paginationElement.children.length;
        for (let i = 0; i < pageCount - existingPage; i++) {
          // aggiungiamo pagine fake
          paginationElement.appendChild(
            emptyPageBreakDefinition(pageOptions, view.dom.clientWidth)
          );
        }
      }

      // 3. Aggiorniamo le altezze del divisori
      let index = 0;
      for (const pb of pbs) {
        const pbElement = pb as HTMLElement;
        // const rect = getBoundingClientRect(pbElement)

        // N.B. l'idea è che il "blocco" pb + vdiv deve essere considerato come una singola identità
        // per non sbagliare i calcoli
        const height = pbElement.offsetHeight;
        let offsetBottom = pbElement.offsetTop + height;

        if (pbElement.dataset.break === "after") {
          const pi = getDividerPosition(
            offsetBottom,
            pageOptions.pageHeight + _pageGap
          );

          // let breakHeight = pageOptions.pageHeight + _pageHeaderHeight + _pageGap - pi.mt
          let breakHeight =
            pageOptions.pageHeight + _pageHeaderHeight + _pageGap - pi.mt;

          if (breakHeight < 0) {
            breakHeight = 1;
          }

          storage.vdivs[index] = {
            ...storage.vdivs[index],
            height: breakHeight,
            lastBottom: offsetBottom,
          };

          const newPageVDiv = addTempBreakElement(
            pbElement.dataset.bid!,
            breakHeight
          );
          // il divisore non esiste, lo creiamo
          if (pbElement.nextElementSibling) {
            view.dom.insertBefore(newPageVDiv, pbElement.nextElementSibling);
          } else {
            view.dom.append(
              // addTempBreakElement(pbElement.dataset.bid!, breakHeight)
              newPageVDiv
            );
          }
          void newPageVDiv.offsetTop;
        }

        if (pbElement.dataset.break === "before") {
          const pi = getDividerPosition(
            offsetBottom,
            pageOptions.pageHeight + _pageGap
          );

          let breakHeight =
            pageOptions.pageHeight +
            _pageHeaderHeight +
            _pageGap +
            height -
            pi.mt;

          if (breakHeight < 0) {
            breakHeight = 1;
          }

          // il divisore non esiste, lo creiamo
          const newTop = pbElement.offsetTop;
          view.dom.insertBefore(
            addTempBreakElement(pbElement.dataset.bid!, breakHeight),
            pbElement
          );

          storage.vdivs[index] = {
            ...storage.vdivs[index],
            height: breakHeight,
            lastBottom: offsetBottom,
            vdivTop: (pbElement.previousElementSibling as HTMLElement)
              .offsetTop,
          };
        }
        index++;
      }
    }
    return calculatePageCount(view, pageOptions);
  }
  return 1; // storage.breaksToUpdate <= 0;
};

const emptyPageBreakDefinition = (
  pageOptions: PaginationPlusOptions,
  breakerWidth: number
) => {
  const _pageGap = pageOptions.pageGap;
  const _pageHeaderHeight =
    pageOptions.pageHeaderHeight +
    pageOptions.contentMarginTop +
    pageOptions.marginTop;
  const _pageFooterHeight =
    pageOptions.pageFooterHeight +
    pageOptions.contentMarginBottom +
    pageOptions.marginBottom;
  const _pageHeight =
    pageOptions.pageHeight - _pageHeaderHeight - _pageFooterHeight;

  return pageBreakDefinition({
    firstPage: false,
    pageOptions,
    _pageHeaderHeight,
    _pageHeight,
    _pageGap,
    _pageBreakBackground: "#ffffff",
  });
};

const pageBreakDefinition = ({
  firstPage = false,
  pageOptions,
  _pageHeaderHeight,
  _pageHeight,
  _pageGap,
  _pageBreakBackground,

  placeholder = false,
  pageIndex = 0,
  numPages = 1,
  dom = undefined,
}: {
  firstPage: boolean;
  pageOptions: PaginationPlusOptions;
  _pageHeaderHeight: number;
  _pageHeight: number;
  _pageGap: number;
  _pageBreakBackground: string;
  placeholder?: boolean;
  pageIndex?: number;
  numPages?: number;
  dom?: HTMLElement;
}) => {
  const pageContainer = document.createElement("div");
  pageContainer.classList.add("rm-page-break");

  const page = document.createElement("div");
  page.classList.add("page");
  page.style.position = "relative";
  page.style.float = "left";
  page.style.clear = "both";
  page.style.marginTop = firstPage
    ? `calc(${_pageHeaderHeight}px + ${_pageHeight}px)`
    : _pageHeight + "px";

  const pageBreak = document.createElement("div");
  pageBreak.classList.add("breaker");
  pageBreak.style.width = `calc(100% + ${pageOptions.marginLeft - 1}px + ${
    pageOptions.marginRight - 1
  }px)`;
  pageBreak.style.marginLeft = `-${pageOptions.marginLeft}px`;
  pageBreak.style.marginRight = `-${pageOptions.marginRight}px`;
  pageBreak.style.position = "relative";
  pageBreak.style.float = "left";
  pageBreak.style.clear = "both";
  pageBreak.style.left = `0px`;
  pageBreak.style.right = `0px`;
  pageBreak.style.zIndex = "2";

  const pageFooter = document.createElement("div");
  pageFooter.classList.add("rm-page-footer");
  pageFooter.style.height = pageOptions.pageFooterHeight + "px";
  pageFooter.style.overflow = "hidden";

  if (!placeholder) {
    let footer = null;
    if (pageOptions.footer && typeof pageOptions.footer === "function") {
      footer = pageOptions.footer(pageIndex, numPages, dom);
    } else {
      footer = document.createElement("div");
      // footer.classList.add("rm-page-footer");
      footer.innerHTML = `<span>${pageOptions.footer}</span>`;
    }
    pageFooter.appendChild(footer);
  }

  const pageSpace = document.createElement("div");
  pageSpace.classList.add("rm-pagination-gap");
  pageSpace.style.height = _pageGap + "px";
  pageSpace.style.borderLeft = "1px solid";
  pageSpace.style.borderRight = "1px solid";
  pageSpace.style.position = "relative";
  pageSpace.style.setProperty("width", "calc(100% + 2px)", "important");
  pageSpace.style.left = "-1px";
  pageSpace.style.backgroundColor = _pageBreakBackground;
  pageSpace.style.borderLeftColor = _pageBreakBackground;
  pageSpace.style.borderRightColor = _pageBreakBackground;

  const pageHeader = document.createElement("div");
  pageHeader.classList.add("rm-page-header");
  pageHeader.style.height = pageOptions.pageHeaderHeight + "px";
  pageHeader.style.overflow = "hidden";

  if (!placeholder) {
    if (pageIndex < numPages) {
      let header = null;
      if (pageOptions.header && typeof pageOptions.header === "function") {
        header = pageOptions.header(pageIndex + 1, numPages, dom);
      } else {
        header = document.createElement("div");
        // header.classList.add("rm-page-header");
        header.innerHTML = `<span>${pageOptions.header}</span>`;
      }
      pageHeader.append(header);
    }
  }

  pageBreak.append(pageFooter, pageSpace, pageHeader);
  pageContainer.append(page, pageBreak);

  return pageContainer;
};

function createDecoration(
  editor: Editor,
  state: EditorState,
  pageOptions: PaginationPlusOptions,
  pageCount: number,
  isInitial: boolean = false
): Decoration[] {
  const pageWidget = Decoration.widget(
    0,
    (view) => {
      const _pageGap = pageOptions.pageGap;
      const _pageHeaderHeight =
        pageOptions.pageHeaderHeight +
        pageOptions.contentMarginTop +
        pageOptions.marginTop;
      const _pageFooterHeight =
        pageOptions.pageFooterHeight +
        pageOptions.contentMarginBottom +
        pageOptions.marginBottom;
      const _pageHeight =
        pageOptions.pageHeight - _pageHeaderHeight - _pageFooterHeight;
      const _pageBreakBackground = pageOptions.pageBreakBackground;

      const el = document.createElement("div");
      el.dataset.rmPagination = "true";

      const fragment = document.createDocumentFragment();

      for (let i = 0; i < pageCount; i++) {
        if (i === 0) {
          fragment.appendChild(
            pageBreakDefinition({
              firstPage: true,
              pageOptions,
              _pageHeaderHeight,
              _pageHeight,
              _pageGap,
              _pageBreakBackground,
              placeholder: false,
              pageIndex: i + 1,
              numPages: pageCount,
              dom: view.dom,
            })
          );
        } else {
          fragment.appendChild(
            pageBreakDefinition({
              firstPage: false,
              pageOptions,
              _pageHeaderHeight,
              _pageHeight,
              _pageGap,
              _pageBreakBackground,
              placeholder: false,
              pageIndex: i + 1,
              numPages: pageCount,
              dom: view.dom,
            })
          );
        }
      }
      el.append(fragment);
      el.id = "pages";

      return el;
    },
    { side: -1 }
  );
  const firstHeaderWidget = Decoration.widget(
    0,
    (view) => {
      const el = document.createElement("div");
      el.style.position = "relative";
      el.classList.add("rm-first-page-header");

      el.style.width = `calc(100% + ${pageOptions.marginLeft - 1}px + ${
        pageOptions.marginRight - 1
      }px)`;
      el.style.marginLeft = `-${pageOptions.marginLeft}px`;
      el.style.marginRight = `-${pageOptions.marginRight}px`;

      el.style.height = `${pageOptions.pageHeaderHeight}px`;
      el.style.overflow = "hidden";

      let header = null;
      if (pageOptions.header && typeof pageOptions.header === "function") {
        header = pageOptions.header(0, pageCount, view.dom);
      } else {
        header = document.createElement("div");
        // header.classList.add("rm-page-header");
        header.innerHTML = `<span>${pageOptions.header}</span>`;
      }
      el.append(header);

      /*
      const pageHeaderLeft = document.createElement("div");
      pageHeaderLeft.classList.add("rm-first-page-header-left");
      pageHeaderLeft.innerHTML = pageOptions.headerLeft;
      el.append(pageHeaderLeft);

      const pageHeaderRight = document.createElement("div");
      pageHeaderRight.classList.add("rm-first-page-header-right");
      pageHeaderRight.innerHTML = pageOptions.headerRight;
      el.append(pageHeaderRight);
      */
      return el;
    },
    { side: -1 }
  );

  return [pageWidget, firstHeaderWidget]; // !isInitial ? [pageWidget, firstHeaderWidget] : [pageWidget];
}

function createDividerDecoration(
  editor: Editor,
  state: EditorState,
  showDividerDebug: boolean
): Decoration[] {
  const breaksDeco: Decoration[] = [];

  for (const vdiv of editor.storage.pplusb.vdivs) {
    const pageVDiv = document.createElement("div");
    pageVDiv.classList.add("vdiv-spacer");
    pageVDiv.style.width = "100%";
    if (showDividerDebug)
      pageVDiv.style.backgroundColor = vdiv.dir === 1 ? "blue" : "green";
    pageVDiv.style.height = (vdiv.height || 0) + "px";
    // pageVDiv.dataset["bid"] = node.attrs.bid;
    // Insert a decoration immediately after this node
    const widget = Decoration.widget(vdiv.decoPos, pageVDiv, {
      side: vdiv.dir,
    });

    // counter++;
    breaksDeco.push(widget);
  }
  return breaksDeco;
}
