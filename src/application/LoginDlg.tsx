import React, { FC } from "react";
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
import { randomString } from "../common/utils";

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
  const [login, setLogin] = useLogin();

  const randomId = randomString(15);
  const handleEnter = (event: any): void => {
    if (event.code === "Enter") {
      const okButton = document.getElementById("OKButton");
      okButton?.click();
    }
  };
  const url = `${window.location.href}login/${randomId}`;
  const dialogWidth = 290;
  const dialogHeight = 340;

  return (
    <Dialog
      open={login !== null}
      onClose={() => {
        login?.cancelLogin();
        setLogin(null);
      }}
    >
      <Box style={{ width: dialogWidth, height: dialogHeight, padding: 20 }}>
        <Typography variant="h5" style={{ paddingBottom: 10 }}>
          Login
        </Typography>

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

              <Typography
                style={{
                  fontSize: "14px",
                  paddingTop: 15,
                  paddingBottom: 20,
                  lineHeight: 1,
                }}
              >
                Scan QR code, or click link, on your mobile to login and enable
                sync with all your devices.
              </Typography>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Tooltip title={url}>
                  <Link href={url} target="_blank">
                    <QRCode value={url} size={130} />
                  </Link>
                </Tooltip>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Tooltip title={url}>
                  <Typography style={{ fontSize: "12px", paddingTop: 0 }}>
                    <Link href={url} target="_blank">
                      {url}
                    </Link>
                  </Typography>
                </Tooltip>
              </div>

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
                  onClick={() => {
                    setLogin(null);
                    login?.cancelLogin();
                  }}
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

// const getDefaultUserName = () => localStorage.getItem(usernameKey) ?? "";

// const setDefaultUserName = (name: string) =>
//   localStorage.setItem(usernameKey, name);
