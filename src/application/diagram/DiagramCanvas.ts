import "import-jquery";
import "jquery-ui-bundle";
import "jquery-ui-bundle/jquery-ui.css";
import PubSub from "pubsub-js";
import {
  imgDataUrlToPngDataUrl,
  publishAsDownload,
  random,
} from "../../utils/utils";
import Node from "./Node";
import { IStore, IStoreKey } from "./Store";
import Canvas from "./Canvas";
import CanvasStack from "./innerDiagrams/CanvasStack";
import { zoomAndMoveShowTotalDiagram } from "./showTotalDiagram";
import { addDefaultNewDiagram, addFigureToCanvas } from "./addDefault";
import InnerDiagram from "./innerDiagrams/InnerDiagram";
import Printer from "../../common/Printer";
import { setErrorMessage, setInfoMessage } from "../../common/MessageSnackbar";
import NodeGroup from "./NodeGroup";
import { greenNumberIconKey } from "../../common/icons";
import NodeNumber from "./NodeNumber";
import { svgToSvgDataUrl, fetchFiles } from "../../utils/utils";
import { Canvas2d } from "./draw2dTypes";
import { isError } from "../../common/Result";
import { DiagramDto } from "./StoreDtos";
import { di } from "./../../common/di";
import ContainerNode from "./innerDiagrams/ContainerNode";

const a4Width = 793.7007874; // "210mm" A4
const a4Height = 1046.9291339; // "277mm" A4
const a4Margin = 50;
const imgMargin = 5;

export default class DiagramCanvas {
  static defaultWidth = 100000;
  static defaultHeight = 100000;

  canvasStack: CanvasStack;
  private store: IStore = di(IStoreKey);
  inner: InnerDiagram;
  diagramId: string = "";
  diagramName: string = "";

  canvas: Canvas;
  callbacks: any;

  constructor(htmlElementId: string, callbacks: any) {
    this.callbacks = callbacks;
    this.canvas = new Canvas(
      htmlElementId,
      this.onEditMode,
      DiagramCanvas.defaultWidth,
      DiagramCanvas.defaultHeight
    );
    this.canvasStack = new CanvasStack(this.canvas);
    this.inner = new InnerDiagram(this.canvas, this.canvasStack);
  }

  init() {
    this.loadInitialDiagram();

    this.registerClickHandler(this.canvas);
    this.handleEditChanges(this.canvas);
    this.registerSelectHandler(this.canvas);
    this.handleCommands();
  }

  delete() {
    this.canvas.destroy();
  }

  handleCommands = () => {
    PubSub.subscribe("canvas.Undo", () => this.commandUndo());
    PubSub.subscribe("canvas.Redo", () => this.commandRedo());

    PubSub.subscribe("canvas.AddNode", (_, data) => this.addNode(data));
    PubSub.subscribe("canvas.ShowTotalDiagram", this.showTotalDiagram);

    PubSub.subscribe("canvas.EditInnerDiagram", this.commandEditInnerDiagram);
    PubSub.subscribe("canvas.TuneSelected", (_, data) =>
      this.commandTuneSelected(data.x, data.y)
    );
    PubSub.subscribe("canvas.ShowContextMenu", (_, data) =>
      this.commandShowContextMenu(data)
    );
    PubSub.subscribe("canvas.PopInnerDiagram", this.commandPopFromInnerDiagram);

    PubSub.subscribe("canvas.SetEditMode", (_, isEditMode) =>
      this.canvas.panPolicy.setEditMode(isEditMode)
    );
    PubSub.subscribe("canvas.NewDiagram", this.commandNewDiagram);
    PubSub.subscribe("canvas.OpenDiagram", this.commandOpenDiagram);
    PubSub.subscribe("canvas.RenameDiagram", this.commandRenameDiagram);
    PubSub.subscribe("canvas.DeleteDiagram", this.commandDeleteDiagram);
    PubSub.subscribe("canvas.SaveDiagramToFile", this.commandSaveToFile);
    PubSub.subscribe("canvas.Save", () => this.save());
    PubSub.subscribe("canvas.OpenFile", this.commandOpenFile);
    PubSub.subscribe("canvas.ArchiveToFile", this.commandArchiveToFile);
    PubSub.subscribe("canvas.Print", this.commandPrint);
    PubSub.subscribe("canvas.Export", (_, data) => this.commandExport(data));
  };

  commandUndo = () => {
    this.canvas.getCommandStack().undo();
    this.save();
  };

  commandRedo = () => {
    this.canvas.getCommandStack().redo();
  };

  commandNewDiagram = async () => {
    //store.loadFile(file => console.log('File:', file))
    console.log("Command new diagram");
    this.canvas.clearDiagram();

    this.showNewDiagram();
  };

  commandOpenDiagram = async (_msg: string, diagramId: string) => {
    console.log("open", diagramId);
    const diagramDto = await this.store.tryOpenDiagram(diagramId);
    if (isError(diagramDto)) {
      setErrorMessage("Failed to load diagram");
      return;
    }

    this.canvas.clearDiagram();
    this.showDiagram(diagramDto);
  };

  commandRenameDiagram = async (_msg: string, name: string) => {
    this.setName(name);
    this.save();
  };

  commandDeleteDiagram = async () => {
    this.store.deleteDiagram(this.diagramId);
    this.canvas.clearDiagram();

    await this.showRecentDiagramOrNew();
  };

  commandSaveToFile = () => {
    this.store.saveDiagramToFile();
  };

  commandOpenFile = async () => {
    const diagramId = await this.store.loadDiagramFromFile();
    if (isError(diagramId)) {
      setErrorMessage("Failed to load file");
      return;
    }

    this.commandOpenDiagram("", diagramId);
  };

  commandArchiveToFile = async () => {
    try {
      this.store.saveAllDiagramsToFile();
    } catch (error) {
      setErrorMessage("Failed to save all diagram");
    }
  };

  commandPrint = () => {
    const diagram = this.store.exportDiagram();
    const pages: string[] = Object.values(diagram.canvases).map((d) =>
      Canvas.exportDtoAsSvg(d, a4Width, a4Height, a4Margin)
    );

    const printer = new Printer();
    printer.print(pages);
  };

  commandExport = (data: any) => {
    const diagram = this.store.exportDiagram();
    const diagramName = diagram.name;
    const rect = this.canvas.getFiguresRect();
    const imgWidth = rect.w + imgMargin * 2;
    const imgHeight = rect.h + imgMargin * 2;

    let pages: string[] = Object.values(diagram.canvases).map((d) =>
      this.canvas.exportAsSvg(d, imgWidth, imgHeight, imgMargin)
    );
    console.log("pages", pages);
    let svgText = pages[0];

    // Since icons are nested svg with external links, the links must be replaced with
    // the actual icon image as an dataUrl. Let pars unique urls
    const nestedSvgPaths = this.parseNestedSvgPaths(svgText);
    console.log("nestedPaths", nestedSvgPaths);

    // Fetch the actual icon svg files
    fetchFiles(nestedSvgPaths, (files) => {
      // Replace all the links with dataUrl of the files.
      svgText = this.replacePathsWithSvgDataUrls(
        svgText,
        nestedSvgPaths,
        files
      );

      // Make one svgDataUrl of the diagram
      let svgDataUrl = svgToSvgDataUrl(svgText);

      if (data.type === "png") {
        imgDataUrlToPngDataUrl(
          svgDataUrl,
          imgWidth,
          imgHeight,
          (pngDataUrl) => {
            publishAsDownload(pngDataUrl, `${diagramName}.png`);
          }
        );
      } else if (data.type === "svg") {
        publishAsDownload(svgDataUrl, `${diagramName}.svg`);
      }
    });
  };

  parseNestedSvgPaths(text: string) {
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

  replacePathsWithSvgDataUrls(
    svgText: string,
    paths: string[],
    svgImages: string[]
  ) {
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

  commandEditInnerDiagram = (_msg: string, figure: any) => {
    this.inner.editInnerDiagram(figure);
    this.callbacks.setTitle(this.diagramName);
    this.updateToolbarButtonsStates();
    this.save();
  };

  commandTuneSelected = (x: number, y: number) => {
    // Get target figure or use canvas as target
    let target = this.canvas.getSelection().primary;

    if (typeof target?.getContextMenuItems !== "function") {
      // No context menu on target
      return;
    }

    const menuItems = target.getContextMenuItems();
    this.callbacks.setContextMenu({ items: menuItems, x: x, y: y });
  };

  commandShowContextMenu = (menu: any) => {
    this.callbacks.setContextMenu(menu);
  };

  commandPopFromInnerDiagram = () => {
    this.save();
    this.inner.popFromInnerDiagram();
    this.callbacks.setTitle(this.diagramName);
    this.updateToolbarButtonsStates();
    this.save();
  };

  onEditMode = (isEditMode: boolean) => {
    this.callbacks.setEditMode(isEditMode);
    if (!isEditMode) {
      this.callbacks.setSelectMode(false);
    }

    if (!isEditMode) {
      // Remove grid
      this.canvas.setNormalBackground();
      return;
    }
  };

  showTotalDiagram = () => zoomAndMoveShowTotalDiagram(this.canvas);
  showTotalDiagramSlow = () => zoomAndMoveShowTotalDiagram(this.canvas, 2000);

  addNode = (data: any) => {
    if (data.group) {
      this.addGroup(data.icon, data.position);
      return;
    }

    if (data.icon === greenNumberIconKey) {
      this.addNumber(data);
      return;
    }
    var { icon, position } = data;
    if (!position) {
      position = this.getCenter();
    }

    var options = null;
    if (icon) {
      options = { icon: icon };
    }

    const node = new Node(options);
    const x = position.x - node.width / 2;
    const y = position.y - node.height / 2;

    addFigureToCanvas(this.canvas, node, x, y);
  };

  addGroup = (icon: any, position: any) => {
    const group = new NodeGroup({ icon: icon });
    var x = 0;
    var y = 0;

    if (!position) {
      position = this.getCenter();
      x = position.x - group.width / 2;
      y = position.y - 20;
    } else {
      x = position.x - 20;
      y = position.y - 20;
    }

    addFigureToCanvas(this.canvas, group, x, y);
  };

  addNumber = (data: any) => {
    var { position } = data;
    if (!position) {
      position = this.getCenter();
    }

    const node = new NodeNumber();
    const x = position.x - node.width / 2;
    const y = position.y - node.height / 2;

    addFigureToCanvas(this.canvas, node, x, y);
  };

  tryGetFigure = (x: number, y: number) => {
    let cp = this.canvas.fromDocumentToCanvasCoordinate(x, y);
    let figure = this.canvas.getBestFigure(cp.x, cp.y);
    return figure;
  };

  save() {
    // Serialize canvas figures and connections into canvas data object
    const canvasData = this.canvas.serialize();
    this.store.writeCanvas(canvasData);
  }

  onRemoteChanged = async () => {
    setInfoMessage("Updated with changes form other devices");
    this.canvas.clearDiagram();

    await this.showRecentDiagramOrNew();
  };

  async loadInitialDiagram() {
    this.store.configure({ onRemoteChanged: this.onRemoteChanged });

    await this.showRecentDiagramOrNew();
  }

  async showRecentDiagramOrNew(): Promise<void> {
    // Try open most resent diagram
    const diagramDto = await this.store.tryOpenMostResentDiagram();
    if (isError(diagramDto)) {
      // No resent diagram, show a new diagram
      this.showNewDiagram();
      return;
    }

    this.showDiagram(diagramDto);
  }

  showDiagram(diagramDto: DiagramDto) {
    const canvasDto = this.store.getRootCanvas();
    this.canvas.deserialize(canvasDto);
    this.diagramId = diagramDto.id;
    this.diagramName = diagramDto.name;
    this.canvas.canvasId = "root";
    this.callbacks.setTitle(diagramDto.name);

    this.showTotalDiagram();
  }

  async showNewDiagram() {
    const diagramDto = this.store.openNewDiagram();

    this.diagramId = diagramDto.id;
    this.diagramName = diagramDto.name;
    this.canvas.canvasId = "root";

    addDefaultNewDiagram(this.canvas);
    this.save();

    this.callbacks.setTitle(this.diagramName);
    this.showTotalDiagram();
  }

  async deactivated() {}

  async activated() {}

  getCenter() {
    let x =
      (this.canvas.getWidth() / 2 +
        random(-10, 10) +
        this.canvas.getScrollLeft()) *
      this.canvas.getZoom();
    let y =
      (400 + random(-10, 10) + this.canvas.getScrollTop()) *
      this.canvas.getZoom();

    return { x: x, y: y };
  }

  handleEditChanges(canvas: Canvas2d) {
    this.updateToolbarButtonsStates();

    canvas.commandStack.addEventListener((e: any) => {
      // console.log('change event:', e)
      this.updateToolbarButtonsStates();

      if (e.isPostChangeEvent()) {
        if (e.action === "POST_EXECUTE") {
          // console.log('save')
          this.save();
        }
      }
    });
  }

  setName(name: string) {
    this.diagramName = name;
    this.store.setDiagramName(name);
    this.callbacks.setTitle(name);
  }

  updateToolbarButtonsStates() {
    this.callbacks.setCanPopDiagram(!this.canvasStack.isRoot());
    this.callbacks.setCanUndo(this.canvas.getCommandStack().canUndo());
    this.callbacks.setCanRedo(this.canvas.getCommandStack().canRedo());
  }

  registerClickHandler(canvas: Canvas2d) {
    // The dblClick event handler reacts often also for click and drag, so here is workaround
    canvas.on(
      "click",
      this.clickHandler(
        (_src: any, e: any) => this.handleSingleClick(e),
        (_src: any, e: any) => this.handleDoubleClick(e)
      )
    );
  }

  private handleSingleClick(e: any) {
    if (this.handleFigureSingleClick(e.figure)) {
      return;
    }
  }

  private handleDoubleClick(e: any) {
    if (e.figure?.id === ContainerNode.mainId) {
      // Double click on group node
      this.showAddNodeDialog(e.x, e.y);
      return;
    }

    if (this.handleFigureDoubleClick(e.figure)) {
      return;
    }

    // Double click on root canvas
    this.showAddNodeDialog(e.x, e.y);
  }

  showAddNodeDialog(x: number, y: number) {
    PubSub.publish("nodes.showDialog", {
      add: true,
      x: x,
      y: y,
    });
  }

  registerSelectHandler(canvas: Canvas2d) {
    canvas.on("select", (_emitter: any, event: any) => {
      if (event.figure !== null) {
        this.callbacks.setSelectMode(true);
      } else {
        this.callbacks.setSelectMode(false);
      }
    });
  }

  private handleFigureDoubleClick(figure: any): boolean {
    if (!figure) {
      return false;
    }
    for (let f = figure; f; f = f.parent) {
      if (f.handleDoubleClick instanceof Function) {
        f.handleDoubleClick();
        return true;
      }
    }
    return false;
  }

  private handleFigureSingleClick(figure: any): boolean {
    if (!figure) {
      return false;
    }
    for (let f = figure; f; f = f.parent) {
      if (f.handleSingleClick instanceof Function) {
        f.handleSingleClick();
        return true;
      }
    }
    return false;
  }

  private clickHandler(
    onSingleClick: ((src: any, e: any) => void) | null,
    onDoubleClick?: (src?: any, e?: any) => void
  ) {
    let clickTimeout: any = null;
    let clicks = 0;

    return (src: any, e: any) => {
      clearTimeout(clickTimeout);
      clicks++;
      //console.log('click #', clicks)
      if (clicks === 1) {
        clickTimeout = setTimeout(() => {
          // single click
          clearTimeout(clickTimeout);
          clicks = 0;
          onSingleClick?.(src, e);
        }, 300);
      } else if (clicks === 2) {
        // Double click
        // console.log('click time ', (performance.now() - this.clickTime).toFixed(1))
        clicks = 0;
        onDoubleClick?.(src, e);
      }
    };
  }
}
