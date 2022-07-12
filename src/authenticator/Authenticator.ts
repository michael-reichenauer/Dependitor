import { di, diKey, singleton } from "../common/di";
import {
  NoContactError,
  LocalApiServerError,
  LocalEmulatorError,
  IApiKey,
  LoginDeviceSetReq,
  User,
  LoginDeviceReq,
} from "../common/Api";
import Result, { isError } from "../common/Result";
import { AuthenticateError } from "../common/Api";
import { IAuthenticateKey, UserInfo } from "../common/authenticate";
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
import { ILocalStoreKey } from "../common/LocalStore";
import { base64ToString, delay, stringToBase64 } from "../common/utils";
import { IKeyVaultConfigureKey, IKeyVaultKey } from "../common/keyVault";
import { IDataCryptKey } from "../common/DataCrypt";
import { CustomError } from "../common/CustomError";
import now from "../common/stopwatch";

export class AuthenticationNotAcceptedError extends CustomError {}
export class AuthenticationCanceledError extends CustomError {}

// AuthenticateReq is request info that a device encodes in a QR code to the authenticator
interface AuthenticateReq {
  n: string; // Unique client device name for this client/browser instance
  d: string; // Client description, like .e.g Edge, IPad
  k: string; // The password key to encrypt response from authenticator to this device
  c: string; // The channel id where this device is polling for authenticator response
}

// AuthenticatorRsp is the response to the device for an AuthenticateReq request
interface AuthenticateRsp {
  wDek: string;
  username: string;
  isAccepted: boolean;
}

export interface AuthenticateOperation {
  request: AuthenticateReq;
  isStarted: boolean;
  isCanceled: boolean;
}

// Online is uses to control if device database sync should and can be enable or not
export const IAuthenticatorKey = diKey<IAuthenticator>();
export interface IAuthenticator {
  isAuthenticatorApp(): boolean;
  activate(): void;
  getAuthenticateUrl(operation: AuthenticateOperation): string;
  getAuthenticateRequest(): AuthenticateOperation;
  tryLoginViaAuthenticator(
    operation: AuthenticateOperation
  ): Promise<Result<void>>;
}

const baseAuthenticatorPart = "/a/";
const deviceIdsKey = "authenticator.deviceIds";
const maxDeviceIdSize = 10;
const tryLoginTimeout = 60 * 1000; // One minute to wait for authenticator to allow/deny login
const tryLoginPreWait = 4 * 1000; // Time before starting to poll for result

@singleton(IAuthenticatorKey)
export class Authenticator implements IAuthenticator, IAddDeviceProvider {
  private activated = false;

  constructor(
    private authenticate = di(IAuthenticateKey),
    private api = di(IApiKey),
    private localStore = di(ILocalStoreKey),
    private dataCrypt = di(IDataCryptKey),
    private keyVault = di(IKeyVaultKey),
    private keyVaultConfig = di(IKeyVaultConfigureKey)
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

  public getAuthenticateRequest(): AuthenticateOperation {
    const dataCrypt = di(IDataCryptKey);

    const authenticateReq: AuthenticateReq = {
      n: dataCrypt.generateRandomString(10),
      d: "Edge IPad",
      k: dataCrypt.generateRandomString(10),
      c: dataCrypt.generateRandomString(10),
    };
    return { request: authenticateReq, isStarted: false, isCanceled: false };
  }

  public getAuthenticateUrl(operation: AuthenticateOperation): string {
    const requestJson = JSON.stringify(operation.request);
    const code = stringToBase64(requestJson);

    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    return `${baseUrl}${baseAuthenticatorPart}${code}`;
  }

  public async tryLoginViaAuthenticator(
    operation: AuthenticateOperation
  ): Promise<Result<void>> {
    console.log("tryLoginViaAuthenticator ", operation);
    if (operation.isStarted) {
      console.log("Already started");
      return;
    }

    operation.isStarted = true;

    const user: User = {
      username: operation.request.n,
      password: operation.request.k,
    };

    const authenticateRsp = await this.retrieveAuthenticateResponse(
      operation,
      user
    );
    if (isError(authenticateRsp)) {
      return authenticateRsp;
    }

    if (!authenticateRsp.isAccepted) {
      return new AuthenticationNotAcceptedError();
    }

    const wDek = authenticateRsp.wDek;
    const dek = await this.dataCrypt.unwrapDataEncryptionKey(wDek, user);
    this.keyVaultConfig.setDataEncryptionKey(dek);
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
    const userInfo = this.authenticate.readUserInfo();
    if (isError(userInfo)) {
      return userInfo;
    }

    const device = this.getAuthenticateReq();
    if (isError(device)) {
      return;
    }
    this.clearDeviceId(device.n);

    const description = device.d;

    showConfirmAlert(
      "Add Device",
      `Do you want to allow device '${description}' to sync with all your devices?`,
      async () => {
        const rsp = await this.postAuthenticateOKResponse(device, userInfo);
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
        const rsp = await this.postAuthenticateFailedResponse(device);
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

  private async postAuthenticateOKResponse(
    authRequest: AuthenticateReq,
    userInfo: UserInfo
  ): Promise<Result<void>> {
    const user: User = { username: authRequest.n, password: authRequest.k };

    // Get the data encryption key and wrap/encrypt it for the device user (as string)
    const wDek = await this.keyVault.getWrappedDataEncryptionKey(user);

    // Post a response to the device with the account user name and wDek
    const isAccepted = true;
    const rsp: AuthenticateRsp = {
      username: userInfo.username,
      wDek: wDek,
      isAccepted: isAccepted,
    };

    const channelId = authRequest.c;
    return await this.postAuthenticateResponse(
      rsp,
      user,
      channelId,
      isAccepted
    );
  }

  private async postAuthenticateFailedResponse(
    authRequest: AuthenticateReq
  ): Promise<Result<void>> {
    const user: User = { username: authRequest.n, password: authRequest.k };

    // Post a response to the device, where device is NOT accepted
    const isAccepted = false;
    const rsp: AuthenticateRsp = {
      username: "",
      wDek: "",
      isAccepted: isAccepted,
    };

    const channelId = authRequest.c;
    return await this.postAuthenticateResponse(
      rsp,
      user,
      channelId,
      isAccepted
    );
  }

  private async postAuthenticateResponse(
    authenticateRsp: AuthenticateRsp,
    user: User,
    channelId: string,
    isAccept: boolean
  ): Promise<Result<void>> {
    // Serialize the response
    const rspJson = JSON.stringify(authenticateRsp);

    // Encrypt the response
    const authDataDek = await this.dataCrypt.deriveDataEncryptionKey(user);
    const authData = await this.dataCrypt.encryptText(rspJson, authDataDek);

    // Post the response
    const loginDeviceSetReq: LoginDeviceSetReq = {
      channelId: channelId,
      username: user.username,
      isAccept: isAccept,
      authData: authData,
    };

    return await this.api.loginDeviceSet(loginDeviceSetReq);
  }

  private async retrieveAuthenticateResponse(
    operation: AuthenticateOperation,
    user: User
  ): Promise<Result<AuthenticateRsp>> {
    const authData = await this.loginDevice(operation);
    if (isError(authData)) {
      return authData;
    }

    const authDataDek = await this.dataCrypt.deriveDataEncryptionKey(user);
    const rspJson = await this.dataCrypt.decryptText(authData, authDataDek);
    const authenticateRsp = JSON.parse(rspJson);
    return authenticateRsp;
  }

  private async loginDevice(
    operation: AuthenticateOperation
  ): Promise<Result<string>> {
    const req: LoginDeviceReq = { channelId: operation.request.c };

    const startTime = now();

    // Wait a little before starting to poll since authenticator needs some time anyway
    while (startTime.time() < tryLoginPreWait) {
      if (operation.isCanceled) {
        return new AuthenticationCanceledError();
      }
      await delay(100);
    }

    while (startTime.time() < tryLoginTimeout) {
      const authData = await this.api.loginDevice(req);
      if (operation.isCanceled) {
        return new AuthenticationCanceledError();
      }
      if (isError(authData)) {
        return authData;
      }

      if (!authData) {
        // No auth data yet, lets wait a little before retrying again
        for (let t = now(); t.time() < 1000; ) {
          if (operation.isCanceled) {
            return new AuthenticationCanceledError();
          }
          await delay(100);
        }
        continue;
      }

      return authData;
    }

    // Failed to get auth data within timeout
    return new AuthenticateError();
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
