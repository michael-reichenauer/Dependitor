import React from "react";
import { ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { NestedMenuItem } from "mui-nested-menu";

const padding = 1;

// Normal menu item.
export const menuItem = (
  text: string,
  action: () => void,
  isEnabled = true,
  isShow = true,
  icon = null
) => {
  return new Item(text, action, isEnabled, isShow, icon);
};

// Parent menu item with children items
export const menuParentItem = (
  text: string,
  items: Item[],
  isEnabled = true,
  isShow = true
) => {
  return new NestedItem(text, items, isEnabled, isShow);
};

// Shows the app bar menu
// @ts-ignore
export function AppMenu({ anchorEl, items, onClose }): JSX.Element | null {
  if (anchorEl == null || items == null || items.length === 0) {
    return null;
  }

  const onClick = (item: any) => {
    onClose();

    if (!(item instanceof Item)) {
      return;
    }
    // @ts-ignore
    item?.action();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={true}
      onClose={() => onClose()}
      PaperProps={{}}
    >
      {getMenuItems(items, onClick)}
    </Menu>
  );
}

// Shows the context menu (when user right-click or long-click)
// @ts-ignore
export function ContextMenu({ menu, onClose }) {
  if (menu?.items == null) {
    return null;
  }

  const onClick = (item: any) => {
    onClose();

    if (!(item instanceof Item)) {
      return;
    }
    // @ts-ignore
    item?.action();
  };

  return (
    <Menu
      open={true}
      onClose={() => onClose()}
      anchorReference="anchorPosition"
      anchorPosition={{ left: menu.x - 2, top: menu.y - 2 }}
      PaperProps={{}}
    >
      {getMenuItems(menu.items, onClick)}
    </Menu>
  );
}

const getMenuItems = (items: any[], onClick: any) => {
  return items
    .map((item: any, i: number) => {
      if (!item.isShow) {
        return null;
      }
      if (item instanceof Item) {
        return (
          <MenuItem
            style={{ paddingLeft: 13, paddingTop: padding, paddingBottom: padding }}
            key={`item-${i}`}
            onClick={() => onClick(item)}
            disabled={!item.isEnabled}
          >
            {item.icon && (
              <ListItemIcon>
                <img src={item.icon} alt="" />
              </ListItemIcon>
            )}
            <ListItemText primary={item.text} />
          </MenuItem>
        );
      } else if (item instanceof NestedItem) {
        return (
          <NestedMenuItem
            style={{ paddingTop: padding, paddingBottom: padding, }}
            key={`item-${i}`}
            label={item.text}
            parentMenuOpen={!!item.isEnabled}
            disabled={!item.isEnabled}
          >
            {getMenuItems(item.items, onClick)}
          </NestedMenuItem>
        );
      }
      console.warn("Unknown item", item);
      return null;
    })
    .filter((item: any) => item != null);
};

class Item {
  isEnabled: boolean;
  icon: any;
  text: string;
  action: () => void;
  isShow: boolean;

  constructor(
    text: string,
    action: () => void,
    isEnabled = true,
    isShow = true,
    icon = null
  ) {
    this.text = text;
    this.action = action;
    this.isEnabled = isEnabled;
    this.isShow = isShow;
    this.icon = icon;
  }
}

class NestedItem {
  items: Item[] = [];
  text: string;
  isEnabled: any;
  isShow: boolean;
  constructor(text: string, items: Item[], isEnabled = true, isShow = true) {
    this.text = text;
    this.items = items;
    this.isEnabled = isEnabled;
    this.isShow = isShow;
  }
}
