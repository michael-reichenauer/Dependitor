import { di, diKey, singleton } from "../common/di";
import {
  NoContactError,
  LocalApiServerError,
  LocalEmulatorError,
  IApiKey,
  IApi,
  LoginDeviceSetReq,
  User,
} from "../common/Api";
import Result, { isError } from "../common/Result";
import { AuthenticateError } from "../common/Api";
import { IAuthenticate, IAuthenticateKey } from "../common/authenticate";
import {
  showConfirmAlert,
  showNoOKAlert,
  showOKAlert,
} from "../common/AlertDialog";
import {
  WebAuthnCanceledError,
  WebAuthnNeedReloadError,
} from "../common/webauthn";
import { setErrorMessage, setSuccessMessage } from "../common/MessageSnackbar";
import { IAddDeviceProvider } from "./AddDeviceDlg";
import { ILocalStore, ILocalStoreKey } from "../common/LocalStore";
import { base64ToString } from "../common/utils";
import { IKeyVault, IKeyVaultKey } from "../common/keyVault";
import { IDataCrypt, IDataCryptKey } from "../common/DataCrypt";

// To Authenticator:
// * username (id)
// * device description, e.g. 'Edge IPad'
// * kek
// * channel id

// To Device:
// * auth Token

// AuthenticateReq is request info that a device encodes in a QR code to the authenticator
export interface AuthenticateReq {
  n: string; // Unique client device name for this client/browser instance
  d: string; // Client description, like .e.g Edge, IPad
  k: string; // The password key to encrypt response from authenticator to this device
  c: string; // The channel id where this device is polling for authenticator response
}

// AuthenticatorRsp is the response to the device for an AuthenticateReq request
export interface AuthenticateRsp {
  wDek: string;
  username: string;
  isAccepted: boolean;
}

// Online is uses to control if device database sync should and can be enable or not
export const IAuthenticatorKey = diKey<IAuthenticator>();
export interface IAuthenticator {
  isAuthenticatorApp(): boolean;
  activate(): void;
}

export function getAuthenticateUrl(id: string): string {
  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  return `${baseUrl}${baseAuthenticatorPart}${id}`;
}

const baseAuthenticatorPart = "/a/";
const deviceIdsKey = "authenticator.deviceIds";
const maxDeviceIdSize = 10;

@singleton(IAuthenticatorKey)
export class Authenticator implements IAuthenticator, IAddDeviceProvider {
  private activated = false;

  constructor(
    private authenticate: IAuthenticate = di(IAuthenticateKey),
    private api: IApi = di(IApiKey),
    private localStore: ILocalStore = di(ILocalStoreKey),
    private dataCrypt: IDataCrypt = di(IDataCryptKey),
    private keyVault: IKeyVault = di(IKeyVaultKey)
  ) {}

  async add(): Promise<Result<void>> {
    console.log("add device");
  }
  cancelAdd(): void {
    console.log("cancel add");
  }

  public isAuthenticatorApp(): boolean {
    return window.location.pathname.startsWith(baseAuthenticatorPart);
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

    const device = this.getAuthenticateReq();
    if (isError(device)) {
      return;
    }
    //this.clearDeviceId(device.n);

    const description = device.d;

    showConfirmAlert(
      "Add Device",
      `Do you want to allow device '${description}' to sync with all your devices?`,
      async () => {
        const rsp = await this.sendAuthenticateOKResponse(device);
        if (isError(rsp)) {
          showOKAlert(
            "Error",
            "Failed to communicate with device requesting authorization."
          );
          return;
        }
        setSuccessMessage(`Allowed '${description}' to sync`);
      },
      async () => {
        setErrorMessage(`Denied device '${description}' request`);
        const rsp = await this.sendAuthenticateFailedResponse(device);
        if (isError(rsp)) {
          showOKAlert(
            "Error",
            "Failed to communicate with device requesting authorization."
          );
          return;
        }
      }
    );
  }

  private async sendAuthenticateOKResponse(
    authRequest: AuthenticateReq
  ): Promise<Result<void>> {
    const info = this.authenticate.readUserInfo();
    if (isError(info)) {
      return info;
    }

    const channelId = authRequest.c;
    const user: User = { username: authRequest.n, password: authRequest.k };

    console.log("dek", this.keyVault.getDek());
    const wDek = await this.dataCrypt.wrapDataEncryptionKey(
      this.keyVault.getDek(),
      user
    );

    const rsp: AuthenticateRsp = {
      username: info.username,
      wDek: wDek,
      isAccepted: true,
    };

    const rspJson = JSON.stringify(rsp);

    const dek = await this.dataCrypt.deriveDataEncryptionKey(user);
    const authData = await this.dataCrypt.encryptText(rspJson, dek);
    console.log("rspjs", rspJson);

    const dek2 = await this.dataCrypt.deriveDataEncryptionKey(user);
    const authData2 = await this.dataCrypt.decryptText(authData, dek2);
    console.log("rspjs2", authData2);

    const loginDeviceSetReq: LoginDeviceSetReq = {
      channelId: channelId,
      isAccept: true,
      username: info.username,
      authData: authData,
    };

    return await this.api.loginDeviceSet(loginDeviceSetReq);
  }

  private async sendAuthenticateFailedResponse(
    authRequest: AuthenticateReq
  ): Promise<Result<void>> {
    const info = this.authenticate.readUserInfo();
    if (isError(info)) {
      return info;
    }

    const channelId = authRequest.c;
    const user: User = { username: authRequest.n, password: authRequest.k };

    const rsp: AuthenticateRsp = {
      username: "",
      wDek: "",
      isAccepted: false,
    };
    const rspJson = JSON.stringify(rsp);

    const dek = await this.dataCrypt.deriveDataEncryptionKey(user);
    const authData = await this.dataCrypt.encryptText(rspJson, dek);

    const loginDeviceSetReq: LoginDeviceSetReq = {
      channelId: channelId,
      isAccept: false,
      username: info.username,
      authData: authData,
    };

    return await this.api.loginDeviceSet(loginDeviceSetReq);
  }

  private getAuthenticateReq(): Result<AuthenticateReq> {
    try {
      if (!this.isAuthenticatorApp()) {
        return new Error();
      }

      const id = window.location.pathname.substring(
        baseAuthenticatorPart.length
      );

      if (this.isClearedId(id)) {
        // This id has been handled and the page was just reloaded, ignore
        return new Error();
      }

      const infoJs = base64ToString(id);
      return JSON.parse(infoJs);
    } catch (error) {
      return error as Error;
    }
  }

  // clearDeviceId remembers handled device id, in case the page is reloaded.
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

  // isClearedId returns true if this device id has been handled before
  private isClearedId(id: string): boolean {
    const deviceIds = this.localStore.readOrDefault<Array<string>>(
      deviceIdsKey,
      []
    );
    return deviceIds.includes(id);
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
