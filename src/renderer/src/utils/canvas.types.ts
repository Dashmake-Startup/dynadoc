import type * as Y from 'yjs'
import type { WebsocketProvider } from 'y-websocket'
import type { Awareness } from 'y-protocols/awareness'

export interface CollaborativeCanvas {
    id: string
    path: string
    ydoc: Y.Doc
    provider: WebsocketProvider | null
    shapes: Y.Map<Shape>
    texts: Y.Map<Y.XmlFragment>
    meta: Y.Map<any>
    awareness: Awareness | null
    newlyCreated: boolean
    isLoaded?: boolean
    load?: () => Promise<void>
    release?: () => void
}

export enum ShapeType {
    Rect = 'rect',
    Ellipse = 'ellipse',
    Circle = 'circle',
    Triangle = 'triangle',
    Line = 'line',
    Text = 'text',
    File = 'file'
}

export interface ShapeContent {
    type: 'title' | 'content'
    value: string
    placeholder?: string
}

export interface Shape {
    id: string
    name: string
    type?: ShapeType
    thumbnail?: string
    content?: ShapeContent
    x: number
    y: number
    w: number
    h: number
    z?: number
    fill?: string
    visible?: boolean
    selected?: boolean
    [key: string]: any
}
