import { AuthenticateError, IApi, IApiKey } from "./Api";
import { User } from "./Api";
import { di, diKey, singleton } from "./di";
import { IKeyVaultConfigure, IKeyVaultConfigureKey } from "./keyVault";
import Result, { isError } from "./Result";
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
      // No stored user info, i.e. first time, lets create this device user
      return await this.createNewUser();
    }

    // This device has a registered used, lets login that user
    return await this.loginUser(authInfo);
  }

  private async createNewUser(): Promise<Result<void>> {
    console.log("createNewUser");

    // Generating a new user with random username and password
    const user = this.generateNewUser();

    // Register this user in the system authenticator using WebAuthn api and let the
    // api server verify that registration
    const register = await this.registerDevice(user);
    if (isError(register)) {
      return new Error("Failed to register device");
    }

    // Generate a new data encryption key DEK and wrap/encrypt
    // into a wDek protected by the user password
    const wDek = await this.dataCrypt.generateWrappedDataEncryptionKey(user);
    console.log("new user", user, wDek);

    // Unwrap the wrapped DEK so it can be used and make it available
    // to be used when encrypting/decrypting data when accessing server
    const dek = await this.dataCrypt.unwrapDataEncryptionKey(wDek, user);
    this.keyVaultConfigure.setDek(dek);

    // Store the user name and wrapped DEK for the next authentication
    const info: UserInfo = { username: user.username, wDek: wDek };
    this.localStore.write(userInfoKey, info);
  }

  private async loginUser(userInfo: UserInfo): Promise<Result<void>> {
    console.log("loginUser");

    // Authenticate the existing registered username
    const { username, wDek } = userInfo;
    const password = await this.authenticate(username);
    if (isError(password)) {
      return new Error("Failed to authenticate device");
    }

    const user = { username, password };

    console.log("existing user", user, wDek);

    // Unwrap the dek so it can be used
    const dek = await this.dataCrypt.unwrapDataEncryptionKey(wDek, user);

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

  // public async login(): Promise<Result<void>> {
  //   if (!(await this.webAuthn.platformAuthenticatorIsAvailable())) {
  //     return new Error("Error: Biometrics not available");
  //   }

  //   const authInfo = this.localStore.tryRead<UserInfo>(authInfoKey);
  //   if (isError(authInfo)) {
  //     console.log("register");
  //     // No stored auth info, i.e. first time, lets register this device
  //     const user = this.createNewUser();

  //     const register = await this.registerDevice(user);
  //     if (isError(register)) {
  //       return new Error("Failed to register device");
  //     }

  //     // Generate the data encryption key DEK and wrap/encrypt into a wDek
  //     const wDek = await this.dataCrypt.generateWrappedDataEncryptionKey(user);
  //     console.log("new user", user, wDek);

  //     const info: UserInfo = {
  //       username: user.username,
  //       wDek: wDek,
  //     };
  //     this.localStore.write(authInfoKey, info);

  //     // Unwrap the dek so it can be used
  //     const dek = await this.dataCrypt.unwrapDataEncryptionKey(wDek, user);

  //     // Make the DEK available to be used when encrypting/decrypting data when accessing server
  //     this.keyVaultConfigure.setDek(dek);
  //     return;
  //   }

  //   console.log("Authenticate");

  //   // Authenticate stored user
  //   const username = authInfo.username;
  //   const wDek = authInfo.wDek;

  //   const password = await this.authenticate(username);
  //   if (isError(password)) {
  //     return new Error("Failed to authenticate device");
  //   }

  //   const user = { username, password };
  //   console.log("existing user", user, wDek);

  //   // Unwrap the dek so it can be used
  //   const dek = await this.dataCrypt.unwrapDataEncryptionKey(wDek, user);

  //   // Make the DEK available to be used when encrypting/decrypting data when accessing server
  //   this.keyVaultConfigure.setDek(dek);

  //   // const user = await this.hashAndExpandUser(enteredUser);
  //   // if (isError(user)) {
  //   //   return user;
  //   // }

  //   // const loginRsp = await this.api.login(user);
  //   // if (isError(loginRsp)) {
  //   //   return loginRsp;
  //   // }

  //   // // Extract the data encryption key DEK from the wrapped/encrypted wDek
  //   // const dek = await this.dataCrypt.unwrapDataEncryptionKey(
  //   //   loginRsp.wDek,
  //   //   user
  //   // );

  //   // // Make the DEK available to be used when encrypting/decrypting data when accessing server
  //   // this.keyVaultConfigure.setDek(dek);
  // }

  public resetLogin(): void {
    this.keyVaultConfigure.setDek(null);

    // Try to logoff from server ass well (but don't await result)
    this.api.logoff();
  }

  // private async hashAndExpandUser(enteredUser: User): Promise<Result<User>> {
  //   let { username, password } = enteredUser;

  //   if (
  //     !username ||
  //     !password ||
  //     username.length < minUserName ||
  //     password.length < minPassword
  //   ) {
  //     return new AuthenticateError();
  //   }

  //   // Normalize username and password
  //   username = username.trim().toLowerCase();
  //   password = password.trim();

  //   // Hash username to ensure original username is hidden from server
  //   username = await sha256Hash(username);

  //   // Expand/derive the password to ensure that password is hard to crack using brute force
  //   // This hashing is done first on client side and then one more time on server side on the
  //   // already client side hashed password.
  //   password = await this.dataCrypt.expandPassword({
  //     username: username,
  //     password: password,
  //   });

  //   return { username: username, password: password };
  // }

  private async registerDevice(user: User): Promise<Result<void>> {
    const { username, password } = user;
    // Getting the registration options, including the random unique challenge, from the server,
    // Which will then later be verified by the server in the verifyWebAuthnRegistration() call.
    const options = await this.api.getWebAuthnRegistrationOptions(username);
    if (isError(options)) {
      return new Error(`Failed to get registration options: ${options}`);
    }

    // Prefix the user id with the KEK password.
    // This password-userId is then returned when authenticating as the response.userHandle
    options.user.id = password + options.user.id;

    // Using the standard "Dependitor" user name, since the actual user name is random unique string
    options.user.name = "Dependinator";

    // Register this user/device in the device authenticator. The challenge will be signed
    const registration = await this.webAuthn.startRegistration(options);
    if (isError(registration)) {
      return new Error(`Failed to register: ${registration}`);
    }

    console.log("Registered device", password);

    // Let the server verify the registration by validating the challenge is signed with the
    // authenticator hidden private key, which corresponds with the public key
    const verified = await this.api.verifyWebAuthnRegistration(
      username,
      registration
    );
    if (isError(verified) || !verified) {
      return new Error(`Failed to verify registration: ${verified}`);
    }

    console.log("Verified registration");
  }

  private async authenticate(username: string): Promise<Result<string>> {
    // GET authentication options from the endpoint that calls
    const options = await this.api.getWebAuthnAuthenticationOptions(username);
    if (isError(options)) {
      return new Error(`Failed to get authentication options: ${options}`);
    }
    console.log("got authentication options");

    // Pass the options to the authenticator and wait for a response
    const authentication = await this.webAuthn.startAuthentication(options);
    if (isError(authentication)) {
      return new Error(`Failed to authenticate: ${authentication}`);
    }

    // Extract the password, which prefixed to the user id
    const password =
      authentication.response.userHandle?.substring(
        0,
        randomKekPasswordLength
      ) ?? "";
    console.log("authenticated", password);

    // Clear the user handle, since the server should not know the password prefix
    // and does not need to know the user id
    authentication.response.userHandle = undefined;

    // POST the response to the endpoint that calls
    const verified = await this.api.verifyWebAuthnAuthentication(
      username,
      authentication
    );
    if (isError(verified) || !verified) {
      return new Error(`Failed to verify authentication: ${verified}`);
    }

    console.log("Verified authentication");
    return password;
  }
}
