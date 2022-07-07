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

const dialogWidth = 290;
const dialogHeight = 340;

export interface IAddDeviceProvider {
  add(): Promise<Result<void>>;
  cancelAdd(): void;
}

export let showAddDeviceDlg: SetAtom<IAddDeviceProvider> = () => {};

type addDeviceProvider = IAddDeviceProvider | null;
const addDeviceAtom = atom(null as addDeviceProvider);
export const useAddDevice = (): [
  addDeviceProvider,
  SetAtom<addDeviceProvider>
] => {
  const [addDevice, setAddDevice] = useAtom(addDeviceAtom);
  showAddDeviceDlg = setAddDevice;
  return [addDevice, setAddDevice];
};

export const AddDeviceDlg: FC = () => {
  const [addDevice, setAddDevice] = useAddDevice();
  const id = randomString(12);

  const handleEnter = (event: any): void => {
    if (event.code === "Enter") {
      const okButton = document.getElementById("OKButton");
      okButton?.click();
    }
  };

  const cancel = (): void => {
    addDevice?.cancelAdd();
    setAddDevice(null);
  };

  return (
    <Dialog open={addDevice !== null} onClose={cancel}>
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

            const loginResult = await addDevice?.add();
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
            setAddDevice(null);
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

function getAuthenticateUrl(id: string): string {
  const host = window.location.host;
  // host = "gray-flower-0e8083b03-6.westeurope.1.azurestaticapps.net";
  const baseUrl = `${window.location.protocol}//${host}`;
  return `${baseUrl}/?lg=${id}`;
}
