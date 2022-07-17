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
import { ErrorAlert, showAlert, SuccessAlert } from "../common/AlertDialog";
import {
  WebAuthnCanceledError,
  WebAuthnNeedReloadError,
} from "../common/webauthn";
import { ILocalStoreKey } from "../common/LocalStore";
import {
  base64ToString,
  delay,
  minutes,
  seconds,
  stringToBase64,
} from "../common/utils";
import { IKeyVaultKey } from "../common/keyVault";
import { IDataCryptKey } from "../common/DataCrypt";
import { CustomError } from "../common/CustomError";
import now from "../common/stopwatch";
const uaParser = require("ua-parser-js");

export class AuthenticationNotAcceptedError extends CustomError {}
export class AuthenticationCanceledError extends CustomError {}

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

export interface AuthenticateOperation {
  request: AuthenticateReq;
  isStarted: boolean;
  isCanceled: boolean;
}

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

const baseAuthenticatorPart = "/a/";
const deviceIdsKey = "/a/authenticator.deviceIds";
const maxStoredDeviceIdCount = 20;
const randomIdLength = 12;
const tryLoginTimeout = 3 * minutes; // Wait for authenticator to allow/deny login
const tryLoginPreWait = 4 * seconds; // Time before starting to poll for result

@singleton(IAuthenticatorKey)
export class Authenticator implements IAuthenticator {
  private activated = false;

  constructor(
    private authenticate = di(IAuthenticateKey),
    private api = di(IApiKey),
    private localStore = di(ILocalStoreKey),
    private dataCrypt = di(IDataCryptKey),
    private keyVault = di(IKeyVaultKey)
  ) {
    if (this.isAuthenticatorApp()) {
      this.authenticate.setIsAuthenticator();
    }
  }

  public isAuthenticatorApp(): boolean {
    return window.location.pathname.startsWith(baseAuthenticatorPart);
  }

  public getAuthenticateRequest(): AuthenticateOperation {
    const ua = uaParser();

    const model = !!ua.device.model ? ua.device.model : ua.os.name;
    const description = `${ua.browser.name} on ${model}`;
    let clientId: string;
    const userInfo = this.authenticate.readUserInfo();
    if (isError(userInfo) || !userInfo.clientId) {
      clientId = this.dataCrypt.generateRandomString(randomIdLength);
    } else {
      clientId = userInfo.clientId;
    }

    const authenticateReq: AuthenticateReq = {
      n: clientId,
      d: description,
      k: this.dataCrypt.generateRandomString(randomIdLength),
      c: this.dataCrypt.generateRandomString(randomIdLength),
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
    if (operation.isStarted) {
      console.log("Already started");
      return;
    }

    operation.isStarted = true;

    const clientId = operation.request.n;
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
    if (isError(dek)) {
      return dek;
    }

    this.authenticate.setLoggedIn(authenticateRsp.username, clientId, dek);
  }

  public activate(): void {
    if (this.activated) {
      return;
    }
    this.activated = true;

    this.enable();
  }

  private async enable(): Promise<Result<void>> {
    console.log("enable");

    if (this.isClearedId()) {
      this.showClosePageAlert();
      return;
    }

    const device = this.getAuthenticateReq();
    if (isError(device)) {
      this.showInvalidRequestAlert();
      return;
    }

    const description = device.d;

    const checkRsp = await this.authenticate.check();
    if (isError(checkRsp)) {
      if (!isError(checkRsp, AuthenticateError)) {
        this.clearDeviceId();
        this.showErrorAlert(checkRsp);
        return;
      }

      const loginRsp = await this.authenticate.login();
      if (isError(loginRsp)) {
        if (isError(loginRsp, WebAuthnNeedReloadError)) {
          this.showReloadPageAlert();
          return;
        }
        this.clearDeviceId();

        if (isError(loginRsp, WebAuthnCanceledError)) {
          this.showCanceledAlert(description);
          return;
        }

        this.showErrorAlert(loginRsp);
        return;
      }
    }

    //await this.login();
    console.log("Logged in");
    this.clearDeviceId();
    const userInfo = this.authenticate.readUserInfo();
    if (isError(userInfo)) {
      return userInfo;
    }

    const rsp = await this.postAuthenticateOKResponse(device, userInfo);
    if (isError(rsp)) {
      this.showFailedToCommunicateAlert(description);
      return;
    }

    this.showAllowedAlert(description);
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

  private async postAuthenticateResponse(
    authenticateRsp: AuthenticateRsp,
    user: User,
    channelId: string,
    isAccept: boolean
  ): Promise<Result<void>> {
    console.log("post auth rsp", authenticateRsp);
    // Serialize the response
    const rspJson = JSON.stringify(authenticateRsp);

    // Encrypt the response
    const authDataDek = await this.dataCrypt.deriveDataEncryptionKey(user);
    const authData = await this.dataCrypt.encryptText(rspJson, authDataDek);

    // Post the response
    const loginDeviceSetReq: LoginDeviceSetReq = {
      channelId: channelId,
      username: authenticateRsp.username,
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
    if (isError(rspJson)) {
      return rspJson;
    }
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
        for (let t = now(); t.time() < 1 * seconds; ) {
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
    let id: string = "";
    try {
      if (!this.isAuthenticatorApp()) {
        return new Error();
      }

      if (this.isClearedId()) {
        // This id has been handled and the page was just reloaded, ignore
        return new Error();
      }

      id = window.location.pathname.substring(baseAuthenticatorPart.length);

      const infoJs = base64ToString(id);
      const authenticateReq: AuthenticateReq = JSON.parse(infoJs);

      return authenticateReq;
    } catch (error) {
      if (id) {
        this.clearDeviceId();
      }
      return error as Error;
    }
  }

  // clearDeviceId remembers handled device id, in case the page is reloaded.
  private clearDeviceId(): void {
    const id = window.location.pathname.substring(baseAuthenticatorPart.length);
    if (!id) {
      return;
    }

    let deviceIds = this.localStore.readOrDefault<Array<string>>(
      deviceIdsKey,
      []
    );

    if (deviceIds.includes(id)) {
      return;
    }

    // Prepend id and store the most resent ids
    deviceIds.unshift(id);
    this.localStore.write(
      deviceIdsKey,
      deviceIds.slice(0, maxStoredDeviceIdCount)
    );
  }

  // isClearedId returns true if this device id has been handled before
  private isClearedId(): boolean {
    const id = window.location.pathname.substring(baseAuthenticatorPart.length);
    const deviceIds = this.localStore.readOrDefault<Array<string>>(
      deviceIdsKey,
      []
    );

    return deviceIds.includes(id);
  }

  private showAllowedAlert(description: string) {
    showAlert(
      "Allowed Device",
      `Device '${description}' is now authenticated and allowed to sync with all your devices.`,
      { icon: SuccessAlert, showOk: false }
    );
  }

  private showFailedToCommunicateAlert(description: string) {
    showAlert(
      "Error",
      `Failed to communicate with device '${description}' requesting authorization.

        Please close this page.`,
      { icon: ErrorAlert, showOk: false }
    );
  }

  private showCanceledAlert(description: string) {
    showAlert(
      "Canceled",
      `Authentication was canceled. 
            Device '${description}' was not authenticated and allowed to sync. 

            Please close this page.`,
      { icon: ErrorAlert, showOk: false, showCancel: false }
    );
  }

  private showReloadPageAlert() {
    showAlert(
      "Reload Page",
      `Please manually reload this page to show the authentication dialog.

            This browser requires a recently manually loaded page before allowing access to authentication.`,
      { showOk: false, showCancel: false }
    );
  }

  private showClosePageAlert() {
    showAlert(
      "Close Page",
      `This device request has been handled.
  
      You can close this page.`,
      { showOk: false, showCancel: false }
    );
  }

  private showErrorAlert(error: never) {
    const errorMsg = this.toErrorMessage(error);
    showAlert(
      "Error",
      `${errorMsg}

          Please close this page.`,
      {
        showOk: false,
        showCancel: false,
        icon: ErrorAlert,
      }
    );
  }

  private showInvalidRequestAlert() {
    showAlert(
      "Error",
      `Invalid device request

        Please close this page.`,
      {
        showOk: false,
        showCancel: false,
        icon: ErrorAlert,
      }
    );
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
