import draw2d from "draw2d";
import cuid from "cuid";
import { menuItem } from "../../common/Menus";
import Colors from "./Colors";
import { icons, noImageIconKey } from "../../common/icons";
import PubSub from "pubsub-js";
import { LabelEditor } from "./LabelEditor";
import CommandChangeColor from "./CommandChangeColor";
import { Canvas2d, Figure2d, Point } from "./draw2dTypes";
import { FigureDto } from "./StoreDtos";
import { Toolbar } from "./Toolbar";

const defaultOptions = () => {
  return {
    id: cuid(),
    width: Group.defaultWidth,
    height: Group.defaultHeight,
    description: "",
    icon: "Default",
    sticky: false,
    colorName: "None",
  };
};

export default class Group extends draw2d.shape.basic.Rectangle {
  static mainId = "mainId";
  static nodeType = "group";
  static defaultWidth = 400;
  static defaultHeight = 400;

  type = Group.nodeType;
  nameLabel: Figure2d;
  descriptionLabel: Figure2d;
  colorName: string;
  private toolBar: Toolbar;

  getName = () => this.nameLabel?.text ?? "";
  getDescription = () => this.descriptionLabel?.text ?? "";

  constructor(options?: any) {
    super({
      id: options?.id ?? cuid(),
      stroke: 2,
      alpha: 1,
      color: Colors.canvasText,
      radius: 5,
      glow: true,
    });
    const o = { ...defaultOptions(), ...options };
    const color = Colors.getBackgroundColor(o.colorName);
    this.attr({
      width: o.width,
      height: o.height,
      bgColor: color,
    });

    if (o.name === undefined || o.name === null) {
      const ic = icons.getIcon(o.icon);
      o.name = ic.key !== noImageIconKey ? ic.name : "Name";
    }

    this.colorName = o.colorName;
    this.addIcon(o.icon);
    this.addLabels(o.name, o.description);
    this.addPorts();

    // this.on("click", (s, e) => console.log('click node'))
    this.on("dblclick", (_s: any, _e: any) => {});
    this.on("resize", (_s: any, _e: any) => {});

    this.toolBar = new Toolbar(this);
    this.on("select", () => {});
    this.on("unselect", () => {});

    // Adjust selection handle sizes
    const selectionPolicy = this.editPolicy.find(
      (p: any) =>
        p instanceof draw2d.policy.figure.RectangleSelectionFeedbackPolicy
    );
    if (selectionPolicy != null) {
      selectionPolicy.createResizeHandle = (owner: any, type: any) => {
        return new draw2d.ResizeHandle({
          owner: owner,
          type: type,
          width: 15,
          height: 15,
        });
      };
    }
  }

  static deserialize(data: FigureDto) {
    return new Group({
      id: data.id,
      width: data.rect.w,
      height: data.rect.h,
      name: data.name,
      description: data.description,
      colorName: data.color,
      icon: data.icon,
      sticky: data.sticky,
    });
  }

  serialize(): FigureDto {
    const sticky = this.getAboardFigures === this.getAboardFiguresOrg;

    return {
      type: this.type,
      id: this.id,
      rect: { x: this.x, y: this.y, w: this.width, h: this.height },
      name: this.getName(),
      description: this.getDescription(),
      color: this.colorName,
      zOrder: this.getZOrder(),
      icon: this.iconName,
      sticky: sticky,
    };
  }

  getConfigMenuItems() {
    return [
      menuItem(
        "Delete node",
        () => this.canvas.runCmd(new draw2d.command.CommandDelete(this)),
        this.canDelete
      ),
    ];
  }

  getBackgroundColorMenuItems() {
    return Colors.backgroundColorNames().map((name) => {
      return menuItem(name, () =>
        this.canvas.runCmd(new CommandChangeColor(this, name))
      );
    });
  }

  public getToolbarLocation(): Point {
    return { x: 0, y: -35 };
  }

  setName(name: string) {
    this.nameLabel?.setText(name);
  }

  setDescription(name: string) {
    this.descriptionLabel?.setText(name);
  }

  resizeToContainInnerIcons() {
    // Get the original bounding box for the inner diagram container node
    const o = this.getBoundingBox();

    // Get the rect which contains all inner icons (exclude external and container node)
    const r = this.canvas.getFiguresRect(
      (f: Figure2d) => !f.isConnected && !(f instanceof Group)
    );

    // Make rect a square form (with default minimal size)
    const mwh = Math.max(Group.defaultHeight, Group.defaultWidth, r.h, r.w);

    // New bounding box for the inner diagram container node
    const margin = 10;
    const w = mwh + margin * 2;
    const h = mwh + margin * 2;

    let x = o.x;
    let y = o.y;

    if (x > r.x) {
      x = r.x;
    } else if (o.x + w < r.x + r.w) {
      x = o.x + (r.x + r.w) - (o.x + w);
    }

    if (y > r.y) {
      y = r.y;
    } else if (o.y + h < r.y + r.h) {
      y = o.y + (r.y + r.h) - (o.y + h);
    }

    const n = { x: x, y: y, w: w, h: h };
    this.setBoundingBox(n);
    this.repaintAll();

    // Adjust external nodes to follow moved/resized container node
    this.canvas
      .getFigures()
      .asArray()
      .forEach((f: Figure2d) => {
        if (f.isLeft || f.isTop) {
          f.setPosition(f.x + n.x - o.x, f.y + n.y - o.y);
        } else if (f.isRight || f.isBottom) {
          f.setPosition(
            f.x + (n.x + n.w) - (o.x + o.w),
            f.y + (n.y + n.h - (o.y + o.h))
          );
        }
      });

    PubSub.publish("canvas.Save");
  }

  setCanvas(canvas: Canvas2d) {
    // Since parent type is a composite, the parent will call toBack().
    // However, we do not want that, so we signal to toBack() to act differently when called
    this.isSetCanvas = true;
    super.setCanvas(canvas);
    this.isSetCanvas = false;
  }

  addPorts() {
    this.createPort("input", new draw2d.layout.locator.XYRelPortLocator(0, 50));
    this.createPort("input", new draw2d.layout.locator.XYRelPortLocator(50, 0));
    this.createPort(
      "output",
      new draw2d.layout.locator.XYRelPortLocator(100, 50)
    );
    this.createPort(
      "output",
      new draw2d.layout.locator.XYRelPortLocator(50, 100)
    );

    // Make ports larger to support touch
    this.getPorts().each((_i: number, p: Figure2d) => {
      p.setCoronaWidth(15);
      p.setDiameter(10);
    });
  }

  toBack() {
    if (this.isSetCanvas) {
      // Since parent type is a composite, the parent called toBack() when setCanvas() was called.
      // However, we do not want that
      return;
    }

    super.toBack();
  }

  setNodeColor(colorName: string) {
    this.colorName = colorName;
    const color = Colors.getBackgroundColor(colorName);
    this.setBackgroundColor(color);
  }

  handleResize(): void {
    this.nameLabel?.setTextWidth(this.width);
    this.nameLabel?.repaint();
  }

  setChildrenVisible(isVisible: boolean): void {
    this.nameLabel?.setVisible(isVisible);
  }

  addLabels = (name: string, description: string): void => {
    this.nameLabel = new draw2d.shape.basic.Label({
      text: name,
      stroke: 0,
      fontSize: 12,
      fontColor: Colors.canvasText,
      bold: true,
    });

    this.nameLabel.installEditor(new LabelEditor(this));
    this.nameLabel.labelLocator = new NodeGroupNameLocator();
    this.add(this.nameLabel, this.nameLabel.labelLocator);

    this.descriptionLabel = new draw2d.shape.basic.Label({
      text: description,
      stroke: 0,
      fontSize: 9,
      fontColor: Colors.canvasText,
      bold: false,
    });

    this.descriptionLabel.installEditor(new LabelEditor(this));
    this.descriptionLabel.labelLocator = new NodeGroupDescriptionLocator();
    this.add(this.descriptionLabel, this.descriptionLabel.labelLocator);
  };

  setIcon(name: string): void {
    if (this.icon != null) {
      this.remove(this.icon);
      this.icon = null;
      this.iconName = null;
    }
    this.addIcon(name);
    this.repaint();
  }

  addIcon(iconKey: string): void {
    //console.log('add icon key', iconKey)
    if (iconKey == null) {
      return;
    }

    const ic = icons.getIcon(iconKey);
    const icon = new draw2d.shape.basic.Image({
      path: ic.src,
      width: 20,
      height: 20,
      bgColor: "none",
    });

    this.iconName = iconKey;
    this.icon = icon;
    this.add(icon, new NodeIconLocator());
  }

  repaintAll() {
    this.toolBar?.repaint();
    this.icon?.repaint();
    this.nameLabel?.repaint();
    this.descriptionLabel?.repaint();
    this.repaint();
  }

  showToolbar(): void {
    this.toolBar.show([
      {
        icon: draw2d.shape.icon.Contract,
        action: () => PubSub.publish("canvas.PopInnerDiagram"),
        tooltip: "Pop up to outer diagram",
      },
      {
        icon: draw2d.shape.icon.Resize2,
        action: () => this.resizeToContainInnerIcons(),
        tooltip: "Resize to contain all inner icons",
      },
    ]);
  }

  showConfigMenu = (): void => {
    const { x, y } = this.canvas.fromCanvasToDocumentCoordinate(
      this.x + this.getWidth(),
      this.y
    );

    PubSub.publish("canvas.TuneSelected", { x: x - 20, y: y - 20 });
  };

  hideConfig(): void {
    this.remove(this.configIcon);
    this.remove(this.configBkr);
    this.repaint();
  }
}

class NodeGroupNameLocator extends draw2d.layout.locator.Locator {
  relocate(_index: number, label: Figure2d) {
    const node = label.getParent();
    const y = node.getDescription() === "" ? 2 : -3;
    label.setPosition(22, y);
  }
}

class NodeGroupDescriptionLocator extends draw2d.layout.locator.Locator {
  relocate(_index: number, label: Figure2d) {
    const node = label.getParent();
    const nameHeight = node.nameLabel.getHeight();
    const x = node.nameLabel.x;
    const y = node.nameLabel.y + nameHeight - 8;
    label.setPosition(x, y);
  }
}

class NodeIconLocator extends draw2d.layout.locator.Locator {
  relocate(_index: number, icon: Figure2d) {
    icon.setPosition(3, 3);
  }
}
