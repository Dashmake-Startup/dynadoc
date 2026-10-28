import type { CanvasCommands } from "../commands/canvasCommands.types";
import { ImageEditingTools, isImageEditingDrawingTool } from "../extensions/tiptap/CustomDesignExtension/utils/utils";
import type { ShapeType } from "./canvas.types";

export function createDragInteract1(commands: CanvasCommands): {
    onStart: (x: number, y: number) => void;
    onMove: (currentX: number, currentY: number) => void;
    onEnd: () => void;
} {
    let startPos = { x: 0, y: 0 };
    let activeId = null;
    // let activeId = $state<string | null>(null);

    return {
        onStart: (x: number, y: number) => {
            startPos = { x, y };
            if (commands.getSelectedTool() == ImageEditingTools.Rectangle) {
                // console.log("drwingggg onStart", startPos)
                // Create the initial 1x1 rectangle
                activeId = commands.addRectangle({
                    x, y, w: 1, h: 1,
                    name: 'New Rectangle',
                    opacity: 0.5 // "Ghost" look during drag
                });
                console.log("drwingggg onStart", { startPos, activeId })
            }
        },

        onMove: (currentX: number, currentY: number) => {
            if (!activeId) return;
            console.log("drwingggg onMove", { startPos, activeId, currentX, currentY })

            // Photoshop logic: calculate rect from two points
            const x = Math.min(startPos.x, currentX);
            const y = Math.min(startPos.y, currentY);
            const w = Math.abs(currentX - startPos.x);
            const h = Math.abs(currentY - startPos.y);

            commands.updateShape(activeId, { x, y, w, h });
        },

        onEnd: () => {
            if (activeId) {
                console.log("drwingggg onEnd", { startPos, activeId })

                // Finalize: set full opacity
                commands.updateShape(activeId, { opacity: 1 });
                activeId = null;
            }

            if (!activeId) return;

            /* const shape = commands.getSelectedIds(activeId);

            // If the drag was tiny (less than 5px), treat it as a click
            if (shape.w < 5 && shape.h < 5) {
                commands.updateShape(activeId, { w: 200, h: 120, opacity: 1 });
            } else {
                commands.updateShape(activeId, { opacity: 1 });
            }
            activeId = null; */
        }
    };
}

export function createDragInteract(commands: CanvasCommands, type: ShapeType) {
    let activeId: string | null = null;
    let startX = 0;
    let startY = 0;

    return {
        onStart: (x, y) => {
            startX = x;
            startY = y;
            const tool = commands.getSelectedTool()
            // Create the initial shape with 0 width/height
            if (isImageEditingDrawingTool(tool)) {
                activeId = commands.addShape(type, { x, y, w: 0, h: 0 });
            }
        },
        onMove: (currentX, currentY) => {
            if (!activeId) return;

            // Calculate Adobe-style dimensions (allows dragging in any direction)
            const width = currentX - startX;
            const height = currentY - startY;

            // Update the Yjs Map directly
            /* const shape = context.shapes.get(activeId);
            if (shape) {
                context.shapes.set(activeId, {
                    ...shape,
                    w: Math.abs(width),
                    h: Math.abs(height),
                    // Handle negative drag (dragging up or left)
                    x: width < 0 ? currentX : startX,
                    y: height < 0 ? currentY : startY
                });
            } */


            // Photoshop logic: calculate rect from two points
            // const x = Math.min(startPos.x, currentX);
            // const y = Math.min(startPos.y, currentY);
            // const w = Math.abs(currentX - startPos.x);
            // const h = Math.abs(currentY - startPos.y);

            commands.updateShape(activeId, {
                    // ...shape,
                    w: Math.abs(width),
                    h: Math.abs(height),
                    // Handle negative drag (dragging up or left)
                    x: width < 0 ? currentX : startX,
                    y: height < 0 ? currentY : startY
                });
        },
        onEnd: () => {
            // activeId = null;
            if (activeId) {
                // console.log("drwingggg onEnd", { startPos, activeId })

                // Finalize: set full opacity
                commands.updateShape(activeId, { opacity: 1 });
                activeId = null;
            }

            if (!activeId) return;

            /* const shape = commands.getSelectedIds(activeId);

            // If the drag was tiny (less than 5px), treat it as a click
            if (shape.w < 5 && shape.h < 5) {
                commands.updateShape(activeId, { w: 200, h: 120, opacity: 1 });
            } else {
                commands.updateShape(activeId, { opacity: 1 });
            }
            activeId = null; */
        }
    };
}
