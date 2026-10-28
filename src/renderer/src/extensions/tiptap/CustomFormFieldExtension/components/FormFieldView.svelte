<script lang="ts">
  import { _ } from 'svelte-i18n'
  import Label from './fields/Label.svelte'

  // import { NodeViewWrapper, NodeViewContent } from 'svelte-tiptap';
  import TextField from './fields/TextField.svelte'
  import CheckboxField from './fields/Checkbox.svelte'
  import SelectField from './fields/Select.svelte'
  import RadioGroupField from './fields/RadioGroup.svelte'
  import SwitchField from './fields/Switch.svelte'
  import DatePickerField from './fields/DatePicker.svelte'
  import ButtonField from './fields/Button.svelte'
  import Resizer from '../../../../components/app/editor/components/display/Resizer.svelte'
  import { CustomFormFieldExtension } from '../CustomFormFieldExtension.svelte'
  import { NodeViewWrapper } from 'svelte-tiptap'
  import { authStore } from '../../../../stores/auth.store'
  import { _$_documentEditorsList } from '../../../../stores/editor.store'
  // import { loadComponents } from './fields/libs/componentRegistry'
  // import SelectField from './fields/SelectField.svelte';
  // import CheckboxField from './fields/CheckboxField.svelte';
  // import ImageField from './fields/ImageField.svelte';
  // import StarRating from './fields/StarRating.svelte';

  // REQUIRED by SvelteNodeViewRenderer
  const {
    node,
    editor,
    view,
    getPos,
    decorations,
    selected,
    extension,
    updateAttributes,
    deleteNode
  } = $props<{
    node: any
    editor: any
    view: any
    getPos: any
    decorations: any
    selected: boolean
    extension: any
    updateAttributes: any
    deleteNode: any
  }>()

  // export let editor
  // export let node
  // export let nodeId
  // export let updateAttributes;

  const attrs = $derived(node?.attrs || {})
  const nodeId = $derived(attrs?.id)

  function handleChange(e) {
    // updateAttributes({ value: e.detail?.value ?? e.target.value });
  }

  // Map of type to component
  const components = {
    TextField: TextField,
    Checkbox: CheckboxField,
    Select: SelectField,
    RadioGroup: RadioGroupField,
    Switch: SwitchField,
    DatePicker: DatePickerField,
    Button: ButtonField,
    label: Label,
    text: TextField
    // select: SelectField,
    // checkbox: CheckboxField,
    // image: ImageField,
    // rating: StarRating,
  }

  const activeDocStore = _$_documentEditorsList.getActive()
  const isAuthenticated = $derived($authStore?.authenticated)
  const formConfig = $derived($activeDocStore?.document?.config?.form || {})
  const isFormClosed = $derived(formConfig?.isOpen === false)
  const requireAuth = $derived(formConfig?.requireAuth === true)
  const allowAnonymous = $derived(formConfig?.allowAnonymous !== false)
  const deadlineAt = $derived(formConfig?.deadlineAt ? new Date(formConfig.deadlineAt) : null)
  const isAfterDeadline = $derived(Boolean(deadlineAt && Date.now() > deadlineAt.getTime()))

  const CurrentComponent = $derived(
    components[attrs.component] || components[attrs.type] || TextField
  )
  const computedDisabled = $derived(
    Boolean(
      attrs.disabled ||
      isFormClosed ||
      isAfterDeadline ||
      ((requireAuth || !allowAnonymous) && !isAuthenticated)
    )
  )
</script>

<!-- 🟢 Wrapper for the draggable node -->
<!-- <span class="inline-block"> -->
<NodeViewWrapper>
  <Resizer
    __width={attrs.width ?? 150}
    __height={null}
    __direction="both"
    __lockAspectRatio={attrs.lockAspectRatio ?? false}
    __updateAttributes={(newAttrs) =>
      editor.commands.updateAttributes(CustomFormFieldExtension.name, newAttrs)}
  >
    <!-- <Resizer
    __width={attrs.width ?? 150}
    __height={attrs.height}
    __direction="both"
    __lockAspectRatio={attrs.lockAspectRatio ?? false}
    __updateAttributes={(newAttrs) =>
      editor.commands.updateAttributes(CustomFormFieldExtension.name, newAttrs)}
  > -->
    <span class="flex h-full" contenteditable="false">
      <!-- 🟣 Drag handle -->
      <span
        class="drag-handle w-4 h-4 mt-1 cursor-grab active:cursor-grabbing items-center justify-center text-gray-400 hover:text-gray-600 select-none"
        data-drag-handle
        title={$_('Drag to move')}
      >
        ☰
      </span>

      <!-- 🟢 Form content -->
      <span class="form-control w-full  h-full">
        <!-- {#if attrs.label}
          <label class="label" contenteditable="false">
            <span class="label-text">{attrs.label}</span>
          </label>
        {/if} -->

        <!-- <label class="label" contenteditable="false">
      <span class="label-text">yeess</span>
    </label> -->

        <svelte:component
          this={CurrentComponent}
          value={attrs.value}
          placeholder={attrs.placeholder}
          options={attrs.options}
          required={attrs.required}
          disabled={computedDisabled}
          label={attrs.label}
          name={attrs.name}
          helperText={attrs.helper}
          min={attrs.min}
          max={attrs.max}
          step={attrs.step}
          pattern={attrs.pattern}
          {nodeId}
          on:input={handleChange}
        />

        <!-- <svelte:component
    this={CurrentComponent}
    label={attrs.label}
    value={attrs.value}
    placeholder={attrs.placeholder}
    options={attrs.options}
    required={attrs.required}
    on:input={handleChange}
  /> -->

        {#if attrs.helper}
          <label class="label">
            <span class="label-text-alt">{attrs.helper}</span>
          </label>
        {/if}
      </span>
    </span>
  </Resizer>
</NodeViewWrapper>

<style>
  .drag-handle {
    user-select: none;
  }

  input,
  textarea,
  select {
    pointer-events: auto;
    user-select: text;
    -webkit-user-drag: none;
  }
</style>
