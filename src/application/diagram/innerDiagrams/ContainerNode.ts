import draw2d from "draw2d";
import cuid from "cuid";
import Colors from "../Colors";
import { defaultIconKey, icons, noImageIconKey } from "../../../common/icons";
import PubSub from "pubsub-js";
import { Figure2d } from "../draw2dTypes";
import { FigureDto } from "../StoreDtos";
import { Toolbar } from "../Toolbar";

const defaultOptions = () => ({
  width: ContainerNode.defaultWidth,
  height: ContainerNode.defaultHeight,
  description: "",
  icon: defaultIconKey,
});

// InnerDiagramContainer draws a border around all inner icons and external icons are connected
// to the container
export default class ContainerNode extends draw2d.shape.basic.Rectangle {
  static mainId = "mainId";
  static nodeType = "group";
  static defaultWidth = 400;
  static defaultHeight = 400;

  private toolBar: Toolbar;
  private nameLabel: Figure2d;
  private descriptionLabel: Figure2d;
  private icon: Figure2d;
  private iconName: string = defaultIconKey;

  public constructor(options?: any) {
    const o = { ...defaultOptions(), ...options };
    super({
      id: options?.id ?? cuid(),
      width: o.width,
      height: o.height,
      color: Colors.canvasText,
      bgColor: "none",
      stroke: 2,
      alpha: 1,
      radius: 5,
    });

    this.toolBar = new Toolbar(this, () => ({ x: 0, y: -35 }));
    this.addIcon(o.icon);
    this.addLabels(o.name, o.description, o.Icon);
    this.addPorts();
  }

  static deserialize(data: FigureDto) {
    return new ContainerNode({
      id: data.id,
      width: data.rect.w,
      height: data.rect.h,
      name: data.name,
      description: data.description,
      icon: data.icon,
    });
  }

  serialize(): FigureDto {
    return {
      type: ContainerNode.nodeType,
      id: this.id,
      rect: { x: this.x, y: this.y, w: this.width, h: this.height },
      name: this.getName(),
      description: this.getDescription(),
      color: "",
      zOrder: this.getZOrder(),
      icon: this.iconName,
    };
  }

  public getName = () => this.nameLabel?.text ?? "";

  public getDescription = () => this.descriptionLabel?.text ?? "";

  public setName(name: string) {
    this.nameLabel?.setText(name);
  }

  public setDescription(name: string) {
    this.descriptionLabel?.setText(name);
  }

  public setIcon(name: string): void {
    if (this.icon != null) {
      this.remove(this.icon);
      this.icon = null;
      this.iconName = "";
    }

    this.addIcon(name);
    this.repaint();
  }

  public showToolbar(): void {
    this.toolBar.show([
      {
        icon: draw2d.shape.icon.Contract,
        action: () => PubSub.publish("canvas.PopInnerDiagram"),
        tooltip: "Pop up to outer diagram",
      },
    ]);
  }

  public repaintAll() {
    this.toolBar?.repaint();
    this.icon?.repaint();
    this.nameLabel?.repaint();
    this.descriptionLabel?.repaint();
    this.repaint();
  }

  // Resizes then container to include all non external nodes
  public resizeToContainInnerIcons() {
    // Get the original bounding box for the inner diagram container node
    const orgRec = this.getBoundingBox();

    // Get the rect which contains all inner icons (exclude external and container node)
    const figRec = this.canvas.getFiguresRect(
      (f: Figure2d) => !f.isConnected && !(f instanceof ContainerNode)
    );

    // Make rect a square form (with default minimal size)
    const mwh = Math.max(
      ContainerNode.defaultHeight,
      ContainerNode.defaultWidth,
      figRec.h,
      figRec.w
    );

    // New bounding box for the inner diagram container node
    const margin = 10;
    const w = mwh + margin * 2;
    const h = mwh + margin * 2;

    let x = orgRec.x;
    let y = orgRec.y;

    // Adjust x if needed so x and x+w will contain the figures
    if (x > figRec.x) {
      x = figRec.x;
    } else if (orgRec.x + w < figRec.x + figRec.w) {
      x = orgRec.x + (figRec.x + figRec.w) - (orgRec.x + w);
    }

    // Adjust y if needed so y and y+h will contain the figures
    if (y > figRec.y) {
      y = figRec.y;
    } else if (orgRec.y + h < figRec.y + figRec.h) {
      y = orgRec.y + (figRec.y + figRec.h) - (orgRec.y + h);
    }

    const newRec = { x: x, y: y, w: w, h: h };
    this.setBoundingBox(newRec);
    this.repaintAll();

    // Adjust external nodes to follow moved/resized container node
    this.canvas
      .getFigures()
      .asArray()
      .forEach((f: Figure2d) => {
        if (f.isLeft || f.isTop) {
          f.setPosition(f.x + newRec.x - orgRec.x, f.y + newRec.y - orgRec.y);
        } else if (f.isRight || f.isBottom) {
          f.setPosition(
            f.x + (newRec.x + newRec.w) - (orgRec.x + orgRec.w),
            f.y + (newRec.y + newRec.h - (orgRec.y + orgRec.h))
          );
        }
      });

    PubSub.publish("canvas.Save");
  }

  private addPorts() {
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

  private addLabels(name: string, description: string, iconName: string): void {
    if (name === undefined || name === null) {
      // Name was not specified, use the icon name
      const ic = icons.getIcon(iconName);
      name = ic.key !== noImageIconKey ? ic.name : "Name";
    }

    this.nameLabel = new draw2d.shape.basic.Label({
      text: name,
      stroke: 0,
      fontSize: 12,
      fontColor: Colors.canvasText,
      bold: true,
    });

    this.nameLabel.labelLocator = new NodeGroupNameLocator();
    this.add(this.nameLabel, this.nameLabel.labelLocator);

    this.descriptionLabel = new draw2d.shape.basic.Label({
      text: description,
      stroke: 0,
      fontSize: 9,
      fontColor: Colors.canvasText,
      bold: false,
    });

    this.descriptionLabel.labelLocator = new NodeGroupDescriptionLocator();
    this.add(this.descriptionLabel, this.descriptionLabel.labelLocator);
  }

  private addIcon(iconKey: string): void {
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
