import draw2d from "draw2d";
import PubSub from "pubsub-js";
import Colors from "./Colors";
import { Figure2d, Icon2d } from "./draw2dTypes";
import Connection from "./Connection";
import { Tooltip } from "./Tooltip";

export interface IToolbar {
  show(buttons: Button[]): void;
  hide(): void;
  isShowing(): boolean;
}

export interface Button {
  icon: Icon2d;
  menu?: () => any;
  action?: () => void;
  pushed?: boolean;
  tooltip?: string;
}

interface IconButton {
  button: Figure2d;
  icon: Figure2d;
}

//
export class Toolbar implements IToolbar {
  private iconButtons: IconButton[] = [];

  public constructor(private figure: Figure2d) {}

  public isShowing(): boolean {
    return this.iconButtons.length > 0;
  }

  public show(buttons: Button[]): void {
    if (this.isShowing()) {
      this.hide();
    }

    this.iconButtons = buttons.map((button, index) =>
      this.toIconButton(button, index)
    );

    this.iconButtons.forEach((buttonIcon) => {
      this.figure.add(buttonIcon.button, buttonIcon.button.locator);
      this.figure.add(buttonIcon.icon, buttonIcon.icon.locator);
    });

    this.figure.repaint();
  }

  public hide(): void {
    this.iconButtons.forEach((buttonIcon) => {
      this.figure.remove(buttonIcon.icon);
      this.figure.remove(buttonIcon.button);
    });
    this.iconButtons = [];

    this.figure.repaint();
  }

  private toIconButton(button: Button, index: number): IconButton {
    const x = index * 23;
    const y = 0;

    const bgColor = button.pushed
      ? Colors.buttonPushedBackground
      : Colors.buttonBackground;

    const buttonRect = new draw2d.shape.basic.Rectangle({
      bgColor: bgColor,
      alpha: 1,
      width: 20,
      height: 20,
      radius: 3,
      stroke: 0.1,
    });
    buttonRect.locator = this.makeLocator(x, y);
    buttonRect.on("click", () => {
      if (button.menu) {
        this.showButtonMenu(x + 6, y + 5, button.menu);
      }
      if (button.action) {
        button.action();
      }
    });
    if (button.tooltip) {
      buttonRect.tooltip = new Tooltip(buttonRect, button.tooltip);
    }

    const icon = new button.icon({
      width: 16,
      height: 16,
      color: Colors.button,
      bgColor: Colors.buttonBackground,
    });
    icon.locator = this.makeLocator(x + 2, y + 2);

    return { button: buttonRect, icon: icon };
  }

  private makeLocator(x: number, y: number) {
    if (this.figure instanceof Connection) {
      return new ConnectionButtonLocator(x, y);
    }

    return new NodeButtonLocator(x, y);
  }

  private showButtonMenu(x: number, y: number, menu: () => any): void {
    const tp = this.figure.getToolbarLocation();

    const cx = this.figure.x + tp.x + x;
    const cy = this.figure.y + tp.y + y;
    const cc = this.figure.canvas.fromCanvasToDocumentCoordinate(cx, cy);

    const menuItems = menu();
    PubSub.publish("canvas.ShowContextMenu", {
      items: menuItems,
      x: cc.x,
      y: cc.y,
    });
  }
}

class NodeButtonLocator extends draw2d.layout.locator.Locator {
  constructor(private ox: number, private oy: number) {
    super();
  }
  relocate(_index: number, target: Figure2d) {
    const { x, y } = target.getParent().getToolbarLocation();
    target.setPosition(x + this.ox, y + this.oy);
  }
}

class ConnectionButtonLocator extends draw2d.layout.locator.ConnectionLocator {
  constructor(private ox: number, private oy: number) {
    super();
  }
  relocate(_index: number, target: Figure2d) {
    const { x, y } = target.getParent().getToolbarLocation();
    target.setPosition(x + this.ox, y + this.oy);
  }
}
