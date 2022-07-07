import { LinearProgress, Typography } from "@material-ui/core";
import { Form, Formik } from "formik";
import React from "react";
import { FC } from "react";
import { di } from "../common/di";
import { IAuthenticatorKey } from "./Authenticator";

export const AuthenticatorPage: FC = () => {
  const authenticator = di(IAuthenticatorKey);
  authenticator.activate();

  const handleEnter = (event: any): void => {
    if (event.code === "Enter") {
      const okButton = document.getElementById("OKButton");
      okButton?.click();
    }
  };

  return (
    <>
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
          //   const loginResult = await login?.login();
          //   if (isError(loginResult)) {
          //     // setFieldValue("password", "", false);
          //     // if (isError(loginResult, AuthenticateError)) {
          //     //   setErrors({ username: "Invalid username or password" });
          //     // } else {
          //     //   setErrors({ username: "Failed to enable device sync" });
          //     // }
          //     return;
          //   }
          //   //setDefaultUserName(values.username);
          //   setLogin(null);
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

            <Typography>Your current synced devices:</Typography>

            {/* <div
              style={{
                position: "absolute",
                bottom: 15,
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Button
                variant="contained"
                color="primary"
                disabled={isSubmitting}
                onClick={() => {
                  //   setLogin(null);
                  //   login?.cancelLogin();
                }}
                style={{ width: 85 }}
              >
                Cancel
              </Button>
            </div> */}
          </Form>
        )}
      </Formik>
    </>
  );
};
