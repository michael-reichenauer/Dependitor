import React, { useEffect, FC } from "react";
import Progress from "../common/Progress";
import { di } from "../common/di";
import { IAuthenticatorKey } from "./Authenticator";

export const AuthenticatorPage: FC = () => {
  const authenticator = di(IAuthenticatorKey);

  useEffect(() => {
    authenticator.activate();
  });

  return (
    <>
      <div
        style={{
          margin: 15,
        }}
      >
        <Progress />
        {/* <Typography variant="h6">Devices:</Typography>
        <Typography>Some device 1</Typography>
        <Typography>Some device 2 ...</Typography> */}
      </div>
    </>
  );
};
