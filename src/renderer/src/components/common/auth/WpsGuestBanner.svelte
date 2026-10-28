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
<!-- WPS-style "guest mode" banner shown above the document/grid when signed out. -->
<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { startAuth } from '../../../stores/auth.store'

  let busy = $state(false)

  async function loginNow() {
    if (busy) return
    busy = true
    try {
      await startAuth('signin')
    } finally {
      busy = false
    }
  }
</script>

<div class="wps-guest-banner" role="status">
  <i class="ph-bold ph-warning-circle text-[15px]" style="color: #d9a300"></i>
  <span>
    {$_('You are currently in guest mode. Sign in to activate more features and services.')}
  </span>
  <button class="wps-guest-cta" onclick={loginNow} disabled={busy}>
    {$_('login now')}
  </button>
</div>
