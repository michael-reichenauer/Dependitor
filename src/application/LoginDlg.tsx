import React, { FC, useEffect } from "react";
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
import { isError } from "../common/Result";
import { SetAtom } from "jotai/core/types";
import { QRCode } from "react-qrcode-logo";
import { setErrorMessage } from "../common/MessageSnackbar";
import { showAlert, QuestionAlert } from "../common/AlertDialog";
import { isMobileDevice } from "../common/utils";
import {
  AuthenticatorCanceledError,
  AuthenticatorNotAcceptedError,
} from "../authenticator/AuthenticatorClient";
import { ILoginProvider } from "./LoginProvider";

const dialogWidth = 290;
const dialogHeight = 410;

// const deviceSyncCanceledMsg = "Authentication canceled";
const deviceSyncFailedMsg = "Failed to enable device sync";
const authenticationNotAcceptedMsg =
  "Authentication was denied by the authenticator";
const initialQrGuideText =
  "Scan QR code on your mobile to enable sync with all your devices.";
const localQrGuideText = "Or scan QR code on your mobile device.";

export function showLoginDlg(provider: ILoginProvider) {
  setLoginFunc(provider);
}

let setLoginFunc: SetAtom<ILoginProvider> = () => {};
type loginProvider = ILoginProvider | null;
const loginAtom = atom(null as loginProvider);
const useLogin = (): [loginProvider, SetAtom<loginProvider>] => {
  const [login, setLogin] = useAtom(loginAtom);
  setLoginFunc = setLogin;
  return [login, setLogin];
};

export const LoginDlg: FC = () => {
  const [login, setLogin] = useLogin();

  useEffect(() => {
    if (login) {
      login.tryLoginViaAuthenticator().then((rsp) => {
        setLogin(null);
        if (isError(rsp)) {
          if (isError(rsp, AuthenticatorCanceledError)) {
            // Ignore user canceled
          } else if (isError(rsp, AuthenticatorNotAcceptedError)) {
            // The authenticator did not accept this device authenticate request
            setErrorMessage(authenticationNotAcceptedMsg);
          } else {
            // Some other error
            setErrorMessage(deviceSyncFailedMsg);
          }

          return;
        }

        login.supportLocalLogin().then((isSupported) => {
          if (isSupported && !login.hasLocalLogin()) {
            showEnableLocalLoginPrompt(login);
          }
        });
      });
    }
  }, [login, setLogin]);

  const handleEnter = (event: any): void => {
    if (event.code === "Enter") {
      const okButton = document.getElementById("OKButton");
      okButton?.click();
    }
  };

  const cancel = (): void => {
    login?.loginViaAuthenticator();
    login?.cancelLogin();
    setLogin(null);
  };

  const qrGuideText = login?.hasLocalLogin()
    ? localQrGuideText
    : initialQrGuideText;
  const qrCodeUrl = login?.getAuthenticateUrl() ?? "";

  return (
    <Dialog open={login !== null} onClose={() => {}}>
      <Box style={{ width: dialogWidth, height: dialogHeight, padding: 20 }}>
        <LinearProgress style={{ marginBottom: 5 }} />
        <Typography variant="h5" style={{ paddingBottom: 0 }}>
          Login
        </Typography>

        <Formik
          initialValues={{ deviceName: "" }}
          onSubmit={async (values, { setErrors, setFieldValue }) => {
            console.log("onSubmit");

            // Cancel login via authenticator, since we are logging in locally
            login?.loginViaAuthenticator();
            login?.login();

            // Closing the login dialog
            setLogin(null);
          }}
        >
          {({ submitForm, isSubmitting }) => (
            <Form onKeyUp={handleEnter}>
              {login?.hasLocalLogin() && (
                <>
                  <Typography
                    style={{
                      fontSize: "14px",
                      paddingTop: 10,
                      lineHeight: 1,
                    }}
                  >
                    Local login:
                  </Typography>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Button
                      id="OKButton"
                      variant="contained"
                      color="primary"
                      disabled={isSubmitting}
                      onClick={submitForm}
                      style={{
                        marginTop: 15,
                        marginBottom: 30,
                      }}
                    >
                      Login on this Device
                    </Button>
                  </div>
                </>
              )}

              <QRCodeGuideText text={qrGuideText} />
              <QRCodeElement url={qrCodeUrl} />
              {isMobileDevice && <ClickHint />}

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

type QRCodeGuideTextProps = {
  text: string;
};

const QRCodeGuideText: FC<QRCodeGuideTextProps> = ({ text }) => {
  return (
    <Typography
      style={{
        fontSize: "14px",
        paddingTop: 5,
        lineHeight: 1,
      }}
    >
      {text}
    </Typography>
  );
};

type QRCodeProps = {
  url: string;
};

const QRCodeElement: FC<QRCodeProps> = ({ url }) => {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: 10,
        }}
      >
        <Tooltip title={url}>
          <Link href={url} target="_blank">
            <QRCode value={url} />
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
          marginTop: -5,
        }}
      >
        <Typography style={{ fontSize: "12px" }}>
          (Click on QR code if this is your mobile)
        </Typography>
      </div>
    </>
  );
};

function showEnableLocalLoginPrompt(login: ILoginProvider) {
  showAlert(
    "Enable Device Login",
    `Would you like to setup login on this device?
  
                Recommended, since you do not need your mobile every time you login.`,
    {
      onOk: () => login?.login(),
      cancelText: "Skip",
      showCancel: true,
      icon: QuestionAlert,
    }
  );
}
