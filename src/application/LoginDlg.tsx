import React, { FC, useState } from "react";
import { atom, useAtom } from "jotai";
import {
  Box,
  Button,
  Dialog,
  LinearProgress,
  Link,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { Formik, Form } from "formik";

import Result, { isError } from "../common/Result";
import { SetAtom } from "jotai/core/types";
import { QRCode } from "react-qrcode-logo";
import { stringToBase64 } from "../common/utils";
import {
  AuthenticateReq,
  getAuthenticateUrl,
} from "../authenticator/Authenticator";
import { di } from "../common/di";
import { IDataCryptKey } from "../common/DataCrypt";

const dialogWidth = 290;
const dialogHeight = 340;

export interface ILoginProvider {
  login(): Promise<Result<void>>;
  cancelLogin(): void;
}

export let showLoginDlg: SetAtom<ILoginProvider> = () => {};

type loginProvider = ILoginProvider | null;
const loginAtom = atom(null as loginProvider);
export const useLogin = (): [loginProvider, SetAtom<loginProvider>] => {
  const [login, setLogin] = useAtom(loginAtom);
  showLoginDlg = setLogin;
  return [login, setLogin];
};

export const LoginDlg: FC = () => {
  const dataCrypt = di(IDataCryptKey);
  const [login, setLogin] = useLogin();
  const [id, setId] = useState("");

  if (!id) {
    const qrDeviceInfo: AuthenticateReq = {
      n: dataCrypt.generateRandomString(10),
      d: "Edge IPad",
      k: dataCrypt.generateRandomString(10),
      c: dataCrypt.generateRandomString(10),
    };
    const js = JSON.stringify(qrDeviceInfo);
    const js64 = stringToBase64(js);
    setId(js64);
  }

  const handleEnter = (event: any): void => {
    if (event.code === "Enter") {
      const okButton = document.getElementById("OKButton");
      okButton?.click();
    }
  };

  const cancel = (): void => {
    login?.cancelLogin();
    setLogin(null);
  };

  return (
    <Dialog open={login !== null} onClose={cancel}>
      <Box style={{ width: dialogWidth, height: dialogHeight, padding: 20 }}>
        <Typography variant="h5" style={{ paddingBottom: 0 }}>
          Enable Sync
        </Typography>

        <QRCodeGuideText />
        <QRCodeElement id={id} />
        <ClickHint />

        <Formik
          initialValues={{ deviceName: "" }}
          validate={async (values) => {
            const errors: any = {};
            // if (!values.username) {
            //   errors.username = "Required";
            // }
            return errors;
          }}
          onSubmit={async (values, { setErrors, setFieldValue }) => {
            // if (createAccount) {
            //   const createResult = await login?.createAccount({
            //     username: "",
            //     password: "",
            //   });

            //   if (isError(createResult)) {
            //     // setFieldValue("password", "", false);
            //     // setErrors({ username: "User already exist" });
            //     return;
            //   }

            //   // setDefaultUserName(values.username);
            //   // setCreateAccount(false);
            //   // setFieldValue("confirm", "", false);
            // }

            const loginResult = await login?.login();
            if (isError(loginResult)) {
              // setFieldValue("password", "", false);
              // if (isError(loginResult, AuthenticateError)) {
              //   setErrors({ username: "Invalid username or password" });
              // } else {
              //   setErrors({ username: "Failed to enable device sync" });
              // }

              return;
            }

            //setDefaultUserName(values.username);
            setLogin(null);
          }}
        >
          {({ submitForm, isSubmitting }) => (
            <Form onKeyUp={handleEnter}>
              {isSubmitting && <LinearProgress style={{ marginBottom: 5 }} />}
              {/* <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Button
                  id="LoginButton"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting}
                  onClick={submitForm}
                  style={{
                    marginTop: 15,
                    marginBottom: 30,
                  }}
                >
                  Login
                </Button>
              </div> */}

              <div
                style={{
                  position: "absolute",
                  bottom: 15,
                  width: dialogWidth,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Button
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting}
                  onClick={cancel}
                  style={{ width: 85 }}
                >
                  Cancel
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </Box>
    </Dialog>
  );
};

const QRCodeGuideText: FC = () => {
  const text =
    "Scan QR code on your mobile to enable sync with all your devices.";

  return (
    <Typography
      style={{
        fontSize: "14px",
        paddingTop: 15,
        lineHeight: 1,
      }}
    >
      {text}
    </Typography>
  );
};

type QRCodeProps = {
  id: string;
};

const QRCodeElement: FC<QRCodeProps> = ({ id }) => {
  const authenticateUrl = getAuthenticateUrl(id);
  console.log("authurl", authenticateUrl.length);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: 20,
        }}
      >
        <Tooltip title={authenticateUrl}>
          <Link href={authenticateUrl} target="_blank">
            <QRCode value={authenticateUrl} />
          </Link>
        </Tooltip>
      </div>
    </>
  );
};

const ClickHint: FC = () => {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Typography style={{ fontSize: "12px" }}>
          (Click on QR code if this is your mobile)
        </Typography>
      </div>
    </>
  );
};
