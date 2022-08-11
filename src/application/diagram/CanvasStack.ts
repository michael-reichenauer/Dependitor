import draw2d from "draw2d";
import Canvas from "./Canvas";
import { ArrayList2d, CommandStack2d, Figure2d, Line2d } from "./draw2dTypes";

export interface CanvasData {
  canvasId: string;
  commandStack: CommandStack2d;
  commonPorts: any;
  lines: ArrayList2d;
  figures: ArrayList2d;
  y: number;
  x: number;
  zoom: number;
  linesToRepaintAfterDragDrop: ArrayList2d;
  lineIntersections: ArrayList2d;
}

export default class CanvasStack {
  private diagramStack: CanvasData[] = [];

  public constructor(private canvas: Canvas) {}

  public isRoot(): boolean {
    return this.diagramStack.length === 0;
  }

  public pushDiagram(): void {
    const canvas = this.canvas;
    const canvasData = this.getCanvasData(canvas);

    // Store the canvas data so it can be popped later
    this.diagramStack.push(canvasData);

    this.clearCanvas(canvas);

    // new command stack, but reuse command stack event listeners from parent
    canvas.commandStack.eventListeners = canvasData.commandStack.eventListeners;
  }

  public popDiagram(): void {
    if (this.diagramStack.length === 0) {
      return;
    }
    const canvas = this.canvas;

    this.clearCanvas(canvas);

    // pop canvas data and restore canvas
    const canvasData = this.diagramStack.pop()!;
    this.restoreCanvasData(canvasData, canvas);
  }

  private clearCanvas(canvas: Canvas): void {
    // Remove all connections and nodes
    canvas.lines.each((_: number, e: Line2d) => e.setCanvas(null));
    canvas.figures.each((_: number, e: Figure2d) => e.setCanvas(null));
    // Clear all canvas data
    canvas.selection.clear();
    canvas.currentDropTarget = null;
    canvas.figures = new draw2d.util.ArrayList();
    canvas.lines = new draw2d.util.ArrayList();
    canvas.commonPorts = new draw2d.util.ArrayList();
    canvas.linesToRepaintAfterDragDrop = new draw2d.util.ArrayList();
    canvas.lineIntersections = new draw2d.util.ArrayList();
    canvas.commandStack = new draw2d.command.CommandStack();
    canvas.canvasId = "";
  }

  private getCanvasData(canvas: Canvas): CanvasData {
    const area = canvas.getScrollArea();
    return {
      canvasId: canvas.canvasId ?? "",
      zoom: canvas.zoomFactor,
      x: area.scrollLeft(),
      y: area.scrollTop(),
      lines: canvas.lines,
      figures: canvas.figures,
      commonPorts: canvas.commonPorts,
      commandStack: canvas.commandStack,
      linesToRepaintAfterDragDrop: canvas.linesToRepaintAfterDragDrop,
      lineIntersections: canvas.lineIntersections,
    };
  }

  private restoreCanvasData(canvasData: CanvasData, canvas: Canvas): void {
    // @ts-ignore
    canvas.diagramId = canvasData.diagramId;
    // @ts-ignore
    canvas.canvasId = canvasData.canvasId;

    canvas.setZoom(canvasData.zoom);
    const area = canvas.getScrollArea();
    area.scrollLeft(canvasData.x);
    area.scrollTop(canvasData.y);
    canvas.figures = canvasData.figures;
    canvas.lines = canvasData.lines;
    canvas.commonPorts = canvasData.commonPorts;
    canvas.commandStack = canvasData.commandStack;

    // Set canvas first in lines (needed to restore e.g group)
    canvasData.lines.each((_: number, e: Line2d) => e.setCanvas(canvas));

    // Set canvas for figures (group need that lines have been set)
    canvasData.figures.each((_: number, e: Figure2d) => e.setCanvas(canvas));

    // Repaint lines and figures
    canvasData.lines.each((_: number, e: Line2d) => e.repaint());
    canvasData.figures.each((_: number, e: Figure2d) => e.repaint());
  }
}
