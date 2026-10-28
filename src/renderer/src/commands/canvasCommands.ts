import * as Y from 'yjs'
import { ShapeType, type Shape } from '../utils/canvas.types'
import { CustomFileExtensionProps } from '../extensions/tiptap/CustomFileFolderExtension/utils/common.utils'
import { v4 as uuidv4 } from 'uuid'
import { cryptoRandomUUID } from '../utils/common.utils'


import { _ as base_, isLoading } from 'svelte-i18n'
import { get, writable } from 'svelte/store'
import { CustomSlideExtensionProps } from '../extensions/tiptap/CustomSlideExtension/utils/common.utils'
import { createDragInteract } from '../utils/canvasInteraction'
import { ImageEditingToolCursorMap, ImageEditingTools } from '../extensions/tiptap/CustomDesignExtension/utils/utils'
const t = (key: string) => get(base_)(key)

import type { CanvasCommands, SelectionMode } from './canvasCommands.types'

export function createCanvasCommands(
    shapes: Y.Map<Shape>,
    texts: Y.Map<Y.XmlFragment>,
    canvasMeta: Y.Map<any>
): CanvasCommands {

    let selectedTool: ImageEditingTools = null
    const selectedToolStore = writable<ImageEditingTools | null>(null);
    const selectedIds = new Set<string>()
    const uuid = () => uuidv4()
    // const uuid = () => cryptoRandomUUID()

    /* ----------------------------------
     * Selection API
     * ---------------------------------- */


    function updateSelection(
        ids: string[],
        mode: SelectionMode = 'replace'
    ) {
        // console.log('sync _layers updateSelection', { ids, mode, shapes })
        const idSet = new Set(ids)
        // console.log('sync _layers updateSelection', { idSet })

        shapes.forEach((shape, id) => {
            console.log('sync _layers updateSelection', { idSet })

            if (!shape.visible) {
                if (shape.selected) {
                    shapes.set(id, { ...shape, selected: false })
                }
                return
            }

            let nextSelected = shape.selected

            if (mode === 'replace') {
                nextSelected = idSet.has(id)
            } else if (mode === 'add') {
                nextSelected = shape.selected || idSet.has(id)
            } else if (mode === 'toggle') {
                nextSelected = idSet.has(id) ? !shape.selected : shape.selected
            }
            console.log('sync _layers updateSelection', { id, nextSelected, shape })


            if (nextSelected !== shape.selected) {
                //
                shapes.set(id, { ...shape, selected: nextSelected })
            }
        })
    }

    function clearSelection() {
        shapes.forEach((shape, id) => {
            if (shape.selected) {
                shapes.set(id, { ...shape, selected: false })
            }
        })
    }

    function getSelectedIds(): string[] {
        const ids: string[] = []
        shapes.forEach(shape => {
            if (shape.selected && shape.visible) {
                ids.push(shape.id)
            }
        })
        return ids
    }

    function getSelectedShapes(): Shape[] {
        return getSelectedIds()
            .map((id) => shapes.get(id))
            .filter(Boolean) as Shape[]
    }

    function getShape(id: string): Shape | undefined {
        return shapes.get(id)
    }



    function clearSelection2() {
        console.log('command clearSelection', { selectedIds })

        selectedIds.clear()
    }

    function selectOnly(id: string) {
        console.log('command selectOnly', { id, selectedIds })

        selectedIds.clear()
        selectedIds.add(id)
    }

    function toggleSelect(id: string) {
        console.log('command toggleSelect', { id, selectedIds })

        selectedIds.has(id)
            ? selectedIds.delete(id)
            : selectedIds.add(id)
    }

    function getSelectedTool(): ImageEditingTools {
        return get(selectedToolStore);
        // return selectedTool
    }

    function getSelectedToolCursor(selectedTool?: ImageEditingTools): string {
        return ImageEditingToolCursorMap[selectedTool] ?? 'default'
    }

    function setSelectedTool(tool: ImageEditingTools) {
        selectedToolStore.set(tool);
        selectedTool = tool
    }
    function getSelectedIds2() {
        console.log('command getSelectedIds', { "i": Array.from(selectedIds) })

        return Array.from(selectedIds)
    }

    function selectById(
        id: string,
        options?: { mode?: SelectionMode }
    ) {
        console.log('sync _layers selectById', { id, options })

        updateSelection([id], options?.mode ?? 'replace')
    }

    function selectMany(
        ids: string[],
        options?: { mode?: SelectionMode }
    ) {
        updateSelection(ids, options?.mode ?? 'replace')
    }

    function deleteSelected() {
        getSelectedIds().forEach(id => {
            shapes.delete(id)
            texts.delete(id)
        })
    }

    function unselect(id?: string) {
        if (!id) {
            clearSelection()
            return
        }

        const shape = shapes.get(id)
        if (shape?.selected) {
            shapes.set(id, { ...shape, selected: false })
        }
    }
    function setVisibility(id: string, visible: boolean) {
        const shape = shapes.get(id)
        if (!shape) return

        shapes.set(id, {
            ...shape,
            visible,
            selected: visible ? shape.selected : false
        })
    }

    function alignSelected(mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
        const ids = getSelectedIds()
        if (!ids.length) return
        const selectedShapes = ids
            .map((id) => shapes.get(id))
            .filter(Boolean) as Shape[]
        if (!selectedShapes.length) return

        const bounds = selectedShapes.reduce(
            (acc, shape) => {
                const x1 = shape.x ?? 0
                const y1 = shape.y ?? 0
                const x2 = (shape.x ?? 0) + (shape.w ?? 0)
                const y2 = (shape.y ?? 0) + (shape.h ?? 0)
                return {
                    minX: Math.min(acc.minX, x1),
                    minY: Math.min(acc.minY, y1),
                    maxX: Math.max(acc.maxX, x2),
                    maxY: Math.max(acc.maxY, y2)
                }
            },
            { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: 0, maxY: 0 }
        )

        selectedShapes.forEach((shape) => {
            const next = { ...shape }
            if (mode === 'left') {
                next.x = bounds.minX
            } else if (mode === 'center') {
                next.x = bounds.minX + (bounds.maxX - bounds.minX - (shape.w ?? 0)) / 2
            } else if (mode === 'right') {
                next.x = bounds.maxX - (shape.w ?? 0)
            } else if (mode === 'top') {
                next.y = bounds.minY
            } else if (mode === 'middle') {
                next.y = bounds.minY + (bounds.maxY - bounds.minY - (shape.h ?? 0)) / 2
            } else if (mode === 'bottom') {
                next.y = bounds.maxY - (shape.h ?? 0)
            }

            shapes.set(shape.id, next)
        })
    }

    function toggleVisibility(id: string) {
        const shape = shapes.get(id)
        if (!shape) return
        setVisibility(id, !shape.visible)
    }

    const AUTO_RESIZE_KEY = 'autoResizeText'

    function isAutoResizeEnabled(): boolean {
        return Boolean(canvasMeta.get(AUTO_RESIZE_KEY))
    }

    function setAutoResizeEnabled(enabled: boolean): void {
        canvasMeta.set(AUTO_RESIZE_KEY, Boolean(enabled))
    }

    function toggleAutoResizeEnabled(): void {
        setAutoResizeEnabled(!isAutoResizeEnabled())
    }

    function cloneFragment(source: Y.XmlFragment): Y.XmlFragment {
        const fragment = new Y.XmlFragment()
        const clones = source?.toArray?.().map((node: any) => node.clone?.() ?? node) ?? []
        if (clones.length) {
            fragment.insert(0, clones)
        }
        return fragment
    }

    function duplicateShape(id: string, options?: { offsetX?: number; offsetY?: number }): string | null {
        const shape = shapes.get(id)
        if (!shape) return null

        const newId = uuid()
        const offsetX = options?.offsetX ?? 20
        const offsetY = options?.offsetY ?? 20
        const nextShape: Shape = {
            ...shape,
            id: newId,
            x: (shape.x ?? 0) + offsetX,
            y: (shape.y ?? 0) + offsetY,
            z: shapes.size,
            selected: true
        }
        shapes.set(newId, nextShape)

        const text = texts.get(id)
        if (text instanceof Y.XmlFragment) {
            texts.set(newId, cloneFragment(text))
        } else {
            texts.set(newId, new Y.XmlFragment())
        }

        clearSelection()
        selectOnly(newId)
        return newId
    }

    function rotatePoint(point: { x: number; y: number }, pivot: { x: number; y: number }, angleRad: number) {
        const sin = Math.sin(angleRad)
        const cos = Math.cos(angleRad)
        const dx = point.x - pivot.x
        const dy = point.y - pivot.y
        return {
            x: pivot.x + dx * cos - dy * sin,
            y: pivot.y + dx * sin + dy * cos
        }
    }

    function rotateSelected(deltaDegrees: number, pivot?: { x: number; y: number }): void {
        if (!deltaDegrees) return
        const ids = getSelectedIds()
        if (ids.length === 0) return
        const angleRad = (deltaDegrees * Math.PI) / 180

        let pivotPoint = pivot
        if (!pivotPoint) {
            const centers = ids
                .map((id) => shapes.get(id))
                .filter(Boolean)
                .map((shape) => ({
                    x: (shape.x ?? 0) + (shape.w ?? 0) / 2,
                    y: (shape.y ?? 0) + (shape.h ?? 0) / 2
                }))
            const avg = centers.reduce(
                (acc, cur) => ({ x: acc.x + cur.x, y: acc.y + cur.y }),
                { x: 0, y: 0 }
            )
            pivotPoint = {
                x: avg.x / centers.length,
                y: avg.y / centers.length
            }
        }

        ids.forEach((id) => {
            const shape = shapes.get(id)
            if (!shape) return
            const center = {
                x: (shape.x ?? 0) + (shape.w ?? 0) / 2,
                y: (shape.y ?? 0) + (shape.h ?? 0) / 2
            }
            const rotated = rotatePoint(center, pivotPoint!, angleRad)
            const nextRotation = (shape.rotation ?? 0) + deltaDegrees
            shapes.set(id, {
                ...shape,
                rotation: nextRotation,
                x: rotated.x - (shape.w ?? 0) / 2,
                y: rotated.y - (shape.h ?? 0) / 2
            })
        })
    }



    /* ----------------------------------
     * Shape creation
     * ---------------------------------- */

    function addText(props?: Shape) {
        console.log("Move click yes addText", {})

        const id = uuid()

        const defaultProps: Shape = {
            id: id,
            name: t('Text'),
            type: ShapeType.Text,
            // type: ShapeType.Text,
            x: 100,
            y: 100,
            w: 320,
            h: 120,
            z: shapes.size,
            content: {
                type: 'content',
                value: '',
                placeholder: 'Start typing...'
            },
            visible: true,
            selected: true,
        }

        const finalShape = { ...defaultProps, ...props }
        shapes.set(id, finalShape)

        const fragment = new Y.XmlFragment()
        texts.set(id, fragment)
        const storedFragment = texts.get(id)
        if (storedFragment?.doc) {
            initContentFragment(storedFragment, finalShape.content?.type)
        }

        selectOnly(id)
    }

    function addFile
        /* (
            src: string,
            options?: {
                alt?: string
                title?: string
            }
        ) { */
        (src: string, props?: Shape) {
        // const id = getSelectedIds()[0]
        // if (!id) return
        const id = uuid()



        const defaultProps: Shape = {
            id: id,
            name: t('File'),
            type: ShapeType.File,
            x: 100,
            y: 100,
            w: 320,
            h: 120,
            z: shapes.size,
            // props,
        }

        const finalShape = { ...defaultProps, ...props }
        shapes.set(id, finalShape)

        const fragment = new Y.XmlFragment()

        texts.set(id, fragment)
        console.log("addImage finalShape ", { src, props, texts, shapes })

        // 2️⃣ Create image with specific Tiptap structure
        // Tiptap's Image extension defaults to { inline: false } (a block node)
        // If it's a block node, it should be a direct child of 'fragment', not 'paragraph'.
        const file = new Y.XmlElement(CustomFileExtensionProps.name);
        // const image = new Y.XmlElement(CustomImageExtensionProps.name);

        file.setAttribute(CustomFileExtensionProps.attributeSrc, src);
        // image.setAttribute('src', src);
        // if (alt) image.setAttribute('alt', alt);

        // Insert it directly into the fragment (the 'doc' level)
        fragment.insert(0, [file]);


        console.log("addImage fragment ", { src, props, file })

        selectOnly(id)

    }/* 
    function addFile
        (src: string, props?: Shape) {
        // const id = getSelectedIds()[0]
        // if (!id) return
        const id = uuid()

        const fileExtension =  // get extension from src

        if (Object.values(Utils.IMAGE_EXTENSIONS).includes(fileExtension)){
            fileType =  FILE_TYPES[fileExtension]
        }

        const defaultProps: Shape = {
            type: fileType,
            x: 100,
            y: 100,
            w: 320,
            h: 120,
            z: shapes.size,
            // props,
        }

        const finalShape = { ...defaultProps, ...props }
        shapes.set(id, finalShape)

        const fragment = new Y.XmlFragment()

        texts.set(id, fragment)
        console.log("addImage finalShape ", { src, props, texts, shapes })

        // 2️⃣ Create image with specific Tiptap structure
        // Tiptap's Image extension defaults to { inline: false } (a block node)
        // If it's a block node, it should be a direct child of 'fragment', not 'paragraph'.
        const file = new Y.XmlElement(GenericCustomExtensionProps[fileType].name);
        // const image = new Y.XmlElement(CustomImageExtensionProps.name);

        file.setAttribute('src', src);
        // image.setAttribute('src', src);
        // if (alt) image.setAttribute('alt', alt);

        // Insert it directly into the fragment (the 'doc' level)
        fragment.insert(0, [file]);


        // console.log("addImage fragment ", { src, props, image })

        selectOnly(id)

    } */
    function addShape(type: ShapeType, props?: Partial<Shape>): string {
        const id = props?.id || uuid();

        // Default configuration based on shape type
        const typeDefaults: Record<ShapeType, Partial<Shape>> = {
            [ShapeType.Rect]: { name: t('Rectangle'), w: 200, h: 120 },
            [ShapeType.Ellipse]: { name: t('Ellipse'), w: 150, h: 150 },
            [ShapeType.Circle]: { name: t('Circle'), w: 100, h: 100 },
            [ShapeType.Triangle]: { name: t('Triangle'), w: 0, h: 0 },
            [ShapeType.Text]: { name: t('Text'), w: 0, h: 0 },
            [ShapeType.File]: { name: t('File'), w: 100, h: 100 },
            // Add more  types here...
        };

        const defaultProps: Shape = {
            id,
            type,
            name: props?.name ?? typeDefaults[type]?.name ?? t('Shape'),
            x: props?.x ?? 0,
            y: props?.y ?? 0,
            w: props?.w ?? typeDefaults[type]?.w ?? 100,
            h: props?.h ?? typeDefaults[type]?.h ?? 100,
            z: shapes.size,
            visible: true,
            selected: true,
            ...props
        };

        shapes.set(id, defaultProps);
        selectById(id);
        return id;
    }

    function drawShape(type: ShapeType): {
        onStart: (x: number, y: number) => void;
        onMove: (currentX: number, currentY: number) => void;
        onEnd: () => void;
    } {
        if (!type) return
        // We pass 'this' and the 'type' to the interactor
        // The interactor will internally call addShape(type, ...)
        return createDragInteract(this, type);
    }


    /*  function drawRectangle(): {
     // function drawRectangle(to: "slide" | "design"): {
         onStart: (x: number, y: number) => void;
         onMove: (currentX: number, currentY: number) => void;
         onEnd: () => void;
     } {
         // selectedTool = ImageEditingTools.Rectangle
         return createDragInteract(this)
     }
 
     function addRectangle(props?: Partial<Shape>): string {
         const id = props?.id || uuid(); // Allow passing an ID for the "Ghost" shape
 
         const defaultProps: Shape = {
             id,
             name: props?.name ?? t('Rectangle'),
             type: ShapeType.Rect,
             x: props?.x ?? 150,
             y: props?.y ?? 150,
             w: props?.w ?? 200,
             h: props?.h ?? 120,
             // fill: '#e5e7eb',
             z: shapes.size,
             visible: true,
             selected: true,
             ...props
         };
 
         shapes.set(id, defaultProps);
         selectById(id);
         return id; // Return ID so the UI knows which shape to update during drag
     } */

    function addRectangle2(props?: Shape) {
        const id = uuid()

        shapes.set(id, {
            type: ShapeType.Rect,
            x: 150,
            y: 150,
            w: 200,
            h: 120,
            // fill: '#e5e7eb',
            z: shapes.size,
            ...props
        })

        selectOnly(id)
    }



    function isFragmentEffectivelyEmpty(fragment: Y.XmlFragment): boolean {
        if (!fragment?.doc) return true
        if (fragment.length === 0) return true

        const nodes = fragment.toArray()
        return nodes.every(node => {
            if (node instanceof Y.XmlElement) {
                return node.length === 0
            }
            return false
        })
    }


    function initTitle(fragment: Y.XmlFragment) {
        if (!isFragmentEffectivelyEmpty(fragment)) return

        const heading = new Y.XmlElement('heading')
        heading.setAttribute('level', '1')

        const text = new Y.XmlText()
        heading.insert(0, [text])

        fragment.insert(0, [heading])
    }

    function initParagraph(fragment: Y.XmlFragment) {
        if (!isFragmentEffectivelyEmpty(fragment)) return

        const p = new Y.XmlElement('paragraph')
        p.insert(0, [new Y.XmlText()])

        fragment.insert(0, [p])
    }

    function initBulletList(fragment: Y.XmlFragment) {
        if (!isFragmentEffectivelyEmpty(fragment)) return

        const list = new Y.XmlElement('bulletList')
        const listItem = new Y.XmlElement('listItem')
        const p = new Y.XmlElement('paragraph')
        p.insert(0, [new Y.XmlText()])
        listItem.insert(0, [p])
        list.insert(0, [listItem])
        fragment.insert(0, [list])
    }

    function initContentFragment(fragment: Y.XmlFragment, contentType?: string) {
        if (contentType === 'title') {
            initTitle(fragment)
            return
        }
        if (contentType === 'content') {
            initBulletList(fragment)
            return
        }
        initParagraph(fragment)
    }

    /* ----------------------------------
     * Commands
     * ---------------------------------- */

    return {
        /* Selection */

        /* select(id: string, options?: { toggle?: boolean }) {
            options?.toggle ? toggleSelect(id) : selectOnly(id)
        },

        unselect(id?: string) {
            id ? selectedIds.delete(id) : clearSelection()
        },

        getSelectedIds, */

        getSelectedToolCursor,
        getSelectedTool,
        setSelectedTool,
        selectedToolStore,
        // drawRectangle,
        drawShape,
        addShape,
        /* Selection */
        // select: selectById,
        select(id: string, options?: { mode?: SelectionMode }) {
            console.log('sync _layers select', { id, options })
            selectById(id, options)
        },
        selectMany,
        unselect,
        clearSelection,
        getSelectedIds,
        getSelectedShapes,
        getShape,

        /* Visibility */
        setVisibility,
        toggleVisibility,
        duplicateShape,
        rotateSelected,
        alignSelected,
        setAutoResizeEnabled,
        isAutoResizeEnabled,
        toggleAutoResizeEnabled,

        /* Editing */

        deleteSelected,
        bringForward() {
            getSelectedIds().forEach(id => reorder(shapes, id, +1))
        },
        sendBackward() {
            getSelectedIds().forEach(id => reorder(shapes, id, -1))
        },
        /* updateShape(id: string, props: Partial<Shape>) {
            const shape = shapes.get(id)
            if (!shape) return
            shapes.set(id, { ...shape, ...props })
        }, */

        /* deleteSelected() {
            for (const id of selectedIds) {
                shapes.delete(id)
                texts.delete(id)
            }
            clearSelection()
        },

        bringForward() {
            for (const id of selectedIds) {
                reorder(shapes, id, +1)
            }
        },

        sendBackward() {
            for (const id of selectedIds) {
                reorder(shapes, id, -1)
            }
        }, */

        updateShape(id: string, props: Partial<Shape>) {
            const shape = shapes.get(id)
            if (!shape) return
            shapes.set(id, { ...shape, ...props })
        },

        setBackground(color: string) {
            canvasMeta.set('background', color)
        },

        addText,
        // addRectangle,
        addImage(src: string, props?: Shape) {
            addFile(src, props)
        },
        addVideo(src: string, props?: Shape) {
            addFile(src, props)
        },
        addFile,

        createDefaultCanvasContent(stageW: number, stageH: number) {
            console.log('onCanvasNewlyCreated createDefaultCanvasContent', { stageW, stageH })
            const marginX = stageW * 0.1; // 10% side margins
            const width = stageW * 0.8;   // 80% width
            const id = uuid()
            console.log('onCanvasNewlyCreated createDefaultCanvasContent add tittle', { stageW, stageH },{
                id: id,
                name: t('Text'),
                type: ShapeType.Text,
                content: {
                    type: 'title',
                    value: '',
                    placeholder: 'Click to add title'
                },
                x: marginX,
                y: stageH * 0.1, // 10% from top
                w: width,
                h: stageH * 0.2, // 20% height
                z: shapes.size,
                fontSize: Math.floor(stageH * 0.08), // Scale font to stage
                align: 'center'
            })

            // 1. Add Title Shape
            addText({
                id: id,
                name: t('Text'),
                type: ShapeType.Text,
                content: {
                    type: 'title',
                    value: '',
                    placeholder: 'Click to add title'
                },
                x: marginX,
                y: stageH * 0.1, // 10% from top
                w: width,
                h: stageH * 0.2, // 20% height
                z: shapes.size,
                fontSize: Math.floor(stageH * 0.08), // Scale font to stage
                align: 'center'
            });

            // 2. Add Content Shape
            addText({
                id: id,
                name: t('Text'),
                type: ShapeType.Text,
                content: {
                    type: 'content',
                    value: '',
                    placeholder: 'Click to add text'
                },
                x: marginX,
                y: stageH * 0.35, // Below title with gap
                w: width,
                h: stageH * 0.5,  // 50% height
                z: shapes.size,
                fontSize: Math.floor(stageH * 0.04)
            });
        },
    }
}


/* export function createCanvasCommands1(
    shapes: Y.Map<Shape>,
    texts: Y.Map<Y.XmlFragment>,
    canvasMeta: Y.Map<any>
): CanvasCommands {
    let selectedId: string | null = null
    // const selectedIds = new Set<string>()


    const uuid = () => cryptoRandomUUID()

    // ----------------------------------
    // Local helpers (in scope everywhere)
    // ----------------------------------

    function addText(props?: Shape) {
        const id = uuid()

        /* shapes.set(id, props || {
            type: ShapeType.Text,
            x: 100,
            y: 100,
            w: 320,
            h: 120,
            z: shapes.size
        })

        texts.set(id, new Y.XmlFragment())
        selectedId = id +/



        // Default fallback if no props are passed
        const defaultProps: Shape = {
            type: ShapeType.Text,
            x: 100,
            y: 100,
            w: 320,
            h: 120,
            z: shapes.size,
            content: {
                type: 'content',
                value: '',
                placeholder: 'Start typing...'
            }
        };

        // Merge provided props with defaults
        const finalShape = { ...defaultProps, ...props };

        shapes.set(id, finalShape);

        // Initialize the Yjs Fragment for this specific shape
        const fragment = new Y.XmlFragment();

        if (finalShape.content?.type === 'title') {
            initTitle(fragment)
        } else {
            initParagraph(fragment)
        }

        texts.set(id, fragment);

        selectedId = id;
    }

    function addRectangle(props?: Shape) {
        const id = uuid()

        shapes.set(id, props || {
            type: ShapeType.Rect,
            x: 150,
            y: 150,
            w: 200,
            h: 120,
            fill: '#e5e7eb',
            z: shapes.size
        })

        selectedId = id
    }

    function isFragmentEffectivelyEmpty(fragment: Y.XmlFragment): boolean {
        if (fragment.length === 0) return true

        const nodes = fragment.toArray()
        return nodes.every(node => {
            if (node instanceof Y.XmlElement) {
                return node.length === 0
            }
            return false
        })
    }


    function initTitle(fragment: Y.XmlFragment) {
        if (!isFragmentEffectivelyEmpty(fragment)) return

        const heading = new Y.XmlElement('heading')
        heading.setAttribute('level', '1')

        const text = new Y.XmlText()
        heading.insert(0, [text])

        fragment.insert(0, [heading])
    }

    function initParagraph(fragment: Y.XmlFragment) {
        if (!isFragmentEffectivelyEmpty(fragment)) return

        const p = new Y.XmlElement('paragraph')
        p.insert(0, [new Y.XmlText()])

        fragment.insert(0, [p])
    }



    return {
        select(id) {

            selectedId = id
            console.log('command select', { id, selectedId })
        },
        unselect(id?: string) {

            selectedId = null
            console.log('command unselect', { id, selectedId })
        },

        createDefaultCanvasContent(stageW: number, stageH: number) {
            console.log('onCanvasNewlyCreated createDefaultCanvasContent', { stageW, stageH })
            const marginX = stageW * 0.1; // 10% side margins
            const width = stageW * 0.8;   // 80% width

            // 1. Add Title Shape
            addText({
                type: ShapeType.Text,
                content: {
                    type: 'title',
                    value: '',
                    placeholder: 'Click to add title'
                },
                x: marginX,
                y: stageH * 0.1, // 10% from top
                w: width,
                h: stageH * 0.2, // 20% height
                z: shapes.size,
                fontSize: Math.floor(stageH * 0.08), // Scale font to stage
                align: 'center'
            });

            // 2. Add Content Shape
            addText({
                type: ShapeType.Text,
                content: {
                    type: 'content',
                    value: '',
                    placeholder: 'Click to add text'
                },
                x: marginX,
                y: stageH * 0.35, // Below title with gap
                w: width,
                h: stageH * 0.5,  // 50% height
                z: shapes.size,
                fontSize: Math.floor(stageH * 0.04)
            });
        },
        addText,
        addRectangle,

        /* addText(props?: Shape) {
            const id = uuid()
            shapes.set(id, props || {
                type: ShapeType.Text,
                x: 100,
                y: 100,
                w: 320,
                h: 120,
                z: shapes.size
            })

            // const frag = new Y.XmlFragment()
            // const text = new Y.XmlText()
            // text.insert(0, 'Text')
            // frag.insert(0, [text])
            // texts.set(id, frag)
            texts.set(id, new Y.XmlFragment())
            selectedId = id
        },

        addRectangle(props?: Shape) {
            const id = uuid()
            shapes.set(id, props || {
                type: ShapeType.Rect,
                x: 150,
                y: 150,
                w: 200,
                h: 120,
                fill: '#e5e7eb',
                z: shapes.size
            })
            selectedId = id
        }, +/

        deleteSelected() {
            console.log('command deleteSelected', { selectedId, shapes, texts })

            if (!selectedId) return
            shapes.delete(selectedId)
            texts.delete(selectedId)
            selectedId = null
            console.log('command deleteSelected shapes', { shapes, texts })

        },

        bringForward() {
            if (!selectedId) return
            reorder(shapes, selectedId, +1)
        },

        sendBackward() {
            if (!selectedId) return
            reorder(shapes, selectedId, -1)
        },

        setBackground(color) {
            canvasMeta.set('background', color)
        },

        updateShape(id: string, props: any) {
            //  updateShape(id: string, props: Partial<Omit<any, 'id' | 'yText' | 'type'>>) {
            const shape = shapes.get(id)
            if (!shape) return
            shapes.set(id, { ...shape, ...props })
        }
    }
    }
 */

function reorder(
    shapes: Y.Map<any>,
    id: string,
    delta: number
) {
    const ordered = Array.from(shapes.entries())
        .sort((a, b) => a[1].z - b[1].z)

    const index = ordered.findIndex(([k]) => k === id)
    if (index === -1) return

    const target = ordered[index + delta]
    if (!target) return

    const [idA, a] = ordered[index]
    const [idB, b] = target

    shapes.set(idA, { ...a, z: b.z })
    shapes.set(idB, { ...b, z: a.z })
}
