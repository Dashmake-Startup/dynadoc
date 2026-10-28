<script lang="ts">
  import CodeEditorCore from './CodeEditorCore.svelte'

  interface Props {
    __value?: string
    __language?: string | null
    __src?: string | null
    __editable?: boolean
    __theme?: string
    __options?: Record<string, any>
    __onSave?: Record<string, any>
  }

  let {
    __value = '',
    __language = null,
    __src = null,
    __editable = true,
    __theme = 'vs-dark',
    __options = {},
    __onSave = {}
  }: Props = $props()
</script>

<CodeEditorCore
  __value={__value}
  __language={__language}
  __src={__src}
  __editable={__editable}
  __theme={__theme}
  __options={__options}
  __showToolbar={true}
  __showStatusBar={true}
  __height="400px"
  __guarded={true}
/>
