import type { ComponentType, SvelteComponent } from "svelte"
import { ShapeType, type Shape } from "../../../../utils/canvas.utils"
// import DesignStudioMain from "../components/DesignStudioMain.svelte"

export const CustomDesignExtensionComponents = {
    nodeView: '',
    // nodeView: DesignStudioMain,
    // decorationView: SlideDeck,
}

export type CanvasLayer = {
    id: string
    name: string
    shapes?: Shape
    // shapes?: Shape[] // 
    selected: boolean
    visible: boolean
    thumbnail: string
    z: number


    /*  blur: number
     opacity: number
     blend: string
     visible: boolean
     width: number
     height: number
     // Transform properties
     rotation?: number // in degrees
     scaleX?: number
     scaleY?: number
 
 
 
     // Shape layer
     shapeType?: 'rect' | 'roundRect' | 'circle'
     fillColor?: string
     strokeColor?: string
     strokeWidth?: number
     borderRadius?: number // for rounded rect */
}


export type Tool = {
    id: string
    label?: string
    icon?: string
    body?: {
        component: ComponentType<SvelteComponent>
        props?: Record<string, any>
    } | null
    // body?: {ComponentType} | null
    hotkey?: string
    variant?: 'primary' | 'ghost'
    big?: boolean
    // rowspan?: number
    // colspan?: number
    disabled?: boolean
}
export type ToolGroup = {
    id: string
    title: string
    layout?: string
    items: Tool[]
}


export enum ImageEditingTools {
    /** Group 1: Selection Tools **/
    Move = 'move',
    Marquee = 'marquee',
    Lasso = 'lasso',
    MagicWand = 'magicWand',

    /** Group 2: Crop & Measurement **/
    Crop = 'crop',
    Eyedropper = 'eyedropper',

    /** Group 3: Retouching & Painting **/
    Healing = 'healing',
    Brush = 'brush',
    Stamp = 'stamp',
    Eraser = 'eraser',
    Gradient = 'gradient',
    Blur = 'blur',
    Dodge = 'dodge',

    /** Group 4: Drawing & Type (Vector) **/
    Pen = 'pen',
    Type = 'type',
    Image = 'image',
    Select = 'select',
    Rectangle = 'rectangle',
    Ellipse = 'ellipse',
    Circle = 'circle',
    Triangle = 'triangle',

    /** Group 5: Navigation **/
    Hand = 'hand',
    Zoom = 'zoom',
    ColorSwitcher = 'color-switcher'
}

export const ImageEditingToolCursorMap: Record<ImageEditingTools, string> = {
  // Selection tools
  [ImageEditingTools.Move]: 'move',
  [ImageEditingTools.Marquee]: 'crosshair',
  [ImageEditingTools.Lasso]: 'crosshair',
  [ImageEditingTools.MagicWand]: 'crosshair',

  // Crop & measurement
  [ImageEditingTools.Crop]: 'crosshair',
  [ImageEditingTools.Eyedropper]: 'copy', // or a custom cursor

  // Retouching & painting
  [ImageEditingTools.Healing]: 'cell',
  [ImageEditingTools.Brush]: 'crosshair',
  [ImageEditingTools.Stamp]: 'copy',
  [ImageEditingTools.Eraser]: 'not-allowed',
  [ImageEditingTools.Gradient]: 'crosshair',
  [ImageEditingTools.Blur]: 'crosshair',
  [ImageEditingTools.Dodge]: 'crosshair',

  // Drawing & vector
  [ImageEditingTools.Pen]: 'crosshair',
  [ImageEditingTools.Type]: 'text',
  [ImageEditingTools.Image]: 'pointer',
  [ImageEditingTools.Select]: 'default',
  [ImageEditingTools.Rectangle]: 'crosshair',
  [ImageEditingTools.Ellipse]: 'crosshair',
  [ImageEditingTools.Circle]: 'crosshair',
  [ImageEditingTools.Triangle]: 'crosshair',

  // Navigation
  [ImageEditingTools.Hand]: 'grab',
  [ImageEditingTools.Zoom]: 'zoom-in',
  [ImageEditingTools.ColorSwitcher]: 'pointer'
}


export const ImageEditingToolsDrawingShape: Partial<Record<ImageEditingTools, ShapeType>> = {
    [ImageEditingTools.Rectangle]: ShapeType.Rect,
    [ImageEditingTools.Triangle]: ShapeType.Triangle,
    [ImageEditingTools.Ellipse]: ShapeType.Ellipse,
    [ImageEditingTools.Circle]: ShapeType.Circle,
    // add more mappings here as needed
} as const


// Precompute a Set for O(1) lookup
const drawingToolSet = new Set<string>(Object.keys(ImageEditingToolsDrawingShape))

export function isImageEditingDrawingTool(value: unknown): boolean {
    return drawingToolSet.has(value as string)
}

