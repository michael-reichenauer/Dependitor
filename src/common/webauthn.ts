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
const needReloadErrorTimeout = 5000; // ms

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
      const duration = performance.now() - startTime;
      const error = err as Error;
      const msg = `WebAuthn Error: ${error.name}: ${error.message} (${duration})`;
      console.warn(msg);
      // alert(msg);
      if (this.isReloadError(error, duration)) {
        return new WebAuthnNeedReloadError(error);
      }
      if (error.name === "NotAllowedError") {
        return new WebAuthnCanceledError(error);
      }
      // if (error.name === 'InvalidStateError') {
      //   'Error: Authenticator was probably already registered by user';
      // }
      return error as Error;
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
      const duration = performance.now() - startTime;
      const error = err as Error;
      const msg = `WebAuthn Error: ${error.name}: ${error.message} (${duration})`;
      console.warn(msg);
      // alert(msg);
      if (this.isReloadError(error, duration)) {
        return new WebAuthnNeedReloadError(error);
      }
      if (error.name === "NotAllowedError") {
        return new WebAuthnCanceledError(error);
      }
      return error as Error;
    }
  }

  private isReloadError(error: Error, duration: number): boolean {
    return (
      error.name === "NotAllowedError" && duration < needReloadErrorTimeout
    );
  }
}
