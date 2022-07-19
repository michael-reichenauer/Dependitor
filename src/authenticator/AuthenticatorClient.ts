import {
  AuthenticateError,
  IApiKey,
  LoginDeviceReq,
  User,
} from "../common/Api";
import { IAuthenticateKey } from "../common/authenticate";
import { CustomError } from "../common/CustomError";
import { IDataCryptKey } from "../common/DataCrypt";
import { di, diKey, singleton } from "../common/di";
import Result, { isError } from "../common/Result";

import now from "../common/stopwatch";
import { delay, minutes, seconds } from "../common/utils";
import {
  AuthenticateReq,
  AuthenticatorRsp,
  IAuthenticatorProtocolKey,
} from "./AuthenticatorProtocol";
const uaParser = require("ua-parser-js");

// IAuthenticatorClient is the client  the Dependitor app uses when authenticating
export const IAuthenticatorClientKey = diKey<IAuthenticatorClient>();
export interface IAuthenticatorClient {
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

const randomIdLength = 12; // The length of random user id and names
const tryLoginTimeout = 3 * minutes; // Wait for authenticator to allow/deny login
const tryLoginPreWait = 4 * seconds; // Time before starting to poll server for result

@singleton(IAuthenticatorClientKey)
export class AuthenticatorClient implements IAuthenticatorClient {
  constructor(
    private protocol = di(IAuthenticatorProtocolKey),
    private authenticate = di(IAuthenticateKey),
    private api = di(IApiKey),
    private dataCrypt = di(IDataCryptKey)
  ) {}

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
    return this.protocol.getAuthenticateUrl(request);
  }

  public async tryLoginViaAuthenticator(
    operation: AuthenticateOperation
  ): Promise<Result<void>> {
    if (operation.isStarted) {
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

    console.log("Device logged in");
    this.authenticate.setLoggedIn(authenticateRsp.username, clientId, dek);
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

    // Poll authentication response from the server, it might take several attempts
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
}
