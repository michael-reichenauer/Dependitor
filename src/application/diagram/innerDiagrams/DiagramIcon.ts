import draw2d from "draw2d";
import Colors from "../Colors";
import Node from "../Node";
import Result, { isError } from "../../../common/Result";
import { IStoreKey } from "../Store";
import { di } from "../../../common/di";
import {
  fetchFilesAsync,
  parseNestedSvgPaths,
  replacePathsWithSvgDataUrls,
  svgToSvgDataUrl,
} from "../../../utils/utils";
import Canvas from "../Canvas";
import ContainerNode from "./ContainerNode";
import { defaultIcon } from "./defaultDiagram";
import { CanvasDto, FigureDto } from "../StoreDtos";
import assert from "assert";

// DiagramIcon is an svg icon of the inner diagram for a node
export default class DiagramIcon extends draw2d.shape.basic.Image {
  private static innerPadding = 2;

  public constructor(readonly parent: Node, private store = di(IStoreKey)) {
    super({
      path: "",
      width: parent.width - DiagramIcon.innerPadding * 2,
      height: parent.height - DiagramIcon.innerPadding * 2,
      color: Colors.canvasText,
      bgColor: Colors.canvasBackground,
      radius: 5,
    });

    this.setDiagramAsync(parent.id);
  }

  public handleDoubleClick() {
    // Shortcut for starting to edit the inner diagram
    PubSub.publish("canvas.EditInnerDiagram", this.parent);
  }

  // setDiagramAsync loads the diagram and creates a svg, which can be shown
  private async setDiagramAsync(id: string): Promise<void> {
    const url = await this.getDiagramSvgImageUrl(id);
    if (isError(url)) {
      return;
    }

    // Show the actual svg image in this icon
    this.setPath(url);
  }

  // getDiagramSvgImageUrl returns a svg image in url format
  private async getDiagramSvgImageUrl(id: string): Promise<Result<string>> {
    let canvasDto = this.store.tryGetCanvas(id);
    if (isError(canvasDto)) {
      canvasDto = defaultIcon(this.parent);
      this.store.writeCanvas(canvasDto);
    }

    const svg = this.createSvg(canvasDto);

    // Since icons are nested svg with external links, the links must be replaced with
    // the actual icon image as an dataUrl. Let parse unique urls
    const nestedSvgPaths = parseNestedSvgPaths(svg);

    // Fetch the actual icon svg files
    const files = await fetchFilesAsync(nestedSvgPaths);
    if (isError(files)) {
      return files;
    }

    // Replace all the links with dataUrl of the files.
    const svgData = replacePathsWithSvgDataUrls(svg, nestedSvgPaths, files);
    // Make one svgDataUrl of the diagram
    return svgToSvgDataUrl(svgData);
  }

  private createSvg(canvasDto: CanvasDto): string {
    const container = this.getContainerDto(canvasDto);

    const canvas = Canvas.deserializeInnerCanvas(canvasDto);

    // Update container node with latest info
    this.updateGroupInfo(canvas);

    const svg = canvas.export(
      Node.defaultWidth,
      Node.defaultHeight,
      0,
      container.rect
    );
    canvas.destroy();

    return svg;
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
