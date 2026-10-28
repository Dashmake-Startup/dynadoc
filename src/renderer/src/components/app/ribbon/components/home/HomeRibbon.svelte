<!--
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
-->

<script lang="ts">
  import { get } from 'svelte/store'
  import { _ as base_ } from 'svelte-i18n'
  import {
    // fluentUIconClipboardPaste,
    GenericFormattingComponentMap
    // fluentUIconVariable,
    // fluentUIconShield,
    // fluentUIconShield2,
    // fluentUIconProgrammingStyleComment,
    // fluentUIconAI
  } from '../../../../common/actions/formatting'
  import type { Group, Item } from '../utils/utils'
  import GenericRibbon from '../GenericRibbon.svelte'
  import GenericGroup from '../../../../common/actions/formatting/GenericGroup.svelte'
  import Layout from '../../../../common/layout/layout'
  import ParagraphStylePicker from '../../../../common/actions/formatting/ParagraphStylePicker/ParagraphStylePicker.svelte'
  import { fluentUIcons } from '../../../../common/icons/Icons'
  import { colorStore } from '../../../../common/actions/color/ColorPicker/stores/color.store'
  import { _$_ribbonContext } from '../../../../../stores/ribbon.store'
  import SlideAutoResizeToggle from './SlideAutoResizeToggle.svelte'
  import SlideQuickStyles from './SlideQuickStyles.svelte'
  import { createExcelItem, createExcelItemSafe, createTableItem } from '../excel/utils/excelRibbonUtils'
  const _ = (key: string) => key

  function createGenericItem(key: keyof typeof GenericFormattingComponentMap, icon?: string): Item {
    const config = GenericFormattingComponentMap[key]
    return {
      id: key.toString(),
      variant: 'primary',
      body: {
        component: config.component,
        props: {
          ...config.props,
          ...(icon
            ? { __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${icon}</div>` }
            : {})
        }
      }
    }
  }

  // const dispatch = createEventDispatcher<{ command: { id: string } }>()

  // export let compact = false

  let _currentHighlightColorIndicator = $derived(`
  <div class="flex items-center justify-center gap-1">
  <div
    class="w-4 h-1 rounded-full border border-white/20 shadow-sm"
    style="background-color: ${$colorStore.selection.highlight || '#FFFF00'}"
  ></div>
</div>`)

  let _currentTextColorIndicator = $derived(`
  <div class="flex items-center justify-center gap-1">
  <div
    class="w-4 h-1 rounded-full border border-white/20 shadow-sm"
    style="background-color: ${$colorStore.selection.text || '#FFFF00'}"
  ></div>
</div>`)

  let _currentBackgroundColorIndicator = $derived(`
  <div class="flex items-center justify-center gap-1">
  <div
    class="w-4 h-1 rounded-full border border-white/20 shadow-sm"
    style="background-color: ${$colorStore.selection.background || '#FFFF00'}"
  ></div>
</div>`)

  const baseGroups: Group[] = [
    {
      id: 'clipboard',
      title: 'Clipboard',
      items: [
        {
          id: 'paste-container',
          variant: 'primary',
          body: {
            // component: PasteContainer,
            // props: { __layout: Layout.LAYOUT.SELECT }

            component: GenericFormattingComponentMap.PasteSelect.component,
            props: {
              // ...props,
              ...GenericFormattingComponentMap.PasteSelect.props,
              // __class:"xl"
              // __iconClass: `xlss`,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconClipboardPaste}</div>`

              // __layout: Layout.LAYOUT.SELECT
              // __layout: Layout.LAYOUT.ICON
            }
            /* props: (props) => ({
              // ...props,
              ...GenericFormattingComponentMap.PasteSelect.props,
              // __class:"xl"
              __iconClass: `xlss`
              // __icon: `<div class="text-base-content-600 w-30 h-10 max-w-[max-content]">${fluentUIcons.fluentUIconClipboardPaste}</div>`

              // __layout: Layout.LAYOUT.SELECT
              // __layout: Layout.LAYOUT.ICON
            }) */
          }
        },
        /*  {
          id: 'format-painter',
          // label: 'Paste',
          // icon: 'ph-clipboard-text',
          // icon: 'ph-clipboard-simple',
          // big: true,
          variant: 'primary',
          body: {
            component: GenericFormattingComponentMap.FormatPainter.component,
            props: {
              ...GenericFormattingComponentMap.FormatPainter.props,
              __layout: Layout.LAYOUT.ROW
            }
          }
        }, */
        {
          id: 'copy-container',
          body: {
            component: GenericGroup,
            props: {
              // __layout: Layout.LAYOUT.ICON,
              direction: Layout.DIRECTION.VERTICAL,
              items: [
                {
                  component: GenericFormattingComponentMap.Copy.component,
                  // component: Copy,
                  props: {
                    ...GenericFormattingComponentMap.Copy.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  component: GenericFormattingComponentMap.CopyAsText.component,
                  props: {
                    ...GenericFormattingComponentMap.CopyAsText.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                }
              ]
            }
          }
        },
        {
          id: 'format-painter-cut',
          body: {
            component: GenericGroup,
            props: {
              // __layout: Layout.LAYOUT.ICON,
              direction: Layout.DIRECTION.VERTICAL,
              items: [
                {
                  component: GenericFormattingComponentMap.Cut.component,
                  props: {
                    ...GenericFormattingComponentMap.Cut.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },

                {
                  component: GenericFormattingComponentMap.FormatPainter.component,
                  props: {
                    ...GenericFormattingComponentMap.FormatPainter.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                }
              ]
            }
          }
        }

        // { id: 'cut', label: 'Cut', icon: 'ph-scissors' },
        // { id: 'copy', label: 'Copy', icon: 'ph-copy' },
        // { id: 'format-painter', label: 'Format Painter', icon: 'ph-paint-brush-broad' }
      ]
    },
    {
      id: 'font',
      title: 'Font',
      layout: Layout.LAYOUT.COLUMN,
      items: [
        {
          id: 'top',
          body: {
            component: GenericGroup,
            props: {
              direction: Layout.DIRECTION.HORIZONTAL,
              items: [
                /* {
                  component: FormatPainter,
                  // component: FontPicker,
                  props: { __layout: Layout.LAYOUT.COLUMN }
                },
                {
                  component: FormatPainter,
                  // component: FontPicker,
                  props: { __layout: Layout.LAYOUT.COLUMN }
                }, */
                /* {
                  // component: FormatPainter,
                  component: FontPicker,
                  props: { __layout: Layout.LAYOUT.COLUMN }
                }, */
                {
                  component: GenericFormattingComponentMap.FontPicker.component,
                  props: {
                    ...GenericFormattingComponentMap.FontPicker.props,
                    __layout: Layout.LAYOUT.COLUMN
                  }
                  // }
                },
                {
                  // id: 'font-size-up',
                  // body: {
                  component: GenericFormattingComponentMap.FontSizeIncrease.component,
                  props: {
                    ...GenericFormattingComponentMap.FontSizeIncrease.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                  // }
                },
                {
                  // id: 'font-size-up',
                  // body: {
                  component: GenericFormattingComponentMap.FontSizeDecrease.component,
                  props: {
                    ...GenericFormattingComponentMap.FontSizeDecrease.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                  // }
                },
                {
                  // id: 'font-size-up',
                  // body: {
                  // component: TextChangeCase,
                  // props: { __layout: Layout.LAYOUT.SELECT }
                  id: 'text-change-case',
                  component: GenericFormattingComponentMap.TextChangeCase.component,
                  props: {
                    ...GenericFormattingComponentMap.TextChangeCase.props

                    // __layout: Layout.LAYOUT.SELECT
                  }

                  // }
                },
                {
                  // id: 'font-size-up',
                  // body: {
                  component: GenericFormattingComponentMap.TextClearFormatting.component,
                  props: {
                    ...GenericFormattingComponentMap.TextClearFormatting.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                  // }
                },
                {
                  // id: 'font-size-up',
                  // body: {
                  component: GenericFormattingComponentMap.TextClearAllFormatting.component,
                  props: {
                    ...GenericFormattingComponentMap.TextClearAllFormatting.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                  // }
                }
              ]
            }
          }
        },
        {
          id: 'bottom',
          body: {
            component: GenericGroup,
            props: {
              direction: Layout.DIRECTION.HORIZONTAL,
              items: [
                {
                  component: GenericFormattingComponentMap.TextBold.component,
                  props: {
                    ...GenericFormattingComponentMap.TextBold.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  component: GenericFormattingComponentMap.TextItalic.component,
                  props: {
                    ...GenericFormattingComponentMap.TextItalic.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  id: 'text-underline',
                  component: GenericFormattingComponentMap.TextUnderline.component,
                  props: {
                    ...GenericFormattingComponentMap.TextUnderline.props
                  }
                },
                {
                  id: 'text-strikethrough',
                  component: GenericFormattingComponentMap.TextStrikethrough.component,
                  props: {
                    ...GenericFormattingComponentMap.TextStrikethrough.props
                  }
                },
                {
                  id: 'text-superscript',
                  // body: {
                  component: GenericFormattingComponentMap.TextSuperscript.component,
                  props: {
                    ...GenericFormattingComponentMap.TextSuperscript.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                  // }
                },
                {
                  id: 'text-subscript',
                  component: GenericFormattingComponentMap.TextSubscript.component,
                  props: {
                    ...GenericFormattingComponentMap.TextSubscript.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  id: 'text-highlight',
                  body: {
                    component: GenericGroup,
                    props: {
                      direction: Layout.DIRECTION.HORIZONTAL,
                      items: [
                        {
                          id: 'text-highlight',
                          component: GenericFormattingComponentMap.TextHighlight.component,
                          props: {
                            ...GenericFormattingComponentMap.TextHighlight.props,
                            // __layout: Layout.LAYOUT.ICON
                            __label: _currentHighlightColorIndicator
                          }
                        }
                        /* {
                          id: 'text-highlight-color',
                          component: ColorPicker,
                          props: {
                            ...GenericFormattingComponentMap.TextHighlight.props,
                            __layout: Layout.LAYOUT.ICON
                          }
                        } */
                      ]
                    }
                  }
                },
                {
                  id: 'text-color',
                  body: {
                    component: GenericGroup,
                    props: {
                      direction: Layout.DIRECTION.HORIZONTAL,
                      items: [
                        {
                          id: 'text-color',
                          component: GenericFormattingComponentMap.TextColorSelect.component,
                          props: {
                            ...GenericFormattingComponentMap.TextColorSelect.props,
                            // __layout: Layout.LAYOUT.ICON
                            __label: _currentTextColorIndicator
                          }
                        }
                      ]
                    }
                  }
                },
                {
                  id: 'dummy-content',
                  body: {
                    component: GenericGroup,
                    props: {
                      direction: Layout.DIRECTION.HORIZONTAL,
                      items: [
                        {
                          id: 'dummy-content',
                          component: GenericFormattingComponentMap.DummyContentGenerator.component,
                          props: {
                            ...GenericFormattingComponentMap.DummyContentGenerator.props,
                            __layout: Layout.LAYOUT.ICON
                          }
                        }
                        /* {
                          id: 'dummy-content-color',
                          component: ColorPicker,
                          props: {
                            ...GenericFormattingComponentMap.DummyContentGenerator.props,
                            __layout: Layout.LAYOUT.ICON
                          }
                        } */
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      id: 'paragraph',
      title: _('Paragraph'),
      layout: Layout.LAYOUT.COLUMN,
      items: [
        {
          id: 'top',
          body: {
            component: GenericGroup,
            props: {
              direction: Layout.DIRECTION.HORIZONTAL,
              items: [
                {
                  id: 'text-bullet',
                  body: {
                    component: GenericGroup,
                    props: {
                      direction: Layout.DIRECTION.HORIZONTAL,
                      items: [
                        {
                          component: GenericFormattingComponentMap.TextBullet.component,
                          props: {
                            ...GenericFormattingComponentMap.TextBullet.props,
                            // __layout: Layout.LAYOUT.COLUMN,
                            __label: ''
                          }
                          // }
                        }
                        /* {
                          id: 'text-bullet-library',
                          component: ColorPicker, // Change later
                          props: {
                            // ...GenericFormattingComponentMap.TextHighlight.props,
                            __layout: Layout.LAYOUT.ICON
                          }
                        } */
                      ]
                    }
                  }
                },
                {
                  id: 'text-number-list',
                  body: {
                    component: GenericGroup,
                    props: {
                      direction: Layout.DIRECTION.HORIZONTAL,
                      items: [
                        {
                          component: GenericFormattingComponentMap.TextNumberList.component,
                          props: {
                            ...GenericFormattingComponentMap.TextNumberList.props,
                            // __layout: Layout.LAYOUT.COLUMN,
                            __label: ''
                          }
                          // }
                        }
                        /* {
                          id: 'text-number-list-library',
                          component: ColorPicker, // Change later
                          props: {
                            // ...GenericFormattingComponentMap.TextHighlight.props,
                            __layout: Layout.LAYOUT.ICON
                          }
                        } */
                      ]
                    }
                  }
                },

                {
                  // id: 'font-size-up',
                  // body: {
                  component: GenericFormattingComponentMap.TextBulletListTree.component,
                  props: {
                    ...GenericFormattingComponentMap.TextBulletListTree.props,
                    // __layout: Layout.LAYOUT.ICON
                    __label: ''
                  }
                  // }
                },
                {
                  // id: 'font-size-up',
                  // body: {
                  // component: TextChangeCase,
                  // props: { __layout: Layout.LAYOUT.SELECT }
                  id: 'text-change-case',
                  component: GenericFormattingComponentMap.TextControlList.component,
                  props: {
                    ...GenericFormattingComponentMap.TextControlList.props,

                    __label: ''
                    // __layout: Layout.LAYOUT.SELECT
                  }

                  // }
                },
                {
                  component: GenericFormattingComponentMap.TextIndentDecrease.component,
                  props: {
                    ...GenericFormattingComponentMap.TextIndentDecrease.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  component: GenericFormattingComponentMap.TextIndentIncrease.component,
                  props: {
                    ...GenericFormattingComponentMap.TextIndentIncrease.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  component: GenericFormattingComponentMap.TextParagraphDirectionLeft.component,
                  props: {
                    ...GenericFormattingComponentMap.TextParagraphDirectionLeft.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  component: GenericFormattingComponentMap.TextParagraphDirectionRight.component,
                  props: {
                    ...GenericFormattingComponentMap.TextParagraphDirectionRight.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  component: GenericFormattingComponentMap.TextParagraphDirection.component,
                  props: {
                    ...GenericFormattingComponentMap.TextParagraphDirection.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  component: GenericFormattingComponentMap.ToggleInvisibleCharacters.component,
                  props: {
                    ...GenericFormattingComponentMap.ToggleInvisibleCharacters.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                }
              ]
            }
          }
        },
        {
          id: 'bottom',
          body: {
            component: GenericGroup,
            props: {
              direction: Layout.DIRECTION.HORIZONTAL,
              items: [
                {
                  component: GenericFormattingComponentMap.TextAlignLeft.component,
                  props: {
                    ...GenericFormattingComponentMap.TextAlignLeft.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  component: GenericFormattingComponentMap.TextAlignCenter.component,
                  props: {
                    ...GenericFormattingComponentMap.TextAlignCenter.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  id: 'text-align-right',
                  component: GenericFormattingComponentMap.TextAlignRight.component,
                  props: {
                    ...GenericFormattingComponentMap.TextAlignRight.props
                  }
                },
                {
                  id: 'text-align-justify',
                  component: GenericFormattingComponentMap.TextAlignJustify.component,
                  props: {
                    ...GenericFormattingComponentMap.TextAlignJustify.props
                  }
                },
                {
                  id: 'text-line-spacing',
                  component: GenericFormattingComponentMap.TextLineSpacing.component,
                  props: {
                    ...GenericFormattingComponentMap.TextLineSpacing.props
                    // __layout: Layout.LAYOUT.ICON
                  }
                },
                {
                  id: 'text-special-indent',
                  // body: {
                  component: GenericFormattingComponentMap.TextSpecialLineIndent.component,
                  props: {
                    ...GenericFormattingComponentMap.TextSpecialLineIndent.props,
                    __layout: Layout.LAYOUT.ICON
                  }
                  // }
                },
                {
                  id: 'border',
                  body: {
                    component: GenericGroup,
                    props: {
                      direction: Layout.DIRECTION.HORIZONTAL,
                      items: [
                        {
                          id: 'border-all',
                          component: GenericFormattingComponentMap.BorderAll.component,
                          props: {
                            ...GenericFormattingComponentMap.BorderAll.props,
                            __layout: Layout.LAYOUT.ICON
                          }
                        }
                        /* {
                          id: 'text-highlight-color',
                          component: ColorPicker, // Chnage later
                          props: {
                            // ...GenericFormattingComponentMap.TextHighlight.props,
                            __layout: Layout.LAYOUT.ICON
                          }
                        } */
                      ]
                    }
                  }
                },
                {
                  id: 'paint',
                  body: {
                    component: GenericGroup,
                    props: {
                      direction: Layout.DIRECTION.HORIZONTAL,
                      items: [
                        {
                          id: 'paint-paragraph',
                          component: GenericFormattingComponentMap.ParagraphBgPaint.component,
                          props: {
                            ...GenericFormattingComponentMap.ParagraphBgPaint.props,

                            // __layout: Layout.LAYOUT.ICON
                            __label: _currentBackgroundColorIndicator
                            // __icon: currentColorIndicator
                          }
                        }
                        /* {
                          id: 'text-highlight-color',
                          component: ColorPicker, // Chnage later
                          props: {
                            ...GenericFormattingComponentMap.TextHighlight.props,
                            __layout: Layout.LAYOUT.ICON
                          }
                        } */
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      id: 'dynamic_content',
      title: _('Dynamic Content'),
      layout: Layout.LAYOUT.ROW,
      items: [
        {
          id: 'variable',
          body: {
            component: GenericFormattingComponentMap.VariableSelect.component,
            // props: {
            //   direction: Layout.DIRECTION.HORIZONTAL
            // }
            props: {
              ...GenericFormattingComponentMap.VariableSelect.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconVariable}</div>`
            }
          }
        },
        {
          id: 'generate-with-ai',
          body: {
            component: GenericFormattingComponentMap.GenerateWithAI.component,
            // props: {
            //   direction: Layout.DIRECTION.HORIZONTAL
            // }
            props: {
              ...GenericFormattingComponentMap.GenerateWithAI.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconAI}</div>`
            }
          }
        },
        {
          id: 'shield-visibility',
          body: {
            component: GenericGroup,
            props: {
              // __layout: Layout.LAYOUT.ICON,
              direction: Layout.DIRECTION.VERTICAL,
              items: [
                {
                  component: GenericFormattingComponentMap.SecuredContent.component,

                  props: {
                    ...GenericFormattingComponentMap.SecuredContent.props
                    // __layout: Layout.LAYOUT.COLUMN,
                    // __label:"sss"
                  }
                },
                {
                  component: GenericFormattingComponentMap.ProgrammingStyleComment.component,
                  // component: Copy,
                  props: {
                    ...GenericFormattingComponentMap.ProgrammingStyleComment.props
                    // __layout: Layout.LAYOUT.ICON
                  }
                }
                /* {
                  component: GenericFormattingComponentMap.GenerateWithAI.component,
                  props: {
                    ...GenericFormattingComponentMap.GenerateWithAI.props
                    // __layout: Layout.LAYOUT.ICON
                  }
                } */
              ]
            }
          }
        }
      ]
    },
    {
      id: 'styles',
      title: _('Styles'),
      layout: Layout.LAYOUT.COLUMN,
      items: [
        {
          id: 'top',
          body: {
            component: ParagraphStylePicker,
            props: {
              direction: Layout.DIRECTION.HORIZONTAL
            }
          }
        }
      ]
    },
    {
      id: 'editing',
      title: _('Editing'),
      layout: Layout.LAYOUT.ROW,
      items: [
        {
          id: 'search-replace',
          body: {
            component: GenericGroup,
            props: {
              // __layout: Layout.LAYOUT.ICON,
              direction: Layout.DIRECTION.VERTICAL,
              items: [
                {
                  component: GenericFormattingComponentMap.TextSearch.component,

                  props: {
                    ...GenericFormattingComponentMap.TextSearch.props
                    // __layout: Layout.LAYOUT.COLUMN,
                    // __label:"sss"
                  }
                },
                {
                  component: GenericFormattingComponentMap.TextReplace.component,
                  // component: Copy,
                  props: {
                    ...GenericFormattingComponentMap.TextReplace.props
                    // __layout: Layout.LAYOUT.ICON
                  }
                }
              ]
            }
          }
        },
        {
          id: 'select',
          body: {
            component: GenericGroup,
            props: {
              // __layout: Layout.LAYOUT.ICON,
              direction: Layout.DIRECTION.VERTICAL,
              items: [
                {
                  component: GenericFormattingComponentMap.TextCursorSelect.component,
                  props: {
                    ...GenericFormattingComponentMap.TextCursorSelect.props
                    // __layout: Layout.LAYOUT.ICON
                  }
                }
              ]
            }
          }
        }
      ]
    }
  ]

  const compactItems = (items: Array<Item | null | undefined>): Item[] =>
    items.filter(Boolean) as Item[]

  const sheetGroups: Group[] = [
    {
      id: 'sheet-number',
      title: _('Number'),
      items: [
        createExcelItemSafe('NumberFormat'),
        createExcelItemSafe('PercentStyle'),
        createExcelItemSafe('CommaStyle'),
        createExcelItemSafe('IncreaseDecimal'),
        createExcelItemSafe('DecreaseDecimal')
      ]
    },
    {
      id: 'sheet-styles',
      title: _('Styles'),
      items: [
        createExcelItemSafe('ConditionalFormatting'),
        createExcelItemSafe('FormatAsTable'),
        createExcelItemSafe('CellStyles')
      ]
    },
    {
      id: 'sheet-cells',
      title: _('Cells'),
      items: [
        createTableItem('TableInsertSelect'),
        createTableItem('TableDeleteSelect'),
        createTableItem('AutoFit'),
        createExcelItemSafe('ColumnWidth'),
        createExcelItemSafe('RowHeight')
      ]
    },
    {
      id: 'sheet-alignment',
      title: _('Alignment'),
      items: [
        createGenericItem('TextAlignLeft'),
        createGenericItem('TextAlignCenter'),
        createGenericItem('TextAlignRight'),
        createGenericItem('TextAlignTop'),
        createGenericItem('TextAlignMiddle'),
        createGenericItem('TextAlignBottom'),
        createGenericItem('TextWrap'),
        createGenericItem('TextWrapClip'),
        createGenericItem('TextWrapOverflow'),
        createGenericItem('TextRotateUp'),
        createGenericItem('TextRotateDown'),
        createGenericItem('TextRotateNone'),
        createTableItem('MergeCells')
      ]
    },
    {
      id: 'sheet-editing',
      title: _('Editing'),
      items: [createExcelItemSafe('Fill'), createExcelItemSafe('Clear'), createTableItem('Sort')]
    }
  ].map((group) => ({
    ...group,
    items: compactItems(group.items)
  })).filter((group) => group.items.length)

  const slideGroups: Group[] = [
    {
      id: 'slide-slides',
      title: _('Slides'),
      items: [
        createGenericItem('SlideSelect', fluentUIcons.fluentUIconSlideTextEdit),
        createGenericItem('SlidePresetSelect', fluentUIcons.fluentUIconSlideTextEdit)
      ]
    },
    {
      id: 'slide-text',
      title: _('Slide Text'),
      items: [
        {
          id: 'slide-auto-resize',
          variant: 'primary',
          body: {
            component: SlideAutoResizeToggle,
            props: {}
          }
        },
        {
          id: 'slide-quick-styles',
          variant: 'primary',
          body: {
            component: SlideQuickStyles,
            props: {}
          }
        }
      ]
    }
  ]

  const sheetBaseGroups = $derived(baseGroups.filter((group) => ['clipboard', 'font'].includes(group.id)))

  const groups: Group[] = $derived(
    $_$_ribbonContext.inSlide
      ? [...baseGroups, ...slideGroups]
      : $_$_ribbonContext.inSheet
        ? [...sheetBaseGroups, ...sheetGroups]
        : baseGroups
  )
</script>

<GenericRibbon __groups={groups} />
