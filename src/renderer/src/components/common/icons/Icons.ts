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

import fluentUIconCut from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_cut_24_regular.svg?raw'
import fluentUIconDocumentCopy from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_copy_24_regular.svg?raw'
import fluentUIconTextBold from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_bold_24_regular.svg?raw'
import fluentUIconTextItalic from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_italic_24_regular.svg?raw'
import fluentUIconFontDecrease from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_font_decrease_24_regular.svg?raw'
import fluentUIconFontIncrease from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_font_increase_24_regular.svg?raw'
import fluentUIconPaintBrush from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_paint_brush_24_regular.svg?raw'
import fluentUIconTextClearFormatting from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_clear_formatting_24_regular.svg?raw'
import fluentUIconTextAllClearFormatting from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_clear_formatting_24_regular.svg?raw'
import fluentUIconTextChangeCase from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_case_title_24_filled.svg?raw'
// import fluentUIconTextChangeCase from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_change_case_24_regular.svg?raw'
import fluentUIconClipboardPaste from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_clipboard_paste_24_regular.svg?raw'
import fluentUIconTextStrikethrough from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_strikethrough_24_filled.svg?raw'
// export { fluentUIconClipboardPaste } from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_clipboard_paste_24_regular.svg?raw';

import fluentUIconClipboardBrush from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_clipboard_brush_24_regular.svg?raw'
import fluentUIconClipboardNote from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_clipboard_note_20_regular.svg?raw'
import fluentUIconClipboardLetter from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_clipboard_letter_24_regular.svg?raw'
import fluentUIconClipboardMore from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_clipboard_more_24_regular.svg?raw'
import fluentUIconClipboardSettings from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_clipboard_settings_24_regular.svg?raw'
import fluentUIconTextUnderline from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_underline_24_regular.svg?raw'
import fluentUIconTextSuperscript from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_superscript_24_regular.svg?raw'
import fluentUIconTextSubscript from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_subscript_24_regular.svg?raw'
import fluentUIconHighlight from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_highlight_24_regular.svg?raw'
import fluentUIconTextColor from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_color_20_regular.svg?raw'

import fluentUIconTextNumberListLtr from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_number_list_ltr_24_regular.svg?raw'
import fluentUIconTextBulletList from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_bullet_list_24_regular.svg?raw'
import fluentUIconTextBulletListTree from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_bullet_list_tree_24_regular.svg?raw'
import fluentUIconTaskListLtr from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_task_list_24_regular_rtl.svg?raw'
import fluentUIconTextIndentDecreaseLtr from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_indent_decrease_24_regular.svg?raw'
import fluentUIconTextIndentIncreaseLtr from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_indent_increase_24_regular.svg?raw'
import fluentUIconTextParagraphDirectionLeft from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_paragraph_direction_left_24_regular.svg?raw'
import fluentUIconTextParagraphDirectionRight from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_paragraph_direction_right_24_regular.svg?raw'
import fluentUIconTextParagraphDirection from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_paragraph_direction_24_regular.svg?raw'
import fluentUIconTextAlignLeft from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_align_left_24_regular.svg?raw'
import fluentUIconTextAlignRight from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_align_right_24_regular.svg?raw'
import fluentUIconTextAlignCenter from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_align_center_24_regular.svg?raw'
import fluentUIconTextAlignJustify from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_align_justify_24_regular.svg?raw'
import fluentUIconTextLineSpacing from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_line_spacing_24_regular.svg?raw'
import fluentUIconTextFirstLine from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_first_line_24_regular.svg?raw'
import fluentUIconBorderAll from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_border_all_24_regular.svg?raw'
import fluentUIconBorderTop from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_border_top_24_regular.svg?raw'
import fluentUIconBorderBottom from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_border_bottom_24_regular.svg?raw'
import fluentUIconBorderLeft from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_border_left_24_regular.svg?raw'
import fluentUIconBorderRight from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_border_right_24_regular.svg?raw'
import fluentUIconBorderInside from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_border_inside_24_regular.svg?raw'
import fluentUIconBorderOutside from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_border_outside_24_regular.svg?raw'
import fluentUIconBorderNone from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_border_none_24_regular.svg?raw'
import fluentUIconPaintBucket from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_paint_bucket_24_regular.svg?raw'

// Cursor
import fluentUIconCursor from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_cursor_24_regular.svg?raw'

// Replace (alternative: Swap)
import fluentUIconReplace from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_arrow_swap_24_regular.svg?raw'

// Search
import fluentUIconSearch from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_search_24_regular.svg?raw'

// Voice Dictation (alternative: Mic)
import fluentUIconMic from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_mic_24_regular.svg?raw'

// PageBreak (alternative: Split Horizontal)
import fluentUIconSplitHorizontal from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_split_horizontal_24_regular.svg?raw'

// Table
import fluentUIconTable from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_lightning_24_regular.svg?raw'
import fluentUIconTableSimple from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_24_regular.svg?raw'

// TemplateBrowseColorFluent (alternative: Color)
import fluentUIconColor from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_color_24_regular.svg?raw'

// Picture
import fluentUIconImage from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_image_24_regular.svg?raw'

// DrawingCanvas (alternative: Draw Shape)
import fluentUIconDrawShape from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_draw_shape_24_regular.svg?raw'

// WebInsertHyperlink
import fluentUIconLink from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_link_24_regular.svg?raw'

// MSWordInsertTableOfContents (alternative: List)
import fluentUIconList from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_list_24_regular.svg?raw'

// AudioBookmark (alternative: Bookmark Music)
import fluentUIconBookmark from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_bookmark_24_regular.svg?raw'

// InsertMovieFromGallery (alternative: Video)
import fluentUIconVideo from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_video_24_regular.svg?raw'

// NewComment
import fluentUIconCommentAdd from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_comment_add_24_regular.svg?raw'

// HeaderAndFooter (alternative: Document Header)
import fluentUIconDocumentHeader from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_header_24_regular.svg?raw'

// PageNumber (alternative: Number Symbol)
import fluentUIconNumberSymbol from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_number_symbol_24_regular.svg?raw'

// MathZone (alternative: Math Formula)
import fluentUIconMathFormula from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_math_formula_24_regular.svg?raw'

// Symbol (alternative: Apps)
import fluentUIconApps from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_apps_24_regular.svg?raw'

// EmojiGallery (alternative: Emoji)
import fluentUIconEmoji from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_emoji_24_regular.svg?raw'

// UxGalPageMargins (alternative: Margin)
import fluentUIconMargin from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_margins_24_regular.svg?raw'

// UxGalPageOrientation (alternative: Page Orientation)
import fluentUIconPageOrientation from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_orientation_24_regular.svg?raw'

// GalPageSize (alternative: Page Fit)
import fluentUIconPageFit from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_page_fit_24_regular.svg?raw'

// Columns (alternative: Column Triple)
import fluentUIconColumnTriple from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_column_triple_24_regular.svg?raw'

// FlyoutLineNumbers (alternative: Number Row)
import fluentUIconNumberRow from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_number_row_24_regular.svg?raw'

// CommonControlDialogLauncher (alternative: More Circle)
import fluentUIconMoreCircle from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_more_circle_24_regular.svg?raw'

// PageBorder (alternative: Border)
import fluentUIconBorder from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_border_24_regular.svg?raw'

// ColorPickerBackground (alternative: Color Fill)
import fluentUIconColorFill from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_color_fill_24_regular.svg?raw'
// Requery (alternative: Refresh)
import fluentUIconRefresh from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_arrow_repeat_all_24_regular.svg?raw'

// TrashCan (alternative: Delete)
import fluentUIconDelete from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_delete_24_regular.svg?raw'

// Footnote (alternative: Note)
import fluentUIconNote from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_note_24_regular.svg?raw'

// MSWordInsertEndnoteNow (alternative: Note Add)
import fluentUIconNoteAdd from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_note_add_24_regular.svg?raw'

// MSWordGoToNextFootnote (alternative: Arrow Down)
import fluentUIconArrowDown from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_arrow_down_24_regular.svg?raw'

// MSWordGoToNextEndnote (alternative: Arrow Down)
import fluentUIconArrowDown2 from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_arrow_down_24_regular.svg?raw'

// Insights (alternative: Lightbulb)
import fluentUIconLightbulb from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_lightbulb_24_regular.svg?raw'

// CitationAddIns (alternative: Add Circle)
import fluentUIconAddCircle from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_add_circle_24_regular.svg?raw'


// Editor (alternative: Text Proofing)
import fluentUIconTextProofingTools from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_proofing_tools_24_regular.svg?raw'

// Spelling (alternative: Grammar Checkmark)
import fluentUIconTextGrammarCheckmark from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_grammar_checkmark_24_regular.svg?raw'

// WordCountList (alternative: Document One Page)
import fluentUIconDocumentOnePage from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_one_page_24_regular.svg?raw'

// AccessibilityChecker
import fluentUIconAccessibility from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_accessibility_24_regular.svg?raw'

// Translator (alternative: Translate)
import fluentUIconTranslate from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_translate_24_regular.svg?raw'

// NewComment
// import fluentUIconCommentAdd from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_comment_add_24_regular.svg?raw'

// PreviousComment
import fluentUIconCommentPrevious from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_comment_arrow_left_24_regular.svg?raw'

// NextComment
import fluentUIconCommentNext from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_comment_arrow_right_24_regular.svg?raw'

// DeleteComment (alternative: Comment Dismiss)
import fluentUIconCommentDismiss from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_comment_dismiss_24_regular.svg?raw'

// Comment
import fluentUIconComment from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_comment_24_regular.svg?raw'

// FilterComments (alternative: Comment Multiple)
import fluentUIconCommentMultiple from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_comment_multiple_24_regular.svg?raw'

// AcceptRevision (alternative: Checkmark)
import fluentUIconCheckmark from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_checkmark_24_regular.svg?raw'

// RejectRevision (alternative: Dismiss)
import fluentUIconDismiss from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_dismiss_24_regular.svg?raw'

// PreviousRevision (alternative: Arrow Previous)
import fluentUIconArrowPrevious from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_arrow_previous_24_regular.svg?raw'

// NextRevision (alternative: Arrow Next)
import fluentUIconArrowNext from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_arrow_next_24_regular.svg?raw'

// TrackChanges (alternative: History)
import fluentUIconHistory from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_history_24_regular.svg?raw'

// MarkAllHighlightsAsRead (alternative: Highlight Accent)
import fluentUIconHighlightAccent from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_highlight_24_filled.svg?raw'


// AudioReader (alternative: Audio)
import fluentUIconAudio from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_immersive_reader_24_regular.svg?raw'

// ZoomCurrent100 (alternative: Zoom)
import fluentUIconZoom from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_search_24_regular.svg?raw'

// Ruler
import fluentUIconRuler from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_ruler_24_regular.svg?raw'

// MenuNavigationPane (alternative: Navigation)
import fluentUIconNavigation from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_navigation_24_regular.svg?raw'

// HeaderAndFooter (alternative: Document Header)
// import fluentUIconDocumentHeader from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_header_24_regular.svg?raw'

// Footnote (alternative: Note)
// import fluentUIconNote from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_note_24_regular.svg?raw'

// MSWordInsertEndnoteNow (alternative: Note Add)
// import fluentUIconNoteAdd from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_note_add_24_regular.svg?raw'

// GalContrast (alternative: Contrast)
import fluentUIconContrast from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_dark_theme_24_regular.svg?raw'

// SunMonochromatic (alternative: Sun)
import fluentUIconSun from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_weather_sunny_24_regular.svg?raw'

// PageLayoutView (alternative: Page Fit)
// import fluentUIconPageFit from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_page_fit_24_regular.svg?raw'

// ReadingMode (alternative: Book Open)
import fluentUIconBookOpen from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_book_open_24_regular.svg?raw'


import fluentUIconVariable from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_flash_24_regular.svg?raw'
import fluentUIconVariable2 from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_braces_variable_24_regular.svg?raw'
import fluentUIconShield from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_lock_shield_24_regular.svg?raw'
import fluentUIconShield2 from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_shield_keyhole_24_regular.svg?raw'
import fluentUIconProgrammingStyleComment from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_code_24_regular.svg?raw'
import fluentUIconContentView from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_content_view_24_regular.svg?raw'
import fluentUIconCodeBlock from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_code_block_24_regular.svg?raw'
import fluentUIconAI from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_sparkle_24_regular.svg?raw'

import fluentUIconBranch from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_branch_fork_24_regular.svg?raw'
import fluentUIconDocumentFolder from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_folder_24_regular.svg?raw'
import fluentUIconPeopleChat from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_people_chat_24_regular.svg?raw'
import fluentUIconAIChat from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_chat_sparkle_24_regular.svg?raw'
import fluentUIconChatVideo from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_chat_video_24_regular.svg?raw'
import fluentUIconDocumentDataLink from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_data_link_24_regular.svg?raw'
import fluentUIconEditLock from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_edit_lock_24_regular.svg?raw'
import fluentUIconWindowConsole from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_window_console_20_regular.svg?raw'
// import fluentUIconDocumentFolder from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_folder_24_regular.svg

import fluentUIconSlideTextEdit from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_slide_text_edit_24_regular.svg?raw'
import fluentUIconTableImage from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_image_20_regular.svg?raw'
import fluentUIconSpreadsheet from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_table_24_regular.svg?raw'
import fluentUIconWindowText from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_window_text_24_regular.svg?raw'


import fluentUIconLayerDiagonal from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_layer_diagonal_24_regular.svg?raw'
import fluentUIconLayer from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_layer_24_regular.svg?raw'
import fluentUIconStarAdd from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_star_add_24_regular.svg?raw'
import fluentUIconStarDismiss from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_star_dismiss_24_regular.svg?raw'
import fluentUIconStarSettings from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_star_settings_24_regular.svg?raw'
import fluentUIconStarEmphasis from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_star_emphasis_24_regular.svg?raw'
import fluentUIconWindowBrush from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_window_brush_24_regular.svg?raw'

import fluentUIconPreviewLink from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_preview_link_24_regular.svg?raw'
import fluentUIconSelectAllOn from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_select_all_on_24_filled.svg?raw'
import fluentUIconGlobeDesktop from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_globe_desktop_24_regular.svg?raw'
import fluentUIconDesignIdeas from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_design_ideas_24_regular.svg?raw'


// --- Table & Grid ---
import fluentUIconTableSettings from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_settings_24_regular.svg?raw';
import fluentUIconTableGrid from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_grid_24_regular.svg?raw';

// --- Draw & Erase ---
import fluentUIconTableDraw from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_tab_add_24_regular.svg?raw';
import fluentUIconEraser from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_eraser_24_regular.svg?raw';

// --- Delete & Insert ---
import fluentUIconDeleteColumn from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_delete_column_24_regular.svg?raw';
import fluentUIconDeleteRow from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_delete_row_24_regular.svg?raw';
import fluentUIconTableDelete from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_dismiss_24_regular.svg?raw';
import fluentUIconTableInsertRow from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_insert_row_24_regular.svg?raw';
import fluentUIconTableInsertRowBefore from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_move_above_24_regular.svg?raw';
import fluentUIconTableInsertRowAfter from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_move_below_24_regular.svg?raw';
// import fluentUIconTableInsertRowAfter from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_insert_row_24_regular.svg?raw';
import fluentUIconTableInsertColumnLeft from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_move_left_24_regular.svg?raw';
import fluentUIconTableInsertColumnRight from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_move_right_24_regular.svg?raw';

// --- Merge & Split ---
import fluentUIconTableCellsMerge from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_cells_merge_24_regular.svg?raw';
import fluentUIconTableCellsSplit from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_cells_split_24_regular.svg?raw';
import fluentUIconTableSplit from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_cells_split_24_regular.svg?raw';

// --- Sizing & Alignment ---
import fluentUIconTableResize from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_table_resize_row_24_regular.svg?raw';
import fluentUIconRowHeight from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_arrow_autofit_height_20_regular.svg?raw';
import fluentUIconColumnWidth from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_column_20_filled.svg?raw';
import fluentUIconTextDirection from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_direction_vertical_24_regular.svg?raw';

// --- Data & Formulas ---
// import fluentUIconMathFormula from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_math_formula_24_regular.svg?raw';
import fluentUIconArrowSort from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_arrow_sort_24_regular.svg?raw';
import fluentUIconForm from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_form_24_regular.svg?raw';
import fluentUIconSurvey from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_document_bullet_list_24_regular.svg?raw';

// --- VIEW MODES ---
import fluentUIconDualScreen from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_dual_screen_24_regular.svg?raw';
import fluentUIconSideBySide from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_column_triple_24_regular.svg?raw';
import fluentUIconTextWrap from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_text_wrap_24_regular.svg?raw';

// --- LANGUAGE PAIRS ---
import fluentUIconLocalLanguage from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_local_language_24_regular.svg?raw';
// import fluentUIconTranslate from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_translate_24_regular.svg?raw';

// --- AI & MEMORY ---
import fluentUIconTranslateAuto from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_translate_auto_24_regular.svg?raw';
import fluentUIconDatabaseSearch from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_database_search_24_regular.svg?raw';
import fluentUIconSparkle from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_sparkle_24_regular.svg?raw';

// --- REVIEW & QA ---
import fluentUIconCheckmarkCircle from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_checkmark_circle_24_regular.svg?raw';
import fluentUIconSearchInfo from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_search_info_24_regular.svg?raw';
// import fluentUIconCommentMultiple from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_comment_multiple_24_regular.svg?raw';

// --- CHARTS ---
import fluentUIconChartMultiple from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_chart_multiple_24_regular.svg?raw';

// --- EXPORT ---
import fluentUIconCloudArrowUp from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_cloud_arrow_up_24_regular.svg?raw';
import fluentUIconBraces from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_braces_24_regular.svg?raw';

import fluentUIconChart from '../../../assets/fonts/fluentui-system-icons/svg/ic_fluent_chart_multiple_24_color.svg?raw';


// export const fluentUIconClipboardPaste
// export { fluentUIconClipboardPaste };
export const fluentUIcons = {

  fluentUIconDualScreen,
  fluentUIconSideBySide,
  fluentUIconTextWrap,
  fluentUIconLocalLanguage,
  // fluentUIconTranslate,
  fluentUIconTranslateAuto,
  fluentUIconDatabaseSearch,
  fluentUIconSparkle,
  fluentUIconCheckmarkCircle,
  fluentUIconSearchInfo,
  fluentUIconChartMultiple,
  // fluentUIconCommentMultiple,
  fluentUIconCloudArrowUp,
  // fluentUIconArrowDown,
  fluentUIconBraces,

  fluentUIconForm,
  fluentUIconSurvey,
  // Table Group
  fluentUIconTableSettings,
  fluentUIconTableGrid,

  // Draw Group
  fluentUIconTableDraw,
  fluentUIconEraser,

  // Delete/Insert Group
  fluentUIconDeleteColumn,
  fluentUIconDeleteRow,
  fluentUIconTableDelete,
  fluentUIconTableInsertRow,
  fluentUIconTableInsertRowBefore,
  fluentUIconTableInsertRowAfter,
  fluentUIconTableInsertColumnLeft,
  fluentUIconTableInsertColumnRight,

  // Merge/Split Group
  fluentUIconTableCellsMerge,
  fluentUIconTableCellsSplit,
  fluentUIconTableSplit,

  // Sizing/Layout Group
  fluentUIconTableResize,
  fluentUIconRowHeight,
  fluentUIconColumnWidth,
  fluentUIconTextDirection,

  // Data Group
  // fluentUIconMathFormula,
  fluentUIconArrowSort,

  fluentUIconDesignIdeas,
  fluentUIconGlobeDesktop,
  fluentUIconWindowBrush,
  fluentUIconPreviewLink,
  fluentUIconSelectAllOn,
  fluentUIconLayerDiagonal,
  fluentUIconLayer,
  fluentUIconStarAdd,
  fluentUIconStarDismiss,
  fluentUIconStarSettings,
  fluentUIconStarEmphasis,
  fluentUIconWindowText,
  fluentUIconSlideTextEdit,
  fluentUIconTableImage,
  fluentUIconSpreadsheet,
  fluentUIconEditLock,
  fluentUIconWindowConsole,
  fluentUIconDocumentDataLink,
  fluentUIconPeopleChat,
  fluentUIconAIChat,
  fluentUIconChatVideo,
  fluentUIconDocumentFolder,
  fluentUIconBranch,
  fluentUIconCut,
  fluentUIconDocumentCopy,
  fluentUIconTextBold,
  fluentUIconTextItalic,
  fluentUIconFontDecrease,
  fluentUIconFontIncrease,
  fluentUIconPaintBrush,
  fluentUIconTextClearFormatting,
  fluentUIconTextAllClearFormatting,
  fluentUIconTextChangeCase,
  fluentUIconTextStrikethrough,

  fluentUIconClipboardBrush,
  fluentUIconClipboardNote,
  fluentUIconClipboardLetter,
  fluentUIconClipboardMore,
  fluentUIconClipboardSettings,

  fluentUIconTextUnderline,
  fluentUIconTextSuperscript,
  fluentUIconTextSubscript,
  fluentUIconHighlight,
  fluentUIconTextColor,

  fluentUIconTextNumberListLtr,
  fluentUIconTextBulletList,
  fluentUIconTextBulletListTree,
  fluentUIconTaskListLtr,
  fluentUIconTextIndentDecreaseLtr,
  fluentUIconTextIndentIncreaseLtr,

  fluentUIconTextParagraphDirectionLeft,
  fluentUIconTextParagraphDirectionRight,
  fluentUIconTextParagraphDirection,

  fluentUIconTextAlignLeft,
  fluentUIconTextAlignRight,
  fluentUIconTextAlignCenter,
  fluentUIconTextAlignJustify,

  fluentUIconTextLineSpacing,
  fluentUIconTextFirstLine,

  fluentUIconBorderAll,
  fluentUIconBorderTop,
  fluentUIconBorderBottom,
  fluentUIconBorderLeft,
  fluentUIconBorderRight,
  fluentUIconBorderInside,
  fluentUIconBorderOutside,
  fluentUIconBorderNone,

  fluentUIconPaintBucket,

  // Cursor
  fluentUIconCursor,

  // Replace
  fluentUIconReplace,

  // Search
  fluentUIconSearch,

  // Voice Dictation
  fluentUIconMic,

  fluentUIconSplitHorizontal,
  fluentUIconTable,
  fluentUIconTableSimple,
  fluentUIconColor,
  fluentUIconImage,
  fluentUIconDrawShape,
  fluentUIconLink,
  fluentUIconList,
  fluentUIconBookmark,
  // fluentUIconBookmark as fluentUIconBookmarkMusic,
  fluentUIconVideo,
  fluentUIconCommentAdd,
  fluentUIconDocumentHeader,
  fluentUIconNumberSymbol,
  fluentUIconMathFormula,
  fluentUIconApps,
  fluentUIconEmoji,
  fluentUIconClipboardPaste,
  fluentUIconMargin,
  fluentUIconPageOrientation,
  fluentUIconPageFit,
  fluentUIconColumnTriple,
  fluentUIconNumberRow,
  fluentUIconMoreCircle,
  fluentUIconBorder,
  fluentUIconColorFill,
  fluentUIconRefresh,
  fluentUIconDelete,
  fluentUIconNote,
  fluentUIconNoteAdd,
  fluentUIconArrowDown,
  fluentUIconArrowDown2,
  fluentUIconLightbulb,
  fluentUIconAddCircle,
  fluentUIconTextProofingTools,
  fluentUIconTextGrammarCheckmark,
  fluentUIconDocumentOnePage,
  fluentUIconAccessibility,
  fluentUIconTranslate,
  fluentUIconCommentPrevious,
  fluentUIconCommentNext,
  fluentUIconCommentDismiss,
  fluentUIconComment,
  fluentUIconCommentMultiple,
  fluentUIconCheckmark,
  fluentUIconDismiss,
  fluentUIconArrowPrevious,
  fluentUIconArrowNext,
  fluentUIconHistory,
  fluentUIconHighlightAccent,
  fluentUIconAudio,
  fluentUIconZoom,
  fluentUIconRuler,
  fluentUIconNavigation,
  fluentUIconContrast,
  fluentUIconSun,
  fluentUIconBookOpen,

  fluentUIconVariable,
  fluentUIconShield,
  fluentUIconShield2,
  fluentUIconProgrammingStyleComment,
  fluentUIconCodeBlock,
  fluentUIconContentView,
  fluentUIconAI,
  fluentUIconChart
};


// Toolbar Icons - Photoshop 2025 Style
// Photoshop 2025 Toolbar Icons (Spectrum Workflow Icons)

// Photoshop 2025 – Spectrum Workflow Icons

import spectrumIconMove from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Move_20_N.svg?raw'
// import spectrumIconMove from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Select_20_N.svg?raw'

import spectrumIconRectangularMarquee from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_SelectRectangle_20_N.svg?raw'
import spectrumIconLasso from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_LassoSelect_20_N.svg?raw'
import spectrumIconMagicWand from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_MagicWand_20_N.svg?raw'

import spectrumIconCrop from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Crop_20_N.svg?raw'

import spectrumIconEyedropper from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Eyedropper_20_N.svg?raw'

import spectrumIconHealingBrush from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Brush_20_N.svg?raw'

import spectrumIconBrush from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Brush_20_N.svg?raw'

import spectrumIconCloneStamp from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_StampClone_20_N.svg?raw'

import spectrumIconEraser from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Erase_20_N.svg?raw'
import spectrumIconGradient from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Gradient_20_N_original.svg?raw'
import spectrumIconRectangle from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Gradient_20_N.svg?raw'
import spectrumIconBlur from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Blur_20_N.svg?raw'

import spectrumIconPen from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_PenBrush_20_N.svg?raw'

import spectrumIconType from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Text_20_N.svg?raw'

import spectrumIconHand from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Hand_20_N.svg?raw'

import spectrumIconZoom from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Search_20_N.svg?raw'
import spectrumIconSelect from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Select_20_N.svg?raw'


import spectrumIconNew from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_New_20_N.svg?raw'
import spectrumIconFolder from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Folder_20_N.svg?raw'
import spectrumIconDelete from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Delete_20_N.svg?raw'
import spectrumIconImage from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Image_20_N.svg?raw'
import spectrumIconVisibility from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Visibility_20_N.svg?raw'
import spectrumIconVisibilityOff from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_VisibilityOff_20_N.svg?raw'
import spectrumIconReplace from '../../../assets/fonts/spectrum-css-workflow-icons/svg/S2_Icon_Replace_20_N.svg?raw'

export const spectrumIcons = {
  spectrumIconReplace,

  spectrumIconVisibility,
  spectrumIconVisibilityOff,
  spectrumIconImage,
  spectrumIconNew,
  spectrumIconFolder,
  spectrumIconDelete,
  // Move
  moveTool: spectrumIconMove,

  // Selection
  rectangularMarqueeTool: spectrumIconRectangularMarquee,
  lassoTool: spectrumIconLasso,
  magicWandTool: spectrumIconMagicWand,

  // Crop
  cropTool: spectrumIconCrop,

  // Eyedropper
  eyedropperTool: spectrumIconEyedropper,

  // Healing
  // healingBrushTool: spectrumIconHealingBrush,

  healingBrushTool: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M16.14 3.5a3.4 3.4 0 0 1 4.8 0l.56.56a3.4 3.4 0 0 1 0 4.8L9.2 21.16a3.4 3.4 0 0 1-4.8 0l-.56-.56a3.4 3.4 0 0 1 0-4.8L16.14 3.5ZM5.5 16.9l1.6 1.6 10.3-10.3-1.6-1.6-10.3 10.3Z" fill="currentColor"/>
      <path d="M19 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-1 5a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM14 18a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="currentColor"/>
    </svg>`,

  // Brush
  brushTool: spectrumIconBrush,

  // Clone
  cloneStampTool: spectrumIconCloneStamp,

  // Eraser
  eraserTool: spectrumIconEraser,
  // 
  gradientTool: spectrumIconGradient,
  blurTool: spectrumIconBlur,
  dodgeTool: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M12 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM4 10a8 8 0 1 1 9 7.937V21a1 1 0 1 1-2 0v-3.063A8.001 8.001 0 0 1 4 10Z" fill="currentColor"/>
    </svg>`,
  burnTool: `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.5 3c-3.5 0-6.5 2.5-7.5 5.5C3.5 11.5 5 15 8 17.5V21h7v-3.5c3-2.5 4.5-6 4-9-1-3-4-5.5-7.5-5.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="11.5" cy="10.5" r="2.5" fill="currentColor"/>
    </svg>`,

  // Pen
  penTool: spectrumIconPen,

  // Type
  typeTool: spectrumIconType,
  selectTool: spectrumIconSelect,
  rectangleTool: spectrumIconRectangle,

  // Navigation
  handTool: spectrumIconHand,
  zoomTool: spectrumIconZoom,
}
export const svgIcons = {

  mermaid: `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#fd366e" d="M29.973 4.478A14.24 14.24 0 0 0 16 13.842c-2.107-5.82-7.787-9.628-13.973-9.364a14.25 14.25 0 0 0 6.2 12.36a7.65 7.65 0 0 1 3.316 6.32v4.376h8.916V23.16a7.65 7.65 0 0 1 3.315-6.32a14.25 14.25 0 0 0 6.2-12.36z"/></svg>`,

  libreofficeWriter: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
	<path d="M0 0h16v16H0z" fill="none" />
	<path fill="currentColor" d="M8.354.354A1.4 1.4 0 0 0 7.5 0h-6c-.275 0-.5.225-.5.5v15c0 .275.225.5.5.5h12c.275 0 .5-.225.5-.5v-9c0-.275-.159-.659-.354-.854L8.353.353zM13 15H2V1h5.487a.6.6 0 0 1 .169.07l5.274 5.274a.6.6 0 0 1 .07.169zm.5-15h-3c-.275 0-.341.159-.146.354l3.293 3.293c.194.194.354.129.354-.146v-3c0-.275-.225-.5-.5-.5z" />
</svg>

`
}

// export  fluentUIcons
