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
import { ErrorAlert, showAlert, SuccessAlert } from "../common/AlertDialog";
import { IAuthenticatorProtocolKey } from "./AuthenticatorProtocol";
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

export const AuthenticatorPage: FC = () => {
  const authenticator = di(IAuthenticatorKey);

  const showResponseMessage = (rsp: any) => {
    if (isError(rsp, NoRequestError)) {
      showClosePageAlert();
      return;
    }
    if (isError(rsp, InvalidRequestError)) {
      showInvalidRequestAlert();
      return;
    }
    if (isError(rsp, WebAuthnNeedReloadError)) {
      showReloadPageAlert();
      return;
    }
    if (isError(rsp, WebAuthnCanceledError)) {
      showCanceledAlert();
      return;
    }
    if (isError(rsp, FailedToRespondError)) {
      showFailedToCommunicateAlert();
      return;
    }
    if (isError(rsp)) {
      showErrorAlert(rsp);
      return;
    }

    if (rsp) {
      showDeviceAuthenticatedMessage(rsp);
    }
  };

  useEffect(() => {
    document.title = "Authenticator";
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

function showDeviceAuthenticatedMessage(description: string) {
  showAlert(
    "Device Authenticated",
    `'${description}' device s now authenticated
     and allowed to sync with all your devices.`,
    { icon: SuccessAlert, onOk: () => resetUrl() }
  );
}

function showClosePageAlert() {
  showAlert("Close Page", `You can now close this page.`, {
    showOk: false,
    showCancel: false,
  });
}

function showInvalidRequestAlert() {
  showAlert("Error", `Invalid device authentication request`, {
    icon: ErrorAlert,
    onOk: () => resetUrl(),
  });
}

function showErrorAlert(error: Error) {
  const errorMsg = toErrorMessage(error);
  showAlert("Error", `${errorMsg}`, {
    icon: ErrorAlert,
    onOk: () => resetUrl(),
  });
}

function showReloadPageAlert() {
  showAlert(
    "Reload Page",
    `Please manually reload this page to show the authentication dialog.

    This browser requires a recently manually loaded page before allowing access to authentication.`,
    { showOk: false, showCancel: false }
  );
}

function showCanceledAlert() {
  showAlert(
    "Canceled",
    `Authentication was canceled.
    Device was not authenticated and allowed to sync. `,
    { icon: ErrorAlert, onOk: () => resetUrl() }
  );
}

function showFailedToCommunicateAlert() {
  showAlert(
    "Error",
    `Failed to communicate with device requesting authorization.`,
    { icon: ErrorAlert, onOk: () => resetUrl() }
  );
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
    return "Invalid credentials. Please try again with different credentials.";
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
  window.location.replace(di(IAuthenticatorProtocolKey).getAuthenticatorUrl());
}
