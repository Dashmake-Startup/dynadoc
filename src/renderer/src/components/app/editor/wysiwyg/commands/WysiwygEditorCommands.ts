/**
 * Copyright (C) 2024 Dashmake Inc.
 *
 * This file is part of DDoc Office.
 *
 * DDoc Office is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DDoc Office is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
 */

import EditorHelpers from '../../../../../utils/EditorHelpers'
// import SelectedTextModel from '../models/SelectedTextModel'

export default class WysiwygEditorCommands {
  /* public static changeFontFamily(
    selectedTexts: SelectedTextModel[],
    fontFamily: string
  ): SelectedTextModel[] {
    console.log('selectedText', selectedTexts)
    selectedTexts.forEach((selectedText,index) => {
      if (selectedText.isDefined()) {
        const range = selectedText.range
        const container = range.commonAncestorContainer as HTMLElement

        if (EditorHelpers.isCursorInsideDirectTag('s-span', selectedText.selection, range)) {
          const parent = range.startContainer as HTMLElement

          // If the parent is already an s-span, change its font family
          parent.style.fontFamily = fontFamily
        } else {
          // Otherwise, create a new s-span and wrap the selected text
          const StyledSpan = document.createElement('s-span')
          StyledSpan.style.fontFamily = fontFamily
          range.surroundContents(StyledSpan)
          selectedText = this.updateSelectedTextModel(selectedText, StyledSpan)
          selectedTexts[index] = selectedText
        }

        /* if (range && range.startContainer === range.endContainer && range.startContainer.parentNode) {
        let parent = range.startContainer.parentNode as HTMLElement

        if (parent.tagName === 'S-SPAN') {
          // If the parent is already an s-span, change its font family
          parent.style.fontFamily = fontFamily
        } else {
          // Otherwise, create a new s-span and wrap the selected text
          const StyledSpan = document.createElement('s-span')
          StyledSpan.style.fontFamily = fontFamily
          range.surroundContents(StyledSpan)
          this.updateSelectedTextModel(selectedText, StyledSpan)
        }
      } else {
        // Handle cases where the selection spans multiple nodes
        const StyledSpan = document.createElement('s-span')
        StyledSpan.style.fontFamily = fontFamily
        range.surroundContents(StyledSpan)
        this.updateSelectedTextModel(selectedText, StyledSpan)
      } /
      }
    })
    return selectedTexts
  } */
  public static changeFontFamily(editor, font) {
    console.log('handleFontFamilyChange', font)
    // function handleFontFamilyChange(event) {
    return (event) => {
      // const value = event.target.value
      // const selected = event.detail?.value || event.target?.value
      // if (!selected) return
      font = font || event.detail?.value || event.target?.value

      // const { state, view } = editor
      // const { from, to } = state.selection

      console.log('setFontFamily run', font)
      editor.chain().focus().setFontFamily(font).run()

      // editor.commands.focus().setFontFamily(value)
      // .setTextSelection({ from, to }) // restore selection
      // .setFontFamily(value)
    }
  }
  public static changeFontSize(editor, font) {
    console.log('handleFontFamilyChange', font)
    // function handleFontFamilyChange(event) {
    return (event) => {
      // const value = event.target.value
      // const selected = event.detail?.value || event.target?.value
      // if (!selected) return
      font = font || event.detail?.value || event.target?.value

      // const { state, view } = editor
      // const { from, to } = state.selection

      console.log('setFontFamily run', font)
      editor.chain().focus().setFontFamily(font).run()

      // editor.commands.focus().setFontFamily(value)
      // .setTextSelection({ from, to }) // restore selection
      // .setFontFamily(value)
    }
  }

  /* private static updateSelectedTextModel(
    selectedText: SelectedTextModel,
    StyledSpan: HTMLElement
  ): SelectedTextModel {
    // Update the range to reflect the new span wrapping
    const newRange = document.createRange()
    newRange.selectNodeContents(StyledSpan)

    // Update the selectedTextModel properties
    selectedText.text = StyledSpan.innerText
    // selectedText.start = 0
    // selectedText.end = StyledSpan.innerText.length
    selectedText.range = newRange

    // Update the selection to reflect the new range
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(newRange)
      selectedText.selection = selection
    }

    console.log('newselectedText', selectedText)
    return selectedText
  } */
}
