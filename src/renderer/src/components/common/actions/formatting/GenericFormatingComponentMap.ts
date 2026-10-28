/* 
 Copyright (C) 2024 Dashmake Inc.

 This file is part of DDoc Office.

 DDoc Office is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 DDoc Office is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */

import GenericFormattingComponent from './GenericFormattingComponent.svelte'
import { fluentUIcons, spectrumIcons, svgIcons } from '../../icons/Icons'
import { _ as base_ } from 'svelte-i18n'

import { get } from 'svelte/store'
import { _$_documentEditorsList, _$_wysiwygEditorsList } from '../../../../stores/editor.store'
import Layout from '../../layout/layout'
import FontPicker from './FontPicker.svelte'
import type { Editor } from '@tiptap/core'
import TableGridSelector from '../../../app/ribbon/components/insert/table/TableGridSelector.svelte'
import { CustomVarExtension } from '../../../../extensions/tiptap/CustomVarExtension/CustomVarExtension.svelte'
import { CustomProgrammingStyleCommentExtension } from '../../../../extensions/tiptap/CustomProgrammingStyleCommentExtension/CustomProgrammingStyleCommentExtension'
import { CustomSecuredContentExtension } from '../../../../extensions/tiptap/CustomSecuredContentExtension/CustomSecuredContentExtension'
import { CustomAIExtensionProps } from '../../../../extensions/tiptap/CustomAIExtension/utils/common.utils'
import { CaseUIState } from '../../../../extensions/tiptap/CustomTextStyleExtension/utils/utils'
import Utils from '../../../../utils/Utils'
import { CustomDesignExtensionProps } from '../../../../extensions/tiptap/CustomDesignExtension/utils/common.utils'
import ColorSwitcher from '../../../../extensions/tiptap/CustomDesignExtension/components/toolBar/verticalToolBar/ColorSwitcher.svelte'
import EditorExtensionHelpers from '../../../../utils/EditorExtensionHelpers'
import ColorPicker from '../color/ColorPicker/ColorPicker.svelte'
import { ImageEditingTools } from '../../../../extensions/tiptap/CustomDesignExtension/utils/utils'
import { ShapeType } from '../../../../utils/canvas.utils'
import AddTranslationPicker from '../../../../extensions/tiptap/CustomTranslationExtension/components/AddTranslationPicker.svelte'
import ListTranslation from '../../../../extensions/tiptap/CustomTranslationExtension/components/ListTranslation.svelte'
import { openPrimarySearchPane } from '../../../../stores/search.store'
import { openTextInputModal } from '../../../../stores/textInputModal.store'
import { openAlertModal } from '../../../../stores/alertModal.store'
import {
  executeEditorCommand,
  GenericFormatingEditorCommands
} from './commands/GenericFormatingEditorCommands.svelte'
import type { GenericFormattingComponentType } from './types'
import ListStyleGallery from './list/ListStyleGallery.svelte'
import {
  CHART_TYPE_ORDER,
  getChartTypeLabel
} from '../../../../extensions/tiptap/CustomChartExtension/utils/chartDataBridge'

// import { fluentUIconSplitHorizontal } from '../../icons/Icons'
// import Copy from './Copy.svelte'

// const _ = (key: string) => key
// const t = get(base_)
// const t = base_
const _ = (key: string) => {
  try {
    return get(base_)(key)
  } catch {
    return key
  }
}

function openActiveDevFeatureModal(featureLabel: string, description?: string) {
  const title = _('In active development')
  const feature = featureLabel?.trim() ? featureLabel.trim() : _('This feature')
  const note = description?.trim() ? `\n\n${_('What this does')}: ${description.trim()}` : ''

  return openAlertModal({
    title,
    message: `${feature} ${_('is currently under active development and may not work as expected yet. We’re sorry about that.')}${note}`
  })
}

/* export type GenericFormattingComponentType = {
  component: ComponentType<SvelteComponent>
  // component: typeof GenericFormattingComponent
  props:() =>{
    __icon: string
    //__label: MessageFormatter
    __label: string
    __class?: string
    __layout?: keyof typeof Layout.LAYOUT_COMPONENTS
    // description: MessageFormatter
    __isActiveFunc?: Function,
    // isActive?: ()=>boolean,
    disabled?: boolean,
    __description: string,
    __onClick?: Function,
    __nodeOrMarkName?: string,
    __nodeOrMarkAttributes?: {},
    __selectData?: {},
  }
} */

// Define all buttons here
// export const GenericFormattingComponentMap = {
export const GenericFormattingComponentMap: Record<string, GenericFormattingComponentType> = {
  FormatPainter: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600  w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPaintBrush}</div>`,
      __label: _('Format Painter'),
      __description: _(
        'Format Painter — Copy formatting (font, size, color, styles) from one selection and apply it to another, without copying the text itself.'
      ),
      __onClick: () => {
        GenericFormatingEditorCommands.formatPainter()
      }
      // __disabled: true
    }
  },
  Copy: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600  w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentCopy}</div>`,
      __label: _('Copy'),
      __description: _(
        'Copy — Copy the current selection to the clipboard so you can paste it elsewhere without removing it from the document.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.copy()
      }
      // __onClick: () => { console.log("click"); GenericFormatingEditorCommands.bold() },
      // __disabled: true
    }
  },
  CopyAsText: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600  w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentCopy}</div>`,
      __label: _('Copy as Text'),
      __description: _(
        'Copy as Text — Paste-friendly copy that strips rich formatting, keeping only plain text content.'
      ),
      __keybinding: 'Shift+Cmd+C / Shift+Ctrl+C',
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.copyAsText()
      }
    }
  },
  Cut: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600  w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconCut}</div>`,
      __label: _('Cut'),
      __description: _(
        'Cut — Remove the selected content and place it on the clipboard so you can paste it somewhere else.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.cut()
      }
      // __disabled: true
    }
  },
  PasteSelect: {
    component: GenericFormattingComponent,
    // props: (props) => ({
    // props: (props: { __class: string }) => ({
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconClipboardPaste}</div>`,
      // __icon: `<div class="text-base-content-600  w-[20px] ${props?.__iconClass} max-w-[max-content]">${fluentUIcons.fluentUIconClipboardPaste}</div>`,
      __label: _('Paste'),
      __description: _(
        'Paste — Insert clipboard content at the cursor. Use options like “Keep Source Formatting” or “Match Destination” when available.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __nodeOrMarkName: 'bold',
      // __onClick: () => { GenericFormatingEditorCommands.bold() },
      __selectDataProps: {
        __items: [
          {
            __label: _('Keep Source Formatting'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconClipboardBrush}</div>`,
            __keybinding: 'Ctrl+Shift+A',
            __value: 'paste_keep_source_formatting',
            __onClick: () => GenericFormatingEditorCommands.paste()
          },
          {
            __label: _('Matching Current Format'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconClipboardNote}</div>`,
            __keybinding: 'Ctrl+Shift+A',
            __value: 'paste_matching_current_format',
            __onClick: () => GenericFormatingEditorCommands.paste()
          },
          {
            __label: _('Unformatted Text'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconClipboardLetter}</div>`,
            __keybinding: 'Ctrl+Shift+A',
            __value: 'paste_unformatted_text',
            __onClick: () => GenericFormatingEditorCommands.pasteAsText()
          },
          {
            __label: _('Paste as Reference'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconDocumentDataLink}</div>`,
            __keybinding: 'Ctrl+Alt+R',
            __value: 'paste_as_reference',
            __onClick: () => GenericFormatingEditorCommands.pasteAsReference()
          },
          {
            __label: _('Toogle Case'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconClipboardNote}</div>`,
            __keybinding: 'Ctrl+Shift+A',
            __value: 'paste_toogle_case',
            __onClick: () => GenericFormatingEditorCommands.pasteAsText()
          },
          {
            __separator: true
          },
          {
            __label: _('Paste Special'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconClipboardMore}</div>`,
            __keybinding: 'Ctrl+Shift+A',
            __value: 'paste_paste_special',
            __onClick: () => GenericFormatingEditorCommands.pasteAsText()
          },
          {
            __label: _('Set Default Paste'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconClipboardSettings}</div>`,
            __keybinding: 'Ctrl+Shift+A',
            __value: 'paste_set_default_paste',
            __onClick: () => GenericFormatingEditorCommands.paste()
          }
        ]
        // props
      }
    }
    // )
  },
  FontPicker: {
    component: FontPicker,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconFontDecrease}</div>`,
      __label: _(''),
      __description: _(
        'Font Picker — Pick font family and size for the current selection, with quick preview.'
      ),
      __layout: Layout.LAYOUT.COLUMN,
      __onOtherActions: {
        __onFontFamilyChanged: (fontFamily: string) => {
          GenericFormatingEditorCommands.setFontFamily(fontFamily)
        },
        __onFontHoverPreview: () => {},
        __onFontSizeChanged: (fontSize: number) => {
          GenericFormatingEditorCommands.setFontSize(`${EditorExtensionHelpers.ptToPx(fontSize)}px`)
        }
      }
    }
  },
  FontSizeDecrease: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconFontDecrease}</div>`,
      __label: _('Font Decrease'),
      __description: _(
        'Font Decrease — Decrease the font size of the selected text to fit more content or match surrounding paragraph styling.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.decreaseFontSize()
      }
      // __disabled: true
    }
  },
  FontSizeIncrease: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconFontIncrease}</div>`,
      __label: _('Font Increase'),
      __description: _(
        'Font Increase — Increase the font size of the selected text to improve readability or create visual hierarchy (headings vs body).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.increaseFontSize()
      }
      // __disabled: true
    }
  },
  TextClearFormatting: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextClearFormatting}</div>`,
      __label: _('Clear Formatting'),
      __description: _(
        'Clear Formatting — Remove direct formatting (bold/italic/colors/sizes) while keeping the text content intact.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.clearFormatting()
      }
      // __disabled: true
    }
  },
  TextClearAllFormatting: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextAllClearFormatting}</div>`,
      __label: _('Clear All Formatting'),
      __description: _(
        'Clear All Formatting — Reset the selection to clean, default styling (removes inline styles, marks, and overrides).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.clearAllFormatting()
      }
      // __disabled: true
    }
  },
  TextBold: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextBold}</div>`,
      __label: _('Bold'),
      __description: _(
        'Bold — Apply bold styling to emphasize key terms, headings, or important phrases.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __nodeOrMarkName: 'bold',
      __onClick: () => {
        GenericFormatingEditorCommands.bold()
      }
      // __disabled: true
    }
  },
  TextItalic: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextItalic}</div>`,
      __label: _('Italic'),
      __description: _(
        'Italic — Italicize text for subtle emphasis, titles, quotes, or foreign words.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __nodeOrMarkName: 'italic',
      // __disabled: true
      /* __isActiveFunc: () => {
        const activeDocumentEditor = get(_$_documentEditorsList.getActive()) // get active document editor
        if (!activeDocumentEditor) return false

        const wysiwygEditor = _$_wysiwygEditorsList.get(activeDocumentEditor.id)
        if (!wysiwygEditor) return false

        return wysiwygEditor.isActive('italic')
      }, */
      /* isActive: (() => {
        const activeDocumentEditor = get(_$_documentEditorsList.getActive()) // get active document editor
        if (!activeDocumentEditor) return false

        const wysiwygEditor = _$_wysiwygEditorsList.get(activeDocumentEditor.id)
        if (!wysiwygEditor) return false

        return wysiwygEditor.isActive('italic')
      })(), */

      __onClick: () => {
        GenericFormatingEditorCommands.italic()
      }
      /* __onClick: () => {
        const activeEditorStore = _$_documentEditorsList.getActive()
        // const activeEditor = _$_documentEditorsList.getActive()
        const activeEditor = get(activeEditorStore)
        // console.log('Yes italic')
        // console.log('Yes gre', activeEditor, _$_wysiwygEditorsList.getActive(), _$_wysiwygEditorsList.getList())
        _$_wysiwygEditorsList.getActive()?.chain().focus().toggleItalic().run()
      } */
    }
  },
  TextChangeCase: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextChangeCase}</div>`,
      __label: _(''),
      // __label: _('Change Case'),
      __description: _(
        'Change Case — Convert text casing (UPPERCASE, lowercase, Sentence case, Title Case) for consistent formatting.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __nodeOrMarkName: 'bold',
      // __onClick: () => { GenericFormatingEditorCommands.bold() },
      __selectDataProps: {
        __items: [
          // itemChildren: JSON.stringify([
          {
            __label: _('Sentence Case'),
            __keybinding: 'Ctrl+Shift+A',
            __value: 'text_change_case_sentence_case',
            // active: CaseUIState.isSentence(editor),
            __onClick: () => {
              GenericFormatingEditorCommands.changeCase()
            }
          },
          {
            __label: _('Lower Case'),
            __keybinding: 'Ctrl+Shift+A',
            __value: 'text_change_case_lower_case',
            __onClick: () => GenericFormatingEditorCommands.changeCaseLower()
          },
          {
            __label: _('Upper Case'),
            __keybinding: 'Ctrl+Shift+A',
            __value: 'text_change_case_upper_case',
            __onClick: () => GenericFormatingEditorCommands.changeCaseUpper()
          },
          {
            __label: _('Toogle Case'),
            __keybinding: 'Ctrl+Shift+A',
            __value: 'text_change_case_toggle_case',
            __onClick: () => GenericFormatingEditorCommands.changeCaseToggle()
          },
          {
            __label: _('Capitalize each word'),
            __keybinding: 'Ctrl+Shift+A',
            __value: 'text_change_case_capitalize_each_word',
            __onClick: () => GenericFormatingEditorCommands.changeCaseCapitalize()
          }
        ]
      }
    }
  },
  CharacterChange: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextChangeCase}</div>`,
      __label: _(''),
      // __label: _('Change Case'),
      __description: _(
        'Change Case — Convert text casing (UPPERCASE, lowercase, Sentence case, Title Case) for consistent formatting.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __nodeOrMarkName: 'bold',
      // __onClick: () => { GenericFormatingEditorCommands.bold() },
      __selectDataProps: {
        __items: [
          // __selectData: [
          /* {
           __label: _('Change Case'),
           __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTextChangeCase}</div>`,
           __keybinding: 'Ctrl+Shift+A',
           __value: 'text_change_case',
           __onClick: () => {
              // GenericFormatingEditorCommands.bold()
            },
            children: {
              __items: [
                // itemChildren: JSON.stringify([
                {
                 __label: _('Sentence Case'),
                 __keybinding: 'Ctrl+Shift+A',
                 __value: 'text_change_case_sentence_case',
                 __onClick: () => {
                    GenericFormatingEditorCommands.bold()
                  },
                },
                {
                 __label: _('Lower Case'),
                 __keybinding: 'Ctrl+Shift+A',
                 __value: 'text_change_case_lower_case'
                },
                {
                 __label: _('Upper Case'),
                 __keybinding: 'Ctrl+Shift+A',
                 __value: 'text_change_case_upper_case'
                },
                {
                 __label: _('Toogle Case'),
                 __keybinding: 'Ctrl+Shift+A',
                 __value: 'text_change_case_toggle_case'
                },
                {
                 __label: _('Capitalize each word'),
                 __keybinding: 'Ctrl+Shift+A',
                 __value: 'text_change_case_capitalize_each_word'
                }
              ]
            }
            // )
          }, */
          {
            __label: _('Enclose Characters'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTextChangeCase}</div>`,
            __keybinding: 'Ctrl+Shift+A',
            __value: 'enclose_characters'
          },
          {
            __label: _('Character Border'),
            //__icon: '<i class="ph-light ph-clipboard"></i>',
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTextChangeCase}</div>`,
            __keybinding: 'Ctrl+Shift+A',
            __value: 'character_border'
          }
        ]
      }
    }
  },
  TextUnderline: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600  w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextUnderline}</div>`,
      __label: _(''),
      // __label: _('Underline'),
      __description: _(
        'Underline — Underline text for emphasis or references (use sparingly for best readability).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __onClick: () => {
        // The primary part of the split button is a toggle; its menu keeps
        // the explicit underline style and colour choices.
        GenericFormatingEditorCommands.underline()
      },
      // __nodeOrMarkName: 'bold',
      // __onClick: () => { GenericFormatingEditorCommands.bold() },

      __selectDataProps: {
        __items: [
          {
            __label: `<span style="text-decoration: underline;">${_('Single underline')}</span>`,
            __value: 'underline-solid',
            __onClick: () => GenericFormatingEditorCommands._setUnderline('solid')
          },
          {
            __label: `<span style="text-decoration: underline double;">${_('Double underline')}</span>`,
            __value: 'underline-double',
            __onClick: () => GenericFormatingEditorCommands._setUnderline('double')
          },
          {
            __label: `<span style="text-decoration: underline solid 2px;">${_('Thick underline')}</span>`,
            __value: 'underline-thick',
            __onClick: () => GenericFormatingEditorCommands._setUnderline('thick')
          },
          {
            __label: `<span style="text-decoration: underline dotted;">${_('Dotted underline')}</span>`,
            __value: 'underline-dotted',
            __onClick: () => GenericFormatingEditorCommands._setUnderline('dotted')
          },
          {
            __label: `<span style="text-decoration: underline dashed;">${_('Dashed underline')}</span>`,
            __value: 'underline-dashed',
            __onClick: () => GenericFormatingEditorCommands._setUnderline('dashed')
          },
          {
            __label: `<span style="text-decoration: underline wavy;">${_('Wavy underline')}</span>`,
            __value: 'underline-wavy',
            __onClick: () => GenericFormatingEditorCommands._setUnderline('wavy')
          },
          {
            __separator: true
          },
          {
            __label: `<span style="text-decoration: underline; text-decoration-color: currentColor;">${_('Automatic underline color')}</span>`,
            __value: 'underline-color-automatic',
            __onClick: () => GenericFormatingEditorCommands.setUnderlineColor(null)
          },
          {
            __label: `<span style="color: #dc2626; text-decoration: underline;">${_('Red underline')}</span>`,
            __value: 'underline-color-red',
            __onClick: () => GenericFormatingEditorCommands.setUnderlineColor('#dc2626')
          },
          {
            __label: `<span style="color: #2563eb; text-decoration: underline;">${_('Blue underline')}</span>`,
            __value: 'underline-color-blue',
            __onClick: () => GenericFormatingEditorCommands.setUnderlineColor('#2563eb')
          },
          {
            __label: `<span style="color: #16a34a; text-decoration: underline;">${_('Green underline')}</span>`,
            __value: 'underline-color-green',
            __onClick: () => GenericFormatingEditorCommands.setUnderlineColor('#16a34a')
          }
        ]
      }
    }
  },
  TextStrikethrough: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextStrikethrough}</div>`,
      __label: _('Strikethrough'),
      __description: _(
        'Strikethrough — Strike through text to indicate removal, completion, or revision notes while keeping the original visible.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __nodeOrMarkName: 'strike',
      __onClick: () => {
        GenericFormatingEditorCommands.strike()
      }
    }
  },
  TextSuperscript: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextSuperscript}</div>`,
      __label: _('Superscript'),
      __description: _(
        'Superscript — Raise text above the baseline (useful for exponents and footnote markers).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __nodeOrMarkName: 'superscript',
      __onClick: () => {
        GenericFormatingEditorCommands.superscript()
      }
    }
  },
  TextSubscript: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextSubscript}</div>`,
      __label: _('Subscript'),
      __description: _(
        'Subscript — Lower text below the baseline (useful for chemical formulas and indices).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __nodeOrMarkName: 'subscript',
      // __onClick: () => { GenericFormatingEditorCommands.highlight('#ffa8a8') }
      __onClick: () => {
        GenericFormatingEditorCommands.subscript()
      }
    }
  },
  TextHighlight: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconHighlight}</div>`,
      __label: _('Highlight'),
      __description: _(
        'Highlight — Highlight selected text like a marker to draw attention during review, study, or collaboration.'
      ),
      // __layout: Layout.LAYOUT.ICON,
      __layout: Layout.LAYOUT.SELECT,

      // __nodeOrMarkName: 'highlight',
      // __onClick: () => { GenericFormatingEditorCommands.highlight() },
      __selectData: ColorPicker,
      __selectDataProps: {
        // __mode: 'highlight',
        __mode: 'highlight',

        __onSelect: (color: string) => {
          GenericFormatingEditorCommands.highlight(color)
        }
      }
    }
  },
  TextColorSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextColor}</div>`,
      __label: _('Color'),
      __description: _(
        'Color — Change color to improve hierarchy, categorize content, and make key information stand out.'
      ),
      __layout: Layout.LAYOUT.SELECT,

      // __nodeOrMarkName: 'highlight',
      // __onClick: () => { GenericFormatingEditorCommands.highlight() },
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'text',
        __onSelect: (color: string) => {
          GenericFormatingEditorCommands.textColor(color)
        }
      }
    }
  },

  DummyContentGenerator: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconWindowText}</div>`,
      __label: _('Dummy Content'),
      __description: _(
        'Dummy Content — Insert placeholder text for layout prototyping, template design, and spacing checks.'
      ),
      __layout: Layout.LAYOUT.ICON,
      // __nodeOrMarkName: 'highlight',
      __onClick: () => {
        GenericFormatingEditorCommands.insertDummyContent()
      }
    }
  },
  TextBullet: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextBulletList}</div>`,
      __label: _('Bullet'),
      __description: _(
        'Bullet — Start or toggle a bulleted list for highlights, checklists, and short points.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: ListStyleGallery,
      __selectDataProps: {
        __title: _('Bullet Library'),
        __compact: true,
        __items: [
          {
            __id: 'bullet_disc',
            __label: _('Disc'),
            __preview: { kind: 'bullet', style: 'disc' },
            __onClick: () => GenericFormatingEditorCommands.setBulletListStyle('disc', 'default')
          },
          {
            __id: 'bullet_circle',
            __label: _('Circle'),
            __preview: { kind: 'bullet', style: 'circle' },
            __onClick: () => GenericFormatingEditorCommands.setBulletListStyle('circle', 'default')
          },
          {
            __id: 'bullet_square',
            __label: _('Square'),
            __preview: { kind: 'bullet', style: 'square' },
            __onClick: () => GenericFormatingEditorCommands.setBulletListStyle('square', 'default')
          },
          {
            __id: 'bullet_dash',
            __label: _('Dash'),
            __preview: { kind: 'bullet', style: 'dash' },
            __onClick: () => GenericFormatingEditorCommands.setBulletListStyle('"– "', 'default')
          },
          {
            __id: 'bullet_tree',
            __label: _('Multilevel Tree'),
            __preview: { kind: 'bullet', style: 'disc' },
            __onClick: () => GenericFormatingEditorCommands.setBulletListStyle('disc', 'tree')
          },
          {
            __id: 'bullet_inside',
            __label: _('Inside'),
            __preview: { kind: 'bullet', style: 'disc' },
            __onClick: () =>
              GenericFormatingEditorCommands.setBulletListStyle('disc', 'default', 'inside')
          },
          {
            __id: 'bullet_outside',
            __label: _('Outside'),
            __preview: { kind: 'bullet', style: 'disc' },
            __onClick: () =>
              GenericFormatingEditorCommands.setBulletListStyle('disc', 'default', 'outside')
          }
        ]
      }
    }
  },
  TextNumberList: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextNumberListLtr}</div>`,
      __label: _('Number List'),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: ListStyleGallery,
      __selectDataProps: {
        __title: _('Numbering Library'),
        __compact: true,
        __items: [
          {
            __id: 'number_decimal',
            __label: _('1, 2, 3'),
            __preview: { kind: 'number', style: 'decimal' },
            __onClick: () =>
              GenericFormatingEditorCommands.setOrderedListStyle('decimal', 'decimal')
          },
          {
            __id: 'number_decimal_zero',
            __label: _('01, 02, 03'),
            __preview: { kind: 'number', style: 'decimal' },
            __onClick: () =>
              GenericFormatingEditorCommands.setOrderedListStyle('decimal-leading-zero', 'default')
          },
          {
            __id: 'number_upper_alpha',
            __label: _('A, B, C'),
            __preview: { kind: 'number', style: 'upper-alpha' },
            __onClick: () =>
              GenericFormatingEditorCommands.setOrderedListStyle('upper-alpha', 'default')
          },
          {
            __id: 'number_lower_alpha',
            __label: _('a, b, c'),
            __preview: { kind: 'number', style: 'lower-alpha' },
            __onClick: () =>
              GenericFormatingEditorCommands.setOrderedListStyle('lower-alpha', 'default')
          },
          {
            __id: 'number_upper_roman',
            __label: _('I, II, III'),
            __preview: { kind: 'number', style: 'upper-roman' },
            __onClick: () =>
              GenericFormatingEditorCommands.setOrderedListStyle('upper-roman', 'default')
          },
          {
            __id: 'number_lower_roman',
            __label: _('i, ii, iii'),
            __preview: { kind: 'number', style: 'lower-roman' },
            __onClick: () =>
              GenericFormatingEditorCommands.setOrderedListStyle('lower-roman', 'default')
          },
          {
            __id: 'number_legal',
            __label: _('Legal (1.1.1)'),
            __preview: { kind: 'legal', style: 'decimal' },
            __onClick: () => GenericFormatingEditorCommands.setOrderedListStyle('decimal', 'legal')
          },
          {
            __id: 'number_outline',
            __label: _('Multilevel Outline'),
            __preview: { kind: 'outline', style: 'upper-roman' },
            __onClick: () =>
              GenericFormatingEditorCommands.setOrderedListStyle('upper-roman', 'outline')
          },
          {
            __label: _('Restart Numbering'),
            __group: 'actions',
            __onClick: () => GenericFormatingEditorCommands.restartOrderedList()
          },
          {
            __label: _('Continue Numbering'),
            __group: 'actions',
            __onClick: () => GenericFormatingEditorCommands.continueOrderedList()
          },
          {
            __label: _('Continue from Previous List'),
            __group: 'actions',
            __onClick: () => GenericFormatingEditorCommands.continueOrderedListFromPrevious()
          },
          {
            __label: _('Start at...'),
            __group: 'actions',
            __onClick: async () => {
              const value = await openTextInputModal({
                title: _('Start at'),
                message: _('Enter the number to start from'),
                placeholder: '1',
                confirmText: _('Apply')
              })
              const parsed = Number.parseInt((value || '').toString(), 10)
              if (Number.isFinite(parsed)) {
                GenericFormatingEditorCommands.setOrderedListStart(parsed)
              }
            }
          }
        ]
      }
    }
  },
  TextBulletListTree: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextBulletListTree}</div>`,
      __label: _('Bullet List Tree'),
      __description: _(
        'Bullet List Tree — Start or toggle a bulleted list for highlights, checklists, and short points.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Tree (Disc → Circle → Square)'),
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextBulletListTree}</div>`,
            __value: 'tree_disc',
            __onClick: () => GenericFormatingEditorCommands.setBulletListStyle('disc', 'tree')
          },
          {
            __label: _('Tree (Circle → Square)'),
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextBulletListTree}</div>`,
            __value: 'tree_circle',
            __onClick: () => GenericFormatingEditorCommands.setBulletListStyle('circle', 'tree')
          },
          {
            __label: _('Tree (Square → Dash)'),
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextBulletListTree}</div>`,
            __value: 'tree_square',
            __onClick: () => GenericFormatingEditorCommands.setBulletListStyle('square', 'tree')
          }
        ]
      }
    }
  },
  TextControlList: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTaskListLtr}</div>`,
      __label: _('Control List'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Checkbox'),
            __value: 'task_checkbox',
            __onClick: () => GenericFormatingEditorCommands.setTaskListStyle('none', 'checkbox')
          },
          {
            __label: _('Checkbox (Compact)'),
            __value: 'task_checkbox_compact',
            __onClick: () =>
              GenericFormatingEditorCommands.setTaskListStyle('none', 'checkbox-compact')
          },
          {
            __label: _('Toggle List'),
            __value: 'task_toggle',
            __onClick: () => GenericFormatingEditorCommands.setTaskListStyle('none', 'toggle')
          },
          {
            __label: _('Progress List'),
            __value: 'task_progress',
            __onClick: () => GenericFormatingEditorCommands.setTaskListStyle('none', 'progress')
          }
        ]
      }
    }
  },
  TextIndentDecrease: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextIndentDecreaseLtr}</div>`,
      __label: _('Indent Decrease'),
      __description: _(
        'Indent Decrease — Decrease indentation to reduce nesting or return text to the previous level.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.outdent()
      }
    }
  },
  TextIndentIncrease: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextIndentIncreaseLtr}</div>`,
      __label: _('Indent Increase'),
      __description: _(
        'Indent Increase — Increase indentation to create hierarchy or nest list items under a parent point.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.indent()
      }
    }
  },
  TextParagraphDirection: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextParagraphDirection}</div>`,
      __label: _('Paragraph Direction'),
      __description: _(
        'ParagraphDirection — Toggle paragraph writing direction between left-to-right (LTR) and right-to-left (RTL). Useful for Arabic/Hebrew or mixed-language documents.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.toggleDirection()
      }
    }
  },
  TextParagraphDirectionLeft: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextParagraphDirectionLeft}</div>`,
      __label: _('Paragraph Direction Left'),
      __description: _(
        'ParagraphDirection Left — Set paragraph direction to LTR (left-to-right), recommended for most Latin-based languages.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.setDirectionLTR()
      }
    }
  },
  TextParagraphDirectionRight: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextParagraphDirectionRight}</div>`,
      __label: _('Paragraph Direction Right'),
      __description: _(
        'ParagraphDirection Right — Set paragraph direction to RTL (right-to-left), used for Arabic, Hebrew, and RTL layouts.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.setDirectionRTL()
      }
    }
  },
  ToggleInvisibleCharacters: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextParagraphDirection}</div>`,
      __label: _('Toggle Invisible Characters'),
      __description: _(
        'Toggle Invisible Characters — Show or hide formatting marks (spaces, tabs, line breaks) to debug layout and spacing issues.'
      ),
      __layout: Layout.LAYOUT.ICON,
      // __nodeOrMarkName: 'strike',
      __onClick: () => {
        GenericFormatingEditorCommands.toggleInvisibleCharacters()
      }
    }
  },
  TextAlignLeft: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextAlignLeft}</div>`,
      __label: _('Align Left'),
      __description: _(
        'Align Left — Align selected paragraph(s) to the left margin (recommended for most body text).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __nodeOrMarkAttributes: { textAlign: 'left' },
      __onClick: () => {
        GenericFormatingEditorCommands.alignLeft()
      }
    }
  },
  TextAlignRight: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextAlignRight}</div>`,
      __label: _('Align Right'),
      __description: _(
        'Align Right — Align selected paragraph(s) to the right margin; commonly used for signatures or side notes.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __nodeOrMarkAttributes: { textAlign: 'right' },
      __onClick: () => {
        GenericFormatingEditorCommands.alignRight()
      }
    }
  },
  TextAlignCenter: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextAlignCenter}</div>`,
      __label: _('Align Center'),
      __description: _(
        'Align Center — Center selected paragraph(s); useful for titles, cover pages, and captions.'
      ),
      __layout: Layout.LAYOUT.ICON,
      // __nodeOrMarkName: 'textAlign',
      __nodeOrMarkAttributes: { textAlign: 'center' },
      __onClick: () => {
        GenericFormatingEditorCommands.alignCenter()
      }
    }
  },
  TextAlignJustify: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextAlignJustify}</div>`,
      __label: _('Align Justify'),
      __description: _(
        'Align Justify — Justify paragraph(s) so text aligns on both margins for a clean, publication-style layout.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __nodeOrMarkAttributes: { textAlign: 'justify' },
      __onClick: () => {
        GenericFormatingEditorCommands.alignJustify()
      }
    }
  },
  TextAlignTop: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextDirection}</div>`,
      __label: _('Align Top'),
      __description: _(
        'Align Top — Align selected object(s) to the top edge for consistent vertical layout.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.alignTop()
      }
    }
  },
  TextAlignMiddle: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextDirection}</div>`,
      __label: _('Align Middle'),
      __description: _(
        'Align Middle — Align selected object(s) to the vertical center to balance layouts.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.alignMiddle()
      }
    }
  },
  TextAlignBottom: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextDirection}</div>`,
      __label: _('Align Bottom'),
      __description: _(
        'Align Bottom — Align selected object(s) to the bottom edge for consistent vertical layout.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.alignBottom()
      }
    }
  },
  TextWrap: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextWrap}</div>`,
      __label: _('Wrap Text'),
      __description: _(
        'Wrap Text — Wrap text around the selected object (image/shape) to create magazine-style layouts.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.wrapText()
      }
    }
  },
  TextWrapClip: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextWrap}</div>`,
      __label: _('Clip Text'),
      __description: _(
        'Clip Text — Clip overflowing content so only the area inside the object/frame is visible.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.clipText()
      }
    }
  },
  TextWrapOverflow: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextWrap}</div>`,
      __label: _('Overflow'),
      __description: _(
        'Overflow — Control what happens when content exceeds its container (clip, wrap, or show overflow depending on mode).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.unwrapText()
      }
    }
  },
  TextRotateUp: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextDirection}</div>`,
      __label: _('Rotate Up'),
      __description: _('Rotate Up — Rotate the selected object/image by a fixed increment.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.rotateTextUp()
      }
    }
  },
  TextRotateDown: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextDirection}</div>`,
      __label: _('Rotate Down'),
      __description: _('Rotate Down — Rotate the selected object/image by a fixed increment.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.rotateTextDown()
      }
    }
  },
  TextRotateNone: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextDirection}</div>`,
      __label: _('No Rotation'),
      __description: _(
        'No Rotation — Reset rotation so the selected object returns to 0° (upright).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.rotateTextNone()
      }
    }
  },
  TextLineSpacing: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextLineSpacing}</div>`,
      __label: '',
      // __label: _('Line Spacing'),
      __description: _(
        'Line Spacing — Adjust spacing to improve readability (line spacing, paragraph spacing, and layout rhythm).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __layout: Layout.LAYOUT.ICON,
      // __nodeOrMarkName: 'strike',
      // __onClick: () => { GenericFormatingEditorCommands.highlight() }
      __selectDataProps: {
        __items: [
          { __label: '1', __onClick: () => GenericFormatingEditorCommands.setLineSpacing(1) },
          { __label: '1,15', __onClick: () => GenericFormatingEditorCommands.setLineSpacing(1.15) },
          { __label: '1,5', __onClick: () => GenericFormatingEditorCommands.setLineSpacing(1.5) },
          { __label: '2', __onClick: () => GenericFormatingEditorCommands.setLineSpacing(2) },
          { __label: '2,5', __onClick: () => GenericFormatingEditorCommands.setLineSpacing(2.5) },
          {
            __label: '3',
            active: true,
            __onClick: () => GenericFormatingEditorCommands.setLineSpacing(3)
          },
          { type: '__separator' },
          {
            __label: _("Options d'interligne"),
            // __icon: 'i-carbon-settings',
            shortcut: 'Alt+Shift+O'
            //__onClick: () => openOptions()
          },
          { type: '__separator' },
          {
            __label: _("Ajouter de l'espace avant"),
            // __icon: 'i-carbon-row-insert',
            __onClick: () => GenericFormatingEditorCommands.addSpaceBefore()
          },
          {
            __label: _("Supprimer l'espace après"),
            // __icon: 'i-carbon-row-delete',
            __onClick: () => GenericFormatingEditorCommands.removeSpaceAfter()
          }
        ]
      }
    }
  },
  ParagraphSpacingSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextLineSpacing}</div>`,
      __label: _('Paragraph Spacing'),
      __description: _(
        'Paragraph Spacing — Adjust spacing to improve readability (line spacing, paragraph spacing, and layout rhythm).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Compact'),
            __onClick: () => GenericFormatingEditorCommands.setLineSpacing(1)
          },
          {
            __label: _('Standard'),
            __onClick: () => GenericFormatingEditorCommands.setLineSpacing(1.15)
          },
          {
            __label: _('Relaxed'),
            __onClick: () => GenericFormatingEditorCommands.setLineSpacing(1.5)
          },
          {
            __label: _('Double'),
            __onClick: () => GenericFormatingEditorCommands.setLineSpacing(2)
          }
        ]
      }
    }
  },
  ThemeSetSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconApps}</div>`,
      __label: _('Themes'),
      __description: _(
        'Themes — Apply a document theme (colors + fonts) to keep a consistent brand look across headings, charts, and UI elements.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Theme Neutral'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentTheme('neutral')
          },
          {
            __label: _('Theme Blue'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentTheme('blue')
          },
          {
            __label: _('Theme Emerald'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentTheme('emerald')
          },
          {
            __label: _('Theme Rose'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentTheme('rose')
          }
        ]
      }
    }
  },
  VisualEffectsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSparkle}</div>`,
      __label: _('Effects'),
      __description: _(
        'Effects — Apply visual effects (shadow, glow, blur) to selected objects to improve depth and emphasis.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Effects None'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentEffect('none')
          },
          {
            __label: _('Effects Subtle'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentEffect('subtle')
          },
          {
            __label: _('Effects Crisp'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentEffect('crisp')
          },
          {
            __label: _('Effects Shadow'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentEffect('shadow')
          }
        ]
      }
    }
  },
  TextSpecialLineIndent: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextFirstLine}</div>`,
      __label: _('Special Line Indent'),
      __description: _(
        'Special Line Indent — Increase indentation to create hierarchy or nest list items under a parent point.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.specialLineIndent()
      }
    }
  },
  BorderAll: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconBorderAll}</div>`,
      __label: _('Border'),
      __description: _(
        'Border — Add or modify borders to visually separate sections, tables, and callouts.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.setBordersAll()
      }
    }
  },
  ParagraphBgPaint: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPaintBucket}</div>`,
      // __label: _('Paragraph Background Paint'),
      // __label: `<div currentcolor>`,
      __label: ``,
      __description: _(
        'Paragraph Background Paint — Apply background shading behind paragraphs/blocks to create callouts and improve scannability.'
      ),
      // __layout: Layout.LAYOUT.ICON,
      __layout: Layout.LAYOUT.SELECT,

      // __nodeOrMarkName: 'highlight',
      // __onClick: () => { GenericFormatingEditorCommands.highlight() },
      __selectData: ColorPicker,
      __selectDataProps: {
        // __mode: 'highlight',
        __mode: 'background',
        __onSelect: (color: string) => {
          GenericFormatingEditorCommands.backgroundColor(color)
        }
      }
      // __nodeOrMarkName: 'strike',
      // __onClick: () => { GenericFormatingEditorCommands.highlight() }
    }
  },

  /* PasteSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconClipboardPaste}</div>`,
      __label: _('Paste'),
      __description: _('Paste — Insert clipboard content at the cursor. Use options like “Keep Source Formatting” or “Match Destination” when available.'),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: [
      ],
    }
  }, */

  TextSearch: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSearch}</div>`,
      __label: _('Search'),
      __description: _(
        'Search — Find content quickly across the document (and workspace when available), with optional replace and advanced filters.'
      ),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.search()
      },
      __selectData: []
    }
  },

  TextReplace: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconReplace}</div>`,
      __label: _('Replace'),
      __description: _(
        'Replace — Find and replace text to update repeated wording quickly, with optional advanced matching when available.'
      ),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.replace()
      },
      __selectData: []
    }
  },

  TextCursorSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconCursor}</div>`,
      __label: _('Select'),
      __description: _(
        'Select — Select content or objects based on the current tool/mode (useful for multi-editing and bulk changes).'
      ),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.selectCursorRange()
      },
      __selectData: []
    }
  },
  PageBreakSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSplitHorizontal}</div>`,
      __label: _('Page Break'),
      __description: _(
        'Page Break — Insert a hard page break so content after the cursor starts on a new page in print/PDF layouts.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => GenericFormatingEditorCommands.horizontalRule(),
      __selectDataProps: {
        __items: [
          {
            __label: _('Page Break'),
            __onClick: () => GenericFormatingEditorCommands.insertPageBreak()
          },
          {
            __label: _('Section Break'),
            __onClick: () => GenericFormatingEditorCommands.insertSectionBreak()
          },
          {
            __label: _('Add Page'),
            __onClick: () => GenericFormatingEditorCommands.insertBlankPage()
          }
        ]
      }
    }
  },

  BlankPageSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentOnePage}</div>`,
      __label: _('Blank Page'),
      __description: _(
        'Insert a new blank page — Insert a blank page at the cursor position to expand a document’s layout (useful for print-style docs).'
      ),
      __layout: Layout.LAYOUT.COLUMN,
      __onClick: () => GenericFormatingEditorCommands.insertBlankPage()
    }
  },

  CoverPageSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentOnePage}</div>`,
      __label: _('Cover Page'),
      __description: _(
        'Insert a cover page — Insert a pre-styled cover page template with title/author placeholders to standardize reports.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __direction: Layout.DIRECTION.VERTICAL,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Simple Cover'),
            __onClick: () => GenericFormatingEditorCommands.insertCoverPage('simple')
          },
          {
            __label: _('Confidential Cover'),
            __onClick: () => GenericFormatingEditorCommands.insertCoverPage('confidential')
          },
          {
            __label: _('Photo Cover'),
            __onClick: () => GenericFormatingEditorCommands.insertCoverPage('photo')
          }
        ]
      }
    }
  },

  PageNumberSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNumberSymbol}</div>`,
      __label: _('Page Number'),
      __description: _(
        'Insert page numbers — Start or toggle a numbered list for steps, procedures, or ranked items.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Current Position'),
            __onClick: () => GenericFormatingEditorCommands.insertPageNumberAtCursor()
          },
          {
            __label: _('Top of Page'),
            __onClick: () => GenericFormatingEditorCommands.insertPageNumberHeader()
          },
          {
            __label: _('Bottom of Page'),
            __onClick: () => GenericFormatingEditorCommands.insertPageNumberFooter()
          }
        ]
      }
    }
  },

  HeaderFooterSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentHeader}</div>`,
      __label: _('Header and Footer'),
      __description: _(
        'Edit headers and footers — Edit repeating header/footer content like titles, page numbers, and document metadata.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Edit Header'),
            __onClick: () => GenericFormatingEditorCommands.openHeaderOverlay()
          },
          {
            __label: _('Edit Footer'),
            __onClick: () => GenericFormatingEditorCommands.openFooterOverlay()
          },
          {
            __label: _('Open Header & Footer'),
            __onClick: () => GenericFormatingEditorCommands.openHeaderFooterOverlay()
          },
          { __separator: true },
          {
            __label: _('Remove Header'),
            __onClick: () => GenericFormatingEditorCommands.clearHeaderContent()
          },
          {
            __label: _('Remove Footer'),
            __onClick: () => GenericFormatingEditorCommands.clearFooterContent()
          }
        ]
      }
    }
  },

  BreaksSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSplitHorizontal}</div>`,
      __label: _('Breaks'),
      __description: _(
        'Insert breaks — Insert layout breaks (page/section/column) to control pagination, headers, and formatting boundaries.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Page Break'),
            __onClick: () => GenericFormatingEditorCommands.insertPageBreak()
          },
          {
            __label: _('Section Break'),
            __onClick: () => GenericFormatingEditorCommands.insertSectionBreak()
          },
          {
            __label: _('Blank Page'),
            __onClick: () => GenericFormatingEditorCommands.insertBlankPage()
          }
        ]
      }
    }
  },

  TableSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTable}</div>`,
      __label: _('Table'),
      __description: _(
        'Table — Insert or edit a table to organize information into rows and columns (great for comparisons and structured data).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectData: TableGridSelector,
      __selectDataProps: {
        __onSelection: (hoverRow, hoverCol, withHeader) => {
          console.log('__onSelection yessssssss', { hoverRow, hoverCol, withHeader })
          GenericFormatingEditorCommands.insertTable(hoverRow, hoverCol, withHeader)
        }
      }
      // __selectData: [],
    }
  },

  SlideSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconSlideTextEdit}</div>`,
      __label: _('Slide'),
      __description: _(
        'Insert a new slide or choose a layout — Add a new slide and choose a layout (title, two-column, image+text) to keep presentations consistent.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select ribbon-split-button',
      __selectDataProps: {
        __items: [
          // { __label: _('New Slide'), __onClick: () => { GenericFormatingEditorCommands.insertSlide({ }) }, },
          {
            __label: _('New Slide'),
            __onClick: () => {
              GenericFormatingEditorCommands.insertSlide({ slideWidth: 1280, slideHeight: 720 })
            }
          },

          // { __label: _('Title Slide'), __icon: fluentUIcons.fluentUIconPaddingTop, __onClick: () => GenericFormatingEditorCommands.slidePresetTitle() },
          // { __label: _('Content Slide'), __icon: fluentUIcons.fluentUIconTextBulletListLtr, __onClick: () => GenericFormatingEditorCommands.slidePresetBody() },
          // { __label: _('Two Columns'), __icon: fluentUIcons.fluentUIconColumnTriple, __onClick: () => GenericFormatingEditorCommands.slidePresetTwoColumn() },
          // { __divider: true },
          {
            __label: _('Duplicate Selected Slide'),
            __onClick: () => GenericFormatingEditorCommands.duplicateSlide()
          },
          {
            __label: _('Slides from Outline...'),
            __onClick: () => GenericFormatingEditorCommands.importOutline()
          }
        ]
      }
    }
  },
  SlidePresetSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSlideTextEdit}</div>`,
      __label: _('Slide Layout'),
      __description: _(
        'Slide Layout — Change the layout of the current slide (title, content, two-column, etc.) without recreating it.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Title Slide'),
            __onClick: () => GenericFormatingEditorCommands.slidePresetTitle()
          },
          {
            __label: _('Subtitle Slide'),
            __onClick: () => GenericFormatingEditorCommands.slidePresetSubtitle()
          },
          {
            __label: _('Body Slide'),
            __onClick: () => GenericFormatingEditorCommands.slidePresetBody()
          }
        ]
      }
    }
  },
  LatexProjectSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconMathFormula}</div>`,
      __label: _('LaTeX'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Insert Latex Project'),
            __onClick: () => GenericFormatingEditorCommands.insertLatexProject()
          },
          { __divider: true },
          {
            __label: _('Matrix Template'),
            __onClick: () => GenericFormatingEditorCommands.insertLatexMatrix()
          },
          {
            __label: _('Fraction/Root'),
            __onClick: () => GenericFormatingEditorCommands.insertLatexFraction()
          },
          {
            __label: _('Chemical Formula'),
            __onClick: () => GenericFormatingEditorCommands.insertLatexChemistry()
          }
        ]
      }
    }
  },
  MermaidSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${svgIcons.mermaid}</div>`,
      // __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconBranch}</div>`,
      __label: _('Mermaid'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Insert Diagram'),
            __onClick: () => GenericFormatingEditorCommands.insertMermaid()
          },
          {
            __label: _('Insert From File...'),
            __onClick: () => GenericFormatingEditorCommands.insertMermaidFromFile()
          }
        ]
      }
    }
  },
  GallerySelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableImage}</div>`,
      __label: _('Gallery'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Photo Grid (Auto)'),
            __onClick: async () => {
              await GenericFormatingEditorCommands.insertGallery()
            }
          },
          {
            __label: _('Carousel/Slider'),
            __onClick: () => GenericFormatingEditorCommands.insertGallery('carousel')
          },
          {
            __label: _('Justified Gallery'),
            __onClick: () => GenericFormatingEditorCommands.insertGallery('justified')
          },
          { __divider: true },
          {
            __label: _('Stock Images...'),
            __onClick: () => GenericFormatingEditorCommands.openStockLibrary()
          }
        ]
      }
    }
  },

  DesignSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconDesignIdeas}</div>`,
      __label: _('Design'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Generate Design Ideas'),
            __icon: fluentUIcons.fluentUIconSparkle,
            __onClick: () => GenericFormatingEditorCommands.triggerAIDesign()
          },
          { __divider: true },
          {
            __label: _('Professional Theme'),
            __onClick: () => GenericFormatingEditorCommands.setTheme('pro')
          },
          {
            __label: _('Academic Theme'),
            __onClick: () => GenericFormatingEditorCommands.setTheme('academic')
          },
          {
            __label: _('Dark Mode Theme'),
            __onClick: () => GenericFormatingEditorCommands.setTheme('dark')
          }
        ]
      }
    }
  },
  WorksheetSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconSpreadsheet}</div>`,
      __label: _('Worksheet'),
      __layout: Layout.LAYOUT.SELECT,
      // __selectData: TableGridSelector, // Uses your grid visualizer
      __selectDataProps: {
        // __onSelection: (rows, cols) => {
        //   GenericFormatingEditorCommands.insertSpreadsheet(rows, cols);
        // },
        __items: [
          { __divider: true },
          {
            __label: _('Insert New Excel Worksheet'),
            __onClick: () => GenericFormatingEditorCommands.insertSpreadsheet()
          },
          {
            __label: _('Insert existing Excel Worksheet'),
            __onClick: () => GenericFormatingEditorCommands.insertSpreadsheetFromImported()
          }
        ]
      }
    }
  },
  ChartSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconChart}</div>`,
      __label: _('Chart'),
      __description: _(
        'Chart from selection — Create a chart from selected data to visualize trends and comparisons (best for tables/spreadsheets).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: CHART_TYPE_ORDER.map((type) => ({
          __label: _(getChartTypeLabel(type)),
          __onClick: () => GenericFormatingEditorCommands.insertChartFromSelection(type)
        }))
      }
    }
  },

  // SlideSelect: {
  //   component: GenericFormattingComponent,
  //   props: {
  //     __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSlideTextEdit}</div>`,
  //     __label: _('Slide'),
  //     __description: _('Slide — Open slide tools for the current presentation (add slides, adjust layout, and manage slide structure).'),
  //     __layout: Layout.LAYOUT.ICON,
  //     __onClick: () => { GenericFormatingEditorCommands.insertSlide() },

  //     // __layout: Layout.LAYOUT.SELECT,
  //     /* __selectData: TableGridSelector,
  //     __selectDataProps: {
  //       __onSelection: (hoverRow, hoverCol, withHeader) => {
  //         console.log("__onSelection yessssssss", { hoverRow, hoverCol, withHeader })
  //         GenericFormatingEditorCommands.insertTable(hoverRow, hoverCol, withHeader)
  //       }
  //     }, */
  //     // __selectData: [],
  //   }
  // },
  // SlidePresetSelect: {
  //   component: GenericFormattingComponent,
  //   props: {
  //     __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSlideTextEdit}</div>`,
  //     __label: _('Slide Layout'),
  //     __description: _('Slide Layout — Change the layout of the current slide (title, content, two-column, etc.) without recreating it.'),
  //     __layout: Layout.LAYOUT.SELECT,
  //     __selectDataProps: {
  //       __items: [
  //         { __label: _('Title Slide'), __onClick: () => GenericFormatingEditorCommands.slidePresetTitle() },
  //         { __label: _('Subtitle Slide'), __onClick: () => GenericFormatingEditorCommands.slidePresetSubtitle() },
  //         { __label: _('Body Slide'), __onClick: () => GenericFormatingEditorCommands.slidePresetBody() }
  //       ]
  //     }
  //   }
  // },
  // LatexProjectSelect: {
  //   component: GenericFormattingComponent,
  //   props: {
  //     __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconMathFormula}</div>`,
  //     __label: _('LaTeX'),
  //     __description: _('LaTeX Project — Insert and manage a LaTeX project block (compile, preview, and keep the source tied to the document).'),
  //     __layout: Layout.LAYOUT.ICON,
  //     __onClick: () => { GenericFormatingEditorCommands.insertLatexProject() },
  //   }
  // },
  // GallerySelect: {
  //   component: GenericFormattingComponent,
  //   props: {
  //     __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTableImage}</div>`,
  //     __label: _('Gallery'),
  //     __description: _('Gallery — Browse and insert prebuilt styles, blocks, or templates (a quick way to apply consistent design).'),
  //     __layout: Layout.LAYOUT.ICON,
  //     // __onClick: () => { GenericFormatingEditorCommands.insertGallery() },
  //     __onClick: async () => { await GenericFormatingEditorCommands.insertGallery() },

  //     // __layout: Layout.LAYOUT.SELECT,
  //     /* __selectData: TableGridSelector,
  //     __selectDataProps: {
  //       __onSelection: (hoverRow, hoverCol, withHeader) => {
  //         console.log("__onSelection yessssssss", { hoverRow, hoverCol, withHeader })
  //         GenericFormatingEditorCommands.insertTable(hoverRow, hoverCol, withHeader)
  //       }
  //     }, */
  //     // __selectData: [],
  //   }
  // },

  // DesignSelect: {
  //   component: GenericFormattingComponent,
  //   props: {
  //     __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDesignIdeas}</div>`,
  //     __label: _('Design'),
  //     __description: _('Design — Open design tools for colors, styles, and layout controls to keep documents visually consistent.'),
  //     __layout: Layout.LAYOUT.ICON,
  //     __onClick: () => { GenericFormatingEditorCommands.insertDesign() },

  //   }
  // },
  // WorksheetSelect: {
  //   component: GenericFormattingComponent,
  //   props: {
  //     __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSpreadsheet}</div>`,
  //     __label: _('Worksheet'),
  //     __description: _('Worksheet — Switch to worksheet-level tools for spreadsheets (sheet options, structure, and calculation helpers).'),
  //     __layout: Layout.LAYOUT.ICON,
  //     __onClick: () => { GenericFormatingEditorCommands.insertSpreadsheet() },
  //     // __layout: Layout.LAYOUT.SELECT,
  //     /* __selectData: TableGridSelector,
  //     __selectDataProps: {
  //       __onSelection: (hoverRow, hoverCol, withHeader) => {
  //         console.log("__onSelection yessssssss", { hoverRow, hoverCol, withHeader })
  //         GenericFormatingEditorCommands.insertTable(hoverRow, hoverCol, withHeader)
  //       }
  //     }, */
  //     // __selectData: [],
  //   }
  // },

  ColorSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColor}</div>`,
      __label: _('Color'),
      __description: _(
        'Color — Change color to improve hierarchy, categorize content, and make key information stand out.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'background',
        __onSelect: (color: string) => GenericFormatingEditorCommands.backgroundColor(color)
      }
    }
  },
  TableHeaderRowToggle: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTableGrid}</div>`,
      __label: _('Header Row'),
      __description: _(
        'Header Row — Edit repeating header/footer content like titles, page numbers, and document metadata.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.toggleTableStyleOption('headerRow')
    }
  },
  TableTotalRowToggle: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTableGrid}</div>`,
      __label: _('Total Row'),
      __description: _(
        'Total Row — Toggle a Total Row at the bottom of the table to quickly summarize columns (sum, average, count).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.toggleTableStyleOption('totalRow')
    }
  },
  TableFirstColumnToggle: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTableInsertColumnLeft}</div>`,
      __label: _('First Column'),
      __description: _(
        'First Column — Emphasize the first column (often row labels) with table style formatting for readability.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.toggleTableStyleOption('firstColumn')
    }
  },
  TableLastColumnToggle: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTableInsertColumnRight}</div>`,
      __label: _('Last Column'),
      __description: _(
        'Last Column — Emphasize the last column (often totals) with table style formatting for readability.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.toggleTableStyleOption('lastColumn')
    }
  },
  TableBandedRowsToggle: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTableInsertRow}</div>`,
      __label: _('Banded Rows'),
      __description: _(
        'Banded Rows — Apply alternating row shading to improve scannability across wide tables.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.toggleTableStyleOption('bandedRows')
    }
  },
  TableBandedColumnsToggle: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTableInsertColumnLeft}</div>`,
      __label: _('Banded Columns'),
      __description: _(
        'Banded Columns — Apply alternating column shading to make large tables easier to scan.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.toggleTableStyleOption('bandedColumns')
    }
  },
  TableShadingSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconColorFill}</div>`,
      __label: _('Shading'),
      __description: _(
        'Table Shading — Insert or edit a table to organize information into rows and columns (great for comparisons and structured data).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'background',
        __onSelect: (color: string) => GenericFormatingEditorCommands.setTableShadingColor(color)
      }
    }
  },
  TableBorderSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconBorderAll}</div>`,
      __label: _('Borders'),
      __description: _(
        'Table Borders — Insert or edit a table to organize information into rows and columns (great for comparisons and structured data).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'background',
        __onSelect: (color: string) => GenericFormatingEditorCommands.setTableBorderColor(color)
      }
    }
  },
  TableBorderWeightSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconBorderAll}</div>`,
      __label: _('Weight'),
      __description: _(
        'Border Weight — Add or modify borders to visually separate sections, tables, and callouts.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('0.25 pt'),
            __onClick: () => GenericFormatingEditorCommands.setTableBorderWeight(0.25)
          },
          {
            __label: _('0.5 pt'),
            __onClick: () => GenericFormatingEditorCommands.setTableBorderWeight(0.5)
          },
          {
            __label: _('1 pt'),
            __onClick: () => GenericFormatingEditorCommands.setTableBorderWeight(1)
          },
          {
            __label: _('2 pt'),
            __onClick: () => GenericFormatingEditorCommands.setTableBorderWeight(2)
          }
        ]
      }
    }
  },
  TableBorderColorSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconColorFill}</div>`,
      __label: _('Pen Color'),
      __description: _(
        'Border Color — Change color to improve hierarchy, categorize content, and make key information stand out.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'background',
        __onSelect: (color: string) => GenericFormatingEditorCommands.setTableBorderColor(color)
      }
    }
  },
  ClearTableStyle: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTextAllClearFormatting}</div>`,
      __label: _('Clear Table Style'),
      __description: _(
        'Clear Table Style — Insert or edit a table to organize information into rows and columns (great for comparisons and structured data).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.clearTableStyle()
    }
  },
  ImageCorrectionsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconColor}</div>`,
      __label: _('Corrections'),
      __description: _(
        'Picture Corrections — Adjust brightness/contrast/sharpness to improve image clarity without editing the original file.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Sharpen'),
            __onClick: () =>
              GenericFormatingEditorCommands.setImageFilter('contrast(1.1) saturate(1.05)')
          },
          {
            __label: _('Soft'),
            __onClick: () =>
              GenericFormatingEditorCommands.setImageFilter('brightness(1.05) saturate(0.95)')
          },
          {
            __label: _('Brighten'),
            __onClick: () => GenericFormatingEditorCommands.setImageFilter('brightness(1.15)')
          },
          {
            __label: _('Dim'),
            __onClick: () => GenericFormatingEditorCommands.setImageFilter('brightness(0.9)')
          }
        ]
      }
    }
  },
  ImageColorSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconColorFill}</div>`,
      __label: _('Color'),
      __description: _(
        'Picture Color — Change color to improve hierarchy, categorize content, and make key information stand out.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Colorful'),
            __onClick: () => GenericFormatingEditorCommands.setImageFilter('saturate(1.2)')
          },
          {
            __label: _('Grayscale'),
            __onClick: () => GenericFormatingEditorCommands.setImageFilter('grayscale(1)')
          },
          {
            __label: _('Sepia'),
            __onClick: () => GenericFormatingEditorCommands.setImageFilter('sepia(0.8)')
          },
          {
            __label: _('Washout'),
            __onClick: () =>
              GenericFormatingEditorCommands.setImageFilter('saturate(0.6) brightness(1.05)')
          }
        ]
      }
    }
  },
  ImageBorderSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconBorderAll}</div>`,
      __label: _('Border'),
      __description: _(
        'Picture Border — Add or modify borders to visually separate sections, tables, and callouts.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'background',
        __onSelect: (color: string) => GenericFormatingEditorCommands.setImageBorder(color, 1)
      }
    }
  },
  ImageEffectsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconSparkle}</div>`,
      __label: _('Effects'),
      __description: _(
        'Picture Effects — Apply visual effects to images (shadow, glow, soft edges) to match the document’s style.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Shadow'),
            __onClick: () =>
              GenericFormatingEditorCommands.setImageShadow('0 8px 20px rgba(0,0,0,0.25)')
          },
          {
            __label: _('Glow'),
            __onClick: () =>
              GenericFormatingEditorCommands.setImageShadow('0 0 16px rgba(59,130,246,0.6)')
          },
          {
            __label: _('Soft Edge'),
            __onClick: () => GenericFormatingEditorCommands.setImageRadius('12px')
          },
          {
            __label: _('No Effects'),
            __onClick: () => GenericFormatingEditorCommands.setImageShadow('none')
          }
        ]
      }
    }
  },
  ImageWrapSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTextWrap}</div>`,
      __label: _('Wrap Text'),
      __description: _(
        'Wrap Text — Wrap text around the selected object (image/shape) to create magazine-style layouts.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('In Line with Text'),
            __onClick: () => GenericFormatingEditorCommands.setImageWrap('inline')
          },
          {
            __label: _('Square'),
            __onClick: () => GenericFormatingEditorCommands.setImageWrap('square')
          },
          {
            __label: _('Tight'),
            __onClick: () => GenericFormatingEditorCommands.setImageWrap('tight')
          },
          {
            __label: _('Behind Text'),
            __onClick: () => GenericFormatingEditorCommands.setImageWrap('behind')
          },
          {
            __label: _('In Front of Text'),
            __onClick: () => GenericFormatingEditorCommands.setImageWrap('infront')
          }
        ]
      }
    }
  },
  ImageAlignSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTextAlignCenter}</div>`,
      __label: _('Align'),
      __description: _(
        'Align — Align and distribute selected objects for clean layouts (left/center/right, top/middle/bottom).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Left'),
            __onClick: () => GenericFormatingEditorCommands.setImageAlign('left')
          },
          {
            __label: _('Center'),
            __onClick: () => GenericFormatingEditorCommands.setImageAlign('center')
          },
          {
            __label: _('Right'),
            __onClick: () => GenericFormatingEditorCommands.setImageAlign('right')
          }
        ]
      }
    }
  },
  ImageRotateSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconRefresh}</div>`,
      __label: _('Rotate'),
      __description: _('Rotate — Rotate the selected object/image by a fixed increment.'),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Rotate Right 90°'),
            __onClick: () => GenericFormatingEditorCommands.setImageRotate(90)
          },
          {
            __label: _('Rotate Left 90°'),
            __onClick: () => GenericFormatingEditorCommands.setImageRotate(-90)
          },
          {
            __label: _('Flip Vertical'),
            __onClick: () => GenericFormatingEditorCommands.setImageRotate(180)
          },
          {
            __label: _('Reset Rotation'),
            __onClick: () => GenericFormatingEditorCommands.setImageRotate(0)
          }
        ]
      }
    }
  },
  ImageReset: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconRefresh}</div>`,
      __label: _('Reset Picture'),
      __description: _(
        'Reset Picture — Revert picture adjustments/effects back to the original look (keeps the image file unchanged).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.resetImageStyles()
    }
  },
  TransitionSoundSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconAudio}</div>`,
      __label: _('Sound'),
      __description: _(
        'Transition Sound — Choose or disable the sound effect that plays during slide transitions (when supported).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('None'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransitionSound(null)
          },
          {
            __label: _('Click'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransitionSound('click')
          },
          {
            __label: _('Chime'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransitionSound('chime')
          },
          {
            __label: _('Swish'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransitionSound('swish')
          }
        ]
      }
    }
  },
  TransitionDurationSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconHistory}</div>`,
      __label: _('Duration'),
      __description: _(
        'Transition Duration — Set how long the slide transition animation lasts for a smoother or snappier flow.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('0.3s'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransitionDuration(0.3)
          },
          {
            __label: _('0.6s'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransitionDuration(0.6)
          },
          {
            __label: _('1s'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransitionDuration(1)
          },
          {
            __label: _('2s'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransitionDuration(2)
          }
        ]
      }
    }
  },
  TransitionAdvanceSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowNext}</div>`,
      __label: _('Advance'),
      __description: _(
        'Advance Slide — Control when the next slide advances (on click or automatically after a delay).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('On Click'),
            __onClick: () => GenericFormatingEditorCommands.setSlideAdvance('click')
          },
          {
            __label: _('After 3s'),
            __onClick: () => {
              GenericFormatingEditorCommands.setSlideAdvance('after')
              GenericFormatingEditorCommands.setSlideAdvanceAfter(3)
            }
          },
          {
            __label: _('After 5s'),
            __onClick: () => {
              GenericFormatingEditorCommands.setSlideAdvance('after')
              GenericFormatingEditorCommands.setSlideAdvanceAfter(5)
            }
          },
          {
            __label: _('After 10s'),
            __onClick: () => {
              GenericFormatingEditorCommands.setSlideAdvance('after')
              GenericFormatingEditorCommands.setSlideAdvanceAfter(10)
            }
          }
        ]
      }
    }
  },
  TransitionApplyAll: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconWindowBrush}</div>`,
      __label: _('Apply to All'),
      __description: _(
        'Apply transition to all slides — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.applySlideTransitionToAll()
    }
  },
  TransitionPreview: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconPreviewLink}</div>`,
      __label: _('Preview'),
      __description: _(
        'Preview transition — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.previewSlideTransition()
    }
  },
  TransitionEffectOptionsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconMoreCircle}</div>`,
      __label: _('Effect Options'),
      __description: _(
        'Effect Options — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Default'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransition(null)
          },
          {
            __label: _('From Left'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransition('from-left')
          },
          {
            __label: _('From Right'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransition('from-right')
          },
          {
            __label: _('From Top'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransition('from-top')
          },
          {
            __label: _('From Bottom'),
            __onClick: () => GenericFormatingEditorCommands.setSlideTransition('from-bottom')
          }
        ]
      }
    }
  },
  AnimationEffectOptionsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconMoreCircle}</div>`,
      __label: _('Animation Effect'),
      __description: _(
        'Animation Effect Options — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          { __label: _('None'), __onClick: () => GenericFormatingEditorCommands.unwrapAnimation() },
          {
            __label: _('Appear'),
            __onClick: () => GenericFormatingEditorCommands.wrapWithAnimation('appear', 1)
          },
          {
            __label: _('Fade'),
            __onClick: () => GenericFormatingEditorCommands.wrapWithAnimation('fade-in', 1)
          },
          {
            __label: _('Blinds'),
            __onClick: () => GenericFormatingEditorCommands.wrapWithAnimation('blinds', 1)
          },
          {
            __label: _('Box'),
            __onClick: () => GenericFormatingEditorCommands.wrapWithAnimation('box', 1)
          },
          {
            __label: _('Checkerboard'),
            __onClick: () => GenericFormatingEditorCommands.wrapWithAnimation('checkerboard', 1)
          }
        ]
      }
    }
  },
  TextAnimationSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTextBold}</div>`,
      __label: _('Text Animation'),
      __description: _(
        'Text Animation — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('All at once'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationTextMode('all-at-once')
          },
          {
            __label: _('By word'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationTextMode('by-word')
          },
          {
            __label: _('By letter'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationTextMode('by-letter')
          }
        ]
      }
    }
  },
  AnimationStartSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowNext}</div>`,
      __label: _('Start'),
      __description: _(
        'Start — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('On Click'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationStart('on-click')
          },
          {
            __label: _('With Previous'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationStart('with-previous')
          },
          {
            __label: _('After Previous'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationStart('after-previous')
          }
        ]
      }
    }
  },
  AnimationDurationSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconHistory}</div>`,
      __label: _('Duration'),
      __description: _(
        'Duration — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('0.25s'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationDuration(0.25)
          },
          {
            __label: _('0.5s'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationDuration(0.5)
          },
          {
            __label: _('1s'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationDuration(1)
          },
          {
            __label: _('2s'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationDuration(2)
          }
        ]
      }
    }
  },
  AnimationDelaySelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconHistory}</div>`,
      __label: _('Delay'),
      __description: _(
        'Delay — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('0s'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationDelay(0)
          },
          {
            __label: _('0.25s'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationDelay(0.25)
          },
          {
            __label: _('0.5s'),
            __onClick: () => GenericFormatingEditorCommands.setAnimationDelay(0.5)
          },
          { __label: _('1s'), __onClick: () => GenericFormatingEditorCommands.setAnimationDelay(1) }
        ]
      }
    }
  },
  ColorSchemeSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColor}</div>`,
      __label: _('Colors'),
      __description: _(
        'Theme Colors — Change color to improve hierarchy, categorize content, and make key information stand out.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Neutral'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentTheme('neutral')
          },
          {
            __label: _('Blue'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentTheme('blue')
          },
          {
            __label: _('Emerald'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentTheme('emerald')
          },
          {
            __label: _('Rose'),
            __onClick: () => GenericFormatingEditorCommands.setDocumentTheme('rose')
          }
        ]
      }
    }
  },
  BackgroundSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColorFill}</div>`,
      __label: _('Background'),
      __description: _(
        'Background Color — Change color to improve hierarchy, categorize content, and make key information stand out.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'background',
        __onSelect: (color: string) => GenericFormatingEditorCommands.backgroundColor(color)
      }
    }
  },
  SlideMasterSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentHeader}</div>`,
      __label: _('Slide Master'),
      __description: _(
        'Edit Slide Master — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Edit Slide Master'),
            __onClick: () => GenericFormatingEditorCommands.openSlideMaster()
          }
        ]
      }
    }
  },
  SlideLayoutSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColumnTriple}</div>`,
      __label: _('Layout'),
      __description: _(
        'Slide Layout — Change the layout of the current slide (title, content, two-column, etc.) without recreating it.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Title Slide'),
            __onClick: () => GenericFormatingEditorCommands.setSlideLayout('title')
          },
          {
            __label: _('Subtitle'),
            __onClick: () => GenericFormatingEditorCommands.setSlideLayout('subtitle')
          },
          {
            __label: _('Title and Content'),
            __onClick: () => GenericFormatingEditorCommands.setSlideLayout('body')
          },
          {
            __label: _('Section Header'),
            __onClick: () => GenericFormatingEditorCommands.setSlideLayout('section')
          }
        ]
      }
    }
  },
  SlideSizeSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPageFit}</div>`,
      __label: _('Slide Size'),
      __description: _(
        'Slide Size — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          { __label: _('A4'), __onClick: () => GenericFormatingEditorCommands.setSlideSize('A4') },
          {
            __label: _('Letter'),
            __onClick: () => GenericFormatingEditorCommands.setSlideSize('Letter')
          },
          {
            __label: _('Legal'),
            __onClick: () => GenericFormatingEditorCommands.setSlideSize('Legal')
          }
        ]
      }
    }
  },

  FileSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconImage}</div>`,
      __label: _('File'),
      __description: _(
        'File — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColor}</div>`,
            __label: _('Add File from device'),
            __description: _(
              'Add File from device — Configure settings for this tool and apply them to your current selection.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.insertFileFromDevice()
            }
          },
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColor}</div>`,
            __label: _('Add folder from device'),
            __description: _(
              'Add folder from device — Configure settings for this tool and apply them to your current selection.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.insertFolderFromDevice()
            }
          },
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconLink}</div>`,
            __label: _('Add File from URL'),
            __description: _(
              'Download and embed a file from a URL — Configure settings for this tool and apply them to your current selection.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.insertFileFromUrl()
            }
          },
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconClipboardPaste}</div>`,
            __label: _('Add File from Clipboard'),
            __description: _(
              'Insert the file path currently in clipboard — Configure settings for this tool and apply them to your current selection.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.insertFileFromClipboard()
            }
          },
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentDataLink}</div>`,
            __label: _('Include File (Sync)'),
            __description: _(
              'Keep the file synced with the source — Configure settings for this tool and apply them to your current selection.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.includeFile()
            }
          },
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentCopy}</div>`,
            __label: _('Append File (Static)'),
            __description: _(
              'Insert a one-time snapshot of a file — Configure settings for this tool and apply them to your current selection.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.appendFile()
            }
          },
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentFolder}</div>`,
            __label: _('Add from Document'),
            __description: _(
              'Pick from the current document library — Configure settings for this tool and apply them to your current selection.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.includeFileFromDocument()
            }
          },
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconGlobeDesktop}</div>`,
            __label: _('Insert Web Preview'),
            __description: _(
              'Embed a live preview of a URL — Configure settings for this tool and apply them to your current selection.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.insertWebviewFromUrl()
            }
          }
        ]
      }
    }
  },

  PictureSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconImage}</div>`,
      __label: _('Picture'),
      __description: _(
        'Picture — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColor}</div>`,
            __label: _('Add from device'),
            __description: _(
              'Add from device — Configure settings for this tool and apply them to your current selection.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.insertImageFromDevice()
            }
          },
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconLink}</div>`,
            __label: _('Add from URL'),
            __description: _(
              'Download and embed an image from a URL — Configure settings for this tool and apply them to your current selection.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.insertImageFromUrl()
            }
          },
          {
            __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconClipboardPaste}</div>`,
            __label: _('Add from Clipboard'),
            __description: _(
              'Insert image path from clipboard — Insert an image from your device or workspace into the document.'
            ),
            __layout: Layout.LAYOUT.ROW,
            __onClick: async () => {
              await GenericFormatingEditorCommands.insertImageFromClipboard()
            }
          }
        ]
      }
    }
  },
  ChangePictureSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconImage}</div>`,
      __label: _('Change Picture'),
      __description: _(
        'Change Picture — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('From Device'),
            __onClick: async () => GenericFormatingEditorCommands.insertImageFromDevice()
          },
          {
            __label: _('From URL'),
            __onClick: async () => GenericFormatingEditorCommands.insertImageFromUrl()
          },
          {
            __label: _('From Clipboard'),
            __onClick: async () => GenericFormatingEditorCommands.insertImageFromClipboard()
          }
        ]
      }
    }
  },
  AddPictureSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconAddCircle}</div>`,
      __label: _('Add Picture'),
      __description: _(
        'Add Picture — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('From Device'),
            __onClick: async () => GenericFormatingEditorCommands.insertImageFromDevice()
          },
          {
            __label: _('From URL'),
            __onClick: async () => GenericFormatingEditorCommands.insertImageFromUrl()
          },
          {
            __label: _('From Clipboard'),
            __onClick: async () => GenericFormatingEditorCommands.insertImageFromClipboard()
          }
        ]
      }
    }
  },
  PictureCrop: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconDrawShape}</div>`,
      __label: _('Crop'),
      __description: _('Crop — Crop the selected image to focus on the important area.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.openImageCrop()
    }
  },
  PicturePreview: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconPreviewLink}</div>`,
      __label: _('Picture Preview'),
      __description: _(
        'Picture Preview — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.previewPicture()
    }
  },
  PictureTransparentColor: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconColorFill}</div>`,
      __label: _('Set Transparent Color'),
      __description: _(
        'Set Transparent Color — Change color to improve hierarchy, categorize content, and make key information stand out.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.setImageTransparentColor()
    }
  },
  PictureBorderSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconBorderAll}</div>`,
      __label: _('Picture Border'),
      __description: _(
        'Picture Border — Add or modify borders to visually separate sections, tables, and callouts.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'background',
        __onSelect: (color: string) => GenericFormatingEditorCommands.setImageBorder(color, 1)
      }
    }
  },
  PictureRotateSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconRefresh}</div>`,
      __label: _('Rotate'),
      __description: _('Rotate — Rotate the selected object/image by a fixed increment.'),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Rotate Right 90°'),
            __onClick: () => GenericFormatingEditorCommands.setImageRotate(90)
          },
          {
            __label: _('Rotate Left 90°'),
            __onClick: () => GenericFormatingEditorCommands.setImageRotate(-90)
          },
          {
            __label: _('Flip Vertical'),
            __onClick: () => GenericFormatingEditorCommands.setImageRotate(180)
          },
          {
            __label: _('Reset Rotation'),
            __onClick: () => GenericFormatingEditorCommands.setImageRotate(0)
          }
        ]
      }
    }
  },
  PictureWrapSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTextWrap}</div>`,
      __label: _('Wrap Text'),
      __description: _(
        'Wrap Text — Wrap text around the selected object (image/shape) to create magazine-style layouts.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('In Line with Text'),
            __onClick: () => GenericFormatingEditorCommands.setImageWrap('inline')
          },
          {
            __label: _('Square'),
            __onClick: () => GenericFormatingEditorCommands.setImageWrap('square')
          },
          {
            __label: _('Tight'),
            __onClick: () => GenericFormatingEditorCommands.setImageWrap('tight')
          },
          {
            __label: _('Behind Text'),
            __onClick: () => GenericFormatingEditorCommands.setImageWrap('behind')
          },
          {
            __label: _('In Front of Text'),
            __onClick: () => GenericFormatingEditorCommands.setImageWrap('infront')
          }
        ]
      }
    }
  },
  PictureAlignSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTextAlignCenter}</div>`,
      __label: _('Align'),
      __description: _(
        'Align — Align and distribute selected objects for clean layouts (left/center/right, top/middle/bottom).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Left'),
            __onClick: () => GenericFormatingEditorCommands.setImageAlign('left')
          },
          {
            __label: _('Center'),
            __onClick: () => GenericFormatingEditorCommands.setImageAlign('center')
          },
          {
            __label: _('Right'),
            __onClick: () => GenericFormatingEditorCommands.setImageAlign('right')
          }
        ]
      }
    }
  },
  PictureGroupSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTable}</div>`,
      __label: _('Group'),
      __description: _(
        'Group — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          { __label: _('Group'), __onClick: () => GenericFormatingEditorCommands.groupSelection() },
          {
            __label: _('Ungroup'),
            __onClick: () => GenericFormatingEditorCommands.ungroupSelection()
          }
        ]
      }
    }
  },
  PictureBringForwardSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowNext}</div>`,
      __label: _('Bring Forward'),
      __description: _(
        'Bring Forward — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Bring Forward'),
            __onClick: () => GenericFormatingEditorCommands.bringForward()
          },
          {
            __label: _('Bring to Front'),
            __onClick: () => GenericFormatingEditorCommands.bringToFront()
          }
        ]
      }
    }
  },
  PictureSendBackwardSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowPrevious}</div>`,
      __label: _('Send Backward'),
      __description: _(
        'Send Backward — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Send Backward'),
            __onClick: () => GenericFormatingEditorCommands.sendBackward()
          },
          {
            __label: _('Send to Back'),
            __onClick: () => GenericFormatingEditorCommands.sendToBack()
          }
        ]
      }
    }
  },
  PictureSelectionPane: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconNavigation}</div>`,
      __label: _('Selection Pane'),
      __description: _(
        'Selection Pane — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.openSelectionPane()
    }
  },
  PictureSettingsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconStarSettings}</div>`,
      __label: _('Settings'),
      __description: _(
        'Settings — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Picture Options'),
            __onClick: () => GenericFormatingEditorCommands.openPictureSettings()
          },
          {
            __label: _('Reset Picture'),
            __onClick: () => GenericFormatingEditorCommands.resetImageStyles()
          }
        ]
      }
    }
  },
  PictureCompress: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentFolder}</div>`,
      __label: _('Compress Pictures'),
      __description: _(
        'Compress Pictures — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.compressPictures()
    }
  },
  EditShapeSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconDrawShape}</div>`,
      __label: _('Edit Shape'),
      __description: _(
        'Edit Shape — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          { __label: _('Edit Shape'), __onClick: () => GenericFormatingEditorCommands.editShape() },
          { __label: _('Edit Points'), __onClick: () => GenericFormatingEditorCommands.editShape() }
        ]
      }
    }
  },
  MergeShapesSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconSplitHorizontal}</div>`,
      __label: _('Merge Shapes'),
      __description: _(
        'Merge Shapes — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          { __label: _('Union'), __onClick: () => GenericFormatingEditorCommands.mergeShapes() },
          { __label: _('Combine'), __onClick: () => GenericFormatingEditorCommands.mergeShapes() },
          { __label: _('Fragment'), __onClick: () => GenericFormatingEditorCommands.mergeShapes() },
          {
            __label: _('Intersect'),
            __onClick: () => GenericFormatingEditorCommands.mergeShapes()
          },
          { __label: _('Subtract'), __onClick: () => GenericFormatingEditorCommands.mergeShapes() }
        ]
      }
    }
  },
  ShapeFillSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconColorFill}</div>`,
      __label: _('Shape Fill'),
      __description: _(
        'Shape Fill — Apply background shading/fill to emphasize sections or improve scannability.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'background',
        __onSelect: (color: string) => GenericFormatingEditorCommands.setShapeFill(color)
      }
    }
  },
  ShapeOutlineSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconBorderAll}</div>`,
      __label: _('Shape Outline'),
      __description: _(
        'Shape Outline — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'background',
        __onSelect: (color: string) => GenericFormatingEditorCommands.setShapeOutline(color)
      }
    }
  },
  ShapeEffectsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconSparkle}</div>`,
      __label: _('Shape Effects'),
      __description: _(
        'Shape Effects — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Shadow'),
            __onClick: () => GenericFormatingEditorCommands.setShapeEffects('shadow')
          },
          {
            __label: _('Glow'),
            __onClick: () => GenericFormatingEditorCommands.setShapeEffects('glow')
          },
          {
            __label: _('None'),
            __onClick: () => GenericFormatingEditorCommands.setShapeEffects('none')
          }
        ]
      }
    }
  },
  ShapeGroupSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTable}</div>`,
      __label: _('Group'),
      __description: _(
        'Group — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          { __label: _('Group'), __onClick: () => GenericFormatingEditorCommands.groupSelection() },
          {
            __label: _('Ungroup'),
            __onClick: () => GenericFormatingEditorCommands.ungroupSelection()
          }
        ]
      }
    }
  },
  ShapeAlignSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconTextAlignCenter}</div>`,
      __label: _('Align'),
      __description: _(
        'Align — Align and distribute selected objects for clean layouts (left/center/right, top/middle/bottom).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Align Left'),
            __onClick: () => GenericFormatingEditorCommands.alignSelectedShape('left')
          },
          {
            __label: _('Align Center'),
            __onClick: () => GenericFormatingEditorCommands.alignSelectedShape('center')
          },
          {
            __label: _('Align Right'),
            __onClick: () => GenericFormatingEditorCommands.alignSelectedShape('right')
          },
          {
            __label: _('Align Top'),
            __onClick: () => GenericFormatingEditorCommands.alignSelectedShape('top')
          },
          {
            __label: _('Align Middle'),
            __onClick: () => GenericFormatingEditorCommands.alignSelectedShape('middle')
          },
          {
            __label: _('Align Bottom'),
            __onClick: () => GenericFormatingEditorCommands.alignSelectedShape('bottom')
          }
        ]
      }
    }
  },
  ShapeRotateSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconRefresh}</div>`,
      __label: _('Rotate'),
      __description: _('Rotate — Rotate the selected object/image by a fixed increment.'),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Rotate Right 90°'),
            __onClick: () => GenericFormatingEditorCommands.rotateSelectedShape(90)
          },
          {
            __label: _('Rotate Left 90°'),
            __onClick: () => GenericFormatingEditorCommands.rotateSelectedShape(-90)
          }
        ]
      }
    }
  },
  ShapeBringForwardSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowNext}</div>`,
      __label: _('Bring Forward'),
      __description: _(
        'Bring Forward — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Bring Forward'),
            __onClick: () => GenericFormatingEditorCommands.bringForwardSelected()
          },
          {
            __label: _('Bring to Front'),
            __onClick: () => GenericFormatingEditorCommands.bringForwardSelected()
          }
        ]
      }
    }
  },
  ShapeSendBackwardSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowPrevious}</div>`,
      __label: _('Send Backward'),
      __description: _(
        'Send Backward — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Send Backward'),
            __onClick: () => GenericFormatingEditorCommands.sendBackwardSelected()
          },
          {
            __label: _('Send to Back'),
            __onClick: () => GenericFormatingEditorCommands.sendBackwardSelected()
          }
        ]
      }
    }
  },
  ShapeSelectSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconCursor}</div>`,
      __label: _('Select'),
      __description: _(
        'Select — Select content or objects based on the current tool/mode (useful for multi-editing and bulk changes).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Select All'),
            __onClick: () => GenericFormatingEditorCommands.openSelectionPane()
          },
          {
            __label: _('Selection Pane'),
            __onClick: () => GenericFormatingEditorCommands.openSelectionPane()
          }
        ]
      }
    }
  },
  ShapeSettingsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[18px] max-w-[max-content]">${fluentUIcons.fluentUIconStarSettings}</div>`,
      __label: _('Settings'),
      __description: _(
        'Settings — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Shape Options'),
            __onClick: () => GenericFormatingEditorCommands.openShapeSettings()
          }
        ]
      }
    }
  },

  ScreenshotSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconImage}</div>`,
      __label: _('Screenshot'),
      __description: _(
        'Insert a screenshot — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Capture From File'),
            __onClick: () => GenericFormatingEditorCommands.insertScreenshot()
          },
          {
            __label: _('Paste From Clipboard'),
            __onClick: () => GenericFormatingEditorCommands.insertImageFromClipboard()
          }
        ]
      }
    }
  },

  ShapesSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDrawShape}</div>`,
      __label: _('Shapes'),
      __description: _(
        'Insert shapes — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Rectangle'),
            __onClick: () => GenericFormatingEditorCommands.drawDesignItemRectangle()
          },
          {
            __label: _('Circle'),
            __onClick: () => GenericFormatingEditorCommands.drawDesignItemShape(ShapeType.Circle)
          },
          {
            __label: _('Triangle'),
            __onClick: () => GenericFormatingEditorCommands.drawDesignItemShape(ShapeType.Triangle)
          }
        ]
      }
    }
  },

  TextBoxSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNote}</div>`,
      __label: _('Text Box'),
      __description: _(
        'Insert a text box — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Simple Text Box'),
            __onClick: () => GenericFormatingEditorCommands.insertTextBox()
          }
        ]
      }
    }
  },

  WordArtSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextChangeCase}</div>`,
      __label: _('WordArt'),
      __description: _(
        'Insert WordArt — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Classic WordArt'),
            __onClick: () => GenericFormatingEditorCommands.insertWordArt()
          }
        ]
      }
    }
  },

  SmartArtSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDrawShape}</div>`,
      __label: _('SmartArt'),
      __description: _(
        'Insert SmartArt — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Process'),
            __onClick: () => GenericFormatingEditorCommands.insertSmartArt()
          },
          { __label: _('Cycle'), __onClick: () => GenericFormatingEditorCommands.insertSmartArt() },
          {
            __label: _('Hierarchy'),
            __onClick: () => GenericFormatingEditorCommands.insertSmartArt()
          }
        ]
      }
    }
  },

  /* ChartSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTable}</div>`,
      __label: _('Chart'),
      __description: _('Insert a chart — Configure settings for this tool and apply them to your current selection.'),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          { __label: _('Column Chart'), __onClick: () => GenericFormatingEditorCommands.insertChart() },
          { __label: _('Line Chart'), __onClick: () => GenericFormatingEditorCommands.insertChart() },
          { __label: _('Pie Chart'), __onClick: () => GenericFormatingEditorCommands.insertChart() }
        ]
      }
    }
  }, */

  DrawShapeSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDrawShape}</div>`,
      __label: _('Draw Shape'),
      __description: _(
        'Draw Shape — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Rectangle'),
            __onClick: () => GenericFormatingEditorCommands.drawDesignItemRectangle()
          },
          {
            __label: _('Circle'),
            __onClick: () => GenericFormatingEditorCommands.drawDesignItemShape(ShapeType.Circle)
          },
          {
            __label: _('Triangle'),
            __onClick: () => GenericFormatingEditorCommands.drawDesignItemShape(ShapeType.Triangle)
          }
        ]
      }
    }
  },

  HyperlinkSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconLink}</div>`,
      __label: _('Hyperlink'),
      __description: _(
        'Hyperlink — Insert or edit a hyperlink to reference sources, jump to locations, or link related documents.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Add Link'),
            __detail: _('Insert a new link with text.'),
            __disabled: () => GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.addHyperlinkWithText()
          },
          {
            __label: _('Insert Link'),
            __onClick: () => GenericFormatingEditorCommands.insertHyperlink()
          },
          {
            __label: _('Remove Link'),
            __onClick: () => GenericFormatingEditorCommands.removeHyperlink()
          }
        ]
      }
    }
  },

  InternalLinkSelect: {
    component: GenericFormattingComponent,
    props: {
      // You can swap this string with an alternate icon from your fluentUIcons suite if preferred
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconLink}</div>`,
      __label: _('Internal Link'),
      __description: _(
        'Internal Link — Insert or edit an internal link to reference sources, jump to locations, or link related documents.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Add Link to document'),
            __detail: _('Insert a new internal link block by choosing a target document.'),
            __disabled: () => GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.addInternalLinkWithText()
          },
          {
            __label: _('Insert Link to document'),
            __detail: _('Attach an internal link to the highlighted text selection.'),
            __onClick: () => GenericFormatingEditorCommands.insertInternalLink()
          },
          {
            __label: _('Remove Link to document'),
            __onClick: () => GenericFormatingEditorCommands.removeInternalLink()
          }
        ]
      }
    }
  },

  LinkSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconLink}</div>`,
      __label: _('Link'),
      __description: _(
        'Insert links — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Add Link'),
            __onClick: () => GenericFormatingEditorCommands.addHyperlinkWithText()
          },
          {
            __label: _('Insert Link'),
            __onClick: () => GenericFormatingEditorCommands.insertHyperlink()
          },
          {
            __label: _('Remove Link'),
            __onClick: () => GenericFormatingEditorCommands.removeHyperlink()
          }
        ]
      }
    }
  },

  WebpageSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconGlobeDesktop}</div>`,
      __label: _('Webpage'),
      __description: _(
        'Webpage — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      // __selectData: [],
      __onClick: () => {
        GenericFormatingEditorCommands.insertWebview()
      }
    }
  },

  ListSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconList}</div>`,
      __label: _('List'),
      __description: _(
        'List — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Bullet List'),
            __onClick: () => GenericFormatingEditorCommands.bulletList()
          },
          {
            __label: _('Numbered List'),
            __onClick: () => GenericFormatingEditorCommands.orderedList()
          },
          {
            __label: _('Task List'),
            __onClick: () => GenericFormatingEditorCommands.taskList()
          }
        ]
      }
    }
  },

  // SurveyInsertSelect: {
  SurveySelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSurvey}</div>`,
      __label: _('Survey'),
      __description: _(
        'Survey — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => { GenericFormatingEditorCommands.insertSurvey() },
      __selectDataProps: {
        __items: [
          {
            __label: _('Insert Survey'),
            __onClick: () => GenericFormatingEditorCommands.insertSurvey()
          }
          // { __divider: true },
          // { __label: _('Matrix Template'), __onClick: () => GenericFormatingEditorCommands.insertLatexMatrix() },
          // { __label: _('Fraction/Root'), __onClick: () => GenericFormatingEditorCommands.insertLatexFraction() },
          // { __label: _('Chemical Formula'), __onClick: () => GenericFormatingEditorCommands.insertLatexChemistry() }
        ]
      }
    }
  },

  BookmarkMusicSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconBookmark}</div>`,
      __label: _('Bookmark Music'),
      __description: _(
        'Bookmark Music — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => GenericFormatingEditorCommands.insertWebview('https://music.youtube.com'),
      __selectDataProps: {
        __items: [
          {
            __label: _('YouTube Music'),
            __onClick: () =>
              GenericFormatingEditorCommands.insertWebview('https://music.youtube.com')
          },
          {
            __label: _('Spotify'),
            __onClick: () =>
              GenericFormatingEditorCommands.insertWebview('https://open.spotify.com')
          }
        ]
      }
    }
  },

  VideoSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconVideo}</div>`,
      __label: _('Video'),
      __description: _(
        'Video — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => GenericFormatingEditorCommands.insertWebview('https://www.youtube.com'),
      __selectDataProps: {
        __items: [
          {
            __label: _('YouTube'),
            __onClick: () => GenericFormatingEditorCommands.insertWebview('https://www.youtube.com')
          },
          {
            __label: _('Vimeo'),
            __onClick: () => GenericFormatingEditorCommands.insertWebview('https://vimeo.com')
          }
        ]
      }
    }
  },

  CommentSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconCommentAdd}</div>`,
      __label: _('Comment'),
      __description: _(
        'Comment — Add a comment for feedback, review notes, or collaboration threads.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => GenericFormatingEditorCommands.toggleProgrammingStyleComment(),
      __selectDataProps: {
        __items: [
          {
            __label: _('Add Comment'),
            __onClick: () => GenericFormatingEditorCommands.toggleProgrammingStyleComment()
          }
        ]
      }
    }
  },

  CommentInsert: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconCommentAdd}</div>`,
      __label: _('Comment'),
      __description: _(
        'Add comment — Add a comment for feedback, review notes, or collaboration threads.'
      ),
      __layout: Layout.LAYOUT.COLUMN,
      __onClick: () => GenericFormatingEditorCommands.toggleProgrammingStyleComment()
    }
  },

  DocumentHeaderSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentHeader}</div>`,
      __label: _('Document Header'),
      __description: _(
        'Document Header — Edit repeating header/footer content like titles, page numbers, and document metadata.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => GenericFormatingEditorCommands.insertHeading(1),
      __selectDataProps: {
        __items: [
          {
            __label: _('Heading 1'),
            __onClick: () => GenericFormatingEditorCommands.insertHeading(1)
          },
          {
            __label: _('Heading 2'),
            __onClick: () => GenericFormatingEditorCommands.insertHeading(2)
          }
        ]
      }
    }
  },

  NumberSymbolSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNumberSymbol}</div>`,
      __label: _('Number Symbol'),
      __description: _(
        'Number Symbol — Start or toggle a numbered list for steps, procedures, or ranked items.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => GenericFormatingEditorCommands.insertContent('#'),
      __selectDataProps: {
        __items: [
          { __label: _('#'), __onClick: () => GenericFormatingEditorCommands.insertContent('#') },
          { __label: _('№'), __onClick: () => GenericFormatingEditorCommands.insertContent('№') },
          { __label: _('§'), __onClick: () => GenericFormatingEditorCommands.insertContent('§') }
        ]
      }
    }
  },

  SymbolSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNumberSymbol}</div>`,
      __label: _('Symbol'),
      __description: _(
        'Insert symbols — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          { __label: _('Ω'), __onClick: () => GenericFormatingEditorCommands.insertContent('Ω') },
          { __label: _('π'), __onClick: () => GenericFormatingEditorCommands.insertContent('π') },
          { __label: _('∞'), __onClick: () => GenericFormatingEditorCommands.insertContent('∞') },
          { __label: _('√'), __onClick: () => GenericFormatingEditorCommands.insertContent('√') },
          { __label: _('©'), __onClick: () => GenericFormatingEditorCommands.insertContent('©') },
          { __label: _('®'), __onClick: () => GenericFormatingEditorCommands.insertContent('®') }
        ]
      }
    }
  },

  MathFormulaSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconMathFormula}</div>`,
      __label: _('Math Formula'),
      __description: _(
        'Math Formula — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => GenericFormatingEditorCommands.insertContent('\\(x\\)'),
      __selectDataProps: {
        __items: [
          {
            __label: _('Inline Formula'),
            __onClick: () => GenericFormatingEditorCommands.insertContent('\\(x\\)')
          },
          {
            __label: _('Display Formula'),
            __onClick: () => GenericFormatingEditorCommands.insertContent('$$x^2 + y^2 = z^2$$')
          }
        ]
      }
    }
  },

  EquationSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconMathFormula}</div>`,
      __label: _('Equation'),
      __description: _(
        'Insert equation — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Inline Equation'),
            __onClick: () => GenericFormatingEditorCommands.insertContent('\\(x\\)')
          },
          {
            __label: _('Display Equation'),
            __onClick: () => GenericFormatingEditorCommands.insertContent('$$x^2 + y^2 = z^2$$')
          }
        ]
      }
    }
  },

  EnvelopesSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentFolder}</div>`,
      __label: _('Envelopes'),
      __description: _(
        'Insert envelopes — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Envelope'),
            __onClick: () => GenericFormatingEditorCommands.insertEnvelope()
          }
        ]
      }
    }
  },

  BookmarkSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconBookmark}</div>`,
      __label: _('Bookmark'),
      __description: _(
        'Insert bookmark — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Add Bookmark'),
            __onClick: () => GenericFormatingEditorCommands.insertBookmark()
          }
        ]
      }
    }
  },

  QuickPartsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconApps}</div>`,
      __label: _('Quick Parts'),
      __description: _(
        'Insert quick parts — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Document Title'),
            __onClick: () => GenericFormatingEditorCommands.insertQuickPart('Document Title')
          },
          {
            __label: _('Author'),
            __onClick: () => GenericFormatingEditorCommands.insertQuickPart('Author')
          },
          {
            __label: _('Date'),
            __onClick: () => GenericFormatingEditorCommands.insertQuickPart('Date')
          }
        ]
      }
    }
  },

  DropCapSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextFirstLine}</div>`,
      __label: _('Drop Cap'),
      __description: _(
        'Insert a drop cap — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Drop Cap'),
            __onClick: () => GenericFormatingEditorCommands.insertDropCap()
          }
        ]
      }
    }
  },

  ObjectSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentFolder}</div>`,
      __label: _('Appendix Object'),
      __description: _(
        'Insert object — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __class: 'editor-select',
      __selectDataProps: {
        __items: [
          {
            __label: _('Insert Object'),
            __onClick: () => GenericFormatingEditorCommands.insertObject()
          },
          {
            __label: _('Attach File'),
            __onClick: () => GenericFormatingEditorCommands.insertFile()
          },
          {
            __label: _('Attach Folder'),
            __onClick: () => GenericFormatingEditorCommands.insertFolder()
          }
        ]
      }
    }
  },

  AppsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconApps}</div>`,
      __label: _('Apps'),
      __description: _(
        'Apps — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => GenericFormatingEditorCommands.insertFile(),
      __selectDataProps: {
        __items: [
          {
            __label: _('Attach File'),
            __onClick: () => GenericFormatingEditorCommands.insertFile()
          },
          {
            __label: _('Attach Folder'),
            __onClick: () => GenericFormatingEditorCommands.insertFolder()
          },
          {
            __label: _('Include File (Sync)'),
            __onClick: () => GenericFormatingEditorCommands.includeFile()
          },
          {
            __label: _('Append File'),
            __onClick: () => GenericFormatingEditorCommands.appendFile()
          }
        ]
      }
    }
  },
  IncludeSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentDataLink}</div>`,
      __label: _('Include'),
      __description: _(
        'Include or append external files — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => GenericFormatingEditorCommands.includeFile(),
      __keybinding: 'Ctrl+Alt+I',
      __selectDataProps: {
        __items: [
          {
            __label: _('Add From Document...'),
            __onClick: () => GenericFormatingEditorCommands.includeFileFromDocument(),
            __keybinding: 'Ctrl+Alt+D'
          },
          {
            __label: _('Include File (Sync)'),
            __onClick: () => GenericFormatingEditorCommands.includeFile(),
            __keybinding: 'Ctrl+Alt+I'
          },
          {
            __label: _('Append File (Static)'),
            __onClick: () => GenericFormatingEditorCommands.appendFile(),
            __keybinding: 'Ctrl+Alt+A'
          },
          {
            __label: _('Include From Clipboard'),
            __onClick: () => GenericFormatingEditorCommands.includeFileFromClipboard(),
            __keybinding: 'Ctrl+Alt+Shift+I'
          },
          {
            __label: _('Append From Clipboard'),
            __onClick: () => GenericFormatingEditorCommands.appendFileFromClipboard(),
            __keybinding: 'Ctrl+Alt+Shift+A'
          }
        ]
      }
    }
  },

  EmojiSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconEmoji}</div>`,
      __label: _('Emoji'),
      __description: _(
        'Emoji — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      // __onClick: () => GenericFormatingEditorCommands.insertContent('😀'),
      __selectDataProps: {
        __items: [
          { __label: '😀', __onClick: () => GenericFormatingEditorCommands.insertContent('😀') },
          { __label: '✅', __onClick: () => GenericFormatingEditorCommands.insertContent('✅') },
          { __label: '🚀', __onClick: () => GenericFormatingEditorCommands.insertContent('🚀') }
        ]
      }
    }
  },
  MarginSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconMargin}</div>`,
      __label: _('Margin'),
      __description: _(
        'Margin — Adjust margins to control page layout and printing/export spacing.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Normal'),
            __onClick: () => GenericFormatingEditorCommands.setPageMargins('normal')
          },
          {
            __label: _('Narrow'),
            __onClick: () => GenericFormatingEditorCommands.setPageMargins('narrow')
          },
          {
            __label: _('Wide'),
            __onClick: () => GenericFormatingEditorCommands.setPageMargins('wide')
          }
        ]
      }
    }
  },

  PageOrientationSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPageOrientation}</div>`,
      __label: _('Page Orientation'),
      __description: _(
        'Page Orientation — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Portrait'),
            __onClick: () => GenericFormatingEditorCommands.setPageOrientation('portrait')
          },
          {
            __label: _('Landscape'),
            __onClick: () => GenericFormatingEditorCommands.setPageOrientation('landscape')
          }
        ]
      }
    }
  },

  PageSizeSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPageFit}</div>`,
      __label: _('Page Fit'),
      __description: _(
        'Page Fit — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          { __label: _('A4'), __onClick: () => GenericFormatingEditorCommands.setPageSize('A4') },
          {
            __label: _('Letter'),
            __onClick: () => GenericFormatingEditorCommands.setPageSize('Letter')
          },
          {
            __label: _('Legal'),
            __onClick: () => GenericFormatingEditorCommands.setPageSize('Legal')
          }
        ]
      }
    }
  },

  ColumnsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColumnTriple}</div>`,
      __label: _('Columns'),
      __description: _(
        'Columns — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          { __label: _('One'), __onClick: () => GenericFormatingEditorCommands.setPageColumns(1) },
          { __label: _('Two'), __onClick: () => GenericFormatingEditorCommands.setPageColumns(2) },
          { __label: _('Three'), __onClick: () => GenericFormatingEditorCommands.setPageColumns(3) }
        ]
      }
    }
  },

  LineNumberSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNumberRow}</div>`,
      __label: _('Line Numbers'),
      __description: _(
        'Line Numbers — Start or toggle a numbered list for steps, procedures, or ranked items.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Off'),
            __onClick: () => GenericFormatingEditorCommands.setLineNumberMode('off')
          },
          {
            __label: _('Continuous'),
            __onClick: () => GenericFormatingEditorCommands.setLineNumberMode('continuous')
          },
          {
            __label: _('Restart Each Page'),
            __onClick: () => GenericFormatingEditorCommands.setLineNumberMode('page')
          }
        ]
      }
    }
  },
  WatermarkSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconHighlight}</div>`,
      __label: _('Watermark'),
      __description: _(
        'Watermark — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          { __label: _('Default'), __onClick: () => GenericFormatingEditorCommands.openWatermark() }
        ]
      }
    }
  },
  SectionPaneSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNavigation}</div>`,
      __label: _('Section Pane'),
      __description: _(
        'Section Pane — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.openSectionPane()
    }
  },
  DeleteSectionSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDelete}</div>`,
      __label: _('Delete Section'),
      __description: _(
        'Delete Section — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.deleteSection()
    }
  },

  MoreSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconMoreCircle}</div>`,
      __label: _('More'),
      __description: _(
        'More — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Open Layout Inspector'),
            __onClick: () => openPrimarySearchPane({ mode: 'text', autoFocus: true })
          }
        ]
      }
    }
  },

  BorderSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconBorder}</div>`,
      __label: _('Page Border'),
      __description: _(
        'Page Border — Add or modify borders to visually separate sections, tables, and callouts.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('No Border'),
            __onClick: () => executeEditorCommand('setBorderColor', 'transparent')
          },
          {
            __label: _('Solid Border'),
            __onClick: () => executeEditorCommand('setBorderColor', '#A3A3A3')
          }
        ]
      }
    }
  },

  ColorFillSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColorFill}</div>`,
      __label: _('Background Color'),
      __description: _(
        'Background Color — Change color to improve hierarchy, categorize content, and make key information stand out.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: ColorPicker,
      __selectDataProps: {
        __mode: 'background',
        __onSelect: (color: string) => GenericFormatingEditorCommands.backgroundColor(color)
      }
    }
  },
  RefreshSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconRefresh}</div>`,
      __label: _('Refresh'),
      __description: _(
        'Refresh — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  DeleteSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDelete}</div>`,
      __label: _('Delete'),
      __description: _(
        'Delete — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  NoteSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNote}</div>`,
      __label: _('Footnote'),
      __description: _(
        'Footnote — Insert a footnote for citations and references, keeping the main text clean.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  NoteAddSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNoteAdd}</div>`,
      __label: _('Add Endnote'),
      __description: _(
        'Add Endnote — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  NextFootnoteSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowDown}</div>`,
      __label: _('Next Footnote'),
      __description: _(
        'Next Footnote — Insert a footnote for citations and references, keeping the main text clean.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  NextEndnoteSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowDown2}</div>`,
      __label: _('Next Endnote'),
      __description: _(
        'Next Endnote — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  InsightsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconLightbulb}</div>`,
      __label: _('Insights'),
      __description: _(
        'Insights — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  AddCitationSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconAddCircle}</div>`,
      __label: _('Add Citation'),
      __description: _(
        'Add Citation — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  TableOfContentsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconList}</div>`,
      __label: _('Table of Contents'),
      __description: _(
        'Table of Contents — Insert or edit a table to organize information into rows and columns (great for comparisons and structured data).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  UpdateTableOfContents: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconRefresh}</div>`,
      __label: _('Update Table of Contents'),
      __description: _(
        'Update Table of Contents — Insert or edit a table to organize information into rows and columns (great for comparisons and structured data).'
      ),
      __layout: Layout.LAYOUT.ICON
    }
  },
  TableOfContentsLevels: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextBulletListTree}</div>`,
      __label: _('Table of Contents Levels'),
      __description: _(
        'Table of Contents Levels — Insert or edit a table to organize information into rows and columns (great for comparisons and structured data).'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  PreviousFootnoteSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowPrevious}</div>`,
      __label: _('Previous Footnote'),
      __description: _(
        'Previous Footnote — Insert a footnote for citations and references, keeping the main text clean.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  PreviousEndnoteSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowPrevious}</div>`,
      __label: _('Previous Endnote'),
      __description: _(
        'Previous Endnote — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  FootnoteSeparatorSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSplitHorizontal}</div>`,
      __label: _('Footnote/Endnote Separator'),
      __description: _(
        'Footnote/Endnote Separator — Insert a footnote for citations and references, keeping the main text clean.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  CaptionSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentHeader}</div>`,
      __label: _('Caption'),
      __description: _(
        'Caption — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  InsertTableOfFigures: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTable}</div>`,
      __label: _('Insert Table of Figures'),
      __description: _(
        'Insert Table of Figures — Insert or edit a table to organize information into rows and columns (great for comparisons and structured data).'
      ),
      __layout: Layout.LAYOUT.ICON
    }
  },
  CrossReferenceSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconLink}</div>`,
      __label: _('Cross-reference'),
      __description: _(
        'Cross-reference — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  MarkEntrySelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconBookmark}</div>`,
      __label: _('Mark Entry'),
      __description: _(
        'Mark Entry — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  InsertIndexSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconList}</div>`,
      __label: _('Insert Index'),
      __description: _(
        'Insert Index — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  UpdateIndexSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconRefresh}</div>`,
      __label: _('Update Index'),
      __description: _(
        'Update Index — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON
    }
  },
  MailMergeSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPeopleChat}</div>`,
      __label: _('Mail Merge'),
      __description: _(
        'Mail Merge — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON
    }
  },
  ReferencesSettingsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconStarSettings}</div>`,
      __label: _('Settings'),
      __description: _(
        'Settings — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  AISpellCheckSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextGrammarCheckmark}</div>`,
      __label: _('AI Spell Check'),
      __description: _(
        'AI Spell Check — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Run Now'),
            __icon: fluentUIcons.fluentUIconTextGrammarCheckmark,
            __onClick: () => GenericFormatingEditorCommands.runGrammarCheck()
          },
          {
            __label: _('Show Suggestions'),
            __icon: fluentUIcons.fluentUIconPreviewLink,
            __onClick: () => GenericFormatingEditorCommands.toggleGrammarSuggestions(true)
          },
          {
            __label: _('Hide Suggestions'),
            __icon: fluentUIcons.fluentUIconDismiss,
            __onClick: () => GenericFormatingEditorCommands.toggleGrammarSuggestions(false)
          }
        ]
      }
    }
  },
  ThesaurusSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconBookOpen}</div>`,
      __label: _('Thesaurus'),
      __description: _(
        'Thesaurus — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.openThesaurus()
    }
  },
  TextSpeechSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconAudio}</div>`,
      __label: _('Text Speech'),
      __description: _(
        'Text Speech — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.openTextSpeech()
    }
  },
  ReviewDrawSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDrawShape}</div>`,
      __label: _('Draw'),
      __description: _(
        'Draw — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.openReviewDraw()
    }
  },
  ReviewTraditionalSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconLocalLanguage}</div>`,
      __label: _('Traditional'),
      __description: _(
        'Traditional — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.setTraditionalChinese()
    }
  },
  ReviewSimplifiedSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTranslateAuto}</div>`,
      __label: _('Simplified'),
      __description: _(
        'Simplified — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.setSimplifiedChinese()
    }
  },
  ReviewConversionSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTranslate}</div>`,
      __label: _('Conversion'),
      __description: _(
        'Conversion — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Traditional'),
            __onClick: () => GenericFormatingEditorCommands.setTraditionalChinese()
          },
          {
            __label: _('Simplified'),
            __onClick: () => GenericFormatingEditorCommands.setSimplifiedChinese()
          }
        ]
      }
    }
  },
  ReviewRestrictEditingSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconShield}</div>`,
      __label: _('Restrict Editing'),
      __description: _(
        'Restrict Editing — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.openRestrictEditing()
    }
  },
  ParallelTranslateSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTranslateAuto}</div>`,
      __label: _('Parallel Translate'),
      __description: _(
        'Parallel Translate — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.startParallelTranslate()
    }
  },
  ReviewSettingsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconStarSettings}</div>`,
      __label: _('Settings'),
      __description: _(
        'Settings — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Review Settings'),
            __onClick: () => GenericFormatingEditorCommands.openReviewSettings()
          }
        ]
      }
    }
  },

  TextProofingToolsSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextProofingTools}</div>`,
      __label: _('Text Proofing'),
      __description: _(
        'Text Proofing — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Spelling & Grammar'),
            __icon: fluentUIcons.fluentUIconTextGrammarCheckmark,
            __onClick: () => GenericFormatingEditorCommands.toggleGrammarSuggestions()
          },
          {
            __label: _('Run Grammar Check'),
            __icon: fluentUIcons.fluentUIconTextProofingTools,
            __onClick: () => GenericFormatingEditorCommands.runGrammarCheck()
          },
          { __type: 'separator' },
          {
            __label: _('Word Count'),
            __icon: fluentUIcons.fluentUIconDocumentOnePage,
            __onClick: () => GenericFormatingEditorCommands.reviewWordCount()
          },
          {
            __label: _('Read Aloud'),
            __icon: fluentUIcons.fluentUIconAudio,
            __onClick: () => GenericFormatingEditorCommands.readAloud()
          }
        ]
      }
    }
  },

  GrammarCheckSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextGrammarCheckmark}</div>`,
      __label: _('Spelling'),
      __description: _(
        'Spelling — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Run Now'),
            __icon: fluentUIcons.fluentUIconTextGrammarCheckmark,
            __onClick: () => GenericFormatingEditorCommands.runGrammarCheck()
          },
          {
            __label: _('Show Suggestions'),
            __icon: fluentUIcons.fluentUIconPreviewLink,
            __onClick: () => GenericFormatingEditorCommands.toggleGrammarSuggestions(true)
          },
          {
            __label: _('Hide Suggestions'),
            __icon: fluentUIcons.fluentUIconDismiss,
            __onClick: () => GenericFormatingEditorCommands.toggleGrammarSuggestions(false)
          }
        ]
      }
    }
  },

  DocumentOnePageSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentOnePage}</div>`,
      __label: _('Word Count'),
      __description: _(
        'Word Count — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Document Statistics'),
            __icon: fluentUIcons.fluentUIconDocumentOnePage,
            __onClick: () => GenericFormatingEditorCommands.reviewWordCount()
          }
        ]
      }
    }
  },

  AccessibilitySelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconAccessibility}</div>`,
      __label: _('Accessibility Checker'),
      __description: _(
        'Accessibility Checker — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Run Accessibility Scan'),
            __icon: fluentUIcons.fluentUIconAccessibility,
            __onClick: () => GenericFormatingEditorCommands.accessibilityCheck()
          }
        ]
      }
    }
  },

  TranslateSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTranslate}</div>`,
      __label: _('Translator'),
      __description: _(
        'Translator — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Open Translation Pane'),
            __icon: fluentUIcons.fluentUIconTranslate,
            __onClick: () => GenericFormatingEditorCommands.openTranslatePane()
          }
        ]
      }
    }
  },

  CommentPreviousSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconCommentPrevious}</div>`,
      __label: _('Previous Comment'),
      __description: _(
        'Previous Comment — Add a comment for feedback, review notes, or collaboration threads.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Previous Comment'),
            __icon: fluentUIcons.fluentUIconArrowPrevious,
            __onClick: () => GenericFormatingEditorCommands.previousComment()
          }
        ]
      }
    }
  },

  CommentNextSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconCommentNext}</div>`,
      __label: _('Next Comment'),
      __description: _(
        'Next Comment — Add a comment for feedback, review notes, or collaboration threads.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Next Comment'),
            __icon: fluentUIcons.fluentUIconArrowNext,
            __onClick: () => GenericFormatingEditorCommands.nextComment()
          }
        ]
      }
    }
  },

  CommentDismissSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconCommentDismiss}</div>`,
      __label: _('Delete Comment'),
      __description: _(
        'Delete Comment — Add a comment for feedback, review notes, or collaboration threads.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Delete Comment'),
            __icon: fluentUIcons.fluentUIconDismiss,
            __onClick: () => GenericFormatingEditorCommands.deleteComment()
          }
        ]
      }
    }
  },

  CommentSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconComment}</div>`,
      __label: _('Comment'),
      __description: _(
        'Comment — Add a comment for feedback, review notes, or collaboration threads.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('New Comment'),
            __icon: fluentUIcons.fluentUIconComment,
            __onClick: () => GenericFormatingEditorCommands.addComment()
          },
          {
            __label: _('Delete Comment'),
            __icon: fluentUIcons.fluentUIconDismiss,
            __onClick: () => GenericFormatingEditorCommands.deleteComment()
          },
          {
            __label: _('Reply to Comment'),
            __icon: fluentUIcons.fluentUIconCommentMultiple,
            __onClick: () => GenericFormatingEditorCommands.replyWordComment()
          },
          {
            __label: _('Resolve Comment'),
            __icon: fluentUIcons.fluentUIconCheckmark,
            __onClick: () => GenericFormatingEditorCommands.resolveWordComment(undefined, true)
          },
          {
            __label: _('Reopen Comment'),
            __icon: fluentUIcons.fluentUIconDismiss,
            __onClick: () => GenericFormatingEditorCommands.resolveWordComment(undefined, false)
          },
          { __type: 'separator' },
          {
            __label: _('Next Comment'),
            __icon: fluentUIcons.fluentUIconArrowNext,
            __onClick: () => GenericFormatingEditorCommands.nextComment()
          },
          {
            __label: _('Previous Comment'),
            __icon: fluentUIcons.fluentUIconArrowPrevious,
            __onClick: () => GenericFormatingEditorCommands.previousComment()
          },
          { __type: 'separator' },
          {
            __label: _('Show Comments'),
            __icon: fluentUIcons.fluentUIconCommentMultiple,
            __onClick: () => GenericFormatingEditorCommands.toggleCommentsVisibility(false)
          },
          {
            __label: _('Hide Comments'),
            __icon: fluentUIcons.fluentUIconCommentMultiple,
            __onClick: () => GenericFormatingEditorCommands.toggleCommentsVisibility(true)
          },
          { __type: 'separator' },
          {
            __label: _('Filter by Reviewer'),
            __icon: fluentUIcons.fluentUIconSearch,
            __onClick: () => GenericFormatingEditorCommands.promptReviewAuthorFilter()
          },
          {
            __label: _('Only My Markup'),
            __icon: fluentUIcons.fluentUIconCommentMultiple,
            __onClick: () => GenericFormatingEditorCommands.setReviewFilterToMe()
          },
          {
            __label: _('Only Insertions'),
            __icon: fluentUIcons.fluentUIconCheckmark,
            __onClick: () => GenericFormatingEditorCommands.setReviewFilterInsertions()
          },
          {
            __label: _('Only Deletions'),
            __icon: fluentUIcons.fluentUIconDismiss,
            __onClick: () => GenericFormatingEditorCommands.setReviewFilterDeletions()
          },
          {
            __label: _('Clear Filters'),
            __icon: fluentUIcons.fluentUIconDismiss,
            __onClick: () => GenericFormatingEditorCommands.clearReviewFilters()
          }
        ]
      }
    }
  },
  ReviewCompareSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconHistory}</div>`,
      __label: _('Compare'),
      __description: _(
        'Compare — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Compare Document'),
            __icon: fluentUIcons.fluentUIconHistory,
            __onClick: () => GenericFormatingEditorCommands.compareDocument()
          },
          {
            __label: _('Combine Document'),
            __icon: fluentUIcons.fluentUIconTableCellsMerge,
            __onClick: () => GenericFormatingEditorCommands.combineDocument()
          },
          { __type: 'separator' },
          {
            __label: _('Clear Compare'),
            __icon: fluentUIcons.fluentUIconDismiss,
            __onClick: () => GenericFormatingEditorCommands.clearCompareTargets()
          }
        ]
      }
    }
  },

  CommentMultipleSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconCommentMultiple}</div>`,
      __label: _('Filter Comments'),
      __description: _(
        'Filter Comments — Add a comment for feedback, review notes, or collaboration threads.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Show Comments'),
            __icon: fluentUIcons.fluentUIconCommentMultiple,
            __onClick: () => GenericFormatingEditorCommands.toggleCommentsVisibility(false)
          },
          {
            __label: _('Hide Comments'),
            __icon: fluentUIcons.fluentUIconCommentMultiple,
            __onClick: () => GenericFormatingEditorCommands.toggleCommentsVisibility(true)
          }
        ]
      }
    }
  },

  AcceptRevisionSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconCheckmark}</div>`,
      __label: _('Accept Revision'),
      __description: _(
        'Accept Revision — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Accept Selection'),
            __icon: fluentUIcons.fluentUIconCheckmark,
            __onClick: () => GenericFormatingEditorCommands.acceptSelection()
          },
          {
            __label: _('Accept and Next'),
            __icon: fluentUIcons.fluentUIconArrowNext,
            __onClick: () => GenericFormatingEditorCommands.acceptAndNext()
          },
          { __type: 'separator' },
          {
            __label: _('Accept All Changes'),
            __icon: fluentUIcons.fluentUIconCheckmark,
            __onClick: () => GenericFormatingEditorCommands.acceptAll()
          }
        ]
      }
    }
  },

  RejectRevisionSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDismiss}</div>`,
      __label: _('Reject Revision'),
      __description: _(
        'Reject Revision — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Reject Selection'),
            __icon: fluentUIcons.fluentUIconDismiss,
            __onClick: () => GenericFormatingEditorCommands.rejectSelection()
          },
          {
            __label: _('Reject and Next'),
            __icon: fluentUIcons.fluentUIconArrowNext,
            __onClick: () => GenericFormatingEditorCommands.rejectAndNext()
          },
          { __type: 'separator' },
          {
            __label: _('Reject All Changes'),
            __icon: fluentUIcons.fluentUIconDismiss,
            __onClick: () => GenericFormatingEditorCommands.rejectAll()
          }
        ]
      }
    }
  },

  PreviousRevisionSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowPrevious}</div>`,
      __label: _('Previous Revision'),
      __description: _(
        'Previous Revision — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Previous Change'),
            __icon: fluentUIcons.fluentUIconArrowPrevious,
            __onClick: () => GenericFormatingEditorCommands.previousChange()
          }
        ]
      }
    }
  },

  NextRevisionSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowNext}</div>`,
      __label: _('Next Revision'),
      __description: _(
        'Next Revision — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Next Change'),
            __icon: fluentUIcons.fluentUIconArrowNext,
            __onClick: () => GenericFormatingEditorCommands.nextChange()
          }
        ]
      }
    }
  },

  TrackChangesSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconHistory}</div>`,
      __label: _('Track Changes'),
      __description: _(
        'Track Changes — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Toggle Track Changes'),
            __icon: fluentUIcons.fluentUIconHistory,
            __onClick: () => GenericFormatingEditorCommands.toggleTrackChanges()
          },
          {
            __label: _('Reviewer Name'),
            __icon: fluentUIcons.fluentUIconComment,
            __onClick: () => GenericFormatingEditorCommands.setReviewAuthor()
          },
          { __type: 'separator' },
          {
            __label: _('All Markup'),
            __icon: fluentUIcons.fluentUIconPreviewLink,
            __onClick: () => GenericFormatingEditorCommands.setMarkupMode('all')
          },
          {
            __label: _('Simple Markup'),
            __icon: fluentUIcons.fluentUIconPreviewLink,
            __onClick: () => GenericFormatingEditorCommands.setMarkupMode('simple')
          },
          {
            __label: _('No Markup'),
            __icon: fluentUIcons.fluentUIconPreviewLink,
            __onClick: () => GenericFormatingEditorCommands.setMarkupMode('none')
          },
          {
            __label: _('Original'),
            __icon: fluentUIcons.fluentUIconPreviewLink,
            __onClick: () => GenericFormatingEditorCommands.setMarkupMode('original')
          }
        ]
      }
    }
  },

  MarkAllHighlightsAsReadSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconHighlightAccent}</div>`,
      __label: _('Mark All Highlights As Read'),
      __description: _(
        'Mark All Highlights As Read — Highlight selected text like a marker to draw attention during review, study, or collaboration.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Clear Highlights'),
            __icon: fluentUIcons.fluentUIconHighlightAccent,
            __onClick: () => GenericFormatingEditorCommands.markAllHighlightsAsRead()
          }
        ]
      }
    }
  },
  ReviewShowMarkupSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPreviewLink}</div>`,
      __label: _('Show Markup'),
      __description: _(
        'Show Markup — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('All Markup'),
            __icon: fluentUIcons.fluentUIconPreviewLink,
            __onClick: () => GenericFormatingEditorCommands.setMarkupMode('all')
          },
          {
            __label: _('Simple Markup'),
            __icon: fluentUIcons.fluentUIconPreviewLink,
            __onClick: () => GenericFormatingEditorCommands.setMarkupMode('simple')
          },
          {
            __label: _('No Markup'),
            __icon: fluentUIcons.fluentUIconPreviewLink,
            __onClick: () => GenericFormatingEditorCommands.setMarkupMode('none')
          },
          {
            __label: _('Original'),
            __icon: fluentUIcons.fluentUIconPreviewLink,
            __onClick: () => GenericFormatingEditorCommands.setMarkupMode('original')
          },
          { __type: 'separator' },
          {
            __label: _('Show Comments'),
            __icon: fluentUIcons.fluentUIconCommentMultiple,
            __onClick: () => GenericFormatingEditorCommands.toggleCommentsVisibility(false)
          },
          {
            __label: _('Hide Comments'),
            __icon: fluentUIcons.fluentUIconCommentMultiple,
            __onClick: () => GenericFormatingEditorCommands.toggleCommentsVisibility(true)
          }
        ]
      }
    }
  },

  AudioReaderSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconAudio}</div>`,
      __label: _('Audio Reader'),
      __description: _(
        'Audio Reader — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  ZoomSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconZoom}</div>`,
      __label: _('Zoom'),
      __description: _(
        'Zoom — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          { __label: _('Zoom'), __onClick: () => GenericFormatingEditorCommands.openZoomDialog() },
          {
            __label: _('100%'),
            __onClick: () => GenericFormatingEditorCommands.setZoomPercent(100)
          },
          {
            __label: _('Page Width'),
            __onClick: () => GenericFormatingEditorCommands.setZoomPageWidth()
          },
          {
            __label: _('One Page'),
            __onClick: () => GenericFormatingEditorCommands.setZoomOnePage()
          },
          {
            __label: _('Multiple Pages'),
            __onClick: () => GenericFormatingEditorCommands.setZoomMultiplePages()
          }
        ]
      }
    }
  },

  RulerSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconRuler}</div>`,
      __label: _('Ruler'),
      __description: _(
        'Ruler — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  NavigationSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNavigation}</div>`,
      __label: _('Menu Navigation'),
      __description: _(
        'Menu Navigation — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  ContrastSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconContrast}</div>`,
      __label: _('Contrast'),
      __description: _(
        'Contrast — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },

  DarkModeSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSun}</div>`,
      __label: _('Sun Monochromatic'),
      __description: _(
        'Sun Monochromatic — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  ViewFullScreenSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPageFit}</div>`,
      __label: _('Full Screen'),
      __description: _(
        'Full Screen — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.openFullScreen()
    }
  },
  ViewPrintLayoutSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentOnePage}</div>`,
      __label: _('Print Layout'),
      __description: _(
        'Print Layout — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.setViewMode('print')
    }
  },
  ViewOutlineSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextBulletListTree}</div>`,
      __label: _('Outline'),
      __description: _(
        'Outline — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.setViewMode('outline')
    }
  },
  ViewWebLayoutSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconGlobeDesktop}</div>`,
      __label: _('Web Layout'),
      __description: _(
        'Web Layout — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.setViewMode('web')
    }
  },
  ViewNavigationPaneSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNavigation}</div>`,
      __label: _('Navigation Pane'),
      __description: _(
        'Navigation Pane — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Navigation Pane'),
            __onClick: () => GenericFormatingEditorCommands.openNavigationPane()
          }
        ]
      }
    }
  },
  ViewZoom100Select: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconZoom}</div>`,
      __label: _('100%'),
      __description: _(
        '100% — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.setZoomPercent(100)
    }
  },
  ViewPageWidthSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPageFit}</div>`,
      __label: _('Page Width'),
      __description: _(
        'Page Width — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.setZoomPageWidth()
    }
  },
  ViewOnePageSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentOnePage}</div>`,
      __label: _('One Page'),
      __description: _(
        'One Page — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.setZoomOnePage()
    }
  },
  ViewMultiplePagesSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDocumentHeader}</div>`,
      __label: _('Multiple Pages'),
      __description: _(
        'Multiple Pages — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.setZoomMultiplePages()
    }
  },
  ViewEyeProtectionSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconContrast}</div>`,
      __label: _('Eye Protection Mode'),
      __description: _(
        'Eye Protection Mode — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.toggleEyeProtection()
    }
  },
  ViewRearrangePanesSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSideBySide}</div>`,
      __label: _('Rearrange Panes'),
      __description: _(
        'Rearrange Panes — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Rearrange Panes'),
            __onClick: () => GenericFormatingEditorCommands.rearrangePanes()
          }
        ]
      }
    }
  },
  ViewNewWindowSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconWindowText}</div>`,
      __label: _('New Window'),
      __description: _(
        'New Window — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.newWindow()
    }
  },
  ViewSplitWindowSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSplitHorizontal}</div>`,
      __label: _('Split Window'),
      __description: _(
        'Split Window — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Split Window'),
            __onClick: () => GenericFormatingEditorCommands.splitWindow()
          }
        ]
      }
    }
  },
  ViewSideBySideSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSideBySide}</div>`,
      __label: _('View Side by Side'),
      __description: _(
        'View Side by Side — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.viewSideBySide()
    }
  },
  ViewSynchronousScrollingSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconRefresh}</div>`,
      __label: _('Synchronous Scrolling'),
      __description: _(
        'Synchronous Scrolling — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.synchronousScrolling()
    }
  },
  ViewResetWindowPositionSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconHistory}</div>`,
      __label: _('Reset Window Position'),
      __description: _(
        'Reset Window Position — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.resetWindowPosition()
    }
  },

  ReadingModeSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconBookOpen}</div>`,
      __label: _('Reading Mode'),
      __description: _(
        'Reading Mode — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: []
    }
  },
  VariableSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconVariable}</div>`,
      __label: _('Variable'),
      __description: _(
        'Variable — Configure settings for this tool and apply them to your current selection.'
      ),
      // __description: _('Dynamic Element — Configure settings for this tool and apply them to your current selection.'),
      __layout: Layout.LAYOUT.SELECT,
      __nodeOrMarkName: CustomVarExtension.name,
      __selectDataProps: {
        __items: [
          { __type: 'header', __label: _('Set as Variable') },
          {
            __label: _('Set Current Selection'),
            __description: _(
              'Create a variable for just the selected text. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _(
              'Replaces the selection with a variable chip and stores its value in vars.json.'
            ),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.setVariableCurrent()
          },
          {
            __label: _('Set All Occurrences'),
            __description: _(
              'Replace every matching occurrence in the document. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _(
              'Uses the selected text as the variable value and replaces every exact match.'
            ),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.setVariableAllOccurrences()
          },
          { __type: 'separator' },
          { __type: 'header', __label: _('Unset Variable') },
          {
            __label: _('Unset Current Variable'),
            __description: _(
              'Convert the selected variable back to text. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Keeps the variable definition but removes the chip here.'),
            __tooltip: _('Select a variable to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasVariableSelection(),
            __onClick: () => GenericFormatingEditorCommands.unsetVariableCurrent()
          },
          {
            __label: _('Unset All Occurrences'),
            __description: _(
              'Convert all matching variable chips back to text. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Keeps the variable definition but removes every chip in the document.'),
            __tooltip: _('Select a variable to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasVariableSelection(),
            __onClick: () => GenericFormatingEditorCommands.unsetVariableAllOccurrences()
          },
          { __type: 'separator' },
          { __type: 'header', __label: _('Delete Variable') },
          {
            __label: _('Delete Variable Everywhere'),
            __description: _(
              'Remove from vars.json and clear all usages. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Requires confirmation before deletion.'),
            __tooltip: _('Select a variable to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasVariableSelection(),
            __onClick: () => GenericFormatingEditorCommands.deleteVariableCurrent()
          }
        ]
      },
      __selectData: []
    }
  },

  ProgrammingStyleComment: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconProgrammingStyleComment}</div>`,
      __label: _('Visibility'),
      __description: _(
        'Visibility — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ROW,
      __nodeOrMarkName: CustomProgrammingStyleCommentExtension.name,
      __onClick: () => {
        GenericFormatingEditorCommands.toggleProgrammingStyleComment()
      },
      __selectData: []
    }
  },

  SecuredContent: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconShield}</div>`,
      __label: _('Protect'),
      __description: _(
        'Protect — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ROW,
      __nodeOrMarkName: CustomSecuredContentExtension.name,
      __onClick: () => {
        GenericFormatingEditorCommands.toggleSecuredContent()
      },
      __selectData: []
    }
  },
  GenerateWithAI: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconAI}</div>`,
      __label: _('Generate...'),
      __description: _(
        'Generate... — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __nodeOrMarkName: CustomAIExtensionProps.name,
      // __onClick: () => { GenericFormatingEditorCommands.generateWithAI() },
      __selectDataProps: {
        __items: [
          {
            __label: _('Generate'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconAI}</div>`,
            __description: _(
              'Draft new text from the selection. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _(
              'Uses your selected text as the prompt and replaces it with an AI-generated continuation or rewrite.'
            ),
            __children: [
              {
                __label: _('Text'),
                __icon: `<div class="text-base-content-600 w-[22px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconAI}</div>`,
                __description: _(
                  'Generate or rewrite text. — Configure settings for this tool and apply them to your current selection.'
                ),
                __onClick: () => GenericFormatingEditorCommands.generateWithAI()
              },
              {
                __label: _('Slides'),
                __icon: `<div class="text-base-content-600 w-[22px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconSlideTextEdit}</div>`,
                __description: _(
                  'Create a slide deck. — Configure settings for this tool and apply them to your current selection.'
                ),
                __onClick: () => GenericFormatingEditorCommands.generateSlidesWithAI()
              },
              {
                __label: _('Spreadsheet'),
                __icon: `<div class="text-base-content-600 w-[22px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTableSimple}</div>`,
                __description: _(
                  'Generate a spreadsheet. — Configure settings for this tool and apply them to your current selection.'
                ),
                __onClick: () => GenericFormatingEditorCommands.generateSpreadsheetWithAI()
              },
              {
                __label: _('Design'),
                __icon: `<div class="text-base-content-600 w-[22px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconDesignIdeas}</div>`,
                __description: _(
                  'Generate a design canvas. — Configure settings for this tool and apply them to your current selection.'
                ),
                __onClick: () => GenericFormatingEditorCommands.generateDesignWithAI()
              },
              {
                __label: _('LaTeX Project'),
                __icon: `<div class="text-base-content-600 w-[22px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconCodeBlock}</div>`,
                __description: _(
                  'Create a LaTeX project. — Insert and manage a LaTeX project block (compile, preview, and keep the source tied to the document).'
                ),
                __onClick: () => GenericFormatingEditorCommands.generateLatexWithAI()
              }
            ]
          },
          {
            __label: _('Summarize'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTextNumberListLtr}</div>`,
            __description: _(
              'Condense to key points. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _(
              'Produces a concise summary that preserves the essential meaning and removes redundancy.'
            ),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.summarizeWithAI()
          },
          {
            __label: _('Translate'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTranslate}</div>`,
            __description: _(
              'Auto-detect and translate to your current app language. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Uses your current UI or active translation language as the target.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.translateWithAI()
          },
          {
            __label: _('Translate To'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTranslate}</div>`,
            __description: _(
              'Choose a specific target language. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _(
              'Opens a language picker and translates the selection to the chosen language.'
            ),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.translateToWithAI()
          },
          {
            __label: _('Rewrite'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconCheckmarkCircle}</div>`,
            __description: _(
              'Improve clarity and flow. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Rewrites while preserving meaning and tone, ideal for polishing drafts.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.rewriteWithAI()
          },
          {
            __label: _('Business Presets'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconAI}</div>`,
            __description: _(
              'Focused outputs for business readers. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Executive-ready rewrites for decision makers and investors.'),
            __disabled: true
          },
          {
            __label: _('Executive Summary'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTextNumberListLtr}</div>`,
            __description: _(
              'Summarize for decision-makers. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Creates a short, bullet-style executive summary of the selected text.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.executiveSummaryWithAI()
          },
          {
            __label: _('Investor Tone'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTextBulletList}</div>`,
            __description: _(
              'Rewrite with a business pitch tone. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Emphasizes outcomes, traction, and clarity for investor audiences.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.investorToneWithAI()
          },
          {
            __label: _('Technical Rewrite'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconCodeBlock}</div>`,
            __description: _(
              'Make it more technical and precise. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Uses precise technical language while preserving meaning.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.technicalRewriteWithAI()
          },
          {
            __label: _('Expand'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconAddCircle}</div>`,
            __description: _(
              'Add detail and examples. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Elaborates on your text with supporting details and richer explanations.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.expandWithAI()
          },
          {
            __label: _('Shorten'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTextGrammarCheckmark}</div>`,
            __description: _(
              'Make it tighter. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Reduces length while keeping the core meaning intact.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.shortenWithAI()
          },
          {
            __label: _('Fix Grammar'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTextGrammarCheckmark}</div>`,
            __description: _(
              'Correct grammar and spelling. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Fixes grammar, spelling, and punctuation without changing style.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.fixGrammarWithAI()
          },
          {
            __label: _('Bulletize'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTextBulletList}</div>`,
            __description: _(
              'Turn into bullet points. — Start or toggle a bulleted list for highlights, checklists, and short points.'
            ),
            __detail: _('Transforms paragraphs into a structured bullet list for scannability.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.bulletizeWithAI()
          },
          {
            __label: _('Outline'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconList}</div>`,
            __description: _(
              'Create a structured outline. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Builds a hierarchy of headings and subpoints from the selection.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.outlineWithAI()
          },
          {
            __label: _('Action Items'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTaskListLtr}</div>`,
            __description: _(
              'Extract tasks. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Finds and lists actionable items with clear verbs.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.extractActionItemsWithAI()
          },
          {
            __label: _('Simplify'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconTextGrammarCheckmark}</div>`,
            __description: _(
              'Make it easy to read. — Configure settings for this tool and apply them to your current selection.'
            ),
            __detail: _('Rewrites for clarity and readability for a broader audience.'),
            __tooltip: _('Select text to enable'),
            __disabled: () => !GenericFormatingEditorCommands.hasSelection(),
            __onClick: () => GenericFormatingEditorCommands.simplifyWithAI()
          }
        ]
      }
    }
  },
  AnimationSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconWindowBrush}</div>`,
      __label: _('Animation'),
      __description: _(
        'Animation — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.BUTTON_PICKER,
      __selectDataProps: {
        __items: [
          {
            __label: _('None'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconClipboardBrush}</div>`,
            __onClick: () => GenericFormatingEditorCommands.unwrapAnimation()
          },
          {
            __label: _('Fade'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconPreviewLink}</div>`,
            __onClick: () => GenericFormatingEditorCommands.wrapWithAnimation('fade-in', 1)
          },
          {
            __label: _('Fly In'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconArrowNext}</div>`,
            __onClick: () => GenericFormatingEditorCommands.wrapWithAnimation('fly-in', 1)
          },
          {
            __label: _('Zoom In'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconSearch}</div>`,
            __onClick: () => GenericFormatingEditorCommands.wrapWithAnimation('zoom-in', 1)
          },
          {
            __label: _('Wipe'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconColumnTriple}</div>`,
            __onClick: () => GenericFormatingEditorCommands.wrapWithAnimation('wipe', 1)
          },
          {
            __label: _('Float In'),
            __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconArrowSort}</div>`,
            __onClick: () => GenericFormatingEditorCommands.wrapWithAnimation('float-in', 1)
          }
        ]
      }
    }
  },
  AnimationPainter: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconWindowBrush}</div>`,
      __label: _('Animation Painter'),
      __description: _(
        'Animation Painter — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.applyAnimationPainter()
    }
  },
  AnimationPreview: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPreviewLink}</div>`,
      __label: _('Animation Preview'),
      __description: _(
        'Animation Preview — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __direction: 'merge',
      __onClick: () => GenericFormatingEditorCommands.previewAnimations(),
      __selectData: [
        {
          __label: _('Preview'),
          __onClick: () => GenericFormatingEditorCommands.previewAnimations()
        }
      ]
    }
  },
  AnimationPane: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconStarSettings}</div>`,
      __label: _('Animation Pane'),
      __description: _(
        'Animation Pane — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.openAnimationPane()
    }
  },
  AnimationDelete: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPreviewLink}</div>`,
      __label: _('Delete Animation'),
      __description: _(
        'Delete Animation — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __direction: 'merge',
      __selectDataProps: {
        __items: [
          {
            __label: _('Remove from Selection'),
            __onClick: () => GenericFormatingEditorCommands.unwrapAnimation()
          },
          {
            __label: _('Clear All Animations'),
            __onClick: () => GenericFormatingEditorCommands.clearAllAnimation()
          }
        ]
      }
    }
  },

  TableToolsViewGridlinesButton: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconWindowBrush}</div>`,
      __label: _('View Gridlines'),
      __description: _(
        'View Gridlines — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.BUTTON,

      __direction: Layout.DIRECTION.HORIZONTAL
      // __nodeOrMarkName: CustomAIExtension.name,
      // __onClick: () => { GenericFormatingEditorCommands.wrapWithAnimation('zoom-in', 1) },
      /* __selectData: [{
        __label: _('None'),
        __icon: `<div class="text-base-content-600 w-[25px] h-5 max-w-[max-content]">${fluentUIcons.fluentUIconClipboardBrush}</div>`,
        // __keybinding: 'Ctrl+Shift+A',
        // __value: 'paste_keep_source_formatting',
        __onClick: () => {
          //
        },
      },], */
    }
  },

  //
  test: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconFontDecrease}</div>`,
      __label: _('Font'),
      __description: _(
        'Font — Configure settings for this tool and apply them to your current selection.'
      )
    }
  }
}

export const TableLayoutFormattingMap: Record<string, GenericFormattingComponentType> = {
  // --- GROUP: Table ---
  TableProperties: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableSettings}</div>`,
      __label: _('Table Properties'),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.openTableProperties()
      }
    }
  },
  ViewGridlines: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableGrid}</div>`,
      __label: _('View Gridlines'),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.toggleTableGridlines()
      }
    }
  },

  // --- GROUP: Draw ---
  DrawTable: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableDraw}</div>`,
      __label: _('Draw Table'),
      __layout: Layout.LAYOUT.COLUMN,
      __onClick: () => {
        GenericFormatingEditorCommands.drawTableMode()
      }
    }
  },
  Eraser: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconEraser}</div>`,
      __label: _('Eraser'),
      __layout: Layout.LAYOUT.COLUMN,
      __onClick: () => {
        GenericFormatingEditorCommands.tableEraserMode()
      }
    }
  },

  // --- GROUP: Rows & Columns ---
  TableDeleteSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableDelete}</div>`,
      __label: _('Delete'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Delete Cells'),
            __icon: '<i class="ph-light ph-selection-foreground"></i>' // no Fluent icon exists
            // __onClick: () => GenericFormatingEditorCommands.deleteColumn()
          },
          {
            __label: _('Delete Columns'),
            __icon: fluentUIcons.fluentUIconDeleteColumn,
            __onClick: () => GenericFormatingEditorCommands.deleteColumn()
          },
          {
            __label: _('Delete Rows'),
            __icon: fluentUIcons.fluentUIconDeleteRow,
            __onClick: () => GenericFormatingEditorCommands.deleteRow()
          },
          {
            __label: _('Delete Table'),
            __icon: fluentUIcons.fluentUIconTableDelete,
            __onClick: () => GenericFormatingEditorCommands.deleteTable()
          }
        ]
      }
    }
  },
  TableInsertSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableInsertRow}</div>`,
      __label: _('Insert'),
      __layout: Layout.LAYOUT.SELECT,
      // __selectData: [
      __selectDataProps: {
        __items: [
          {
            __label: _('Insert Above'),
            __icon: fluentUIcons.fluentUIconTableInsertRowBefore,
            __onClick: () => GenericFormatingEditorCommands.addRowBefore()
          },
          {
            __label: _('Insert Below'),
            __icon: fluentUIcons.fluentUIconTableInsertRowAfter,
            __onClick: () => GenericFormatingEditorCommands.addRowAfter()
          },
          {
            __label: _('Insert Left'),
            __icon: fluentUIcons.fluentUIconTableInsertColumnLeft,
            __onClick: () => GenericFormatingEditorCommands.addColumnBefore()
          },
          {
            __label: _('Insert Right'),
            __icon: fluentUIcons.fluentUIconTableInsertColumnRight,
            __onClick: () => GenericFormatingEditorCommands.addColumnAfter()
          }
        ]
      }
    }
  },

  // --- GROUP: Merge ---
  MergeCells: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableCellsMerge}</div>`,
      __label: _('Merge Cells'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Merge All'),
            __icon: fluentUIcons.fluentUIconTableCellsMerge,
            __onClick: () => GenericFormatingEditorCommands.mergeCells()
          },
          {
            __label: _('Merge Horizontally'),
            __icon: fluentUIcons.fluentUIconTableCellsMerge,
            __onClick: () => GenericFormatingEditorCommands.mergeCellsHorizontal()
          },
          {
            __label: _('Merge Vertically'),
            __icon: fluentUIcons.fluentUIconTableCellsMerge,
            __onClick: () => GenericFormatingEditorCommands.mergeCellsVertical()
          },
          {
            __label: _('Unmerge'),
            __icon: fluentUIcons.fluentUIconTableCellsMerge,
            __onClick: () => GenericFormatingEditorCommands.splitCell()
          }
        ]
      }
    }
  },
  SplitCells: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableCellsSplit}</div>`,
      __label: _('Split Cells'),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.splitCell()
      }
    }
  },
  SplitTable: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableSplit}</div>`,
      __label: _('Split Table'),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.splitTable()
      }
    }
  },

  // --- GROUP: Cell Size ---
  AutoFit: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableResize}</div>`,
      __label: _('AutoFit'),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: [
        {
          __label: _('AutoFit Contents'),
          __onClick: () => GenericFormatingEditorCommands.fastCalculation()
        },
        {
          __label: _('AutoFit Window'),
          __onClick: () => GenericFormatingEditorCommands.fastCalculation()
        },
        {
          __label: _('Fixed Column Width'),
          __onClick: () => GenericFormatingEditorCommands.fastCalculation()
        }
      ]
    }
  },
  CellHeight: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconRowHeight}</div>`,
      __label: _('Row Height'),
      __layout: Layout.LAYOUT.ROW
    }
  },
  CellWidth: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconColumnWidth}</div>`,
      __label: _('Column Width'),
      __layout: Layout.LAYOUT.ROW
    }
  },

  // --- GROUP: Alignment ---
  // Note: Alignment uses a 3x3 grid in the real UI.
  // For the map, we use the specific icons shown in your image.
  TextAlignMatrix: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTextAlignCenter}</div>`,
      __label: _('Alignment'),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.alignCenter()
      }
    }
  },
  TextDirection: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTextDirection}</div>`,
      __label: _('Text Direction'),
      __layout: Layout.LAYOUT.COLUMN,
      __onClick: () => {
        GenericFormatingEditorCommands.rotateText()
      }
    }
  },

  // --- GROUP: Data ---
  Formula: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconMathFormula}</div>`,
      __label: _('Formula'),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.fastCalculation()
      }
    }
  },
  Sort: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconArrowSort}</div>`,
      __label: _('Sort'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Sort A → Z'),
            __icon: fluentUIcons.fluentUIconArrowSort,
            __onClick: () => GenericFormatingEditorCommands.sortAscending()
          },
          {
            __label: _('Sort Z → A'),
            __icon: fluentUIcons.fluentUIconArrowSort,
            __onClick: () => GenericFormatingEditorCommands.sortDescending()
          }
        ]
      }
    }
  },
  FastCalculation: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconStarSettings}</div>`,
      __label: _('Fast Calculation'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Auto Sum'),
            __onClick: () => GenericFormatingEditorCommands.fastCalculation()
          },
          {
            __label: _('Average'),
            __onClick: () => GenericFormatingEditorCommands.fastCalculation()
          },
          { __label: _('Count'), __onClick: () => GenericFormatingEditorCommands.fastCalculation() }
        ]
      }
    }
  },
  ConvertTableToText: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTable}</div>`,
      __label: _('Convert Table to Text'),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.convertTableToText()
      }
    }
  },
  RepeatHeaderRows: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTableGrid}</div>`,
      __label: _('Repeat Header Rows'),
      __layout: Layout.LAYOUT.ROW,
      __onClick: () => {
        GenericFormatingEditorCommands.repeatHeaderRows()
      }
    }
  },
  TableSelect: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconCursor}</div>`,
      __label: _('Select'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Select Cell'),
            __onClick: () => GenericFormatingEditorCommands.selectTableCell()
          },
          {
            __label: _('Select Row'),
            __onClick: () => GenericFormatingEditorCommands.selectTableRow()
          },
          {
            __label: _('Select Column'),
            __onClick: () => GenericFormatingEditorCommands.selectTableColumn()
          },
          {
            __label: _('Select Table'),
            __onClick: () => GenericFormatingEditorCommands.selectTable()
          }
        ]
      }
    }
  }
}

export const TranslationFormattingMap: Record<string, GenericFormattingComponentType> = {
  // --- GROUP: View Modes ---
  TranslationAddNew: {
    component: GenericFormattingComponent,
    props: {
      __icon:
        '<i class="ph-bold ph-translate text-[20px]"></i><i class="ph-bold ph-plus text-[13px]"></i>',
      __label: _('New translation'),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: AddTranslationPicker,
      __selectDataProps: {}
    }
  },
  TranslationList: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTranslate}</div>`,
      __label: _('Translations'),
      __layout: Layout.LAYOUT.SELECT,
      __selectData: ListTranslation,
      __selectDataProps: {}
    }
  },
  TranslationViewMode: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconDualScreen}</div>`,
      __label: _('View Mode'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Side-by-Side'),
            __icon: fluentUIcons.fluentUIconSideBySide
            // __onClick: () => TranslationCommands.setViewMode('side-by-side')
          },
          {
            __label: _('Document Flow'),
            __icon: fluentUIcons.fluentUIconTextWrap
            // __onClick: () => TranslationCommands.setViewMode('flow')
          },
          {
            __label: _('Focus Mode (Target Only)'),
            // Using Phosphor for Eye-Slash/Focus effect
            __icon: '<i class="ph-light ph-eye-slash"></i>'
            // __onClick: () => TranslationCommands.setViewMode('target-only')
          }
        ]
      }
    }
  },

  // --- GROUP: Language ---
  TargetLanguage: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconLocalLanguage}</div>`,
      __label: _('Target'),
      __layout: Layout.LAYOUT.SELECT,
      __value: 'French (FR)'
      // __selectDataProps: { __items: SupportedLanguagesList }
    }
  },

  // --- GROUP: Workflow ---
  AutoTranslate: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconTranslateAuto}</div>`,
      __label: _('Translate Segment'),
      __layout: Layout.LAYOUT.COLUMN
      // __tooltip: _('Translate current block using AI')
    }
  },
  TranslationMemory: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconDatabaseSearch}</div>`,
      __label: _('TM Lookup'),
      __layout: Layout.LAYOUT.ROW
    }
  },

  // --- GROUP: Review & QA ---
  StatusSelect: {
    component: GenericFormattingComponent,
    props: {
      __label: _('Status'),
      __layout: Layout.LAYOUT.SELECT,
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconCheckmarkCircle}</div>`,
      __selectDataProps: {
        __items: [
          {
            __label: _('Draft'),
            __icon: '<i class="ph-light ph-pencil-line"></i>'
          },
          {
            __label: _('Translated'),
            __icon: '<i class="ph-light ph-translate"></i>'
          },
          {
            __label: _('Approved'),
            __icon: '<i class="ph-light ph-seal-check"></i>'
          }
        ]
      }
    }
  },
  ConsistencyCheck: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconSearchInfo}</div>`,
      __label: _('Verify Consistency'),
      __layout: Layout.LAYOUT.COLUMN
    }
  },

  // --- GROUP: Export ---
  ProfessionalExport: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px]">${fluentUIcons.fluentUIconCloudArrowUp}</div>`,
      __label: _('Export'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Final Document (PDF)'),
            __icon: '<i class="ph-light ph-file-pdf"></i>'
          },
          {
            __label: _('Translation Exchange (XLIFF)'),
            __icon: fluentUIcons.fluentUIconBraces
          },
          {
            __label: _('Bilingual Table (DOCX)'),
            __icon: '<i class="ph-light ph-file-doc"></i>'
          }
        ]
      }
    }
  }
}

// Define all buttons here
// export const GenericFormattingComponentMap = {
export const GenericImageEditingComponentMap2: Record<string, GenericFormattingComponentType> = {
  Move: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600  w-[20px] max-w-[max-content]">${spectrumIcons.moveTool}</div>`,
      __label: _('Move'),
      __description: _(
        'Move — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        /*  */
      }
      // __disabled: true
    }
  }
  //...
}

export const iconWrap = (svg: string, color: string = 'text-base-content') =>
  `<div class="${color} w-[20px] max-w-[max-content]">${svg}</div>`

export const GenericImageEditingComponentMap: Record<string, GenericFormattingComponentType> = {
  /** =========================
   * Selection & Move
   * ========================= */
  Move: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.moveTool),
      __label: _('Move'),
      __description: _(
        'Move layers and selections — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // GenericFormatingEditorCommands.insertDesign()
      }
    }
  },

  Marquee: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.rectangularMarqueeTool),
      __label: _('Rectangular Marquee'),
      __description: _(
        'Select rectangular areas — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('marquee')
      }
    }
  },

  Lasso: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.lassoTool),
      __label: _('Lasso'),
      __description: _(
        'Freehand selection — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('lasso')
      }
    }
  },

  MagicWand: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.magicWandTool),
      __label: _('Magic Wand'),
      __description: _(
        'Select pixels by color — Change color to improve hierarchy, categorize content, and make key information stand out.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('magicWand')
      }
    }
  },

  /** =========================
   * Crop & Measure
   * ========================= */
  Crop: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.cropTool),
      __label: _('Crop'),
      __description: _('Crop the canvas — Crop the selected image to focus on the important area.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('crop')
      }
    }
  },

  Eyedropper: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.eyedropperTool),
      __label: _('Eyedropper'),
      __description: _(
        'Sample colors — Change color to improve hierarchy, categorize content, and make key information stand out.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('eyedropper')
      }
    }
  },

  /** =========================
   * Retouching & Painting
   * ========================= */
  Healing: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.healingBrushTool),
      __label: _('Healing Brush'),
      __description: _(
        'Heal imperfections — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('healing')
      }
    }
  },

  Brush: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.brushTool),
      __label: _('Brush'),
      __description: _(
        'Paint with brush — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('brush')
      }
    }
  },

  Stamp: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.cloneStampTool),
      __label: _('Clone Stamp'),
      __description: _(
        'Clone pixels — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('stamp')
      }
    }
  },

  Eraser: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.eraserTool),
      __label: _('Eraser'),
      __description: _(
        'Erase pixels — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('eraser')
      }
    }
  },

  Gradient: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.gradientTool, 'bg-white'),
      __label: _('Gradient'),
      __description: _(
        'Gradient — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('eraser')
      }
    }
  },

  Blur: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.blurTool),
      __label: _('Blur'),
      __description: _(
        'Blur — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('eraser')
      }
    }
  },

  Dodge: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.dodgeTool),
      __label: _('Dodge'),
      __description: _(
        'Dodge — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('eraser')
      }
    }
  },

  /** =========================
   * Vector & Text
   * ========================= */
  Pen: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.penTool),
      __label: _('Pen'),
      __description: _(
        'Draw vector paths — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('pen')
      }
    }
  },

  Type: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.typeTool),
      __label: _('Type'),
      __description: _(
        'Add text — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('type')
        GenericFormatingEditorCommands.insertDesignItemText()
      }
    }
  },

  Select: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.selectTool),
      __label: _('Select'),
      __description: _(
        'Select — Select content or objects based on the current tool/mode (useful for multi-editing and bulk changes).'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('type')
        GenericFormatingEditorCommands.insertDesignItemText()
      }
    }
  },

  Rectangle: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.rectangleTool),
      __label: _('Rectangle'),
      __description: _(
        'Rectangle — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('eraser')
        // canvasCommands.setSelectedTool(ImageEditingTools.Rectangle)
        // GenericFormatingEditorCommands.drawDesignItemRectangle()
      }
    }
  },

  Image: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.spectrumIconImage),
      __label: _('Type'),
      __description: _(
        'Add image — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        // setActiveTool('type')
        GenericFormatingEditorCommands.insertDesignItemImage()
      }
    }
  },

  /** =========================
   * Navigation
   * ========================= */
  Hand: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.handTool),
      __label: _('Hand'),
      __description: _(
        'Pan canvas — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        openActiveDevFeatureModal(_('Hand'), _('Pan canvas'))
      }
    }
  },

  Zoom: {
    component: GenericFormattingComponent,
    props: {
      __icon: iconWrap(spectrumIcons.zoomTool),
      __label: _('Zoom'),
      __description: _(
        'Zoom in or out — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        openActiveDevFeatureModal(_('Zoom'), _('Zoom in or out'))
      }
    }
  },

  ColorSwitcher: {
    component: ColorSwitcher,
    props: {
      // __icon: iconWrap(spectrumIcons.zoomTool),
      // __label: _('Zoom'),
      // __description: _('Zoom in or out — Configure settings for this tool and apply them to your current selection.'),
      // __layout: Layout.LAYOUT.ICON,
      // __onClick: () => {
      //   // setActiveTool('zoom')
      // }
    }
  }
}

// Best-effort guard: if a button is marked disabled (boolean) but still clickable in some UIs,
// explain that it’s under development instead of doing nothing.
for (const entry of Object.values(GenericFormattingComponentMap)) {
  if (!entry) continue
  if (!entry.props || typeof entry.props !== 'object') continue
  const props: any = entry.props
  if (props.__disabled === true && typeof props.__onClick !== 'function') {
    const label = String(props.__label || props.__description || _('This feature'))
    const description = String(props.__description || '')
    props.__onClick = () => openActiveDevFeatureModal(label, description)
  }
}

const excelPlaceholder = (
  label: string,
  icon: string = fluentUIcons.fluentUIconMoreCircle
): GenericFormattingComponentType => ({
  component: GenericFormattingComponent,
  props: {
    __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${icon}</div>`,
    __label: _(label),
    __description: _(
      `${label} — This feature is available in the UI but still under active development and may not work as expected yet. We’re sorry about that.`
    ),
    __layout: Layout.LAYOUT.ICON,
    __disabled: true,
    __onClick: () => openActiveDevFeatureModal(_(label), _(label))
  }
})

const excelFunctionCategory = (
  label: string,
  icon: string,
  functions: string[]
): GenericFormattingComponentType => ({
  component: GenericFormattingComponent,
  props: {
    __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${icon}</div>`,
    __label: _(label),
    __description: _(`${label} — Insert one of these functions into the active cell.`),
    __layout: Layout.LAYOUT.SELECT,
    __selectDataProps: {
      __items: functions.map((fn) => ({
        __label: fn,
        __icon: fluentUIcons.fluentUIconMathFormula,
        __onClick: () => GenericFormatingEditorCommands.insertSheetFunction(fn)
      }))
    }
  }
})

export const ExcelFormattingComponentMap: Record<string, GenericFormattingComponentType> = {
  ImportExcel: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class=\"text-base-content-600 w-[20px] max-w-[max-content]\">${fluentUIcons.fluentUIconCloudArrowUp}</div>`,
      __label: _('Import'),
      __description: _(
        'Import Excel or CSV into the active sheet — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.importSpreadsheet()
      }
    }
  },
  ExportExcel: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class=\"text-base-content-600 w-[20px] max-w-[max-content]\">${fluentUIcons.fluentUIconArrowDown}</div>`,
      __label: _('Export'),
      __description: _(
        'Export the active spreadsheet — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.exportSpreadsheet()
      }
    }
  },
  AutoSum: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconMathFormula}</div>`,
      __label: _('AutoSum'),
      __description: _(
        'AutoSum — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.autoSum()
      }
    }
  },
  RecentlyUsed: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconHistory}</div>`,
      __label: _('Recently Used'),
      __description: _('Recently Used — Insert the function you used most recently.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.insertRecentSheetFunction()
      }
    }
  },
  Financial: excelFunctionCategory('Financial', fluentUIcons.fluentUIconNumberSymbol, [
    'PMT',
    'FV',
    'PV',
    'NPV',
    'RATE',
    'IPMT',
    'PPMT'
  ]),
  Logical: excelFunctionCategory('Logical', fluentUIcons.fluentUIconBraces, [
    'IF',
    'IFERROR',
    'AND',
    'OR',
    'NOT',
    'XOR'
  ]),
  Text: excelFunctionCategory('Text', fluentUIcons.fluentUIconWindowText, [
    'CONCATENATE',
    'LEFT',
    'RIGHT',
    'MID',
    'LEN',
    'TRIM',
    'UPPER',
    'LOWER',
    'TEXT',
    'SUBSTITUTE'
  ]),
  DateTime: excelFunctionCategory('Date & Time', fluentUIcons.fluentUIconDocumentHeader, [
    'TODAY',
    'NOW',
    'DATE',
    'YEAR',
    'MONTH',
    'DAY',
    'HOUR',
    'MINUTE',
    'WEEKDAY',
    'DATEDIF'
  ]),
  LookupReference: excelFunctionCategory('Lookup & Reference', fluentUIcons.fluentUIconSearch, [
    'VLOOKUP',
    'HLOOKUP',
    'INDEX',
    'MATCH',
    'OFFSET',
    'INDIRECT',
    'CHOOSE'
  ]),
  MathTrig: excelFunctionCategory('Math & Trig', fluentUIcons.fluentUIconMathFormula, [
    'SUM',
    'SUMIF',
    'AVERAGE',
    'COUNT',
    'COUNTIF',
    'MAX',
    'MIN',
    'ROUND',
    'ABS',
    'SQRT',
    'POWER',
    'MOD'
  ]),
  MoreFunctions: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconMoreCircle}</div>`,
      __label: _('More Functions'),
      __description: _('More Functions — Type any formula and insert it into the active cell.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.insertSheetFunction()
      }
    }
  },
  FunctionInsert: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconMathFormula}</div>`,
      __label: _('Insert Function'),
      __description: _('Insert Function — Build a formula and insert it into the active cell.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.insertSheetFunction()
      }
    }
  },
  NameManager: excelPlaceholder('Name Manager', fluentUIcons.fluentUIconNumberSymbol),
  DefineName: excelPlaceholder('Define Name', fluentUIcons.fluentUIconNumberSymbol),
  UseInFormula: excelPlaceholder('Use in Formula', fluentUIcons.fluentUIconMathFormula),
  CreateFromSelection: excelPlaceholder(
    'Create from Selection',
    fluentUIcons.fluentUIconSelectAllOn
  ),
  TracePrecedents: excelPlaceholder('Trace Precedents', fluentUIcons.fluentUIconArrowPrevious),
  TraceDependents: excelPlaceholder('Trace Dependents', fluentUIcons.fluentUIconArrowNext),
  RemoveArrows: excelPlaceholder('Remove Arrows', fluentUIcons.fluentUIconDismiss),
  ShowFormulas: excelPlaceholder('Show Formulas', fluentUIcons.fluentUIconWindowText),
  ErrorChecking: excelPlaceholder('Error Checking', fluentUIcons.fluentUIconCheckmark),
  EvaluateFormula: excelPlaceholder('Evaluate Formula', fluentUIcons.fluentUIconMathFormula),
  WatchWindow: excelPlaceholder('Watch Window', fluentUIcons.fluentUIconWindowConsole),
  CalculationOptions: excelPlaceholder('Calculation Options', fluentUIcons.fluentUIconStarSettings),
  CalculateNow: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconRefresh}</div>`,
      __label: _('Calculate Now'),
      __description: _('Calculate Now — Recalculate all formulas in the active sheet.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.recalculateSheet()
      }
    }
  },
  CalculateSheet: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconRefresh}</div>`,
      __label: _('Calculate Sheet'),
      __description: _('Calculate Sheet — Recalculate all formulas in the active sheet.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.recalculateSheet()
      }
    }
  },
  NumberFormat: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNumberSymbol}</div>`,
      __label: _('Number Format'),
      __description: _(
        'Number Format — Start or toggle a numbered list for steps, procedures, or ranked items.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Number'),
            __icon: fluentUIcons.fluentUIconNumberSymbol,
            __onClick: () => GenericFormatingEditorCommands.setNumberFormat()
          },
          {
            __label: _('Currency'),
            __icon: fluentUIcons.fluentUIconNumberSymbol,
            __onClick: () => GenericFormatingEditorCommands.setCurrencyFormat()
          },
          {
            __label: _('Percent'),
            __icon: fluentUIcons.fluentUIconNumberSymbol,
            __onClick: () => GenericFormatingEditorCommands.setPercentFormat()
          },
          {
            __label: _('Comma'),
            __icon: fluentUIcons.fluentUIconNumberSymbol,
            __onClick: () => GenericFormatingEditorCommands.setCommaFormat()
          }
        ]
      }
    }
  },
  PercentStyle: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNumberSymbol}</div>`,
      __label: _('Percent Style'),
      __description: _(
        'Percent Style — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.setPercentFormat()
      }
    }
  },
  CommaStyle: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNumberSymbol}</div>`,
      __label: _('Comma Style'),
      __description: _(
        'Comma Style — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.setCommaFormat()
      }
    }
  },
  IncreaseDecimal: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNumberSymbol}</div>`,
      __label: _('Increase Decimal'),
      __description: _(
        'Increase Decimal — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.increaseDecimal()
      }
    }
  },
  DecreaseDecimal: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconNumberSymbol}</div>`,
      __label: _('Decrease Decimal'),
      __description: _(
        'Decrease Decimal — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.decreaseDecimal()
      }
    }
  },
  ConditionalFormatting: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColor}</div>`,
      __label: _('Conditional Formatting'),
      __description: _(
        'Conditional Formatting — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => GenericFormatingEditorCommands.openConditionalFormatting()
    }
  },
  FormatAsTable: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTable}</div>`,
      __label: _('Format as Table'),
      __description: _('Format as Table — Apply a header style and banded rows to the selection.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.formatSheetAsTable()
      }
    }
  },
  CellStyles: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPaintBucket}</div>`,
      __label: _('Cell Styles'),
      __description: _(
        'Cell Styles — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Style Good'),
            __onClick: () => GenericFormatingEditorCommands.applySheetStylePreset('good')
          },
          {
            __label: _('Style Bad'),
            __onClick: () => GenericFormatingEditorCommands.applySheetStylePreset('bad')
          },
          {
            __label: _('Style Neutral'),
            __onClick: () => GenericFormatingEditorCommands.applySheetStylePreset('neutral')
          },
          {
            __label: _('Style Heading'),
            __onClick: () => GenericFormatingEditorCommands.applySheetStylePreset('heading')
          },
          {
            __label: _('Style Total'),
            __onClick: () => GenericFormatingEditorCommands.applySheetStylePreset('total')
          }
        ]
      }
    }
  },
  Fill: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconPaintBucket}</div>`,
      __label: _('Fill'),
      __description: _(
        'Fill — Fill the selection from its first row or column, extending series when possible.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Fill Down'),
            __icon: fluentUIcons.fluentUIconArrowDown,
            __onClick: () => GenericFormatingEditorCommands.fillSheetDown()
          },
          {
            __label: _('Fill Right'),
            __icon: fluentUIcons.fluentUIconArrowNext,
            __onClick: () => GenericFormatingEditorCommands.fillSheetRight()
          },
          {
            __label: _('Fill Series'),
            __icon: fluentUIcons.fluentUIconSparkle,
            __onClick: () => GenericFormatingEditorCommands.fillSheetSeries()
          }
        ]
      }
    }
  },
  Clear: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTextClearFormatting}</div>`,
      __label: _('Clear'),
      __description: _(
        'Clear — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.clearFormatting()
      }
    }
  },
  RowHeight: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconRowHeight}</div>`,
      __label: _('Row Height'),
      __description: _(
        'Row Height — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.setRowHeight()
      }
    }
  },
  ColumnWidth: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColumnWidth}</div>`,
      __label: _('Column Width'),
      __description: _(
        'Column Width — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.setColumnWidth()
      }
    }
  },
  InsertPivotTable: excelPlaceholder('PivotTable', fluentUIcons.fluentUIconTable),
  InsertChart: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTable}</div>`,
      __label: _('Charts'),
      __description: _('Charts — Insert a chart fed by the selected spreadsheet range.'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Bar Chart'),
            __icon: fluentUIcons.fluentUIconTable,
            __onClick: () => GenericFormatingEditorCommands.insertChartFromSelection('bar')
          },
          {
            __label: _('Line Chart'),
            __icon: fluentUIcons.fluentUIconTable,
            __onClick: () => GenericFormatingEditorCommands.insertChartFromSelection('line')
          },
          {
            __label: _('Pie Chart'),
            __icon: fluentUIcons.fluentUIconTable,
            __onClick: () => GenericFormatingEditorCommands.insertChartFromSelection('pie')
          }
        ]
      }
    }
  },
  InsertSparklines: excelPlaceholder('Sparklines', fluentUIcons.fluentUIconTable),
  TextBox: excelPlaceholder('Text Box', fluentUIcons.fluentUIconNote),
  HeaderFooter: excelPlaceholder('Header & Footer', fluentUIcons.fluentUIconDocumentHeader),
  Themes: excelPlaceholder('Themes', fluentUIcons.fluentUIconApps),
  Colors: excelPlaceholder('Colors', fluentUIcons.fluentUIconColor),
  Fonts: excelPlaceholder('Fonts', fluentUIcons.fluentUIconFontDecrease),
  ScaleToFit: excelPlaceholder('Scale to Fit', fluentUIcons.fluentUIconPageFit),
  PrintArea: excelPlaceholder('Print Area', fluentUIcons.fluentUIconPageFit),
  Breaks: excelPlaceholder('Breaks', fluentUIcons.fluentUIconSplitHorizontal),
  Headings: excelPlaceholder('Headings', fluentUIcons.fluentUIconDocumentHeader),
  BringForward: excelPlaceholder('Bring Forward', fluentUIcons.fluentUIconArrowNext),
  SendBackward: excelPlaceholder('Send Backward', fluentUIcons.fluentUIconArrowPrevious),
  SelectionPane: excelPlaceholder('Selection Pane', fluentUIcons.fluentUIconNavigation),
  GetData: excelPlaceholder('Get Data', fluentUIcons.fluentUIconDocumentDataLink),
  QueriesConnections: excelPlaceholder(
    'Queries & Connections',
    fluentUIcons.fluentUIconDatabaseSearch
  ),
  RefreshAll: excelPlaceholder('Refresh All', fluentUIcons.fluentUIconRefresh),
  Filter: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconSearch}</div>`,
      __label: _('Filter'),
      __description: _(
        'Filter — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.toggleFilter()
      }
    }
  },
  Sort: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconArrowSort}</div>`,
      __label: _('Sort'),
      __description: _('Sort — Sort the selected rows by their first column.'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Sort Ascending'),
            __icon: fluentUIcons.fluentUIconArrowSort,
            __onClick: () => GenericFormatingEditorCommands.sortSheetAscending()
          },
          {
            __label: _('Sort Descending'),
            __icon: fluentUIcons.fluentUIconArrowSort,
            __onClick: () => GenericFormatingEditorCommands.sortSheetDescending()
          }
        ]
      }
    }
  },
  ShowAll: excelPlaceholder('Show All', fluentUIcons.fluentUIconSelectAllOn),
  Reapply: excelPlaceholder('Reapply', fluentUIcons.fluentUIconRefresh),
  HighlightDuplicates: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconHighlightAccent}</div>`,
      __label: _('Highlight Duplicates'),
      __description: _('Highlight Duplicates — Highlight duplicated rows in the selection.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.highlightSheetDuplicates()
      }
    }
  },
  ManageDuplicates: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDatabaseSearch}</div>`,
      __label: _('Manage Duplicates'),
      __description: _('Manage Duplicates — Highlight or remove duplicated rows in the selection.'),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Highlight Duplicates'),
            __icon: fluentUIcons.fluentUIconHighlightAccent,
            __onClick: () => GenericFormatingEditorCommands.highlightSheetDuplicates()
          },
          {
            __label: _('Remove Duplicates'),
            __icon: fluentUIcons.fluentUIconDelete,
            __onClick: () => GenericFormatingEditorCommands.removeSheetDuplicates()
          }
        ]
      }
    }
  },
  InsertDropDownList: excelPlaceholder('Insert Drop-Down List', fluentUIcons.fluentUIconList),
  Consolidate: excelPlaceholder('Consolidate', fluentUIcons.fluentUIconTableSettings),
  ShowDetail: excelPlaceholder('Show Detail', fluentUIcons.fluentUIconZoom),
  HideDetail: excelPlaceholder('Hide Detail', fluentUIcons.fluentUIconDismiss),
  EditLinks: excelPlaceholder('Edit Links', fluentUIcons.fluentUIconLink),
  Settings: excelPlaceholder('Settings', fluentUIcons.fluentUIconStarSettings),
  Advanced: excelPlaceholder('Advanced', fluentUIcons.fluentUIconMoreCircle),
  TextToColumns: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconColumnTriple}</div>`,
      __label: _('Text to Columns'),
      __description: _(
        'Text to Columns — Split the first selected column into several columns using a delimiter.'
      ),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.sheetTextToColumns()
      }
    }
  },
  RemoveDuplicates: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconDelete}</div>`,
      __label: _('Remove Duplicates'),
      __description: _('Remove Duplicates — Remove duplicated rows from the selection.'),
      __layout: Layout.LAYOUT.ICON,
      __onClick: () => {
        GenericFormatingEditorCommands.removeSheetDuplicates()
      }
    }
  },
  DataValidation: excelPlaceholder('Data Validation', fluentUIcons.fluentUIconCheckmark),
  FlashFill: excelPlaceholder('Flash Fill', fluentUIcons.fluentUIconSparkle),
  WhatIfAnalysis: excelPlaceholder('What-If Analysis', fluentUIcons.fluentUIconBranch),
  ForecastSheet: excelPlaceholder('Forecast Sheet', fluentUIcons.fluentUIconSparkle),
  Group: excelPlaceholder('Group', fluentUIcons.fluentUIconList),
  Ungroup: excelPlaceholder('Ungroup', fluentUIcons.fluentUIconList),
  Subtotal: excelPlaceholder('Subtotal', fluentUIcons.fluentUIconNumberSymbol),
  Spelling: excelPlaceholder('Spelling', fluentUIcons.fluentUIconCheckmark),
  Accessibility: excelPlaceholder('Accessibility', fluentUIcons.fluentUIconAccessibility),
  ProtectSheet: excelPlaceholder('Protect Sheet', fluentUIcons.fluentUIconShield),
  AllowEditRanges: excelPlaceholder('Allow Edit Ranges', fluentUIcons.fluentUIconEditLock),
  SmartLookup: excelPlaceholder('Smart Lookup', fluentUIcons.fluentUIconSearch),
  Insights: excelPlaceholder('Insights', fluentUIcons.fluentUIconSparkle),
  NormalView: excelPlaceholder('Normal', fluentUIcons.fluentUIconWindowText),
  PageBreakPreview: excelPlaceholder('Page Break Preview', fluentUIcons.fluentUIconSplitHorizontal),
  PageLayoutView: excelPlaceholder('Page Layout', fluentUIcons.fluentUIconDocumentHeader),
  ZoomToSelection: excelPlaceholder('Zoom to Selection', fluentUIcons.fluentUIconZoom),
  NewWindow: excelPlaceholder('New Window', fluentUIcons.fluentUIconWindowText),
  ArrangeAll: excelPlaceholder('Arrange All', fluentUIcons.fluentUIconWindowText),
  FreezePanes: {
    component: GenericFormattingComponent,
    props: {
      __icon: `<div class="text-base-content-600 w-[20px] max-w-[max-content]">${fluentUIcons.fluentUIconTableCellsMerge}</div>`,
      __label: _('Freeze Panes'),
      __description: _(
        'Freeze Panes — Configure settings for this tool and apply them to your current selection.'
      ),
      __layout: Layout.LAYOUT.SELECT,
      __selectDataProps: {
        __items: [
          {
            __label: _('Freeze Panes'),
            __icon: fluentUIcons.fluentUIconTableCellsMerge,
            __onClick: () => GenericFormatingEditorCommands.freezePanes()
          },
          {
            __label: _('Freeze Top Row'),
            __icon: fluentUIcons.fluentUIconTableCellsMerge,
            __onClick: () => GenericFormatingEditorCommands.freezeFirstRow()
          },
          {
            __label: _('Freeze First Column'),
            __icon: fluentUIcons.fluentUIconTableCellsMerge,
            __onClick: () => GenericFormatingEditorCommands.freezeFirstColumn()
          },
          {
            __label: _('Unfreeze'),
            __icon: fluentUIcons.fluentUIconTableCellsMerge,
            __onClick: () => GenericFormatingEditorCommands.unfreezePanes()
          }
        ]
      }
    }
  },
  Split: excelPlaceholder('Split', fluentUIcons.fluentUIconSplitHorizontal),
  Macros: excelPlaceholder('Macros', fluentUIcons.fluentUIconCodeBlock),
  RecordMacro: excelPlaceholder('Record Macro', fluentUIcons.fluentUIconMic),
  VisualBasic: excelPlaceholder('Visual Basic', fluentUIcons.fluentUIconCodeBlock),
  DeveloperAddIns: excelPlaceholder('Add-ins', fluentUIcons.fluentUIconApps),
  InsertControls: excelPlaceholder('Insert Controls', fluentUIcons.fluentUIconTableSettings),
  DesignMode: excelPlaceholder('Design Mode', fluentUIcons.fluentUIconDesignIdeas),
  Properties: excelPlaceholder('Properties', fluentUIcons.fluentUIconStarSettings),
  XmlSource: excelPlaceholder('XML Source', fluentUIcons.fluentUIconDocumentDataLink),
  XmlMap: excelPlaceholder('XML Map', fluentUIcons.fluentUIconDocumentDataLink),
  Highlighter: excelPlaceholder('Highlighter', fluentUIcons.fluentUIconHighlight),
  InkToShape: excelPlaceholder('Ink to Shape', fluentUIcons.fluentUIconDrawShape),
  InkToMath: excelPlaceholder('Ink to Math', fluentUIcons.fluentUIconMathFormula),
  Pen: excelPlaceholder('Pen', fluentUIcons.fluentUIconDrawShape),
  Eraser: excelPlaceholder('Eraser', fluentUIcons.fluentUIconEraser),
  Select: excelPlaceholder('Select', fluentUIcons.fluentUIconCursor),
  Rectangle: excelPlaceholder('Rectangle', fluentUIcons.fluentUIconDrawShape),
  PowerAutomate: excelPlaceholder('Power Automate', fluentUIcons.fluentUIconRefresh),
  Scripts: excelPlaceholder('Scripts', fluentUIcons.fluentUIconCodeBlock),
  RecordActions: excelPlaceholder('Record Actions', fluentUIcons.fluentUIconMic),
  GetAddIns: excelPlaceholder('Get Add-ins', fluentUIcons.fluentUIconApps),
  MyAddIns: excelPlaceholder('My Add-ins', fluentUIcons.fluentUIconApps),
  Help: excelPlaceholder('Help', fluentUIcons.fluentUIconSearchInfo),
  Training: excelPlaceholder('Training', fluentUIcons.fluentUIconBookOpen),
  Feedback: excelPlaceholder('Feedback', fluentUIcons.fluentUIconCommentAdd)
}

export const FormattingComponentMapsByCategory = {
  generic: GenericFormattingComponentMap,
  excel: ExcelFormattingComponentMap,
  tableLayout: TableLayoutFormattingMap,
  translation: TranslationFormattingMap,
  imageEditing: GenericImageEditingComponentMap,
  imageEditingAlt: GenericImageEditingComponentMap2
}
