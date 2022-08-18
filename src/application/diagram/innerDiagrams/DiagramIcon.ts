import draw2d from "draw2d";
import Colors from "../Colors";
import Node from "../Node";
import Result, { isError } from "../../../common/Result";
import { IStoreKey } from "../Store";
import { di } from "../../../common/di";
import Canvas from "../Canvas";
import ContainerNode from "./ContainerNode";
import { defaultIcon } from "./defaultDiagram";
import { CanvasDto, FigureDto } from "../StoreDtos";
import assert from "assert";
import { ICanvasExporterKey } from "../CanvasExporter";
import { ICanvasSerializerKey } from "../CanvasSerializer";

// DiagramIcon is an svg icon of the inner diagram for a node
export default class DiagramIcon extends draw2d.shape.basic.Image {
  private static innerPadding = 2;

  public constructor(
    readonly parent: Node,
    private store = di(IStoreKey),
    private canvasExporter = di(ICanvasExporterKey),
    private serializer = di(ICanvasSerializerKey)
  ) {
    super({
      path: "",
      width: parent.width - DiagramIcon.innerPadding * 2,
      height: parent.height - DiagramIcon.innerPadding * 2,
      color: Colors.canvasText,
      bgColor: Colors.canvasBackground,
      radius: 5,
    });

    //this.setDiagramAsync(parent.id);
  }

  // public handleDoubleClick() {
  //   // Shortcut for starting to edit the inner diagram
  //   PubSub.publish("canvas.EditInnerDiagram", this.parent);
  // }

  // setDiagramAsync loads the diagram and creates a svg, which can be shown
  public async setDiagram(): Promise<void> {
    const url = await this.getDiagramSvgImageUrl(this.parent.id);
    if (isError(url)) {
      return;
    }

    // Show the actual svg image in this icon
    this.setPath(url);
  }

  // getDiagramSvgImageUrl returns a svg image in url format
  private async getDiagramSvgImageUrl(id: string): Promise<Result<string>> {
    const canvasDto = this.getCanvasDto(id);
    const containerDto = this.getContainerDto(canvasDto);

    const canvas = this.serializer.deserializeNewCanvas(canvasDto);

    // Update container node with latest info
    this.updateGroupInfo(canvas);

    // Export to svg url
    const svg = await this.canvasExporter.exportSvgDataUrl(
      canvas,
      Node.defaultWidth,
      Node.defaultHeight,
      0,
      containerDto.rect
    );
    canvas.destroy();

    return svg;
  }

  private getCanvasDto(id: string): CanvasDto {
    let canvasDto = this.store.tryGetCanvas(id);
    if (isError(canvasDto)) {
      canvasDto = defaultIcon(this.parent);
    }

    return canvasDto;
  }

  private getContainerDto(canvasDto: CanvasDto): FigureDto {
    const contr = canvasDto.figures.find((f) => f.id === ContainerNode.mainId);
    assert(contr);
    return contr;
  }

  private updateGroupInfo(canvas: Canvas): void {
    const group = canvas.getFigure(ContainerNode.mainId);
    group.setName(this.parent.getName());
    group.setDescription(this.parent.getDescription());
    group.setIcon(this.parent.iconName);
  }
}
