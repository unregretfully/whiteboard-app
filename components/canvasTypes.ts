export type TextObj = {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  wrapWidth: number | null;
};
export type ShapeObj = { id: string; type: "shape"; x: number; y: number; width: number; height: number };
export type LineObj = { id: string; type: "line"; x1: number; y1: number; x2: number; y2: number };
export type CanvasObject = TextObj | ShapeObj | LineObj;

export type Mode = "view" | "select" | "text" | "line" | "shape";
export type Access = "private" | "view" | "edit";