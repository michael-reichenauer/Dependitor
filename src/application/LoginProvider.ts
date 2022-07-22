import Result, { isError } from "../common/Result";
import { IOnlineKey } from "./Online";
import { di } from "../common/di";
import { IAuthenticateKey } from "../common/authenticate";
import {
  AuthenticateOperation,
  IAuthenticatorClientKey,
} from "../authenticator/AuthenticatorClient";

export interface ILoginProvider {
  login(): Promise<Result<void>>;
  cancelLogin(): void;
  cancelLoginViaAuthenticator(): void;
  getAuthenticateUrl(): string;
  tryLoginViaAuthenticator(): Promise<Result<void>>;
  hasLocalLogin(): boolean;
  supportLocalLogin(): Promise<boolean>;
}

export class LoginProvider implements ILoginProvider {
  private operation: AuthenticateOperation;

  constructor(
    private online = di(IOnlineKey),
    private authenticatorClient = di(IAuthenticatorClientKey),
    private authenticate = di(IAuthenticateKey)
  ) {
    this.operation = authenticatorClient.getAuthenticateOperation();
  }
  public async supportLocalLogin(): Promise<boolean> {
    return await this.authenticate.supportLocalLogin();
  }

  public hasLocalLogin(): boolean {
    return this.authenticate.isLocalLogin();
  }

  public getAuthenticateUrl(): string {
    return this.authenticatorClient.getAuthenticateUrl(this.operation);
  }

  public async tryLoginViaAuthenticator(): Promise<Result<void>> {
    try {
      const rsp = await this.authenticatorClient.tryLoginViaAuthenticator(
        this.operation
      );
      if (isError(rsp)) {
        return rsp;
      }

      return this.online.enableSync();
    } catch (error) {
      console.log("error", error);
      return error as Error;
    }
  }

  public async login(): Promise<Result<void>> {
    return await this.online.login();
  }

  public cancelLoginViaAuthenticator(): void {
    this.operation.isCanceled = true;
  }

  public cancelLogin(): void {
    this.online.cancelLogin();
  }
}
