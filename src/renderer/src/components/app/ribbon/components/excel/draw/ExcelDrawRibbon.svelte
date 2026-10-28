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

<script lang="ts">
  import { get } from 'svelte/store'
  import { _ as base_ } from 'svelte-i18n'
  import GenericRibbon from '../../GenericRibbon.svelte'
  import type { Group } from '../../utils/utils'
  import { createExcelItemSafe, createGenericItem } from '../utils/excelRibbonUtils'

  const _ = (key: string) => key

  const groups: Group[] = [
    {
      id: 'tools',
      title: _('Tools'),
      items: [
        createExcelItemSafe('Pen'),
        createExcelItemSafe('Highlighter'),
        createExcelItemSafe('Eraser'),
        createExcelItemSafe('Select')
      ].filter(Boolean)
    },
    {
      id: 'shapes',
      title: _('Shapes'),
      items: [
        createGenericItem('DrawShapeSelect'),
        createExcelItemSafe('Rectangle')
      ].filter(Boolean)
    },
    {
      id: 'ink',
      title: _('Ink'),
      items: [
        createExcelItemSafe('InkToShape'),
        createExcelItemSafe('InkToMath')
      ].filter(Boolean)
    }
  ]
</script>

<GenericRibbon __groups={groups} />
