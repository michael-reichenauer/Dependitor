import React, { FC } from "react";
import { Typography, AppBar, Toolbar } from "@mui/material";

import { makeStyles } from "@mui/styles";
// import { AuthenticatorMenu } from "./AuthenticatorMenu";

type ApplicationBarProps = {
  height: number;
};

export const AuthenticatorBar: FC<ApplicationBarProps> = ({ height }) => {
  const classes = useAppBarStyles();

  return (
    <AppBar position="static" style={{ height: height }}>
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
