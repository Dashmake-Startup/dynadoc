<script lang="ts">
  import { _ } from 'svelte-i18n'
  import { _$_wysiwygEditorsList } from '../../../../../stores/editor.store'
  import { authStore } from '../../../../../stores/auth.store'
  import { onMount } from 'svelte'
  import {
    getDeviceIdSync,
    getOrCreateDeviceId,
    isIdentityOwnerOfDocument
  } from '../../../../../services/identity/identity.service'
  import FormInsertionPane from './FormInsertionPane.svelte'
  import FormResponsesPane from './FormResponsesPane.svelte'
  import type { Group } from '../utils/utils'
  import { GenericFormattingComponentMap } from '../../../../common/actions/formatting'
  import { fluentUIcons } from '../../../../common/icons/Icons'
  import GenericRibbon from '../GenericRibbon.svelte'
  const activeWysiwygEditorStore = _$_wysiwygEditorsList.getActive()

  const isAuthenticated = $derived($authStore?.authenticated)
  const currentUserId = $derived(
    ($authStore?.user?.id ||
      ($authStore as any)?.user?.uuid ||
      ($authStore as any)?.user?.uid ||
      ($authStore as any)?.user?.userId) ??
      null
  )
  let deviceId = $state<string>(getDeviceIdSync() || '')
  onMount(() => {
    if (!deviceId) {
      void getOrCreateDeviceId().then((id) => {
        deviceId = id
      })
    }
  })
  const activeDoc = $derived($activeWysiwygEditorStore?.document || null)
  const ownerIds = $derived((activeDoc?.config?.security?.owners || []).map((v) => String(v)))
  const ownerGroups = $derived((activeDoc?.config?.security?.ownerGroups || []).map((v) => String(v)))
  const ownerPrimary = $derived(activeDoc?.info?.createdBy ? String(activeDoc.info.createdBy) : '')
  const ownerPrimaryTemp = $derived(activeDoc?.info?.createdByTemp ? String(activeDoc.info.createdByTemp) : '')
  const userGroups = $derived(($authStore?.user?.groups || []).map((v) => String(v)))
  const userEmails = $derived(
    [
      $authStore?.user?.email,
      $authStore?.user?.username,
      $authStore?.user?.name,
      $authStore?.user?.displayName
    ]
      .filter(Boolean)
      .map((v) => String(v).trim().toLowerCase())
  )

  const isOwner = $derived.by(() =>
    isIdentityOwnerOfDocument(
      {
        authenticated: Boolean(isAuthenticated),
        userId: currentUserId ? String(currentUserId) : '',
        deviceId,
        userEmails,
        userGroups
      },
      {
        createdBy: ownerPrimary,
        createdByTemp: ownerPrimaryTemp,
        ownerIds,
        ownerGroups
      }
    )
  )

  const groups: Group[] = [
    {
      id: 'survey',
      title: 'Survey',
      items: [
        {
          id: 'survey',
          variant: 'primary',
          body: {
            component: GenericFormattingComponentMap.SurveySelect.component,
            props: {
              ...GenericFormattingComponentMap.SurveySelect.props,
              __icon: `<div class="text-base-content-600 w-[25px] max-w-[max-content]">${fluentUIcons.fluentUIconForm}</div>`
            }
          }
        }
      ]
    },
    {
      id: 'form',
      title: 'Form',
      items: [
        {
          id: 'form',
          variant: 'primary',
          body: {
            component: FormInsertionPane,
            props: {
              layout: 'ribbon',
              allowInsert: isOwner
            }
          }
        }
      ]
    },
    {
      id: 'responses',
      title: 'Responses',
      items: [
        {
          id: 'responses',
          variant: 'secondary',
          body: {
            component: FormResponsesPane,
            props: {}
          }
        }
      ]
    }
  ]

  // onMount removed (unused)
</script>

{#if !isOwner}
  <div class="px-4 py-2 text-[10px] text-[#b88d3c]">
    {$_('Sign in as the document owner to add form fields.')}
  </div>
{/if}

<!-- // ant design https://ant.design useful components in tiptap for advanced form, quizz,survey... -->
<!-- <button
  onclick={() => {
    _wysiwygEditor.commands.insertFormField({
      label: 'text',
      value: '',
      framework: FormComponentFrameWorks.react,
      pack: FormComponentPacks.fluent,
      component: FormComponentNames.Button
    })
  }}
>
  Add textfield
</button>
<button
  onclick={() => {
    _wysiwygEditor.commands.insertFormField({ type: 'label' })
  }}
>
  Add label
</button>
<button
  onclick={() => {
    window.api.exportToPDF(_wysiwygEditor.toPDFHTML())
    // window.api.exportToPDF(_wysiwygEditor.getHTML())
    // _wysiwygEditor.commands.insertFormField()
  }}
>
  Export to PDF
</button> -->

<!-- <FormInsertionPane layout="ribbon"></FormInsertionPane> -->

<GenericRibbon __groups={groups}></GenericRibbon>

<!-- <FormInsertionPane {_wysiwygEditor} layout="ribbon"></FormInsertionPane> -->
<!-- <FormInsertionPane {_wysiwygEditor} layout="pane"></FormInsertionPane> -->
