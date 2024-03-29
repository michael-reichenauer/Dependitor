import draw2d from "draw2d";
import Canvas from "./Canvas";
import { Figure2d, Line2d } from "./draw2dTypes";
import ContainerNode from "./innerDiagrams/ContainerNode";

export default class PanPolicy extends draw2d.policy.canvas
  .SingleSelectionPolicy {
  NAME = "PanPolicy";

  constructor(onEditMode: (isEdit: boolean) => void) {
    super();
    this.onEditMode = onEditMode;

    this.isInsideMode = (rect1: any, rect2: any) => rect1.isInside(rect2);
    this.intersectsMode = (rect1: any, rect2: any) => rect1.intersects(rect2);

    this.decision = this.isInsideMode;

    this.boundingBoxFigure1 = null;
    this.boundingBoxFigure2 = null;
    this.x = 0;
    this.y = 0;

    this.canDrawBoundingBox = false;

    this.isReadOnly = true;
    this.isReadOnlySelect = false;
    this.isPort = false;
    this.isResizeHandle = false;
  }

  setEditMode(isEditMode: boolean) {
    if (isEditMode) {
      if (this.isReadOnly) {
        this.onEditMode(true);
        this.isReadOnly = false;
      }
      this.isReadOnlySelect = false;
    } else {
      if (!this.isReadOnly) {
        this.isReadOnly = true;
        this.isReadOnlySelect = false;
        this.onEditMode(false);
      }
    }
  }

  select(canvas: Canvas, figure: Figure2d) {
    if (figure == null) {
      // clicked outside a figure, lets set readonly mode
      this.setEditMode(false);
      return;
    } else {
      // Click on figure, (if in readonly mode, lets prepare for edit mode)
      if (this.isReadOnly) {
        this.isReadOnlySelect = true;
      }
    }

    if (canvas.getSelection().contains(figure)) {
      return; // nothing to to
    }

    let oldSelection = canvas.getSelection().getPrimary();

    if (figure !== null) {
      figure.select(true); // primary selection
    }

    if (oldSelection !== figure) {
      canvas.getSelection().setPrimary(figure);
      // inform all selection listeners about the new selection.
      canvas.fireEvent("select", {
        figure: figure,
        selection: canvas.getSelection(),
      });
    }

    // adding connections to the selection of the source and target port part of the current selection
    let selection = canvas.getSelection();
    canvas.getLines().each((_: number, line: Line2d) => {
      if (line instanceof draw2d.Connection) {
        if (
          selection.contains(line.getSource().getRoot()) &&
          selection.contains(line.getTarget().getRoot())
        ) {
          this.select(canvas, line);
        }
      }
    });
  }

  setDecisionMode(useIntersectionMode: boolean) {
    if (useIntersectionMode === true) {
      this.decision = this.intersectsMode;
    } else {
      this.decision = this.isInsideMode;
    }

    return this;
  }

  onMouseDown(
    canvas: Canvas,
    x: number,
    y: number,
    shiftKey: boolean,
    ctrlKey: boolean
  ) {
    this.isMoved = false;
    // console.log('onMouseDown')
    try {
      this.x = x;
      this.y = y;

      let currentSelection = canvas.getSelection().getAll();

      // COPY_PARENT
      // this code part is copied from the parent implementation. The main problem is, that
      // the sequence of unselect/select of elements is broken if we call the base implementation
      // in this case wrong  events are fired if we select a figure if already a figure is selected!
      // WRONG: selectNewFigure -> unselectOldFigure
      // RIGHT: unselectOldFigure -> selectNewFigure
      // To ensure this I must copy the parent code and postpone the event propagation
      //
      this.mouseMovedDuringMouseDown = false;
      let canDragStart = true;

      this.canDrawBoundingBox = false;

      let figure = canvas.getBestFigure(x, y);

      // may the figure is assigned to a composite. In this case the composite can
      // override the event receiver
      while (figure !== null) {
        let delegated = figure.getSelectionAdapter()();
        if (delegated === figure) {
          break;
        }
        figure = delegated;
      }

      // ignore ports since version 6.1.0. This is handled by the ConnectionCreatePolicy
      if (figure instanceof draw2d.Port) {
        // Mouse down on port, make sure pan drag does not move canvas while port is handled
        this.isPort = true;
        return;
      }
      if (figure instanceof draw2d.ResizeHandle) {
        this.isResizeHandle = true;
      }

      if (figure !== null && figure.id === ContainerNode.mainId) {
        figure = null;
      }

      if (
        figure !== null &&
        figure.isSelectable() === false &&
        figure.isDraggable() === false
      ) {
        figure = null;
      }

      this.canDrawBoundingBox = true;

      if (figure !== null && figure.isDraggable()) {
        canDragStart = figure.onDragStart(
          x - figure.getAbsoluteX(),
          y - figure.getAbsoluteY(),
          shiftKey,
          ctrlKey
        );
        // Element send a veto about the drag&drop operation
        this.mouseDraggingElement = canDragStart === false ? null : figure;
      }

      this.mouseDownElement = figure;

      if (this.mouseDownElement !== null) {
        this.mouseDownElement.fireEvent("mousedown", {
          x: x,
          y: y,
          shiftKey: shiftKey,
          ctrlKey: ctrlKey,
        });
      }

      // we click on an element which are not part of the current selection
      // => reset the "old" current selection if we didn't press the shift key
      if (shiftKey === false || shiftKey === undefined) {
        if (
          this.mouseDownElement !== null &&
          this.mouseDownElement.isResizeHandle === false &&
          !currentSelection.contains(this.mouseDownElement)
        ) {
          currentSelection.each((_: number, figure: Figure2d) => {
            this.unselect(canvas, figure);
          });
        }
      }

      if (
        figure !== canvas.getSelection().getPrimary() &&
        figure !== null &&
        figure.isSelectable() === true
      ) {
        this.select(canvas, figure);

        // its a line
        if (figure instanceof draw2d.shape.basic.Line) {
          // you can move a line with Drag&Drop...but not a connection.
          // A Connection is fixed linked with the corresponding ports.
          if (!(figure instanceof draw2d.Connection)) {
            canvas.draggingLineCommand = figure.createCommand(
              new draw2d.command.CommandType(draw2d.command.CommandType.MOVE)
            );
            if (canvas.draggingLineCommand !== null) {
              canvas.draggingLine = figure;
            }
          }
        } else if (canDragStart === false) {
          figure.unselect();
        }
      }
      // END_COPY FROM PARENT

      // inform all figures that they have a new ox/oy position for the relative
      // drag/drop operation
      if (
        this.mouseDownElement !== null &&
        this.mouseDownElement.isResizeHandle === false
      ) {
        currentSelection = canvas.getSelection().getAll();
        currentSelection.each((_: number, figure: Figure2d) => {
          let fakeDragX = 1;
          let fakeDragY = 1;

          let handleRect = figure.getHandleBBox();
          if (handleRect !== null) {
            handleRect.translate(figure.getAbsolutePosition().scale(-1));
            fakeDragX = handleRect.x + 1;
            fakeDragY = handleRect.y + 1;
          }

          let canDragStart = figure.onDragStart(
            fakeDragX,
            fakeDragY,
            shiftKey,
            ctrlKey,
            true /*fakeFlag*/
          );
          // its a line
          if (figure instanceof draw2d.shape.basic.Line) {
            // no special handling
          } else if (canDragStart === false) {
            this.unselect(canvas, figure);
          }
        });
      }
    } catch (exc) {
      console.log(exc);
      throw exc;
    }
  }

  onMouseDrag(
    canvas: Canvas,
    dx: number,
    dy: number,
    dx2: number,
    dy2: number,
    shiftKey: boolean,
    ctrlKey: boolean
  ) {
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      this.isMoved = true;
    }

    if (this.isReadOnly && !this.isPort && !this.isResizeHandle) {
      // Read only mode and not dragging a port, let pan the canvas
      this.isReadOnlySelect = false;

      if (!canvas.selection.all.isEmpty()) {
        // Deselect items, since panning with selected figures is slow
        canvas.selection
          .getAll()
          .each((_: number, f: Figure2d) => f.unselect());
        canvas.selection.clear();
      }

      let area = canvas.getScrollArea();
      let zoom = canvas.getZoom();
      area.scrollLeft(area.scrollLeft() - dx2 / zoom);
      area.scrollTop(area.scrollTop() - dy2 / zoom);
      return;
    }

    // don't drag a selection box if we drag&drop a port
    if (this.canDrawBoundingBox === false) {
      return;
    }

    try {
      super.onMouseDrag(canvas, dx, dy, dx2, dy2, shiftKey, ctrlKey);

      if (
        this.mouseDraggingElement === null &&
        this.mouseDownElement === null &&
        this.boundingBoxFigure1 === null
      ) {
        this.boundingBoxFigure1 = new draw2d.shape.basic.Rectangle({
          width: 1,
          height: 1,
          x: this.x,
          y: this.y,
          bgColor: "#d4d1d4",
          alpha: 0.1,
        });
        this.boundingBoxFigure1.setCanvas(canvas);

        this.boundingBoxFigure2 = new draw2d.shape.basic.Rectangle({
          width: 1,
          height: 1,
          x: this.x,
          y: this.y,
          dash: "--..",
          stroke: 0.5,
          color: "#37a8ff",
          bgColor: null,
        });
        this.boundingBoxFigure2.setCanvas(canvas);
      }

      let abs = Math.abs;
      if (this.boundingBoxFigure1 !== null) {
        this.boundingBoxFigure1.setDimension(abs(dx), abs(dy));
        this.boundingBoxFigure1.setPosition(
          this.x + Math.min(0, dx),
          this.y + Math.min(0, dy)
        );
        this.boundingBoxFigure2.setDimension(abs(dx), abs(dy));
        this.boundingBoxFigure2.setPosition(
          this.x + Math.min(0, dx),
          this.y + Math.min(0, dy)
        );
      }
    } catch (exc) {
      console.error(exc);
      debugger;
    }
  }

  onMouseUp(
    canvas: Canvas,
    x: number,
    y: number,
    shiftKey: boolean,
    ctrlKey: boolean
  ) {
    //console.log('onMouseUp')
    // No longer port handling
    this.isPort = false;
    this.isResizeHandle = false;

    if (this.isReadOnlySelect) {
      // Was a click on figure (started in select), lets enable edit mode
      this.setEditMode(true);
    }

    try {
      // delete the current selection if you have clicked in the empty
      // canvas.
      if (this.mouseDownElement === null) {
        canvas
          .getSelection()
          .getAll()
          .each((_: number, figure: Figure2d) => {
            this.unselect(canvas, figure);
          });
      } else if (
        this.mouseDownElement instanceof draw2d.ResizeHandle ||
        this.mouseDownElement instanceof draw2d.shape.basic.LineResizeHandle
      ) {
        // Do nothing
        // A click on a resize handle didn't change the selection of the canvas
      }
      // delete the current selection if you click on another figure than the current
      // selection and you didn't drag the complete selection.
      else if (
        this.mouseDownElement !== null &&
        this.mouseMovedDuringMouseDown === false
      ) {
        let sel = canvas.getSelection().getAll();
        if (!sel.contains(this.mouseDownElement)) {
          canvas
            .getSelection()
            .getAll()
            .each((_: number, figure: Figure2d) => {
              this.unselect(canvas, figure);
            });
        }
      }
      super.onMouseUp(canvas, x, y, shiftKey, ctrlKey);

      if (this.boundingBoxFigure1 !== null) {
        // retrieve all figures which are inside the bounding box and select all of them
        let selectionRect = this.boundingBoxFigure1.getBoundingBox();
        canvas.getFigures().each((_: number, figure: Figure2d) => {
          if (
            figure.isSelectable() === true &&
            figure.isVisible() === true &&
            this.decision(figure.getBoundingBox(), selectionRect)
          ) {
            let fakeDragX = 1;
            let fakeDragY = 1;

            let handleRect = figure.getHandleBBox();
            if (handleRect !== null) {
              handleRect.translate(figure.getAbsolutePosition().scale(-1));
              fakeDragX = handleRect.x + 1;
              fakeDragY = handleRect.y + 1;
            }
            let canDragStart = figure.onDragStart(
              fakeDragX,
              fakeDragY,
              shiftKey,
              ctrlKey
            );
            if (canDragStart === true) {
              this.select(canvas, figure);
            }
          }
        });

        this.boundingBoxFigure1.setCanvas(null);
        this.boundingBoxFigure1 = null;
        this.boundingBoxFigure2.setCanvas(null);
        this.boundingBoxFigure2 = null;
      }
      if (this.isMoved) {
        const groupNode = this.canvas.getFigure(ContainerNode.mainId);
        groupNode?.resizeToContainInnerIcons();
      }
    } catch (exc) {
      console.error(exc);
      debugger;
    }
  }
}
