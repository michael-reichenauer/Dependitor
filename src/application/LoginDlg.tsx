import React, { FC } from "react";
import { atom, useAtom } from "jotai";
import {
  Box,
  Button,
  Dialog,
  LinearProgress,
  TextField,
  Typography,
} from "@material-ui/core";
import { Formik, Form, Field } from "formik";
//import { TextField } from "formik-material-ui";
import Result, { isError } from "../common/Result";
import { SetAtom } from "jotai/core/types";
import { QRCode } from "react-qrcode-logo";
//import { AuthenticateError } from "../common/Api";

// const usernameKey = "credential.userName";

export interface ILoginProvider {
  // createAccount(user: User): Promise<Result<void>>;
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

  const handleEnter = (event: any): void => {
    if (event.code === "Enter") {
      const okButton = document.getElementById("OKButton");
      okButton?.click();
    }
  };

  return (
    <Dialog
      open={login !== null}
      onClose={() => {
        login?.cancelLogin();
        setLogin(null);
      }}
    >
      <Box style={{ width: 270, height: 350, padding: 20 }}>
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
              <Field
                label="Device Name"
                component={TextField}
                type="text"
                name="deviceName"
                fullWidth={true}
                defaultValue="Hello World"
              />

              <div
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
              </div>

              <Typography
                style={{ fontSize: "12px", paddingTop: 40, lineHeight: 1 }}
              >
                Or scan QR code with your mobile to login and sync with other
                devices.
              </Typography>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <QRCode value="https://dependitor.com" size={100} />
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
