<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { scale } from 'svelte/transition'
  import { startAuth } from '../../../stores/auth.store'
  import { _$_lastOpenError } from '../../../stores/common.store'
  import { goToHomeScreen } from '../../../utils/common.utils'
  import brandMark from '@resources/img/brand/dynadoc-mark.png'

  let {
    docName = '',
    onSignIn = null,
    onSignUp = null,
    fullPage = false,
    onGoBack = () => {}
  } = $props()

  async function handleOnSignIn() {
    onSignIn ? onSignIn() : await startAuth()
  }
  async function handleOnSignUp() {
    onSignUp ? onSignUp() : await startAuth('register')
  }
  async function handleOnGoBack() {
    onGoBack ? onGoBack() : goBackFromMissing()
  }
  function goBackFromMissing() {
    _$_lastOpenError.set(null)
    goToHomeScreen()
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleOnSignIn()
    }
    if (event.key === 'Escape' && !fullPage) {
      onGoBack()
    }
  }

  onMount(() => window.addEventListener('keydown', handleKeyDown))
  onDestroy(() => window.removeEventListener('keydown', handleKeyDown))
</script>

<!-- Filet, pas la page de connexion : la vraie redirige vers Casdoor. On n'y
     arrive que si une redirection a déjà été tentée et que le visiteur revient
     encore déconnecté. D'où le parti pris : la marque, une phrase, un bouton.

     Les couleurs viennent des jetons de thème, jamais de blanc ou de noir en
     dur : la carte précédente écrivait son titre en blanc, illisible sur le
     fond clair. L'encre du bouton est fixée en teal très sombre parce que
     l'accent est une couleur de remplissage — du blanc dessus ne donne que
     2,3:1, cette encre en donne plus de 7 dans les deux thèmes. -->
<div class="gate" class:gate--full={fullPage}>
  <div class="card" in:scale={{ start: 0.98, duration: 300 }}>
    <img src={brandMark} alt="Dynadoc" class="mark" />

    <h2 class="title">{$_('Sign-in required')}</h2>

    <p class="lead">
      {#if docName && !fullPage}
        {$_('Sign in to open this document.')}
      {:else}
        {$_('Sign in to continue to Dynadoc.')}
      {/if}
    </p>

    {#if docName && !fullPage}
      <p class="doc" title={docName}>{docName}</p>
    {/if}

    <button type="button" class="primary" onclick={handleOnSignIn}>
      {$_('Sign In')}
    </button>

    <button type="button" class="link" onclick={handleOnSignUp}>
      {$_('Create Account')}
    </button>

    {#if !fullPage}
      <button type="button" class="link link--quiet" onclick={handleOnGoBack}>
        {$_('Close')}
      </button>
    {/if}
  </div>
</div>

<style lang="postcss">
  .gate {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
    background: var(--color-base-100);
    color: var(--color-base-content);
    font-family: var(--brand-font-sans);
  }

  .gate--full {
    min-height: 100vh;
  }

  .card {
    width: 100%;
    max-width: 380px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 36px 28px 30px;
    border-radius: 22px;
    background: var(--color-base-200);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }

  .mark {
    height: 44px;
    width: auto;
    display: block;
    margin-bottom: 20px;
  }

  .title {
    margin: 0;
    font-family: var(--brand-font-display);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .lead {
    margin: 8px 0 0;
    max-width: 280px;
    font-size: 13.5px;
    line-height: 1.55;
    opacity: 0.7;
  }

  .doc {
    margin: 12px 0 0;
    max-width: 100%;
    padding: 7px 13px;
    border-radius: 999px;
    background: var(--color-base-100);
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .primary {
    width: 100%;
    min-height: 46px;
    margin-top: 24px;
    border: 0;
    border-radius: 999px;
    background: var(--accent);
    /* Encre fixe : l'accent change entre les thèmes, pas la lisibilité. */
    color: #06201e;
    font: inherit;
    font-size: 14.5px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 140ms ease;
  }

  .primary:hover {
    filter: brightness(0.94);
  }

  .link {
    margin-top: 14px;
    border: 0;
    background: none;
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--color-base-content);
    opacity: 0.75;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .link:hover {
    opacity: 1;
  }

  .link--quiet {
    margin-top: 10px;
    opacity: 0.55;
    text-decoration: none;
  }

  @media (max-width: 420px) {
    .gate {
      padding: 16px;
      align-items: flex-start;
      padding-top: 48px;
    }

    .card {
      padding: 30px 20px 26px;
    }
  }
</style>
