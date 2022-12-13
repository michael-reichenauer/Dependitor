import React, { FC } from "react";
import PubSub from "pubsub-js";
import {
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  Box,
} from "@mui/material";

import { makeStyles } from "@mui/styles";
import { ApplicationMenu } from "./ApplicationMenu";
import AddBoxOutlinedIcon from "@mui/icons-material/AddBoxOutlined";
import QueueOutlinedIcon from "@mui/icons-material/QueueOutlined";

import SyncIcon from "@mui/icons-material/Sync";
import SyncProblemIcon from "@mui/icons-material/SyncProblem";
import SyncDisabledIcon from "@mui/icons-material/SyncDisabled";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import FilterCenterFocusIcon from "@mui/icons-material/FilterCenterFocus";
import { useCanRedo, useCanUndo, useDiagramName } from "./Diagram";
import { IOnlineKey, SyncState, useSyncMode } from "./Online";
import { showPrompt } from "./../common/PromptDialog";
import { di } from "../common/di";

type ApplicationBarProps = {
  height: number;
};

export const ApplicationBar: FC<ApplicationBarProps> = ({ height }) => {
  const online = di(IOnlineKey);
  const classes = useAppBarStyles();
  const [diagramName] = useDiagramName();
  const syncMode = useSyncMode();
  const [canUndo] = useCanUndo();
  const [canRedo] = useCanRedo();

  const style = (disabled?: any) => {
    return !disabled ? classes.icons : classes.iconsDisabled;
  };

  const enableSyncText = online.isLocalLoginEnabled()
    ? "Click to login"
    : "Click to setup device sync and login";

  const styleAlways = (disabled?: any) => {
    return !disabled ? classes.iconsAlways : classes.iconsAlwaysDisabled;
  };

  return (
    <AppBar position="static" style={{ height: height }}>
      <Toolbar>
        <ApplicationMenu />

        {syncMode === SyncState.Progress && (
          <Button
            tooltip={`Trying to connect, please wait`}
            icon={<HourglassEmptyIcon style={{ color: "gray" }} />}
            onClick={() => { }}
          />
        )}
        {syncMode === SyncState.Enabled && (
          <Button
            tooltip={`Device sync enabled and OK, click to sync now`}
            icon={<SyncIcon style={{ color: "Lime" }} />}
            onClick={() => online.enableDeviceSync()}
          />
        )}
        {syncMode === SyncState.Error && (
          <Button
            tooltip="Device sync error, click to retry sync now"
            icon={<SyncProblemIcon style={{ color: "#FF3366" }} />}
            onClick={() => online.enableDeviceSync()}
          />
        )}
        {syncMode === SyncState.Disabled && (
          <Button
            tooltip={enableSyncText}
            icon={<SyncDisabledIcon style={{ color: "#FFFF66" }} />}
            onClick={() => online.enableDeviceSync()}
          />
        )}

        <Button
          tooltip="Undo"
          disabled={!canUndo}
          icon={<UndoIcon className={styleAlways(!canUndo)} />}
          onClick={() => PubSub.publish("canvas.Undo")}
        />
        <Button
          tooltip="Redo"
          disabled={!canRedo}
          icon={<RedoIcon className={styleAlways(!canRedo)} />}
          onClick={() => PubSub.publish("canvas.Redo")}
        />

        <Button
          tooltip="Insert Icon"
          icon={<AddBoxOutlinedIcon className={styleAlways()} />}
          onClick={() => PubSub.publish("nodes.showDialog", { add: true })}
        />
        <Button
          tooltip="Insert Container"
          icon={<QueueOutlinedIcon className={styleAlways()} />}
          onClick={() =>
            PubSub.publish("nodes.showDialog", { add: true, group: true })
          }
        />

        <Button
          tooltip="Scroll and zoom to show all of the diagram"
          icon={<FilterCenterFocusIcon className={styleAlways()} />}
          onClick={() => PubSub.publish("canvas.ShowTotalDiagram")}
        />
        {/* <Button
          tooltip="Try login"
          icon={<AddToHomeScreenIcon className={styleAlways()} />}
          onClick={() => di(IAuthenticateKey).specialLogin()}
        /> */}

        <Box m={1} className={style()} />
        <Typography
          className={classes.title}
          variant="h6"
          noWrap
          onClick={() => renameDiagram(diagramName)}
        >
          {diagramName}
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

type ButtonProps = {
  icon: any;
  tooltip: string;
  disabled?: boolean;
  onClick: (event: any) => void;
  className?: any;
};

const Button: FC<ButtonProps> = ({
  icon,
  tooltip,
  disabled = false,
  onClick,
  className,
}) => {
  return (
    <Tooltip title={tooltip} className={className} arrow>
      <span>
        <IconButton disabled={disabled} onClick={onClick} style={{ padding: 5 }} size="large">
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};

const useAppBarStyles = makeStyles((theme: any) => ({
  root: {
    flexGrow: 1,
  },
  title: {
    display: "block",
  },
  space: {
    flexGrow: 1,
  },
  icons: {
    color: "white",
    display: "none",
    [theme.breakpoints.up("md")]: {
      display: "block",
    },
  },
  iconsDisabled: {
    color: "grey",
    display: "none",
    [theme.breakpoints.up("md")]: {
      display: "block",
    },
  },
  iconsAlways: {
    color: "white",
  },
  iconsAlwaysDisabled: {
    color: "grey",
  },

  iconsAlwaysDarker: {
    color: "Silver",
  },
  connectionIcons: {
    color: "green",
  },
}));

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
