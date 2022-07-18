import React, { useEffect, FC } from "react";
import Progress from "../common/Progress";
import { di } from "../common/di";
import { IAuthenticatorKey } from "./Authenticator";

export const AuthenticatorPage: FC = () => {
  const authenticator = di(IAuthenticatorKey);

  useEffect(() => {
    document.title = "Authenticator";
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
      </div>
    </>
  );
};
