import {
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import {
  AuthenticationCredentialJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationCredentialJSON,
} from "@simplewebauthn/typescript-types";
import { CustomError } from "./CustomError";
import { diKey, singleton } from "./di";
import Result from "./Result";

export class WebAuthnError extends CustomError {}
export class WebAuthnCanceledError extends WebAuthnError {}
export class WebAuthnNeedReloadError extends WebAuthnError {}

// IWebAuthn supports a wrapper to the WebAuthn api and uses SimpleWebAuthn wrapper lib for
// easier access
// Common: https://github.com/MasterKale/SimpleWebAuthn
// Client:  https://github.com/MasterKale/SimpleWebAuthn/tree/master/packages/browser
// Server: https://github.com/MasterKale/SimpleWebAuthn/tree/master/packages/server
export const IWebAuthnKey = diKey<IWebAuthn>();
export interface IWebAuthn {
  platformAuthenticatorIsAvailable(): Promise<boolean>;
  startRegistration(
    options: PublicKeyCredentialCreationOptionsJSON
  ): Promise<Result<RegistrationCredentialJSON>>;
  startAuthentication(
    options: PublicKeyCredentialRequestOptionsJSON
  ): Promise<Result<AuthenticationCredentialJSON>>;
}

// On IOS, WebAuthn calls are only allowed on a 'fresh' web site. So a page might need to be
// reloaded before WebAuthn call. But the error returned is same as if the user canceled manually.
// A workaround is to measure the time and if it is to fast for a human to cancel, then
// it is assumed that a reload was needed.
const needReloadErrorTimeout = 500; // ms

@singleton(IWebAuthnKey)
export class WebAuthn implements IWebAuthn {
  public async platformAuthenticatorIsAvailable(): Promise<boolean> {
    return await platformAuthenticatorIsAvailable();
  }

  public async startRegistration(
    options: PublicKeyCredentialCreationOptionsJSON
  ): Promise<Result<RegistrationCredentialJSON>> {
    const startTime = performance.now();
    try {
      // Pass the options to the browsers built-in WebAuthn api
      return await startRegistration(options);
    } catch (err) {
      return this.toError(err, startTime);
    }
  }

  public async startAuthentication(
    options: PublicKeyCredentialRequestOptionsJSON
  ): Promise<Result<AuthenticationCredentialJSON>> {
    const startTime = performance.now();
    try {
      // Pass the options to the authenticator and wait for a response
      return await startAuthentication(options);
    } catch (err) {
      return this.toError(err, startTime);
    }
  }

  private toError(err: any, startTime: number): Error {
    const error = err as Error;
    const duration = performance.now() - startTime;
    const msg = `WebAuthn Error: ${error.name}: ${error.message} (${duration})`;

    if (this.isReloadError(error, duration)) {
      console.log("Reload is needed:", msg);
      return new WebAuthnNeedReloadError("WebAuthnNeedReloadError:", error);
    }
    if (error.name === "NotAllowedError") {
      console.log("Authentication canceled:", msg);
      return new WebAuthnCanceledError("WebAuthnCanceledError:", error);
    }

    console.warn(msg);
    return error;
  }

  private isReloadError(error: Error, duration: number): boolean {
    return (
      error.name === "NotAllowedError" && duration < needReloadErrorTimeout
    );
  }
}
