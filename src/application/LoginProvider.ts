import Result, { isError } from "../common/Result";
import { IOnlineKey } from "./Online";
import { di } from "../common/di";
import { IAuthenticateKey } from "../common/authenticate";
import {
  AuthenticateOperation,
  IAuthenticatorClientKey,
} from "../authenticator/AuthenticatorClient";

export interface ILoginProvider {
  loginLocalDevice(): Promise<Result<void>>;
  cancelLoginLocalDevice(): void;
  cancelLoginViaAuthenticator(): void;
  getAuthenticatorUrl(): string;
  tryLoginViaAuthenticator(): Promise<Result<void>>;
  hasEnabledLocalLoginDevice(): boolean;
  isLocalLoginSupported(): Promise<boolean>;
}

export class LoginProvider implements ILoginProvider {
  private operation: AuthenticateOperation;

  constructor(
    private online = di(IOnlineKey),
    private authenticatorClient = di(IAuthenticatorClientKey),
    private authenticate = di(IAuthenticateKey)
  ) {
    console.log("creating loginprovider");
    this.operation = authenticatorClient.getAuthenticateOperation();
  }
  public async isLocalLoginSupported(): Promise<boolean> {
    return await this.authenticate.supportLocalLogin();
  }

  public hasEnabledLocalLoginDevice(): boolean {
    return this.authenticate.isLocalLoginEnabled();
  }

  public getAuthenticatorUrl(): string {
    return this.authenticatorClient.getAuthenticateUrl(this.operation);
  }

  public async tryLoginViaAuthenticator(): Promise<Result<void>> {
    console.log("operation ", this.operation);
    try {
      const rsp = await this.authenticatorClient.tryLoginViaAuthenticator(
        this.operation
      );
      if (isError(rsp)) {
        return rsp;
      }

      return this.online.enableDeviceSync();
    } catch (error) {
      console.log("error", error);
      return error as Error;
    }
  }

  public async loginLocalDevice(): Promise<Result<void>> {
    return await this.online.loginOnLocalDevice();
  }

  public cancelLoginViaAuthenticator(): void {
    this.operation.ac.abort();
  }

  public cancelLoginLocalDevice(): void {
    this.online.cancelLoginOnLocalDevice();
  }
}
