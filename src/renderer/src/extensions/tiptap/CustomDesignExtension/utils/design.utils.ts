import type { CanvasKit } from "canvaskit-wasm";

export const parseColor = (ck: CanvasKit, hex: string, alpha: number = 1) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return ck.Color(r, g, b, alpha);
};