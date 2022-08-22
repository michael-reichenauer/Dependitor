import { AuthenticateError, IApi, IApiKey } from "./Api";
import { User } from "./Api";
import { di, diKey, singleton } from "./di";
import { IKeyVaultConfigureKey, IKeyVaultKey } from "./keyVault";
import Result, { expectValue, isError, orDefault } from "./Result";
import { IDataCryptKey } from "./DataCrypt";
import { IWebAuthnKey } from "./webauthn";
import { ILocalStoreKey } from "./LocalStore";
import timing from "./timing";
import { logName } from "./log";
import {
  AuthenticatorTransportFuture,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/typescript-types";
import { ICryptKey } from "./crypt";
import { bufferToBase64 } from "../utils/text";
import { NotFoundError } from "./CustomError";

// IAuthenticate provides crate account and login functionality.
export const IAuthenticateKey = diKey<IAuthenticate>();
export interface IAuthenticate {
  check(): Promise<Result<void>>;
  login(): Promise<Result<void>>;
  isLocalLoginEnabled(): boolean;
  disableLocalLogin(): void;
  setLoggedIn(username: string, clientId: string, dek: CryptoKey): void;
  resetLogin(): void;
  readUserInfo(): Result<UserInfo>;
  supportLocalLogin(): Promise<boolean>;
  specialLogin(): Promise<Result<void>>;
}

const userInfoKey = "authenticate.userInfo";
const userDisplayNameDefault = "Dependitor";

const randomUsernameLength = 12;
const randomKekPasswordLength = 12;

export interface UserInfo {
  username: string;
  clientId: string;
  credentialId: string;
  transports?: string[];
  wDek: string;
}

const defaultUserInfo: UserInfo = {
  username: "",
  clientId: "",
  credentialId: "",
  wDek: "",
};

interface RegisterRsp {
  credentialId: string;
  transports?: string[];
  user: User;
}

@singleton(IAuthenticateKey)
export class Authenticate implements IAuthenticate {
  private deviceUsername = userDisplayNameDefault;

  constructor(
    private api: IApi = di(IApiKey),
    private webAuthn = di(IWebAuthnKey),
    private keyVault = di(IKeyVaultKey),
    private keyVaultConfigure = di(IKeyVaultConfigureKey),
    private dataCrypt = di(IDataCryptKey),
    private localStore = di(ILocalStoreKey),
    private crypt = di(ICryptKey)
  ) {}

  public async specialLogin(): Promise<Result<void>> {
    logName();

    const userInfo = this.readUserInfo();
    if (isError(userInfo)) {
      console.error("failed to read user info");
      return userInfo;
    }

    let { username, credentialId, transports, wDek } = userInfo;
    const password = await this.localOnlyAuthenticate(credentialId, transports);
    if (isError(password)) {
      return password;
    }

    const user = { username, password };

    // Unwrap the dek so it can be used
    const dek = await this.dataCrypt.unwrapDataEncryptionKey(wDek, user);
    if (isError(dek)) {
      console.error("failed to unwrap the wDek");
      return new AuthenticateError("AuthenticateError:", dek);
    }
    console.log("dek ok");

    // // Make the DEK available to be used when encrypting/decrypting data when data
    // this.keyVaultConfigure.setDataEncryptionKey(dek);
  }

  public async supportLocalLogin(): Promise<boolean> {
    return await this.webAuthn.platformAuthenticatorIsAvailable();
  }

  public async check(): Promise<Result<void>> {
    if (!this.keyVaultConfigure.hasDataEncryptionKey()) {
      return new AuthenticateError("AuthenticateError:");
    }

    return await this.api.check();
  }

  public isLocalLoginEnabled(): boolean {
    const userInfo = this.readUserInfo();
    if (isError(userInfo)) {
      return false;
    }

    return !!userInfo.wDek && !!userInfo.credentialId;
  }

  public disableLocalLogin(): void {
    const userInfo = this.readUserInfo();
    if (isError(userInfo)) {
      return;
    }

    this.writeUserInfo({ ...userInfo, credentialId: "", wDek: "" });
  }

  public setLoggedIn(username: string, clientId: string, dek: CryptoKey): void {
    this.keyVaultConfigure.setDataEncryptionKey(dek);

    const userInfo = orDefault(this.readUserInfo(), defaultUserInfo);
    if (username === userInfo.username) {
      // Same username, no need to update.
      return;
    }

    this.writeUserInfo({
      username: username,
      clientId: clientId,
      credentialId: "",
      wDek: "",
    });
  }

  public async login(): Promise<Result<void>> {
    console.log("Login");
    if (!(await this.webAuthn.platformAuthenticatorIsAvailable())) {
      return new Error("Error: Biometrics not available");
    }

    const userInfo = orDefault(this.readUserInfo(), defaultUserInfo);
    if (!userInfo.wDek) {
      // No stored user info wDek, i.e. first time for local device login, lets create a new device user and login
      return await this.loginNewUser(userInfo);
    }

    // This device has a registered used, lets login that user
    return await this.loginExistingUser(userInfo);
  }

  public resetLogin(): void {
    this.keyVaultConfigure.clearDataEncryptionKey();

    // Try to logoff from server ass well (but don't await result)
    this.api.logoff();
  }

  public readUserInfo(): Result<UserInfo> {
    return this.localStore.read<UserInfo>(userInfoKey);
  }

  private writeUserInfo(userInfo: UserInfo): void {
    this.localStore.write(userInfoKey, userInfo);
  }

  // Creates a new user, which is registered in the device Authenticator and in the server
  private async loginNewUser(userInfo: UserInfo): Promise<Result<void>> {
    // Register this user in the system authenticator using WebAuthn api and let the
    // api server verify that registration
    const registerRsp = await this.registerDevice(userInfo);
    if (isError(registerRsp)) {
      return registerRsp;
    }

    const { credentialId, user, transports } = registerRsp;

    let wDek: string;
    if (this.keyVault.hasDataEncryptionKey()) {
      wDek = await this.keyVault.getWrappedDataEncryptionKey(user);
    } else {
      // Generate a new data encryption key DEK and wrap/encrypt
      // into a wDek protected by the username and password
      wDek = await this.dataCrypt.generateWrappedDataEncryptionKey(user);
    }

    // Unwrap the wrapped DEK so it can be used and make it available
    // to be used when encrypting/decrypting data when accessing server
    const dek = expectValue(
      await this.dataCrypt.unwrapDataEncryptionKey(wDek, user)
    );
    this.keyVaultConfigure.setDataEncryptionKey(dek);

    // Store the user name and wrapped DEK for the next authentication
    const clientId = !userInfo.clientId
      ? this.dataCrypt.generateRandomString(randomUsernameLength)
      : userInfo.clientId;

    const info: UserInfo = {
      username: user.username,
      clientId: clientId,
      credentialId: credentialId,
      transports: transports,
      wDek: wDek,
    };
    this.writeUserInfo(info);
  }

  // Authenticates the existing server in the device Authenticator
  private async loginExistingUser(userInfo: UserInfo): Promise<Result<void>> {
    // Authenticate the existing registered username
    const { username, credentialId, wDek } = userInfo;
    const password = await this.authenticate(username, credentialId);
    if (isError(password, AuthenticateError)) {
      // Failed to authenticate, need to re-register device, lets clear
      this.writeUserInfo({
        username: "",
        clientId: "",
        credentialId: "",
        wDek: "",
      });
      return password;
    }
    if (isError(password)) {
      return password;
    }

    const user = { username, password };

    // Unwrap the dek so it can be used
    const dek = await this.dataCrypt.unwrapDataEncryptionKey(wDek, user);
    if (isError(dek)) {
      // The wDek could not be unwrapped, lets clear the wDek and it might work next time
      this.writeUserInfo({
        username: username,
        clientId: userInfo.clientId,
        credentialId: "",
        wDek: "",
      });
      return new AuthenticateError("AuthenticateError:", dek);
    }

    // Make the DEK available to be used when encrypting/decrypting data when accessing server
    this.keyVaultConfigure.setDataEncryptionKey(dek);
  }

  private async registerDevice(
    userInfo: UserInfo
  ): Promise<Result<RegisterRsp>> {
    console.log("RegisterDevice");
    // Generating a new user with random password
    const proposedUsername = !userInfo.username ? "" : userInfo.username;

    // Getting the registration options, including the random unique challenge, from the server,
    // Which will then later be verified by the server in the verifyWebAuthnRegistration() call.
    const registrationRsp = await this.api.getWebAuthnRegistrationOptions(
      proposedUsername
    );
    if (isError(registrationRsp)) {
      return registrationRsp;
    }

    const username = registrationRsp.username;
    const password = this.dataCrypt.generateRandomString(
      randomKekPasswordLength
    );
    const user: User = { username, password };
    const options = registrationRsp.options;

    // Prefix the user id with the KEK password.
    // This password-userId is then returned when authenticating as the response.userHandle
    options.user.id = password + options.user.id;

    // Using the standard user name, since the actual user name is random unique string
    options.user.displayName = this.deviceUsername;
    options.user.name = this.deviceUsername;

    // Register this user/device in the device authenticator. The challenge will be signed
    const t = timing();
    const registration = await this.webAuthn.startRegistration(options);
    console.log(`WebAuthn registration: ${!isError(registration)}, ${t()}`);
    if (isError(registration)) {
      return registration;
    }

    // Let the server verify the registration by validating the challenge is signed with the
    // authenticator hidden private key, which corresponds with the public key
    const verified = await this.api.verifyWebAuthnRegistration(
      username,
      registration
    );
    if (isError(verified)) {
      return verified;
    }
    if (!verified) {
      return new Error(`Failed to verify registration`);
    }

    console.log("Verified registration");
    return {
      credentialId: registration.id,
      transports: registration.transports,
      user: user,
    };
  }

  private async authenticate(
    username: string,
    credentialId: string
  ): Promise<Result<string>> {
    // GET authentication options from the endpoint that calls
    const options = await this.api.getWebAuthnAuthenticationOptions(username);
    if (isError(options)) {
      return options;
    }

    // Since both Dependitor and Authenticator can be logged in to same authenticator, lets filter
    options.allowCredentials = options.allowCredentials?.filter(
      (cred) => cred.id === credentialId
    );

    // Pass the options to the authenticator and wait for a response
    const t = timing();
    const authentication = await this.webAuthn.startAuthentication(options);
    console.log(`WebAuthn authentication: ${!isError(authentication)}, ${t()}`);
    if (isError(authentication)) {
      return authentication;
    }

    // Extract the password, which prefixed to the user id in the userHandle (at registration)
    const password = this.extractPassword(authentication.response.userHandle);
    if (isError(password)) {
      return password;
    }

    // Clear the user handle, since the server should not know the password prefix
    // and does not need to know the user id
    authentication.response.userHandle = undefined;

    // POST the response to the endpoint that calls
    const verified = await this.api.verifyWebAuthnAuthentication(
      username,
      authentication
    );
    if (isError(verified)) {
      return verified;
    }
    if (!verified) {
      return new AuthenticateError(
        `AuthenticateError: Failed to verify authentication`
      );
    }

    console.log("Verified authentication");
    return password;
  }

  private async localOnlyAuthenticate(
    credentialId: string,
    transports?: string[]
  ): Promise<Result<string>> {
    logName();

    // The authentication needs a chalange, but we do not really verify that, we want to
    // Retrieve the registered password, wich will be resolved once the OS has verified using
    // biometric or pin-code.
    const challenge = bufferToBase64(this.crypt.randomBytes(32));

    const options: PublicKeyCredentialRequestOptionsJSON = {
      challenge: challenge,
      allowCredentials: [
        {
          id: credentialId,
          type: "public-key",
          transports: transports as AuthenticatorTransportFuture[],
        },
      ],
      timeout: 60000,
      userVerification: "required",
    };

    const t = timing();
    const authentication = await this.webAuthn.startAuthentication(options);
    console.log(`WebAuthn authentication: ${!isError(authentication)}, ${t()}`);
    if (isError(authentication)) {
      return authentication;
    }
    // Extract the password, which prefixed to the user id in the userHandle (at registration)
    const password = this.extractPassword(authentication.response.userHandle);
    if (isError(password)) {
      return password;
    }

    return password;
  }

  private extractPassword(data?: string): Result<string> {
    const password = data?.substring(0, randomKekPasswordLength);

    if (!password || password.length !== randomKekPasswordLength) {
      return new NotFoundError();
    }

    return password;
  }
}
