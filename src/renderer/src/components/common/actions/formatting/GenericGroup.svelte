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
  import { _, isLoading } from 'svelte-i18n'
  import Layout from '../../layout/layout'
  import LayoutGroup from '../../layout/LayoutGroup.svelte'

  // export let layout = Layout.LAYOUT.COLUMN
  let { direction = Layout.DIRECTION.HORIZONTAL, items = [] } = $props()

  // export let icon
</script>

<LayoutGroup __items={items} __direction={direction}></LayoutGroup>

<!-- <LayoutGroup {items} {layout} {direction}></LayoutGroup> -->

<style>
</style>
