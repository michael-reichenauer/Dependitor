import { Tweenable } from "shifty";
import Canvas from "./Canvas";
import { Figure2d } from "./draw2dTypes";

export const zoomAndMoveShowTotalDiagram = (
  canvas: Canvas,
  duration: number = 500
): void => {
  if (!canvas.selection.all.isEmpty()) {
    // Deselect items, since zooming with selected figures is slow
    canvas.selection.getAll().each((_: number, f: Figure2d) => f.unselect());
    canvas.selection.clear();
  }

  moveToShowTotalDiagram(canvas, duration, () =>
    zoomToShowTotalDiagram(canvas, duration, () => {})
  );
};

const moveToShowTotalDiagram = (
  canvas: Canvas,
  duration: number,
  done: () => void
) => {
  const area = canvas.getScrollArea();
  const sp = { x: area.scrollLeft(), y: area.scrollTop() };

  const { x, y, w, h } = canvas.getFiguresRect();

  const zoom = canvas.zoomFactor;
  const fc = { x: (x + w / 2) / zoom, y: (y + h / 2) / zoom };
  const cc = { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };

  const tp = { x: fc.x - cc.x, y: fc.y - cc.y };

  const tweenable = new Tweenable();
  tweenable.tween({
    from: { x: sp.x, y: sp.y },
    to: { x: tp.x, y: tp.y },
    duration: duration,
    easing: "easeOutSine",
    step: (state: any) => {
      area.scrollLeft(state.x);
      area.scrollTop(state.y);
    },
    finish: (_: any) => {
      if (done != null) {
        done();
      }
    },
  });
};

const zoomToShowTotalDiagram = (
  canvas: Canvas,
  duration: number,
  done: () => void
) => {
  const area = canvas.getScrollArea();
  const sourceZoom = canvas.zoomFactor;

  const { x, y, w, h } = canvas.getFiguresRect();

  const fc = { x: x + w / 2, y: y + h / 2 };
  const cc = { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 };

  const targetZoom = Math.max(
    1,
    w / (canvas.getWidth() - 100),
    h / (canvas.getHeight() - 100)
  );

  console.log("total source zoom", sourceZoom);
  console.log("total target zooom", targetZoom);

  const tweenable = new Tweenable();
  tweenable.tween({
    from: { zoom: sourceZoom },
    to: { zoom: targetZoom },
    duration: duration,
    easing: "easeOutSine",
    step: (state: any) => {
      canvas.setZoom(state.zoom, false);

      // Adjust scroll to center, since canvas zoom lacks zoom at center point
      const tp = { x: fc.x - cc.x * state.zoom, y: fc.y - cc.y * state.zoom };
      area.scrollLeft(tp.x / state.zoom);
      area.scrollTop(tp.y / state.zoom);
    },
    finish: (_: any) => {
      if (done != null) {
        done();
      }
    },
  });
};
