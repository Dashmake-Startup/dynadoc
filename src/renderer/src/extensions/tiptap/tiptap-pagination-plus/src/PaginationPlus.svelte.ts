import { Editor, Extension, forEach } from "@tiptap/core";
import { EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";
import { updateCssVariables } from "./utils";
import { PageSize } from "./constants";
import { mount } from "svelte";
import PageBreakComponent from './components/PageBreakComponent.svelte'
import { PaginationPlusOptions } from "../../utils/common.utils";


/* export interface PaginationPlusPageToIgnoreOptions {
  width: number
  height: number
}
export interface PaginationPlusOptions {
  pageHeight: number;
  pageWidth: number;
  pageGap: number;
  pageBreakBackground: string;
  pageGapBorderSize: number;
  footerRight: string;
  footerLeft: string;
  headerRight: string;
  headerLeft: string;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  contentMarginTop: number;
  contentMarginBottom: number;
  pageGapBorderColor: string;
  enabled: boolean;
  pagesToIgnore?: Map<number, PaginationPlusPageToIgnoreOptions> | null
} */
const page_count_meta_key = "PAGE_COUNT_META_KEY";
const force_page_reload_meta_key = "FORCE_PAGE_RELOAD_META_KEY";
const pagination_enabled_meta_key = "PAGINATION_ENABLED_META_KEY";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    PaginationPlus: {
      enablePagination: (enabled: boolean) => ReturnType;
      updatePagination: (enablePagination?: boolean) => ReturnType;
      updatePageBreakBackground: (color: string) => ReturnType;
      updatePageSize: (size: PageSize) => ReturnType;
      updatePageHeight: (height: number) => ReturnType;
      updatePageWidth: (width: number) => ReturnType;
      updatePageGap: (gap: number) => ReturnType;
      updateMargins: (margins: { top: number, bottom: number, left: number, right: number }) => ReturnType;
      updateContentMargins: (margins: { top: number, bottom: number }) => ReturnType;
      updateHeaderContent: (left: string, right: string) => ReturnType;
      updateFooterContent: (left: string, right: string) => ReturnType;
      getAllNodePageIndexes: (nodeViewWrapperClassList: string[]) => ReturnType;
    };
  }
  interface Storage {
    PaginationPlus: PaginationPlusOptions
  }
}

const defaultOptions: PaginationPlusOptions = {
  pageHeight: 800,
  pageWidth: 789,
  pageGap: 50,
  pageGapBorderSize: 1,
  pageBreakBackground: "#ffffff",
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
  pageGapBorderColor: "#e5e5e5",
  // enabled: true
  enabled: false,
  pagesToIgnore: null
}
const paginationPluginKey = new PluginKey("pagination");
const paginationNodeViewsToAvoid = ["node-view-slide"]


export const PaginationPlus = Extension.create<PaginationPlusOptions>({
  name: "PaginationPlus",
  addOptions() {
    return defaultOptions;
    // return defaultOptions;
  },
  addStorage() {
    return this.options;
    // return defaultOptions;
    // return { ...this.options };
  },
  onTransaction() {
    // applyBgToAllNodePageIndexes(this.editor, ["node-view-slide"])
  },
  onUpdate() {
    applyBgToAllNodePageIndexes(this.editor, paginationNodeViewsToAvoid)
    return
    // onTransaction() {
    console.log('getAllNodePageIndexes onTransaction', {})
    const allNoPageNodeViews = getAllNodePageIndexes(this.editor, ["node-view-slide"])
    console.log('getAllNodePageIndexes onTransaction Node page index', {
      allNoPageNodeViews
    })

    /* `forEach allNoPageNodeViews as noPageNodeView
   "rm-page-break" of (index of noPageNodeView) 's "rm-pagination-gap", "rm-page-header-left" and  "rm-page-header-right" add class opacity-0
noPageNodeView "page-background" add class gray 

"rm-page-break" of (index + 1 of noPageNodeView) 's  'rm-page-footer'
    ` */

    const editor = this.editor
    if (!editor?.view?.dom) return

    const editorEl = editor.view.dom as HTMLElement

    // All pages
    const pageBreaks = Array.from(
      editorEl.querySelectorAll<HTMLElement>('.rm-page-break')
    )

    pageBreaks.forEach(pageBreak => {
      pageBreak.querySelectorAll<HTMLElement>(
        '.rm-pagination-gap, .rm-page-header-left, .rm-page-header-right'
      )
        .forEach(el => el.classList.remove('opacity-0'))

      pageBreak.querySelectorAll<HTMLElement>('.page-background')
        .forEach(bg => {
          bg.classList.remove('bg-hatched-5-important')
        })
      pageBreak.querySelectorAll<HTMLElement>('.rm-page-footer')
        .forEach(el => el.classList.remove('opacity-0'))
    })


    // All node views that should disable pagination visuals
    // const nodeViews = Array.from(
    //   editorEl.querySelectorAll<HTMLElement>('.node-view-slide')
    // )
    const nodeViews = Array.from(allNoPageNodeViews?.values() || [])
    // const nodeViewPageIndexes = Array.from(allNoPageNodeViews?.values() || [])
    // const nodeViews = Array.from(allNoPageNodeViews?.keys() || [])
    console.log('getAllNodePageIndexes nodeViews', {
      nodeViews
    })
    nodeViews.forEach(nodeViewPageIndex => {
      console.log('getAllNodePageIndexes nodeView forEac', {
        nodeViews, nodeViewPageIndex
      })
      nodeViewPageIndex = nodeViewPageIndex - 1
      // nodeViews.forEach(nodeView => {
      // Find the page this node view belongs to
      // const pageBreak = nodeView
      const pageBreak = pageBreaks[nodeViewPageIndex]
      // const pageBreak = nodeView.closest<HTMLElement>('.rm-page-break')
      // if (!pageBreak) return

      // const pageIndex = pageBreaks.indexOf(pageBreak)
      const pageIndex = nodeViewPageIndex
      if (pageIndex === -1) return

      console.log('getAllNodePageIndexes nodeView forEachs', {
        nodeViews, pageBreak,
        "len ": pageBreak
          .querySelectorAll<HTMLElement>(
            '.rm-pagination-gap, .rm-page-header-left, .rm-page-header-right'
          ),
        "background ": pageBreak
          .querySelectorAll<HTMLElement>('.page-background')
      })




      /* --------------------------------------------
       * 1️⃣ Hide header + pagination gap on THIS page
       * ------------------------------------------ */
      pageBreak
        .querySelectorAll<HTMLElement>(
          '.rm-pagination-gap, .rm-page-header-left, .rm-page-header-right'
        )
        .forEach(el => el.classList.add('opacity-0'))

      /* --------------------------------------------
       * 2️⃣ Style the page background of the NodeView
       * ------------------------------------------ */
      pageBreak
        .querySelectorAll<HTMLElement>('.page-background')
        .forEach(bg => {
          bg.classList.add('bg-hatched-5-important')
        })

      /* --------------------------------------------
       * 3️⃣ Hide footer of NEXT page
       * ------------------------------------------ */
      const nextPageBreak = pageBreaks[pageIndex + 1]
      if (nextPageBreak) {
        nextPageBreak
          .querySelectorAll<HTMLElement>('.rm-page-footer')
          .forEach(el => el.classList.add('opacity-0'))
      }

      // Optional: expose page index for debugging
      // nodeView.dataset.pageIndex = String(pageIndex)
    })

  },
  onCreate() {
    const targetNode = this.editor.view.dom;
    targetNode.classList.add("rm-with-pagination");
    targetNode.style.border = `1px solid var(--rm-page-gap-border-color)`;
    targetNode.style.paddingLeft = `var(--rm-margin-left)`;
    targetNode.style.paddingRight = `var(--rm-margin-right)`;
    targetNode.style.width = `var(--rm-page-width)`;

    const config = { attributes: true };

    updateCssVariables(targetNode, this.options);

    const style = document.createElement("style");
    style.dataset.rmPaginationStyle = "";

    style.textContent = `
      .rm-pagination-gap{
        border-top: 1px solid;
        border-bottom: 1px solid;
        border-color: var(--rm-page-gap-border-color);
      }
      .rm-with-pagination {
        counter-reset: page-number page-number-plus 1;
      }
      .rm-with-pagination .image-plus-wrapper,
      .rm-with-pagination .table-plus td,
      .rm-with-pagination .table-plus th {
        max-height: var(--rm-max-content-child-height);
        overflow-y: auto;
      }
      .rm-with-pagination .image-plus-wrapper {
        overflow-y: visible;
      }
      .rm-with-pagination .rm-page-break {
        counter-increment: page-number page-number-plus;
      }
      .rm-with-pagination .rm-page-footer {
        margin-bottom: var(--rm-margin-bottom);
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
      .rm-with-pagination *:has(br.ProseMirror-trailingBreak:only-child) {
        display: table;
        width: 100%;
      }
      .rm-with-pagination .rm-br-decoration {
        display: table;
        width: 100%;
      }
      .rm-with-pagination .table-row-group {
        max-height: var(--rm-page-content-height);
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
        margin-left: var(--rm-margin-left);
      }
      .rm-with-pagination .rm-page-header-right,
      .rm-with-pagination .rm-page-footer-right{
        float: right;
        margin-right: var(--rm-margin-right);
      }
      .rm-with-pagination .rm-page-number::before {
        content: counter(page-number);
      }
      .rm-with-pagination .rm-page-number-plus::before {
        content: counter(page-number-plus);
      }
      .rm-with-pagination .rm-first-page-header,
      .rm-with-pagination .rm-page-header,
      .rm-with-pagination .rm-page-footer{
        width: 100%;
      }
      .rm-with-pagination .rm-page-header,
      .rm-with-pagination .rm-first-page-header{
        margin-bottom: var(--rm-content-margin-top) !important;
        margin-top: var(--rm-margin-top) !important;
        display: inline-flex;
        justify-content: space-between;
        max-height: calc(calc(var(--rm-page-height) * 0.35) - var(--rm-margin-top) - var(--rm-content-margin-top));
        overflow-y: hidden;
      }
      .rm-with-pagination .rm-page-footer{
        margin-top: var(--rm-content-margin-bottom) !important;
        margin-bottom: var(--rm-margin-bottom) !important;
        display: inline-flex;
        justify-content: space-between;
        max-height: calc(calc(var(--rm-page-height) * 0.35) - var(--rm-content-margin-bottom) - var(--rm-margin-bottom));
        overflow-y: hidden;
      }
    `;
    document.head.appendChild(style);


    const initialRefreshPage = (targetNode: HTMLElement) => {
      // console.log("initialRefreshPage ", this.storage.enabled)
      // If pagination is not activated don't continue
      if (!this.editor.storage.PaginationPlus.enabled) {      // if (this.storage.enabled != null && this.storage.enabled == false) {
        return
      }
      // console.log("initialRefreshPage contiinue ", this.storage.enabled)

      const _target = targetNode;
      if (_target.classList.contains("rm-with-pagination")) {
        const currentPageCount = getExistingPageCount(this.editor);
        const pageCount = calculatePageCount(this.editor, this.options);
        const recalculatePageCount = needNewDecoration(this.editor, this.options, this.storage);
        if (currentPageCount !== pageCount || recalculatePageCount) {

          const tr = this.editor.view.state.tr.setMeta(
            page_count_meta_key,
            "yees1"
            // Date.now()
          );
          this.editor.view.dispatch(tr);
        }

        refreshPage(this.editor, _target);
      }
    };

    /* const callback = (
      mutationList: MutationRecord[]
    ) => {
      if (mutationList.length > 0 && mutationList[0].target) {
        const _target = mutationList[0].target as HTMLElement;
        if (_target.classList.contains("rm-with-pagination")) {
          const currentPageCount = getExistingPageCount(this.editor);
          const pageCount = calculatePageCount(this.editor, this.options);
          const recalculatePageCount = needNewDecoration(this.editor, this.options, this.storage);
          if (currentPageCount !== pageCount || recalculatePageCount) {

            const tr = this.editor.view.state.tr.setMeta(
              page_count_meta_key,
              Date.now()
            );
            this.editor.view.dispatch(tr);
          }

          // refreshPage(_target);
          refreshPage(this.editor, _target);

        }
      }
    };
    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
    // refreshPage(targetNode);
    refreshPage(this.editor, targetNode); */


    initialRefreshPage(targetNode);

    setTimeout(() => {
      applyBgToAllNodePageIndexes(this.editor, paginationNodeViewsToAvoid)

    }, 5000);


  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: paginationPluginKey,
        // key: new PluginKey("pagination"),

        state: {
          init: (_, state) => {
            // this.editor.storage.PaginationPlus = { ...this.options };
            this.storage = { ...this.options };
            let widgetList: Decoration[] = []
            // If pagination is not activated don't continue
            // if (!state.tr.getMeta(force_page_reload_meta_key) || (this.storage.enabled != null && this.storage.enabled == false)) {
            // if ((state.tr.getMeta(force_page_reload_meta_key) !== undefined || state.tr.getMeta(force_page_reload_meta_key) != false) || (this.storage.enabled != null && this.storage.enabled == false)) {
            if (!this.editor.storage.PaginationPlus.enabled) {
              // if (state.tr.getMeta(force_page_reload_meta_key) !== undefined) {
              //   if (state.tr.getMeta(pagination_enabled_meta_key) === false) {

              // if (!state.tr.getMeta(force_page_reload_meta_key) || (this.storage.enabled != null && this.storage.enabled == false)) {
              // if (this.storage.enabled != null && this.storage.enabled == false) {
              widgetList = []
              // }
            } else {
              widgetList = createDecoration(state, this.options, editor);
            }
            // else{
            // const widgetList = createDecoration(state, this.options, editor);
            // }
            return DecorationSet.create(state.doc, widgetList);
          },
          apply: (tr, oldDeco, oldState, newState) => {
            // return oldDeco
            console.log("paginationplus updatePagination this.storage apply", this.editor.storage, this.editor.options)

            // console.log("paginationplus updatePagination apply"
            // , tr.getMeta(force_page_reload_meta_key), tr.getMeta(pagination_enabled_meta_key))

            // const pluginState = paginationPluginKey.getState(newState)
            // const storageEnabled = pluginState?.enabled
            // console.log("paginationplus updatePagination storageEnabled", storageEnabled)

            // if (!tr.getMeta(force_page_reload_meta_key)) {
            // If pagination is not activated don't continue
            // if (tr.getMeta(force_page_reload_meta_key) !== undefined) {
            // if (tr.getMeta(pagination_enabled_meta_key) === false) {
            // if ((tr.getMeta(force_page_reload_meta_key) !== undefined || tr.getMeta(force_page_reload_meta_key) != false) || (this.storage.enabled != null && this.storage.enabled == false)) {
            // if (!this.editor.storage.PaginationPlus.enabled) {
            // if (!tr.getMeta(force_page_reload_meta_key) || (this.storage.enabled != null && this.storage.enabled == false)) {
            console.log("paginationplus updatePagination apply yes", editor.storage, editor, this.options)

            // if (this.storage.enabled != null && this.storage.enabled == false) {
            // return oldDeco
            // }
            // }

            // }
            // const pageCount = 3;
            const pageCount = calculatePageCount(editor, this.options);
            const currentPageCount = getExistingPageCount(editor);

            const recalculatePageCount = needNewDecoration(editor, this.options, this.storage);

            // const pageCount = 1
            // const currentPageCount = 1

            // const recalculatePageCount = 1
            console.log("paginationplus Recalculate Page Count", recalculatePageCount, tr.getMeta(force_page_reload_meta_key), tr.getMeta(pagination_enabled_meta_key));

            if (
              // if(tr.getMeta(force_page_reload_meta_key) ||
              ((pageCount > 1 ? pageCount : 1) !== currentPageCount ||
                recalculatePageCount ||
                this.storage.pageBreakBackground !== this.options.pageBreakBackground ||
                this.storage.pageHeight !== this.options.pageHeight ||
                this.storage.pageWidth !== this.options.pageWidth ||
                this.storage.marginTop !== this.options.marginTop ||
                this.storage.marginBottom !== this.options.marginBottom ||
                this.storage.marginLeft !== this.options.marginLeft ||
                this.storage.marginRight !== this.options.marginRight ||
                this.storage.pageGap !== this.options.pageGap ||
                this.storage.contentMarginTop !== this.options.contentMarginTop ||
                this.storage.contentMarginBottom !== this.options.contentMarginBottom ||
                this.storage.headerLeft !== this.options.headerLeft ||
                this.storage.headerRight !== this.options.headerRight ||
                this.storage.footerLeft !== this.options.footerLeft ||
                this.storage.footerRight !== this.options.footerRight
              )) {
              // return oldDeco;
              this.storage = { ...this.options };
              // this.editor.storage.PaginationPlus = { ...this.options };
              console.log("paginationplus Recalculate Page Count yes", recalculatePageCount, tr.getMeta(force_page_reload_meta_key), tr.getMeta(pagination_enabled_meta_key));

              let widgetList: Decoration[] = []
              // If pagination is not activated don't continue
              // if (!tr.getMeta(force_page_reload_meta_key)) {
              // if (!tr.getMeta(force_page_reload_meta_key) || (this.storage.enabled != null && this.storage.enabled == false)) {
              // if ((tr.getMeta(force_page_reload_meta_key) !== undefined || tr.getMeta(force_page_reload_meta_key) != false) || (this.storage.enabled != null && this.storage.enabled == false)) {
              // if (tr.getMeta(force_page_reload_meta_key) !== undefined) {
              // if (tr.getMeta(pagination_enabled_meta_key) === false) {
              // if (tr.getMeta(pagination_enabled_meta_key) === false) {
              if (!this.editor.storage.PaginationPlus.enabled) {
                widgetList = []
                // }
                // }
              } else {
                widgetList = createDecoration(newState, this.options, editor);
              }
              // const widgetList = createDecoration(newState, this.options, editor);
              console.log("paginationplus Recalculate Page Count yes widgetList", widgetList, tr.getMeta(force_page_reload_meta_key), tr.getMeta(pagination_enabled_meta_key));


              newState.tr.setMeta(page_count_meta_key,
                Date.now()
                // "yees2"
              )
              // newState.tr.setMeta(pagination_enabled_meta_key,
              //   tr.getMeta(force_page_reload_meta_key)
              // )
              // newState.tr.setMeta(pagination_enabled_meta_key,
              //   tr.getMeta(force_page_reload_meta_key)
              // )
              // /* const tr2 = this.editor.view.state.tr.setMeta(
              // page_count_meta_key,
              // "yees2"
              // Date.now()
              // );
              // this.editor.view.dispatch(tr2); */
              return DecorationSet.create(newState.doc, [...widgetList]);
            }
            return oldDeco;
          },
        },

        props: {
          decorations(state: EditorState) {
            return this.getState(state) as DecorationSet;
          },
        },
      }),
      new Plugin({
        key: new PluginKey('brDecoration'),
        state: {
          init() { return DecorationSet.empty },
          apply(tr, old) {
            // Map decorations through document changes
            return old.map(tr.mapping, tr.doc);
          }
        },
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === 'hardBreak') {
                const afterPos = pos + 1;
                const widget = Decoration.widget(afterPos, () => {
                  const el = document.createElement('span');
                  el.classList.add('rm-br-decoration');
                  return el;
                });
                decorations.push(widget);
              }
            });
            return DecorationSet.create(state.doc, decorations);
          }
        }
      }),
    ];
  },
  addCommands() {
    return {
      enablePagination:
        (enabled: boolean) => () => {
          console.log("paginationplus enablePagination", this.storage.enabled)
          // this.storage.enabled = enabled
          this.editor.storage.PaginationPlus.enabled = enabled
          // const tr = this.editor.view.state.tr.setMeta(
          //   pagination_enabled_meta_key,
          //   enabled
          // );
          // this.editor.view.dispatch(tr);
          return true
        },
      updatePagination: (enablePagination?: boolean) => () => {
        // updatePagination: (enablePagination: boolean = false) => () => {
        enablePagination = enablePagination ?? this.editor.storage.PaginationPlus.enabled
        // return false;
        console.log("paginationplus updatePagination this.storage removeOrHideDecoration ", { enablePagination }, this.editor.storage, this.editor.options)

        if (!enablePagination) {
          // Hide pagination
          removeOrHideDecoration(this.editor.view.dom)
        }
        // if (enablePagination) {
        // Pagination was disabled before,  first create decoration
        // if (this.storage.enabled != null && this.storage.enabled == false) {
        // this.editor.commands.enablePagination(enablePagination)
        this.editor.storage.PaginationPlus.enabled = enablePagination
        // this.editor.options.PaginationPlus.enabled = enablePagination
        console.log("paginationplus updatePagination this.storage 3", this.editor.storage, this.options)

        // const pluginState = paginationPluginKey.getState(this.editor.state);

        // Update shared storage inside plugin
        // pluginState.enabled = enablePagination;

        // console.log("paginationplus updatePagination here", this.editor.storage.enabled)
        // 2. Force re-run plugin apply() using a metadata transaction
        /* const tr = this.editor.view.state.tr.setMeta(
          force_page_reload_meta_key,
          Date.now()
        );
        this.editor.view.dispatch(tr); */

        /* let tr = this.editor.view.state.tr.setMeta(
          force_page_reload_meta_key,
          // "yees111"
          Date.now()
          // enablePagination
        );
        tr = tr.setMeta(
          pagination_enabled_meta_key,
          // "yees111"
          // Date.now()
          enablePagination
        );
        this.editor.view.dispatch(tr); */

        // this.editor.view.dispatch(
        //   // this.editor.state.tr
        //   this.editor.state.tr.setMeta(page_count_meta_key, Date.now())
        // )
        // createDecoration(this.editor.state, this.options, this.editor)
        // }
        // }
        const refreshPageCommand = (targetNode: HTMLElement) => {
          const _target = targetNode;
          if (_target.classList.contains("rm-with-pagination")) {
            const currentPageCount = getExistingPageCount(this.editor);
            const pageCount = calculatePageCount(this.editor, this.options);
            const recalculatePageCount = needNewDecoration(this.editor, this.options, this.storage);
            if (currentPageCount !== pageCount || recalculatePageCount) {

              /* const tr = this.editor.view.state.tr.setMeta(
                page_count_meta_key,
                // Date.now()
  
            "yees3"
              ); */
              const tr = this.editor.view.state.tr.setMeta(
                page_count_meta_key,
                // "yees3"
                Date.now()
              );
              this.editor.view.dispatch(tr);
              // this.editor.view.dispatch(tr);
            }

            refreshPage(this.editor, _target);
          }
        };
        refreshPageCommand(this.editor.view.dom)
        return true;
      },
      updatePageBreakBackground: (color: string) => () => {
        this.options.pageBreakBackground = color;
        return true;
      },
      updatePageSize: (size: PageSize) => () => {
        this.options.pageHeight = size.pageHeight;
        this.options.pageWidth = size.pageWidth;
        this.options.marginTop = size.marginTop;
        this.options.marginBottom = size.marginBottom;
        this.options.marginLeft = size.marginLeft;
        this.options.marginRight = size.marginRight;
        return true;
      },
      updatePageWidth: (width: number) => () => {
        this.options.pageWidth = width;
        return true;
      },
      updatePageHeight: (height: number) => () => {
        this.options.pageHeight = height;
        return true;
      },
      updatePageGap: (gap: number) => () => {
        this.options.pageGap = gap;
        return true;
      },
      updateMargins: (margins: { top: number, bottom: number, left: number, right: number }) => () => {
        this.options.marginTop = margins.top;
        this.options.marginBottom = margins.bottom;
        this.options.marginLeft = margins.left;
        this.options.marginRight = margins.right;
        return true;
      },
      updateContentMargins: (margins: { top: number, bottom: number }) => () => {
        this.options.contentMarginTop = margins.top;
        this.options.contentMarginBottom = margins.bottom;
        return true;
      },
      updateHeaderContent: (left: string, right: string) => () => {
        this.options.headerLeft = left;
        this.options.headerRight = right;
        return true;
      },
      updateFooterContent: (left: string, right: string) => () => {
        this.options.footerLeft = left;
        this.options.footerRight = right;
        return true;
      },

      getAllNodePageIndexes:
        (nodeViewWrapperClassList: string[] = []) =>
          () => {
            // ({ editor }) => {



            const editorEl = this.editor.view.dom as HTMLElement
            if (!editorEl) return false

            const results = new Map<HTMLElement, number>()

            // Iterate over each NodeView wrapper class
            for (const className of nodeViewWrapperClassList) {

              // Find ALL NodeViews for this class
              const nodeEls = editorEl.querySelectorAll<HTMLElement>(
                `.${className}`
              )

              nodeEls.forEach(nodeEl => {
                const pageIndex = getNodePageIndex(nodeEl, editorEl)

                // Store result
                results.set(nodeEl, pageIndex)

                // Persist on DOM for styling / debugging
                // nodeEl.dataset.page = String(pageIndex)

                // Example visual rule
                // nodeEl.classList.toggle(
                //   'no-page-background',
                //   // false // 
                // )

                console.log('Node page index', {
                  className,
                  nodeEl,
                  pageIndex
                })
              })
            }

            return results
          },
    };
  },
});



function getRelativeTop(el: HTMLElement, container: HTMLElement): number {
  const elRect = el.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return elRect.top - containerRect.top + container.scrollTop
}


function getPageBreakPositions(editorEl: HTMLElement): number[] {
  return Array.from(
    editorEl.querySelectorAll<HTMLElement>('.rm-page-break .page')
  ).map(el => el.offsetTop)
}

function getNodePageIndex(
  nodeEl: HTMLElement,
  editorEl: HTMLElement
): number {
  const nodeTop = getRelativeTop(nodeEl, editorEl)
  const pageBreaks = getPageBreakPositions(editorEl)

  for (let i = 0; i < pageBreaks.length; i++) {
    if (nodeTop < pageBreaks[i]) {
      return i
    }
  }

  return pageBreaks.length
}

function getAllNodePageIndexes(editor: Editor, nodeViewWrapperClassList: string[] = []): Map<HTMLElement, number> | null {
  // ({ editor }) => {



  const editorEl = editor.view.dom as HTMLElement
  if (!editorEl) return null

  const results = new Map<HTMLElement, number>()

  // Iterate over each NodeView wrapper class
  for (const className of nodeViewWrapperClassList) {

    // Find ALL NodeViews for this class
    const nodeEls = editorEl.querySelectorAll<HTMLElement>(
      `.${className}`
    )

    nodeEls.forEach(nodeEl => {
      const pageIndex = getNodePageIndex(nodeEl, editorEl)

      // Store result
      results.set(nodeEl, pageIndex)

      // Persist on DOM for styling / debugging
      // nodeEl.dataset.page = String(pageIndex)

      // Example visual rule
      // nodeEl.classList.toggle(
      //   'no-page-background',
      //   // false // 
      // )

      console.log('getAllNodePageIndexes Node page index', {
        className,
        nodeEl,
        pageIndex
      })
    })
  }

  return results
}

function applyBgToAllNodePageIndexes(editor: Editor, nodeViewWrapperClassList: string[] = []) {
  // onTransaction() {
  console.log('getAllNodePageIndexes onTransaction', {})
  const allNoPageNodeViews = getAllNodePageIndexes(editor, nodeViewWrapperClassList)
  console.log('getAllNodePageIndexes onTransaction Node page index', {
    allNoPageNodeViews
  })

  /* `forEach allNoPageNodeViews as noPageNodeView
 "rm-page-break" of (index of noPageNodeView) 's "rm-pagination-gap", "rm-page-header-left" and  "rm-page-header-right" add class opacity-0
noPageNodeView "page-background" add class gray 

"rm-page-break" of (index + 1 of noPageNodeView) 's  'rm-page-footer'
  ` */

  // const editor = this.editor
  if (!editor?.view?.dom) return

  const editorEl = editor.view.dom as HTMLElement

  // All pages
  const pageBreaks = Array.from(
    editorEl.querySelectorAll<HTMLElement>('.rm-page-break')
  )

  pageBreaks.forEach(pageBreak => {
    pageBreak.querySelectorAll<HTMLElement>(
      '.rm-pagination-gap, .rm-page-header-left, .rm-page-header-right'
    )
      .forEach(el => el.classList.remove('opacity-0'))

    pageBreak.querySelectorAll<HTMLElement>('.page-background')
      .forEach(bg => {
        bg.classList.remove('bg-hatched-5-important')
      })
    pageBreak.querySelectorAll<HTMLElement>('.rm-page-footer')
      .forEach(el => el.classList.remove('opacity-0'))
  })


  const nodeViewsToIgnoreIndexes = Array.from(allNoPageNodeViews?.values() || [])
  const nodeViewsToIgnoreDomElements = Array.from(allNoPageNodeViews?.keys() || [])


  // All node views that should disable pagination visuals
  // const nodeViews = Array.from(
  //   editorEl.querySelectorAll<HTMLElement>('.node-view-slide')
  // )
  // const nodeViews = Array.from(allNoPageNodeViews?.values() || [])
  // const nodeViews = Array.from(allNoPageNodeViews?.values() || [])
  // const nodeViewPageIndexes = Array.from(allNoPageNodeViews?.values() || [])
  // const nodeViews = Array.from(allNoPageNodeViews?.keys() || [])
  // console.log('getAllNodePageIndexes nodeViews', {
  //   nodeViewsToIgnoreIndexes
  // })
  const pagesToIgnore = new Map<number, PaginationPlusPageToIgnoreOptions>()

  // nodeViewsToIgnoreIndexes.forEach(nodeViewPageIndex => {
  allNoPageNodeViews?.forEach((nodeViewPageIndex, el) => {
    //  const pagesToIgnore = new Map<number, PaginationPlusPageToIgnoreOptions>()
    const nodeViewContent = el.querySelector(".node-view-content")
    pagesToIgnore.set(nodeViewPageIndex, {
      width: nodeViewContent?.clientWidth || el.offsetWidth || 0,
      height: nodeViewContent?.scrollHeight || el.offsetHeight || 0
    })
    // nodeViews.forEach(nodeViewPageIndex => {
    console.log('getAllNodePageIndexes nodeView forEac', {
      nodeViewsToIgnoreIndexes, nodeViewPageIndex
    })
    nodeViewPageIndex = nodeViewPageIndex - 1
    // nodeViews.forEach(nodeView => {
    // Find the page this node view belongs to
    // const pageBreak = nodeView
    const pageBreak = pageBreaks[nodeViewPageIndex]
    // const pageBreak = nodeView.closest<HTMLElement>('.rm-page-break')
    // if (!pageBreak) return

    // const pageIndex = pageBreaks.indexOf(pageBreak)
    const pageIndex = nodeViewPageIndex
    if (pageIndex === -1) return

    console.log('getAllNodePageIndexes nodeView forEachs', {
      nodeViewsToIgnoreIndexes, pageBreak,
      "len ": pageBreak
        .querySelectorAll<HTMLElement>(
          '.rm-pagination-gap, .rm-page-header-left, .rm-page-header-right'
        ),
      "background ": pageBreak
        .querySelectorAll<HTMLElement>('.page-background')
    })




    /* --------------------------------------------
     * 1️⃣ Hide header + pagination gap on THIS page
     * ------------------------------------------ */
    pageBreak
      .querySelectorAll<HTMLElement>(
        '.rm-pagination-gap, .rm-page-header-left, .rm-page-header-right'
      )
      .forEach(el => el.classList.add('opacity-0'))

    /* --------------------------------------------
     * 2️⃣ Style the page background of the NodeView
     * ------------------------------------------ */
    pageBreak
      .querySelectorAll<HTMLElement>('.page-background')
      .forEach(bg => {
        bg.classList.add('bg-hatched-5-important')
      })

    /* --------------------------------------------
     * 3️⃣ Hide footer of NEXT page
     * ------------------------------------------ */
    const nextPageBreak = pageBreaks[pageIndex + 1]
    if (nextPageBreak) {
      nextPageBreak
        .querySelectorAll<HTMLElement>('.rm-page-footer')
        .forEach(el => el.classList.add('opacity-0'))
    }


    // Optional: expose page index for debugging
    // nodeView.dataset.pageIndex = String(pageIndex)
  })
  editor.storage.PaginationPlus.pagesToIgnore = pagesToIgnore
  console.log('getAllNodePageIndexes nodeView pagesToIgnore', {
    pagesToIgnore
  }, editor.storage.PaginationPlus.pagesToIgnore)


}


const refreshPage = (editor: Editor, targetNode: HTMLElement) => {
  const paginationElement = targetNode.querySelector(
    "[data-rm-pagination]"
  );
  if (paginationElement) {
    const lastPageBreak = paginationElement.lastElementChild?.querySelector(
      ".breaker"
    ) as HTMLElement;
    if (lastPageBreak) {
      const minHeight =
        lastPageBreak.offsetTop + lastPageBreak.offsetHeight;
      targetNode.style.minHeight = `${minHeight}px`;
    }
  }
};


const getExistingPageCount = (editor: Editor,) => {
  // if pagination is not enable don't take any action
  if (!editor.storage?.PaginationPlus?.enabled) {
    // return 0
  }
  // const getExistingPageCount = (view: EditorView) => {
  const editorDom = editor.view.dom;
  const paginationElement = editorDom.querySelector("[data-rm-pagination]");
  if (paginationElement) {
    return paginationElement.children.length;
  }
  return 0;
};
const needNewDecoration = (editor: Editor, pageOptions: PaginationPlusOptions, storage: PaginationPlusOptions) => {
  // const needNewDecoration = (view: EditorView, pageOptions: PaginationPlusOptions, storage: PaginationPlusOptions) => {
  let recalculatePageCount = false;
  // if pagination is not enable don't take any action
  if (!editor.storage?.PaginationPlus?.enabled) {
    return false
  }

  const editorDom = editor.view.dom;
  const paginationElement = editorDom.querySelector("[data-rm-pagination]");



  if (paginationElement) {
    const firstPageBreakPage = paginationElement.querySelector(".rm-page-break > .page") as HTMLElement;

    if (firstPageBreakPage) {
      const marginTop = parseFloat(getComputedStyle(firstPageBreakPage).marginTop);
      const headerHeight = paginationElement.querySelector(".rm-first-page-header")?.clientHeight || 0;
      const pageFooter = paginationElement.querySelector(".rm-page-footer") as HTMLElement;
      if (storage.footerLeft !== pageOptions.footerLeft || storage.footerRight !== pageOptions.footerRight) {
        pageFooter.innerHTML = getFooter(pageOptions.footerRight, pageOptions.footerLeft).innerHTML;
      }

      const footerHeight = pageFooter ? pageFooter.clientHeight : 0;

      const _pageHeaderHeight = pageOptions.contentMarginTop + pageOptions.marginTop + headerHeight;
      const _pageFooterHeight = pageOptions.contentMarginBottom + pageOptions.marginBottom + footerHeight;
      const _pageHeight = pageOptions.pageHeight - _pageHeaderHeight - _pageFooterHeight;
      console.log("Page Height", _pageHeight + _pageHeaderHeight, marginTop);

      if (marginTop !== _pageHeight + _pageHeaderHeight) {
        recalculatePageCount = true;
      }

    }
  }

  return recalculatePageCount;
}
const calculatePageCount = (
  editor: Editor,
  // view: EditorView,
  pageOptions: PaginationPlusOptions
) => {
  // if pagination is not enable don't take any action
  if (!editor.storage?.PaginationPlus?.enabled) {
    return 0
  }
  const view = editor.view;
  const editorDom = view.dom;
  updateCssVariables(editorDom, pageOptions);
  const headerHeight = editorDom.querySelector(".rm-first-page-header")?.clientHeight || 0;
  const footerHeight = editorDom.querySelector(".rm-page-footer")?.clientHeight || 0;

  const _pageHeaderHeight = pageOptions.contentMarginTop + pageOptions.marginTop + headerHeight;
  const _pageFooterHeight = pageOptions.contentMarginBottom + pageOptions.marginBottom + footerHeight;

  const pageContentAreaHeight =
    pageOptions.pageHeight - _pageHeaderHeight - _pageFooterHeight;


  const paginationElement = editorDom.querySelector("[data-rm-pagination]");
  const currentPageCount = getExistingPageCount(editor);
  // const currentPageCount = getExistingPageCount(view);
  if (paginationElement) {
    const lastElementOfEditor = editorDom.lastElementChild;
    const lastPageBreak =
      paginationElement.lastElementChild?.querySelector(".breaker");
    if (lastElementOfEditor && lastPageBreak) {
      const lastElementRect = lastElementOfEditor.getBoundingClientRect();
      const lastPageBreakRect = lastPageBreak.getBoundingClientRect();
      const lastPageGap =
        lastElementRect.bottom -
        lastPageBreakRect.bottom;
      if (lastPageGap > 0) {
        const addPage = Math.ceil(lastPageGap / pageContentAreaHeight);
        return currentPageCount + addPage;
      } else {
        const lpFrom = -10;
        const lpTo = -(pageOptions.pageHeight - 10);
        if (lastPageGap > lpTo && lastPageGap < lpFrom) {
          return currentPageCount;
        } else if (lastPageGap < lpTo) {
          const pageHeightOnRemove =
            pageOptions.pageHeight + pageOptions.pageGap;
          const removePage = Math.floor(lastPageGap / pageHeightOnRemove);
          return currentPageCount + removePage;
        } else {
          return currentPageCount;
        }
      }
    }
    return 1;
  } else {
    const editorHeight = editorDom.scrollHeight;
    let pageCount = Math.ceil(editorHeight / pageContentAreaHeight);
    pageCount = pageCount <= 0 ? 1 : pageCount;
    console.log("returning pageCount", pageCount);
    return pageCount;
  }
};

function getFooter(footerRightContent: string, footerLeftContent: string) {
  const pageFooter = document.createElement("div");
  pageFooter.classList.add("rm-page-footer");
  // pageFooter.style.height = pageOptions.pageFooterHeight + "px";
  pageFooter.style.overflow = "hidden";

  const footerRight = footerRightContent.replace(
    "{page}",
    `<span class="rm-page-number"></span>`
  );
  const footerLeft = footerLeftContent.replace(
    "{page}",
    `<span class="rm-page-number"></span>`
  );

  const pageFooterLeft = document.createElement("div");
  pageFooterLeft.classList.add("rm-page-footer-left");
  pageFooterLeft.innerHTML = footerLeft;

  const pageFooterRight = document.createElement("div");
  pageFooterRight.classList.add("rm-page-footer-right");
  pageFooterRight.innerHTML = footerRight;

  pageFooter.append(pageFooterLeft);
  pageFooter.append(pageFooterRight);

  return pageFooter;
}

function createDecoration(
  state: EditorState,
  pageOptions: PaginationPlusOptions,
  editor: Editor,
  isInitial: boolean = false
): Decoration[] {

  const pageWidget = Decoration.widget(
    0,
    (view) => {
      const editorDom = view.dom;
      const _pageGap = pageOptions.pageGap;
      const _pageBreakBackground = pageOptions.pageBreakBackground;
      const headerHeight = editorDom.querySelector(".rm-first-page-header")?.clientHeight || 0;
      const footerHeight = editorDom.querySelector(".rm-page-footer")?.clientHeight || 0;
      const _pageHeaderHeight = pageOptions.contentMarginTop + pageOptions.marginTop + headerHeight;
      const _pageFooterHeight = pageOptions.contentMarginBottom + pageOptions.marginBottom + footerHeight;
      const _pageHeight = pageOptions.pageHeight - _pageHeaderHeight - _pageFooterHeight;

      const el = document.createElement("div");
      el.dataset.rmPagination = "true";

      const pageBreakDefinition = ({
        firstPage = false,
      }: {
        firstPage: boolean;
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
        pageBreak.style.width = `calc(100% + var(--rm-margin-left) + var(--rm-margin-right))`;
        pageBreak.style.marginLeft = `calc(-1 * var(--rm-margin-left))`;
        pageBreak.style.marginRight = `calc(-1 * var(--rm-margin-right))`;
        pageBreak.style.position = "relative";
        pageBreak.style.float = "left";
        pageBreak.style.clear = "both";
        pageBreak.style.left = `0px`;
        pageBreak.style.right = `0px`;
        // pageBreak.style.zIndex = "2";

        const pageFooter = getFooter(pageOptions.footerRight, pageOptions.footerLeft);


        const pageSpace = document.createElement("div");
        pageSpace.classList.add("rm-pagination-gap");
        pageSpace.style.height = _pageGap + "px";
        // pageSpace.style.borderLeft = "1px solid";
        // pageSpace.style.borderRight = "1px solid";
        pageSpace.style.position = "relative";
        pageSpace.style.setProperty("width", "calc(100%)", "important");
        // pageSpace.style.setProperty("width", "calc(100% + 2px)", "important");
        // pageSpace.style.left = "-1px";
        pageSpace.style.backgroundColor = _pageBreakBackground;
        pageSpace.style.borderLeftColor = _pageBreakBackground;
        pageSpace.style.borderRightColor = _pageBreakBackground;

        const pageHeader = document.createElement("div");
        pageHeader.classList.add("rm-page-header");
        // pageHeader.style.height = pageOptions.pageHeaderHeight + "px";
        pageHeader.style.overflow = "hidden";

        const headerLeft = pageOptions.headerLeft.replace(
          "{page}",
          `<span class="rm-page-number-plus"></span>`
        );
        const headerRight = pageOptions.headerRight.replace(
          "{page}",
          `<span class="rm-page-number-plus"></span>`
        );

        const pageHeaderLeft = document.createElement("div");
        pageHeaderLeft.classList.add("rm-page-header-left");
        pageHeaderLeft.innerHTML = headerLeft;

        const pageHeaderRight = document.createElement("div");
        pageHeaderRight.classList.add("rm-page-header-right");
        pageHeaderRight.innerHTML = headerRight;



        /* Custom code start */
        const customPageBreakContainer = document.createElement('div')
        customPageBreakContainer.className = 'custom-page-break'
        // Mount Svelte component dynamically
        const component = mount(PageBreakComponent, {
          target: customPageBreakContainer,
          props: {
            __editor: editor,
            // __index: i + 1,
            // __total: pageCount,
            // __totalHeight: totalHeight,
            __pageHeight: pageOptions.pageHeight,
            __pageWidth: pageOptions.pageWidth,
            __headerHeight: headerHeight,
            __footerHeight: footerHeight,
            __gap: pageOptions.pageGap,
            // __margin: pageOptions.marginTop,
          },
        })
        /* Custom code end */

        // pageHeader.append(pageHeaderLeft, pageHeaderRight);
        pageHeader.append(pageHeaderLeft, pageHeaderRight, customPageBreakContainer);




        pageBreak.append(pageFooter, pageSpace, pageHeader);
        pageContainer.append(page, pageBreak);

        return pageContainer;
      };

      const page = pageBreakDefinition({ firstPage: false });
      const firstPage = pageBreakDefinition({
        firstPage: true,
      });
      const fragment = document.createDocumentFragment();

      const pageCount = calculatePageCount(editor, pageOptions);
      // const pageCount = calculatePageCount(view, pageOptions);
      console.log("We Need to create", pageCount, "pages");

      for (let i = 0; i < pageCount; i++) {
        if (i === 0) {
          fragment.appendChild(firstPage.cloneNode(true));
        } else {
          fragment.appendChild(page.cloneNode(true));
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
    () => {
      const el = document.createElement("div");
      // el.style.position = "relative";
      el.classList.add("rm-first-page-header");

      el.style.width = `calc(100% + var(--rm-margin-left) + var(--rm-margin-right))`;
      el.style.marginLeft = `calc(-1 * var(--rm-margin-left))`;
      el.style.marginRight = `calc(-1 * var(--rm-margin-right))`;


      const headerLeft = pageOptions.headerLeft.replace(
        "{page}",
        `1`
      );
      const headerRight = pageOptions.headerRight.replace(
        "{page}",
        `1`
      );

      const pageHeaderLeft = document.createElement("div");
      pageHeaderLeft.classList.add("rm-first-page-header-left");
      pageHeaderLeft.innerHTML = headerLeft;
      pageHeaderLeft.style.paddingLeft = `var(--rm-margin-left)`;

      el.append(pageHeaderLeft);

      const pageHeaderRight = document.createElement("div");
      pageHeaderRight.classList.add("rm-first-page-header-right");
      pageHeaderRight.innerHTML = headerRight;
      pageHeaderRight.style.paddingRight = `var(--rm-margin-right)`;

      el.append(pageHeaderRight);

      /* Custom code start */
      const customPageBreakContainer = document.createElement('div')
      customPageBreakContainer.className = 'custom-page-break'
      // Mount Svelte component dynamically
      const component = mount(PageBreakComponent, {
        target: customPageBreakContainer,
        props: {
          __editor: editor,
          // __index: i + 1,
          // __total: pageCount,
          // __totalHeight: totalHeight,
          __pageHeight: pageOptions.pageHeight,
          __pageWidth: pageOptions.pageWidth,
          __headerHeight: 0,
          __footerHeight: 0,
          __gap: pageOptions.pageGap,
          // __margin: pageOptions.marginTop,
        },
      })
      /* Custom code end */
      el.append(customPageBreakContainer);

      // el.style.height = `${pageOptions.pageHeaderHeight}px`;
      el.style.overflow = "hidden";
      return el;
    },
    { side: -1 }
  );

  return !isInitial ? [pageWidget, firstHeaderWidget] : [pageWidget];
}


const removeOrHideDecoration = (targetNode: HTMLElement, isRemove: boolean = false, pagesToRemoveOrHide?: number[]) => {
  console.log("removeOrHideDecoration 1")

  const paginationElement = targetNode.querySelector(
    "[data-rm-pagination]"
  ) as HTMLElement
  const paginationFirstPageElement = targetNode.querySelector(
    ".rm-first-page-header")

  console.log("removeOrHideDecoration", paginationElement, isRemove)
  /* if (isRemove) {
 paginationElement?.remove()
  }else{
    paginationElement.style.border = 'hidden'
  } */
  if (paginationElement) {
    isRemove ? paginationElement?.remove() : paginationElement.style.display = 'none'
    isRemove ? paginationFirstPageElement?.remove() : paginationElement.style.display = 'none'
  }
  // );
  // }
  if (pagesToRemoveOrHide) {
    //...
  }
};