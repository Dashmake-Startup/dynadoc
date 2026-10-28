<!-- <script lang="ts">
  import { _ } from 'svelte-i18n'
  import { onMount, onDestroy } from 'svelte'
  import { Editor } from '@tiptap/core'
  import StarterKit from '@tiptap/starter-kit'
  import Collaboration from '@tiptap/extension-collaboration'
  import CollaborationCaret from '@tiptap/extension-collaboration-caret'
  import Highlight from '@tiptap/extension-highlight'
  import { TaskItem, TaskList } from '@tiptap/extension-list'
  import { CharacterCount } from '@tiptap/extensions'

  export let ydoc
  export let provider
  export let room

  let editorContainer: HTMLDivElement
  let editor: Editor
  let status = 'connecting'

  const colors = [
    '#958DF1',
    '#F98181',
    '#FBBC88',
    '#FAF594',
    '#70CFF8',
    '#94FADB',
    '#B9F18D',
    '#C3E2C2',
    '#EAECCC',
    '#AFC8AD',
    '#EEC759',
    '#9BB8CD',
    '#FF90BC',
    '#FFC0D9',
    '#DC8686',
    '#7ED7C1',
    '#F3EEEA',
    '#89B9AD',
    '#D0BFFF',
    '#FFF8C9',
    '#CBFFA9',
    '#9BABB8',
    '#E3F4F4'
  ]
  const names = [
    'Lea Thompson',
    'Cyndi Lauper',
    'Tom Cruise',
    'Madonna',
    'Jerry Hall',
    'Joan Collins',
    'Winona Ryder',
    'Christina Applegate',
    'Alyssa Milano',
    'Molly Ringwald',
    'Ally Sheedy',
    'Debbie Harry',
    'Olivia Newton-John',
    'Elton John',
    'Michael J. Fox',
    'Axl Rose',
    'Emilio Estevez',
    'Ralph Macchio',
    'Rob Lowe',
    'Jennifer Grey',
    'Mickey Rourke',
    'John Cusack',
    'Matthew Broderick',
    'Justine Bateman',
    'Lisa Bonet'
  ]

  const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]
  const getInitialUser = () => ({ name: getRandom(names), color: getRandom(colors) })

  let currentUser = getInitialUser()
  const defaultContent = `<p>Hi 👋, this is a collaborative document.</p><p>Feel free to edit and collaborate in real-time!</p>`

  const setName = () => {
    const name = (currentUser.name || '').trim().substring(0, 32) // use custom input modal in real implementation
    if (name) currentUser = { ...currentUser, name }
  }

  onMount(() => {
    editor = new Editor({
      element: editorContainer,
      content: defaultContent,
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Highlight,
        TaskList,
        TaskItem,
        CharacterCount.extend().configure({ limit: 10000 }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCaret.configure({ provider })
      ],
      onTransaction: () => {
        /* optional: handle updates */
      }
    })

    // Set initial user info
    editor.chain().focus().updateUser(currentUser).run()

    // Listen for provider status
    const statusHandler = (event) => (status = event.status)
    provider.on('status', statusHandler)

    // When first synced, initialize content if empty
    provider.on('synced', () => {
      if (editor.isEmpty) editor.commands.setContent(defaultContent)
    })

    return () => {
      provider.off('status', statusHandler)
      editor.destroy()
    }
  })
</script>

<div class="column-half">
  <div class="button-group">
    <button
      on:click={() => editor.chain().focus().toggleBold().run()}
      class:active={editor?.isActive('bold')}>Bold</button
    >
    <button
      on:click={() => editor.chain().focus().toggleItalic().run()}
      class:active={editor?.isActive('italic')}>Italic</button
    >
    <button
      on:click={() => editor.chain().focus().toggleStrike().run()}
      class:active={editor?.isActive('strike')}>Strike</button
    >
    <button
      on:click={() => editor.chain().focus().toggleBulletList().run()}
      class:active={editor?.isActive('bulletList')}>Bullet list</button
    >
    <button
      on:click={() => editor.chain().focus().toggleCode().run()}
      class:active={editor?.isActive('code')}>Code</button
    >
  </div>

  <div
    bind:this={editorContainer}
    class="main-group"
    style="border:1px solid #ccc; min-height:300px;"
  ></div>

  <div class="collab-status-group" data-state={status === 'connected' ? 'online' : 'offline'}>
    <label>
      {status === 'connected'
        ? `${editor?.storage.collaborationCaret?.users.length ?? 0} user${editor?.storage.collaborationCaret?.users.length === 1 ? '' : 's'} online in ${room}`
        : 'offline'}
    </label>
    <button style="--color:{currentUser.color}" on:click={setName}>✎ {currentUser.name}</button>
  </div>
</div>

<style>
  .column-half {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .button-group button.is-active {
    font-weight: bold;
  }
  .collab-status-group[data-state='online'] {
    color: green;
  }
  .collab-status-group[data-state='offline'] {
    color: red;
  }
  button {
    cursor: pointer;
  }
</style>
 -->
