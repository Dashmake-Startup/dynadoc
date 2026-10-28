// Copyright (C) 2024 Dashmake Inc.
//
// This file is part of DDoc Office.
//
// DDoc Office is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// DDoc Office is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.


// import { _$_documentEditorsList, _$_documentEditorStorePath } from '../stores/editor.store'
import { Node as ProseMirrorNode, Schema, DOMParser as PMDOMParser } from 'prosemirror-model'


import { DragHandle } from '@tiptap/extension-drag-handle'
import Collaboration, { isChangeOrigin } from '@tiptap/extension-collaboration'
import { TextStyle, FontSize, FontFamily, TextStyleKit } from '@tiptap/extension-text-style'
// Superscript/Subscript handled via CustomTextStyleExtension
import TableOfContents from '@tiptap/extension-table-of-contents'
// import Highlight from '@tiptap/extension-highlight'
import { StarterKit } from '@tiptap/starter-kit'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextSelection, Plugin } from 'prosemirror-state'
import InvisibleCharacters from '@tiptap/extension-invisible-characters'
import { generateUniqueIds, UniqueID } from '@tiptap/extension-unique-id'
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details'
import { debounce } from 'lodash'
import { Extension } from '@tiptap/core'
import MarkdownIt from 'markdown-it'

import { CustomSnapshotExtension } from '../extensions/tiptap/CustomSnapshotExtension'
import { CustomWordCommentExtension } from '../extensions/tiptap/CustomWordCommentExtension/CustomWordCommentExtension'
import { CustomSpotlightExtension } from '../extensions/tiptap/CustomSpotlightExtension'
// import {
// CustomProgrammingStyleCommentExtension,
// CustomProgrammingStyleCommentExtensionCommentNode,
// CustomProgrammingStyleCommentExtensionCommentMark
// } from '../extensions/tiptap/CustomProgrammingStyleCommentExtension'
import {
  CustomSecuredContentExtension
  // CustomSecuredContentExtensionCommentNode,
  // CustomSecuredContentExtensionCommentMark
} from '../extensions/tiptap/CustomSecuredContentExtension/CustomSecuredContentExtension'
// import { CustomMonacoCodeBlockExtension } from '../extensions/tiptap/CustomMonacoCodeBlockExtension'
import {
  CustomBibliographyExtension,
  CustomCitationExtension
} from '../extensions/tiptap/CustomCitationExtension/CustomCitationExtension'
import { CustomExcelTableExtension } from '../extensions/tiptap/CustomExcelTableExtension/CustomExcelTableExtension.svelte'
import { CustomFormFieldExtension } from '../extensions/tiptap/CustomFormFieldExtension/CustomFormFieldExtension.svelte'
import { CustomDocumentRestrictionExtension } from '../extensions/tiptap/CustomDocumentRestrictionExtension/CustomDocumentRestrictionExtension.svelte'
// import { CustomPDFTagExtension } from '../extensions/tiptap/CustomPDFTagExtension DELETE/CustomPDFTagExtension.svelte'
import { CustomVarExtension } from '../extensions/tiptap/CustomVarExtension/CustomVarExtension.svelte'
// import { CustomPageExtension } from '../extensions/tiptap/CustomPageExtension/CustomPageExtension.svelte'
import { CustomMonacoCodeBlockExtension } from '../extensions/tiptap/CustomMonacoCodeBlockExtension/CustomMonacoCodeBlockExtension'
import { CustomAIExtension } from '../extensions/tiptap/CustomAIExtension/CustomAIExtension.svelte'
import { ListItem } from '@tiptap/extension-list-item'
import { TaskItem } from '@tiptap/extension-task-item'
import { CustomBulletList, CustomListItem, CustomOrderedListAutoContinue, CustomTaskList } from '../extensions/tiptap/CustomListStyleExtension/CustomListStyleExtension'
import { CustomReviewExtension } from '../extensions/tiptap/CustomReviewExtension/CustomReviewExtension.svelte'
import {
  CustomFileTagExtension,
  CustomFolderTagExtension
} from '../extensions/tiptap/CustomFileFolderExtension/CustomFileFolderExtension.svelte'
import { CustomFileExtensionProps, CustomFolderExtensionProps } from '../extensions/tiptap/CustomFileFolderExtension/utils/common.utils'
import { CustomFileIncludeExtension } from '../extensions/tiptap/CustomFileIncludeExtension/CustomFileIncludeExtension.svelte'
import { CustomFileIncludeExtensionProps } from '../extensions/tiptap/CustomFileIncludeExtension/utils/common.utils'
import { CustomProgrammingStyleCommentExtension } from '../extensions/tiptap/CustomProgrammingStyleCommentExtension/CustomProgrammingStyleCommentExtension'
import { CustomDiv, PreserveParagraph } from '../extensions/tiptap/CustomHtmlAttributesExtension'
import { CustomTextStyleExtension } from '../extensions/tiptap/CustomTextStyleExtension/CustomTextStyleExtension'
// import ImageEditor from '../../../common/image/ImageEditor.svelte'
import { CustomSlideExtension } from '../extensions/tiptap/CustomSlideExtension/CustomSlideExtension.svelte'
import { CustomSlideExtensionProps } from '../extensions/tiptap/CustomSlideExtension/utils/common.utils'
import { CustomLatexProjectExtension } from '../extensions/tiptap/CustomLatexProjectExtension/CustomLatexProjectExtension.svelte'
import { CustomLatexProjectExtensionProps } from '../extensions/tiptap/CustomLatexProjectExtension/utils/common.utils'
import { CustomMermaidExtension } from '../extensions/tiptap/CustomMermaidExtension/CustomMermaidExtension.svelte'
import { CustomMermaidExtensionProps } from '../extensions/tiptap/CustomMermaidExtension/utils/common.utils'
import { CustomSpreadsheetExtension } from '../extensions/tiptap/CustomSpreadsheetExtension/CustomSpreadsheetExtension.svelte'
import { CustomChartExtension } from '../extensions/tiptap/CustomChartExtension/CustomChartExtension.svelte'
import { CustomSpreadsheetExtensionProps } from '../extensions/tiptap/CustomSpreadsheetExtension/utils/common.utils'
import { CustomChartExtensionProps } from '../extensions/tiptap/CustomChartExtension/utils/common.utils'
import { CustomDesignExtensionProps } from '../extensions/tiptap/CustomDesignExtension/utils/common.utils'
import { CustomInlineCanvasExtensionProps } from '../extensions/tiptap/CustomInlineCanvasExtension/utils/common.utils'
// import { CharacterCount } from '../extensions/tiptap/CustomDocumentRestrictionExtension/tiptap-offiicial-character-countcter-count'
import { Dropcursor, Gapcursor, Placeholder, Selection } from '@tiptap/extensions'
import CodeBlock from '@tiptap/extension-code-block'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common as lowlightCommon } from 'lowlight'

// Single shared instance — createLowlight(all) loads ~190 grammars; instantiating it twice bloats the bundle.
// Starts with the ~40-language "common" subset so syntax highlighting still works immediately, then
// upgrades to the full grammar set in the background — the other ~150 grammars must not sit on the
// first-render critical path for plain text documents.
let _sharedLowlight: ReturnType<typeof createLowlight> | null = null
try {
  _sharedLowlight = createLowlight(lowlightCommon)
  import('lowlight').then(({ all }) => _sharedLowlight?.register(all))
} catch (err) {
  console.error('[lowlight] init failed — syntax highlighting disabled:', err)
}
import { CustomFontSizeExtension } from '../extensions/tiptap/CustomTextStyleExtension/CustomTextStyleExtension'
// import { _$_translationSyncController } from '../extensions/tiptap/CustomTranslationExtension/stores/translationSync.store
import BubbleMenu from '@tiptap/extension-bubble-menu'
import { CustomLineParagraphSpacingExtension } from '../extensions/tiptap/CustomLineParagraphSpacingExtension/CustomLineParagraphSpacingExtension'
import { CustomDummyContentExtension } from '../extensions/tiptap/CustomDummyContentExtension/CustomDummyContentExtension'

// import {
//   PaginationPlus,
//   PAGE_SIZES,
// } from '../extensions/tiptap/tiptap-pagination-plus/src/index'

import {
  PaginationPlus,
  // PAGE_SIZES
}
  from '../extensions/tiptap/CustomPaginationExtension/CustomPaginationExtension'
// from 'tiptap-pagination-plus'
import CustomPageBreakExtension from '../extensions/tiptap/CustomPaginationExtension/CustomPageBreakExtension'
import CustomPageSpacerExtension from '../extensions/tiptap/CustomPaginationExtension/CustomPageSpacerExtension'
import CustomLinkExtension from '../extensions/tiptap/CustomLinkExtension/CustomLinkExtension'


import {
  PaginationTable
  // TablePlus
} from '../extensions/tiptap/tiptap-table-plus/src/index'

import {
  CustomTagExtension,
  CustomNodeManipulationCommand,
  CustomScriptTag,
  CustomStyleTag
} from '../extensions/tiptap/CustomCustomTagExtension'
import ImageResizeWithCaption from '../extensions/tiptap/tiptap-extension-figure/src/index'
import EditorHelpers from './EditorHelpers';
import { CustomWebviewExtension } from '../extensions/tiptap/CustomWebviewExtension/CustomWebviewExtension';
import { CustomImageExtension } from '../extensions/tiptap/CustomImageExtension/CustomImageExtension';
import { CustomDesignExtension } from '../extensions/tiptap/CustomDesignExtension/CustomDesignExtension';
import { CustomInlineCanvasExtension } from '../extensions/tiptap/CustomInlineCanvasExtension/CustomInlineCanvasExtension';
import type { PaginationPlusOptions } from '../extensions/tiptap/utils/common.utils';
import { CustomDynamicReferenceNodeExtension } from '../extensions/tiptap/CustomDynamicReferenceNodeExtension/CustomDynamicReferenceNodeExtension.svelte';
import { CustomSlashCommandExtension } from '../extensions/tiptap/CustomSlashCommandExtension/CustomSlashCommandExtension.svelte';
import { getSchema } from '@tiptap/core';
import { CustomGrammarCheckExtension } from '../extensions/tiptap/CustomGrammarCheckExtension/CustomGrammarCheckExtension';
import { CustomSurveyExtension } from '../extensions/tiptap/CustomSurveyExtension/CustomSurveyExtension';
import { CustomGalleryExtension } from '../extensions/tiptap/CustomGalleryExtension/CustomGalleryExtension';
import { TableCell, TableKit } from '@tiptap/extension-table';
import { CustomTableExtension } from '../extensions/tiptap/CustomTableExtension/CustomTableExtension';
import { CustomPasteOptionsExtension } from '../extensions/tiptap/CustomPasteOptionsExtension/CustomPasteOptionsExtension';
import { CustomDeleteWarningExtension } from '../extensions/tiptap/CustomDeleteWarningExtension/CustomDeleteWarningExtension';
import { CustomHtmlCommentExtension } from '../extensions/tiptap/CustomHtmlCommentExtension/CustomHtmlCommentExtension'
import { CustomHtmlStyleExtension } from '../extensions/tiptap/CustomHtmlStyleExtension/CustomHtmlStyleExtension'
import { CustomInternalLinkExtension } from '../extensions/tiptap/CustomInternalLinkExtension'
// import { CustomFolderExtensionProps } from '../extensions/tiptap/CustomFileFolderExtension/utils/common.utils'
// import { CustomTranslationSyncExtension } from '../extensions/tiptap/CustomTranslationExtension/CustomTranslationExtension.svelte';

const looksLikeMarkdown = (text: string): boolean => {
  if (!text) return false
  const trimmed = text.trim()
  if (!trimmed) return false
  const patterns = [
    /^#{1,6}\s/m,
    /```/m,
    /^\s*[-*+]\s+/m,
    /^\s*\d+\.\s+/m,
    /\*\*[^*]+\*\*/,
    /__[^_]+__/,
    /`[^`]+`/,
    /\[.+\]\(.+\)/,
    /^>\s+/m
  ]
  return patterns.some((pattern) => pattern.test(trimmed))
}

const MarkdownPasteExtension = Extension.create({
  name: 'markdownPaste',
  addProseMirrorPlugins() {
    const editor = this.editor
    const md = new MarkdownIt({ html: false, linkify: true, breaks: true })
    return [
      new Plugin({
        props: {
          handlePaste(_view, event) {
            if (event?.defaultPrevented) return false
            if (editor.isActive('codeBlock') || editor.isActive('code')) return false
            const clipboard = event?.clipboardData
            if (!clipboard) return false
            const html = clipboard.getData('text/html') || ''
            const text = clipboard.getData('text/plain') || ''
            if (!text) return false
            if (html && /<[^>]+>/.test(html)) return false
            if (!looksLikeMarkdown(text)) return false
            const rendered = md.render(text)
            if (!rendered.trim()) return false
            editor.commands.insertContent(rendered, { parseOptions: { preserveWhitespace: false } })
            return true
          }
        }
      })
    ]
  }
})

export default class EditorExtensionHelpers {

  public static getMainWysiwygCollaborationExtensionCurrentUser(rand?: number) {
    // rand =  Math.floor(Math.random() * 100)
    rand = rand || Math.floor(Math.random() * 100)
    // Multi-user setup
    const _collaborationExtensionCurrentUser = {
      id: Math.random().toString(36).slice(2),
      name: 'Anonymous' + rand,
      // name: 'Anonymous' + Math.floor(Math.random() * 100),
      color: '#' + Math.floor(Math.random() * 16777215).toString(16)
    }

    return _collaborationExtensionCurrentUser
  }


  /**
   * Generates a schema from extensions without creating an editor instance.
   * Extremely memory efficient for Yjs seeding.
   */
  /* public static getHeadlessSchema(editorId: string): Schema {
    const extensions = this.getMainWysiwygExtensions(
      undefined, // No DOM container needed
      undefined,
      '',
      null,
      null,
      editorId
    );

    // Tiptap's ExtensionManager can resolve the schema for us
    const manager = new ExtensionManager(extensions);
    return new Schema({
      nodes: manager.nodes,
      marks: manager.marks,
    });
  } */

  /**
   * Generates a schema from extensions without creating an editor instance.
   */
  public static getHeadlessSchema(editorId: string): Schema {
    const extensions = EditorExtensionHelpers.getMainWysiwygExtensions(
      undefined,
      undefined,
      '',
      null,
      null,
      editorId,
      undefined,
      { includeHeavy: true }
    );

    // This is the correct, exported way to get the ProseMirror schema
    return getSchema(extensions);
  }



  public static getMainWysiwygExtensions(_editorContainer?: HTMLElement,
    _editorContainerRoot?: HTMLElement, placeholder?: string, _paginationOptions?: PaginationPlusOptions,
    _paginationImpactedExtensionOptions?, editorId: string,
    _collaborationExtensionProvider?, options: { includeHeavy?: boolean } = {}) {
    const tocUpdate = debounce((anchors) => {
      // anchors = [{ id, level, content, … }, …]
      console.log('TOC updated', anchors)
    }, 300)

    const includeHeavy = options.includeHeavy !== false

    const extensions = [
      // StarterKit,
      StarterKit.configure({
        history: false,
        codeBlock: false, // disable default code block
        bold: false,
        italic: false,
        strike: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        taskList: false,
        taskItem: false,
        paragraph: false
      }),

      CustomHtmlCommentExtension,  // handles <!-- --> and /* css */
      CustomHtmlStyleExtension,    // handles <style> blocks + inline style/class attrs

      MarkdownPasteExtension,
      PreserveParagraph,
      // Placeholder.configure({
      //   placeholder: placeholder,
      // }),
      ...(placeholder ? [Placeholder.configure({
        placeholder: placeholder,
      })] : []),

      CustomDeleteWarningExtension,

      CustomSlashCommandExtension,

      // CustomScriptTag, // To allow script tags
      // CustomStyleTag, // To allow style tags
      // Color.configure({ types: [TextStyle.name, ListItem.name], defaultColor: 'black' }),
      // TextStyle.configure({ types: [ListItem.name] }),
      // FontFamily,
      // FontSize,
      // ListKit,
      CustomBulletList,
      CustomOrderedListAutoContinue,
      CustomListItem,
      // ListItem,
      CustomTaskList,
      TaskItem,
      TextStyleKit.configure({
        textStyle: false
      }),
      /* DragHandle.configure({
        render: () => {
          const element = document.createElement('div')

          // Use as a hook for CSS to insert an icon
          element.classList.add('custom-drag-handle')

          return element
        },
      }), */

      DragHandle.configure({
        // Optional: Customise the HTML node used as the handle
        render: () => {
          const handle = document.createElement('div')
          handle.className = 'custom-drag-handle-ui'
          handle.innerHTML = '⋮⋮' // Or insert an icon here via custom SVG / classes
          return handle
        },
        // Optional: Adjust position settings handled via floating-ui internally
        computePositionConfig: {
          placement: 'left-start',
          // strategy: 'absolute',
          strategy: 'fixed',
        },
        // allowedContainers: [],

        // Optional: Enable dragging for elements nested inside Lists, Blockquotes, etc.
        nested: true
      }),
      CustomTextStyleExtension,
      CustomLinkExtension,
      CustomInlineCanvasExtension,
      // Color.configure({
      //   types: ['textStyle'],
      // }),
      // Highlight,
      Highlight.configure({
        multicolor: true,
      }),
      CustomFontSizeExtension,
      // CustomFontSizeExtension.configure({ step: 2, defaultSize: '14px' }),

      // Color.configure({ types: [TextStyle.name, ListItem.name] }),
      //         TextStyle.configure({ types: [ListItem.name] }),
      // Highlight,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),

      UniqueID.configure({
        attributeName: EditorHelpers.uuidAttributeName,
        // attributeName: 'uuid',
        // types: ['heading', 'paragraph']
        // types: allNodeTypes
        types: [
          'paragraph',
          'heading',
          'table',
          CustomFileExtensionProps.name,
          CustomFolderExtensionProps.name,
          CustomFileIncludeExtensionProps.name,
          CustomSpreadsheetExtensionProps.name,
          CustomChartExtensionProps.name,
          CustomSlideExtensionProps.name,
          CustomDesignExtensionProps.name,
          CustomInlineCanvasExtensionProps.name,
          CustomLatexProjectExtensionProps.name,
          CustomMermaidExtensionProps.name
        ],
        // types: ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem'],
        filterTransaction: (transaction) => transaction.docChanged && !isChangeOrigin(transaction)
        /* filterTransaction: tx => {
  // allow user actions
  if (tx.getMeta('uiEvent') === 'paste') return true;
  if (tx.getMeta('uiEvent') === 'input') return true;
  
  // allow direct insert commands
  if (!isChangeOrigin(tx)) return true;
  
  return false;
  } */
      }),

      /* CustomPaginationExtension.configure({
            pageHeight: 1056, // default height of the page
            pageWidth: 816, // default width of the page
            pageMargin: 96, // default margin of the page
            label: 'Page', // default Page,
            showPageNumber: true // default true,
          }), */
      /*  PaginationExtension.configure({
            defaultPaperSize: 'A3',
            pageAmendmentOptions: {
              enableHeader: false,
              enableFooter: false
            }
          }),
  
          PageNode,
          HeaderFooterNode,
          BodyNode, */
      /* Focus.configure({
        className: 'focus',
      }), */

      TableOfContents.configure({
        anchorTypes: ['heading'],
        onUpdate: tocUpdate
      }),

      // ...(_paginationOptions ? [PaginationPlus.configure(_paginationOptions)] : []),

      ...(_paginationOptions && _paginationOptions.enabled !== false ? [
        PaginationPlus.configure(_paginationOptions)

        /* PaginationPlus.configure({
          pageHeight: 800,        // Height of each page in pixels
          pageWidth: 789,         // Width of each page in pixels
          pageGap: 50,            // Gap between pages in pixels
          pageGapBorderSize: 1,   // Border size for page gaps
          pageGapBorderColor: "#e5e5e5", // Border color for page gaps
          pageBreakBackground: "#ffffff",  // Background color for page gaps
          footerRight: "Made with ❤️ by Romik",  // Custom HTML content to display in the footer right side
          footerLeft: "<p><strong>Contact Me :</strong><br>dev.romikmakavana@gmail.com</p>",         // Custom HTML content to display in the footer left side
          headerRight: "Page {page}",        // Custom HTML content to display in the header right side
          headerLeft: "<h1>Tiptap Pagination Plus</h1><p>by Romik Makavana</p>",         // Custom HTML content to display in the header left side
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
        }), */
      ] : []),

      // CustomPageSpacerExtension,
      ...(_paginationOptions && _paginationOptions.enabled !== false ? [CustomPageBreakExtension] : []),

      /*PaginationPlus.configure(
        _paginationOptions
         {
        // pageHeight: 800, // Height of each page in pixels
        // pageWidth: 789, // Width of each page in pixels
        pageHeight: PAGE_SIZES.A4.pageHeight, // Height of each page in pixels
        pageWidth: PAGE_SIZES.A4.pageWidth, // Width of each page in pixels
        pageGap: 10, // Gap between pages in pixels
        pageGapBorderSize: 1, // Border size for page gaps
        pageGapBorderColor: 'transparent', // Border color for page gaps
        pageBreakBackground: 'rgb(29 35 42)', // Background color for page gaps
        footerRight: 'Made with ❤️ by Romik', // Custom HTML content to display in the footer right side
        footerLeft: '<p><strong>Contact Me :</strong><br>dev.romikmakavana@gmail.com</p>', // Custom HTML content to display in the footer left side
        headerRight: 'Page {page}', // Custom HTML content to display in the header right side
        headerLeft: '<h1>Tiptap Pagination Plus</h1><p>by Romik Makavana</p>', // Custom HTML content to display in the header left side
        marginTop: 20, // Top margin for pages
        marginBottom: 20, // Bottom margin for pages
        marginLeft: 50, // Left margin for pages
        marginRight: 50, // Right margin for pages
        contentMarginTop: 10, // Top margin for content within pages
        contentMarginBottom: 10 // Bottom margin for content within pages
      } 
      ),*/

      /* PaginationPlus.configure({
        pageHeight: 800, // Height of each page in pixels
        pageWidth: 789, // Width of each page in pixels
        pageGap: 5, // Gap between pages in pixels
        // pageGap: 50, // Gap between pages in pixels
        pageGapBorderSize: 1, // Border size for page gaps
        pageGapBorderColor: '#e5e5e5', // Border color for page gaps
        pageBreakBackground: '#ffffff', // Background color for page gaps
        pageHeaderHeight: 30, // Height of page header in pixels
        pageFooterHeight: 30, // Height of page footer in pixels
        footerRight: '{page}', // Custom text to display in the footer right side
        footerLeft: '', // Custom text to display in the footer left side
        headerRight: '', // Custom text to display in the header right side
        headerLeft: '', // Custom text to display in the header left side
        marginTop: 20, // Top margin for pages
        marginBottom: 20, // Bottom margin for pages
        marginLeft: 50, // Left margin for pages
        marginRight: 50, // Right margin for pages
        contentMarginTop: 10, // Top margin for content within pages
        contentMarginBottom: 10 // Bottom margin for content within pages
      }), */

      /* TableKit.configure({
       table: {
         resizable: true
       },
       tableCell: false
     }),
     // Default TableCell
     TableCell, */

      // PaginationPlus,
      /* TablePlus.configure({
        table: {
          resizable: true
        }
        /* resizeHandleStyle: {
          background: 'gray'
        } /
      }), */
      // PaginationTable.TablePlus,

      PaginationTable.TablePlus.configure({
        resizeHandleStyle: {
          background: 'gray'
        }
      }),
      /* CustomTableExtension.configure({
        resizeHandleStyle: {
          background: 'gray'
        }
      }), */
      PaginationTable.TableRowPlus,
      PaginationTable.TableCellPlus,
      PaginationTable.TableHeaderPlus,

      // CustomTableExtension,



      /*  CustomTranslationSyncExtension.configure({
        collaborationProvider: _collaborationExtensionProvider
      }),  */

      /* CustomTranslationSyncExtension.configure({
        role: 'original', // or 'translated'
        controller: _$_translationSyncController,
        filePath: __filePathToOpenFromDocument
      }), */


      CustomInternalLinkExtension.configure({
        /* onHoverIn: (event, fileId, rect) => {
          // Passes coordinates natively via mouse position or the text element client bounding box
          showPreview(fileId, event.clientX, event.clientY);
        },
        onHoverOut: () => {
          delayHidePreview();
        },
        onClick: (event, fileId) => {
          if (window.dynadocApp?.openFileInNewTab) {
            window.dynadocApp.openFileInNewTab(fileId);
          } else {
            console.log(`Opening file: ${fileId}`);
          }

        } */
      })
      ,
      CustomDummyContentExtension,
      CustomPasteOptionsExtension.configure({ editorId }),
      CustomLineParagraphSpacingExtension,
      CustomFormFieldExtension,
      CustomImageExtension,
      // CustomExcelTableExtension.configure({ editorId: editorId }),
      CustomVarExtension.configure({ editorId: editorId, ..._paginationImpactedExtensionOptions }),

      // Heavy nodeviews injected below when needed.
      CustomFileIncludeExtension,
      CustomFileTagExtension.configure(
        _paginationImpactedExtensionOptions
        /* {
        maxPageHeight:
          _paginationOptions.pageHeight -
          (_paginationOptions.marginBottom +
            _paginationOptions.marginTop +
            _paginationOptions.contentMarginTop +
            _paginationOptions.contentMarginBottom +
            (_paginationOptions.pageHeight * (12/100))), // Max Height of a file render viewport in pixels
            // 120), // Max Height of a file render viewport in pixels
        maxPageWidth:
          _paginationOptions.pageWidth -
          (_paginationOptions.marginLeft + _paginationOptions.marginRight), // Max Width of  of a file render viewport in pixels
        wysiwygEditorIdToUpdate: __wysiwygEditorId
      } */
      ),
      CustomFolderTagExtension.configure(_paginationImpactedExtensionOptions)
      // ]  : [])
      ,

      // PaginationPlus,
      // TablePlus,
      // TableRow,
      // TableCell,
      // TableHeader,

      CustomSnapshotExtension,
      CustomReviewExtension.configure({
        // toolbarHTMLContainerRoot: document.getElementById('status-bar')
        toolbarHTMLContainerRoot: _editorContainerRoot ?? null
      }),

      /* CustomDocumentRestrictionExtension.configure({
       toolbarHTMLContainerRoot: document.getElementById('status-bar-left'),
       editorId: editorId,
       pageHeight: _paginationOptions?.pageHeight

       // toolbarHTMLContainerRoot: document.getElementById('status-bar')
       // toolbarHTMLContainerRoot: _editorContainerRoot
     }), */
      // CustomPDFTagExtension,
      ...EditorHelpers.allowedCustomTags.map((tag) => CustomTagExtension(tag)), // add custom tags support like <var/>...

      CustomMonacoCodeBlockExtension,
      // CustomSurveyExtension.configure(_paginationImpactedExtensionOptions),

      ...(_editorContainerRoot
        ? [CustomAIExtension.configure({ toolbarHTMLContainerRoot: _editorContainerRoot })]
        : [CustomAIExtension]),
      CustomWordCommentExtension,

      CustomNodeManipulationCommand,

      /* CustomGrammarCheckExtension.configure({
        docKey: editorId,
        toolbarHTMLContainerRoot: document.getElementById('status-bar-left')
      }), */

      BubbleMenu.configure({
        element: document.querySelector('#bubble-menu-widget'),
        /*  shouldShow: ({ editor, view, state, oldState, from, to }) => {
          // only show the bubble menu for images and links
          // return editor.isActive('image') || editor.isActive('link')
        } */
        // shouldShow: ({ editor }) => {
        shouldShow: ({ editor, view, state, oldState, from, to }) => {
          // Hide bubble menu if ANY forbidden tag is active
          // return !EditorHelpers.bubbleNotAllowedTags.some((tag) => editor.isActive(tag))
          const { selection } = state
          // 1️⃣ Nothing selected → hide
          if (selection.empty) {
            return false
          }
          // const { from, to } = state.selection

          return !EditorHelpers.bubbleNotAllowedTags.some(
            (tag) =>
              editor.isActive(tag) ||
              editor.state.doc.nodesBetween(from, to, (node) => node.type.name === tag)
          )
        }
      }),

      // CustomCommentExtension,

      /* 
      npm install @tiptap/extension-bubble-menu
      npm install @tiptap/extension-text-style
      npm install @tiptap/extensions
      npm install @tiptap/extension-drag-handle
      npm install @tiptap/extension-file-handler
  npm install @tiptap/extension-floating-menu @floating-ui/dom@^1.6.0
  npm install @tiptap/extension-invisible-characters
  npm install @tiptap/extension-table-of-contents
  npm install @tiptap/extension-typography
  npm install @tiptap/extension-unique-id
  npm install @tiptap/extension-code-block
  npm install lowlight @tiptap/extension-code-block-lowlight
  npm install @tiptap/extension-details
  npm install @tiptap/extension-emoji
  npm install @tiptap/extension-hard-break
  npm install @tiptap/extension-image
  npm install @tiptap/extension-mathematics katex
  npm install @tiptap/extension-youtube
  
  Youtube.configure({
  inline: false,
  })
  
  Image.configure({
  resize: {
  enabled: true,
  directions: ['top', 'bottom', 'left', 'right'], // can be any direction or diagonal combination
  minWidth: 50,
  minHeight: 50,
  alwaysPreserveAspectRatio: true,
  }
  })
  
  import { Mathematics } from '@tiptap/extension-mathematics'
  
  const editor = new Editor({
  extensions: [
  Mathematics.configure({
    inlineOptions: {
      // optional options for the inline math node
    },
    blockOptions: {
      // optional options for the block math node
    },
    katexOptions: {
      // optional options for the KaTeX renderer
    },
  }),
  ],
  })
  
  Details, DetailsSummary, DetailsContent
  
  HardBreak.configure({
  HTMLAttributes: {
  class: 'my-custom-class',
  },
  })
  
  
  Emoji.configure({
  HTMLAttributes: {
  class: 'my-custom-class',
  },
  })
  
  Details.configure({
  persist: true,
  })
  
  Typography.configure({
    oneHalf: '1 / 2', // this will insert "1 / 2" instead of the default "½"
  }),
  
      BubbleMenu.configure({
    element: document.querySelector('.menu'),
  }),
  DragHandle.configure({
  render: () => {
  const element = document.createElement('div')
  
  // Use as a hook for CSS to insert an icon
  element.classList.add('custom-drag-handle')
  
  return element
  },
  })
  
  FileHandler.configure({
  onPaste: (editor, files, htmlContent) => {
  // do something with the files
  // and insert the file into the editor
  // in some cases (for example copy / pasted gifs from other apps) you should probably not use the file directly
  // as the file parser will only have a single gif frame as png
  // in this case, you can extract the url from the htmlContent and use it instead, let other inputRules handle insertion
  // or do anything else with the htmlContent pasted into here
  },
  })
  FileHandler.configure({
  onDrop: (editor, files, pos) => {
  // do something with the files
  // and insert the file into the editor
  },
  })
  
  FloatingMenu.configure({
    element: document.querySelector('.menu'),
  }),
  Focus.configure({
  className: 'focus',
  })
  TableOfContents.configure({
  anchorTypes: ['heading', 'customAnchorType'],
  })
  Blockquote.configure({
  HTMLAttributes: {
  class: 'my-custom-class',
  },
  })
  
  import { lowlight } from 'lowlight/lib/core'
  
  CodeBlockLowlight.configure({
  lowlight,
  })
  
      */
      // CharacterCount,
      // Dropcursor,
      // Gapcursor,
      InvisibleCharacters.configure({
        visible: false
      }),
      Selection.configure({
        className: 'selection'
      }),

      //
      ImageResizeWithCaption,
      /*  UniqueID.configure({
        attributeName: 'uid'
      }), */
      ...(_sharedLowlight
        ? [CodeBlockLowlight.configure({ lowlight: _sharedLowlight })]
        : [CodeBlock]),

      // Markdown
      // CustomPageExtension,
      // CustomUuidAttributeExtension,
      // CustomUuidIdentificationExtension,
      /* CustomUuidIdentificationExtension.configure({
        target: 'both',
        // ignoreInlineTypes: ['strong', 'em', 'link'],
        // ignoreChildren: true,
        regenerateOnPaste: true
      }), */
      // CustomProgrammingStyleCommentExtensionCommentNode,
      // CustomProgrammingStyleCommentExtensionCommentMark,
      CustomProgrammingStyleCommentExtension,

      // CustomSecuredContentExtensionCommentNode,
      // CustomSecuredContentExtensionCommentMark,
      CustomSecuredContentExtension.configure({
        protectionPaneHTMLContainerRoot: document.getElementById('document-protection-pane')
      }),

      CustomCitationExtension,
      CustomBibliographyExtension,
      CustomLatexProjectExtension.configure(_paginationImpactedExtensionOptions),
      CustomMermaidExtension,

      //editor.commands.setProgrammingStyleComment('This is a test comment')

      // CustomSpotlightExtension.configure({ initialMode: 'block' })

      //         const editor = new Editor({
      //   extensions: [Spotlight.configure({ initialMode: "block" })],
      // });

      // editor.commands.setSpotlightMode("inline"); // only inline
      // editor.commands.setSpotlightMode("both");   // block + inline
      // editor.commands.setSpotlightMode("off");    // disable

    ]

    // if (includeHeavy) {
    extensions.push(
      ...EditorExtensionHelpers.getHeavyWysiwygExtensions(
        _paginationImpactedExtensionOptions,
        editorId
      )
    )
    // }

    // This should be always the last extension because it calls constants from other custom extensions
    extensions.push(CustomDynamicReferenceNodeExtension.configure({ editorId: editorId }))


    /* const ClassPreserver = Extension.create({
      name: 'classPreserver',
      priority: 0, // Lowest priority to run last
      addGlobalAttributes() {
        return [{
          types: ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList'],
          attributes: {
            class: {
              default: null,
              parseHTML: el => el.getAttribute('class'),
              renderHTML: attrs => attrs.class ? { class: attrs.class } : {},
            }
          }
        }]
      }
    })

    // Then add ClassPreserver as the last item in your extensions array.
    extensions.push(ClassPreserver) */



    extensions.push(CustomDiv)


    return extensions
  }

  public static getMainWysiwygEditorProps() {
    return {
      attributes: {
        // Standard attributes to kill native checking
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
        // Specifically for Safari/Chrome's newer grammar engines
        'data-gramm': 'false',
      },
    }
  }

  public static getHeavyWysiwygExtensions(
    _paginationImpactedExtensionOptions?,
    editorId?: string
  ) {
    return [
      CustomWebviewExtension.configure(_paginationImpactedExtensionOptions),
      CustomGalleryExtension.configure(_paginationImpactedExtensionOptions),
      CustomSpreadsheetExtension.configure(_paginationImpactedExtensionOptions),
      CustomChartExtension.configure(_paginationImpactedExtensionOptions),
      CustomSlideExtension.configure(_paginationImpactedExtensionOptions),
      // CustomLatexProjectExtension,
      CustomDesignExtension.configure(_paginationImpactedExtensionOptions),
      CustomSurveyExtension.configure(_paginationImpactedExtensionOptions)
    ]
  }
  // public static getMainWysiwygExtensions1(_editorContainer?: HTMLDivElement,
  //   _editorContainerRoot?: HTMLDivElement, placeholder?: string, _paginationOptions?, _paginationImpactedExtensionOptions?) {
  //   return [
  //     // StarterKit,
  //     StarterKit.configure({
  //       history: false,
  //       codeBlock: false // disable default code block
  //     }),
  //     // Placeholder.configure({
  //     //   placeholder: placeholder,
  //     // }),
  //     ...(placeholder ? [Placeholder.configure({
  //       placeholder: placeholder,
  //     })] : []),


  //     // CustomScriptTag, // To allow script tags
  //     CustomStyleTag, // To allow style tags
  //     // Color.configure({ types: [TextStyle.name, ListItem.name], defaultColor: 'black' }),
  //     // TextStyle.configure({ types: [ListItem.name] }),
  //     FontFamily,
  //     FontSize,
  //     ListKit,
  //     TextStyleKit,
  //     Superscript,
  //     Subscript,
  //     // Highlight,
  //     Highlight.configure({
  //       multicolor: true,
  //     }),
  //     CustomFontSizeExtension,
  //     CustomWebviewExtension,
  //     // CustomFontSizeExtension.configure({ step: 2, defaultSize: '14px' }),

  //     // Color.configure({ types: [TextStyle.name, ListItem.name] }),
  //     //         TextStyle.configure({ types: [ListItem.name] }),
  //     // Highlight,
  //     TextAlign.configure({
  //       types: ['heading', 'paragraph']
  //     }),

  //     UniqueID.configure({
  //       attributeName: EditorHelpers.uuidAttributeName,
  //       // attributeName: 'uuid',
  //       // types: ['heading', 'paragraph']
  //       // types: allNodeTypes
  //       types: ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem'],
  //       filterTransaction: (transaction) => !isChangeOrigin(transaction)
  //       /* filterTransaction: tx => {
  // // allow user actions
  // if (tx.getMeta('uiEvent') === 'paste') return true;
  // if (tx.getMeta('uiEvent') === 'input') return true;

  // // allow direct insert commands
  // if (!isChangeOrigin(tx)) return true;

  // return false;
  // } */
  //     }),

  //     /* CustomPaginationExtension.configure({
  //           pageHeight: 1056, // default height of the page
  //           pageWidth: 816, // default width of the page
  //           pageMargin: 96, // default margin of the page
  //           label: 'Page', // default Page,
  //           showPageNumber: true // default true,
  //         }), */
  //     /*  PaginationExtension.configure({
  //           defaultPaperSize: 'A3',
  //           pageAmendmentOptions: {
  //             enableHeader: false,
  //             enableFooter: false
  //           }
  //         }),

  //         PageNode,
  //         HeaderFooterNode,
  //         BodyNode, */
  //     /* Focus.configure({
  //       className: 'focus',
  //     }), */

  //     TableOfContents.configure({
  //       anchorTypes: ['heading'],
  //       onUpdate(anchors) {
  //         // anchors = [{ id, level, content, … }, …]
  //         console.log('TOC updated', anchors)
  //       },
  //     }),

  //     ...(_paginationOptions ? [PaginationPlus.configure(_paginationOptions)] : []),

  //     /*PaginationPlus.configure(
  //       _paginationOptions
  //        {
  //       // pageHeight: 800, // Height of each page in pixels
  //       // pageWidth: 789, // Width of each page in pixels
  //       pageHeight: PAGE_SIZES.A4.pageHeight, // Height of each page in pixels
  //       pageWidth: PAGE_SIZES.A4.pageWidth, // Width of each page in pixels
  //       pageGap: 10, // Gap between pages in pixels
  //       pageGapBorderSize: 1, // Border size for page gaps
  //       pageGapBorderColor: 'transparent', // Border color for page gaps
  //       pageBreakBackground: 'rgb(29 35 42)', // Background color for page gaps
  //       footerRight: 'Made with ❤️ by Romik', // Custom HTML content to display in the footer right side
  //       footerLeft: '<p><strong>Contact Me :</strong><br>dev.romikmakavana@gmail.com</p>', // Custom HTML content to display in the footer left side
  //       headerRight: 'Page {page}', // Custom HTML content to display in the header right side
  //       headerLeft: '<h1>Tiptap Pagination Plus</h1><p>by Romik Makavana</p>', // Custom HTML content to display in the header left side
  //       marginTop: 20, // Top margin for pages
  //       marginBottom: 20, // Bottom margin for pages
  //       marginLeft: 50, // Left margin for pages
  //       marginRight: 50, // Right margin for pages
  //       contentMarginTop: 10, // Top margin for content within pages
  //       contentMarginBottom: 10 // Bottom margin for content within pages
  //     } 
  //     ),*/

  //     /* PaginationPlus.configure({
  //       pageHeight: 800, // Height of each page in pixels
  //       pageWidth: 789, // Width of each page in pixels
  //       pageGap: 5, // Gap between pages in pixels
  //       // pageGap: 50, // Gap between pages in pixels
  //       pageGapBorderSize: 1, // Border size for page gaps
  //       pageGapBorderColor: '#e5e5e5', // Border color for page gaps
  //       pageBreakBackground: '#ffffff', // Background color for page gaps
  //       pageHeaderHeight: 30, // Height of page header in pixels
  //       pageFooterHeight: 30, // Height of page footer in pixels
  //       footerRight: '{page}', // Custom text to display in the footer right side
  //       footerLeft: '', // Custom text to display in the footer left side
  //       headerRight: '', // Custom text to display in the header right side
  //       headerLeft: '', // Custom text to display in the header left side
  //       marginTop: 20, // Top margin for pages
  //       marginBottom: 20, // Bottom margin for pages
  //       marginLeft: 50, // Left margin for pages
  //       marginRight: 50, // Right margin for pages
  //       contentMarginTop: 10, // Top margin for content within pages
  //       contentMarginBottom: 10 // Bottom margin for content within pages
  //     }), */

  //     /*  TableKit.configure({
  //       table: {
  //         resizable: true
  //       },
  //       tableCell: false
  //     }),
  //     // Default TableCell
  //     TableCell, */

  //     // PaginationPlus,
  //     /* TablePlus.configure({
  //       table: {
  //         resizable: true
  //       }
  //       /* resizeHandleStyle: {
  //         background: 'gray'
  //       } /
  //     }), */
  //     // PaginationTable.TablePlus,
  //     PaginationTable.TablePlus.configure({
  //       resizeHandleStyle: {
  //         background: 'gray'
  //       }
  //     }),
  //     PaginationTable.TableRowPlus,
  //     PaginationTable.TableCellPlus,
  //     PaginationTable.TableHeaderPlus,



  //     /* CustomTranslationSyncExtension.configure({
  //       role: 'original', // or 'translated'
  //       controller: _$_translationSyncController,
  //       filePath: __filePathToOpenFromDocument
  //     }), */

  //     CustomDummyContentExtension,
  //     CustomLineParagraphSpacingExtension,
  //     CustomFormFieldExtension,
  //     CustomImageExtension,
  //     CustomExcelTableExtension,
  //     // CustomVarExtension,

  //     // ...(_paginationImpactedExtensionOptions ? [
  //     CustomSpreadsheetExtension.configure(_paginationImpactedExtensionOptions),


  //     CustomSlideExtension.configure(_paginationImpactedExtensionOptions),
  //     CustomDesignExtension.configure(_paginationImpactedExtensionOptions),
  //     CustomFileTagExtension.configure(
  //       _paginationImpactedExtensionOptions
  //       /* {
  //       maxPageHeight:
  //         _paginationOptions.pageHeight -
  //         (_paginationOptions.marginBottom +
  //           _paginationOptions.marginTop +
  //           _paginationOptions.contentMarginTop +
  //           _paginationOptions.contentMarginBottom +
  //           (_paginationOptions.pageHeight * (12/100))), // Max Height of a file render viewport in pixels
  //           // 120), // Max Height of a file render viewport in pixels
  //       maxPageWidth:
  //         _paginationOptions.pageWidth -
  //         (_paginationOptions.marginLeft + _paginationOptions.marginRight), // Max Width of  of a file render viewport in pixels
  //       wysiwygEditorIdToUpdate: __wysiwygEditorId
  //     } */
  //     ),
  //     CustomFolderTagExtension.configure(_paginationImpactedExtensionOptions)
  //     // ]  : [])
  //     ,

  //     // PaginationPlus,
  //     // TablePlus,
  //     // TableRow,
  //     // TableCell,
  //     // TableHeader,

  //     CustomSnapshotExtension,
  //     ...(_editorContainerRoot ? [CustomReviewExtension.configure({
  //       // toolbarHTMLContainerRoot: document.getElementById('status-bar')
  //       toolbarHTMLContainerRoot: _editorContainerRoot
  //     })] : []),

  //     CustomDocumentRestrictionExtension.configure({
  //       toolbarHTMLContainerRoot: document.getElementById('status-bar-left')
  //       // toolbarHTMLContainerRoot: document.getElementById('status-bar')
  //       // toolbarHTMLContainerRoot: _editorContainerRoot
  //     }),
  //     // CustomPDFTagExtension,
  //     ...EditorHelpers.allowedCustomTags.map((tag) => CustomTagExtension(tag)), // add custom tags support like <var/>...

  //     CustomMonacoCodeBlockExtension,

  //     CustomAIExtension,
  //     CustomCommentExtension,

  //     CustomNodeManipulationCommand,

  //     BubbleMenu.configure({
  //       element: document.querySelector('#bubble-menu-widget'),
  //       /*  shouldShow: ({ editor, view, state, oldState, from, to }) => {
  //         // only show the bubble menu for images and links
  //         // return editor.isActive('image') || editor.isActive('link')
  //       } */
  //       // shouldShow: ({ editor }) => {
  //       shouldShow: ({ editor, view, state, oldState, from, to }) => {
  //         // Hide bubble menu if ANY forbidden tag is active
  //         // return !EditorHelpers.bubbleNotAllowedTags.some((tag) => editor.isActive(tag))
  //         const { selection } = state
  //         // 1️⃣ Nothing selected → hide
  //         if (selection.empty) {
  //           return false
  //         }
  //         // const { from, to } = state.selection

  //         return !EditorHelpers.bubbleNotAllowedTags.some(
  //           (tag) =>
  //             editor.isActive(tag) ||
  //             editor.state.doc.nodesBetween(from, to, (node) => node.type.name === tag)
  //         )
  //       }
  //     }),

  //     // CustomCommentExtension,

  //     /* 
  //     npm install @tiptap/extension-bubble-menu
  //     npm install @tiptap/extension-text-style
  //     npm install @tiptap/extensions
  //     npm install @tiptap/extension-drag-handle
  //     npm install @tiptap/extension-file-handler
  // npm install @tiptap/extension-floating-menu @floating-ui/dom@^1.6.0
  // npm install @tiptap/extension-invisible-characters
  // npm install @tiptap/extension-table-of-contents
  // npm install @tiptap/extension-typography
  // npm install @tiptap/extension-unique-id
  // npm install @tiptap/extension-code-block
  // npm install lowlight @tiptap/extension-code-block-lowlight
  // npm install @tiptap/extension-details
  // npm install @tiptap/extension-emoji
  // npm install @tiptap/extension-hard-break
  // npm install @tiptap/extension-image
  // npm install @tiptap/extension-mathematics katex
  // npm install @tiptap/extension-youtube

  // Youtube.configure({
  // inline: false,
  // })

  // Image.configure({
  // resize: {
  // enabled: true,
  // directions: ['top', 'bottom', 'left', 'right'], // can be any direction or diagonal combination
  // minWidth: 50,
  // minHeight: 50,
  // alwaysPreserveAspectRatio: true,
  // }
  // })

  // import { Mathematics } from '@tiptap/extension-mathematics'

  // const editor = new Editor({
  // extensions: [
  // Mathematics.configure({
  //   inlineOptions: {
  //     // optional options for the inline math node
  //   },
  //   blockOptions: {
  //     // optional options for the block math node
  //   },
  //   katexOptions: {
  //     // optional options for the KaTeX renderer
  //   },
  // }),
  // ],
  // })

  // Details, DetailsSummary, DetailsContent

  // HardBreak.configure({
  // HTMLAttributes: {
  // class: 'my-custom-class',
  // },
  // })


  // Emoji.configure({
  // HTMLAttributes: {
  // class: 'my-custom-class',
  // },
  // })

  // Details.configure({
  // persist: true,
  // })

  // Typography.configure({
  //   oneHalf: '1 / 2', // this will insert "1 / 2" instead of the default "½"
  // }),

  //     BubbleMenu.configure({
  //   element: document.querySelector('.menu'),
  // }),
  // DragHandle.configure({
  // render: () => {
  // const element = document.createElement('div')

  // // Use as a hook for CSS to insert an icon
  // element.classList.add('custom-drag-handle')

  // return element
  // },
  // })

  // FileHandler.configure({
  // onPaste: (editor, files, htmlContent) => {
  // // do something with the files
  // // and insert the file into the editor
  // // in some cases (for example copy / pasted gifs from other apps) you should probably not use the file directly
  // // as the file parser will only have a single gif frame as png
  // // in this case, you can extract the url from the htmlContent and use it instead, let other inputRules handle insertion
  // // or do anything else with the htmlContent pasted into here
  // },
  // })
  // FileHandler.configure({
  // onDrop: (editor, files, pos) => {
  // // do something with the files
  // // and insert the file into the editor
  // },
  // })

  // FloatingMenu.configure({
  //   element: document.querySelector('.menu'),
  // }),
  // Focus.configure({
  // className: 'focus',
  // })
  // TableOfContents.configure({
  // anchorTypes: ['heading', 'customAnchorType'],
  // })
  // Blockquote.configure({
  // HTMLAttributes: {
  // class: 'my-custom-class',
  // },
  // })

  // import { lowlight } from 'lowlight/lib/core'

  // CodeBlockLowlight.configure({
  // lowlight,
  // })

  //     */
  //     // CharacterCount,
  //     // Dropcursor,
  //     // Gapcursor,
  //     InvisibleCharacters.configure({
  //       visible: false
  //     }),
  //     Selection.configure({
  //       className: 'selection'
  //     }),

  //     //
  //     ImageResizeWithCaption,
  //     /*  UniqueID.configure({
  //       attributeName: 'uid'
  //     }), */
  //     CodeBlock,

  //     // Markdown
  //     // CustomPageExtension,
  //     // CustomUuidAttributeExtension,
  //     // CustomUuidIdentificationExtension,
  //     /* CustomUuidIdentificationExtension.configure({
  //       target: 'both',
  //       // ignoreInlineTypes: ['strong', 'em', 'link'],
  //       // ignoreChildren: true,
  //       regenerateOnPaste: true
  //     }), */
  //     // CustomProgrammingStyleCommentExtensionCommentNode,
  //     // CustomProgrammingStyleCommentExtensionCommentMark,
  //     CustomProgrammingStyleCommentExtension,

  //     // CustomSecuredContentExtensionCommentNode,
  //     // CustomSecuredContentExtensionCommentMark,
  //     CustomSecuredContentExtension.configure({
  //       protectionPaneHTMLContainerRoot: document.getElementById('document-protection-pane')
  //     }),

  //     CustomCitationExtension,
  //     CustomBibliographyExtension
  //     //editor.commands.setProgrammingStyleComment('This is a test comment')

  //     // CustomSpotlightExtension.configure({ initialMode: 'block' })

  //     //         const editor = new Editor({
  //     //   extensions: [Spotlight.configure({ initialMode: "block" })],
  //     // });

  //     // editor.commands.setSpotlightMode("inline"); // only inline
  //     // editor.commands.setSpotlightMode("both");   // block + inline
  //     // editor.commands.setSpotlightMode("off");    // disable
  //   ]
  // }

  /**
 * Convert points (pt) to pixels (px)
 * MS Word uses pt (1pt = 1/72 inch)
 *
 * @param pt - value in points
 * @param dpi - dots per inch (default 96 for screens)
 */
  public static ptToPx(pt: number, dpi = 96): number {
    return (pt * dpi) / 72
  }

  public static centerAbsolute(
    parentW: number,
    parentH: number,
    childW: number,
    childH: number
  ) {
    return {
      left: (parentW - childW) / 2,
      top: (parentH - childH) / 2,
    }
  }



}
