import { di, diKey, singleton } from "../common/di";
//import { IAuthenticate, IAuthenticateKey } from "../common/authenticate";
import {
  NoContactError,
  LocalApiServerError,
  LocalEmulatorError,
} from "../common/Api";
import Result, { isError } from "../common/Result";
import { AuthenticateError } from "../common/Api";
import { IAuthenticate, IAuthenticateKey } from "../common/authenticate";
import { showConfirmAlert, showNoOKAlert } from "../common/AlertDialog";
import {
  WebAuthnCanceledError,
  WebAuthnNeedReloadError,
} from "../common/webauthn";
import { setErrorMessage, setSuccessMessage } from "../common/MessageSnackbar";
import { IAddDeviceProvider } from "./AddDeviceDlg";
import { ILocalStore, ILocalStoreKey } from "../common/LocalStore";
//import { IStore, IStoreKey } from "./diagram/Store";

//import { ILocalStore, ILocalStoreKey } from "./../common/LocalStore";

// Online is uses to control if device database sync should and can be enable or not
export const IAuthenticatorKey = diKey<IAuthenticator>();
export interface IAuthenticator {
  isAuthenticatorApp(): boolean;
  activate(): void;
}

export function getAuthenticateUrl(id: string): string {
  const host = window.location.host;
  // host = "gray-flower-0e8083b03-6.westeurope.1.azurestaticapps.net";
  const baseUrl = `${window.location.protocol}//${host}`;
  return `${baseUrl}/${baseAuthenticatorPart}${id}`;
}

const baseAuthenticatorPart = "?a=";
const deviceIdsKey = "authenticator.deviceIds";
const maxDeviceIdSize = 10;

@singleton(IAuthenticatorKey)
export class Authenticator implements IAuthenticator, IAddDeviceProvider {
  private activated = false;

  constructor(
    private authenticate: IAuthenticate = di(IAuthenticateKey),
    private localStore: ILocalStore = di(ILocalStoreKey)
  ) {}

  async add(): Promise<Result<void>> {
    console.log("add device");
  }
  cancelAdd(): void {
    console.log("cancel add");
  }

  public isAuthenticatorApp(): boolean {
    return window.location.search.startsWith(baseAuthenticatorPart);
  }

  public activate(): void {
    if (this.activated) {
      return;
    }
    this.activated = true;
    console.log("Authenticator activated");

    this.enable();
  }

  private async enable(): Promise<Result<void>> {
    console.log("enable");

    const checkRsp = await this.authenticate.check();
    if (isError(checkRsp)) {
      if (!isError(checkRsp, AuthenticateError)) {
        const errorMsg = this.toErrorMessage(checkRsp);
        showNoOKAlert("Error", errorMsg);
        return;
      }

      const loginRsp = await this.authenticate.login();
      if (isError(loginRsp)) {
        if (isError(loginRsp, WebAuthnNeedReloadError)) {
          showNoOKAlert(
            "Reload Page",
            "Please manually reload this page to show the authentication dialog.\n" +
              "Unfortunately, this browser requires a recently manually loaded page before allowing access to authentication."
          );
          return;
        }

        const errorMsg = this.toErrorMessage(loginRsp);
        showNoOKAlert("Error", errorMsg);
        return;
      }
    }

    //await this.login();
    console.log("Logged in");

    const deviceId = this.getDeviceRequestId();
    if (!this.getDeviceRequestId()) {
      return;
    }

    showConfirmAlert(
      "Add Device",
      `Do you want to add device ${deviceId}?`,
      () => {
        setSuccessMessage(`Added device ${deviceId}`);
        this.clearDeviceId(deviceId);
      },
      () => {
        setErrorMessage(`Denied device request ${deviceId}`);
        this.clearDeviceId(deviceId);
      }
    );
  }

  private getDeviceRequestId(): string {
    if (!this.isAuthenticatorApp()) {
      return "";
    }
    const id = window.location.search.substring(baseAuthenticatorPart.length);
    if (this.isClearedId(id)) {
      return "";
    }
    return id;
  }

  private isClearedId(id: string): boolean {
    const deviceIds = this.localStore.readOrDefault<Array<string>>(
      deviceIdsKey,
      []
    );
    return deviceIds.includes(id);
  }

  private clearDeviceId(id: string): void {
    let deviceIds = this.localStore.readOrDefault<Array<string>>(
      deviceIdsKey,
      []
    );

    if (deviceIds.includes(id)) {
      return;
    }

    // Prepend id and store the most resent ids
    deviceIds.unshift(id);
    this.localStore.write(deviceIdsKey, deviceIds.slice(0, maxDeviceIdSize));
  }

  // toErrorMessage translate network and sync errors to ui messages
  private toErrorMessage(error?: Error): string {
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
}
