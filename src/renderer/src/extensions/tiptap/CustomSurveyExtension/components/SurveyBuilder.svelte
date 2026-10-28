<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import { _ } from 'svelte-i18n'
  import { v4 as uuidv4 } from 'uuid'
  import { get } from 'svelte/store'

  import { nodeApi } from '../../../../utils/shims/node'
  import { ensureNodeViewSrc } from '../../utils/utils'
  import { DocumentModel } from '../../../../models/Document'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import { authStore } from '../../../../stores/auth.store'
  import { openAuth, getSession } from '../../../../services/auth/auth.service'
  import { openAlertModal } from '../../../../stores/alertModal.store'
  import { openConfirmModal } from '../../../../stores/confirmModal.store'
  import { DriveActions } from '../../../../utils/driveActions'
  import EditorCommonUtils from '../../../../utils/common.utils'
  import { resolveLocalCollabPresence } from '../../../../utils/collabPresence'
  import { buildCollabDocId, resolveShareContext } from '../../../../utils/collabUtils'
  import { createSurvey, type CollaborativeSurvey } from '../collab/collab'
  import { NodeSharing } from '../../utils/nodeSharing'

  import ContextMenu from '../../../../components/common/contextMenu/ContextMenu.svelte'
  import SurveyQuestionTypeMenu from './SurveyQuestionTypeMenu.svelte'
  import {
    coerceSurveyDoc,
    defaultQuestionV1,
    defaultSectionV1,
    defaultSurveyDocV1,
    type Analytics,
    type ResponseFile,
    type SurveyDocV1,
    type SurveyQuestionType,
    type SurveyQuestionV1
  } from '../utils/surveySchema'
  import SurveyQuestionCard from './SurveyQuestionCard.svelte'
  import Resizer from '../../../../components/app/editor/components/display/Resizer.svelte'
  import SurveyBuilderWidget from './SurveyBuilderWidget.svelte'
  import SurveyPreview from './SurveyPreview.svelte'
  import SurveyResponse from './SurveyResponse.svelte'

  interface Props {
    node: any
    editor: any
    view: any
    getPos: () => number
    updateAttributes: (attrs: Record<string, any>) => void
    selected: boolean
    extension: any
    useNodeViewWrapper?: boolean
    isMirror?: boolean
    __src?: string
    __itemHeight?: number
    __itemWidth?: number
    __maxPageHeight?: number
    __maxPageWidth?: number
    __wysiwygEditorIdToUpdate?: string
  }

  let {
    node,
    editor,
    view,
    getPos,
    updateAttributes,
    selected,
    extension,
    useNodeViewWrapper = true,
    isMirror = false,
    __src,
    __itemHeight,
    __itemWidth,
    __maxPageHeight,
    __maxPageWidth,
    __wysiwygEditorIdToUpdate
  }: Props = $props()

  const _maxPageHeight = $derived(__maxPageHeight ?? node?.attrs?.maxPageHeight)
  const _maxPageWidth = $derived(__maxPageWidth ?? node?.attrs?.maxPageWidth)
  const _wysiwygId = $derived(__wysiwygEditorIdToUpdate ?? node?.attrs?.wysiwygEditorIdToUpdate)
  const _itemHeight = $derived(__itemHeight ?? node?.attrs?.height ?? _maxPageHeight)
  const _itemWidth = $derived(__itemWidth ?? node?.attrs?.width ?? _maxPageWidth)

  // const paginationStore = _$_wysiwygEditorsList.getPaginationOptionsStore(_wysiwygId)
  // Now $derived will track $paginationStore correctly!
  // let _editorPaginationOptions = $derived($paginationStore || null)

  const _shouldWrap = $derived(useNodeViewWrapper && !isMirror)

  let currentSrc = $state<string>(__src ?? node?.attrs?.src ?? '')
  let mode = $state<'builder' | 'preview' | 'settings' | 'response'>(
    isMirror ? 'preview' : 'builder'
  )

  let survey = $state<SurveyDocV1>(defaultSurveyDocV1())
  let _collab: CollaborativeSurvey | null = $state(null)
  const _parentDoc = $derived(get(_$_documentEditorsList.get(_wysiwygId))?.document)

  const _userInfo = $derived.by(() => {
    const authState = get(authStore)
    const shareContext = resolveShareContext(_parentDoc)
    const presence = resolveLocalCollabPresence({
      docId: _collabDocId || 'survey-init',
      authUser: authState?.authenticated ? authState.user : null,
      forceAnonymous: Boolean(shareContext)
    })
    return { name: presence.name, color: presence.color }
  })

  let _collabDocId = $state('')
  $effect(() => {
    if (_parentDoc && currentSrc) {
      buildCollabDocId(_parentDoc, currentSrc).then((id) => {
        _collabDocId = id
      })
    }
  })

  let activeSectionId = $state<string>('')
  let activeQuestionId = $state<string>('')

  let isReady = $state(false)
  let isSaving = $state(false)
  let lastSavedAt = $state<number | null>(null)
  let saveTimer: any = null

  const typeItems = [
    {
      type: 'short_text',
      label: $_('Short answer'),
      icon: 'ph-light ph-text-t',
      hint: $_('One-line responses')
    },
    {
      type: 'long_text',
      label: $_('Paragraph'),
      icon: 'ph-light ph-text-align-left',
      hint: $_('Multi-line responses')
    },
    {
      type: 'single_choice',
      label: $_('Multiple choice'),
      icon: 'ph-light ph-radio-button',
      hint: $_('Pick one option')
    },
    {
      type: 'multiple_choice',
      label: $_('Checkboxes'),
      icon: 'ph-light ph-check-square',
      hint: $_('Pick one or more')
    },
    {
      type: 'dropdown',
      label: $_('Dropdown'),
      icon: 'ph-light ph-caret-circle-down',
      hint: $_('Compact list selection')
    },
    {
      type: 'date',
      label: $_('Date'),
      icon: 'ph-light ph-calendar',
      hint: $_('Pick a date')
    },
    {
      type: 'file_upload',
      label: $_('File upload'),
      icon: 'ph-light ph-upload-simple',
      hint: $_('Let respondents attach files')
    },
    {
      type: 'slider',
      label: $_('Linear scale'),
      icon: 'ph-light ph-sliders-horizontal',
      hint: $_('Rate on a scale')
    },
    {
      type: 'switch',
      label: $_('Yes / No'),
      icon: 'ph-light ph-toggle-right',
      hint: $_('Simple boolean choice')
    },
    {
      type: 'section_header',
      label: $_('Section title'),
      icon: 'ph-light ph-layout',
      hint: $_('Add a visual break')
    }
  ] as const satisfies Array<{
    type: SurveyQuestionType
    label: string
    icon: string
    hint?: string
  }>

  const activeSection = $derived.by(() => {
    const found = survey.sections.find((s) => s.id === activeSectionId)
    return found || survey.sections[0] || null
  })

  const activeQuestion = $derived.by(() => {
    if (!activeSection) return null
    return activeSection.questions.find((q) => q.id === activeQuestionId) || null
  })

  const ensureSelectionDefaults = () => {
    if (!survey.sections.length) {
      survey.sections = [defaultSectionV1('Section 1')]
    }
    if (!activeSectionId || !survey.sections.some((s) => s.id === activeSectionId)) {
      activeSectionId = survey.sections[0]?.id || ''
    }
    const section = survey.sections.find((s) => s.id === activeSectionId)
    if (
      section &&
      (!activeQuestionId || !section.questions.some((q) => q.id === activeQuestionId))
    ) {
      activeQuestionId = section.questions[0]?.id || ''
    }
  }

  const safeReadJson = async (filePath: string) => {
    try {
      const raw = await nodeApi.fsPromises?.readFile?.(filePath, 'utf8')
      if (!raw) return null
      const trimmed = String(raw).trim()
      if (!trimmed || trimmed === '{}') return null
      return JSON.parse(trimmed)
    } catch {
      return null
    }
  }

  const safeWriteJson = async (filePath: string, payload: any) => {
    if (!nodeApi.path?.dirname || !nodeApi.fsPromises?.mkdir || !nodeApi.fsPromises?.writeFile)
      return
    await nodeApi.fsPromises.mkdir(nodeApi.path.dirname(filePath), { recursive: true })
    await nodeApi.fsPromises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  const scheduleSave = () => {
    if (!currentSrc) return

    // Sync to Yjs
    if (_collab) {
      _collab.ydoc.transact(() => {
        const snapshot = JSON.parse(JSON.stringify({ ...survey, updatedAt: Date.now() }))
        for (const [key, value] of Object.entries(snapshot)) {
          if (JSON.stringify(_collab!.yMap.get(key)) !== JSON.stringify(value)) {
            _collab!.yMap.set(key, value)
          }
        }
      }, 'local')
    }

    clearTimeout(saveTimer)
    isSaving = true
    const snapshot = JSON.parse(JSON.stringify({ ...survey, updatedAt: Date.now() })) as SurveyDocV1
    saveTimer = setTimeout(async () => {
      try {
        await safeWriteJson(currentSrc, snapshot)
        lastSavedAt = Date.now()
        updateAttributes?.({ src: currentSrc, title: snapshot.title })
      } finally {
        isSaving = false
      }
    }, 450)
  }

  const addQuestion = (type: SurveyQuestionType = 'short_text') => {
    if (!activeSection) return
    const next = defaultQuestionV1(type)
    const sectionIndex = survey.sections.findIndex((s) => s.id === activeSection.id)
    if (sectionIndex < 0) return
    const section = survey.sections[sectionIndex]
    const updated = { ...section, questions: [...section.questions, next] }
    survey.sections = [
      ...survey.sections.slice(0, sectionIndex),
      updated,
      ...survey.sections.slice(sectionIndex + 1)
    ]
    activeQuestionId = next.id
    scheduleSave()
  }

  const duplicateQuestion = (question: SurveyQuestionV1) => {
    if (!activeSection) return
    const copy: SurveyQuestionV1 = {
      ...JSON.parse(JSON.stringify(question)),
      id: uuidv4(),
      title: `${question.title || $_('Question')} (${$_('Copy')})`
    }
    const sectionIndex = survey.sections.findIndex((s) => s.id === activeSection.id)
    const questionIndex = activeSection.questions.findIndex((q) => q.id === question.id)
    const section = survey.sections[sectionIndex]
    const nextQuestions = [...section.questions]
    nextQuestions.splice(Math.max(0, questionIndex + 1), 0, copy)
    survey.sections[sectionIndex] = { ...section, questions: nextQuestions }
    activeQuestionId = copy.id
    scheduleSave()
  }

  const deleteQuestion = (questionId: string) => {
    if (!activeSection) return
    const sectionIndex = survey.sections.findIndex((s) => s.id === activeSection.id)
    const section = survey.sections[sectionIndex]
    const nextQuestions = section.questions.filter((q) => q.id !== questionId)
    if (nextQuestions.length === 0) nextQuestions.push(defaultQuestionV1('short_text'))
    survey.sections[sectionIndex] = { ...section, questions: nextQuestions }
    activeQuestionId = nextQuestions[0]?.id || ''
    scheduleSave()
  }

  const patchQuestion = (questionId: string, patch: Partial<SurveyQuestionV1>) => {
    if (!activeSection) return
    const sectionIndex = survey.sections.findIndex((s) => s.id === activeSection.id)
    const section = survey.sections[sectionIndex]
    const nextQuestions = section.questions.map((q) =>
      q.id === questionId ? { ...q, ...patch } : q
    )
    survey.sections[sectionIndex] = { ...section, questions: nextQuestions }
    scheduleSave()
  }

  const moveQuestion = (questionId: string, direction: -1 | 1) => {
    if (!activeSection) return
    const sectionIndex = survey.sections.findIndex((s) => s.id === activeSection.id)
    const section = survey.sections[sectionIndex]
    const idx = section.questions.findIndex((q) => q.id === questionId)
    const nextIdx = idx + direction
    if (idx < 0 || nextIdx < 0 || nextIdx >= section.questions.length) return
    const nextQuestions = [...section.questions]
    const [item] = nextQuestions.splice(idx, 1)
    nextQuestions.splice(nextIdx, 0, item)
    survey.sections[sectionIndex] = { ...section, questions: nextQuestions }
    scheduleSave()
  }

  const addSection = () => {
    const next = defaultSectionV1(`${$_('Section')} ${survey.sections.length + 1}`)
    survey.sections = [...survey.sections, next]
    activeSectionId = next.id
    activeQuestionId = next.questions[0]?.id || ''
    scheduleSave()
  }

  const deleteSection = (sectionId: string) => {
    const next = survey.sections.filter((s) => s.id !== sectionId)
    survey.sections = next.length ? next : [defaultSectionV1(`${$_('Section')} 1`)]
    activeSectionId = survey.sections[0]?.id || ''
    activeQuestionId = survey.sections[0]?.questions?.[0]?.id || ''
    scheduleSave()
  }

  const patchSection = (sectionId: string, patch: { title?: string; description?: string }) => {
    survey.sections = survey.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s))
    scheduleSave()
  }

  const load = async () => {
    // INNOVATIVE FIX: Use flat naming (survey.json, survey2.json) instead of nested folders
    const resolvedPath = await ensureNodeViewSrc(
      currentSrc,
      'survey',  // Changed from 'index' to 'survey' for clearer naming
      DocumentModel.AssetType.SURVEY,
      null,
      undefined,
      JSON.stringify(defaultSurveyDocV1(), null, 2)
    )
    currentSrc = resolvedPath
    updateAttributes?.({ src: resolvedPath })

    _collab = await createSurvey(node?.attrs?.id, resolvedPath, _parentDoc, _userInfo)

    // Sync from Yjs to Svelte
    _collab.yMap.observeDeep(() => {
      const data = _collab!.yMap.toJSON()
      if (JSON.stringify(data) !== JSON.stringify(survey)) {
        survey = coerceSurveyDoc(data)
      }
    })

    const initialData = _collab.yMap.toJSON()
    if (Object.keys(initialData).length > 0) {
      survey = coerceSurveyDoc(initialData)
    } else {
      const parsed = await safeReadJson(resolvedPath)
      survey = coerceSurveyDoc(parsed)
      // Populate Yjs if empty
      _collab.ydoc.transact(() => {
        for (const [key, value] of Object.entries(survey)) {
          _collab!.yMap.set(key, value)
        }
      }, 'local')
    }

    ensureSelectionDefaults()
    isReady = true
  }

  onMount(() => {
    void load()
  })

  onDestroy(() => {
    clearTimeout(saveTimer)
    _collab?.destroy()
  })

  // keep selection stable if document changes externally
  $effect(() => {
    survey.sections
    ensureSelectionDefaults()
  })

  const selectThisNode = () => {
    try {
      if (typeof getPos === 'function' && editor?.commands?.setNodeSelection) {
        editor.commands.setNodeSelection(getPos())
      }
    } catch {
      // best effort
    }
  }

  const exportJsonToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(survey, null, 2))
    } catch {
      // ignore
    }
  }

  const importJsonFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text)
      survey = coerceSurveyDoc(parsed)
      ensureSelectionDefaults()
      scheduleSave()
    } catch {
      // ignore
    }
  }

  async function setPublished(published: boolean) {
    const result = await NodeSharing.setPublished(published, {
      nodeId: String(node?.attrs?.id || '').trim(),
      assetPath: currentSrc,
      assetName: survey?.title || $_('Survey'),
      wysiwygId: _wysiwygId
    })

    if (!result) return

    survey.settings.isPublished = result.isPublished
    if (result.isPublished) {
      if (survey.settings.isOpen === undefined) survey.settings.isOpen = true
      survey.publish = {
        ...result.publish,
        surveyDrivePath: await NodeSharing.mapLocalCachePathToDriveHome(currentSrc)
      }
    } else {
      survey.publish = undefined
    }
    
    scheduleSave()
  }
  // Package actions to pass down
  const actions = {
    addQuestion,
    patchQuestion,
    deleteQuestion,
    duplicateQuestion,
    moveQuestion,
    addSection,
    patchSection,
    deleteSection,
    setPublished,
    scheduleSave,
    exportJsonToClipboard,
    importJsonFromClipboard
  }
</script>

{#if _shouldWrap}
  <NodeViewWrapper
    as="div"
    class="dynadoc-spectrum-builder"
    onclick={(e) => {
      e.stopPropagation()
      selectThisNode()
    }}
  >
    {@render SurveyInner()}
  </NodeViewWrapper>
{:else}
  <div
    class="dynadoc-spectrum-builder"
    onclick={(e) => {
      e.stopPropagation()
      selectThisNode()
    }}
  >
    {@render SurveyInner()}
  </div>
{/if}

{#snippet SurveyInner()}
  <Resizer
    __width={_itemWidth}
    __height={_itemHeight}
    __maxHeight={_maxPageHeight}
    __maxWidth={_maxPageWidth}
    __direction="both"
    __onUpdate={(newAttrs) =>
      updateAttributes?.({ width: newAttrs.width, height: newAttrs.height })}
  >
    <div class="spectrum-container">
      <!-- TOP TOOLBAR: STATUS & MODE -->
      <header class="spectrum-toolbar">
        <div class="flex items-center gap-3 min-w-0">
          <div class="p-1.5 bg-accent/10 rd-6px">
            <i class="ph-bold ph-read-cv-logo text-accent text-16px"></i>
          </div>
          <div class="min-w-0">
            <input
              class="header-input"
              value={survey.title || $_('Untitled Survey')}
              oninput={(e) => {
                survey.title = e.currentTarget.value
                scheduleSave()
              }}
            />
            <div class="meta-info">
              <i class="ph-light ph-database text-10px"></i>
              <span>{currentSrc ? nodeApi.path?.basename?.(currentSrc) : 'LOCAL_INSTANCE'}</span>
              {#if survey?.settings?.isPublished}
                <span
                  class="ml-2 inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rd-999 bg-green-500/10 text-green-200 border border-green-500/20"
                >
                  <i class="ph-light ph-broadcast text-[10px]"></i>
                  {$_('Published')}
                </span>
              {:else}
                <span
                  class="ml-2 inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rd-999 bg-white/5 text-white/40 border border-white/10"
                >
                  <i class="ph-light ph-lock-key text-[10px]"></i>
                  {$_('Draft')}
                </span>
              {/if}
              {#if survey?.settings?.isPublished && survey?.settings?.isOpen === false}
                <span
                  class="ml-2 inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rd-999 bg-amber-500/10 text-amber-200 border border-amber-500/20"
                >
                  <i class="ph-light ph-hand-stop text-[10px]"></i>
                  {$_('Closed')}
                </span>
              {/if}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <!-- SAVE STATUS -->
          <div class="save-badge {isSaving ? 'is-syncing' : ''}">
            <i class="ph-bold {isSaving ? 'ph-arrows-clockwise' : 'ph-cloud-check'}"></i>
            <span>{isSaving ? $_('SYNCING...') : $_('SAVED')}</span>
          </div>

          {#if survey?.publish?.link}
            <button
              class="spectrum-button-toggle"
              title="Copy public link"
              onclick={async () => {
                try {
                  await EditorCommonUtils.copyToClipboard(String(survey.publish.link))
                  await openAlertModal({
                    title: 'Link copied',
                    message: 'Survey link copied to clipboard.'
                  })
                } catch {
                  await openAlertModal({
                    title: 'Survey link',
                    message: String(survey.publish.link)
                  })
                }
              }}
            >
              <i class="ph-bold ph-link-simple"></i>
              <span>Copy link</span>
            </button>
          {/if}

          <!-- MODE TOGGLE -->
          <button
            class="spectrum-button-toggle"
            onclick={() => (mode = mode === 'builder' ? 'preview' : 'builder')}
          >
            <i class="ph-bold {mode === 'builder' ? 'ph-eye' : 'ph-pencil-line'}"></i>
            <span>{mode === 'builder' ? $_('Preview') : $_('Edit')}</span>
          </button>

          <button class="spectrum-button-toggle" onclick={() => (mode = 'response')}>
            <i class="ph-bold ph-chart-bar"></i>
            <span>{$_('Responses')}</span>
          </button>
        </div>
      </header>

      {#if !isReady}
        <div class="loading-state">
          <i class="ph-light ph-circle-notch animate-spin"></i>
          <span>{$_('INITIALIZING_SYSTEM...')}</span>
        </div>
      {:else if mode === 'preview'}
        <SurveyPreview
          {survey}
          {typeItems}
          __disabled={false}
          __surveyDrivePath={survey?.publish?.surveyDrivePath || ''}
        />
      {:else if mode === 'response'}
        {@const responses: ResponseFile[] = [
  {
    responseId: uuidv4(),
    surveyId: 'survey-123',
    metadata: {
      submittedAt: Date.now() - 100000,
      durationSeconds: 45,
      ipAddress: '192.168.1.1'
    },
    answers: [
      { questionId: 'q-short', type: 'short_text', value: 'Loving the new interface!' },
      { questionId: 'q-single', type: 'single_choice', value: 'option_1', label: 'Very Satisfied' },
      { questionId: 'q-multi', type: 'multiple_choice', value: ['opt_a', 'opt_c'], label: ['Speed', 'Reliability'] },
      { questionId: 'q-slider', type: 'slider', value: '8' }
    ]
  },
  {
    responseId: uuidv4(),
    surveyId: 'survey-123',
    metadata: {
      submittedAt: Date.now() - 50000,
      durationSeconds: 120,
    },
    answers: [
      { questionId: 'q-short', type: 'short_text', value: 'Could use more export options.' },
      { questionId: 'q-single', type: 'single_choice', value: 'option_2', label: 'Neutral' },
      { questionId: 'q-multi', type: 'multiple_choice', value: ['opt_b'], label: ['Price'] },
      { questionId: 'q-slider', type: 'slider', value: '4' }
    ]
  }
]}
        {@const analytics: Analytics = {
  surveyId: 'survey-123',
  totalResponses: 25,
  stats: [
    {
      questionId: 'q-short',
      chartType: 'list',
      latestResponses: [
        'Loving the new interface!',
        'Could use more export options.',
        'Great work on the Docker integration.'
      ]
    },
    {
      questionId: 'q-single',
      chartType: 'pie',
      totalVotes: 25,
      data: [
        { label: 'Very Satisfied', value: 'option_1', count: 15, percentage: 60 },
        { label: 'Neutral', value: 'option_2', count: 7, percentage: 28 },
        { label: 'Unsatisfied', value: 'option_3', count: 3, percentage: 12 }
      ]
    },
    {
      questionId: 'q-slider',
      chartType: 'number',
      average: 7.2,
      min: 2,
      max: 10
    },
    {
      questionId: 'q-multi',
      chartType: 'bar',
      totalVotes: 42, // Sum of all checked boxes
      data: [
        { label: 'Speed', value: 'opt_a', count: 20, percentage: 47 },
        { label: 'Price', value: 'opt_b', count: 10, percentage: 23 },
        { label: 'Reliability', value: 'opt_c', count: 12, percentage: 30 }
      ]
    }
  ]
}}
        <SurveyResponse {survey} {responses} {analytics} />
      {:else}
        <!-- BUILDER MODE -->
        <SurveyBuilderWidget
          bind:survey
          bind:activeSectionId
          bind:activeQuestionId
          {typeItems}
          {actions}
        />
      {/if}
    </div>
  </Resizer>
{/snippet}

<style lang="postcss">
  .spectrum-container {
    @apply w-full transition-colors p-2;
    @apply bg-[var(--theme-surface-1)] border border-[var(--theme-border-subtle)] rd-12px;
    @apply text-[var(--theme-text-1)];
    font-family: var(--brand-font-sans);
  }

  /* TOOLBAR */
  .spectrum-toolbar {
    @apply flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10;
    @apply bg-[var(--theme-surface-1)] border-[var(--theme-border-subtle)];
  }

  .header-input {
    @apply bg-transparent border-none outline-none text-13px font-bold transition-colors w-full;
    @apply text-[var(--theme-text-1)] focus:text-[var(--color-base-300)];
    @apply placeholder:text-[var(--theme-text-muted)];
  }

  .meta-info {
    @apply flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest;
    @apply text-[var(--theme-text-muted)];
  }

  .save-badge {
    @apply flex items-center gap-2 px-2 py-1 rd-4px text-[9px] font-mono font-bold;
    @apply bg-[var(--theme-overlay-soft)] text-[var(--theme-text-muted)];
  }

  .is-syncing {
    @apply text-[var(--color-base-300)] bg-[var(--theme-overlay-medium)];
  }

  /* NAVIGATION */
  .section-nav {
    @apply flex items-center gap-1 px-4 py-2 border-b overflow-x-auto;
    @apply bg-[var(--theme-overlay-medium)] border-[var(--theme-border-subtle)];
  }

  .nav-tab {
    @apply flex items-center gap-2 px-3 py-1.5 rd-6px text-11px font-bold transition-all;
    @apply text-[var(--theme-text-muted)] hover:bg-[var(--theme-overlay-soft)];
  }

  .nav-tab.is-active {
    @apply text-[var(--theme-text-1)] shadow-sm;
    @apply bg-[var(--theme-border-subtle)];
  }

  .tab-index {
    @apply text-[9px] opacity-30;
  }

  /* CARDS */
  .spectrum-card {
    @apply relative border rd-8px p-5 transition-all;
    @apply bg-[var(--theme-surface-2)] border-[var(--theme-border-subtle)];
  }

  .active-indicator {
    @apply absolute left-0 top-4 bottom-4 w-[3px] rd-r-full;
    @apply bg-[var(--color-base-300)];
  }

  .section-title-input {
    @apply bg-transparent border-none outline-none text-18px font-800 w-full;
    @apply text-[var(--theme-text-1)];
  }

  .desc-textarea {
    @apply w-full bg-transparent border-none outline-none text-12px resize-none;
    @apply text-[var(--theme-text-muted)] placeholder:text-[var(--theme-text-muted)];
    @apply opacity-70 hover:opacity-100 focus:opacity-100 transition-opacity;
  }

  /* FLOATING RAIL */
  .spectrum-rail {
    @apply absolute top-1/2 -translate-y-1/2 right-4 z-50;
  }

  .rail-inner {
    @apply flex flex-col gap-1 p-1 border rd-full shadow-2xl;
    @apply bg-[var(--theme-surface-1)] border-[var(--theme-border-subtle)];
  }

  .rail-btn {
    @apply size-10 flex items-center justify-center rd-full transition-all;
    @apply text-[var(--theme-text-muted)] hover:bg-[var(--theme-overlay-soft)] hover:text-[var(--color-base-300)];
  }

  .rail-divider {
    @apply h-px w-6 mx-auto bg-[var(--theme-border-subtle)];
  }

  /* UTILS */
  .spectrum-button-toggle {
    @apply flex items-center gap-2 px-3 py-1.5 rd-6px text-11px font-bold transition-all;
    @apply bg-[var(--color-base-300)] text-[var(--theme-elevated-text)] hover:brightness-110 active:scale-95;
  }

  .spectrum-checkbox {
    @apply flex items-center gap-2 text-11px font-bold cursor-pointer transition-colors;
    @apply text-[var(--theme-text-muted)] hover:text-[var(--theme-text-1)];
  }

  .spectrum-checkbox input {
    @apply appearance-none size-3.5 border rd-3px transition-all cursor-pointer;
    @apply border-[var(--theme-border-subtle)] checked:bg-[var(--color-base-300)] checked:border-[var(--color-base-300)];
    @apply relative;
  }

  /* Visual checkmark for native variable compatibility */
  .spectrum-checkbox input:checked::after {
    content: '✓';
    @apply absolute inset-0 flex items-center justify-center text-[10px] font-black;
    @apply text-[var(--theme-elevated-text)];
  }
</style>
