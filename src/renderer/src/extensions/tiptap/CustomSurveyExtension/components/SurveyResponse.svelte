<script lang="ts">
  import { onMount } from 'svelte'
  import type { Analytics, ResponseFile, SurveyDoc } from '../utils/surveySchema'

  interface Props {
    survey: SurveyDoc
    analytics: Analytics
    responses: ResponseFile[]
  }

  let { survey, analytics, responses }: Props = $props()

  // ─── State ────────────────────────────────────────────────────────────────
  type TabId = 'summary' | 'question' | 'individual'
  let activeTab = $state<TabId>('summary')
  let activeQuestionIdx = $state(0)
  let activeResponseIdx = $state(0)
  let searchQuery = $state('')
  let hoveredSegment = $state<string | null>(null)
  let showExportMenu = $state(false)
  let timeFilter = $state<'all' | '7d' | '30d'>('all')
  let aiInsightVisible = $state(false)
  let aiInsightLoading = $state(false)
  let aiInsightText = $state('')
  let canvasRefs = $state<Record<string, HTMLCanvasElement | null>>({})

  // ─── Derived ──────────────────────────────────────────────────────────────
  const allQuestions = $derived(
    survey.sections.flatMap((s) => s.questions.map((q) => ({ ...q, sectionTitle: s.title })))
  )

  const filteredResponses = $derived.by(() => {
    let r = responses
    if (timeFilter === '7d') {
      const cutoff = Date.now() - 7 * 86400000
      r = r.filter((x) => x.metadata.submittedAt >= cutoff)
    } else if (timeFilter === '30d') {
      const cutoff = Date.now() - 30 * 86400000
      r = r.filter((x) => x.metadata.submittedAt >= cutoff)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      r = r.filter((x) =>
        x.answers.some(
          (a) =>
            String(a.value).toLowerCase().includes(q) ||
            (Array.isArray(a.label) ? a.label : [a.label ?? '']).some((l) =>
              l.toLowerCase().includes(q)
            )
        )
      )
    }
    return r
  })

  const avgDuration = $derived.by(() => {
    if (!responses.length) return 0
    return Math.round(
      responses.reduce((s, r) => s + (r.metadata.durationSeconds ?? 0), 0) / responses.length
    )
  })

  const completionRate = $derived.by(() => {
    if (!responses.length) return 0
    const totalQ = allQuestions.length
    const completed = responses.filter((r) => r.answers.length >= totalQ).length
    return Math.round((completed / responses.length) * 100)
  })

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function getStatForQuestion(questionId: string): QuestionStat | undefined {
    return analytics.stats.find((s) => s.questionId === questionId)
  }

  function getAnswerForResponse(response: ResponseFile, questionId: string): Answer | undefined {
    return response.answers.find((a) => a.questionId === questionId)
  }

  function formatDate(ts: number): string {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts))
  }

  function formatDuration(s: number): string {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  function displayAnswer(answer: Answer | undefined): string {
    if (!answer) return '—'
    if (Array.isArray(answer.label)) return answer.label.join(', ')
    if (answer.label) return answer.label
    if (Array.isArray(answer.value)) return answer.value.join(', ')
    return String(answer.value ?? '—')
  }

  // ─── Chart renderers ──────────────────────────────────────────────────────
  const PALETTE = [
    '#00e5c4',
    '#0047ff',
    '#ff003a',
    '#f5c842',
    '#a855f7',
    '#f97316',
    '#22d3ee',
    '#84cc16',
    '#fb7185',
    '#34d399'
  ]

  function drawDonut(canvas: HTMLCanvasElement, data: StatItem[]) {
    const ctx = canvas.getContext('2d')
    if (!ctx || !data.length) return
    const W = canvas.width,
      H = canvas.height
    const cx = W / 2,
      cy = H / 2
    const r = Math.min(W, H) * 0.38
    const inner = r * 0.55
    ctx.clearRect(0, 0, W, H)

    let start = -Math.PI / 2
    data.forEach((seg, i) => {
      const angle = (seg.percentage / 100) * 2 * Math.PI
      const isHov = hoveredSegment === seg.value
      const rr = isHov ? r + 6 : r

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, rr, start, start + angle)
      ctx.closePath()
      ctx.fillStyle = PALETTE[i % PALETTE.length]
      ctx.globalAlpha = isHov ? 1 : 0.85
      ctx.fill()

      start += angle
    })

    // Hole
    ctx.beginPath()
    ctx.arc(cx, cy, inner, 0, 2 * Math.PI)
    ctx.fillStyle = '#0a0e1a'
    ctx.globalAlpha = 1
    ctx.fill()

    // Center text
    ctx.fillStyle = '#f5f0e8'
    ctx.font = `bold ${Math.round(W * 0.1)}px "DM Serif Display", serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(analytics.totalResponses), cx, cy - 6)
    ctx.font = `${Math.round(W * 0.055)}px "DM Sans", sans-serif`
    ctx.fillStyle = 'rgba(245,240,232,0.4)'
    ctx.fillText('responses', cx, cy + 14)
  }

  function drawBar(canvas: HTMLCanvasElement, data: StatItem[]) {
    const ctx = canvas.getContext('2d')
    if (!ctx || !data.length) return
    const W = canvas.width,
      H = canvas.height
    const pad = { top: 16, bottom: 36, left: 8, right: 8 }
    const barW = ((W - pad.left - pad.right) / data.length) * 0.6
    const gap = (W - pad.left - pad.right) / data.length
    ctx.clearRect(0, 0, W, H)

    const maxCount = Math.max(...data.map((d) => d.count), 1)

    data.forEach((seg, i) => {
      const x = pad.left + i * gap + (gap - barW) / 2
      const barH = (seg.count / maxCount) * (H - pad.top - pad.bottom)
      const y = H - pad.bottom - barH
      const isHov = hoveredSegment === seg.value
      const color = PALETTE[i % PALETTE.length]

      // Bar background
      ctx.fillStyle = `${color}22`
      ctx.beginPath()
      roundRect(ctx, x, pad.top, barW, H - pad.top - pad.bottom, 4)
      ctx.fill()

      // Bar fill
      const grad = ctx.createLinearGradient(x, y, x, H - pad.bottom)
      grad.addColorStop(0, color)
      grad.addColorStop(1, `${color}44`)
      ctx.fillStyle = grad
      ctx.globalAlpha = isHov ? 1 : 0.85
      ctx.beginPath()
      roundRect(ctx, x, y, barW, barH, 4)
      ctx.fill()
      ctx.globalAlpha = 1

      // Count label
      ctx.fillStyle = isHov ? color : '#f5f0e8'
      ctx.font = `bold ${Math.round(W * 0.06)}px "DM Sans", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(String(seg.count), x + barW / 2, y - 2)

      // Label
      ctx.fillStyle = 'rgba(245,240,232,0.45)'
      ctx.font = `${Math.round(W * 0.048)}px "DM Sans", sans-serif`
      ctx.textBaseline = 'top'
      const label = seg.label.length > 8 ? seg.label.slice(0, 7) + '…' : seg.label
      ctx.fillText(label, x + barW / 2, H - pad.bottom + 6)
    })
  }

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  // Svelte action for chart canvases
  function chartCanvas(node: HTMLCanvasElement, params: { stat: QuestionStat }) {
    function draw() {
      if (!params.stat.data?.length) return
      if (params.stat.chartType === 'pie') drawDonut(node, params.stat.data)
      else if (params.stat.chartType === 'bar') drawBar(node, params.stat.data)
    }
    draw()
    return {
      update(p: { stat: QuestionStat }) {
        params = p
        draw()
      }
    }
  }

  // ─── Simulated AI insight ─────────────────────────────────────────────────
  async function generateInsight(questionId: string) {
    aiInsightVisible = true
    aiInsightLoading = true
    aiInsightText = ''
    // Simulate streaming
    const stat = getStatForQuestion(questionId)
    await new Promise((r) => setTimeout(r, 900))
    const top = stat?.data?.[0]
    const text = top
      ? `${top.percentage}% of respondents chose "${top.label}" — the dominant preference. ${
          stat!.data!.length > 1
            ? `"${stat!.data![1].label}" follows at ${stat!.data![1].percentage}%, suggesting a clear but not absolute consensus.`
            : ''
        } Consider following up with respondents who chose minority options to understand their reasoning.`
      : stat?.latestResponses?.length
        ? `Respondents provided ${stat.latestResponses.length} unique text answers. Common themes include: ${stat.latestResponses
            .slice(0, 3)
            .map((r) => `"${r.slice(0, 30)}"`)
            .join(', ')}.`
        : 'Not enough data to generate an insight for this question yet.'

    // Stream character by character
    for (let i = 0; i < text.length; i++) {
      aiInsightText += text[i]
      await new Promise((r) => setTimeout(r, 12))
    }
    aiInsightLoading = false
  }

  // ─── Export stubs ─────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [
      ['Response ID', 'Submitted At', 'Duration', ...allQuestions.map((q) => q.title)],
      ...responses.map((r) => [
        r.responseId,
        formatDate(r.metadata.submittedAt),
        formatDuration(r.metadata.durationSeconds),
        ...allQuestions.map((q) => displayAnswer(getAnswerForResponse(r, q.id)))
      ])
    ]
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${survey.title.replace(/\s+/g, '_')}_responses.csv`
    a.click()
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(responses, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${survey.title.replace(/\s+/g, '_')}_responses.json`
    a.click()
  }
</script>

<!-- ═══════════════════════════════════════════════════════════════════════════
     SURVEY RESPONSE VIEWER
═══════════════════════════════════════════════════════════════════════════ -->
<div class="sr-root">
  <!-- ── Noise overlay ────────────────────────────────────────────────────── -->
  <div class="sr-noise" aria-hidden="true"></div>

  <!-- ── Header ───────────────────────────────────────────────────────────── -->
  <header class="sr-header">
    <div class="sr-header-left">
      <div class="sr-icon-badge">
        <i class="ph-bold ph-chart-pie-slice"></i>
      </div>
      <div>
        <div class="sr-survey-title">{survey.title}</div>
        <div class="sr-survey-meta">
          <span>{analytics.totalResponses} responses</span>
          <span class="dot">·</span>
          <span>{allQuestions.length} questions</span>
          <span class="dot">·</span>
          <span>{survey.sections.length} sections</span>
        </div>
      </div>
    </div>
    <div class="sr-header-right">
      <!-- Time filter -->
      <div class="time-filter">
        {#each [['all', 'All time'], ['7d', '7 days'], ['30d', '30 days']] as [val, lbl]}
          <button
            class="tf-btn"
            class:active={timeFilter === val}
            onclick={() => (timeFilter = val as any)}>{lbl}</button
          >
        {/each}
      </div>
      <!-- Export -->
      <div class="export-wrap">
        <button class="export-btn" onclick={() => (showExportMenu = !showExportMenu)}>
          <i class="ph-bold ph-export"></i> Export
          <i class="ph-bold ph-caret-down text-[10px]"></i>
        </button>
        {#if showExportMenu}
          <div class="export-menu">
            <button
              onclick={() => {
                exportCSV()
                showExportMenu = false
              }}
            >
              <i class="ph-light ph-file-csv"></i> Download CSV
            </button>
            <button
              onclick={() => {
                exportJSON()
                showExportMenu = false
              }}
            >
              <i class="ph-light ph-file-js"></i> Download JSON
            </button>
          </div>
        {/if}
      </div>
    </div>
  </header>

  <!-- ── KPI row ───────────────────────────────────────────────────────────── -->
  <div class="sr-kpi-row">
    <div class="kpi-card">
      <div class="kpi-value">{analytics.totalResponses}</div>
      <div class="kpi-label">Total Responses</div>
      <div class="kpi-sub">
        <i class="ph-light ph-trend-up text-emerald-400"></i>
        All time
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">{completionRate}%</div>
      <div class="kpi-label">Completion Rate</div>
      <div class="kpi-bar-wrap">
        <div class="kpi-bar" style="width:{completionRate}%"></div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">{formatDuration(avgDuration)}</div>
      <div class="kpi-label">Avg. Duration</div>
      <div class="kpi-sub">per respondent</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">{allQuestions.filter((q) => q.required).length}</div>
      <div class="kpi-label">Required Questions</div>
      <div class="kpi-sub">of {allQuestions.length} total</div>
    </div>
  </div>

  <!-- ── Tab bar ───────────────────────────────────────────────────────────── -->
  <nav class="sr-tabs">
    {#each [['summary', 'ph-chart-bar', 'Summary'], ['question', 'ph-list-magnifying-glass', 'By Question'], ['individual', 'ph-user', 'Individual']] as [id, icon, label]}
      <button
        class="sr-tab"
        class:active={activeTab === id}
        onclick={() => (activeTab = id as TabId)}
      >
        <i class="ph-light {icon}"></i>
        {label}
        {#if id === 'individual'}
          <span class="tab-count">{filteredResponses.length}</span>
        {/if}
      </button>
    {/each}
  </nav>

  <!-- ══════════════════════════════════════════════════════════════════════
       TAB: SUMMARY
  ═══════════════════════════════════════════════════════════════════════ -->
  {#if activeTab === 'summary'}
    <div class="tab-content summary-grid">
      {#each allQuestions as q, qi}
        {@const stat = getStatForQuestion(q.id)}
        <div
          class="chart-card"
          class:wide={stat?.chartType === 'word_cloud' || stat?.chartType === 'list'}
        >
          <!-- Card header -->
          <div class="chart-card-header">
            <div class="q-index">Q{qi + 1}</div>
            <div class="q-info">
              <div class="q-title">{q.title}</div>
              <div class="q-section">{q['sectionTitle']}</div>
            </div>
            <button class="ai-btn" title="AI Insight" onclick={() => generateInsight(q.id)}>
              <i class="ph-bold ph-sparkle"></i>
            </button>
          </div>

          <!-- Chart body -->
          {#if !stat}
            <div class="no-data">No responses yet</div>
          {:else if stat.chartType === 'pie' && stat.data}
            <div class="donut-wrap">
              <canvas use:chartCanvas={{ stat }} width="200" height="200" class="donut-canvas"
              ></canvas>
              <div class="legend">
                {#each stat.data as seg, i}
                  <div
                    class="legend-item"
                    class:hovered={hoveredSegment === seg.value}
                    onmouseenter={() => (hoveredSegment = seg.value)}
                    onmouseleave={() => (hoveredSegment = null)}
                  >
                    <span class="legend-dot" style="background:{PALETTE[i % PALETTE.length]}"
                    ></span>
                    <span class="legend-label">{seg.label}</span>
                    <span class="legend-pct">{seg.percentage}%</span>
                    <span class="legend-count">({seg.count})</span>
                  </div>
                {/each}
              </div>
            </div>
          {:else if stat.chartType === 'bar' && stat.data}
            <div class="bar-wrap">
              <canvas use:chartCanvas={{ stat }} width="340" height="180" class="bar-canvas"
              ></canvas>
              <div class="bar-legend">
                {#each stat.data as seg, i}
                  <div
                    class="bar-leg-item"
                    onmouseenter={() => (hoveredSegment = seg.value)}
                    onmouseleave={() => (hoveredSegment = null)}
                  >
                    <span class="legend-dot" style="background:{PALETTE[i % PALETTE.length]}"
                    ></span>
                    <span>{seg.label}</span>
                    <span class="ml-auto opacity-50">{seg.percentage}%</span>
                  </div>
                {/each}
              </div>
            </div>
          {:else if stat.chartType === 'word_cloud' && stat.latestResponses}
            <div class="word-cloud">
              {#each stat.latestResponses.slice(0, 20) as resp, i}
                <span
                  class="word-chip"
                  style="
                    font-size:{Math.max(10, 18 - i * 0.4)}px;
                    opacity:{Math.max(0.35, 1 - i * 0.04)};
                    color:{PALETTE[i % PALETTE.length]}
                  ">{resp.length > 40 ? resp.slice(0, 38) + '…' : resp}</span
                >
              {/each}
            </div>
            <div class="resp-count-note">{stat.latestResponses.length} text responses</div>
          {:else if stat.chartType === 'list' && stat.latestResponses}
            <div class="list-responses">
              {#each stat.latestResponses.slice(0, 5) as resp}
                <div class="list-resp-item">
                  <i class="ph-light ph-quotes text-[10px] opacity-40"></i>
                  <span>{resp}</span>
                </div>
              {/each}
              {#if stat.latestResponses.length > 5}
                <div class="list-more">+{stat.latestResponses.length - 5} more</div>
              {/if}
            </div>
          {:else if stat.chartType === 'number'}
            <div class="number-stat">
              <div class="ns-value">{stat.average?.toFixed(1) ?? '—'}</div>
              <div class="ns-label">Average</div>
              <div class="ns-range">
                <span>Min: {stat.min ?? '—'}</span>
                <span>Max: {stat.max ?? '—'}</span>
              </div>
            </div>
          {/if}

          <!-- AI Insight panel -->
          {#if aiInsightVisible && aiInsightText && stat}
            <div class="ai-insight">
              <div class="ai-insight-header">
                <i class="ph-bold ph-sparkle text-amber-400"></i>
                <span>AI Insight</span>
                <button
                  onclick={() => {
                    aiInsightVisible = false
                    aiInsightText = ''
                  }}
                >
                  <i class="ph-bold ph-x text-[10px]"></i>
                </button>
              </div>
              <p class="ai-insight-text">
                {aiInsightText}{#if aiInsightLoading}<span class="cursor-blink">|</span>{/if}
              </p>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════
       TAB: BY QUESTION
  ═══════════════════════════════════════════════════════════════════════ -->
  {:else if activeTab === 'question'}
    {@const q = allQuestions[activeQuestionIdx]}
    {@const stat = q ? getStatForQuestion(q.id) : undefined}
    <div class="by-question-layout">
      <!-- Left: question list -->
      <div class="bq-sidebar">
        {#each allQuestions as q, i}
          <button
            class="bq-q-item"
            class:active={activeQuestionIdx === i}
            onclick={() => (activeQuestionIdx = i)}
          >
            <div class="bq-q-num">Q{i + 1}</div>
            <div class="bq-q-text">{q.title}</div>
            {#if q.required}<span class="req-dot"></span>{/if}
          </button>
        {/each}
      </div>

      <!-- Right: question detail -->
      <div class="bq-detail">
        {#if q}
          <div class="bq-detail-header">
            <div class="bq-q-badge">Q{activeQuestionIdx + 1}</div>
            <div>
              <div class="bq-detail-title">{q.title}</div>
              {#if q.description}
                <div class="bq-detail-desc">{q.description}</div>
              {/if}
            </div>
          </div>

          <!-- Response rate for this question -->
          {@const answered = responses.filter((r) => getAnswerForResponse(r, q.id)).length}
          <div class="bq-response-rate">
            <div class="brr-label">{answered} of {responses.length} responded</div>
            <div class="brr-bar-wrap">
              <div
                class="brr-bar"
                style="width:{responses.length ? (answered / responses.length) * 100 : 0}%"
              ></div>
            </div>
            <div class="brr-pct">
              {responses.length ? Math.round((answered / responses.length) * 100) : 0}%
            </div>
          </div>

          <!-- Full chart for this question -->
          {#if stat?.data}
            <div class="bq-full-chart">
              {#each stat.data as seg, i}
                <div
                  class="full-bar-row"
                  onmouseenter={() => (hoveredSegment = seg.value)}
                  onmouseleave={() => (hoveredSegment = null)}
                >
                  <div class="fbr-label">{seg.label}</div>
                  <div class="fbr-track">
                    <div
                      class="fbr-fill"
                      style="width:{seg.percentage}%; background:{PALETTE[i % PALETTE.length]}"
                    ></div>
                  </div>
                  <div class="fbr-count">{seg.count}</div>
                  <div class="fbr-pct">{seg.percentage}%</div>
                </div>
              {/each}
            </div>
          {:else if stat?.latestResponses}
            <div class="bq-text-responses">
              {#each stat.latestResponses as resp, i}
                <div class="bq-text-item">
                  <div
                    class="bq-text-avatar"
                    style="background:{PALETTE[i % PALETTE.length]}22; color:{PALETTE[
                      i % PALETTE.length
                    ]}"
                  >
                    {i + 1}
                  </div>
                  <p>{resp}</p>
                </div>
              {/each}
            </div>
          {/if}

          <!-- All individual answers table -->
          <div class="bq-all-answers">
            <div class="bq-all-header">All answers</div>
            <div class="bq-ans-list">
              {#each filteredResponses as r, ri}
                {@const ans = getAnswerForResponse(r, q.id)}
                <div class="bq-ans-row">
                  <div class="bq-ans-meta">
                    <span class="ans-num">#{ri + 1}</span>
                    <span class="ans-date">{formatDate(r.metadata.submittedAt)}</span>
                  </div>
                  <div class="bq-ans-val">{displayAnswer(ans)}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════
       TAB: INDIVIDUAL
  ═══════════════════════════════════════════════════════════════════════ -->
  {:else}
    {@const resp = filteredResponses[activeResponseIdx]}
    <div class="individual-layout">
      <!-- Search + list -->
      <div class="ind-sidebar">
        <div class="ind-search-wrap">
          <i class="ph-light ph-magnifying-glass"></i>
          <input class="ind-search" placeholder="Search responses…" bind:value={searchQuery} />
          {#if searchQuery}
            <button onclick={() => (searchQuery = '')}>
              <i class="ph-bold ph-x text-[10px]"></i>
            </button>
          {/if}
        </div>

        <div class="ind-list">
          {#each filteredResponses as r, i}
            <button
              class="ind-item"
              class:active={activeResponseIdx === i}
              onclick={() => (activeResponseIdx = i)}
            >
              <div
                class="ind-item-avatar"
                style="background:{PALETTE[i % PALETTE.length]}22; color:{PALETTE[
                  i % PALETTE.length
                ]}"
              >
                #{i + 1}
              </div>
              <div class="ind-item-info">
                <div class="ind-item-id">{r.responseId.slice(0, 14)}…</div>
                <div class="ind-item-date">{formatDate(r.metadata.submittedAt)}</div>
              </div>
              <div class="ind-item-dur">{formatDuration(r.metadata.durationSeconds)}</div>
            </button>
          {/each}
          {#if !filteredResponses.length}
            <div class="ind-empty">No responses match your search</div>
          {/if}
        </div>
      </div>

      <!-- Individual response detail -->
      <div class="ind-detail">
        {#if resp}
          <!-- Response meta card -->
          <div class="ind-meta-card">
            <div class="imc-row">
              <div class="imc-field">
                <div class="imc-label">Response ID</div>
                <div class="imc-value mono">{resp.responseId}</div>
              </div>
              <div class="imc-field">
                <div class="imc-label">Submitted</div>
                <div class="imc-value">{formatDate(resp.metadata.submittedAt)}</div>
              </div>
              <div class="imc-field">
                <div class="imc-label">Duration</div>
                <div class="imc-value">{formatDuration(resp.metadata.durationSeconds)}</div>
              </div>
              <div class="imc-field">
                <div class="imc-label">Answered</div>
                <div class="imc-value">{resp.answers.length} / {allQuestions.length}</div>
              </div>
            </div>
          </div>

          <!-- Answers -->
          <div class="ind-answers">
            {#each allQuestions as q, qi}
              {@const ans = getAnswerForResponse(resp, q.id)}
              <div class="ind-ans-card" class:skipped={!ans}>
                <div class="iac-left">
                  <div class="iac-num">Q{qi + 1}</div>
                </div>
                <div class="iac-right">
                  <div class="iac-question">{q.title}</div>
                  {#if ans}
                    <div class="iac-answer">{displayAnswer(ans)}</div>
                    <!-- Show percentage context for choice questions -->
                    {#if ans.type === 'multiple_choice' || ans.type === 'radio' || ans.type === 'select'}
                      {@const stat = getStatForQuestion(q.id)}
                      {@const matchSeg = stat?.data?.find((d) =>
                        Array.isArray(ans.value)
                          ? ans.value.includes(d.value)
                          : ans.value === d.value
                      )}
                      {#if matchSeg}
                        <div class="iac-ctx">
                          <span>{matchSeg.percentage}% of all respondents chose this</span>
                          <div class="iac-ctx-bar">
                            <div style="width:{matchSeg.percentage}%; background:#00e5c4"></div>
                          </div>
                        </div>
                      {/if}
                    {/if}
                  {:else}
                    <div class="iac-skipped">Skipped{q.required ? ' (required)' : ''}</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="ind-empty-detail">Select a response from the left</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* ─── Root & tokens ───────────────────────────────────────────────────────── */
  .sr-root {
    position: relative;
    min-height: 100%;
    background: #0a0e1a;
    color: #f5f0e8;
    font-family: 'DM Sans', system-ui, sans-serif;
    overflow: hidden;
  }

  .sr-noise {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  }

  /* ─── Header ─────────────────────────────────────────────────────────────── */
  .sr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 28px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
    z-index: 2;
  }

  .sr-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .sr-icon-badge {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(0, 229, 196, 0.12);
    border: 1px solid rgba(0, 229, 196, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #00e5c4;
    font-size: 18px;
    flex-shrink: 0;
  }

  .sr-survey-title {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .sr-survey-meta {
    font-size: 11px;
    color: rgba(245, 240, 232, 0.4);
    display: flex;
    gap: 6px;
    margin-top: 2px;
  }
  .dot {
    opacity: 0.3;
  }

  .sr-header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* ─── Time filter ────────────────────────────────────────────────────────── */
  .time-filter {
    display: flex;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    overflow: hidden;
  }

  .tf-btn {
    padding: 5px 12px;
    font-size: 11px;
    font-weight: 600;
    border: none;
    background: transparent;
    color: rgba(245, 240, 232, 0.4);
    cursor: pointer;
    transition: all 0.15s;
  }
  .tf-btn.active,
  .tf-btn:hover {
    background: rgba(0, 229, 196, 0.12);
    color: #00e5c4;
  }

  /* ─── Export ─────────────────────────────────────────────────────────────── */
  .export-wrap {
    position: relative;
  }
  .export-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(245, 240, 232, 0.7);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .export-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f5f0e8;
  }

  .export-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: #161c2e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 4px;
    min-width: 180px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    z-index: 100;
  }

  .export-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border-radius: 7px;
    border: none;
    background: transparent;
    color: rgba(245, 240, 232, 0.7);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.1s;
  }
  .export-menu button:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #f5f0e8;
  }

  /* ─── KPI row ────────────────────────────────────────────────────────────── */
  .sr-kpi-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    padding: 16px 28px;
    position: relative;
    z-index: 2;
  }

  .kpi-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 16px 18px;
    transition: border-color 0.2s;
  }
  .kpi-card:hover {
    border-color: rgba(0, 229, 196, 0.2);
  }

  .kpi-value {
    font-family: 'DM Serif Display', serif;
    font-size: 2rem;
    line-height: 1;
    color: #00e5c4;
    margin-bottom: 4px;
  }
  .kpi-label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(245, 240, 232, 0.55);
    margin-bottom: 6px;
  }
  .kpi-sub {
    font-size: 10px;
    color: rgba(245, 240, 232, 0.3);
  }

  .kpi-bar-wrap {
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }
  .kpi-bar {
    height: 100%;
    background: #00e5c4;
    border-radius: 2px;
    transition: width 0.8s ease;
  }

  /* ─── Tabs ───────────────────────────────────────────────────────────────── */
  .sr-tabs {
    display: flex;
    gap: 2px;
    padding: 0 28px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
    z-index: 2;
  }

  .sr-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border: none;
    background: transparent;
    color: rgba(245, 240, 232, 0.4);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    margin-bottom: -1px;
  }
  .sr-tab:hover {
    color: rgba(245, 240, 232, 0.75);
  }
  .sr-tab.active {
    color: #00e5c4;
    border-bottom-color: #00e5c4;
  }

  .tab-count {
    background: rgba(0, 229, 196, 0.15);
    color: #00e5c4;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 100px;
  }

  /* ─── Tab content wrapper ────────────────────────────────────────────────── */
  .tab-content {
    padding: 20px 28px;
    position: relative;
    z-index: 2;
  }

  /* ─── Summary grid ───────────────────────────────────────────────────────── */
  .summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .chart-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
    padding: 18px;
    transition:
      border-color 0.2s,
      transform 0.2s;
  }
  .chart-card:hover {
    border-color: rgba(0, 229, 196, 0.15);
    transform: translateY(-1px);
  }
  .chart-card.wide {
    grid-column: 1 / -1;
  }

  .chart-card-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 16px;
  }
  .q-index {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #00e5c4;
    background: rgba(0, 229, 196, 0.1);
    border: 1px solid rgba(0, 229, 196, 0.2);
    padding: 2px 8px;
    border-radius: 4px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .q-info {
    flex: 1;
    min-width: 0;
  }
  .q-title {
    font-size: 13px;
    font-weight: 600;
    color: #f5f0e8;
    line-height: 1.3;
  }
  .q-section {
    font-size: 10px;
    color: rgba(245, 240, 232, 0.3);
    margin-top: 2px;
  }

  .ai-btn {
    padding: 5px 8px;
    border-radius: 7px;
    border: none;
    background: rgba(245, 200, 66, 0.1);
    border: 1px solid rgba(245, 200, 66, 0.2);
    color: #f5c842;
    cursor: pointer;
    font-size: 12px;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .ai-btn:hover {
    background: rgba(245, 200, 66, 0.2);
  }

  .no-data {
    font-size: 12px;
    color: rgba(245, 240, 232, 0.25);
    text-align: center;
    padding: 24px 0;
  }

  /* ─── Donut ──────────────────────────────────────────────────────────────── */
  .donut-wrap {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .donut-canvas {
    flex-shrink: 0;
  }

  .legend {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background 0.1s;
  }
  .legend-item.hovered {
    background: rgba(255, 255, 255, 0.04);
  }
  .legend-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .legend-label {
    font-size: 11px;
    color: rgba(245, 240, 232, 0.7);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .legend-pct {
    font-size: 11px;
    font-weight: 700;
    color: #f5f0e8;
  }
  .legend-count {
    font-size: 10px;
    color: rgba(245, 240, 232, 0.3);
  }

  /* ─── Bar ────────────────────────────────────────────────────────────────── */
  .bar-wrap {
  }
  .bar-canvas {
    width: 100%;
    height: auto;
  }
  .bar-legend {
    display: flex;
    gap: 12px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .bar-leg-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    color: rgba(245, 240, 232, 0.5);
    cursor: pointer;
  }

  /* ─── Word cloud ─────────────────────────────────────────────────────────── */
  .word-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 8px 0;
    min-height: 80px;
  }
  .word-chip {
    font-weight: 600;
    cursor: default;
    transition: opacity 0.2s;
    line-height: 1.2;
  }
  .word-chip:hover {
    opacity: 1 !important;
  }
  .resp-count-note {
    font-size: 10px;
    color: rgba(245, 240, 232, 0.25);
    margin-top: 8px;
  }

  /* ─── List responses ─────────────────────────────────────────────────────── */
  .list-responses {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .list-resp-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 7px;
    font-size: 12px;
    color: rgba(245, 240, 232, 0.65);
    line-height: 1.4;
  }
  .list-more {
    font-size: 11px;
    color: rgba(245, 240, 232, 0.3);
    text-align: center;
    padding: 4px 0;
  }

  /* ─── Number stat ────────────────────────────────────────────────────────── */
  .number-stat {
    text-align: center;
    padding: 16px 0;
  }
  .ns-value {
    font-family: 'DM Serif Display', serif;
    font-size: 3rem;
    color: #00e5c4;
    line-height: 1;
  }
  .ns-label {
    font-size: 11px;
    color: rgba(245, 240, 232, 0.4);
    margin: 4px 0 10px;
  }
  .ns-range {
    display: flex;
    justify-content: center;
    gap: 20px;
    font-size: 11px;
    color: rgba(245, 240, 232, 0.35);
  }

  /* ─── AI insight ─────────────────────────────────────────────────────────── */
  .ai-insight {
    margin-top: 14px;
    padding: 12px 14px;
    background: rgba(245, 200, 66, 0.05);
    border: 1px solid rgba(245, 200, 66, 0.15);
    border-radius: 10px;
  }
  .ai-insight-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #f5c842;
    margin-bottom: 6px;
  }
  .ai-insight-header button {
    margin-left: auto;
    background: none;
    border: none;
    color: rgba(245, 240, 232, 0.3);
    cursor: pointer;
  }
  .ai-insight-text {
    font-size: 12px;
    color: rgba(245, 240, 232, 0.65);
    line-height: 1.6;
    margin: 0;
  }
  .cursor-blink {
    animation: blink 0.7s step-end infinite;
  }
  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  /* ─── By Question layout ─────────────────────────────────────────────────── */
  .by-question-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 0;
    height: calc(100vh - 220px);
    overflow: hidden;
    padding: 0 28px 20px;
    position: relative;
    z-index: 2;
  }

  .bq-sidebar {
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    overflow-y: auto;
    padding-right: 12px;
    padding-top: 4px;
  }

  .bq-q-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 10px;
    border-radius: 8px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: all 0.12s;
    margin-bottom: 2px;
  }
  .bq-q-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  .bq-q-item.active {
    background: rgba(0, 229, 196, 0.08);
  }

  .bq-q-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    color: rgba(245, 240, 232, 0.35);
    flex-shrink: 0;
  }
  .bq-q-item.active .bq-q-num {
    color: #00e5c4;
  }

  .bq-q-text {
    font-size: 11px;
    color: rgba(245, 240, 232, 0.6);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    line-height: 1.3;
  }
  .bq-q-item.active .bq-q-text {
    color: #f5f0e8;
  }

  .req-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #f33d3d;
    flex-shrink: 0;
  }

  /* ─── BQ detail ──────────────────────────────────────────────────────────── */
  .bq-detail {
    overflow-y: auto;
    padding-left: 24px;
    padding-top: 4px;
  }

  .bq-detail-header {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    align-items: flex-start;
  }
  .bq-q-badge {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    color: #00e5c4;
    background: rgba(0, 229, 196, 0.1);
    border: 1px solid rgba(0, 229, 196, 0.2);
    padding: 3px 10px;
    border-radius: 6px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .bq-detail-title {
    font-size: 15px;
    font-weight: 700;
    color: #f5f0e8;
    line-height: 1.3;
  }
  .bq-detail-desc {
    font-size: 12px;
    color: rgba(245, 240, 232, 0.45);
    margin-top: 4px;
  }

  .bq-response-rate {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
  }
  .brr-label {
    font-size: 11px;
    color: rgba(245, 240, 232, 0.45);
    white-space: nowrap;
  }
  .brr-bar-wrap {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }
  .brr-bar {
    height: 100%;
    background: #00e5c4;
    border-radius: 2px;
    transition: width 0.8s ease;
  }
  .brr-pct {
    font-size: 11px;
    font-weight: 700;
    color: #00e5c4;
    white-space: nowrap;
  }

  /* ─── Full bar rows ──────────────────────────────────────────────────────── */
  .bq-full-chart {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 24px;
  }

  .full-bar-row {
    display: grid;
    grid-template-columns: 160px 1fr 40px 44px;
    align-items: center;
    gap: 10px;
    cursor: pointer;
  }
  .fbr-label {
    font-size: 12px;
    color: rgba(245, 240, 232, 0.65);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .fbr-track {
    height: 8px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    overflow: hidden;
  }
  .fbr-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .fbr-count {
    font-size: 12px;
    font-weight: 700;
    color: #f5f0e8;
    text-align: right;
  }
  .fbr-pct {
    font-size: 11px;
    color: rgba(245, 240, 232, 0.4);
    text-align: right;
  }

  /* ─── BQ text responses ──────────────────────────────────────────────────── */
  .bq-text-responses {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }
  .bq-text-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 9px;
  }
  .bq-text-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .bq-text-item p {
    font-size: 12px;
    color: rgba(245, 240, 232, 0.7);
    line-height: 1.5;
    margin: 0;
  }

  /* ─── BQ all answers ─────────────────────────────────────────────────────── */
  .bq-all-answers {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 16px;
  }
  .bq-all-header {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(245, 240, 232, 0.3);
    margin-bottom: 10px;
  }
  .bq-ans-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .bq-ans-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 10px;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.02);
    transition: background 0.1s;
  }
  .bq-ans-row:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  .bq-ans-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-shrink: 0;
  }
  .ans-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: rgba(245, 240, 232, 0.3);
  }
  .ans-date {
    font-size: 10px;
    color: rgba(245, 240, 232, 0.3);
  }
  .bq-ans-val {
    font-size: 12px;
    color: rgba(245, 240, 232, 0.7);
    text-align: right;
  }

  /* ─── Individual layout ──────────────────────────────────────────────────── */
  .individual-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    height: calc(100vh - 220px);
    overflow: hidden;
    padding: 0 28px 20px;
    gap: 0;
    position: relative;
    z-index: 2;
  }

  .ind-sidebar {
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 16px;
    padding-top: 4px;
  }

  .ind-search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 6px 10px;
    flex-shrink: 0;
  }
  .ind-search-wrap i {
    color: rgba(245, 240, 232, 0.3);
    font-size: 13px;
  }
  .ind-search {
    flex: 1;
    background: none;
    border: none;
    color: #f5f0e8;
    font-size: 12px;
    outline: none;
    font-family: inherit;
  }
  .ind-search::placeholder {
    color: rgba(245, 240, 232, 0.25);
  }

  .ind-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .ind-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: all 0.12s;
  }
  .ind-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }
  .ind-item.active {
    background: rgba(0, 229, 196, 0.07);
    border: 1px solid rgba(0, 229, 196, 0.15);
  }

  .ind-item-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .ind-item-info {
    flex: 1;
    min-width: 0;
  }
  .ind-item-id {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: rgba(245, 240, 232, 0.55);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ind-item-date {
    font-size: 10px;
    color: rgba(245, 240, 232, 0.3);
  }
  .ind-item-dur {
    font-size: 10px;
    color: rgba(245, 240, 232, 0.3);
    flex-shrink: 0;
  }

  .ind-empty {
    font-size: 12px;
    color: rgba(245, 240, 232, 0.25);
    text-align: center;
    padding: 20px;
  }

  /* ─── Individual detail ──────────────────────────────────────────────────── */
  .ind-detail {
    overflow-y: auto;
    padding-left: 24px;
    padding-top: 4px;
  }

  .ind-meta-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 16px 18px;
    margin-bottom: 16px;
  }
  .imc-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .imc-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(245, 240, 232, 0.3);
    margin-bottom: 4px;
  }
  .imc-value {
    font-size: 12px;
    font-weight: 600;
    color: rgba(245, 240, 232, 0.8);
  }
  .imc-value.mono {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
  }

  .ind-answers {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ind-ans-card {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    transition: border-color 0.15s;
  }
  .ind-ans-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }
  .ind-ans-card.skipped {
    opacity: 0.45;
  }

  .iac-left {
    flex-shrink: 0;
    padding-top: 1px;
  }
  .iac-num {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    color: rgba(245, 240, 232, 0.3);
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 7px;
    border-radius: 4px;
  }

  .iac-right {
    flex: 1;
    min-width: 0;
  }
  .iac-question {
    font-size: 11px;
    color: rgba(245, 240, 232, 0.45);
    margin-bottom: 4px;
    line-height: 1.3;
  }
  .iac-answer {
    font-size: 13px;
    font-weight: 600;
    color: #f5f0e8;
    line-height: 1.4;
  }
  .iac-skipped {
    font-size: 12px;
    color: rgba(245, 240, 232, 0.25);
    font-style: italic;
  }

  .iac-ctx {
    margin-top: 6px;
  }
  .iac-ctx span {
    font-size: 10px;
    color: rgba(0, 229, 196, 0.6);
  }
  .iac-ctx-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 4px;
  }
  .iac-ctx-bar div {
    height: 100%;
    border-radius: 2px;
  }

  .ind-empty-detail {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    font-size: 13px;
    color: rgba(245, 240, 232, 0.2);
  }
</style>
