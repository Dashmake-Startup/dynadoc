// utils.js
// Node environment API (from Electron preload)
// const nodeApi.fs = window.api.node.nodeApi.fs
// const nodeApi.path = window.api.node.nodeApi.path

// const nodeApi.fs = window.node?.nodeApi.fs
// const nodeApi.path = window.node?.nodeApi.path

// const nodeApi.fs = window.node?.nodeApi.fs
// const nodeApi.path = window.node?.nodeApi.path

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs
// const path = nodeApi?.path

import type { Editor } from '@tiptap/core';
import type Konva from 'konva';
import { get } from 'svelte/store';
import * as Y from 'yjs'

import { _ as base_, isLoading } from 'svelte-i18n'
const t = (key: string) => get(base_)(key)

import { _$_documentEditorsList } from '../../../../stores/editor.store';
import type { Shape } from '../../../../utils/canvas.utils';
import type SlideDeck from '../components/SlideDeck.svelte';
// import { nodeApi } from '../../../../utils/shims/node'
// import Utils from '../../../../utils/Utils';
// import { DocumentModel } from '../../../../models/Document';

export const CustomSlideExtensionComponents = {
    nodeViewLoader: () => import('../components/SlideDeck.svelte')
}

/* 
export interface ShapeContent {
    type: 'title' | 'content'
    value: string
    placeholder?: string
}
export interface Shape {
    type: 'text' | 'rect'| "file"
    content?: ShapeContent
    x: number
    y: number
    w: number
    h: number
    z?: number
    fill?: string
    [key: string]: any
} */

export interface SlideBlock extends Shape {
    anchor: Konva.Node   // Konva shape or group
    editor: Editor       // Tiptap editor instance
    editorEl: HTMLElement
    editing?: boolean
}




export interface RichTextBlock {
    id: string

    anchor: Konva.Rect
    editor: Editor
    editorEl: HTMLDivElement

    yText: Y.XmlFragment
    editing: boolean
}


export interface RichTextBlock2 {
    id: string

    x: number
    y: number
    width: number
    height: number

    anchor: Konva.Rect
    editor: Editor
    editorEl: HTMLDivElement

    editing: boolean
}
export interface PersistedBlock {
    id: string
    // type: string

    x: number
    y: number
    width: number
    height: number

    content?: any // Tiptap JSON (editor.getJSON())
}

export interface SlideData {
    version: 1 //future migrations

    id: string

    parentFilePath: string
    //slide geometry
    canvas: CanvasInfo
    /* canvas: {
        width: number
        height: number
        scaleX: number
        scaleY: number
    } */
    //ordered content
    blocks: PersistedBlock[]
}


export interface CanvasInfo {
    width: number
    height: number
    scaleX: number
    scaleY: number
    devicePixelRatio: number
    background?: string
}


export function getCanvasInfo(stage: Konva.Stage): CanvasInfo {
    //   const stage = stage

    return {
        width: stage.width(),
        height: stage.height(),
        scaleX: stage.scaleX(),
        scaleY: stage.scaleY(),
        devicePixelRatio: window.devicePixelRatio || 1,
        // pixelRatio: stage.pixelRatio?.() ?? window.devicePixelRatio,
        background: stage.container().style.backgroundColor || undefined
    }

    /* 
    When exporting images or PDFs:
    stage.toDataURL({
  pixelRatio: 2 // or 3 for print
})
  This is the ONLY place you should control pixelRatio.

*/
}

/* function setCanvasPreset(preset: 'A4' | '16:9' | '4:3') {
    const presets = {
        'A4': { width: 794, height: 1123 },
        '16:9': { width: 1280, height: 720 },
        '4:3': { width: 1024, height: 768 }
    }

    const size = presets[preset]
    _stage.width(size.width)
    _stage.height(size.height)
    _stage.batchDraw()
} */

/* 
export function newSlide() {
    return {
        id: uuidv4(),
        width: 1280,
        height: 720,
        background: '#ffffff',
        objects: [], // Konva-friendly objects
        transition: null,
        notes: ''
    };
}


export function newText(x = 100, y = 100) {
    return {
        id: uuidv4(),
        type: 'text',
        x, y,
        text: 'New text',
        fontSize: 28,
        fontFamily: 'Arial',
        fill: '#000',
        rotation: 0,
        draggable: true
    }
}


export function newRect(x = 150, y = 150) {
    return {
        id: uuidv4(),
        type: 'rect',
        x, y,
        width: 200,
        height: 100,
        fill: '#ddd',
        stroke: '#333',
        strokeWidth: 2,
        rotation: 0,
        draggable: true
    }
}


export function newImage(src, x = 100, y = 100) {
    return {
        id: uuidv4(),
        type: 'image',
        src,
        x, y,
        width: 200,
        height: 150,
        draggable: true
    }
}
 */

export function serializeDeck(deck) {
    return JSON.stringify(deck);
}


export function deserializeDeck(json) {
    try { return JSON.parse(json); } catch (e) { return null; }
}


export const animationPresets = {
    fadeIn: { duration: 0.6, attrs: { opacity: [0, 1] } },
    flyLeft: { duration: 0.6, attrs: { x: [-300, 0] } }
};
