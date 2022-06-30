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
import { diKey, singleton } from "./di";
import Result from "./Result";

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

@singleton(IWebAuthnKey)
export class WebAuthn implements IWebAuthn {
  public async platformAuthenticatorIsAvailable(): Promise<boolean> {
    return await platformAuthenticatorIsAvailable();
  }

  public async startRegistration(
    options: PublicKeyCredentialCreationOptionsJSON
  ): Promise<Result<RegistrationCredentialJSON>> {
    try {
      // Pass the options to the browsers built-in WebAuthn api
      return await startRegistration(options);
    } catch (error) {
      // if (error.name === 'InvalidStateError') {
      //   'Error: Authenticator was probably already registered by user';
      // }
      return error as Error;
    }
  }

  public async startAuthentication(
    options: PublicKeyCredentialRequestOptionsJSON
  ): Promise<Result<AuthenticationCredentialJSON>> {
    try {
      // Pass the options to the authenticator and wait for a response
      return await startAuthentication(options);
    } catch (error) {
      return error as Error;
    }
  }
}
