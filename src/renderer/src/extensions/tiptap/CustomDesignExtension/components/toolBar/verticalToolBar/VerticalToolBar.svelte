<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import {
    ImageEditingTools,
    ImageEditingToolsDrawingShape,
    type ToolGroup
  } from '../../../utils/utils'
  import GenericToolBar from '../GenericToolBar.svelte'
  import {
    GenericFormatingEditorCommands,
    GenericImageEditingComponentMap,

    iconWrap

  } from '../../../../../../components/common/actions/formatting'
  import { _$_canvasCommands } from '../../../../../../stores/canvas.store'
  import type { CanvasCommands } from '../../../../../../commands/canvasCommands.types'
  import {
    _$_documentEditorsList,
    _$_wysiwygEditorsList
  } from '../../../../../../stores/editor.store'
  import Layout from '../../../../../../components/common/layout/layout'
  import { _ as base_, isLoading } from 'svelte-i18n'
  import { ShapeType } from '../../../../../../utils/canvas.utils'
  import { get } from 'svelte/store'
  import { spectrumIcons } from '../../../../../../components/common/icons/Icons'
  const _ = (key: string) => key

  /* const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let _activeEditor = $derived($activeDocumentEditorStore)

  let _activeWysiwyg = $derived(
    _activeEditor ? _$_wysiwygEditorsList.getEntry(_activeEditor.id) : null
  )

  let _activeNodeview = $derived(
    _activeWysiwyg ? _$_wysiwygEditorsList.getActiveNodeview(_activeWysiwyg.id) : null
  ) */

  // --- 2. Derived Editor Logic ---
  const activeDocumentEditorStore = _$_documentEditorsList.getActive()
  let _activeEditor = $derived($activeDocumentEditorStore)

  // let _activeWysiwyg = $derived(
  //   _activeEditor ? _$_wysiwygEditorsList.getEntry(_activeEditor.id) : null
  // )
  let _activeWysiwyg = $derived(
    _activeEditor ? _$_wysiwygEditorsList.getEntryStore(_activeEditor?.id.toString()) : null
    // _activeEditor ? _$_wysiwygEditorsList.getEntry(_activeEditor.id.toString()) : null
  )

  let _activeNodeview = $derived(
    _activeWysiwyg ? _$_wysiwygEditorsList.getActiveNodeviewStore($_activeWysiwyg?.id) : null
  )

  // Handle Command Subscription
  let _canvasCommands = $state<CanvasCommands | null>(null)
  $effect(() => {
    const id = $_activeNodeview?.id
    if (id) {
      const unsubscribe = _$_canvasCommands.subscribeById(id).subscribe((cmds) => {
        _canvasCommands = cmds
      })
      return () => unsubscribe()
    }
  })

  function setTool(tool: ImageEditingTools) {
    _canvasCommands?.setSelectedTool(tool)
  }

  async function insertImage() {
    if (!_canvasCommands) return
    const result = await window.api?.openDialogFile?.()
    if (!result) return
    _canvasCommands.addImage(result, {
      x: 120,
      y: 120,
      w: 400,
      h: 300
    })
    setTool(ImageEditingTools.Move)
  }
  // Simplified list of main editing tools from the left panel
  const tools1 = [
    { icon: 'select', label: 'Move Tool', disabled: true },
    { icon: 'ph-text-b i-carbon-lasso', label: 'Lasso Tool', disabled: false },
    { icon: 'ph-text-b i-carbon-crop', label: 'Crop Tool', disabled: false },
    { icon: 'ph-text-b i-carbon-eyedropper', label: 'Eyedropper Tool', disabled: false },
    { icon: 'ph-text-b i-carbon-paint-bucket', label: 'Paint Bucket', disabled: false },
    { icon: 'ph-text-b i-carbon-brush-freehand', label: 'Brush', disabled: false },
    { icon: 'ph-text-b i-carbon-text-mining', label: 'Text Tool', disabled: false },
    { icon: 'ph-text-b i-carbon-zoom-in', label: 'Zoom', disabled: false }
  ]

  // let canvasCommands: CanvasCommands | null = null

  const _toolGroups: ToolGroup[] = [
    {
      id: 'tools',
      title: 'Tools',
      items: [
        /** Group 1: Selection Tools **/
        {
          id: ImageEditingTools.Move,
          // id: 'move',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Move.component,
            props: {
              ...GenericImageEditingComponentMap.Move.props,
              __onClick: () => {
                // setActiveTool('eraser')
                _canvasCommands?.setSelectedTool(ImageEditingTools.Move)
                // GenericFormatingEditorCommands.drawDesignItemRectangle()
              },
              __isActiveFunc: () => {
                return _canvasCommands?.getSelectedTool() === ImageEditingTools.Move
              }
            }
          }
        },
        {
          id: 'marquee',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Marquee.component,
            props: {
              ...GenericImageEditingComponentMap.Marquee.props,
              __onClick: () => setTool(ImageEditingTools.Marquee),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Marquee
              // // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.marquee}</div>`
            }
          }
        },
        {
          id: 'lasso',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Lasso.component,
            props: {
              ...GenericImageEditingComponentMap.Lasso.props,
              __onClick: () => setTool(ImageEditingTools.Lasso),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Lasso
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.lasso}</div>`
            }
          }
        },
        {
          id: 'magicWand',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.MagicWand.component,
            props: {
              ...GenericImageEditingComponentMap.MagicWand.props,
              __onClick: () => setTool(ImageEditingTools.MagicWand),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.MagicWand
              // // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.magicWand}</div>`
            }
          }
        },

        /** Group 2: Crop & Measurement **/
        {
          id: 'crop',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Crop.component,
            props: {
              ...GenericImageEditingComponentMap.Crop.props,
              __onClick: () => setTool(ImageEditingTools.Crop),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Crop
              // // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.crop}</div>`
            }
          }
        },
        {
          id: 'eyedropper',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Eyedropper.component,
            props: {
              ...GenericImageEditingComponentMap.Eyedropper.props,
              __onClick: () => setTool(ImageEditingTools.Eyedropper),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Eyedropper
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.eyedropper}</div>`
            }
          }
        },

        /** Group 3: Retouching & Painting **/
        {
          id: 'healing',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Healing.component,
            props: {
              ...GenericImageEditingComponentMap.Healing.props,
              __onClick: () => setTool(ImageEditingTools.Healing),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Healing
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.healing}</div>`
            }
          }
        },
        {
          id: 'brush',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Brush.component,
            props: {
              ...GenericImageEditingComponentMap.Brush.props,
              __onClick: () => setTool(ImageEditingTools.Brush),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Brush
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.brush}</div>`
            }
          }
        },
        {
          id: 'stamp',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Stamp.component,
            props: {
              ...GenericImageEditingComponentMap.Stamp.props,
              __onClick: () => setTool(ImageEditingTools.Stamp),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Stamp
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.stamp}</div>`
            }
          }
        },
        {
          id: 'eraser',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Eraser.component,
            props: {
              ...GenericImageEditingComponentMap.Eraser.props,
              __onClick: () => setTool(ImageEditingTools.Eraser),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Eraser
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.eraser}</div>`
            }
          }
        },
        {
          id: 'gradient',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Gradient.component,
            props: {
              ...GenericImageEditingComponentMap.Gradient.props,
              __onClick: () => setTool(ImageEditingTools.Gradient),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Gradient
            }
          }
        },
        {
          id: 'blur',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Blur.component,
            props: {
              ...GenericImageEditingComponentMap.Blur.props,
              __onClick: () => setTool(ImageEditingTools.Blur),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Blur
            }
          }
        },
        {
          id: 'dodge',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Dodge.component,
            props: {
              ...GenericImageEditingComponentMap.Dodge.props,
              __onClick: () => setTool(ImageEditingTools.Dodge),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Dodge
            }
          }
        },

        /** Group 4: Drawing & Type (Vector) **/

        {
          id: 'pen',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Pen.component,
            props: {
              ...GenericImageEditingComponentMap.Pen.props,
              __onClick: () => setTool(ImageEditingTools.Pen),
              __isActiveFunc: () => _canvasCommands?.getSelectedTool() === ImageEditingTools.Pen
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.pen}</div>`
            }
          }
        },
        {
          id: 'type',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Type.component,
            props: {
              ...GenericImageEditingComponentMap.Type.props,
              __onClick: () => setTool(ImageEditingTools.Type),
              __isActiveFunc: () => _canvasCommands?.getSelectedTool() === ImageEditingTools.Type
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.type}</div>`
            }
          }
        },
        {
          id: 'image',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Image.component,
            props: {
              ...GenericImageEditingComponentMap.Image.props,
              __onClick: insertImage,
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Image
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.type}</div>`
            }
          }
        },
        {
          id: 'select',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Select.component,
            props: {
              ...GenericImageEditingComponentMap.Select.props,
              __onClick: () => setTool(ImageEditingTools.Select),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.Select
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.type}</div>`
            }
          }
        },
        {
          id: 'rectangle',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Rectangle.component,
            props: {
              ...GenericImageEditingComponentMap.Rectangle.props,
              __onClick: () => {
                // setActiveTool('eraser')
                _canvasCommands?.setSelectedTool(ImageEditingTools.Rectangle)
                GenericFormatingEditorCommands.drawDesignItemShape(ShapeType.Rect)
                // GenericFormatingEditorCommands.drawDesignItemRectangle()
              },
              __isActiveFunc: () => {
                return _canvasCommands?.getSelectedTool() === ImageEditingTools.Rectangle
              },
              __layout: Layout.LAYOUT.SELECT,
              __label: null,
              __selectDataProps: {
                __items: [
                  {
                    __label: _('Circle'),
                    __icon: iconWrap(spectrumIcons.rectangleTool),
                    __onClick: () => {
                      _canvasCommands?.setSelectedTool(ImageEditingTools.Circle)
                      GenericFormatingEditorCommands.drawDesignItemShape(ShapeType.Circle)
                    }
                  },
                  {
                    __label: _('Ellipse'),
                    __icon: iconWrap(spectrumIcons.rectangleTool),
                    __onClick: () => {
                      _canvasCommands?.setSelectedTool(ImageEditingTools.Ellipse)
                      GenericFormatingEditorCommands.drawDesignItemShape(ShapeType.Ellipse)
                    }
                  },
                  {
                    __label: _('Triangle'),
                    __icon: iconWrap(spectrumIcons.rectangleTool),
                    __onClick: () => {
                      _canvasCommands?.setSelectedTool(ImageEditingTools.Triangle)
                      GenericFormatingEditorCommands.drawDesignItemShape(ShapeType.Triangle)
                    }
                  }
                  // { type: '__separator' },
                  /* {
            __label: _("Options d'interligne"),
            __icon: 'i-carbon-settings',
            shortcut: 'Alt+Shift+O',
            //__onClick: () => openOptions()
          }, */
                ]
              }
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.pen}</div>`
            }
          }
        },

        /** Group 5: Navigation **/
        {
          id: 'hand',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Hand.component,
            props: {
              ...GenericImageEditingComponentMap.Hand.props,
              __onClick: () => setTool(ImageEditingTools.Hand),
              __isActiveFunc: () => _canvasCommands?.getSelectedTool() === ImageEditingTools.Hand
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.hand}</div>`
            }
          }
        },
        {
          id: 'zoom',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.Zoom.component,
            props: {
              ...GenericImageEditingComponentMap.Zoom.props,
              __onClick: () => setTool(ImageEditingTools.Zoom),
              __isActiveFunc: () => _canvasCommands?.getSelectedTool() === ImageEditingTools.Zoom
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.zoom}</div>`
            }
          }
        },
        {
          id: 'color-switcher',
          variant: 'primary',
          body: {
            component: GenericImageEditingComponentMap.ColorSwitcher.component,
            props: {
              ...GenericImageEditingComponentMap.ColorSwitcher.props,
              __onClick: () => setTool(ImageEditingTools.ColorSwitcher),
              __isActiveFunc: () =>
                _canvasCommands?.getSelectedTool() === ImageEditingTools.ColorSwitcher
              // __icon: `<div class="text-base-content w-[20px] max-w-[max-content]">${spectrumIcons.zoom}</div>`
            }
          }
        }
      ]
    }
  ]

  let unsubscribe: () => void

  onMount(() => {
    /*  _$_wysiwygEditorsList.getActiveNodeview(
        __wysiwygEditorIdToUpdate,
        // _$_wysiwygEditorsList.getActiveEntry().id
        __canvaId
      ) */
    /* unsubscribe = _$_canvasCommands.subscribeById('id1').subscribe((value) => {
      // unsubscribe = _$_canvasCommands.subscribeById(node.attrs.id).subscribe((value) => {
      // unsubscribe = _$_canvasCommands.subscribe((value) => {
      // canvasCommands = value.get(node.attrs.id)
      canvasCommands = value
    }) */
  })

  onDestroy(() => {
    unsubscribe?.()
  })
</script>

<GenericToolBar __toolGroups={_toolGroups}></GenericToolBar>

<!-- </div> -->
<style>
  /* Styling the Web Component */
  iconify-icon {
    font-size: 18px; /* Control icon size via font-size */
  }
</style>
