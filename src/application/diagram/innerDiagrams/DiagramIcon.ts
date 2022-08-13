import draw2d from "draw2d";
import Colors from "../Colors";
import Node from "../Node";
import { Canvas2d } from "../draw2dTypes";
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

const imgMargin = 0;

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

    this.setDiagram(parent.id);
  }

  public setCanvas(canvas: Canvas2d) {
    super.setCanvas(canvas);
    if (canvas != null) {
      this.shape?.attr({ cursor: "pointer" });
    }
  }

  public getDiagramViewCoordinate() {
    const canvasZoom = this.canvas.zoomFactor;

    // get the inner diagram pos in canvas view coordinates
    const outerScrollPos = this.getScrollInCanvasCoordinate();

    const vx = (this.getAbsoluteX() - outerScrollPos.left) / canvasZoom;
    const vy = (this.getAbsoluteY() - outerScrollPos.top) / canvasZoom;

    return { left: vx, top: vy };
  }

  public getScrollInCanvasCoordinate() {
    const area = this.canvas.getScrollArea();
    return {
      left: area.scrollLeft() * this.canvas.zoomFactor,
      top: area.scrollTop() * this.canvas.zoomFactor,
    };
  }

  public handleSingleClick() {
    //this.parent.hideInnerDiagram();
  }

  public handleDoubleClick() {
    PubSub.publish("canvas.EditInnerDiagram", this.parent);
  }

  private async setDiagram(id: string): Promise<void> {
    const url = await this.getDiagramUrl(id);
    if (isError(url)) {
      return;
    }

    this.setPath(url);
  }

  private async getDiagramUrl(id: string): Promise<Result<string>> {
    let canvasDto = this.store.tryGetCanvas(id);
    if (isError(canvasDto)) {
      canvasDto = defaultIcon(this.parent);
      this.store.writeCanvas(canvasDto);
    }

    const container = this.getContainerDto(canvasDto);

    const canvas = Canvas.deserializeInnerCanvas(canvasDto);
    this.updateGroupInfo(canvas);
    const svg = canvas.export(
      Node.defaultWidth,
      Node.defaultHeight,
      imgMargin,
      container.rect
    );
    canvas.destroy();

    // Since icons are nested svg with external links, the links must be replaced with
    // the actual icon image as an dataUrl. Let pars unique urls
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
