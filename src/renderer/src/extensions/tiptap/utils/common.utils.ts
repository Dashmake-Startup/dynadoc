
import type { FooterClickEvent, FooterOptions, HeaderClickEvent, HeaderOptions, PageNumber, PageSize } from 'tiptap-pagination-plus';
import { PAGE_SIZES, type PaginationPlusOptions as _PaginationPlusOptions } from 'tiptap-pagination-plus';
// import { PAGE_SIZES, type PageSize } from '../tiptap-pagination-plus/src/constants'

// import { PAGE_SIZES } from "../tiptap-pagination-plus-v1.2.2/src";


export const GenericCustomExtensionProps = {
  tagAttributeId: 'id',
}

export interface PaginationPlusPageToIgnoreOptions {
  width: number
  height: number
}


export interface PaginationPlusOptions1 {
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
}



export interface PaginationPlusOptions extends _PaginationPlusOptions {
  /* pageHeight: number;
  pageWidth: number;
  pageGap: number;
  pageBreakBackground: string;
  pageGapBorderSize: number;
  footerRight: string;
  footerLeft: string;
  headerRight: string;
  headerLeft: string;
  customHeader: Record<PageNumber, HeaderOptions>;
  customFooter: Record<PageNumber, FooterOptions>;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  contentMarginTop: number;
  contentMarginBottom: number;
  pageGapBorderColor: string;
  onHeaderClick?: HeaderClickEvent;
  onFooterClick?: FooterClickEvent; */
  enabled: boolean;
  pagesToIgnore?: Map<number, PaginationPlusPageToIgnoreOptions> | null
  hiddenPages?: number[]
  pageOrder?: string[]
  nodeViewsToIgnoreClassList?: string[]
  enableCustomPageBreak?: boolean
  maxPageCount?: number
  minPageContentHeight?: number
}

/* export const defaultPaginationOptions: PaginationPlusOptions = {
  enabled: true, // to disable pagination
  // enabled: true, // to disable pagination
  // enabled:false, // to disable pagination
  pageHeight: 800,        // Height of each page in pixels
  pageWidth: 789,         // Width of each page in pixels
  pageGap: 10,            // Gap between pages in pixels
  pageGapBorderSize: 1,   // Border size for page gaps
  pageGapBorderColor: "#e5e5e5", // Border color for page gaps
  pageBreakBackground: "#ffffff",  // Background color for page gaps
  footerRight: "Made with ❤️ dynadoc",  // Custom HTML content to display in the footer right side
  // footerRight: "Made with ❤️ by Romik",  // Custom HTML content to display in the footer right side
  footerLeft: "<p><strong>Contact us</p>",         // Custom HTML content to display in the footer left side
  // footerLeft: "<p><strong>Contact Me :</strong><br>dev.romikmakavana@gmail.com</p>",         // Custom HTML content to display in the footer left side
  headerRight: "Page {page}",        // Custom HTML content to display in the header right side
  headerLeft: "<h1>Hey Header</h1><p>p here</p>",         // Custom HTML content to display in the header left side
  marginTop: 20,          // Top margin for pages
  marginBottom: 20,       // Bottom margin for pages
  marginLeft: 50,         // Left margin for pages
  marginRight: 50,        // Right margin for pages
  contentMarginTop: 10,   // Top margin for content within pages
  contentMarginBottom: 10, // Bottom margin for content within pages
  // Optional: Per-page header/footer customization
  customHeader: {
    2: { headerLeft: "Page 2 Header", headerRight: "Page {page}" }
  },
  customFooter: {
    3: { footerLeft: "Page 3 Footer", footerRight: "Page {page}" }
  },
  // Optional: Click callbacks
  onHeaderClick: ({ event, pageNumber }) => {
    console.log(`Header clicked on page ${pageNumber}`)
  },
  onFooterClick: ({ event, pageNumber }) => {
    console.log(`Footer clicked on page ${pageNumber}`)
  },
  hiddenPages: [],
  pageOrder: [],
  maxPageCount: 600,
  minPageContentHeight: 120
} */

export const defaultPaginationOptions: PaginationPlusOptions = {
  enabled: true, // to disable pagination
  // enabled: true, // to disable pagination
  // enabled:false, // to disable pagination
  // pageHeight: 800,        // Height of each page in pixels
  // pageWidth: 789,         // Width of each page in pixels
  pageHeight: PAGE_SIZES.A4.pageHeight, // Height of each page in pixels
  pageWidth: PAGE_SIZES.A4.pageWidth, // Width of each page in pixels

  pageGap: 10,            // Gap between pages in pixels, can be set to 0 for no gap
  pageGapBorderSize: 1,   // Border size for page gaps
  pageGapBorderColor: "#e5e5e5", // Border color for page gaps
  pageBreakBackground: "var(--color-base-100)",  // Background color for page gaps
  // pageBreakBackground: "bg-base-100",  // Background color for page gaps
  // pageBreakBackground: "#ffffff",  // Background color for page gaps
  footerRight: "",  // Custom HTML content to display in the footer right side
  // footerRight: "Made with ❤️ by Romik",  // Custom HTML content to display in the footer right side
  footerLeft: "",         // Custom HTML content to display in the footer left side
  // footerLeft: "<p><strong>Contact Me :</strong><br>dev.romikmakavana@gmail.com</p>",         // Custom HTML content to display in the footer left side
  headerRight: "{page}",        // Custom HTML content to display in the header right side
  headerLeft: "",         // Custom HTML content to display in the header left side
  marginTop: 20,          // Top margin for pages
  marginBottom: 20,       // Bottom margin for pages
  marginLeft: 50,         // Left margin for pages
  marginRight: 50,        // Right margin for pages
  contentMarginTop: 10,   // Top margin for content within pages
  contentMarginBottom: 10, // Bottom margin for content within pages
  // 3. Visual "Gap" between pages
      // pageGap: 20,
      // pageGapBorderColor: "#d1d1d1",
      // pageGapBorderSize: 1,
      // pageBreakBackground: "#f3f3f3", // Matches the "Desk" color

      // // 4. Headers/Footers (Optional)
      // headerLeft: "Dynadoc Confidential",
      // footerRight: "Page {pageNumber}",
  
  // Optional: Per-page header/footer customization
  // customHeader: {
  //   2: { headerLeft: "Page 2 Header", headerRight: "Page {page}" }
  // },
  // customFooter: {
  //   3: { footerLeft: "Page 3 Footer", footerRight: "Page {page}" }
  // },
  // Optional: Click callbacks
  onHeaderClick: ({ event, pageNumber }) => {
    console.log(`Header clicked on page ${pageNumber}`)
  },
  onFooterClick: ({ event, pageNumber }) => {
    console.log(`Footer clicked on page ${pageNumber}`)
  },
  hiddenPages: [],
  pageOrder: [],
  maxPageCount: 600,
  minPageContentHeight: 120,
}
export const defaultPaginationOptionsOld: PaginationPlusOptions1 = {
  enabled: true, // to disable pagination
  // enabled: true, // to disable pagination
  // enabled:false, // to disable pagination
  // pageHeight: 800, // Height of each page in pixels
  // pageWidth: 789, // Width of each page in pixels
  // pageHeight: 720, // Height of each page in pixels
  // pageWidth: 1280, // Width of each page in pixels
  pageHeight: PAGE_SIZES.A4.pageHeight, // Height of each page in pixels
  pageWidth: PAGE_SIZES.A4.pageWidth, // Width of each page in pixels
  pageGap: 10, // Gap between pages in pixels
  pageGapBorderSize: 1, // Border size for page gaps
  pageGapBorderColor: 'transparent', // Border color for page gaps
  pageBreakBackground: 'rgb(29 35 42)', // Background color for page gaps
  footerRight: 'Made with ❤️ by Helton', // Custom HTML content to display in the footer right side
  footerLeft: '<p><strong>Contact Me :</strong><br>dev.romikmakavana@gmail.com</p>', // Custom HTML content to display in the footer left side
  headerRight: 'Page {page}', // Custom HTML content to display in the header right side
  headerLeft: '<h1>Hey Header</h1><p>Welcome</p>', // Custom HTML content to display in the header left side
  // headerLeft: '<h1>Tiptap Pagination Plus</h1><p>by Romik Makavana</p>', // Custom HTML content to display in the header left side
  marginTop: 20, // Top margin for pages
  marginBottom: 20, // Bottom margin for pages
  marginLeft: 50, // Left margin for pages
  marginRight: 50, // Right margin for pages
  contentMarginTop: 10, // Top margin for content within pages
  contentMarginBottom: 10 // Bottom margin for content within pages
}

export const defaultDesignPaginationOptions: PaginationPlusOptions = { ...defaultPaginationOptions, enabled: false }
export const defaultSheetPaginationOptions: PaginationPlusOptions = { ...defaultPaginationOptions, enabled: false }
export const defaultSlidePaginationOptions: PaginationPlusOptions = {
  ...defaultPaginationOptions,
  pageWidth: 1920,
  pageHeight: 1080,
  enabled: true,
  pageGap: 0,
  marginTop: 0,
  marginBottom: 0,
  marginLeft: 0,
  marginRight: 0,
  contentMarginTop: 0,
  contentMarginBottom: 0
}

export function getPaginationImpactedExtensionOptions(_paginationOptions: PaginationPlusOptions, __wysiwygEditorId: string) {
  /* return {
    maxPageHeight: 100, maxPageWidth: 100,
    wysiwygEditorIdToUpdate: __wysiwygEditorId
  } */

  const result = {
    maxPageHeight:
      _paginationOptions.pageHeight -
      (_paginationOptions.marginBottom +
        _paginationOptions.marginTop +
        _paginationOptions.contentMarginTop +
        _paginationOptions.contentMarginBottom
        +
        // _paginationOptions.pageHeight * (2 / 100)
        _paginationOptions.pageHeight * (5 / 100)
        // _paginationOptions.pageHeight * (20 / 100)
      ), // Max Height of a file render viewport in pixels
    // 120), // Max Height of a file render viewport in pixels
    maxPageWidth:
      _paginationOptions.pageWidth -
      (_paginationOptions.marginLeft + _paginationOptions.marginRight), // Max Width of  of a file render viewport in pixels
    wysiwygEditorIdToUpdate: __wysiwygEditorId
  }

  console.log('_paginationOptions_paginationOptions getPaginationImpactedExtensionOptions:', { result, _paginationOptions })

  return result

  /* return {
    maxPageHeight:
      _paginationOptions.pageHeight -
      (_paginationOptions.marginBottom +
        _paginationOptions.marginTop +
        _paginationOptions.contentMarginTop +
        _paginationOptions.contentMarginBottom +
        _paginationOptions.pageHeight * (12 / 100)), // Max Height of a file render viewport in pixels
    // 120), // Max Height of a file render viewport in pixels
    maxPageWidth:
      _paginationOptions.pageWidth -
      (_paginationOptions.marginLeft + _paginationOptions.marginRight), // Max Width of  of a file render viewport in pixels
    wysiwygEditorIdToUpdate: __wysiwygEditorId
  } */
}
