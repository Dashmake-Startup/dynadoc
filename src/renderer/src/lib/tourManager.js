/**
 * Shepherd.js onboarding tours with Svelte 5 step content.
 *
 * Each step mounts a custom Svelte component into Shepherd's `.shepherd-text`.
 */
import Shepherd from 'shepherd.js'
import { mount, unmount } from 'svelte'

import ShepherdTourWrapper from '../components/common/tour/ShepherdTourWrapper.svelte'
import HomeWelcomeStep from '../components/common/tour/steps/HomeWelcomeStep.svelte'
import HomeThemeStep from '../components/common/tour/steps/HomeThemeStep.svelte'
import HomeCreateDocStep from '../components/common/tour/steps/HomeCreateDocStep.svelte'
import EditorRibbonStep from '../components/common/tour/steps/EditorRibbonStep.svelte'
import EditorStyleStep from '../components/common/tour/steps/EditorStyleStep.svelte'
import EditorDeveloperQuestionStep from '../components/common/tour/steps/EditorDeveloperQuestionStep.svelte'
import EditorDevToolsStep from '../components/common/tour/steps/EditorDevToolsStep.svelte'
import { show, hide } from '../stores/common.store'

/**
 * @typedef {import('shepherd.js').Step.StepOptions} StepOptions
 */

const DEFAULT_TOUR_OPTIONS = {
  useModalOverlay: true,
  defaultStepOptions: {
    classes: 'ddoc-shepherd',
    scrollTo: { behavior: 'smooth', block: 'center' },
    cancelIcon: { enabled: true },
    canClickTarget: true
  }
}

/**
 * @param {any} step
 */
function cleanupStepSvelte(step) {
  const state = step && step.__ddocSvelte
  if (!state) return
  try {
    unmount(state.instance)
  } catch {
    // ignore
  }
  try {
    state.host?.remove?.()
  } catch {
    // ignore
  }
  step.__ddocSvelte = null
}

/**
 * Mounts a Svelte component into the current step DOM.
 * @param {any} step
 * @param {any} Component
 * @param {Record<string, any>} props
 */
function mountIntoStep(step, Component, props) {
  cleanupStepSvelte(step)

  const el = step?.getElement?.()
  if (!el) return

  /** @type {HTMLElement | null} */
  const textEl = el.querySelector('.shepherd-text')
  if (!textEl) return

  textEl.innerHTML = ''
  const host = document.createElement('div')
  textEl.appendChild(host)

  const instance = mount(Component, {
    target: host,
    props
  })

  step.__ddocSvelte = { instance, host }
}

/**
 * @param {any} tour
 * @param {any} StepComponent
 * @param {StepOptions} options
 * @param {Record<string, any>} [componentProps]
 */
function addSvelteStep(tour, StepComponent, options, componentProps = {}) {
  const userWhen = options.when || {}
  tour.addStep({
    ...options,
    text: ' ', // ensures `.shepherd-text` exists for mounting
    when: {
      show() {
        const step = this
        mountIntoStep(step, ShepherdTourWrapper, {
          ...componentProps,
          StepComponent
        })
        try {
          userWhen.show?.call(this)
        } catch {
          // ignore
        }
      },
      hide() {
        cleanupStepSvelte(this)
        try {
          userWhen.hide?.call(this)
        } catch {
          // ignore
        }
      },
      destroy() {
        cleanupStepSvelte(this)
        try {
          userWhen.destroy?.call(this)
        } catch {
          // ignore
        }
      },
      // do not spread `options.when` to avoid clobbering the Svelte bridge
    }
  })
}

function createTour() {
  return new Shepherd.Tour(DEFAULT_TOUR_OPTIONS)
}

export function startHomeTour() {
  const tour = createTour()

  addSvelteStep(
    tour,
    HomeWelcomeStep,
    {
      id: 'home-welcome',
      buttons: [
        { text: 'Skip', action: () => tour.cancel() },
        { text: 'Next', action: () => tour.next() }
      ]
    },
    { __title: 'dynadoc - Privacy First, Performance Oriented' }
  )

  addSvelteStep(
    tour,
    HomeThemeStep,
    {
      id: 'home-theme',
      attachTo: { element: '.theme-switcher', on: 'bottom' },
      buttons: [
        { text: 'Back', action: () => tour.back() },
        { text: 'Skip', action: () => tour.cancel() },
        { text: 'Next', action: () => tour.next() }
      ]
    },
    { __title: 'Theme' }
  )

  addSvelteStep(
    tour,
    HomeCreateDocStep,
    {
      id: 'home-new-doc',
      attachTo: { element: '.btn-new-document', on: 'bottom' },
      buttons: [
        { text: 'Back', action: () => tour.back() },
        { text: 'Done', action: () => tour.complete() }
      ]
    },
    { __title: 'Create a document' }
  )

  tour.start()
  return tour
}

export function startEditorTour() {
  // Start from a known UI state: keep the ribbon hidden so Step 1 click reveals it.
  try {
    hide('ribbon')
  } catch {
    // ignore
  }
  const tour = createTour()

  addSvelteStep(
    tour,
    EditorRibbonStep,
    {
      id: 'editor-ribbon',
      attachTo: { element: '.ribbon-toggle', on: 'bottom' },
      advanceOn: { selector: '.ribbon-toggle, .ribbon-toggle *', event: 'click' },
      buttons: []
    },
    { __title: 'Ribbon HUD' }
  )

  addSvelteStep(
    tour,
    EditorStyleStep,
    {
      id: 'editor-style',
      attachTo: { element: '.style-picker', on: 'bottom' },
      when: {
        show() {
          try {
            show('ribbon')
          } catch {
            // ignore
          }
        }
      },
      buttons: [
        { text: 'Back', action: () => tour.back() },
        { text: 'Next', action: () => tour.next() }
      ]
    },
    { __title: 'Styles' }
  )

  addSvelteStep(
    tour,
    EditorDeveloperQuestionStep,
    {
      id: 'editor-dev-question',
      buttons: [
        { text: 'No', action: () => tour.complete() },
        { text: 'Yes', action: () => tour.show('editor-dev-tools') }
      ]
    },
    { __title: 'One quick question' }
  )

  addSvelteStep(
    tour,
    EditorDevToolsStep,
    {
      id: 'editor-dev-tools',
      attachTo: { element: '.editor-controls', on: 'bottom' },
      advanceOn: {
        selector:
          '.code-editor-toggle, .code-editor-toggle *, .console-toggle, .console-toggle *',
        event: 'click'
      },
      buttons: []
    },
    { __title: 'Dev Tools' }
  )

  tour.start()
  return tour
}
