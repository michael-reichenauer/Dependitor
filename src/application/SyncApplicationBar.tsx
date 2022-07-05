import React, { FC } from "react";
import {
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  Box,
} from "@material-ui/core";
import SyncIcon from "@material-ui/icons/Sync";
import makeStyles from "@material-ui/core/styles/makeStyles";
import { SyncApplicationMenu } from "./SyncApplicationMenu";

type ApplicationBarProps = {
  height: number;
};

export const SyncApplicationBar: FC<ApplicationBarProps> = ({ height }) => {
  const classes = useAppBarStyles();

  const style = (disabled?: any) => {
    return !disabled ? classes.icons : classes.iconsDisabled;
  };

  return (
    <AppBar position="static" style={{ height: height }}>
      <Toolbar>
        <SyncApplicationMenu />
        <Button
          tooltip={`Sync`}
          icon={<SyncIcon style={{ color: "Lime" }} />}
          onClick={() => {}}
        />

        <Box m={1} className={style()} />
        <Typography className={classes.title} variant="h6" noWrap>
          Sync Devices
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
    <Tooltip title={tooltip} className={className}>
      <span>
        <IconButton
          disabled={disabled}
          onClick={onClick}
          style={{ padding: 5 }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
};

const useAppBarStyles = makeStyles((theme) => ({
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
