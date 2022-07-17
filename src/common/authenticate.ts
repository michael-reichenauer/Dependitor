import { AuthenticateError, IApi, IApiKey } from "./Api";
import { User } from "./Api";
import { di, diKey, singleton } from "./di";
import { IKeyVaultConfigureKey, IKeyVaultKey } from "./keyVault";
import Result, { expectValue, isError, orDefault } from "./Result";
import { IDataCryptKey } from "./DataCrypt";
import { IWebAuthnKey } from "./webauthn";
import { ILocalStoreKey } from "./LocalStore";

// IAuthenticate provides crate account and login functionality.
export const IAuthenticateKey = diKey<IAuthenticate>();
export interface IAuthenticate {
  check(): Promise<Result<void>>;
  login(): Promise<Result<void>>;
  isLocalLogin(): boolean;
  setLoggedIn(username: string, clientId: string, dek: CryptoKey): void;
  resetLogin(): void;
  readUserInfo(): Result<UserInfo>;
  setIsAuthenticator(): void;
  supportLocalLogin(): Promise<boolean>;
}

const userInfoKeyDefault = "authenticate.userInfo";
const authenticatorUserInfoKeyDefault = "/a/authenticate.userInfo";

const userDisplayNameDefault = "Dependitor";
const authenticatorUserDisplayNameDefault = "Authenticator";

const randomUsernameLength = 12;
const randomKekPasswordLength = 12;

export interface UserInfo {
  username: string;
  clientId: string;
  credentialId: string;
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
  user: User;
}

@singleton(IAuthenticateKey)
export class Authenticate implements IAuthenticate {
  private userInfoKey = userInfoKeyDefault;
  private deviceUsername = userDisplayNameDefault;

  constructor(
    private api: IApi = di(IApiKey),
    private webAuthn = di(IWebAuthnKey),
    private keyVault = di(IKeyVaultKey),
    private keyVaultConfigure = di(IKeyVaultConfigureKey),
    private dataCrypt = di(IDataCryptKey),
    private localStore = di(ILocalStoreKey)
  ) {}

  public async supportLocalLogin(): Promise<boolean> {
    return await this.webAuthn.platformAuthenticatorIsAvailable();
  }

  public setIsAuthenticator(): void {
    this.userInfoKey = authenticatorUserInfoKeyDefault;
    this.deviceUsername = authenticatorUserDisplayNameDefault;
  }

  public async check(): Promise<Result<void>> {
    if (!this.keyVaultConfigure.hasDataEncryptionKey()) {
      console.log("No DEK");
      return new AuthenticateError();
    }

    return await this.api.check();
  }

  public isLocalLogin(): boolean {
    const userInfo = this.readUserInfo();
    if (isError(userInfo)) {
      return false;
    }

    return !!userInfo.wDek && !!userInfo.credentialId;
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
    return this.localStore.tryRead<UserInfo>(this.userInfoKey);
  }

  private writeUserInfo(userInfo: UserInfo): void {
    console.log("write user info", userInfo);
    this.localStore.write(this.userInfoKey, userInfo);
  }

  // Creates a new user, which is registered in the device Authenticator and in the server
  private async loginNewUser(userInfo: UserInfo): Promise<Result<void>> {
    console.log("loginNewUser");

    // Register this user in the system authenticator using WebAuthn api and let the
    // api server verify that registration
    const registerRsp = await this.registerDevice(userInfo);
    if (isError(registerRsp)) {
      return registerRsp;
    }

    const { credentialId, user } = registerRsp;

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
      wDek: wDek,
    };
    this.writeUserInfo(info);
  }

  // Authenticates the existing server in the device Authenticator
  private async loginExistingUser(userInfo: UserInfo): Promise<Result<void>> {
    console.log("loginExistingUser");

    // Authenticate the existing registered username
    const { username, credentialId, wDek } = userInfo;
    const password = await this.authenticate(username, credentialId);
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
      return dek;
    }

    // Make the DEK available to be used when encrypting/decrypting data when accessing server
    this.keyVaultConfigure.setDataEncryptionKey(dek);
  }

  private async registerDevice(
    userInfo: UserInfo
  ): Promise<Result<RegisterRsp>> {
    console.log("RegisterDevice", userInfo);
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
    const registration = await this.webAuthn.startRegistration(options);
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
    return { credentialId: registration.id, user: user };
  }

  private async authenticate(
    username: string,
    credentialId: string
  ): Promise<Result<string>> {
    // GET authentication options from the endpoint that calls
    console.log("authenticate", username);
    const options = await this.api.getWebAuthnAuthenticationOptions(username);
    if (isError(options)) {
      return options;
    }

    // Since both Dependitor and Authenticator can be logged in to same authenticator, lets filter
    options.allowCredentials = options.allowCredentials?.filter(
      (cred) => cred.id === credentialId
    );

    // Pass the options to the authenticator and wait for a response
    const authentication = await this.webAuthn.startAuthentication(options);
    if (isError(authentication)) {
      return authentication;
    }

    // Extract the password, which prefixed to the user id
    const password =
      authentication.response.userHandle?.substring(
        0,
        randomKekPasswordLength
      ) ?? "";

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
      return new AuthenticateError(`Failed to verify authentication`);
    }

    console.log("Verified authentication");
    return password;
  }
}
