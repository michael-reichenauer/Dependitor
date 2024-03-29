import draw2d from "draw2d";
import Connection from "../Connection";
import ContainerNode from "./ContainerNode";
import Node from "../Node";
import Canvas from "../Canvas";
import { ICanvasStackKey } from "./CanvasStack";
import { Box, Figure2d } from "../draw2dTypes";
import { Tweenable } from "shifty";
import { Time } from "../../../utils/time";
import { CanvasDto, FigureDto } from "../StoreDtos";
import { di } from "../../../common/di";
import { IStoreKey } from "../Store";
import { isError } from "../../../common/Result";
import { defaultIcon } from "./defaultDiagram";
import assert from "assert";
import { ICanvasSerializerKey } from "../CanvasSerializer";

// Zoom/move a little slower than show total diagram
const zoomMoveDuration = 1 * Time.second;

export default class InnerDiagram {
  public constructor(
    private canvas: Canvas,
    private canvasStack = di(ICanvasStackKey),
    private store = di(IStoreKey),
    private serializer = di(ICanvasSerializerKey)
  ) {}

  // editInnerDiagram called when edit inner diagram is requested
  public async editInnerDiagram(node: Node): Promise<void> {
    const canvasDto = this.getCanvasDto(node);
    const containerDto = this.getContainerDto(canvasDto);
    const innerZoom = node.getWidth() / containerDto.rect.w;

    // Move/Zoom outer diagram to prepare for switching to inner diagram canvas
    this.canvas.unselectAll();
    this.canvas.hidePorts();
    node.showInnerDiagram();
    await this.moveToShowNodeInCenter(node);
    await this.zoomToShowEditableNode(node, canvasDto.rect, innerZoom);

    // Remember the current outer zoom, which is used when zooming inner diagram to match
    const outerZoom = this.canvas.zoomFactor;

    // Get the view coordinates of the inner diagram image where the inner diagram should
    // positioned after the switch
    const innerViewPos = this.getDiagramViewCoordinate(node);

    // Get nodes connected to outer node so they can be re-added in the inner diagram after push
    const connectedNodes = this.getNodesConnectedToOuterNode(node);

    // Hide the inner diagram image from node (will be updated and shown when popping)
    node.hideInnerDiagram();

    // Push current diagram canvas to make room for new inner diagram canvas
    this.canvasStack.push(this.canvas, this.canvas.canvasName);

    // Load inner diagram canvas
    this.serializer.deserialize(this.canvas, canvasDto);

    // Update container node with latest info and connect external nodes
    const containerNode = this.canvas.getFigure(ContainerNode.mainId);
    this.updateContainerNode(containerNode, node);
    this.addOrUpdateConnectedNodes(containerNode, connectedNodes);
    PubSub.publish("canvas.SetCanvasName", containerNode.getName());

    // Zoom inner diagram to correspond to inner diagram image size in the outer node was
    const targetZoom = outerZoom / innerZoom;
    this.canvas.setZoom(targetZoom);

    // Scroll inner diagram to correspond to where the inner diagram image in the outer node was
    const innerRect = this.getInnerDiagramRect(containerNode);
    const left = innerRect.x - innerViewPos.left * this.canvas.zoomFactor;
    const top = innerRect.y - innerViewPos.top * this.canvas.zoomFactor;
    this.setScrollInCanvasCoordinate(left, top);

    // Show the pop diagram tool bar button
    containerNode.showToolbar();
  }

  // popFromInnerDiagram pops the inner diagram canvas back to the outer node canvas
  public async popFromInnerDiagram(): Promise<void> {
    this.canvas.unselectAll();

    const groupNode = this.canvas.getFigure(ContainerNode.mainId);

    // Get the inner diagram zoom to use when zooming outer diagram
    const postInnerZoom = this.canvas.zoomFactor;

    // Get inner diagram view position to scroll the outer diagram to same position
    const innerRect = this.getInnerDiagramRect(groupNode);
    const innerViewPos = this.fromCanvasToViewCoordinate(
      innerRect.x,
      innerRect.y
    );

    // Show outer diagram (closing the inner diagram) (same id as group)
    const outerNodeId = this.canvas.canvasId;
    const canvasDto = this.store.getCanvas(outerNodeId);
    const containerDto = this.getContainerDto(canvasDto);
    const canvasName = this.canvasStack.pop(this.canvas);
    PubSub.publish("canvas.SetCanvasName", canvasName);
    //diagramNameState.set(diagramName);

    // Update the nodes inner diagram image in the outer node
    const node = this.canvas.getFigure(outerNodeId);
    node.showInnerDiagram();

    // Zoom outer diagram to correspond to the inner diagram
    const innerZoom = node.getWidth() / containerDto.rect.w;
    const preInnerZoom = this.canvas.zoomFactor / innerZoom;
    const newZoom = this.canvas.zoomFactor * (postInnerZoom / preInnerZoom);
    this.canvas.setZoom(newZoom);

    // Scroll outer diagram to correspond to inner diagram position
    const sx = node.x + 2 - innerViewPos.x * this.canvas.zoomFactor;
    const sy = node.y + 2 - innerViewPos.y * this.canvas.zoomFactor;
    this.setScrollInCanvasCoordinate(sx, sy);

    this.canvas.unselectAll();
    this.canvas.hidePorts();
    await this.zoomToShowNormalNode(node, 1);
    node.select(true);
  }

  private getCanvasDto(node: Node): CanvasDto {
    let canvasDto = this.store.tryGetCanvas(node.id);
    if (isError(canvasDto)) {
      canvasDto = defaultIcon(node);
    }
    return canvasDto;
  }

  private getNodesConnectedToOuterNode(figure: Figure2d) {
    const leftNodes = figure
      .getPort("input0")
      .getConnections()
      .asArray()
      .filter((c: any) => c.sourcePort.parent.type !== ContainerNode.nodeType)
      .map((c: any) => {
        return {
          node: c.sourcePort.parent.serialize(),
          connection: c.serialize(),
        };
      });

    const topNodes = figure
      .getPort("input1")
      .getConnections()
      .asArray()
      .filter((c: any) => c.sourcePort.parent.type !== ContainerNode.nodeType)
      .map((c: any) => {
        return {
          node: c.sourcePort.parent.serialize(),
          connection: c.serialize(),
        };
      });

    const rightNodes = figure
      .getPort("output0")
      .getConnections()
      .asArray()
      .filter((c: any) => c.targetPort.parent.type !== ContainerNode.nodeType)
      .map((c: any) => {
        return {
          node: c.targetPort.parent.serialize(),
          connection: c.serialize(),
        };
      });

    const bottomNodes = figure
      .getPort("output1")
      .getConnections()
      .asArray()
      .filter((c: any) => c.targetPort.parent.type !== ContainerNode.nodeType)
      .map((c: any) => {
        return {
          node: c.targetPort.parent.serialize(),
          connection: c.serialize(),
        };
      });

    this.sortNodesOnY(leftNodes);
    this.sortNodesOnY(rightNodes);
    this.sortNodesOnX(topNodes);
    this.sortNodesOnX(bottomNodes);

    return {
      left: leftNodes,
      top: topNodes,
      right: rightNodes,
      bottom: bottomNodes,
    };
  }

  private getDiagramViewCoordinate(inner: Figure2d) {
    const canvasZoom = inner.canvas.zoomFactor;

    // get the inner diagram pos in canvas view coordinates
    const outerScrollPos = this.getScrollInCanvasCoordinate(inner);

    const vx = (inner.getAbsoluteX() - outerScrollPos.left) / canvasZoom;
    const vy = (inner.getAbsoluteY() - outerScrollPos.top) / canvasZoom;

    return { left: vx, top: vy };
  }

  private getScrollInCanvasCoordinate(inner: Figure2d) {
    const area = inner.canvas.getScrollArea();
    return {
      left: area.scrollLeft() * inner.canvas.zoomFactor,
      top: area.scrollTop() * inner.canvas.zoomFactor,
    };
  }

  private updateContainerNode(containerNode: Figure2d, node: Figure2d) {
    // Update inner diagram container with outer node info
    containerNode.setName(node.getName());
    containerNode.setDescription(node.getDescription());
    containerNode.setIcon(node.iconName);

    // Tone down container bounding box appearance
    containerNode.setStroke(0.5);
    containerNode.setAlpha(0.2);
    containerNode.setDashArray("--..");
  }

  // addOrUpdateConnectedNodes adds or updates external nodes connected to the outer node
  private addOrUpdateConnectedNodes(containerNode: any, nodes: any) {
    const marginX = 60;
    const marginY = 60;

    const addedNodes = [];

    nodes.left.forEach((data: any, i: number) => {
      const w = data.node.rect.w;
      const h = data.node.rect.h;
      const total = nodes.left.length;
      const p = i * (h + 20) - ((total - 1) * (h + 20)) / 2;
      const x = containerNode.x - w - marginX;
      const y = containerNode.y + containerNode.height / 2 - h / 2 + p;
      const node = this.addConnectedNode(data, x, y);
      node.isLeft = true;
      this.addConnection(data, node, containerNode);
      addedNodes.push(node);
    });

    nodes.top.forEach((data: any, i: number) => {
      //const w = Node.defaultWidth
      const w = data.node.rect.w;
      const h = data.node.rect.h;
      const total = nodes.top.length;
      const p = i * (w + 20) - ((total - 1) * (w + 20)) / 2;
      const x = containerNode.x + containerNode.width / 2 - w / 2 + p;
      const y = containerNode.y - h - marginY;
      const node = this.addConnectedNode(data, x, y);
      node.isTop = true;
      this.addConnection(data, node, containerNode);
      addedNodes.push(node);
    });

    nodes.right.forEach((data: any, i: number) => {
      const h = data.node.rect.h;
      const total = nodes.right.length;
      const p = i * (h + 20) - ((total - 1) * (h + 20)) / 2;
      const x = containerNode.x + containerNode.width + marginX;
      const y = containerNode.y + containerNode.height / 2 - h / 2 + p;
      const node = this.addConnectedNode(data, x, y);
      node.isRight = true;
      this.addConnection(data, containerNode, node);
      addedNodes.push(node);
    });

    nodes.bottom.forEach((data: any, i: number) => {
      const w = data.node.rect.w;
      const total = nodes.bottom.length;
      const p = i * (w + 20) - ((total - 1) * (w + 20)) / 2;
      const x = containerNode.x + containerNode.width / 2 - w / 2 + p;
      const y = containerNode.y + containerNode.height + marginY;
      const node = this.addConnectedNode(data, x, y);
      node.isBottom = true;
      this.addConnection(data, containerNode, node);
      addedNodes.push(node);
    });
  }

  private addConnectedNode(data: any, x: number, y: number) {
    const alpha = 0.6;
    let node = this.canvas.getFigure(data.node.id);

    if (node != null) {
      // Node already exist, updating data
      node.setName(data.node.name);
      node.setDescription(data.node.description);
      node.setIcon(data.node.icon);
      node.attr({ alpha: alpha, resizeable: false });
    } else {
      // Node needs to be created and added
      node = Node.deserialize(data.node);
      node.attr({
        width: node.width,
        height: node.height,
        alpha: alpha,
        resizeable: false,
      });
      this.canvas.add(node, x, y);
    }

    node.isConnected = true;
    node.setDeleteable(false);
    node.setBlur();
    return node;
  }

  private addConnection(data: any, src: any, trg: any) {
    const id = data.connection.id;
    const name = data.connection.name;
    const description = data.connection.description;
    const srcPort = data.connection.srcPort;
    const trgPort = data.connection.trgPort;

    let connection = this.canvas.getLine(id);
    if (connection != null) {
      // Connection already exist, updating data
      connection.setName(name);
      connection.setDescription(description);
    } else {
      // Connection needs to be added
      connection = new Connection(
        name,
        description,
        src,
        srcPort,
        trg,
        trgPort,
        id
      );
      this.canvas.add(connection);
    }

    connection.setDashArray(".");
    connection.setStroke(2);
    connection.setDeleteable(false);
  }

  private fromCanvasToViewCoordinate = (x: number, y: number) => {
    return new draw2d.geo.Point(
      x * (1 / this.canvas.zoomFactor) - this.canvas.getScrollLeft(),
      y * (1 / this.canvas.zoomFactor) - this.canvas.getScrollTop()
    );
  };

  private setScrollInCanvasCoordinate = (left: number, top: number) => {
    const area = this.canvas.getScrollArea();
    area.scrollLeft(left / this.canvas.zoomFactor);
    area.scrollTop(top / this.canvas.zoomFactor);
  };

  private getInnerDiagramRect(groupNode: any) {
    const g = groupNode;
    return { x: g.x, y: g.y, w: g.width, h: g.height };
  }

  private sortNodesOnX(nodes: any) {
    nodes.sort((d1: any, d2: any) =>
      d1.node.x < d2.node.x ? -1 : d1.node.x > d2.node.x ? 1 : 0
    );
  }

  private sortNodesOnY(nodes: any) {
    nodes.sort((d1: any, d2: any) =>
      d1.node.y < d2.node.y ? -1 : d1.node.y > d2.node.y ? 1 : 0
    );
  }

  private moveToShowNodeInCenter(node: Node): Promise<void> {
    this.canvas.unselectAll();
    return new Promise((resolve) => {
      const area = this.canvas.getScrollArea();
      const sp = { x: area.scrollLeft(), y: area.scrollTop() };

      //const { x, y, w, h } = this.canvas.getFiguresRect();
      const { x, y, w, h } = {
        x: node.x,
        y: node.y,
        w: node.width,
        h: node.height,
      };

      const zoom = this.canvas.zoomFactor;
      const fc = { x: (x + w / 2) / zoom, y: (y + h / 2) / zoom };
      const cc = {
        x: this.canvas.getWidth() / 2,
        y: this.canvas.getHeight() / 2,
      };

      const tp = { x: fc.x - cc.x, y: fc.y - cc.y };

      const tweenable = new Tweenable();
      tweenable.tween({
        from: { x: sp.x, y: sp.y },
        to: { x: tp.x, y: tp.y },
        duration: zoomMoveDuration,
        easing: "easeOutSine",
        step: (state: any) => {
          area.scrollLeft(state.x);
          area.scrollTop(state.y);
        },
        finish: (_: any) => {
          resolve();
        },
      });
    });
  }

  private zoomToShowEditableNode(
    node: Node,
    targetRect: Box,
    innerZoom: number
  ): Promise<void> {
    this.canvas.unselectAll();

    return new Promise((resolve) => {
      const area = this.canvas.getScrollArea();
      const sourceZoom = this.canvas.zoomFactor;

      const { x, y, w, h } = {
        x: node.x,
        y: node.y,
        w: node.width,
        h: node.height,
      };

      const fc = { x: x + w / 2, y: y + h / 2 };
      const cc = {
        x: this.canvas.getWidth() / 2,
        y: this.canvas.getHeight() / 2,
      };

      if (!targetRect) {
        targetRect = {
          x: 0,
          y: 0,
          w: ContainerNode.defaultWidth + 400,
          h: ContainerNode.defaultHeight + 300,
        };
      }
      const targetZoom = Math.max(
        innerZoom,
        (targetRect.w * innerZoom) / (this.canvas.getWidth() - 100),
        (targetRect.h * innerZoom) / (this.canvas.getHeight() - 100)
      );

      const tweenable = new Tweenable();
      tweenable.tween({
        from: { zoom: sourceZoom },
        to: { zoom: targetZoom },
        duration: zoomMoveDuration,
        easing: "easeOutSine",
        step: (state: any) => {
          this.canvas.setZoom(state.zoom, false);

          // Adjust scroll to center, since canvas zoom lacks zoom at center point
          const tp = {
            x: fc.x - cc.x * state.zoom,
            y: fc.y - cc.y * state.zoom,
          };
          area.scrollLeft(tp.x / state.zoom);
          area.scrollTop(tp.y / state.zoom);
        },
        finish: (_: any) => {
          resolve();
        },
      });
    });
  }

  private getContainerDto(canvasDto: CanvasDto): FigureDto {
    const contr = canvasDto.figures.find((f) => f.id === ContainerNode.mainId);
    assert(contr);
    return contr;
  }

  private zoomToShowNormalNode(node: Node, targetZoom: number): Promise<void> {
    return new Promise((resolve) => {
      const area = this.canvas.getScrollArea();
      const sourceZoom = this.canvas.zoomFactor;
      const { x, y, w, h } = {
        x: node.x,
        y: node.y,
        w: node.width,
        h: node.height,
      };

      const fc = { x: x + w / 2, y: y + h / 2 };
      const cc = {
        x: this.canvas.getWidth() / 2,
        y: this.canvas.getHeight() / 2,
      };

      const tweenable = new Tweenable();
      tweenable.tween({
        from: { zoom: sourceZoom },
        to: { zoom: targetZoom },
        duration: zoomMoveDuration * 2,
        easing: "easeOutSine",
        step: (state: any) => {
          this.canvas.setZoom(state.zoom, false);

          // Adjust scroll to center, since canvas zoom lacks zoom at center point
          const tp = {
            x: fc.x - cc.x * state.zoom,
            y: fc.y - cc.y * state.zoom,
          };
          area.scrollLeft(tp.x / state.zoom);
          area.scrollTop(tp.y / state.zoom);
        },
        finish: (_: any) => {
          resolve();
        },
      });
    });
  }
}
