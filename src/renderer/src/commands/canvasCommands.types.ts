import type { Shape, ShapeType } from '../utils/canvas.types'
import type { Writable } from 'svelte/store'
import type { ImageEditingTools } from '../extensions/tiptap/CustomDesignExtension/utils/utils'

export type SelectionMode = 'replace' | 'add' | 'toggle'

export interface CanvasCommands {
    createDefaultCanvasContent(stageW: number, stageH: number): void
    addText(props?: Partial<Shape>): void
    addImage(src: string, props?: Partial<Shape>): void
    addVideo(src: string, props?: Partial<Shape>): void
    addFile(src: string, props?: Shape): void
    addShape(type: ShapeType, props?: Partial<Shape>): string
    drawShape(type: ShapeType): {
        onStart: (x: number, y: number) => void
        onMove: (currentX: number, currentY: number) => void
        onEnd: () => void
    }
    getSelectedToolCursor(): string
    getSelectedTool(): ImageEditingTools
    setSelectedTool(toool: ImageEditingTools): void
    selectedToolStore: Writable<ImageEditingTools>
    deleteSelected(): void
    bringForward(): void
    sendBackward(): void
    setBackground(color: string): void
    select(id: string | null, options?: { mode?: SelectionMode }): void
    selectMany(ids: string[], options?: { mode?: SelectionMode }): void
    getSelectedIds(): string[]
    getSelectedShapes(): Shape[]
    getShape(id: string): Shape | undefined
    clearSelection(): void
    unselect(id?: string | null): void
    updateShape(id: string, props: Partial<Shape>): void
    setVisibility(id: string, visible: boolean): void
    toggleVisibility(id: string): void
    duplicateShape(id: string, options?: { offsetX?: number; offsetY?: number }): string | null
    rotateSelected(deltaDegrees: number, pivot?: { x: number; y: number }): void
    alignSelected(mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void
    setAutoResizeEnabled(enabled: boolean): void
    isAutoResizeEnabled(): boolean
    toggleAutoResizeEnabled(): void
}
