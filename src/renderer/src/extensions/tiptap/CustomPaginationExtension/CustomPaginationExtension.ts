import { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { PaginationPlus as BasePaginationPlus } from 'tiptap-pagination-plus'
import { mount, unmount } from 'svelte'

import type { PaginationPlusOptions, PaginationPlusPageToIgnoreOptions } from '../utils/common.utils'
import PageBreakComponent from './components/PageBreakComponent.svelte'
import { CustomSlideExtensionProps } from '../CustomSlideExtension/utils/common.utils'
import { CustomDesignExtensionProps } from '../CustomDesignExtension/utils/common.utils'
import { CustomSpreadsheetExtensionProps } from '../CustomSpreadsheetExtension/utils/common.utils'

export type CustomPaginationOptions = PaginationPlusOptions & {
  nodeViewsToIgnoreClassList?: string[]
  enableCustomPageBreak?: boolean
}

const DEFAULT_NODE_VIEWS_TO_IGNORE = []
// const DEFAULT_NODE_VIEWS_TO_IGNORE = [`node-view-${CustomSlideExtensionProps.name}`]
// const DEFAULT_NODE_VIEWS_TO_IGNORE = [`node-view-${CustomSlideExtensionProps.name}`, `node-view-${CustomSpreadsheetExtensionProps.name}`, `node-view-${CustomDesignExtensionProps.name}`]
// const DEFAULT_NODE_VIEWS_TO_IGNORE = ['node-view-slide', 'node-view-sheet', 'node-view-design']
const SLIDE_NODE_VIEW_CLASS = `node-view-${CustomSlideExtensionProps.name}`
const SLIDE_HATCH_CLASS = 'rm-slide-hatch'
const SLIDE_PAGE_CLASS = 'rm-slide-page'
const CUSTOM_PAGINATION_PLUGIN_KEY = new PluginKey('customPaginationPlus')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    PaginationPlus: {
      updateMargins: (margins: {
        top: number;
        bottom: number;
        left: number;
        right: number;
      }) => ReturnType;
      enablePagination: (enabled: boolean) => ReturnType
      updatePagination: (enablePagination?: boolean) => ReturnType
      getAllNodePageIndexes: (nodeViewWrapperClassList: string[]) => ReturnType
    }
  }

  interface Storage {
    PaginationPlus: PaginationPlusOptions & {
      pagesToIgnore?: Map<number, PaginationPlusPageToIgnoreOptions> | null
    }
  }
}

type MountedComponent = {
  instance: any
  container: HTMLElement
  props: Record<string, any>
}

const destroyComponent = (instance: any) => {
  if (!instance) return
  try {
    unmount(instance)
    return
  } catch {
    // fall through
  }
  if (typeof instance.destroy === 'function') {
    instance.destroy()
    return
  }
  if (typeof instance.$destroy === 'function') {
    instance.$destroy()
  }
}

const arePropsEqual = (a: Record<string, any>, b: Record<string, any>) => {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)

  if (aKeys.length !== bKeys.length) return false

  for (const key of aKeys) {
    if (a[key] !== b[key]) return false
  }

  return true
}

const setPaginationVisibility = (editorDom: HTMLElement, enabled: boolean) => {
  const paginationElement = editorDom.querySelector('[data-rm-pagination]') as HTMLElement | null
  const paginationFirstPageHeader = editorDom.querySelector('.rm-first-page-header') as HTMLElement | null

  if (!paginationElement && !paginationFirstPageHeader) return

  if (enabled) {
    if (paginationElement) paginationElement.style.display = ''
    if (paginationFirstPageHeader) paginationFirstPageHeader.style.display = ''
    return
  }

  if (paginationElement) paginationElement.style.display = 'none'
  if (paginationFirstPageHeader) paginationFirstPageHeader.style.display = 'none'
}

const getRelativeTop = (el: HTMLElement, container: HTMLElement): number => {
  const elRect = el.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return elRect.top - containerRect.top + container.scrollTop
}

const getPageBreakPositions = (editorEl: HTMLElement): number[] => {
  return Array.from(editorEl.querySelectorAll<HTMLElement>('.rm-page-break .page')).map(
    (el) => el.offsetTop
  )
}

const getNodePageIndex = (nodeEl: HTMLElement, editorEl: HTMLElement): number => {
  const nodeTop = getRelativeTop(nodeEl, editorEl)
  const pageBreaks = getPageBreakPositions(editorEl)

  for (let i = 0; i < pageBreaks.length; i += 1) {
    if (nodeTop < pageBreaks[i]) {
      return i + 1
    }
  }

  return pageBreaks.length + 1
}

const getAllNodePageIndexes = (
  editor: Editor,
  nodeViewWrapperClassList: string[] = []
): Map<HTMLElement, number> => {
  const results = new Map<HTMLElement, number>()
  if (editor.isDestroyed) return results

  let editorEl: HTMLElement | null = null
  try {
    editorEl = editor.view.dom as HTMLElement
  } catch (e) {
    return results
  }

  if (!editorEl) return results

  for (const className of nodeViewWrapperClassList) {
    const nodeEls = editorEl.querySelectorAll<HTMLElement>(`.${className}`)
    nodeEls.forEach((nodeEl) => {
      const pageIndex = getNodePageIndex(nodeEl, editorEl)
      results.set(nodeEl, pageIndex)
    })
  }

  return results
}

const applyNodeViewIgnoreStyles = (editor: Editor, options: CustomPaginationOptions) => {
  if (editor.isDestroyed) return
  let editorEl: HTMLElement | null = null
  try {
    editorEl = editor.view.dom as HTMLElement
  } catch (e) {
    return
  }
  if (!editorEl) return
  if (editor.storage?.PaginationPlus?.enabled === false || options.enabled === false) return
  const pageBreaks = Array.from(editorEl.querySelectorAll<HTMLElement>('.rm-page-break'))

  if (!pageBreaks.length) {
    editor.storage.PaginationPlus.pagesToIgnore = null
      ; (editor.storage.PaginationPlus as any)._lastIgnoreSignature = 'pages:0|nodes:0'
    return
  }

  const nodeViewClassList = options.nodeViewsToIgnoreClassList ?? DEFAULT_NODE_VIEWS_TO_IGNORE
  if (!nodeViewClassList.length) {
    editor.storage.PaginationPlus.pagesToIgnore = null
      ; (editor.storage.PaginationPlus as any)._lastIgnoreSignature = `pages:${pageBreaks.length}|nodes:0`
    return
  }
  const nodeViewPageMap = getAllNodePageIndexes(editor, nodeViewClassList)

  if (!nodeViewPageMap.size) {
    const signature = `pages:${pageBreaks.length}|nodes:0`
    const lastSignature = (editor.storage.PaginationPlus as any)._lastIgnoreSignature
    if (lastSignature === signature) return

    pageBreaks.forEach((pageBreak) => {
      pageBreak.classList.remove(SLIDE_PAGE_CLASS)
      pageBreak.querySelectorAll<HTMLElement>(`.${SLIDE_HATCH_CLASS}`).forEach((el) => el.remove())
      pageBreak
        .querySelectorAll<HTMLElement>(
          '.rm-pagination-gap, .rm-page-header-left, .rm-page-header-right'
        )
        .forEach((el) => el.classList.remove('opacity-0'))

      pageBreak.querySelectorAll<HTMLElement>('.page-background').forEach((bg) => {
        bg.classList.remove('bg-hatched-5-important')
      })

      pageBreak.querySelectorAll<HTMLElement>('.rm-page-footer').forEach((el) => {
        el.classList.remove('opacity-0')
      })
    })

    editor.storage.PaginationPlus.pagesToIgnore = null
      ; (editor.storage.PaginationPlus as any)._lastIgnoreSignature = signature
    return
  }

  const metrics = new Map<HTMLElement, { pageNumber: number; width: number; height: number }>()
  const signatureParts: string[] = [`pages:${pageBreaks.length}`, `nodes:${nodeViewPageMap.size}`]

  const pagesToIgnore = new Map<number, PaginationPlusPageToIgnoreOptions>()

  nodeViewPageMap.forEach((pageNumber, el) => {
    const pageIndex = Math.max(0, pageNumber - 1)
    const pageBreak = pageBreaks[pageIndex]

    if (!pageBreak) return

    const nodeViewContent = el.querySelector('.node-view-content') as HTMLElement | null
    const width = nodeViewContent?.clientWidth || el.offsetWidth || 0
    const height = nodeViewContent?.scrollHeight || el.offsetHeight || 0
    const existing = pagesToIgnore.get(pageNumber)

    metrics.set(el, { pageNumber, width, height })
    signatureParts.push(`${pageNumber}:${Math.round(width)}x${Math.round(height)}`)

    pagesToIgnore.set(pageNumber, {
      width: Math.max(existing?.width ?? 0, width),
      height: Math.max(existing?.height ?? 0, height)
    })
  })

  const signature = signatureParts.join('|')
  const lastSignature = (editor.storage.PaginationPlus as any)._lastIgnoreSignature
  if (lastSignature === signature) return

  pageBreaks.forEach((pageBreak) => {
    pageBreak.classList.remove(SLIDE_PAGE_CLASS)
    pageBreak.querySelectorAll<HTMLElement>(`.${SLIDE_HATCH_CLASS}`).forEach((el) => el.remove())
    pageBreak
      .querySelectorAll<HTMLElement>(
        '.rm-pagination-gap, .rm-page-header-left, .rm-page-header-right'
      )
      .forEach((el) => el.classList.remove('opacity-0'))

    pageBreak.querySelectorAll<HTMLElement>('.page-background').forEach((bg) => {
      bg.classList.remove('bg-hatched-5-important')
    })

    pageBreak.querySelectorAll<HTMLElement>('.rm-page-footer').forEach((el) => {
      el.classList.remove('opacity-0')
    })
  })

  metrics.forEach(({ pageNumber, width, height }, el) => {
    const pageIndex = Math.max(0, pageNumber - 1)
    const pageBreak = pageBreaks[pageIndex]

    if (!pageBreak) return

    pageBreak
      .querySelectorAll<HTMLElement>(
        '.rm-pagination-gap, .rm-page-header-left, .rm-page-header-right'
      )
      .forEach((target) => target.classList.add('opacity-0'))

    pageBreak.querySelectorAll<HTMLElement>('.page-background').forEach((bg) => {
      bg.classList.add('bg-hatched-5-important')
    })

    const nextPageBreak = pageBreaks[pageIndex + 1]
    if (nextPageBreak) {
      nextPageBreak
        .querySelectorAll<HTMLElement>('.rm-page-footer')
        .forEach((target) => target.classList.add('opacity-0'))
    }

    if (el.classList.contains(SLIDE_NODE_VIEW_CLASS)) {
      const pageEl = pageBreak.querySelector<HTMLElement>('.page')
      if (!pageEl) return

      pageBreak.classList.add(SLIDE_PAGE_CLASS)
      pageEl.style.position = 'relative'

      const rawPageHeight =
        typeof options.pageHeight === 'number' ? options.pageHeight : pageEl.clientHeight || 1000
      const rawPageWidth =
        typeof options.pageWidth === 'number' ? options.pageWidth : pageEl.clientWidth || 800
      const pageHeight = Math.max(1, Number.isFinite(rawPageHeight) ? rawPageHeight : 1000)
      const pageWidth = Math.max(1, Number.isFinite(rawPageWidth) ? rawPageWidth : 800)

      const padX = Math.max(0, (pageWidth - width) / 2)
      const padY = Math.max(0, (pageHeight - height) / 2)

      el.style.marginLeft = 'auto'
      el.style.marginRight = 'auto'
      el.style.marginTop = `${padY}px`
      el.style.marginBottom = `${padY}px`
      el.style.display = 'block'

      const hatch = document.createElement('div')
      hatch.className = SLIDE_HATCH_CLASS
      hatch.style.position = 'absolute'
      hatch.style.inset = '0'
      hatch.style.pointerEvents = 'none'

      const top = document.createElement('div')
      top.className = 'rm-slide-hatch-block'
      top.style.top = '0'
      top.style.left = '0'
      top.style.right = '0'
      top.style.height = `${padY}px`

      const bottom = document.createElement('div')
      bottom.className = 'rm-slide-hatch-block'
      bottom.style.bottom = '0'
      bottom.style.left = '0'
      bottom.style.right = '0'
      bottom.style.height = `${padY}px`

      const left = document.createElement('div')
      left.className = 'rm-slide-hatch-block'
      left.style.top = `${padY}px`
      left.style.bottom = `${padY}px`
      left.style.left = '0'
      left.style.width = `${padX}px`

      const right = document.createElement('div')
      right.className = 'rm-slide-hatch-block'
      right.style.top = `${padY}px`
      right.style.bottom = `${padY}px`
      right.style.right = '0'
      right.style.width = `${padX}px`

      hatch.appendChild(top)
      hatch.appendChild(bottom)
      hatch.appendChild(left)
      hatch.appendChild(right)
      pageEl.appendChild(hatch)

      const isOversize = height > pageHeight || width > pageWidth
      if (isOversize) {
        pageBreak.classList.add('rm-oversize-page')
        pageBreak.dataset.rmOversize = 'true'
        pageBreak.dataset.rmOversizeRatio = `${Math.max(
          height / pageHeight,
          width / pageWidth
        ).toFixed(2)}`
      } else {
        pageBreak.classList.remove('rm-oversize-page')
        delete pageBreak.dataset.rmOversize
        delete pageBreak.dataset.rmOversizeRatio
      }
    } else {
      const rawPageHeight =
        typeof options.pageHeight === 'number' ? options.pageHeight : pageBreak.clientHeight || 1000
      const rawPageWidth =
        typeof options.pageWidth === 'number' ? options.pageWidth : pageBreak.clientWidth || 800
      const pageHeight = Math.max(1, Number.isFinite(rawPageHeight) ? rawPageHeight : 1000)
      const pageWidth = Math.max(1, Number.isFinite(rawPageWidth) ? rawPageWidth : 800)
      const isOversize = height > pageHeight || width > pageWidth
      if (isOversize) {
        pageBreak.classList.add('rm-oversize-page')
        pageBreak.dataset.rmOversize = 'true'
        pageBreak.dataset.rmOversizeRatio = `${Math.max(
          height / pageHeight,
          width / pageWidth
        ).toFixed(2)}`
      } else {
        pageBreak.classList.remove('rm-oversize-page')
        delete pageBreak.dataset.rmOversize
        delete pageBreak.dataset.rmOversizeRatio
      }
    }
  })

  editor.storage.PaginationPlus.pagesToIgnore = pagesToIgnore
    ; (editor.storage.PaginationPlus as any)._lastIgnoreSignature = signature
}

const syncPageBreakComponents = (
  editor: Editor,
  options: CustomPaginationOptions,
  mountedComponents: Map<HTMLElement, MountedComponent>
) => {
  if (editor.isDestroyed) return
  let editorEl: HTMLElement | null = null
  try {
    editorEl = editor.view.dom as HTMLElement
  } catch (e) {
    return
  }
  if (!editorEl) return

  const headers = Array.from(editorEl.querySelectorAll<HTMLElement>('.rm-page-break .rm-page-header'))
  const firstHeader = editorEl.querySelector<HTMLElement>('.rm-first-page-header')

  const getOrCreateContainer = (target: HTMLElement) => {
    let container = target.querySelector<HTMLElement>('.custom-page-break')
    if (!container) {
      container = document.createElement('div')
      container.className = 'custom-page-break'
      target.appendChild(container)
    }
    return container
  }

  const mountComponent = (container: HTMLElement, props: Record<string, any>) => {
    const existing = mountedComponents.get(container)
    if (existing && arePropsEqual(existing.props, props)) return

    if (existing) {
      destroyComponent(existing.instance)
      mountedComponents.delete(container)
    }

    const instance = mount(PageBreakComponent, {
      target: container,
      props
    })

    mountedComponents.set(container, { instance, container, props })
  }

  headers.forEach((header) => {
    const pageBreak = header.closest<HTMLElement>('.rm-page-break')
    const footer = pageBreak?.querySelector<HTMLElement>('.rm-page-footer')
    const headerHeight = header?.clientHeight || 0
    const footerHeight = footer?.clientHeight || 0
    const container = getOrCreateContainer(header)

    mountComponent(container, {
      __editor: editor,
      __pageHeight: options.pageHeight,
      __pageWidth: options.pageWidth,
      __headerHeight: headerHeight,
      __footerHeight: footerHeight,
      __gap: options.pageGap
    })
  })

  if (firstHeader) {
    const container = getOrCreateContainer(firstHeader)
    mountComponent(container, {
      __editor: editor,
      __pageHeight: options.pageHeight,
      __pageWidth: options.pageWidth,
      __headerHeight: 0,
      __footerHeight: 0,
      __gap: options.pageGap
    })
  }

  mountedComponents.forEach((entry, container) => {
    if (!editorEl.contains(container)) {
      destroyComponent(entry.instance)
      mountedComponents.delete(container)
    }
  })
}

export const CustomPaginationExtension = BasePaginationPlus.extend<CustomPaginationOptions>({
  name: 'PaginationPlus',

  addOptions() {
    return {
      ...(this.parent?.() ?? {}),
      enabled: true,
      pagesToIgnore: null,
      hiddenPages: [],
      nodeViewsToIgnoreClassList: DEFAULT_NODE_VIEWS_TO_IGNORE,
      enableCustomPageBreak: true
    }
  },

  addStorage() {
    return {
      ...(this.parent?.() ?? {}),
      enabled: this.options.enabled ?? true,
      pagesToIgnore: this.options.pagesToIgnore ?? null,
      hiddenPages: this.options.hiddenPages ?? []
    }
  },

  addCommands() {
    return {
      ...(this.parent?.() ?? {}),

      updateMargins: (margins) => ({ editor, dispatch }) => {

        editor.chain().focus()
          // .updatePageHeight(1000)
          // .updatePageWidth(600)
          // .updateMargins({ top: 30, bottom: 30, left: 60, right: 60 })
          .updateHeaderContent('Document Title', 'Page {page}')
          .updateFooterContent('Confidential', 'Page {page} of {total}')
          .run()

        return true

        // 1. Update the local extension options
        this.options.marginTop = margins.top;
        this.options.marginBottom = margins.bottom;
        this.options.marginLeft = margins.left;
        this.options.marginRight = margins.right;

        console.log("updateMarginsupdateMargins", { margins })
          // 2. Optional: If the base PaginationPlus uses storage for margins, update it too
          // editor.storage.PaginationPlus.marginTop = margins.top; 

          // 3. Set a flag to force recalculation in your plugin's view update
          ; (editor.storage.PaginationPlus as any)._forceRecalc = true;

        // 4. Dispatch a "do-nothing" transaction to trigger the plugin's 'update' method
        if (dispatch) {
          try {
            if (editor.view) editor.view.dispatch(editor.state.tr);
          } catch (e) {
            // ignore
          }
        }
        console.log("updateMarginsupdateMargins", { margins, editor })


        return true;
      },

      /* updateMargins: (margins) => ({ editor, dispatch }) => {
        // 1. Update the extension's options
        this.options.marginTop = margins.top;
        this.options.marginBottom = margins.bottom;
        this.options.marginLeft = margins.left;
        this.options.marginRight = margins.right;

        // 2. IMPORTANT: Force the base plugin to acknowledge the new options
        // Most pagination plugins store a reference to options in their internal state
        if (editor.storage.PaginationPlus) {
          editor.storage.PaginationPlus.marginTop = margins.top;
          editor.storage.PaginationPlus.marginBottom = margins.bottom;
          editor.storage.PaginationPlus.marginLeft = margins.left;
          editor.storage.PaginationPlus.marginRight = margins.right;
        }

        // 3. Set your force flag for your custom logic
        (editor.storage.PaginationPlus as any)._forceRecalc = true;

        if (dispatch) {
          // 4. Create a transaction and metadata
          const tr = editor.state.tr;

          // This 'meta' call is often what tells the pagination plugin to re-run
          // its heavy calculation loop (the 'requestAnimationFrame' part)
          tr.setMeta('PaginationPlus', {
            type: 'recalculate',
            margins
          });

          editor.view.dispatch(tr);

          // 5. Force a DOM update for the Svelte components
          // Sometimes the PM transaction isn't enough to trigger the View's 'update' 
          // if the document content hasn't changed.
          setTimeout(() => {
            if (!editor.isDestroyed) {
              // Manually call your internal scheduleSync
              // You may need to expose scheduleSync or trigger it via a CustomEvent
              editor.commands.updatePagination(true);
            }
          }, 10);
        }

        return true;
      }, */

      enablePagination:
        (enabled: boolean) =>
          ({ editor }) => {
            if (editor.isDestroyed) return false
            try {
              if (!editor.view?.dom) return false
            } catch (e) {
              return false
            }

            const currentEnabled = editor.storage?.PaginationPlus?.enabled
            if (currentEnabled === enabled && this.options.enabled === enabled) {
              setPaginationVisibility(editor.view.dom, enabled)
              return true
            }
            this.options.enabled = enabled
            editor.storage.PaginationPlus.enabled = enabled
            setPaginationVisibility(editor.view.dom, enabled)
            editor.view.dispatch(editor.state.tr)
            return true
          },
      updatePagination:
        (enablePagination?: boolean) =>
          ({ editor }) => {
            if (editor.isDestroyed) return false
            try {
              if (!editor.view?.dom) return false
            } catch (e) {
              return false
            }

            const enabled = enablePagination ?? editor.storage.PaginationPlus.enabled ?? true
            const currentEnabled = editor.storage?.PaginationPlus?.enabled
            const forceRecalc = Boolean((editor.storage.PaginationPlus as any)?._forceRecalc)
            if (!forceRecalc && currentEnabled === enabled && this.options.enabled === enabled) {
              setPaginationVisibility(editor.view.dom, enabled)
              return true
            }
            if (forceRecalc) {
              delete (editor.storage.PaginationPlus as any)._forceRecalc
            }
            this.options.enabled = enabled
            editor.storage.PaginationPlus.enabled = enabled
            setPaginationVisibility(editor.view.dom, enabled)
            editor.view.dispatch(editor.state.tr)
            return true
          },
      getAllNodePageIndexes:
        (nodeViewWrapperClassList: string[] = []) =>
          ({ editor }) => {
            return getAllNodePageIndexes(editor, nodeViewWrapperClassList)
          }
    }
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? []
    const editor = this.editor
    const mountedComponents = new Map<HTMLElement, MountedComponent>()
    let scheduled = false

    const scheduleSync = () => {
      if (scheduled) return
      scheduled = true

      requestAnimationFrame(() => {
        scheduled = false

        if (editor.isDestroyed) return
        let editorEl: HTMLElement | null = null
        try {
          editorEl = editor.view.dom as HTMLElement
        } catch (e) {
          return
        }
        if (!editorEl) return

        const enabled = this.options.enabled !== false && editor.storage?.PaginationPlus?.enabled !== false

        setPaginationVisibility(editorEl, enabled)

        if (!enabled) {
          editor.storage.PaginationPlus.pagesToIgnore = null
          mountedComponents.forEach((entry) => destroyComponent(entry.instance))
          mountedComponents.clear()
          return
        }

        if (this.options.enableCustomPageBreak !== false) {
          syncPageBreakComponents(editor, this.options, mountedComponents)
        }

        applyNodeViewIgnoreStyles(editor, this.options)
      })
    }

    return [
      ...parentPlugins,
      new Plugin({
        key: CUSTOM_PAGINATION_PLUGIN_KEY,
        view: () => {
          scheduleSync()
          return {
            update: () => scheduleSync(),
            destroy: () => {
              mountedComponents.forEach((entry) => destroyComponent(entry.instance))
              mountedComponents.clear()
            }
          }
        }
      })
    ]
  }
})

export const PaginationPlus = CustomPaginationExtension
