import * as draw2d from "draw2d";
import { diKey, singleton } from "../../common/di";
import { isError } from "../../common/Result";
import Canvas from "./Canvas";
import Colors from "./Colors";
import { Box } from "./draw2dTypes";

export const ICanvasExporterKey = diKey<ICanvasExporter>();
export interface ICanvasExporter {
  exportSvgDataUrl(
    canvas: Canvas,
    width: number,
    height: number,
    margin: number,
    box?: Box
  ): Promise<string>;

  exportSvgAsync(
    canvas: Canvas,
    width: number,
    height: number,
    margin: number,
    box?: Box
  ): Promise<string>;

  exportSvg(
    canvas: Canvas,
    width: number,
    height: number,
    margin: number,
    rect?: Box
  ): string;
}

@singleton(ICanvasExporterKey)
export class CanvasExporter implements ICanvasExporter {
  private filesCache = new Map<string, string>();

  public async exportSvgDataUrl(
    canvas: Canvas,
    width: number,
    height: number,
    margin: number,
    box?: Box
  ): Promise<string> {
    const svg = await this.exportSvgAsync(canvas, width, height, margin, box);

    return this.svgToSvgDataUrl(svg);
  }

  public async exportSvgAsync(
    canvas: Canvas,
    width: number,
    height: number,
    margin: number,
    box?: Box
  ): Promise<string> {
    const rect = !box ? canvas.getFiguresRect() : box;
    const svgWithLinks = this.exportToSvgWithLinks(
      canvas,
      width,
      height,
      margin,
      rect
    );

    // Since icons are nested svg with external links, the links must be replaced with
    // the actual icon image as an dataUrl. Let parse unique urls
    const nestedSvgPaths = this.parseNestedSvgPaths(svgWithLinks);

    // Fetch the actual icon svg files
    const files = await this.fetchFilesAsync(nestedSvgPaths);
    if (isError(files)) {
      console.error("Failed to get all svg files", files);
      return "";
    }

    // Replace all the links with dataUrl of the files.
    const svg = this.replacePathsWithSvgDataUrls(
      svgWithLinks,
      nestedSvgPaths,
      files
    );

    return svg;
  }

  public exportSvg(
    canvas: Canvas,
    width: number,
    height: number,
    margin: number,
    box?: Box
  ): string {
    const rect = !box ? canvas.getFiguresRect() : box;
    const svg = this.exportToSvgWithLinks(canvas, width, height, margin, rect);

    return svg;
  }

  private exportToSvgWithLinks(
    canvas: Canvas,
    width: number,
    height: number,
    margin: number,
    rect: Box
  ): string {
    const writer = new draw2d.io.svg.Writer();

    let svgText = "";
    writer.marshal(canvas, (svg: string) => {
      // console.log('svg org:', svg)

      const areaWidth = width + margin * 2;
      const areaHeight = height + margin * 2;
      if (rect.w < areaWidth && rect.h < areaHeight) {
        // Image smaller than area; Center image and resize to normal size
        const xd = areaWidth - rect.w;
        const yd = areaHeight - rect.h;

        rect.x = rect.x - xd / 2;
        rect.y = rect.y - yd / 2;
        rect.w = rect.w + xd;
        rect.h = rect.h + yd;
      } else {
        // Image larger than area; Resize and add margin for image larger than area
        rect.x = rect.x - margin;
        rect.y = rect.y - margin;
        rect.w = rect.w + margin * 2;
        rect.h = rect.h + margin * 2;
      }

      // Svg header with size and view box
      const prefix = `<svg width="${width}" height="${height}" version="1.1" viewBox="${rect.x} ${rect.y} ${rect.w} ${rect.h}" `;

      // Replace svg size with size and view box
      const index = svg.indexOf('xmlns="http://www.w3.org/2000/svg"');
      let res = prefix + svg.substr(index);

      // Adjust style for color and page brake
      res = res.replace(
        'style="',
        `style="background-color:${Colors.canvasDivBackground};`
      );
      res = res.replace('style="', `style="page-break-after: always;`);

      // Remove org view box (if it exists)
      res = res.replace('viewBox="0 0 10000 10000"', "");

      svgText = res;
    });

    return svgText;
  }

  private svgToSvgDataUrl(svg: string): string {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  private parseNestedSvgPaths(text: string): string[] {
    const regexp = new RegExp('xlink:href="/static/media[^"]*', "g");

    let uniquePaths: string[] = [];

    let match;
    while ((match = regexp.exec(text)) !== null) {
      const ref = `${match[0]}`;
      const path = ref.substring(12);
      if (!uniquePaths.includes(path)) {
        uniquePaths.push(path);
      }
    }
    return uniquePaths;
  }

  private async fetchFilesAsync(paths: string[]): Promise<string[]> {
    try {
      const cachedFiles: string[] = [];
      const retrievePaths: string[] = [];

      // Get cached files and paths that needs to be retrieved
      paths.forEach((path) => {
        const file = this.filesCache.get(path);
        if (file !== undefined) {
          cachedFiles.push(file);
        } else {
          retrievePaths.push(path);
        }
      });

      const retrievedFiles = await Promise.all(
        retrievePaths.map((path) => this.fetchFile(path))
      );

      return cachedFiles.concat(retrievedFiles);
    } catch (error) {
      console.log("Error", error);
      return [];
    }
  }

  private async fetchFile(path: string): Promise<string> {
    try {
      const response = await fetch(path);
      const file = await response.text();
      this.filesCache.set(path, file);
      return file;
    } catch (error) {
      console.log("Error: getting", path, error);
      return "";
    }
  }

  private replacePathsWithSvgDataUrls(
    svgText: string,
    paths: string[],
    svgImages: string[]
  ): string {
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const svgImage = svgImages[i];
      const svgDataUrl =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgImage);
      svgText = svgText.replaceAll(
        `xlink:href="${path}"`,
        `xlink:href="${svgDataUrl}"`
      );
    }
    return svgText;
  }
}
