<!--
 Copyright (C) 2025 Dashmake Inc.
 
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
  import { _ } from 'svelte-i18n'

  import RecordRTC from 'recordrtc'
  import Record from 'videojs-record/dist/videojs.record.js'
  import 'videojs-record/dist/css/videojs.record.css'

  import videojs from 'video.js'
  import 'video.js/dist/video-js.css'

  let player

  // setup player after mount
  import { onMount } from 'svelte'
  import { toAssetUrl } from '../../../utils/assetUrl'
  let {
    filePath
  }: {
    filePath: string // can be file path, URL, or base64 string
  } = $props()

  onMount(() => {
    player = videojs('my-video', {
      controls: true,
      autoplay: false,
      preload: 'auto',
      fluid: true // responsive
      /* plugins: {
        record: {
          audio: true,
          video: true,
          maxLength: 30
        }
      } */
    })

    player.on('finishRecord', () => {
      console.log('Recording finished: ', player.recordedData)
    })

    return () => {
      if (player) player.dispose()
    }
  })
</script>

<video
  id="my-video"
  class="video-js vjs-big-play-centered"
  controls
  preload="auto"
  width="640"
  height="360"
>
  <source src={toAssetUrl(filePath)} type="video/mp4" />
</video>
