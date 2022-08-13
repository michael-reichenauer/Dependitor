import Node from "../Node";

export function defaultIcon(node: Node) {
  return {
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
        color: "none",
        zOrder: 0,
        icon: node.iconName,
      },
    ],
    connections: [],
  };
}
