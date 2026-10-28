<script lang="ts">
import { nodeApi } from '../../../utils/shims/node'
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { Howl } from 'howler'
  import './lib/player/styles.css'
  import './lib/player/siriwave.js'
  import { getFileName } from '../utils/utils'
  import { nanoid } from 'nanoid'
  import MissingFilePlaceholder from '../MissingFilePlaceholder.svelte'
  import { toLocalPath } from '../../../utils/assetUrl'

  // import './lib/player/player.js'

  interface Props {
    __src?: string
    __autoplay?: boolean
  }

  let { __src = '', __autoplay = false }: Props = $props()

  let _audioPlayer: HTMLElement
// const  fs = nodeApi.fs
  const isExternalUrl = (value: string) => /^(blob:|data:|https?:)/i.test(value || '')
  const _path = $derived.by(() => {
    const raw = toLocalPath(__src)
    return (raw || '').split('?')[0]
  })
  let _exists = $state<boolean | 'checking'>('checking')
  let _initialized = $state(false)

  $effect(() => {
    _initialized = false
  })

  $effect(() => {
    const currentPath = _path
    if (!currentPath) {
      _exists = false
      return
    }
    if (isExternalUrl(currentPath)) {
      _exists = true
      return
    }
    _exists = 'checking'
    async function checkFile() {
      try {
        if (nodeApi.fsPromises?.exists) {
          _exists = await nodeApi.fsPromises.exists(currentPath)
          return
        }
        if (nodeApi.fs?.existsSync) {
          _exists = nodeApi.fs.existsSync(currentPath)
          return
        }
        _exists = true
      } catch {
        _exists = false
      }
    }
    void checkFile()
  })

  $effect(() => {
    if (_initialized) return
    if (_exists !== true) return
    if (!_audioPlayer) return
    /*!
     *  Howler.js Audio Player Demo
     *  howlerjs.com
     *
     *  (c) 2013-2020, James Simpson of GoldFire Studios
     *  goldfirestudios.com
     *
     *  MIT License
     */

    const playlist = [
      {
        title: getFileName(__src),
        file: __src,
        howl: null
      }
    ]
    initAudioPlayer(_audioPlayer, __src, playlist)
    _initialized = true

    function initAudioPlayer(elm, src, _playlist) {
      console.log('playlist initAudioPlayer ', { elm, src, _playlist })

      // Cache references to DOM elements
      let track = elm.querySelector('.track')
      let timer = elm.querySelector('.timer')
      let duration = elm.querySelector('.duration')
      let playBtn = elm.querySelector('.playBtn')
      let pauseBtn = elm.querySelector('.pauseBtn')
      let prevBtn = elm.querySelector('.prevBtn')
      let nextBtn = elm.querySelector('.nextBtn')
      let playlistBtn = elm.querySelector('.playlistBtn')
      let volumeBtn = elm.querySelector('.volumeBtn')
      let progress = elm.querySelector('.progress')
      let bar = elm.querySelector('.bar')
      // let wave = elm.querySelector('.wave')
      let waveform = elm.querySelector('.waveform')
      let loading = elm.querySelector('.loading')
      let playlist = elm.querySelector('.playlist')
      let list = elm.querySelector('.list')
      let volumeElmt = elm.querySelector('.volume')
      let barEmpty = elm.querySelector('.barEmpty')
      let barFull = elm.querySelector('.barFull')
      let sliderBtn = elm.querySelector('.sliderBtn')
      let sliderDown = false // inside initAudioPlayer

      /**
       * Player class containing the state of our playlist and where we are in it.
       * Includes all methods for playing, skipping, updating the display, etc.
       * @param {Array} playlist Array of objects with playlist song details ({title, file, howl}).
       */
      let Player = function (playlist) {
        console.log('playlist', { playlist })
        this.playlist = playlist
        this.index = 0

        // Display the title of the first track.
        track.innerHTML = '1. ' + playlist[0].title

        // Setup the playlist display.
        playlist.forEach(function (song) {
          let div = document.createElement('div')
          div.className = 'list-song'
          div.innerHTML = song.title
          div.onclick = function () {
            player.skipTo(playlist.indexOf(song))
          }
          console.log('playlist list ', { list: list.getAttribute('id') })
          list.appendChild(div)
        })
      }
      Player.prototype = {
        /**
         * Play a song in the playlist.
         * @param  {Number} index Index of the song in the playlist (leave empty to play the first or current).
         */
        play: function (index) {
          console.log('playlist player play', { src, index })
          let self = this
          let sound
          console.log('playlist player self', { self, 'x self ': self.playlist })

          index = typeof index === 'number' ? index : self.index
          let data = self.playlist[index]

          // If we already loaded this track, use the current one.
          // Otherwise, setup and load a new Howl.
          if (data.howl) {
            sound = data.howl
          } else {
            sound = data.howl = new Howl({
              src: [src],
              html5: true, // Force to HTML5 so that the audio can stream in (best for large files).
              onplay: function () {
                // Display the duration.
                duration.innerHTML = self.formatTime(Math.round(sound.duration()))

                // Start updating the progress of the track.
                requestAnimationFrame(self.step.bind(self))

                // Start the wave animation if we have already loaded
                siriWave.container.style.display = 'block'
                bar.style.display = 'none'
                pauseBtn.style.display = 'block'
              },
              onload: function () {
                // Start the wave animation.
                siriWave.container.style.display = 'block'
                bar.style.display = 'none'
                loading.style.display = 'none'
              },
              onend: function () {
                // Stop the wave animation.
                siriWave.container.style.display = 'none'
                bar.style.display = 'block'
                self.skip('next')
              },
              onpause: function () {
                // Stop the wave animation.
                siriWave.container.style.display = 'none'
                bar.style.display = 'block'
              },
              onstop: function () {
                // Stop the wave animation.
                siriWave.container.style.display = 'none'
                bar.style.display = 'block'
              },
              onseek: function () {
                // Start updating the progress of the track.
                requestAnimationFrame(self.step.bind(self))
              }
            })
          }

          // Begin playing the sound.
          sound.play()

          // Update the track display.
          track.innerHTML = index + 1 + '. ' + data.title

          // Show the pause button.
          if (sound.state() === 'loaded') {
            playBtn.style.display = 'none'
            pauseBtn.style.display = 'block'
          } else {
            loading.style.display = 'block'
            playBtn.style.display = 'none'
            pauseBtn.style.display = 'none'
          }

          // Keep track of the index we are currently playing.
          self.index = index
        },

        /**
         * Pause the currently playing track.
         */
        pause: function () {
          let self = this

          // Get the Howl we want to manipulate.
          let sound = self.playlist[self.index].howl
          // let sound = self.playlist[self.index].howl

          // Puase the sound.
          sound.pause()

          // Show the play button.
          playBtn.style.display = 'block'
          pauseBtn.style.display = 'none'
        },

        /**
         * Skip to the next or previous track.
         * @param  {String} direction 'next' or 'prev'.
         */
        skip: function (direction) {
          let self = this

          // Get the next track based on the direction of the track.
          let index = 0
          if (direction === 'prev') {
            index = self.index - 1
            if (index < 0) {
              index = self.playlist.length - 1
            }
          } else {
            index = self.index + 1
            if (index >= self.playlist.length) {
              index = 0
            }
          }

          self.skipTo(index)
        },

        /**
         * Skip to a specific track based on its playlist index.
         * @param  {Number} index Index in the playlist.
         */
        skipTo: function (index) {
          let self = this

          // Stop the current track.
          if (self.playlist[self.index].howl) {
            // if (self.playlist[self.index].howl) {
            self.playlist[self.index].howl.stop()
            // self.playlist[self.index].howl.stop()
          }

          // Reset progress.
          progress.style.width = '0%'

          // Play the new track.
          self.play(index)
        },

        /**
         * Set the volume and update the volume slider display.
         * @param  {Number} val Volume between 0 and 1.
         */
        volume: function (val) {
          let self = this

          // Update the global volume (affecting all Howls).
          // Howler.volume(val)
          let sound = self.playlist[self.index].howl
          if (sound) sound.volume(val)

          // Update the display on the slider.
          let barWidth = (val * 90) / 100
          barFull.style.width = barWidth * 100 + '%'
          // sliderBtn.style.left = elm.innerWidth * barWidth + elm.innerWidth * 0.05 - 25 + 'px'
          sliderBtn.style.left = window.innerWidth * barWidth + window.innerWidth * 0.05 - 25 + 'px'
          // sliderBtn.style.left = window.innerWidth * barWidth + window.innerWidth * 0.05 - 25 + 'px'
        },

        /**
         * Seek to a new position in the currently playing track.
         * @param  {Number} per Percentage through the song to skip.
         */
        seek: function (per) {
          let self = this

          // Get the Howl we want to manipulate.
          let sound = self.playlist[self.index].howl

          // Convert the percent into a seek position.
          if (sound.playing()) {
            sound.seek(sound.duration() * per)
          }
        },

        /**
         * The step called within requestAnimationFrame to update the playback position.
         */
        step: function () {
          let self = this

          // Get the Howl we want to manipulate.
          let sound = self.playlist[self.index].howl

          // Determine our current seek position.
          let seek = sound.seek() || 0
          timer.innerHTML = self.formatTime(Math.round(seek))
          progress.style.width = ((seek / sound.duration()) * 100 || 0) + '%'

          // If the sound is still playing, continue stepping.
          if (sound.playing()) {
            requestAnimationFrame(self.step.bind(self))
          }
        },

        /**
         * Toggle the playlist display on/off.
         */
        togglePlaylist: function () {
          let self = this
          let display = playlist.style.display === 'block' ? 'none' : 'block'

          setTimeout(
            function () {
              playlist.style.display = display
            },
            display === 'block' ? 0 : 500
          )
          playlist.className = display === 'block' ? 'fadein' : 'fadeout'
        },

        /**
         * Toggle the volume display on/off.
         */
        toggleVolume: function () {
          let self = this
          let display = volumeElmt.style.display === 'block' ? 'none' : 'block'

          setTimeout(
            function () {
              volumeElmt.style.display = display
            },
            display === 'block' ? 0 : 500
          )
          volumeElmt.className = display === 'block' ? 'fadein' : 'fadeout'
        },

        /**
         * Format the time from seconds to M:SS.
         * @param  {Number} secs Seconds to format.
         * @return {String}      Formatted time.
         */
        formatTime: function (secs) {
          let minutes = Math.floor(secs / 60) || 0
          let seconds = secs - minutes * 60 || 0

          return minutes + ':' + (seconds < 10 ? '0' : '') + seconds
        }
      }

      // Setup our new audio player class and pass it the playlist.
      let player = new Player(
        _playlist
        // [
        // {
        //   title: getFileName(__src),
        //   file: __src,
        //   howl: null
        // }
        /* {
        title: 'Rave Digger',
        file: 'rave_digger',
        howl: null
      },
      {
        title: '80s Vibe',
        file: '80s_vibe',
        howl: null
      },
      {
        title: 'Running Out',
        file: 'running_out',
        howl: null
      } */
        // ]
      )

      // Bind our player controls.
      playBtn.addEventListener('click', function () {
        player.play(self.index)
      })
      pauseBtn.addEventListener('click', function () {
        player.pause()
      })
      prevBtn.addEventListener('click', function () {
        player.skip('prev')
      })
      nextBtn.addEventListener('click', function () {
        player.skip('next')
      })
      waveform.addEventListener('click', function (event) {
        player.seek(event.clientX / window.innerWidth)
      })
      playlistBtn.addEventListener('click', function () {
        player.togglePlaylist()
      })
      playlist.addEventListener('click', function () {
        player.togglePlaylist()
      })

      volumeBtn.addEventListener('click', function () {
        player.toggleVolume()
      })
      volumeElmt.addEventListener('click', function () {
        player.toggleVolume()
      })

      // Setup the event listeners to enable dragging of volume slider.
      barEmpty.addEventListener('click', function (event) {
        let per = event.layerX / parseFloat(barEmpty.scrollWidth)
        player.volume(per)
      })
      sliderBtn.addEventListener('mousedown', function () {
        sliderDown = true
      })
      sliderBtn.addEventListener('touchstart', function () {
        sliderDown = true
      })
      volumeElmt.addEventListener('mouseup', function () {
        sliderDown = false
      })
      volumeElmt.addEventListener('touchend', function () {
        sliderDown = false
      })

      let move = function (event) {
        if (sliderDown) {
          let x = event.clientX || event.touches[0].clientX
          let startX = window.innerWidth * 0.05
          let layerX = x - startX
          let per = Math.min(1, Math.max(0, layerX / parseFloat(barEmpty.scrollWidth)))
          player.volume(per)
        }
      }

      volumeElmt.addEventListener('mousemove', move)
      volumeElmt.addEventListener('touchmove', move)

      // Setup the "waveform" animation.
      let siriWave = new SiriWave({
        container: waveform,
        width: window.innerWidth,
        height: window.innerHeight * 0.3,
        cover: true,
        speed: 0.03,
        amplitude: 0.7,
        frequency: 2
      })
      siriWave.start()

      // Update the height of the wave animation.
      // These are basically some hacks to get SiriWave.js to do what we want.
      let resize = function () {
        let height = window.innerHeight * 0.3
        let width = window.innerWidth
        siriWave.height = height
        siriWave.height_2 = height / 2
        siriWave.MAX = siriWave.height_2 - 4
        siriWave.width = width
        siriWave.width_2 = width / 2
        siriWave.width_4 = width / 4
        siriWave.canvas.height = height
        siriWave.canvas.width = width
        siriWave.container.style.margin = -(height / 2) + 'px auto'

        // Update the position of the slider.
        let sound = player.playlist[player.index].howl
        if (sound) {
          let vol = sound.volume()
          let barWidth = vol * 0.9
          sliderBtn.style.left = window.innerWidth * barWidth + window.innerWidth * 0.05 - 25 + 'px'
        }
      }
      window.addEventListener('resize', resize)
      resize()
    }
  })
</script>

{#if !_path}
  <MissingFilePlaceholder __title={$_('Audio missing')} __subtitle={$_('The audio file could not be found.')} __path={_path} />
{:else if _exists === 'checking'}
  <div class="h-32 bg-[color-mix(in_srgb,var(--color-base-white)_5%,transparent)] animate-pulse rounded-lg flex items-center justify-center border border-white/5">
    <i class="ph-bold ph-circle-notch animate-spin text-white/20"></i>
  </div>
{:else if _exists === false}
  <MissingFilePlaceholder __title={$_('Audio missing')} __subtitle={$_('The audio file could not be found.')} __path={_path} />
{:else}
<div class="audio-player" bind:this={_audioPlayer}>
  <!-- Top Info -->
  <div class="title">
    <span class="track"></span>
    <div class="timer">0:00</div>
    <div class="duration">0:00</div>
  </div>

  <!-- Controls -->
  <div class="controlsOuter">
    <div class="controlsInner">
      <div class="loading"></div>
      <div class="audio-player-btn playBtn"></div>
      <div class="audio-player-btn pauseBtn"></div>
      <div class="audio-player-btn prevBtn"></div>
      <div class="audio-player-btn nextBtn"></div>
    </div>
    <div class="audio-player-btn playlistBtn"></div>
    <div class="audio-player-btn volumeBtn"></div>
  </div>

  <!-- Progress -->
  <div class="waveform"></div>
  <div class="bar"></div>
  <div class="progress"></div>

  <!-- Playlist -->
  <div class="playlist">
    <div class="list" id={nanoid(10)}></div>
  </div>

  <!-- Volume -->
  <div class="volume fadeout">
    <div class="barFull volume-bar"></div>
    <div class="barEmpty volume-bar"></div>
    <div class="sliderBtn"></div>
  </div>
</div>
{/if}

<style>
</style>
