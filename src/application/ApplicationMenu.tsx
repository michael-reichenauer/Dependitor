import React, { useState } from "react";
import PubSub from "pubsub-js";
import IconButton from "@material-ui/core/IconButton";
import MenuIcon from "@material-ui/icons/Menu";
import Tooltip from "@material-ui/core/Tooltip";
import { AppMenu, menuItem, menuParentItem } from "../common/Menus";
import { IStoreKey } from "./diagram/Store";
import { useAbout } from "./About";
import { showPrompt } from "../common/PromptDialog";
import { di } from "../common/di";
import { useDiagramName } from "./Diagram";
import { IOnlineKey, SyncState, useSyncMode } from "./Online";
import { DiagramInfoDto } from "./diagram/StoreDtos";
import {
  isEdgeOnIos,
  isMobileOrTabletDevice,
  isStandaloneApp,
} from "../utils/build";
import {
  enableVirtualConsole,
  isVirtualConsoleEnabled,
} from "../common/virtualConsole";
import { showQuestionAlert } from "../common/AlertDialog";

export function ApplicationMenu() {
  const syncMode = useSyncMode();
  const [menu, setMenu] = useState(null);
  const [, setShowAbout] = useAbout();
  const [diagramName] = useDiagramName();

  const diagrams =
    menu == null ? [] : getDiagramsMenuItems(di(IStoreKey).getRecentDiagrams());

  const menuItems = [
    menuItem("New Diagram", () => PubSub.publish("canvas.NewDiagram")),
    menuParentItem("Open Recent", diagrams, diagrams.length > 0),
    menuParentItem("Insert", [
      menuItem("Icon", () => PubSub.publish("nodes.showDialog", { add: true })),
      menuItem("Container", () =>
        PubSub.publish("nodes.showDialog", { add: true, group: true })
      ),
    ]),

    menuParentItem("Diagram", [
      menuItem("Rename", () => renameDiagram(diagramName)),
      menuItem("Delete", deleteDiagram),
      menuItem(
        "Print Diagram ...",
        () => PubSub.publish("canvas.Print"),
        true,
        !isEdgeOnIos || true
      ),
      menuItem(
        "Export current page as png",
        () => PubSub.publish("canvas.Export", { type: "png", target: "file" }),
        true,
        !isMobileOrTabletDevice
      ),
      menuItem(
        "Export current page as svg",
        () => PubSub.publish("canvas.Export", { type: "svg", target: "file" }),
        true,
        !isMobileOrTabletDevice
      ),
    ]),

    menuItem(
      "Login",
      () => di(IOnlineKey).enableDeviceSync(),
      syncMode !== SyncState.Progress,
      syncMode === SyncState.Disabled && di(IOnlineKey).isLocalLoginEnabled()
    ),
    menuItem(
      "Setup device sync and login",
      () => di(IOnlineKey).enableDeviceSync(true),
      syncMode !== SyncState.Progress,
      syncMode === SyncState.Disabled
    ),

    menuItem(
      "Logoff",
      () => di(IOnlineKey).disableDeviceSync(),
      syncMode !== SyncState.Progress,
      syncMode !== SyncState.Disabled
    ),

    // menuParentItem( //
    //   "Files",
    //   [
    //     menuItem("Open file ...", () => PubSub.publish("canvas.OpenFile")),
    //     menuItem("Save diagram to file", () =>
    //       PubSub.publish("canvas.SaveDiagramToFile")
    //     ),
    //     menuItem("Save/Archive all to file", () =>
    //       PubSub.publish("canvas.ArchiveToFile")
    //     ),
    //   ],
    //   false
    // ),

    menuItem(
      "Reload web page",
      () => window.location.reload(),
      true,
      isStandaloneApp()
    ),

    menuItem("About", () => setShowAbout(true)),

    menuItem(
      "Disable Debug Console",
      () => enableVirtualConsole(false),
      true,
      isVirtualConsoleEnabled()
    ),
  ];

  return (
    <>
      <Tooltip title="Customize and control">
        <IconButton
          edge="start"
          color="inherit"
          onClick={(e: any) => setMenu(e.currentTarget)}
        >
          <MenuIcon />
        </IconButton>
      </Tooltip>

      <AppMenu anchorEl={menu} items={menuItems} onClose={setMenu} />
    </>
  );
}

function renameDiagram(titleText: string) {
  var name = titleText;
  const index = titleText.lastIndexOf(" - ");
  if (index > -1) {
    name = name.substring(0, index);
  }

  showPrompt("Rename Diagram", "", name, (name: string) =>
    PubSub.publish("canvas.RenameDiagram", name)
  );
}

function getDiagramsMenuItems(recentDiagrams: DiagramInfoDto[]) {
  const diagrams = recentDiagrams.slice(1);
  return diagrams.map((d) =>
    menuItem(d.name, () => PubSub.publish("canvas.OpenDiagram", d.id))
  );
}

async function deleteDiagram() {
  if (
    await showQuestionAlert(
      "Delete",
      "Do you really want to delete the current diagram?"
    )
  ) {
    PubSub.publish("canvas.DeleteDiagram");
  }
}
