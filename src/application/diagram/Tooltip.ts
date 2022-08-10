import { Figure2d } from "./draw2dTypes";

export class Tooltip {
  private element: any = null;
  private tooltipTimer: any;

  constructor(private figure: Figure2d, private tooltip: string) {
    figure.on("mouseenter", () => this.show());
    figure.on("mouseleave", () => this.hide());
  }

  private show() {
    if (this.element !== null) {
      this.hide();
    }

    clearTimeout(this.tooltipTimer);
    this.tooltipTimer = setTimeout(() => {
      if (this.tooltipTimer === -1 || this.figure.canvas == null) {
        return;
      }
      const pos = this.getTooltipPosition();

      this.element = document.createElement("div");
      this.element.setAttribute("class", "tooltip");
      this.element.setAttribute(
        "style",
        `position: absolute; left: ${pos.x}px; top: ${pos.y}px;"`
      );
      this.element.innerHTML = this.tooltip;
      document.body.appendChild(this.element);
    }, 500);
  }

  public hide() {
    clearTimeout(this.tooltipTimer);
    this.tooltipTimer = -1;
    if (this.element === null) {
      return;
    }
    document.body.removeChild(this.element);
    this.element = null;
  }

  private getTooltipPosition() {
    const textSize = this.tooltip.length * 5;
    return this.figure.canvas.fromCanvasToDocumentCoordinate(
      this.figure.getAbsoluteX() + this.figure.getWidth() / 2 - textSize / 2,
      this.figure.getAbsoluteY() + this.figure.getHeight() + 10
    );
  }
}
