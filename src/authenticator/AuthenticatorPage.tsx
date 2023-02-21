import React, { useEffect, FC } from "react";
import Progress from "../common/Progress";
import { di } from "../common/di";
import {
  FailedToRespondError,
  IAuthenticatorKey,
  InvalidRequestError,
  NoRequestError,
} from "./Authenticator";
import { isError } from "../common/Result";
import {
  AuthenticateError,
  LocalApiServerError,
  LocalEmulatorError,
  NoContactError,
} from "../common/Api";
import {
  WebAuthnCanceledError,
  WebAuthnNeedReloadError,
} from "../common/webauthn";
import {
  showErrorAlert,
  showInfoAlert,
  showSuccessAlert,
} from "../common/AlertDialog";
import { authenticatorAppDonePath, isAuthenticatorAppDone } from "./AuthenticatorProtocol";

export const AuthenticatorPage: FC = () => {
  const authenticator = di(IAuthenticatorKey);

  const showResponseMessage = (rsp: any) => {
    if (isError(rsp, NoRequestError)) {
      showClosePageAlert();
    } else if (isError(rsp, InvalidRequestError)) {
      showInvalidRequestAlert();
    } else if (isError(rsp, WebAuthnNeedReloadError)) {
      showReloadPageAlert();
    } else if (isError(rsp, WebAuthnCanceledError)) {
      showCanceledAlert();
    } else if (isError(rsp, FailedToRespondError)) {
      showFailedToCommunicateAlert();
    } else if (isError(rsp)) {
      showErrorDlg(rsp);
    } else if (rsp) {
      showDeviceAuthenticatedMessage();
    }
  };

  useEffect(() => {
    document.title = "Authenticator";
    if (isAuthenticatorAppDone()) {
      showClosePageAlert()
      return;
    }
    authenticator
      .handleAuthenticateRequest()
      .then((rsp) => showResponseMessage(rsp));
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

async function showDeviceAuthenticatedMessage() {
  if (
    await showSuccessAlert(
      "Device Authenticated",
      `The device is now authenticated
     and allowed to sync with all your devices.
     
     You will now be redirected to the Dependitor app.`
    )
  ) {
    resetUrl();
  }
}

function showClosePageAlert() {
  showInfoAlert("Close Page", `You can now close this page.`, {
    showOk: false,
    showCancel: false,
  });
}

async function showInvalidRequestAlert() {
  if (await showErrorAlert("Error", `Invalid device authentication request`)) {
    resetUrl();
  }
}

async function showErrorDlg(error: Error) {
  const errorMsg = toErrorMessage(error);
  if (await showErrorAlert("Error", `${errorMsg}`)) {
    resetUrl();
  }
}

function showReloadPageAlert() {
  showInfoAlert(
    "Reload Page",
    `Please manually reload this page to show the authentication dialog.

    This browser requires a recently manually loaded page before allowing access to authentication.`,
    { showOk: false, showCancel: false }
  );
}

async function showCanceledAlert() {
  if (
    await showErrorAlert(
      "Canceled",
      `Authentication was canceled.
    Device was not authenticated and allowed to sync. `
    )
  ) {
    resetUrl();
  }
}

async function showFailedToCommunicateAlert() {
  if (
    await showErrorAlert(
      "Error",
      `Failed to communicate with device requesting authorization.`
    )
  ) {
    resetUrl();
  }
}

// toErrorMessage translate network and sync errors to ui messages
function toErrorMessage(error?: Error): string {
  if (isError(error, LocalApiServerError)) {
    return "Local Azure functions api server is not started.";
  }
  if (isError(error, LocalEmulatorError)) {
    return "Local Azure storage emulator not started.";
  }
  if (isError(error, AuthenticateError)) {
    return "Authentication error. Please retry again.";
  }
  if (isError(error, NoContactError)) {
    return "No network contact with server. Please retry again in a while.";
  }
  if (isError(error, WebAuthnCanceledError)) {
    return "Authentication was canceled";
  }

  return "Internal server error";
}

function resetUrl(): void {
  window.location.replace(authenticatorAppDonePath());
}
