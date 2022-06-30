import React, { FC } from "react";
import { useState } from "react";
import { atom, useAtom } from "jotai";
import {
  Box,
  Button,
  Dialog,
  FormControlLabel,
  LinearProgress,
  Switch,
  Typography,
} from "@material-ui/core";
import { Formik, Form, Field } from "formik";
import { TextField } from "formik-material-ui";
import { User } from "../common/Api";
import Result, { isError } from "../common/Result";
import { SetAtom } from "jotai/core/types";
import { AuthenticateError } from "../common/Api";

const usernameKey = "credential.userName";

export interface ILoginProvider {
  createAccount(user: User): Promise<Result<void>>;
  login(user: User): Promise<Result<void>>;
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
  const [createAccount, setCreateAccount] = useState(false);

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
      <Box style={{ width: 320, height: 330, padding: 20 }}>
        {!createAccount && (
          <Typography variant="h5" style={{ paddingBottom: 10 }}>
            Login
          </Typography>
        )}
        {createAccount && (
          <Typography variant="h5" style={{ paddingBottom: 10 }}>
            Create a new Account
          </Typography>
        )}

        <Formik
          initialValues={{
            create: false,
          }}
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

            const loginResult = await login?.login({
              username: "",
              password: "",
            });
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
              {isSubmitting && <LinearProgress style={{ marginBottom: 10 }} />}
              {/* <Field
                label="Username"
                component={TextField}
                name="username"
                type="text"
                fullWidth={true}
              />
              <br />
              <Field
                label="Password"
                component={TextField}
                type="password"
                name="password"
                fullWidth={true}
              />
              <br />
              {createAccount && (
                <Field
                  label="Confirm"
                  component={TextField}
                  type="password"
                  name="confirm"
                  fullWidth={true}
                />
              )} */}

              <br />
              <FormControlLabel
                style={{ position: "absolute", top: 260 }}
                label="Create a new account"
                control={
                  <Field
                    component={Switch}
                    type="checkbox"
                    name="create"
                    color="primary"
                    onChange={(e: any) => setCreateAccount(e.target.checked)}
                  />
                }
              />

              <Box style={{ position: "absolute", top: 300, left: 80 }}>
                <Button
                  id="OKButton"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting}
                  onClick={submitForm}
                  style={{ margin: 5, width: 80 }}
                >
                  OK
                </Button>

                <Button
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting}
                  onClick={() => {
                    login?.cancelLogin();
                    setLogin(null);
                  }}
                  style={{ margin: 5, width: 85 }}
                >
                  Cancel
                </Button>
              </Box>
            </Form>
          )}
        </Formik>
      </Box>
    </Dialog>
  );
};

const getDefaultUserName = () => localStorage.getItem(usernameKey) ?? "";

const setDefaultUserName = (name: string) =>
  localStorage.setItem(usernameKey, name);
