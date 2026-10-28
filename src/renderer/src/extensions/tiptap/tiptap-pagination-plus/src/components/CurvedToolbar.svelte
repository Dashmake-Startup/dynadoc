

<script lang="ts">

  import { _ } from 'svelte-i18n'
  import { createEventDispatcher } from 'svelte'
  import { importFileIntoDocumentAssets } from '../../../../../utils/documentAssetImport'
  //   import { Settings, FileText, Rocket, Image, Cookie } from 'lucide-svelte'
  import type { Editor } from '@tiptap/core'

  import ContextMenu from '../../../../../components/common/contextMenu/ContextMenu.svelte'
  let { __editor, __addFile = () => {} }: { __editor: Editor, __addFile: any } = $props()

  const dispatch = createEventDispatcher()

  const tools = [
    { icon: 'pi', name: 'Settings' },
    { icon: 'pi', name: 'Document' },
    { icon: 'pi', name: 'Launch' },
    { icon: 'pi', name: 'Image' },
    { icon: 'pi', name: 'Cookie' }
  ]

  const handleClick = (tool) => {
    dispatch('select', { tool })
  }

  let pageNumber = 1
  let orientation = 'portrait'
  let pageSize = 'A4'
  let bgColor = '#ffffff'
  let margin = '1in'
  let columns = 1
  let zoom = 100

  function handleAddFile() {
    handlePickFile()
  }
  function handleAddFolder() {
    handlePickFolder()
  }

  async function handlePickFile() {
    const src = await window.api.openDialogFile()
    // console.log('dialog:openFile filePaths result', result)

    // const result = await window.api.openDialogDirectory({ properties: ['openFile'] })
    if (src) {
      console.log('dialog:openFile filePaths result', {
        value: src
      })

      if (__editor) {
        const importedSrc = await importFileIntoDocumentAssets(src)
        __editor.commands.insertFile(importedSrc)
      }
    }
  }

  async function handlePickFolder() {
    const src = await window.api.openDialogDirectory()
    if (src) {
      if (__editor) {
        __editor.commands.insertFolder(src)
      }
    }
  }

  // Page actions
  const addPage = () => dispatch('addPage')
  const deletePage = () => dispatch('deletePage')
  const duplicatePage = () => dispatch('duplicatePage')

  // Page layout
  const toggleOrientation = () => {
    orientation = orientation === 'portrait' ? 'landscape' : 'portrait'
    dispatch('changeOrientation', { orientation })
  }
  const changePageSize = (size: string) => {
    pageSize = size
    dispatch('changePageSize', { pageSize })
  }
  const changeBgColor = (e: Event) => {
    const input = e.target as HTMLInputElement
    bgColor = input.value
    dispatch('changeBgColor', { bgColor })
  }
  const changeMargin = (m: string) => {
    margin = m
    dispatch('changeMargin', { margin })
  }
  const changeColumns = (cols: number) => {
    columns = cols
    dispatch('changeColumns', { columns })
  }

  // Page navigation
  const goToPage = (n: number) => {
    pageNumber = n
    dispatch('goToPage', { pageNumber })
  }

  const zoomIn = () => {
    zoom += 10
    dispatch('zoomChange', { zoom })
  }
  const zoomOut = () => {
    zoom -= 10
    dispatch('zoomChange', { zoom })
  }
</script>



<nav class="nav">
  <div class="nav__list flex items-center gap-2">
    <!-- ================= PAGE ACTIONS DROPDOWN ================= -->
    <div class="nav__link cursor-pointer">
      <ContextMenu>
        <label class="">
          <i class="ph-light ph-files"></i>
        </label>
        <!-- <button
        transparent
        title="Align center"
        icon-only
      >
        <i class="ph-light ph-files"></i>
      </button> -->

        <svelte:fragment slot="content">
          <div
            class="shadow-lg rounded-box p-1
           w-[max-content] flex flex-col gap-3"
          >
            <button class="btn btn-sm btn-ghost w-full justify-start" on:click={handleAddFolder}>
              <i class="ph-light ph-plus mr-2"></i> {$_('Add folder')}
            </button>

            <button class="btn btn-sm btn-ghost w-full justify-start" on:click={handleAddFile}>
              <i class="ph-light ph-plus mr-2"></i> {$_('Add file')}
            </button>

            <button class="btn btn-sm btn-ghost w-full justify-start" on:click={addPage}>
              <i class="ph-light ph-plus mr-2"></i> {$_('Add Page')}
            </button>

            <button class="btn btn-sm btn-ghost w-full justify-start" on:click={deletePage}>
              <i class="ph-light ph-trash mr-2"></i> {$_('Delete Page')}
            </button>

            <button class="btn btn-sm btn-ghost w-full justify-start" on:click={duplicatePage}>
              <i class="ph-light ph-copies mr-2"></i> {$_('Duplicate Page')}
            </button>
          </div>
        </svelte:fragment>
      </ContextMenu>
    </div>
    <!-- ================= PAGE LAYOUT DROPDOWN ================= -->
    <div class="nav__link cursor-pointer">
      <ContextMenu>
        <label class="">
          <i class="ph-light ph-layout"></i>
        </label>

        <svelte:fragment slot="content">
          <div
            class="shadow-lg rounded-box p-1
           w-[max-content] flex flex-col gap-4"
          >
            <!-- Orientation -->
            <button class="btn btn-sm btn-ghost w-full justify-start" on:click={toggleOrientation}>
              <i class="ph-light ph-arrows-horizontal mr-2"></i>
              Orientation: {orientation}
            </button>

            <!-- Page Size -->
            <div class="form-control w-full">
              <label class="label text-xs">{$_('Page Size')}</label>
              <select
                class=" w-full"
                value={pageSize}
                on:change={(e) => changePageSize(e.target.value)}
              >
                <option value="A4">{$_('A4')}</option>
                <option value="Letter">{$_('Letter')}</option>
                <option value="Legal">{$_('Legal')}</option>
              </select>
            </div>

            <!-- Margins -->
            <div class="form-control w-full">
              <label class="label text-xs">{$_('Margins')}</label>
              <select
                class=" w-full"
                value={margin}
                on:change={(e) => changeMargin(e.target.value)}
              >
                <option value="0.5in">{$_('0.5 in')}</option>
                <option value="1in">{$_('1 in')}</option>
                <option value="1.5in">{$_('1.5 in')}</option>
              </select>
            </div>

            <!-- Columns -->
            <div class="form-control w-full">
              <label class="label text-xs">{$_('Columns')}</label>
              <select
                class=" w-full"
                value={columns}
                on:change={(e) => changeColumns(parseInt(e.target.value))}
              >
                <option value="1">{$_('1 Column')}</option>
                <option value="2">{$_('2 Columns')}</option>
                <option value="3">{$_('3 Columns')}</option>
              </select>
            </div>

            <!-- Background Color -->
            <div class="flex items-center justify-between">
              <span class="text-xs">{$_('Background')}</span>
              <input
                class="input input-sm w-10 p-0"
                type="color"
                value={bgColor}
                on:input={changeBgColor}
              />
            </div>
          </div>
        </svelte:fragment>
      </ContextMenu>
    </div>
    <!-- ================= NAVIGATION DROPDOWN ================= -->

    <div class="nav__link cursor-pointer">
      <ContextMenu __placement={"auto-start"}>
        <label class="">
          <i class="ph-light ph-caret-double-right"></i>
        </label>

        <svelte:fragment slot="content">
          <div
            class="shadow-lg rounded-box p-1
           w-[max-content] flex flex-col gap-3"
          >
            <button
              class="btn btn-sm btn-outline w-full"
              on:click={() => goToPage(pageNumber - 1)}
              disabled={pageNumber <= 1}
            >
              {$_('Previous')}
            </button>

            <div class="text-center text-sm">Page {pageNumber}</div>

            <button class="btn btn-sm btn-outline w-full" on:click={() => goToPage(pageNumber + 1)}>
              Next
            </button>

            <div class="divider my-1"></div>

            <!-- Optional: jump to page -->
            <input
              type="number"
              class="input input-sm"
              min="1"
              placeholder={$_('Go to page…')}
              on:change={(e) => goToPage(parseInt(e.target.value))}
            />
          </div>
        </svelte:fragment>
      </ContextMenu>
    </div>

    <!-- ================= NAVIGATION DROPDOWN ================= -->
  </div>
</nav>

<style>
  :root {
    /*========== Colors ==========*/
    --first-color: hsl(248, 74%, 58%);
    --black-color: hsl(248, 24%, 10%);
    --white-color: #fff;
    --body-color: hsl(248, 100%, 99%);
    /*========== Font and typography ==========*/
    --body-font: 'Poppins', sans-serif;
    --small-font-size: 0.813rem;
  }
  /*=============== SIDEBAR ===============*/
  .nav {
    height: 72px;
    width: 20%;
    /* width: max-content; */
    /* position: absolute; */
    inset: 0;
    margin: 0 auto;
    /* top: 0; */
  }
  .nav__list {
    position: relative;
    background-color: var(--first-color);
    /* padding-block: 70px; */
    border-radius: 0 0 1em 1em;
    /* border-radius: 0 0 51px 51px; */
    display: flex;
    justify-content: center;
    gap: 0rem;
    padding: 0%;
    /* gap: 4rem; */
    /* padding: 2%; */
  }
  .nav__link {
    position: relative;
    display: inline-flex;
    padding: 4px;
    border-radius: 50%;
    transition: background 0.4s;
  }
  .nav__link i {
    font-size: 1.25rem;
    color: var(--white-color);
    transition: color 0.4s;
  }
  .nav__link:hover .nav__name {
    opacity: 1;
    transform: translateX(48px);
  }
  .nav__name {
    position: absolute;
    top: 0;
    transform: translateX(56px);
    background-color: var(--black-color);
    color: var(--white-color);
    font-size: var(--small-font-size);
    font-weight: 500;
    padding: 6px 16px;
    border-radius: 3rem;
    pointer-events: none;
    transition:
      transform 0.5s,
      opacity 0.5s;
    opacity: 0;
  }
  .nav__circle-1,
  .nav__circle-2 {
    width: 80px;
    height: 80px;
    background-color: var(--body-color);
    border-radius: 50%;
    position: absolute;
    left: 0;
    z-index: 10;
  }
  .nav__circle-1 {
    top: -78px;
  }
  .nav__circle-2 {
    bottom: -78px;
  }
  .nav__square-1,
  .nav__square-2 {
    width: 35px;
    height: 40px;
    background-color: var(--first-color);
    position: absolute;
    left: 0;
    z-index: 1;
  }
  .nav__square-1 {
    top: -39px;
  }
  .nav__square-2 {
    bottom: -39px;
  }
  /* Active link */
  .active-link {
    background-color: var(--white-color);
    border-radius: 1rem;
  }
  .active-link i {
    color: var(--first-color);
  }
</style>
