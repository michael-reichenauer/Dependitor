import React, { FC } from "react";
import { Typography, AppBar, Toolbar } from "@material-ui/core";

import makeStyles from "@material-ui/core/styles/makeStyles";
// import { AuthenticatorMenu } from "./AuthenticatorMenu";

type ApplicationBarProps = {
  height: number;
};

export const AuthenticatorBar: FC<ApplicationBarProps> = ({ height }) => {
  const classes = useAppBarStyles();

  return (
    <AppBar position="static" style={{ height: height, background: "#8e24aa" }}>
      <Toolbar>
        {/* <AuthenticatorMenu /> */}
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
