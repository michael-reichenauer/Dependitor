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
import { isMobileDevice } from "../common/utils";
import {
  AuthenticatorCanceledError,
  AuthenticatorNotAcceptedError,
} from "../authenticator/AuthenticatorClient";
import { ILoginProvider } from "./LoginProvider";
import { IOnlineKey } from "./Online";
import { di } from "../common/di";
import { useLocalStorage } from "../common/useLocalStorage";
import { showQuestionAlert } from "../common/AlertDialog";

const dialogWidth = 290;
const dialogHeight = 410;

// const deviceSyncCanceledMsg = "Authentication canceled";
const deviceSyncFailedMsg = "Failed to enable device sync";
const authenticationNotAcceptedMsg =
  "Authentication was denied by the authenticator";
const initialQrGuideText =
  "Scan QR code on your mobile to enable sync with all your devices.";

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
  const [isFirst, setIsFirst] = useLocalStorage("loginDlg.isFirstTime", true);

  useEffect(() => {
    if (!login && isFirst) {
      showFirstTimeSyncPrompt();
      setIsFirst(false);
    }
  }, [login, isFirst, setIsFirst]);

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

        login.isLocalLoginSupported().then((isSupported) => {
          if (isSupported && !login.hasEnabledLocalLoginDevice()) {
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
    login?.cancelLoginViaAuthenticator();
    login?.cancelLoginLocalDevice();
    setLogin(null);
  };

  const qrGuideText = initialQrGuideText;
  const qrCodeUrl = login?.getAuthenticatorUrl() ?? "";

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
            // Cancel login via authenticator, since we are logging in locally
            login?.cancelLoginViaAuthenticator();
            login?.loginLocalDevice();

            // Closing the login dialog
            setLogin(null);
          }}
        >
          {({ submitForm, isSubmitting }) => (
            <Form onKeyUp={handleEnter}>
              <QRCodeGuideText text={qrGuideText} />
              <QRCodeElement url={qrCodeUrl} />
              {isMobileDevice || (
                <>
                  <Typography
                    style={{
                      fontSize: "14px",
                      paddingTop: 20,
                      lineHeight: 1,
                    }}
                  >
                    Or if this device is your main mobile:
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
                        marginTop: 5,
                      }}
                    >
                      Login on this Mobile
                    </Button>
                  </div>
                </>
              )}

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
                  style={{}}
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

async function showEnableLocalLoginPrompt(login: ILoginProvider) {
  if (
    await showQuestionAlert(
      "Enable Local Device Login",
      `Would you like to setup local login on this device?
  
      Recommended, since you do not need your mobile every time you login.`,
      {
        okText: "Yes",
        cancelText: "Later",
      }
    )
  ) {
    login?.loginLocalDevice();
  }
}

async function showFirstTimeSyncPrompt() {
  if (
    await showQuestionAlert(
      "Enable Sync",
      `Would you like to login and enable device sync with all your devices?
  
      You can, of course, enable sync at a later time.`,
      {
        okText: "Yes",
        cancelText: "Later",
      }
    )
  ) {
    di(IOnlineKey).enableDeviceSync();
  }
}
