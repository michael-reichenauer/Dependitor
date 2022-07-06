import { di, diKey, singleton } from "../common/di";
//import { IAuthenticate, IAuthenticateKey } from "../common/authenticate";
import {
  NoContactError,
  LocalApiServerError,
  LocalEmulatorError,
} from "../common/Api";
import Result, { isError } from "../common/Result";
import { AuthenticateError } from "../common/Api";
import { IAuthenticate, IAuthenticateKey } from "../common/authenticate";
import { showOKAlert } from "../common/AlertDialog";
import {
  WebAuthnCanceledError,
  WebAuthnNeedReloadError,
} from "../common/webauthn";
import { setErrorMessage, setInfoMessage } from "../common/MessageSnackbar";
//import { IStore, IStoreKey } from "./diagram/Store";

//import { ILocalStore, ILocalStoreKey } from "./../common/LocalStore";

// Online is uses to control if device database sync should and can be enable or not
export const IAuthenticatorKey = diKey<IAuthenticator>();
export interface IAuthenticator {
  isAuthenticatorApp(): boolean;
  activate(): void;
}

@singleton(IAuthenticatorKey)
export class Authenticator implements IAuthenticator {
  private activated = false;

  constructor(private authenticate: IAuthenticate = di(IAuthenticateKey)) {}

  public isAuthenticatorApp(): boolean {
    return window.location.search.startsWith("?lg=");
  }

  getLoginRequest(): string | null {
    if (!window.location.search.startsWith("?lg=")) {
      return null;
    }
    return window.location.search.substring(4);
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
    console.log("login");

    const checkRsp = await this.authenticate.check();

    if (checkRsp instanceof NoContactError) {
      // No contact with server, cannot enable sync
      setErrorMessage(this.toErrorMessage(checkRsp));
      return checkRsp;
    }

    if (checkRsp instanceof AuthenticateError) {
      // Authentication is needed, showing the login dialog
      return await this.login();
    }

    if (!(checkRsp instanceof AuthenticateError) && isError(checkRsp)) {
      // Som other unexpected error (neither contact nor authenticate error)
      setErrorMessage(this.toErrorMessage(checkRsp));
      return checkRsp;
    }

    await this.login();

    console.log("Logged in");
  }

  private async login(): Promise<Result<void>> {
    console.log("login");

    const loginRsp = await this.authenticate.login();
    if (loginRsp instanceof WebAuthnNeedReloadError) {
      showOKAlert(
        "Reload Page",
        "Please manually reload this page to show the authentication dialog.\n" +
          "Unfortunately, this browser requires a recently manually loaded page before allowing access to authentication."
      );
      return;
    }
    if (loginRsp instanceof WebAuthnCanceledError) {
      setInfoMessage("Canceled");

      // this.cancelLogin();
      return;
    }
    if (isError(loginRsp)) {
      console.error("Failed to login:", loginRsp);
      setErrorMessage(this.toErrorMessage(loginRsp));
      return loginRsp;
    }

    //   // Login successful, enable device sync
    //   return await this.enableSync();
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
      return "Invalid credentials. Please try again with different credentials or create a new account";
    }
    if (isError(error, NoContactError)) {
      return "No network contact with server. Please retry again in a while.";
    }

    return "Internal server error";
  }
}
