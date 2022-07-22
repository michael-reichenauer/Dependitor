import { di, diKey, singleton } from "../common/di";
import { IApiKey, LoginDeviceSetReq, User } from "../common/Api";
import Result, { isError } from "../common/Result";
import { AuthenticateError } from "../common/Api";
import { IAuthenticateKey } from "../common/authenticate";
import { IKeyVaultKey } from "../common/keyVault";
import { IDataCryptKey } from "../common/DataCrypt";
import {
  AuthenticateReq,
  AuthenticatorRsp,
  IAuthenticatorProtocolKey,
  isAuthenticatorApp,
} from "./AuthenticatorProtocol";
import { CustomError } from "../common/CustomError";

// Online is uses to control if device database sync should and can be enable or not
export const IAuthenticatorKey = diKey<IAuthenticator>();
export interface IAuthenticator {
  handleAuthenticateRequest(): Promise<Result<string>>;
}

export class AuthenticatorError extends CustomError {}
export class NoRequestError extends AuthenticatorError {}
export class InvalidRequestError extends AuthenticatorError {}
export class FailedToRespondError extends AuthenticatorError {}

@singleton(IAuthenticatorKey)
export class Authenticator implements IAuthenticator {
  private isHandled = false;

  constructor(
    private authenticate = di(IAuthenticateKey),
    private api = di(IApiKey),
    private dataCrypt = di(IDataCryptKey),
    private keyVault = di(IKeyVaultKey),
    private protocol = di(IAuthenticatorProtocolKey)
  ) {
    if (isAuthenticatorApp()) {
      // Since authenticate stores some local values, which needs to be separated from main app
      this.authenticate.setIsAuthenticator();
    }
  }

  public async handleAuthenticateRequest(): Promise<Result<string>> {
    if (this.isHandled) {
      return "";
    }
    this.isHandled = true;

    if (!this.protocol.hasAuthenticateCode()) {
      return new NoRequestError();
    }

    const device = this.protocol.parseAuthenticateReq();
    if (isError(device)) {
      return new InvalidRequestError();
    }

    // login if needed
    const login = await this.login();
    if (isError(login)) {
      return login;
    }
    console.log("Authenticator logged in");

    const rsp = await this.postAuthenticateOKResponse(device);
    if (isError(rsp)) {
      return new FailedToRespondError();
    }

    // A message was posted to the device that it is now authenticated and allowed to sync
    const description = device.d;
    console.log("Device allowed to authenticate in", description);
    return description;
  }

  private async login(): Promise<Result<void>> {
    const checkRsp = await this.authenticate.check();
    if (isError(checkRsp)) {
      if (!isError(checkRsp, AuthenticateError)) {
        return checkRsp;
      }

      const loginRsp = await this.authenticate.login();
      if (isError(loginRsp)) {
        return loginRsp;
      }
    }
  }

  private async postAuthenticateOKResponse(
    authRequest: AuthenticateReq
  ): Promise<Result<void>> {
    const userInfo = this.authenticate.readUserInfo();
    if (isError(userInfo)) {
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
    // Serialize the response
    const rspJson = JSON.stringify(authenticateRsp);

    // Encrypt the response
    const authDataDek = await this.dataCrypt.deriveDataEncryptionKey(user);
    const authData = await this.dataCrypt.encryptText(rspJson, authDataDek);

    // Post the response
    const loginDeviceSetReq: LoginDeviceSetReq = {
      channelId: channelId,
      isAccept: isAccept,
      authData: authData,
    };

    return await this.api.loginDeviceSet(loginDeviceSetReq);
  }
}
