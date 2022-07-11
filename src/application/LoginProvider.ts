import Result from "../common/Result";
import { ILoginProvider } from "./LoginDlg";
import { IOnline, IOnlineKey } from "./Online";
import {
  AuthenticateOperation,
  IAuthenticator,
  IAuthenticatorKey,
} from "../authenticator/Authenticator";
import { di } from "../common/di";

export class LoginProvider implements ILoginProvider {
  private operation: AuthenticateOperation;

  constructor(
    private online: IOnline = di(IOnlineKey),
    private authenticator: IAuthenticator = di(IAuthenticatorKey)
  ) {
    this.operation = authenticator.getAuthenticateRequest();
  }

  public getAuthenticateUrl(): string {
    return this.authenticator.getAuthenticateUrl(this.operation);
  }

  public async tryLoginViaAuthenticator(): Promise<Result<void>> {
    return await this.authenticator.tryLoginViaAuthenticator(this.operation);
  }

  public async login(): Promise<Result<void>> {
    return await this.online.login();
  }
  public async enableSync(): Promise<Result<void>> {
    return await this.online.enableSync();
  }

  public cancelLogin(): void {
    this.online.cancelLogin();
  }
}
