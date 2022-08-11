import draw2d from "draw2d";
import Colors from "./Colors";
import Node from "./Node";
import { Canvas2d } from "./draw2dTypes";
import Result, { isError } from "../../common/Result";
import { IStoreKey } from "./Store";
import { di } from "../../common/di";
import {
  fetchFilesAsync,
  parseNestedSvgPaths,
  replacePathsWithSvgDataUrls,
  svgToSvgDataUrl,
} from "../../utils/utils";
import Canvas from "./Canvas";
import Group from "./Group";

const imgMargin = 0;

const defaultFigure = (node: Node) => ({
  id: node.id,
  rect: {
    x: 49800,
    y: 49800,
    w: 400,
    h: 400,
    x2: 50200,
    y2: 50200,
  },
  figures: [
    {
      type: "group",
      id: "mainId",
      rect: {
        x: 49800,
        y: 49800,
        w: 400,
        h: 400,
      },
      name: node.getName(),
      description: node.getDescription(),
      color: "None",
      zOrder: 0,
      icon: node.iconName,
      sticky: true,
    },
  ],
  connections: [],
});

export default class InnerDiagramFigure extends draw2d.shape.basic.Image {
  private static innerPadding = 2;
  private parent: Node;

  public constructor(parent: Node, private store = di(IStoreKey)) {
    super({
      path: "",
      width: parent.width - InnerDiagramFigure.innerPadding * 2,
      height: parent.height - InnerDiagramFigure.innerPadding * 2,
      color: Colors.canvasText,
      bgColor: Colors.canvasBackground,
      radius: 5,
    });

    this.innerZoom = 0.14; // calculate real !!!!
    this.parent = parent;
    this.setDiagram(parent.id);
    this.marginX = 0;
    this.marginY = 0;
  }

  public setCanvas(canvas: Canvas2d) {
    super.setCanvas(canvas);
    if (canvas != null) {
      this.shape?.attr({ cursor: "pointer" });
    }
  }

  public getDiagramViewCoordinate() {
    const canvasZoom = this.canvas.zoomFactor;

    // get the diagram margin in canvas coordinates
    const imx = this.marginX * this.innerZoom;
    const imy = this.marginY * this.innerZoom;

    // get the inner diagram pos in canvas view coordinates
    const outerScrollPos = this.getScrollInCanvasCoordinate();

    const vx = (this.getAbsoluteX() + imx - outerScrollPos.left) / canvasZoom;
    const vy = (this.getAbsoluteY() + imy - outerScrollPos.top) / canvasZoom;

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
      canvasDto = defaultFigure(this.parent);
    }

    this.canvasDto = canvasDto;

    const group = canvasDto.figures.find((f) => f.id === Group.mainId);

    const svg = Canvas.exportAsSvg(
      canvasDto,
      Node.defaultWidth,
      Node.defaultHeight,
      imgMargin,
      group?.rect
    );

    const innerWidth = group?.rect.w ?? Group.defaultWidth;
    this.innerZoom = this.width / innerWidth;

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
}
