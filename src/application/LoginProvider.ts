import Result, { isError } from "../common/Result";
import { ILoginProvider } from "./LoginDlg";
import { IOnlineKey } from "./Online";
import {
  AuthenticateOperation,
  IAuthenticatorKey,
} from "../authenticator/Authenticator";
import { di } from "../common/di";
import { IAuthenticateKey } from "../common/authenticate";

export class LoginProvider implements ILoginProvider {
  private operation: AuthenticateOperation;

  constructor(
    private online = di(IOnlineKey),
    private authenticator = di(IAuthenticatorKey),
    private authenticate = di(IAuthenticateKey)
  ) {
    this.operation = authenticator.getAuthenticateRequest();
  }
  public async supportLocalLogin(): Promise<boolean> {
    return await this.authenticate.supportLocalLogin();
  }

  public hasLocalLogin(): boolean {
    return this.authenticate.isLocalLogin();
  }

  public getAuthenticateUrl(): string {
    return this.authenticator.getAuthenticateUrl(this.operation);
  }

  public async tryLoginViaAuthenticator(): Promise<Result<void>> {
    try {
      const rsp = await this.authenticator.tryLoginViaAuthenticator(
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

  public loginViaAuthenticator(): void {
    this.operation.isCanceled = true;
  }

  public cancelLogin(): void {
    this.online.cancelLogin();
  }
}
