import { atom, useAtom } from "jotai";
import { di, diKey, singleton } from "./../common/di";
import { SetAtom } from "jotai/core/types";
import { IAuthenticate, IAuthenticateKey } from "../common/authenticate";
import { ILoginProvider, showLoginDlg } from "./LoginDlg";
import {
  IApi,
  User,
  IApiKey,
  NoContactError,
  LocalApiServerError,
  LocalEmulatorError,
} from "../common/Api";
import Result, { isError } from "../common/Result";
import { AuthenticateError } from "./../common/Api";
import {
  clearErrorMessages,
  setErrorMessage,
  setInfoMessage,
} from "../common/MessageSnackbar";
import { setSuccessMessage } from "./../common/MessageSnackbar";
import { IStore, IStoreKey } from "./diagram/Store";
import { activityEventName } from "../common/activity";
import { ILocalStore, ILocalStoreKey } from "./../common/LocalStore";
import { orDefault } from "./../common/Result";

// Online is uses to control if device database sync should and can be enable or not
export const IOnlineKey = diKey<IOnline>();
export interface IOnline {
  enableSync(): Promise<Result<void>>;
  disableSync(): void;
}

// Current sync state to be shown e.g. in ui
export enum SyncState {
  Disabled = "Disabled", // Sync is disabled and inactive
  Enabled = "Enabled", // Sync is enabled and active and ok
  Error = "Error", // Sync is enabled, but not some error is preventing sync
  Progress = "Progress", // Progress to try to be enabled and ok, will result in either enabled or error
}

// useSyncMode is used by ui read and be notified of current sync state
const syncModeAtom = atom(SyncState.Disabled);
let showSyncState: SetAtom<SyncState> = () => {};
export const useSyncMode = (): SyncState => {
  const [syncMode, setSyncModeFunc] = useAtom(syncModeAtom);
  // Ensure that the Online service can set SyncState, so set the setSyncMode function
  showSyncState = setSyncModeFunc;
  return syncMode;
};

const persistentSyncKeyName = "syncState";
const deviseSyncOKMessage = "Device sync is OK";

@singleton(IOnlineKey)
export class Online implements IOnline, ILoginProvider {
  private isEnabled = false;
  private isError = false;
  private firstActivate = true;

  constructor(
    private authenticate: IAuthenticate = di(IAuthenticateKey),
    private api: IApi = di(IApiKey),
    private store: IStore = di(IStoreKey),
    private localStore: ILocalStore = di(ILocalStoreKey)
  ) {
    // Listen for user activate events to control if device sync should be activated or deactivated
    document.addEventListener(activityEventName, (activity: any) =>
      this.onActivityEvent(activity)
    );
    // Listen for StoreDB sync OK or error when syncing
    this.store.configure({
      onSyncChanged: (f: boolean, e?: Error) => this.onSyncChanged(f, e),
    });
  }

  // createAccount called by LoginDlg when user wants to create an new user account
  public async createAccount(user: User): Promise<Result<void>> {
    try {
      this.showProgress();
      const createRsp = await this.authenticate.createUser(user);
      if (isError(createRsp)) {
        setErrorMessage("Failed to create account");
        return createRsp;
      }
      clearErrorMessages();
    } finally {
      this.hideProgress();
    }
  }

  // login called by LoginDlg when user wants to login and if successful, also enables device sync
  public async login(user: User): Promise<Result<void>> {
    console.log("login");
    try {
      this.showProgress();

      const loginRsp = await this.authenticate.login(user);
      if (isError(loginRsp)) {
        console.error("Failed to login:", loginRsp);
        setErrorMessage(this.toErrorMessage(loginRsp));
        return loginRsp;
      }

      // Login successful, enable device sync
      return await this.enableSync();
    } finally {
      this.hideProgress();
    }
  }

  // cancelLogin called by LoginDlg if user cancels/closes the dialog
  public cancelLogin(): void {
    this.disableSync();
  }

  // enableSync called when device sync should be enabled
  public async enableSync(): Promise<Result<void>> {
    try {
      this.showProgress();

      // Check connection and authentication with server
      const checkRsp = await this.authenticate.check();

      if (checkRsp instanceof NoContactError) {
        // No contact with server, cannot enable sync
        this.isError = true;
        setErrorMessage(this.toErrorMessage(checkRsp));
        showSyncState(SyncState.Error);
        return checkRsp;
      }

      if (checkRsp instanceof AuthenticateError) {
        // Authentication is needed, showing the login dialog
        //await this.showLoginDialog();
        //await this.useWebAuthn();
        showLoginDlg(this);
        return checkRsp;
      }

      if (isError(checkRsp)) {
        // Som other unexpected error (neither contact nor authenticate error)
        this.isError = true;
        setErrorMessage(this.toErrorMessage(checkRsp));
        showSyncState(SyncState.Error);
        return checkRsp;
      }

      // Enable database sync and verify that sync does work
      this.setDatabaseSync(true);
      const syncResult = await this.store.triggerSync();
      if (isError(syncResult)) {
        // Database sync failed, it should nog happen in production but might during development
        setErrorMessage(this.toErrorMessage(syncResult));
        showSyncState(SyncState.Error);
        this.isError = true;
        this.setDatabaseSync(false);
        this.authenticate.resetLogin();
        return syncResult;
      }

      // Device sync successfully enabled
      this.setPersistentIsEnabled(true);
      this.isEnabled = true;
      this.isError = false;
      setSuccessMessage(deviseSyncOKMessage);
      showSyncState(SyncState.Enabled);
    } finally {
      this.hideProgress();
    }
  }

  // private async useWebAuthn(): Promise<void> {
  //   const isAvailable = await platformAuthenticatorIsAvailable();
  //   console.log("platformAuthenticatorIsAvailable", isAvailable);
  //   const username = "michael";

  //   const registrationOptions =
  //     await this.authenticate.getWebAuthnRegistrationOptions({
  //       username: username,
  //     });
  //   if (isError(registrationOptions)) {
  //     console.error("error", registrationOptions);
  //     alert(
  //       "Error: Failed to get registration options from server" +
  //         registrationOptions
  //     );
  //     return;
  //   }
  //   alert("Got verification options from server: OK");

  //   const options: any = registrationOptions;
  //   console.log("options1:", options);
  //   options.user.id = "12345" + options.user.id;
  //   console.log("options2:", options);

  //   let registrationResponse;
  //   try {
  //     // Pass the options to the authenticator and wait for a response
  //     registrationResponse = await startRegistration(options);
  //   } catch (error) {
  //     // Some basic error handling
  //     const e = error as Error;
  //     console.error("Error", error);
  //     console.error("name", e.name);
  //     alert("Error: Failed to register on device" + error);
  //     // if (error.name === 'InvalidStateError') {
  //     //   elemError.innerText = 'Error: Authenticator was probably already registered by user';
  //     // } else {
  //     //   elemError.innerText = error;
  //     // }

  //     return;
  //   }
  //   console.log("registrationResponse", registrationResponse);
  //   alert("Registered on device: OK " + registrationResponse.id);

  //   const registrationVerificationResponse =
  //     await this.authenticate.verifyWebAuthnRegistration({
  //       username: username,
  //       registration: registrationResponse,
  //     });
  //   if (isError(registrationVerificationResponse)) {
  //     console.error("error", registrationVerificationResponse);
  //     alert(
  //       "Error: Failed to verify registration on server" +
  //         registrationVerificationResponse
  //     );
  //     return;
  //   }

  //   if (!(registrationVerificationResponse as any).verified) {
  //     console.error(
  //       "Failed to verify registration on server",
  //       registrationVerificationResponse
  //     );
  //     alert(
  //       "Error: Failed to verify registration on server: " +
  //         registrationVerificationResponse
  //     );
  //     return;
  //   }

  //   console.log("verified registration", registrationVerificationResponse);
  //   alert(
  //     "Registration verified by server: " +
  //       (registrationVerificationResponse as any).verified
  //   );

  //   // GET authentication options from the endpoint that calls
  //   const authenticationOptions =
  //     await this.authenticate.getWebAuthnAuthenticationOptions({
  //       username: username,
  //     });
  //   if (isError(authenticationOptions)) {
  //     console.error("error", authenticationOptions);
  //     alert("Error: failed to get authentication options from server");
  //     return;
  //   }
  //   console.log("authOptions", authenticationOptions);
  //   alert("Got authentication options from server OK ");

  //   let authenticationResponse;
  //   try {
  //     // Pass the options to the authenticator and wait for a response
  //     authenticationResponse = await startAuthentication(
  //       authenticationOptions.options
  //     );
  //   } catch (error) {
  //     console.error("Error", error);
  //     alert("Error: Failed to authenticate on device" + error);
  //     return;
  //   }

  //   console.log("asseResp1", authenticationResponse);
  //   alert(
  //     "Authenticated on device ok: " +
  //       authenticationResponse.response.userHandle
  //   );
  //   authenticationResponse.response.userHandle = undefined;
  //   console.log("asseResp2", authenticationResponse);

  //   // POST the response to the endpoint that calls
  //   const authenticationVerificationResponse =
  //     await this.authenticate.verifyWebAuthnAuthentication({
  //       username: username,
  //       authentication: authenticationResponse,
  //     });
  //   console.log("rsp", authenticationVerificationResponse);

  //   if (isError(authenticationVerificationResponse)) {
  //     console.error("error", authenticationVerificationResponse);
  //     alert(
  //       "Error: Failed to verify authentication on server: " +
  //         authenticationVerificationResponse
  //     );
  //     return;
  //   }

  //   alert(
  //     "Authenticated verified by server" +
  //       (authenticationVerificationResponse as any).verified
  //   );

  //   //showLoginDlg(this);
  // }

  // disableSync called when disabling device sync
  public disableSync(): void {
    const wasEnabled = this.isEnabled;
    this.setPersistentIsEnabled(false);
    this.isEnabled = false;
    this.isError = false;
    this.setDatabaseSync(false);
    clearErrorMessages();
    if (wasEnabled) {
      this.authenticate.resetLogin();
      setInfoMessage("Device sync is disabled");
    }

    showSyncState(SyncState.Disabled);
  }

  // onSyncChanged called by the StoreDB whenever sync changes to OK or to !OK with some error
  private onSyncChanged(ok: boolean, error?: Error) {
    if (!this.isEnabled) {
      // Syncing is not enabled, just reset state
      this.isError = false;
      this.setDatabaseSync(false);
      showSyncState(SyncState.Disabled);
      return;
    }

    if (!ok) {
      // StoreDB failed syncing, showing error
      this.isError = true;
      setErrorMessage(this.toErrorMessage(error));
      showSyncState(SyncState.Error);
      return;
    }

    // StoreDB synced ok, show Success message
    this.isError = false;
    setSuccessMessage(deviseSyncOKMessage);
    showSyncState(SyncState.Enabled);
  }

  // onActivityEvent called whenever user activity changes, e.g. not active or activated page
  private onActivityEvent(activity: CustomEvent) {
    const isActive = activity.detail;
    console.log(`onActivity: ${isActive}`);

    if (!isActive) {
      // User no longer active, inactivate database sync if enabled
      if (this.isEnabled) {
        this.setDatabaseSync(false);
        this.showProgress();
      }
      return;
    }

    // Activated
    this.hideProgress();

    if (this.firstActivate) {
      // First activity signal, checking if sync should be enabled automatically
      this.firstActivate = false;
      if (this.getPersistentIsEnabled()) {
        setTimeout(() => this.enableSync(), 0);
        return;
      }
    }

    if (this.isEnabled) {
      // Sync is enabled, activate database sync again and trigger a sync now to check
      this.setDatabaseSync(true);
      this.store.triggerSync();
    }
  }

  private setDatabaseSync(flag: boolean): void {
    this.store.configure({ isSyncEnabled: flag });
  }

  // getPersistentIsEnabled returns true if sync should be automatically enabled after browser start
  private getPersistentIsEnabled() {
    return orDefault(this.localStore.tryRead(persistentSyncKeyName), false);
  }

  // setPersistentIsEnabled stores if  sync should be automatically enabled after browser start
  private setPersistentIsEnabled(state: boolean) {
    this.localStore.write(persistentSyncKeyName, state);
  }

  // showProgress notifies ui to show progress icon while trying to enable sync ot not active
  private showProgress(): void {
    showSyncState(SyncState.Progress);
  }

  // hideProgress notifies ui to restore sync mode state
  private hideProgress(): void {
    if (!this.isEnabled) {
      showSyncState(SyncState.Disabled);
    } else if (this.isError) {
      showSyncState(SyncState.Error);
    } else {
      showSyncState(SyncState.Enabled);
    }
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
