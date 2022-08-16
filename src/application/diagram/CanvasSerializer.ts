import Connection from "./Connection";
import ContainerNode from "./innerDiagrams/ContainerNode";
import Node from "./Node";
import NodeGroup from "./NodeGroup";
import NodeNumber from "./NodeNumber";
import Canvas from "./Canvas";
import { Figure2d, Line2d } from "./draw2dTypes";
import { CanvasDto, ConnectionDto, FigureDto } from "./StoreDtos";
import { diKey, singleton } from "../../common/di";
import DiagramCanvas from "./DiagramCanvas";

export const ICanvasSerializerKey = diKey<ICanvasSerializer>();
export interface ICanvasSerializer {
  deserializeNewCanvas(canvasDto: CanvasDto): Canvas;
  serialize(canvas: Canvas): CanvasDto;
  deserialize(canvas: Canvas, canvasDto: CanvasDto): void;
}

@singleton(ICanvasSerializerKey)
export default class CanvasSerializer {
  public deserializeNewCanvas(canvasDto: CanvasDto): Canvas {
    const canvas = new Canvas(
      "canvasPrint",
      () => {},
      DiagramCanvas.defaultWidth,
      DiagramCanvas.defaultHeight
    );

    this.deserialize(canvas, canvasDto);
    return canvas;
  }

  public serialize(canvas: Canvas): CanvasDto {
    const canvasDto: CanvasDto = {
      id: canvas.canvasId ?? "",
      rect: canvas.getFiguresRect(),
      figures: this.serializeFigures(canvas),
      connections: this.serializeConnections(canvas),
    };

    return canvasDto;
  }

  public deserialize(canvas: Canvas, canvasDto: CanvasDto): void {
    canvas.canvasId = canvasDto.id;

    const figures = this.deserializeFigures(canvasDto.figures);
    canvas.addAll(figures);

    const connections = this.deserializeConnections(
      canvas,
      canvasDto.connections
    );
    canvas.addAll(connections);
  }

  private serializeFigures = (canvas: Canvas): FigureDto[] => {
    const figures = canvas.getFigures().clone();
    figures.sort((a: Figure2d, b: Figure2d) => {
      // return 1  if a before b
      // return -1 if b before a
      return a.getZOrder() > b.getZOrder() ? 1 : -1;
    });

    return figures
      .asArray()
      .map((figure: Figure2d): FigureDto => figure.serialize());
  };

  private deserializeFigures = (figures: FigureDto[]): Figure2d[] => {
    return figures
      .map((f: FigureDto): Figure2d => this.deserializeFigure(f))
      .filter((f: Figure2d) => f != null);
  };

  private deserializeFigure = (f: FigureDto): Figure2d => {
    let figure;
    if (f.type === ContainerNode.nodeType) {
      figure = ContainerNode.deserialize(f);
    } else if (f.type === NodeGroup.nodeType) {
      figure = NodeGroup.deserialize(f);
    } else if (f.type === NodeNumber.nodeType) {
      figure = NodeNumber.deserialize(f);
    } else {
      figure = Node.deserialize(f);
    }

    figure.x = f.rect.x;
    figure.y = f.rect.y;
    return figure;
  };

  private serializeConnections(canvas: Canvas): ConnectionDto[] {
    return canvas
      .getLines()
      .asArray()
      .map((connection: Line2d) => connection.serialize());
  }

  private deserializeConnections(
    canvas: Canvas,
    connections: ConnectionDto[]
  ): Line2d[] {
    return connections
      .map((c: ConnectionDto) => Connection.deserialize(canvas, c))
      .filter((c: Line2d) => c != null);
  }
}
