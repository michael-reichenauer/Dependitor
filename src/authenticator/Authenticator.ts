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
import { IAuthenticateKey } from "../common/authenticate";
import { ErrorAlert, showAlert, SuccessAlert } from "../common/AlertDialog";
import {
  WebAuthnCanceledError,
  WebAuthnNeedReloadError,
} from "../common/webauthn";
import {
  base64ToString,
  delay,
  jsonParse,
  minutes,
  seconds,
  stringToBase64,
} from "../common/utils";
import { IKeyVaultKey } from "../common/keyVault";
import { IDataCryptKey } from "../common/DataCrypt";
import { CustomError } from "../common/CustomError";
import now from "../common/stopwatch";
const uaParser = require("ua-parser-js");

export function isAuthenticatorApp(): boolean {
  return window.location.pathname.startsWith(authenticatorUrlPath);
}

// Online is uses to control if device database sync should and can be enable or not
export const IAuthenticatorKey = diKey<IAuthenticator>();
export interface IAuthenticator {
  activate(): void;
  getAuthenticateUrl(operation: AuthenticateOperation): string;
  getAuthenticateOperation(): AuthenticateOperation;
  tryLoginViaAuthenticator(
    operation: AuthenticateOperation
  ): Promise<Result<void>>;
}

export class AuthenticatorError extends CustomError {}
export class AuthenticatorNotAcceptedError extends AuthenticatorError {}
export class AuthenticatorCanceledError extends AuthenticatorError {}

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
interface AuthenticatorRsp {
  wDek: string;
  username: string;
  isAccepted: boolean;
}

const authenticatorUrlPath = "/a/"; // The base path which determines if authenticator is requested
const randomIdLength = 12; // The length of random user id and names
const tryLoginTimeout = 3 * minutes; // Wait for authenticator to allow/deny login
const tryLoginPreWait = 4 * seconds; // Time before starting to poll server for result

@singleton(IAuthenticatorKey)
export class Authenticator implements IAuthenticator {
  private activated = false;

  constructor(
    private authenticate = di(IAuthenticateKey),
    private api = di(IApiKey),
    private dataCrypt = di(IDataCryptKey),
    private keyVault = di(IKeyVaultKey)
  ) {
    if (isAuthenticatorApp()) {
      // Since authenticate stores some local values, which needs to be separated from main app
      this.authenticate.setIsAuthenticator();
    }
  }

  public getAuthenticateOperation(): AuthenticateOperation {
    const authenticateReq: AuthenticateReq = {
      n: this.getClientId(),
      d: this.getDeviceDescription(),
      k: this.dataCrypt.generateRandomString(randomIdLength),
      c: this.dataCrypt.generateRandomString(randomIdLength),
    };

    return { request: authenticateReq, isStarted: false, isCanceled: false };
  }

  public getAuthenticateUrl(operation: AuthenticateOperation): string {
    const request = operation.request;
    const code = this.stringifyAuthenticatorReq(request);

    return `${this.getAuthenticatorUrl()}${code}`;
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
      return new AuthenticatorNotAcceptedError();
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
    if (!this.getAuthenticateCode()) {
      this.showClosePageAlert();
      return;
    }

    const device = this.parseAuthenticatorReq();
    if (isError(device)) {
      this.showInvalidRequestAlert();
      return;
    }

    const description = device.d;

    const checkRsp = await this.authenticate.check();
    if (isError(checkRsp)) {
      if (!isError(checkRsp, AuthenticateError)) {
        this.showErrorAlert(checkRsp);
        return;
      }

      const loginRsp = await this.authenticate.login();
      if (isError(loginRsp)) {
        if (isError(loginRsp, WebAuthnNeedReloadError)) {
          this.showReloadPageAlert();
          return;
        }

        if (isError(loginRsp, WebAuthnCanceledError)) {
          this.showCanceledAlert(description);
          return;
        }

        this.showErrorAlert(loginRsp);
        return;
      }
    }

    console.log("Authenticator logged in");

    const rsp = await this.postAuthenticateOKResponse(device);
    if (isError(rsp)) {
      this.showFailedToCommunicateAlert(description);
      return;
    }

    // A message was posted to the device that it is now authenticated and allowed to sync
    this.showDeviceAuthenticatedAlert(description);
  }

  private async postAuthenticateOKResponse(
    authRequest: AuthenticateReq
  ): Promise<Result<void>> {
    const userInfo = this.authenticate.readUserInfo();
    if (isError(userInfo)) {
      this.showErrorAlert(userInfo);
      return userInfo;
    }

    const user: User = { username: authRequest.n, password: authRequest.k };

    // Get the data encryption key and wrap/encrypt it for the device user (as string)
    const wDek = await this.keyVault.getWrappedDataEncryptionKey(user);

    // Post a response to the device with the account user name and wDek
    const isAccepted = true;
    const rsp: AuthenticatorRsp = {
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
    authenticateRsp: AuthenticatorRsp,
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
  ): Promise<Result<AuthenticatorRsp>> {
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
        return new AuthenticatorCanceledError();
      }
      await delay(100);
    }

    while (startTime.time() < tryLoginTimeout) {
      const authData = await this.api.loginDevice(req);
      if (operation.isCanceled) {
        return new AuthenticatorCanceledError();
      }
      if (isError(authData)) {
        return authData;
      }

      if (!authData) {
        // No auth data yet, lets wait a little before retrying again
        for (let t = now(); t.time() < 1 * seconds; ) {
          if (operation.isCanceled) {
            return new AuthenticatorCanceledError();
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

  private getDeviceDescription(): string {
    const ua = uaParser();

    const model = !!ua.device.model ? ua.device.model : ua.os.name;
    return `${ua.browser.name} on ${model}`;
  }

  private getClientId() {
    let clientId: string;
    const userInfo = this.authenticate.readUserInfo();
    if (isError(userInfo) || !userInfo.clientId) {
      clientId = this.dataCrypt.generateRandomString(randomIdLength);
    } else {
      clientId = userInfo.clientId;
    }
    return clientId;
  }

  private stringifyAuthenticatorReq(request: AuthenticateReq) {
    const requestJson = JSON.stringify(request);
    const code = stringToBase64(requestJson);
    return code;
  }

  private parseAuthenticatorReq(): Result<AuthenticateReq> {
    const authenticateCode = this.getAuthenticateCode();

    const infoJs = base64ToString(authenticateCode);
    return jsonParse<AuthenticateReq>(infoJs);
  }

  private getAuthenticatorUrl(): string {
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    return `${baseUrl}${authenticatorUrlPath}`;
  }

  private getAuthenticateCode(): string {
    return window.location.pathname.substring(authenticatorUrlPath.length);
  }

  private showInvalidRequestAlert() {
    showAlert("Error", `Invalid device authentication request`, {
      icon: ErrorAlert,
      onOk: () => this.resetUrl(),
    });
  }

  private showDeviceAuthenticatedAlert(description: string) {
    showAlert(
      "Device Authenticated",
      `'${description}' is now authenticated
       and allowed to sync with all your devices.`,
      { icon: SuccessAlert, onOk: () => this.resetUrl() }
    );
  }

  private showFailedToCommunicateAlert(description: string) {
    showAlert(
      "Error",
      `Failed to communicate with device '${description}' requesting authorization.`,
      { icon: ErrorAlert, onOk: () => this.resetUrl() }
    );
  }

  private showCanceledAlert(description: string) {
    showAlert(
      "Canceled",
      `Authentication was canceled. 
      Device '${description}' was not authenticated and allowed to sync. `,
      { icon: ErrorAlert, onOk: () => this.resetUrl() }
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
    showAlert("Close Page", `You can now close this page.`, {
      showOk: false,
      showCancel: false,
    });
  }

  private showErrorAlert(error: Error) {
    const errorMsg = this.toErrorMessage(error);
    showAlert("Error", `${errorMsg}`, {
      icon: ErrorAlert,
      onOk: () => this.resetUrl(),
    });
  }

  private resetUrl(): void {
    window.location.replace(this.getAuthenticatorUrl());
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
