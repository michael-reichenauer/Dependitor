import draw2d from "draw2d";
import timing from "../../common/timing";
import { addDefaultInnerDiagram } from "./addDefault";
import Connection from "./Connection";
import Group from "./Group";
import Node from "./Node";
import Canvas from "./Canvas";
import CanvasStack from "./CanvasStack";
import { IStore } from "./Store";
import { Figure2d } from "./draw2dTypes";
import { isError } from "../../common/Result";

export default class InnerDiagramCanvas {
  private canvas: Canvas;
  private canvasStack: CanvasStack;
  private store: IStore;

  public constructor(canvas: Canvas, canvasStack: CanvasStack, store: IStore) {
    this.canvas = canvas;
    this.canvasStack = canvasStack;
    this.store = store;
  }

  public editInnerDiagram = (node: Node): void => {
    const t = timing();
    const innerDiagram = node.innerDiagram;
    if (innerDiagram == null) {
      // Figure has no inner diagram, thus nothing to edit
      return;
    }

    // Remember the current outer zoom, which is used when zooming inner diagram
    const outerZoom = this.canvas.zoomFactor;

    // Get the view coordinates of the inner diagram image where the inner diagram should
    // positioned after the switch
    const innerDiagramViewPos = innerDiagram.getDiagramViewCoordinate();

    // Get nodes connected to outer node so they can be re-added in the inner diagram after push
    const connectedNodes = this.getNodesConnectedToOuterNode(node);

    // Hide the inner diagram image from node (will be updated and shown when popping)
    node.hideInnerDiagram();

    // Push current diagram to make room for new inner diagram
    this.canvasStack.pushDiagram();

    // Load inner diagram canvas or a default diagram canvas
    if (!this.load(node.id)) {
      this.canvas.canvasId = node.id;
      addDefaultInnerDiagram(this.canvas, node);
    }

    console.log("loaded diagram", t());
    const groupNode = this.canvas.getFigure(Group.mainId);
    this.updateGroup(groupNode, node);
    this.addOrUpdateConnectedNodes(groupNode, connectedNodes);
    console.log("added connected nodes", t());

    // Zoom inner diagram to correspond to inner diagram image size in the outer node
    // @ts-ignore
    const targetZoom = outerZoom / innerDiagram.innerZoom;

    console.log("zoom", targetZoom);
    this.canvas.setZoom(targetZoom);

    // Scroll inner diagram to correspond to where the inner diagram image in the outer node was
    const innerDiagramRect = this.getInnerDiagramRect(groupNode);
    console.log("innerDiagramRect", innerDiagramRect);
    console.log("this.canvas.zoomFactor", this.canvas.zoomFactor);
    console.log("innerDiagramViewPos", innerDiagramViewPos);

    const left =
      innerDiagramRect.x - innerDiagramViewPos.left * this.canvas.zoomFactor;
    const top =
      innerDiagramRect.y - innerDiagramViewPos.top * this.canvas.zoomFactor;

    console.log("scroll x, y", left, top);
    this.setScrollInCanvasCoordinate(left, top);

    console.log("editInnerDiagram", t());
  };

  public popFromInnerDiagram = (): void => {
    const t = timing();
    const groupNode = this.canvas.getFigure(Group.mainId);

    // Get the inner diagram zoom to use when zooming outer diagram
    const postInnerZoom = this.canvas.zoomFactor;

    // Get inner diagram view position to scroll the outer diagram to same position
    const innerDiagramRect = this.getInnerDiagramRect(groupNode);
    const innerDiagramViewPos = this.fromCanvasToViewCoordinate(
      innerDiagramRect.x,
      innerDiagramRect.y
    );

    // Show outer diagram (closing the inner diagram) (same id as group)
    const outerNodeId = this.canvas.canvasId;

    // const externalNodes = this.getNodesExternalToGroup(groupNode);
    this.canvasStack.popDiagram();

    // Update the nodes inner diagram image in the outer node
    const node = this.canvas.getFigure(outerNodeId);
    node.showInnerDiagram();

    // Zoom outer diagram to correspond to the inner diagram
    const preInnerZoom = this.canvas.zoomFactor / node.innerDiagram.innerZoom;
    const newZoom = this.canvas.zoomFactor * (postInnerZoom / preInnerZoom);
    this.canvas.setZoom(newZoom);

    // get the inner diagram margin in outer canvas coordinates
    const imx = node.innerDiagram.marginX * node.innerDiagram.innerZoom;
    const imy = node.innerDiagram.marginY * node.innerDiagram.innerZoom;

    // Scroll outer diagram to correspond to inner diagram position
    const sx =
      node.x + 2 + imx - innerDiagramViewPos.x * this.canvas.zoomFactor;
    const sy =
      node.y + 2 + imy - innerDiagramViewPos.y * this.canvas.zoomFactor;
    this.setScrollInCanvasCoordinate(sx, sy);

    // this.addOrUpdateExternalNodes(externalNodes, node);

    console.log("popFromInnerDiagram", t());
  };

  private getNodesExternalToGroup(group: Group): any {
    const internalNodes = group.getAboardFigures(true).asArray();
    const externalNodes = this.canvas
      .getFigures()
      .asArray()
      .filter(
        (f: Figure2d) =>
          f !== group &&
          null == internalNodes.find((i: Figure2d) => i.id === f.id)
      );

    return {
      nodes: externalNodes.map((n: any) => {
        return {
          node: n.serialize(),
          connections: this.serializeExternalConnections(n),
        };
      }),
      group: group.serialize(),
    };
  }

  private serializeExternalConnections(node: Node) {
    const ports = node.getPorts().asArray();
    return ports.flatMap((p: any) =>
      p
        .getConnections()
        .asArray()
        .map((c: any) => c.serialize())
    );
  }

  private addOrUpdateExternalNodes(data: any, outerNode: any) {
    outerNode.setName(data.group.name);
    outerNode.setDescription(data.group.description);

    const marginX = 150;
    const marginY = 100;
    data.nodes.forEach((d: any) => {
      let isNewNode = false;
      let node = this.canvas.getFigure(d.node.id);
      if (node != null) {
        // Node already exist, updating data
        node.setName(d.node.name);
        node.setDescription(d.node.description);
        node.setIcon(d.node.icon);
        node.setNodeColor(d.node.color);
      } else {
        // New node needed (will be added below)
        node = Node.deserialize(d.node);
        isNewNode = true;
      }

      d.connections.forEach((c: any) => {
        let connection = this.canvas.getLine(c.id);
        if (connection != null) {
          // Connection already exist, updating data
          connection.setName(c.name);
          connection.setDescription(c.description);
        } else {
          let srcPort = null;
          let trgPort = null;
          let src = null;
          let trg = null;
          let x = node.x;
          let y = node.y;

          if (c.src === node.id) {
            // source is node, target should be outerNode
            src = node;
            trg = outerNode;
            if (c.srcPort === "output0") {
              // from right to left
              srcPort = "output0";
              trgPort = "input0";
              x = outerNode.x - node.width - marginX;
              y = outerNode.y;
            } else {
              // from bottom down to top
              srcPort = "output1";
              trgPort = "input1";
              x = outerNode.x;
              y = outerNode.y - node.height - marginY;
            }
          } else {
            src = outerNode;
            trg = node;
            if (c.trgPort === "input0") {
              // from right to left
              srcPort = "output0";
              trgPort = "input0";
              x = outerNode.x + outerNode.width + marginX;
              y = outerNode.y;
            } else {
              // from bottom down to top
              srcPort = "output1";
              trgPort = "input1";
              x = outerNode.x;
              y = outerNode.y + outerNode.height + marginY;
            }
          }
          if (isNewNode) {
            // Adjust node pos to match connection
            this.canvas.addAtApproximately(node, x, y);
            isNewNode = false;
          }
          // Connection needs to be added
          connection = new Connection(
            c.name,
            c.description,
            src,
            srcPort,
            trg,
            trgPort,
            c.id
          );
          this.canvas.add(connection);
        }
      });

      if (isNewNode) {
        // Add node which did not have a new connection
        const x = outerNode.x - node.width - marginX;
        const y = outerNode.y - node.height - marginY;
        this.canvas.addAtApproximately(node, x, y);
        isNewNode = false;
      }
    });
  }

  private getNodesConnectedToOuterNode(figure: Figure2d) {
    const left = figure
      .getPort("input0")
      .getConnections()
      .asArray()
      .filter((c: any) => c.sourcePort.parent.type !== Group.groupType)
      .map((c: any) => {
        return {
          node: c.sourcePort.parent.serialize(),
          connection: c.serialize(),
        };
      });

    const top = figure
      .getPort("input1")
      .getConnections()
      .asArray()
      .filter((c: any) => c.sourcePort.parent.type !== Group.groupType)
      .map((c: any) => {
        return {
          node: c.sourcePort.parent.serialize(),
          connection: c.serialize(),
        };
      });

    const right = figure
      .getPort("output0")
      .getConnections()
      .asArray()
      .filter((c: any) => c.targetPort.parent.type !== Group.groupType)
      .map((c: any) => {
        return {
          node: c.targetPort.parent.serialize(),
          connection: c.serialize(),
        };
      });

    const bottom = figure
      .getPort("output1")
      .getConnections()
      .asArray()
      .filter((c: any) => c.targetPort.parent.type !== Group.groupType)
      .map((c: any) => {
        return {
          node: c.targetPort.parent.serialize(),
          connection: c.serialize(),
        };
      });

    this.sortNodesOnY(left);
    this.sortNodesOnY(right);
    this.sortNodesOnX(top);
    this.sortNodesOnX(bottom);

    return { left: left, top: top, right: right, bottom: bottom };
  }

  private updateGroup(group: any, node: any) {
    group.setName(node.getName());
    group.setDescription(node.getDescription());
  }

  private addOrUpdateConnectedNodes(group: any, nodes: any) {
    const marginX = 150;
    const marginY = 100;

    const addedNodes = [];

    nodes.left.forEach((data: any, i: number) => {
      const w = data.node.rect.w;
      const h = data.node.rect.h;
      const total = nodes.left.length;
      const p = i * (h + 20) - ((total - 1) * (h + 20)) / 2;
      const x = group.x - w - marginX;
      const y = group.y + group.height / 2 - h / 2 + p;
      const node = this.addConnectedNode(data, x, y);
      this.addConnection(data, node, group);
      addedNodes.push(node);
    });

    nodes.top.forEach((data: any, i: number) => {
      //const w = Node.defaultWidth
      const w = data.node.rect.w;
      const h = data.node.rect.h;
      const total = nodes.top.length;
      const p = i * (w + 20) - ((total - 1) * (w + 20)) / 2;
      const x = group.x + group.width / 2 - w / 2 + p;
      const y = group.y - h - marginY;
      const node = this.addConnectedNode(data, x, y);
      this.addConnection(data, node, group);
      addedNodes.push(node);
    });

    nodes.right.forEach((data: any, i: number) => {
      const h = data.node.rect.h;
      const total = nodes.right.length;
      const p = i * (h + 20) - ((total - 1) * (h + 20)) / 2;
      const x = group.x + group.width + marginX;
      const y = group.y + group.height / 2 - h / 2 + p;
      const node = this.addConnectedNode(data, x, y);
      this.addConnection(data, group, node);
      addedNodes.push(node);
    });

    nodes.bottom.forEach((data: any, i: number) => {
      const w = data.node.rect.w;
      const total = nodes.bottom.length;
      const p = i * (w + 20) - ((total - 1) * (w + 20)) / 2;
      const x = group.x + group.width / 2 - w / 2 + p;
      const y = group.y + group.height + marginY;
      const node = this.addConnectedNode(data, x, y);
      this.addConnection(data, group, node);
      addedNodes.push(node);
    });

    const internalNodes = group.getAboardFigures(true).asArray();
    const externalNodes = this.canvas
      .getFigures()
      .asArray()
      .filter(
        (f: any) =>
          f !== group && null == internalNodes.find((i: any) => i.id === f.id)
      );

    externalNodes.forEach((n: any) => {
      if (n.isConnected) {
        // Node is connected from the outside
        return;
      }

      // Node is not connected from the outside, remove all node connections and the node
      n.getAllConnections().forEach((c: any) => this.canvas.remove(c));
      this.canvas.remove(n);
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

  private load(canvasId: string): boolean {
    console.log("load", canvasId);
    // // @ts-ignore
    const canvasDto = this.store.tryGetCanvas(canvasId);
    if (isError(canvasDto)) {
      return false;
    }

    // Deserialize canvas
    this.canvas.deserialize(canvasDto);
    return true;
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
}
