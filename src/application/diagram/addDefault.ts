import draw2d from "draw2d";
import Canvas from "./Canvas";
import Connection from "./Connection";
import { Figure2d, Point } from "./draw2dTypes";
import Node from "./Node";
import { zoomAndMoveShowTotalDiagram } from "./showTotalDiagram";

const marginY = 200;

export const addFigureToCanvas = (
  canvas: Canvas,
  figure: Figure2d,
  x: number,
  y: number
): void => {
  canvas.runCmd(new draw2d.command.CommandAdd(canvas, figure, x, y));
  canvas.adjustZOrder();
};

export const addDefaultNewDiagram = (canvas: Canvas) => {
  // Add a system node with a connected external user and external system
  const system = new Node({
    icon: "Azure/Compute/CloudServices(Classic)",
    name: "System",
  });
  const user = new Node({
    icon: "Azure/Management+Governance/MyCustomers",
    name: "External Users",
  });
  const external = new Node({
    icon: "Azure/Databases/VirtualClusters",
    name: "External Systems",
  });

  // Add nodes at the center of the canvas
  const cx = canvas.getDimension().getWidth() / 2;
  const cy = canvas.getDimension().getHeight() / 2;
  const x = cx;
  const y = cy - user.height / 2 - marginY;

  addNode(canvas, user, { x: x, y: y });
  addNode(canvas, system, { x: x, y: user.y + user.height + marginY });
  addNode(canvas, external, { x: x, y: system.y + system.height + marginY });

  addConnection(canvas, user, system);
  addConnection(canvas, system, external);

  zoomAndMoveShowTotalDiagram(canvas);
};

// export const addDefaultInnerDiagram = (canvas: Canvas, outerNode: Node) => {
//   // Add a default group at the center of the canvas
//   const group = new Group({
//     id: Group.mainId,
//     icon: outerNode.iconName,
//     name: outerNode.getName(),
//     description: outerNode.getDescription(),
//     sticky: true,
//   });
//   const d = canvas.getDimension();
//   const gx = d.getWidth() / 2 - group.getWidth() / 2;
//   const gy = d.getHeight() / 2 - group.getHeight() / 2;
//   canvas.add(group, gx, gy);

//   // // Add a default node in the center of the group
//   // const node = new Node(Node.nodeType, {
//   //   id: outerNode.id,
//   //   icon: outerNode.iconName,
//   //   name: outerNode.getName(),
//   //   description: outerNode.getDescription(),
//   // });

//   // const nx = gx + group.getWidth() / 2 - node.getWidth() / 2;
//   // const ny = gy + group.getHeight() / 2 - node.getHeight() / 2;
//   // node.parentGroup = group;
//   // canvas.add(node, nx, ny);
// };

const addNode = (canvas: Canvas, node: Node, p: Point) => {
  const x = p.x - node.width / 2;
  const y = p.y - node.height / 2;
  canvas.add(node, x, y);
};

const addConnection = (canvas: Canvas, src: Node, trg: Node) => {
  canvas.add(new Connection("", "", src, "output1", trg, "input1"));
};
