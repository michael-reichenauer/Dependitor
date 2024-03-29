import draw2d from "draw2d";
import { Tweenable } from "shifty";
import Canvas from "./Canvas";
import { Figure2d } from "./draw2dTypes";

const minZoom = 6; // small figures/zoomed out
const maxZoom = 0.05; // large figures/zoomed in

export default class ZoomPolicy extends draw2d.policy.canvas.ZoomPolicy {
  NAME: string = "ZoomPolicy";

  constructor() {
    super();

    this.center = null;
    this.debouncedZoomedCallback = this._debounce(() => {
      let canvas = this.canvas;
      if (canvas !== null) {
        canvas.fireEvent("zoomed", { value: canvas.zoomFactor });
      }
      this.center = null;
    }, 200);
  }

  onInstall(canvas: Canvas) {
    super.onInstall(canvas);
    canvas.setZoom(1);
    canvas.__wheelZoom = 1;
  }

  onUninstall(canvas: Canvas) {
    super.onUninstall(canvas);
    delete canvas.__wheelZoom;
  }

  onMouseWheel(wheelDelta: number, x: number, y: number) {
    wheelDelta = wheelDelta / 5024;

    if (!this.canvas.selection.all.isEmpty()) {
      // Deselect items, since zooming with selected figures is slow
      this.canvas.selection
        .getAll()
        .each((_: number, f: Figure2d) => f.unselect());
      this.canvas.selection.clear();
    }

    let newZoom =
      ((Math.min(
        minZoom,
        Math.max(maxZoom, this.canvas.zoomFactor + wheelDelta)
      ) *
        10000) |
        0) /
      10000;
    newZoom = Math.min(
      newZoom,
      Math.max(
        this.canvas.initialWidth / this.canvas.getWidth(),
        this.canvas.initialHeight / this.canvas.getHeight()
      )
    );

    // Center zoom around mouse pointer
    if (this.center === null) {
      let client = this.canvas.fromCanvasToDocumentCoordinate(x, y);

      this.center = {
        x: x,
        y: y,
        clientX: client.x,
        clientY: client.y,
      };
    }

    this._zoom(newZoom, this.center);
    this.debouncedZoomedCallback();

    return false;
  }

  setZoom(zoomFactor: number, animated: boolean) {
    // determine the center of the current canvas. We try to keep the
    // current center during zoom operation
    //
    let scrollTop = this.canvas.getScrollTop();
    let scrollLeft = this.canvas.getScrollLeft();
    let scrollWidth = this.canvas.getScrollArea().width();
    let scrollHeight = this.canvas.getScrollArea().height();
    let centerY = scrollTop + (scrollHeight / 2) * this.canvas.zoomFactor;
    let centerX = scrollLeft + (scrollWidth / 2) * this.canvas.zoomFactor;

    if (animated) {
      let myTweenable = new Tweenable();
      myTweenable.tween({
        from: { x: this.canvas.zoomFactor },
        to: { x: zoomFactor },
        duration: 300,
        easing: "easeOutSine",
        // @ts-ignore
        step: (params) => {
          // @ts-ignore
          this._zoom(params.x, centerX, centerY);
        },
        // @ts-ignore
        finish: (state) => {
          this.debouncedZoomedCallback();
        },
      });
    } else {
      this._zoom(zoomFactor, { x: centerX, y: centerY });
      this.debouncedZoomedCallback();
    }
  }

  _zoom(zoom: number, center: any) {
    let canvas = this.canvas;

    if (zoom === canvas.zoomFactor) {
      return;
    }

    canvas.zoomFactor = zoom;
    //console.log('Zoom', zoom)

    canvas.paper.setViewBox(0, 0, canvas.initialWidth, canvas.initialHeight);
    // Change the width and the height attributes manually through DOM
    // unfortunately the raphaelJS 'setSize' method changes the viewBox as well and this is unwanted in this case
    canvas.html.find("svg").attr({
      width: canvas.initialWidth / zoom,
      height: canvas.initialHeight / zoom,
    });

    // try to keep the document position to the given client position
    if (center.clientX) {
      let coordsAfter = canvas.fromCanvasToDocumentCoordinate(
        center.x,
        center.y
      );
      canvas.scrollTo(
        this.canvas.getScrollTop() - (center.clientY - coordsAfter.y),
        canvas.getScrollLeft() - (center.clientX - coordsAfter.x)
      );
    }

    canvas.fireEvent("zoom", { value: canvas.zoomFactor });
  }

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _debounce(func: () => void, wait: number, immediate?: boolean): () => void {
    let timeout: NodeJS.Timeout | null;
    return () => {
      let context = this;
      // @ts-ignore
      let args = arguments;
      let later = () => {
        timeout = null;
        // @ts-ignore
        if (!immediate) func.apply(context, args);
      };
      let callNow = immediate && !timeout;
      // @ts-ignore
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      // @ts-ignore
      if (callNow) func.apply(context, args);
    };
  }
}
