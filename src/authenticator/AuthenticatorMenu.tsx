import React, { useState } from "react";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import Tooltip from "@mui/material/Tooltip";
import { AppMenu, menuItem } from "../common/Menus";
import { useAbout } from "../application/About";

export function AuthenticatorMenu() {
  const [menu, setMenu] = useState(null);
  const [, setShowAbout] = useAbout();

  const isInStandaloneMode = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-ignore
    window.navigator.standalone ||
    document.referrer.includes("android-app://");

  const menuItems = [
    menuItem("Test item", () => { }),
    menuItem(
      "Reload web page",
      () => window.location.reload(),
      true,
      isInStandaloneMode()
    ),
    menuItem("About", () => setShowAbout(true)),
  ];

  return <>
    <Tooltip title="Customize and control">
      <IconButton
        edge="start"
        color="inherit"
        onClick={(e: any) => setMenu(e.currentTarget)}
        size="large">
        <MenuIcon />
      </IconButton>
    </Tooltip>

    <AppMenu anchorEl={menu} items={menuItems} onClose={setMenu} />
  </>;
}
