import type { Component } from 'svelte'
import SurveyPreview from '../extensions/tiptap/CustomSurveyExtension/components/SurveyPreview.svelte'
import SpreadsheetEditor from '../extensions/tiptap/CustomSpreadsheetExtension/components/SpreadsheetEditor.svelte'
import LatexProjectView from '../extensions/tiptap/CustomLatexProjectExtension/components/LatexProjectView.svelte'
import SlideDeck from '../extensions/tiptap/CustomSlideExtension/components/SlideDeck.svelte'

export const nodeLandingRegistry: Record<string, Component<any>> = {
  survey: SurveyPreview,
  sheet: SpreadsheetEditor,
  latex: LatexProjectView,
  slide: SlideDeck
}
