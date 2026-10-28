<script lang="ts">
  import EditorHelpers from '../../../../utils/EditorHelpers'
  import Platform from '../../../../libs/platform'
  import type { DocumentEditorModel } from '../../../../models/Document'
  import type { NavigationTab } from '../../../../models/Tab'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  import { _ } from 'svelte-i18n'
  import { get } from 'svelte/store'
  import EditorCommonUtils from '../../../../utils/common.utils'
  import { isSecureLeaseAvailable, notifySecureLeaseRequired } from '../../../../stores/secureLease.store'
  import { ShareActions, type ShareTarget } from '../../../../utils/shareUtils'
  import { authStore } from '../../../../stores/auth.store'

  interface ContextMenuItem {
    label: string
    icon?: string
    group?: number
    action?: () => void
    rightAction?: { label: string; action: () => void }
    children?: ContextMenuItem[]
    disabled?: boolean
    tooltip?: string
  }

  let {
    __show = $bindable(false),
    __x = 0,
    __y = 0,
    __tab = null
  } = $props<{
    __show?: boolean
    __x?: number
    __y?: number
    __tab?: NavigationTab | null
  }>()

  const getEditor = (): DocumentEditorModel | undefined => {
    if (!__tab?.id) return undefined
    return _$_documentEditorsList.getItem(__tab.id)
  }

  const saveFile = async () => {
    const editor = getEditor()
    if (!editor) return
    await EditorHelpers.saveDocumentEditor(editor, false)
  }

  const saveAs = async () => {
    const editor = getEditor()
    if (!editor) return
    await EditorHelpers.saveDocumentEditor(editor, { saveAs: true })
  }

  const saveAsSecured = async () => {
    if (!isSecureLeaseAvailable()) {
      await notifySecureLeaseRequired(
        'Secure saving is currently unavailable. Please renew your secure writing license.'
      )
      return
    }
    const editor = getEditor()
    if (!editor) return
    await EditorHelpers.saveDocumentEditor(editor, { saveAs: true, saveAsSecured: true })
  }

  const closeFile = async () => {
    if (!__tab?.id) return
    const editor = getEditor()
    const ok = await EditorCommonUtils.confirmCloseIfUnsaved(editor)
    if (!ok) return
    _$_documentEditorsList.closeTab(__tab.id)
  }

  const closeOthers = async () => {
    if (!__tab?.id) return
    const list = _$_documentEditorsList.getList()
    const toClose = list.filter((entry) => entry?.id !== __tab?.id && entry?.uuid !== __tab?.id)
    const ok = await EditorCommonUtils.confirmCloseManyIfUnsaved(toClose)
    if (!ok) return
    _$_documentEditorsList.closeOthers(__tab.id)
  }

  const closeRight = async () => {
    if (!__tab?.id) return
    const list = _$_documentEditorsList.getList()
    const index = list.findIndex((entry) => entry?.id === __tab?.id || entry?.uuid === __tab?.id)
    const toClose = index >= 0 ? list.slice(index + 1) : []
    const ok = await EditorCommonUtils.confirmCloseManyIfUnsaved(toClose)
    if (!ok) return
    _$_documentEditorsList.closeRight(__tab.id)
  }

  const closeAll = async () => {
    const list = _$_documentEditorsList.getList()
    const ok = await EditorCommonUtils.confirmCloseManyIfUnsaved(list)
    if (!ok) return
    _$_documentEditorsList.closeAll()
  }

  const isReadOnly = $derived.by(() => Boolean(__tab?.isReadOnly))
  const isLoading = $derived.by(() => Boolean(__tab?.isLoading))
  const hasEditor = $derived.by(() => Boolean(getEditor()))
  const canSave = $derived.by(() => Boolean(__tab?.id) && hasEditor && !isReadOnly && !isLoading)
  const canSaveSecured = $derived.by(() => canSave)
  const t = get(_)
  const secureTooltip = $derived.by(() =>
    isSecureLeaseAvailable() ? '' : t('Secure license required')
  )
  const isDesktopPlatform = Platform.getPlatform() === Platform.SUPPORTED_PLATFORMS.desktop

  const shareDocument = async () => {
    const editor = getEditor()
    const doc = editor?.document
    if (!doc) return

    const authState = get(authStore)
    const isDriveSource = Boolean((doc as any).remotePath || (doc as any).remoteRef)

    const target: ShareTarget = {
      path: doc.getMainFilePath() || doc.path || '',
      name: doc.name || 'Untitled',
      isFolder: false,
      isMainFile: true
    }

    await ShareActions.share(target, {
      isDriveSource,
      accountOrg: authState?.activeOrg || undefined,
      resolveRootDocument: () => doc
    })
  }

  const tabActions = $derived.by((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = []

    if (isDesktopPlatform) {
      items.push(
        {
          icon: 'ph-save',
          label: t('Save'),
          group: 1,
          disabled: !canSave,
          rightAction: {
            label: t('Save As...'),
            action: () => saveAs()
          },
          action: () => saveFile()
        },
        {
          icon: 'ph-lock',
          label: t('Save As Secured'),
          group: 1,
          disabled: !canSaveSecured,
          tooltip: secureTooltip || undefined,
          action: () => saveAsSecured()
        },
        {
          icon: 'ph-cloud-arrow-up',
          label: t('Sync to Cloud'),
          group: 1,
          disabled: !canSave,
          action: () => {
            const editor = getEditor()
            if (!editor) return
            EditorHelpers.syncDocumentEditorToCloud(editor)
          }
        }
      )
    }

    items.push(
      {
        icon: 'ph-share-network',
        label: t('Share'),
        group: 2,
        disabled: !hasEditor,
        action: () => shareDocument()
      },
      {
        icon: 'ph-push-pin',
        label: t('Pin Tab'),
        group: 3,
        disabled: true,
        action: () => {}
      },
      {
        icon: 'ph-x',
        label: t('Close'),
        group: 4,
        children: [
          { label: t('Close Others'), action: () => closeOthers() },
          { label: t('Right'), action: () => closeRight() },
          { label: t('All'), action: () => closeAll() }
        ],
        action: () => closeFile()
      }
    )

    return items
  })

  // Sort items into groups to render dividers
  let groupedItems = $derived.by(() => {
    const groups: ContextMenuItem[][] = []
    let currentGroup: ContextMenuItem[] = []
    let lastGroupId = tabActions[0]?.group

    tabActions.forEach((item) => {
      if (item.group !== lastGroupId) {
        groups.push(currentGroup)
        currentGroup = []
        lastGroupId = item.group
      }
      currentGroup.push(item)
    })
    groups.push(currentGroup)
    return groups
  })

  const handleAction = (cb?: () => void) => {
    if (cb) cb()
    __show = false
  }
</script>

{#if __show}
  <div class="fixed inset-0 z-[100]" onclick={() => (__show = false)}></div>

  <div class="adobe-menu bg-base-100 text-base-content" style="left: {__x}px; top: {__y}px;">
    {#each groupedItems as group, i}
      <div class="menu-group">
        {#each group as item}
          <div class="menu-item-wrapper">
            <button
              class="menu-item"
              onclick={() => handleAction(item.action)}
              disabled={item.disabled}
              title={item.tooltip}
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-4 flex justify-center text-base-content/40">
                  {#if item.icon}
                    <i class="ph-light {item.icon} text-[15px]"></i>
                  {/if}
                </div>
                <span class="truncate">{item.label}</span>
              </div>

              {#if item.rightAction}
                <button
                  class="right-action-btn"
                  disabled={item.disabled}
                  onclick={(e) => {
                    e.stopPropagation() // Standard JavaScript way
                    handleAction(item.rightAction?.action)
                  }}
                >
                  {item.rightAction.label}
                </button>
              {/if}
            </button>

            {#if item.children && item.children.length > 0}
              <div class="horizontal-sub-row">
                {#each item.children as child, ci}
                  <button
                    class="sub-row-item"
                    onclick={(e) => {
                      e.stopPropagation() // Standard JavaScript way
                      handleAction(child.action)
                    }}
                  >
                    {child.label}
                  </button>
                  {#if ci < item.children.length - 1}
                    <div class="sub-divider"></div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
      {#if i < groupedItems.length - 1}
        <div class="group-divider"></div>
      {/if}
    {/each}
  </div>
{/if}

<style lang="postcss">
  .adobe-menu {
    @apply fixed z-[101] min-w-[220px] bg-[var(--color-base-100)] rd-[6px] shadow-[0_12px_32px_-4px_rgba(0,0,0,0.3)] 
           border border-black/10 py-1 font-sans select-none text-[var(--color-base-content)];
  }

  /* Adjust background for Dark Mode if needed */
  /* :global(.dark) .adobe-menu {
    @apply bg-[var(--color-base-200)] text-[#e1e1e1] border-white/10;
  } */

  .menu-group {
    @apply flex flex-col;
  }

  .menu-item-wrapper {
    @apply flex flex-col;
  }

  .menu-item {
    @apply w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-left
           hover:bg-[var(--color-base-300)] hover:text-[var(--color-base-content)] transition-colors disabled:opacity-30;
  }

  .right-action-btn {
    @apply pl-3 text-[11px] text-black/40 border-l border-black/10 ml-3 
           hover:text-[var(--color-base-300)] transition-colors uppercase font-700 tracking-tight;
  }

  :global(.dark) .right-action-btn {
    @apply text-[var(--color-base-content)]/30 border-white/10 hover:text-[var(--color-base-content)];
  }

  /* Group Divider line */
  .group-divider {
    @apply h-px bg-black/5 my-1 mx-1;
  }
  :global(.dark) .group-divider {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)];
  }

  /* WPS-Style Horizontal Sub-row */
  .horizontal-sub-row {
    @apply flex items-center justify-end px-3 py-1 bg-black/5 gap-2;
  }
  :global(.dark) .horizontal-sub-row {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_2%,transparent)];
  }

  .sub-row-item {
    @apply text-[10px] font-700 text-black/40 hover:text-black transition-colors;
  }
  :global(.dark) .sub-row-item {
    @apply text-[var(--color-base-content)]/30 hover:text-[var(--color-base-content)];
  }

  .sub-divider {
    @apply h-[8px] w-px bg-black/10;
  }
  :global(.dark) .sub-divider {
    @apply bg-[color-mix(in_srgb,var(--color-base-white)_10%,transparent)];
  }
</style>
