<script lang="ts">
  import { _$_stepUpModal } from '../../../stores/stepUpModal.store'
  import { authStore } from '../../../stores/auth.store'
  import {
    stepupSend,
    stepupVerify,
    isStepUpDisabledError
  } from '../../../services/auth/stepup.service'
  import { _ } from 'svelte-i18n'

  const modal = _$_stepUpModal

  type Phase = 'sending' | 'input' | 'unavailable'

  let phase = $state<Phase>('sending')
  let code = $state('')
  let errorMessage = $state('')
  let failedAttempts = $state(0)
  let verifying = $state(false)
  let resendCooldown = $state(0)
  let cooldownTimer: ReturnType<typeof setInterval> | null = null
  let started = false
  let codeInput = $state<HTMLInputElement | null>(null)

  // The verification is attributed to the sender, and the destination email
  // is masked (k•••@domain) — it always comes from the JWT server-side.
  function maskedEmail(): string {
    const email = $authStore?.user?.email || ''
    const [local, domain] = email.split('@')
    if (!local || !domain) return ''
    return `${local.slice(0, 1)}•••@${domain}`
  }

  function startCooldown() {
    resendCooldown = 60
    if (cooldownTimer) clearInterval(cooldownTimer)
    cooldownTimer = setInterval(() => {
      resendCooldown -= 1
      if (resendCooldown <= 0 && cooldownTimer) {
        clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    }, 1000)
  }

  async function sendCode() {
    phase = 'sending'
    errorMessage = ''
    try {
      await stepupSend()
      phase = 'input'
      startCooldown()
      setTimeout(() => codeInput?.focus(), 50)
    } catch (err) {
      if (isStepUpDisabledError(err)) {
        phase = 'unavailable'
      } else {
        phase = 'input'
        errorMessage = $_('The code could not be sent. Try again.')
        startCooldown()
      }
    }
  }

  async function verify() {
    if (verifying || code.trim().length < 6) return
    verifying = true
    errorMessage = ''
    try {
      const token = await stepupVerify(code.trim())
      cleanup()
      _$_stepUpModal.complete(token)
    } catch {
      failedAttempts += 1
      code = ''
      errorMessage =
        failedAttempts >= 3
          ? $_('Still not working? Send a new code below.')
          : $_('Incorrect or expired code.')
      setTimeout(() => codeInput?.focus(), 50)
    } finally {
      verifying = false
    }
  }

  function onCodeInput() {
    code = code.replace(/\D/g, '').slice(0, 6)
    if (code.length === 6) void verify()
  }

  function cleanup() {
    if (cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
    phase = 'sending'
    code = ''
    errorMessage = ''
    failedAttempts = 0
    verifying = false
    resendCooldown = 0
    started = false
  }

  function cancel() {
    cleanup()
    _$_stepUpModal.cancel()
  }

  function onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) cancel()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  // Kick off the email send exactly once per opening (no $effect loops:
  // guarded by a plain flag, reset in cleanup()).
  $effect(() => {
    if ($modal.open && !started) {
      started = true
      void sendCode()
    }
  })
</script>

{#if $modal.open}
  <div
    class="modal-shell fixed inset-0 z-[1190] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    onclick={onBackdropClick}
    onkeydown={onKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={$_('Verification required')}
  >
    <div class="modal-card w-full max-w-[420px] p-7 animate-in zoom-in-95 duration-200">
      <!-- The seal: this screen is the one place the brass is allowed to lead. -->
      <svg class="emblem" viewBox="0 0 120 120" aria-hidden="true">
        <circle class="emblem-halo" cx="60" cy="60" r="54" />
        <circle class="emblem-ring" cx="60" cy="60" r="44" />
        <circle class="emblem-disc" cx="60" cy="60" r="34" />
        <text class="emblem-mark" x="60" y="60" text-anchor="middle" dominant-baseline="central">
          DD
        </text>
      </svg>

      <h3 class="modal-title">{$_('Verification required')}</h3>
      <p class="title-en">Verification required</p>

      {#if phase === 'unavailable'}
        <p class="status-line error">
          {$_('Verification is unavailable on this server. Contact the sender.')}
        </p>
      {:else}
        <!-- The destination is a stated fact, never an editable field: the code
             always goes to the signed-in recipient's own address. -->
        {#if maskedEmail()}
          <p class="dest">
            {$_('A code has been sent to {email}', {
              values: { email: maskedEmail() }
            })}
          </p>
          <p class="dest-note">{$_('Always to your own address')}</p>
        {:else}
          <p class="dest">
            {$_('The sender of this document requires a verification before it opens.')}
          </p>
        {/if}

        {#if phase === 'sending'}
          <p class="status-line">{$_('Sending the code…')}</p>
        {:else}
          <!-- Six cells for legibility, one real input underneath so paste and
               one-time-code autofill keep working. -->
          <div class="code-wrap">
            <div class="code-boxes" aria-hidden="true">
              {#each Array(6) as _unused, i (i)}
                <div
                  class="cell"
                  class:filled={code.length > i}
                  class:active={code.length === i && !verifying}
                >
                  {code[i] ?? ''}
                </div>
              {/each}
            </div>
            <input
              bind:this={codeInput}
              bind:value={code}
              oninput={onCodeInput}
              onkeydown={(e) => e.key === 'Enter' && verify()}
              class="code-field"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              aria-label={$_('Verification code')}
              disabled={verifying}
            />
          </div>

          {#if errorMessage}
            <p class="status-line error">{errorMessage}</p>
          {/if}

          <p class="reassure">{$_('This code protects the opening of the document.')}</p>

          <button class="btn-seal" onclick={verify} disabled={verifying || code.length < 6}>
            {verifying ? $_('Verifying…') : $_('Open the document')}
          </button>

          <button
            class="resend"
            onclick={() => sendCode()}
            disabled={resendCooldown > 0 || verifying}
          >
            {resendCooldown > 0
              ? $_('Resend the code ({seconds}s)', { values: { seconds: resendCooldown } })
              : $_('Resend the code')}
          </button>
        {/if}
      {/if}

      <button onclick={cancel} class="cancel-link">{$_('Cancel')}</button>
    </div>
  </div>
{/if}

<style>
  /* DynaDoc "Swiss precision" identity, applied to the recipient journey's
     signature screen. Porcelain ground, pine-ink primary, and the brass seal
     accent reserved for this moment: verification is the one place the gold is
     allowed to peak. Tokens are scoped to the component so the rest of the app
     keeps its current theme until the design system lands everywhere. */
  .modal-card {
    --sw-surface: #fbfcfb;
    --sw-surface-2: #f1f4f2;
    --sw-ink: #15201c;
    --sw-ink-2: #55655c;
    --sw-faint: #7c8b83;
    --sw-line: #d6dcd8;
    --sw-pine: #1c4a3b;
    --sw-pine-ink: #12463a;
    --sw-btn-ink: #f5faf7;
    --sw-seal: #987a3c;
    --sw-seal-ink: #6b5322;
    --sw-seal-soft: #eee3cb;
    --sw-seal-line: #cbb182;
    --sw-danger: #a6432e;
    --sw-serif: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;

    background: var(--sw-surface);
    border: 1px solid var(--sw-line);
    box-shadow: 0 24px 60px -32px rgba(21, 32, 28, 0.55);
  }

  /* Keep the ceremony legible on a dark desktop without inverting the
     identity: the ground darkens, the brass stays brass. */
  :global(.dark) .modal-card {
    --sw-surface: #131b17;
    --sw-surface-2: #19221d;
    --sw-ink: #e7ece8;
    --sw-ink-2: #93a199;
    --sw-faint: #7f8f86;
    --sw-line: #2b382f;
    --sw-pine: #3f8f76;
    --sw-pine-ink: #8fe0c8;
    --sw-btn-ink: #0d1411;
    --sw-seal: #d8ab55;
    --sw-seal-ink: #f0dcae;
    --sw-seal-soft: #2e2716;
    --sw-seal-line: #6b5322;
    --sw-danger: #e0806f;
  }

  .modal-card {
    border-radius: 14px;
    text-align: center;
  }

  /* The seal, rendered rather than illustrated: a quiet halo, a hairline ring,
     a brass disc. It breathes slowly — the protection is working for you. */
  .emblem {
    width: 76px;
    height: 76px;
    margin: 0 auto 0.9rem;
    display: block;
  }
  .emblem-halo {
    fill: var(--sw-seal-soft);
    opacity: 0.55;
    transform-origin: center;
    animation: seal-breathe 4s ease-in-out infinite;
  }
  .emblem-ring {
    fill: none;
    stroke: var(--sw-seal-line);
    stroke-width: 1.5;
    stroke-dasharray: 3 5;
  }
  .emblem-disc {
    fill: var(--sw-seal);
  }
  .emblem-mark {
    fill: var(--sw-btn-ink);
    font-family: var(--sw-serif);
    font-size: 24px;
    letter-spacing: 0.06em;
  }
  @keyframes seal-breathe {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.55;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .emblem-halo {
      animation: none;
    }
  }

  .modal-title {
    color: var(--sw-ink);
    font-family: var(--sw-serif);
    font-size: 1.4rem;
    font-weight: 500;
    letter-spacing: -0.01em;
    margin-bottom: 0.15rem;
  }

  .title-en {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--sw-faint);
    margin-bottom: 1rem;
  }

  .dest {
    color: var(--sw-ink-2);
    font-size: 12.5px;
    line-height: 1.55;
    margin-bottom: 0.2rem;
  }

  .dest-note {
    font-size: 11px;
    color: var(--sw-faint);
    margin-bottom: 1.1rem;
  }

  /* Six cells for legibility; the real input sits transparently on top so
     paste and one-time-code autofill keep working. */
  .code-wrap {
    position: relative;
    margin-bottom: 0.9rem;
  }

  .code-boxes {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .cell {
    width: 42px;
    height: 52px;
    display: grid;
    place-items: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 1.4rem;
    color: var(--sw-ink);
    background: var(--sw-surface-2);
    border: 1px solid var(--sw-line);
    border-radius: 8px;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }

  .cell.filled {
    border-color: var(--sw-seal-line);
  }

  .cell.active {
    border-color: var(--sw-seal);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--sw-seal) 22%, transparent);
  }

  .code-field {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    border: 0;
    background: transparent;
    font-size: 16px; /* keeps iOS from zooming on focus */
    cursor: text;
  }

  .reassure {
    font-size: 11.5px;
    color: var(--sw-ink-2);
    margin: 0 0 1rem;
  }

  .btn-seal {
    display: block;
    width: 100%;
    padding: 0.7rem 1rem;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    background: var(--sw-pine);
    color: var(--sw-btn-ink);
    transition: background 150ms ease;
  }

  .btn-seal:hover:not(:disabled) {
    background: var(--sw-pine-ink);
  }

  .btn-seal:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .cancel-link {
    display: block;
    margin: 0.9rem auto 0;
    font-size: 11px;
    color: var(--sw-faint);
  }

  .cancel-link:hover {
    color: var(--sw-ink-2);
  }

  .status-line {
    font-size: 12px;
    color: var(--sw-ink-2);
    margin: 0.55rem 0 0;
  }

  .status-line.error {
    color: var(--sw-danger);
  }

  .resend {
    display: block;
    margin: 0.7rem auto 0;
    font-size: 11px;
    color: var(--sw-pine-ink);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .resend:disabled {
    opacity: 0.45;
    text-decoration: none;
    cursor: default;
    color: var(--sw-faint);
  }

  @media (max-width: 768px) {
    .modal-shell {
      align-items: flex-end;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .modal-card {
      max-width: 100%;
      width: 100%;
      border-radius: 16px 16px 0 0;
    }
  }
</style>
