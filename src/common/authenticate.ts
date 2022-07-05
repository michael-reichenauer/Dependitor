import { AuthenticateError, IApi, IApiKey } from "./Api";
import { User } from "./Api";
import { di, diKey, singleton } from "./di";
import { IKeyVaultConfigure, IKeyVaultConfigureKey } from "./keyVault";
import Result, { expectValue, isError } from "./Result";
import { IDataCrypt, IDataCryptKey } from "./DataCrypt";
import { IWebAuthn, IWebAuthnKey } from "./webauthn";
import { ILocalStore, ILocalStoreKey } from "./LocalStore";

// IAuthenticate provides crate account and login functionality.
export const IAuthenticateKey = diKey<IAuthenticate>();
export interface IAuthenticate {
  check(): Promise<Result<void>>;
  //createUser(user: User): Promise<Result<void>>;
  login(): Promise<Result<void>>;
  resetLogin(): void;
}

// const minUserName = 2;
// const minPassword = 4;
const userInfoKey = "userInfo";
const randomUsernameLength = 10;
const randomKekPasswordLength = 10;

interface UserInfo {
  username: string;
  wDek: string;
}

@singleton(IAuthenticateKey)
export class Authenticate implements IAuthenticate {
  constructor(
    private api: IApi = di(IApiKey),
    private webAuthn: IWebAuthn = di(IWebAuthnKey),
    private keyVaultConfigure: IKeyVaultConfigure = di(IKeyVaultConfigureKey),
    private dataCrypt: IDataCrypt = di(IDataCryptKey),
    private localStore: ILocalStore = di(ILocalStoreKey)
  ) {}

  public async check(): Promise<Result<void>> {
    if (!this.keyVaultConfigure.getDek()) {
      console.log("No DEK");
      return new AuthenticateError();
    }

    return await this.api.check();
  }

  // public async createUser(enteredUser: User): Promise<Result<void>> {
  //   const user = await this.hashAndExpandUser(enteredUser);
  //   if (isError(user)) {
  //     return user;
  //   }

  //   // Generate the data encryption key DEK and wrap/encrypt into a wDek
  //   const wrappedDek = await this.dataCrypt.generateWrappedDataEncryptionKey(
  //     user
  //   );

  //   return await this.api.createAccount({ user: user, wDek: wrappedDek });
  // }

  public async login(): Promise<Result<void>> {
    if (!(await this.webAuthn.platformAuthenticatorIsAvailable())) {
      return new Error("Error: Biometrics not available");
    }

    const authInfo = this.localStore.tryRead<UserInfo>(userInfoKey);
    if (isError(authInfo)) {
      // No stored user info, i.e. first time, lets create a new device user and login
      return await this.loginNewUser();
    }

    // This device has a registered used, lets login that user
    return await this.loginExistingUser(authInfo);
  }

  public resetLogin(): void {
    this.keyVaultConfigure.setDek(null);

    // Try to logoff from server ass well (but don't await result)
    this.api.logoff();
  }

  // Creates a new user, which is registered in the device Authenticator and in the server
  private async loginNewUser(): Promise<Result<void>> {
    console.log("loginNewUser");

    // Generating a new user with random username and password
    const user = this.generateNewUser();

    // Register this user in the system authenticator using WebAuthn api and let the
    // api server verify that registration
    const register = await this.registerDevice(user);
    if (isError(register)) {
      return register;
    }

    // New user is registered. Generate a new data encryption key DEK and wrap/encrypt
    // into a wDek protected by the username and password
    const wDek = await this.dataCrypt.generateWrappedDataEncryptionKey(user);

    // Unwrap the wrapped DEK so it can be used and make it available
    // to be used when encrypting/decrypting data when accessing server
    const dek = await expectValue(
      this.dataCrypt.unwrapDataEncryptionKey(wDek, user)
    );
    this.keyVaultConfigure.setDek(dek);

    // Store the user name and wrapped DEK for the next authentication
    const info: UserInfo = { username: user.username, wDek: wDek };
    this.localStore.write(userInfoKey, info);
  }

  // Authenticates the existing server in the device Authenticator
  private async loginExistingUser(userInfo: UserInfo): Promise<Result<void>> {
    console.log("loginExistingUser");

    // Authenticate the existing registered username
    const { username, wDek } = userInfo;
    const password = await this.authenticate(username);
    if (isError(password)) {
      return password;
    }

    const user = { username, password };

    // Unwrap the dek so it can be used
    const dek = await this.dataCrypt.unwrapDataEncryptionKey(wDek, user);
    if (isError(dek)) {
      return dek;
    }

    // Make the DEK available to be used when encrypting/decrypting data when accessing server
    this.keyVaultConfigure.setDek(dek);
  }

  private generateNewUser(): User {
    const username = this.dataCrypt.generateRandomString(randomUsernameLength);
    const password = this.dataCrypt.generateRandomString(
      randomKekPasswordLength
    );

    const user: User = { username, password };
    return user;
  }

  private async registerDevice(user: User): Promise<Result<void>> {
    const { username, password } = user;
    // Getting the registration options, including the random unique challenge, from the server,
    // Which will then later be verified by the server in the verifyWebAuthnRegistration() call.
    const options = await this.api.getWebAuthnRegistrationOptions(username);
    if (isError(options)) {
      return options;
    }
    console.log("got register options");

    // Prefix the user id with the KEK password.
    // This password-userId is then returned when authenticating as the response.userHandle
    options.user.id = password + options.user.id;

    // Using the standard "Dependitor" user name, since the actual user name is random unique string
    options.user.name = "Dependinator";

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
  }

  private async authenticate(username: string): Promise<Result<string>> {
    // GET authentication options from the endpoint that calls
    const options = await this.api.getWebAuthnAuthenticationOptions(username);
    if (isError(options)) {
      return options;
    }
    console.log("got authentication options");

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
      return new Error(`Failed to verify authentication`);
    }

    console.log("Verified authentication");
    return password;
  }
}
