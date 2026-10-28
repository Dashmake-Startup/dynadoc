<script lang="ts">
  const _ = (key: string) => key

  import { GenericFormatingEditorCommands, GenericFormattingComponentMap } from '../../../../common/actions/formatting'

  let { compact = false } = $props()

  type RibbonItem = {
    id: string
    component: any
    props: Record<string, any>
  }

  type RibbonSection = {
    id: string
    items: RibbonItem[]
  }

  let _imgWidth = $state('')
  let _imgHeight = $state('')
  let _lockAspect = $state(true)
  let _ratio = $state<number | null>(null)

  const makeItem = (key: keyof typeof GenericFormattingComponentMap, overrides: Record<string, any> = {}) => {
    const entry = GenericFormattingComponentMap[key]
    if (!entry) return null
    const baseProps = typeof entry.props === 'function' ? entry.props({}) : entry.props
    return {
      id: key.toString(),
      component: entry.component,
      props: { ...baseProps, ...overrides }
    }
  }

  const sections: RibbonSection[] = [
    {
      id: 'change',
      items: [
        makeItem('ChangePictureSelect'),
        makeItem('AddPictureSelect'),
        makeItem('PictureCrop'),
        makeItem('PicturePreview')
      ].filter(Boolean)
    },
    {
      id: 'adjust',
      items: [
        makeItem('PictureTransparentColor'),
        makeItem('ImageColorSelect', { __class: 'editor-select' }),
        makeItem('ImageEffectsSelect', { __class: 'editor-select' }),
        makeItem('PictureBorderSelect', { __class: 'editor-select' }),
        makeItem('PictureRotateSelect', { __class: 'editor-select' }),
        makeItem('ImageReset')
      ].filter(Boolean)
    },
    {
      id: 'arrange',
      items: [
        makeItem('PictureWrapSelect', { __class: 'editor-select' }),
        makeItem('PictureAlignSelect', { __class: 'editor-select' }),
        makeItem('PictureGroupSelect', { __class: 'editor-select' }),
        makeItem('PictureBringForwardSelect', { __class: 'editor-select' }),
        makeItem('PictureSendBackwardSelect', { __class: 'editor-select' }),
        makeItem('PictureSelectionPane')
      ].filter(Boolean)
    },
    {
      id: 'settings',
      items: [makeItem('PictureSettingsSelect', { __class: 'editor-select' }), makeItem('PictureCompress')].filter(Boolean)
    }
  ]

  const updateWidth = () => {
    const width = Number(_imgWidth)
    if (!width) return
    if (_lockAspect && _ratio) {
      const nextHeight = Math.max(1, Number((width / _ratio).toFixed(2)))
      _imgHeight = `${nextHeight}`
      GenericFormatingEditorCommands.setImageSize(width, nextHeight)
      return
    }
    if (_imgHeight) {
      const h = Number(_imgHeight)
      if (width && h) _ratio = width / h
    }
    GenericFormatingEditorCommands.setImageSize(width, undefined)
  }

  const updateHeight = () => {
    const height = Number(_imgHeight)
    if (!height) return
    if (_lockAspect && _ratio) {
      const nextWidth = Math.max(1, Number((height * _ratio).toFixed(2)))
      _imgWidth = `${nextWidth}`
      GenericFormatingEditorCommands.setImageSize(nextWidth, height)
      return
    }
    if (_imgWidth) {
      const w = Number(_imgWidth)
      if (w && height) _ratio = w / height
    }
    GenericFormatingEditorCommands.setImageSize(undefined, height)
  }
</script>

<div class="editor-picture-tools">
  <div class="editor-ribbon">
    {#each sections as section, idx}
      <div class="editor-section">
        {#each section.items as item}
          <div class="editor-item">
            <svelte:component this={item.component} {...item.props} {compact} />
          </div>
        {/each}
        {#if section.id === 'change'}
          <div class="editor-size">
            <div class="editor-size-input">
              <div class="editor-size-label">{_('Width')}</div>
              <input
                type="number"
                step="1"
                min="1"
                bind:value={_imgWidth}
                placeholder="in"
                on:change={updateWidth}
              />
              <span>in</span>
            </div>
            <div class="editor-size-input">
              <div class="editor-size-label">{_('Height')}</div>
              <input
                type="number"
                step="1"
                min="1"
                bind:value={_imgHeight}
                placeholder="in"
                on:change={updateHeight}
              />
              <span>in</span>
            </div>
            <label class="editor-lock">
              <input
                type="checkbox"
                bind:checked={_lockAspect}
                on:change={() => GenericFormatingEditorCommands.setImageLockAspectRatio(_lockAspect)}
              />
              <span>{_('Lock Aspect Ratio')}</span>
            </label>
            <button class="editor-reset" on:click={() => GenericFormatingEditorCommands.resetImageSize()}>
              {_('Reset Size')}
            </button>
          </div>
        {/if}
      </div>
      {#if idx < sections.length - 1}
        <div class="editor-separator"></div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .editor-picture-tools {
    width: 100%;
    height: 100%;
  }

  .editor-ribbon {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 10px;
    overflow-x: auto;
  }

  .editor-section {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .editor-item {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 46px;
  }

  .editor-separator {
    width: 1px;
    height: 40px;
    background: rgba(255, 255, 255, 0.08);
  }

  .editor-size {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 2px 6px;
  }

  .editor-size-input {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }

  .editor-size-input input {
    width: 64px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(15, 23, 42, 0.8);
    color: white;
    padding: 2px 6px;
  }

  .editor-size-label {
    min-width: 44px;
  }

  .editor-lock {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
  }

  .editor-lock input {
    width: 14px;
    height: 14px;
  }

  .editor-reset {
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.8);
    background: rgba(15, 23, 42, 0.6);
  }


  :global(.editor-select .label) {
    text-transform: none !important;
    letter-spacing: normal !important;
  }
</style>
