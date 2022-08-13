import draw2d from "draw2d";
import PubSub from "pubsub-js";
import cuid from "cuid";
import { menuItem } from "../../common/Menus";
import Colors from "./Colors";
import CommandChangeIcon from "./CommandChangeIcon";
import NodeIcons from "./NodeIcons";
import Label from "./Label";
import { icons } from "../../common/icons";
import { LabelEditor } from "./LabelEditor";
import NodeSelectionFeedbackPolicy from "./NodeSelectionFeedbackPolicy";
import { Canvas2d, Figure2d, Point } from "./draw2dTypes";
import { FigureDto } from "./StoreDtos";
import { Toolbar } from "./Toolbar";
import DiagramIcon from "./innerDiagrams/DiagramIcon";
import { logName } from "../../common/log";

const defaultIconKey = "Azure/General/Module";

const defaultOptions = {
  id: cuid(),
  width: 60,
  height: 60,
  description: "",
  icon: defaultIconKey,
};

// const defaultOptions = () => {
//   const dv = {
//     id: cuid(),
//     width: Node.defaultWidth,
//     height: Node.defaultHeight,
//     description: "",
//     icon:
//   };

//   switch (type) {
//     case Node.nodeType:
//       return { ...dv, icon: defaultIconKey };
//     case Node.systemType:
//       return {
//         ...dv,
//         name: "System",
//         icon: "Azure/Compute/CloudServices(Classic)",
//       };
//     case Node.userType:
//       return {
//         ...dv,
//         name: "External Users",
//         icon: "Azure/Management+Governance/MyCustomers",
//       };
//     case Node.externalType:
//       return {
//         ...dv,
//         name: "External Systems",
//         icon: "Azure/Databases/VirtualClusters",
//       };
//     default:
//       throw new Error("Unknown type: " + type);
//   }
// };

export default class Node extends draw2d.shape.node.Between {
  static nodeType = "node";
  // static systemType = "system";
  // static userType = "user";
  // static externalType = "external";
  static defaultWidth = 60;
  static defaultHeight = 60;

  nodeIcons: NodeIcons = new NodeIcons();
  figure: Figure2d = null;
  colorName: string;
  nameLabel: Figure2d;
  descriptionLabel: Figure2d;
  icon: Figure2d;
  diagramIcon: Figure2d;
  canDelete: boolean = true;
  private toolBar: Toolbar;
  innerDiagram: Figure2d;

  getName = () => this.nameLabel?.text ?? "";
  getDescription = () => this.descriptionLabel?.text ?? "";

  constructor(options?: any) {
    super({
      id: options?.id ?? cuid(),
      width: Node.defaultWidth,
      height: Node.defaultHeight,
      stroke: 0.1,
      bgColor: "none",
      color: "none",
      radius: 5,
      glow: true,
      resizeable: false,
    });

    const o = { ...defaultOptions, ...options };
    if (o.name === undefined || o.name === null) {
      const ic = icons.getIcon(o.icon);
      o.name = ic.name;
    }

    // const icon = new draw2d.shape.basic.Image({ path: ic.src, width: 22, height: 22, bgColor: 'none' })

    this.colorName = o.colorName;

    this.addLabels(o.name, o.description);
    this.addIcon(o.icon);
    // this.addConfigIcon()
    // this.hideConfig()
    this.addPorts();
    //this.addInnerDiagramIcon()

    // this.on("click", (s, e) => console.log('click node'))
    this.on("dblclick", (_s: any, _e: any) => {});
    this.on("resize", (_s: any, _e: any) => this.handleResize());

    this.toolBar = new Toolbar(this);
    this.on("select", () => this.selectNode());
    this.on("unselect", () => this.unSelectNode());

    // Adjust selection handle sizes
    this.installEditPolicy(new NodeSelectionFeedbackPolicy());
  }

  public getToolbarLocation(): Point {
    return { x: 0, y: -35 };
  }

  public setCanvas(canvas: Canvas2d) {
    super.setCanvas(canvas);

    if (canvas != null) {
      this.diagramIcon?.shape?.attr({ cursor: "pointer" });
    }
  }

  public static deserialize(data: FigureDto) {
    return new Node({
      id: data.id,
      width: data.rect.w,
      height: data.rect.h,
      name: data.name,
      description: data.description,
      colorName: data.color,
      icon: data.icon,
    });
  }

  public serialize(): FigureDto {
    return {
      id: this.id,
      type: Node.nodeType,
      rect: { x: this.x, y: this.y, w: this.width, h: this.height },
      name: this.getName(),
      description: this.getDescription(),
      color: this.colorName,
      zOrder: this.getZOrder(),
      icon: this.iconName,
    };
  }

  public getConfigMenuItems() {
    logName();

    return [
      menuItem("To front", () => this.moveToFront()),
      menuItem("To back", () => this.moveToBack()),
      menuItem(
        "Show inner diagram",
        () => this.showInnerDiagram(),
        true,
        !this.innerDiagram
      ),
      menuItem(
        "Hide inner diagram",
        () => this.hideInnerDiagram(),
        true,
        !!this.innerDiagram
      ),
      menuItem(
        "Edit inner diagram",
        () => this.editInnerDiagram(),
        true,
        !!this.innerDiagram
      ),
      menuItem("Edit label ...", () => this.nameLabel.editor.start(this)),
      menuItem("Edit icon ...", () =>
        PubSub.publish("nodes.showDialog", {
          add: false,
          action: (iconKey: string) => this.changeIcon(iconKey),
        })
      ),
      menuItem(
        "Delete node",
        () => this.canvas.runCmd(new draw2d.command.CommandDelete(this)),
        this.canDelete
      ),
    ];
  }

  public handleSingleClick() {}

  public handleDoubleClick() {
    this.showInnerDiagram();
  }

  public moveToBack(): void {
    this.toBack(this);
    this.canvas.adjustZOrder();
    PubSub.publish("canvas.Save");
  }

  public moveToFront(): void {
    this.toFront();
    this.canvas.adjustZOrder();
    PubSub.publish("canvas.Save");
  }

  public changeIcon(iconKey: string): void {
    this.canvas.runCmd(new CommandChangeIcon(this, iconKey));
  }

  public setName(name: string): void {
    this.nameLabel?.setText(name);
  }

  public setDescription(description: string): void {
    this.descriptionLabel?.setText(description);
  }

  getAllConnections() {
    return this.getPorts()
      .asArray()
      .flatMap((p: any) => p.getConnections().asArray());
  }

  public setNodeColor(colorName: string): void {
    this.colorName = colorName;
    const color = Colors.getNodeColor(colorName);
    const borderColor = Colors.getNodeBorderColor(colorName);
    const fontColor = Colors.getNodeFontColor(colorName);

    this.setBackgroundColor(color);
    this.setColor(borderColor);

    this.nameLabel?.setFontColor(fontColor);
    this.descriptionLabel?.setFontColor(fontColor);
    this.diagramIcon?.setColor(fontColor);
  }

  public setDeleteable(flag: boolean) {
    super.setDeleteable(flag);
    this.canDelete = flag;
  }

  public setIcon(name: string) {
    if (this.icon != null) {
      this.remove(this.icon);
      this.icon = null;
      this.iconName = null;
    }
    this.addIcon(name);
    this.repaint();
  }

  private selectNode() {
    this.showAppropriateToolbar();
  }

  private showAppropriateToolbar() {
    let toolButtons;
    if (this.innerDiagram) {
      toolButtons = [
        {
          icon: draw2d.shape.icon.Run,
          menu: () => this.getConfigMenuItems(),
          tooltip: "Settings",
        },
        {
          icon: draw2d.shape.icon.Diagram,
          action: () => this.toggleInnerDiagram(),
          pushed: true,
          tooltip: "Toggle inner diagram",
        },
        {
          icon: draw2d.shape.icon.Expand,
          action: () => this.editInnerDiagram(),
          tooltip: "Edit inner diagram",
        },
      ];
    } else {
      toolButtons = [
        {
          icon: draw2d.shape.icon.Run,
          menu: () => this.getConfigMenuItems(),
          tooltip: "Settings",
        },
        {
          icon: draw2d.shape.icon.Diagram,
          action: () => this.toggleInnerDiagram(),
          tooltip: "Toggle inner diagram",
        },
      ];
    }
    this.toolBar.show(toolButtons);
  }

  private unSelectNode() {
    this.toolBar.hide();
  }

  private toggleInnerDiagram(): void {
    if (this.innerDiagram) {
      this.hideInnerDiagram();
      return;
    }

    this.showInnerDiagram();
  }

  private showInnerDiagram(): void {
    this.setChildrenVisible(false);

    this.innerDiagram = new DiagramIcon(this);
    this.add(this.innerDiagram, new InnerDiagramLocator());
    this.repaint();

    if (this.toolBar.isShowing()) {
      this.showAppropriateToolbar();
    }
  }

  public hideInnerDiagram(): void {
    if (!this.innerDiagram) {
      return;
    }

    this.remove(this.innerDiagram);
    this.innerDiagram = null;

    this.setChildrenVisible(true);
    if (this.toolBar.isShowing()) {
      this.showAppropriateToolbar();
    }
  }

  public editInnerDiagram(): void {
    this.toolBar.hide();
    PubSub.publish("canvas.EditInnerDiagram", this);
  }

  handleResize(): void {
    this.nameLabel?.setTextWidth(this.width);
    this.nameLabel?.repaint();
    this.descriptionLabel?.setTextWidth(this.width);
    this.descriptionLabel?.repaint();

    if (this.innerDiagram == null) {
      return;
    }

    this.hideInnerDiagram();
    this.showInnerDiagram();
  }

  setChildrenVisible(isVisible: boolean): void {
    this.icon?.setVisible(isVisible);
    this.innerDiagram?.setVisible(isVisible);
  }

  addLabels = (name: string, description: string): void => {
    const fontColor = Colors.labelColor;

    this.nameLabel = new Label(this.width + 40, {
      text: name,
      stroke: 0,
      fontSize: 12,
      fontColor: fontColor,
      bold: true,
    });

    this.nameLabel.installEditor(new LabelEditor(this));
    this.nameLabel.labelLocator = new NodeNameLocator();
    this.add(this.nameLabel, this.nameLabel.labelLocator);

    this.descriptionLabel = new Label(this.width + 40, {
      text: description,
      stroke: 0,
      fontSize: 9,
      fontColor: fontColor,
      bold: false,
    });

    this.descriptionLabel.installEditor(new LabelEditor(this));
    this.descriptionLabel.labelLocator = new NodeDescriptionLocator();
    this.add(this.descriptionLabel, this.descriptionLabel.labelLocator);
  };

  setBlur() {
    this.icon?.setAlpha(0.5);
  }

  addIcon(iconKey: string): void {
    //console.log('add icon key', iconKey)
    if (iconKey == null) {
      return;
    }

    const ic = icons.getIcon(iconKey);
    const icon = new draw2d.shape.basic.Image({
      path: ic.src,
      width: this.width,
      height: this.height,
      bgColor: "none",
    });

    this.iconName = iconKey;
    this.icon = icon;
    this.add(icon, new NodeIconLocator());
  }

  addPorts(): void {
    this.createPort("input", new draw2d.layout.locator.XYRelPortLocator(50, 0));
    this.createPort(
      "output",
      new draw2d.layout.locator.XYRelPortLocator(50, 100)
    );

    // Make ports larger to support touch
    this.getPorts().each((_i: number, p: Figure2d) => {
      p.setCoronaWidth(1);
      p.setDiameter(10);
    });
  }
}

class NodeNameLocator extends draw2d.layout.locator.Locator {
  relocate(_index: number, label: Figure2d) {
    const node = label.getParent();
    const x = node.getWidth() / 2 - label.getWidth() / 2;
    const y = node.getHeight() + 0;
    label.setPosition(x, y);
  }
}

class NodeDescriptionLocator extends draw2d.layout.locator.Locator {
  relocate(_index: number, label: Figure2d) {
    const node = label.getParent();
    const nameHeight = node.nameLabel.getHeight();
    const x = node.getWidth() / 2 - label.getWidth() / 2;
    const y = node.getHeight() + nameHeight - 8;
    label.setPosition(x, y);
  }
}

class NodeIconLocator extends draw2d.layout.locator.Locator {
  relocate(_index: number, icon: Figure2d) {
    icon.setPosition(0, 0);
  }
}

// class InnerDiagramIconLocator extends draw2d.layout.locator.PortLocator {
//   relocate(_index: number, figure: Figure2d) {
//     const parent = figure.getParent();
//     this.applyConsiderRotation(figure, 3, parent.getHeight() - 18);
//   }
// }

// class ConfigIconLocator extends draw2d.layout.locator.Locator {
//   relocate(_index: number, figure: Figure2d) {
//     const parent = figure.getParent();
//     figure.setPosition(parent.getWidth() - 11, -28);
//   }
// }

// class ConfigBackgroundLocator extends draw2d.layout.locator.Locator {
//   relocate(_index: number, figure: Figure2d) {
//     const parent = figure.getParent();
//     figure.setPosition(parent.getWidth() - 13, -30);
//   }
// }

class InnerDiagramLocator extends draw2d.layout.locator.Locator {
  relocate(_index: number, target: Figure2d) {
    target.setPosition(2, 2);
  }
}
