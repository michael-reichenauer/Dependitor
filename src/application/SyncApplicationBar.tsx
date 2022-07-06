import React, { FC } from "react";
import { Typography, AppBar, Toolbar } from "@material-ui/core";

import makeStyles from "@material-ui/core/styles/makeStyles";
import { SyncApplicationMenu } from "./SyncApplicationMenu";

type ApplicationBarProps = {
  height: number;
};

export const SyncApplicationBar: FC<ApplicationBarProps> = ({ height }) => {
  const classes = useAppBarStyles();

  return (
    <AppBar position="static" style={{ height: height }}>
      <Toolbar>
        <SyncApplicationMenu />
        <Typography className={classes.title} variant="h6" noWrap>
          Dependitor Authenticator
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

const useAppBarStyles = makeStyles((theme) => ({
  root: {
    flexGrow: 1,
  },
  title: {
    display: "block",
  },
}));
