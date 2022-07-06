import {
  Button,
  LinearProgress,
  Link,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { Form, Formik } from "formik";
import React from "react";
import { FC } from "react";
import { QRCode } from "react-qrcode-logo";

type SyncProps = {
  id: string;
};

export const Sync: FC<SyncProps> = ({ id }) => {
  const handleEnter = (event: any): void => {
    if (event.code === "Enter") {
      const okButton = document.getElementById("OKButton");
      okButton?.click();
    }
  };

  let host = window.location.host;
  // host = "gray-flower-0e8083b03-6.westeurope.1.azurestaticapps.net";
  const baseUrl = `${window.location.protocol}//${host}`;
  const url = `${baseUrl}/?lg=${id}`;

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

            <Typography
              style={{
                fontSize: "14px",
                padding: 10,
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
                  <QRCode value={url} />
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
            </div>
          </Form>
        )}
      </Formik>
    </>
  );
};
