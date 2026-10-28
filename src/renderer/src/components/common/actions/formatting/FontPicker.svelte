<!--
 Copyright (C) 2024 Dashmake Inc.

 This file is part of DDoc Office.

 DDoc Office is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 DDoc Office is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.
-->
<script>
  import FontFamilyDropdown from '../../dropdown/FontFamilyDropdown.svelte'
  import Layout from '../../layout/layout'
  import { _, isLoading } from 'svelte-i18n'
  // import LayoutColumn from '../../layout/LayoutColumn.svelte'
  // import LayoutIcon from '../../layout/LayoutIcon.svelte'
  // import LayoutRow from '../../layout/LayoutRow.svelte'
  // import LayoutSelect from '../../layout/LayoutSelect.svelte'

  // export let layout = Layout.LAYOUT.COLUMN
  // export let displayFontSizePicker = true

  let {
    __layout = Layout.LAYOUT.COLUMN,
    __displayFontSizePicker = true,
    __selectedFont = $bindable('Arial'),
    __selectedSize = $bindable(12),
    __onOtherActions
  } = $props()

  const __onFontFamilyChanged = $derived.by(
    () => __onOtherActions?.__onFontFamilyChanged || (() => {})
  )
  const __onFontHoverPreview = $derived.by(
    () => __onOtherActions?.__onFontHoverPreview || (() => {})
  )
  const __onFontSizeChanged = $derived.by(
    () => __onOtherActions?.__onFontSizeChanged || (() => {})
  )

  // const layouts = {
  //   [Layout.LAYOUT.COLUMN]: LayoutColumn,
  //   [Layout.LAYOUT.ROW]: LayoutRow,
  //   [Layout.LAYOUT.SELECT]: LayoutSelect,
  //   [Layout.LAYOUT.ICON]: LayoutIcon
  // }

  // const icon = `<i class="ph-light ph-scissors"></i>`
  // const label = 'Cut'

  // $: LayoutComponent = Layout.LAYOUT_COMPONENTS[__layout]
  const LayoutComponent = $derived(Layout.LAYOUT_COMPONENTS[__layout])

  // export let icon
</script>

<!-- <svelte:component this={LayoutComponent}>
  <svelte:fragment slot="icon"> -->
<FontFamilyDropdown {__onFontFamilyChanged} {__onFontHoverPreview} {__selectedFont} {__selectedSize}
{__onFontSizeChanged}
></FontFamilyDropdown>

<!-- </svelte:fragment> -->
<!-- <svelte:fragment slot="label">{@html label}</svelte:fragment> -->
<!-- </svelte:component> -->

<style>
</style>
