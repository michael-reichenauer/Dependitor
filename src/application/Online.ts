import { atom, useAtom } from "jotai";
import { di, diKey, singleton } from "./../common/di";
import { SetAtom } from "jotai/core/types";
import { IAuthenticateKey } from "../common/authenticate";
import {
  NoContactError,
  LocalApiServerError,
  LocalEmulatorError,
  SessionError,
} from "../common/Api";
import Result, { isError } from "../common/Result";
import { AuthenticateError } from "./../common/Api";
import {
  clearErrorMessages,
  setErrorMessage,
  setInfoMessage,
  setWarnMessage,
} from "../common/MessageSnackbar";
import { setSuccessMessage } from "./../common/MessageSnackbar";
import { IStoreKey } from "./diagram/Store";
import { activityEventName } from "../common/activity";
import { ILocalStoreKey } from "./../common/LocalStore";
import { orDefault } from "./../common/Result";
import {
  WebAuthnCanceledError,
  WebAuthnNeedReloadError,
} from "../common/webauthn";
import { withProgress } from "../common/Progress";
import { showInfoAlert } from "../common/AlertDialog";
import { LoginProvider } from "./LoginProvider";
import { showLoginDlg } from "./LoginDlg";

// Online is uses to control if device database sync should and can be enable or not
export const IOnlineKey = diKey<IOnline>();
export interface IOnline {
  enableDeviceSync(): Promise<Result<void>>;
  disableDeviceSync(): void;

  loginOnLocalDevice(): Promise<Result<void>>;
  cancelLoginOnLocalDevice(): void;
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

const persistentSyncKeyName = "online.syncState";
const loginAfterReloadKeyName = "online.loginAfterReload";

const deviseSyncOKMessage = "Device sync is enabled and OK";
const deviceSyncDisabledMsg = "Device sync is disabled";
const deviceSyncCanceledMsg =
  "Authentication canceled, device sync was not enabled";

@singleton(IOnlineKey)
export class Online implements IOnline {
  private isEnabled = false;
  private isError = false;
  private firstActivate = true;

  constructor(
    private authenticate = di(IAuthenticateKey),
    private store = di(IStoreKey),
    private localStore = di(ILocalStoreKey)
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

  // login called by LoginDlg when user wants to login and if successful, also enables device sync
  public async loginOnLocalDevice(): Promise<Result<void>> {
    return await withProgress(async () => {
      console.log("login");
      try {
        this.showProgress();

        const loginRsp = await this.authenticate.login();
        if (loginRsp instanceof WebAuthnNeedReloadError) {
          // On IOS, access to WebAuthn only works on recently manually loaded web page,
          // so user must must manually reload and after reload we try again.
          this.setTriggerLoginAfterReload(true);
          this.showReloadPageAlert();
          return;
        }
        if (loginRsp instanceof WebAuthnCanceledError) {
          // User canceled login
          setInfoMessage(deviceSyncCanceledMsg);
          this.cancelLoginOnLocalDevice();
          return;
        }
        if (isError(loginRsp)) {
          // Some other unexpected error
          console.error("Failed to login:", loginRsp);
          setErrorMessage(this.toErrorMessage(loginRsp));
          return loginRsp;
        }

        // Login was successful, enable device sync
        return await this.enableSync();
      } finally {
        this.hideProgress();
      }
    });
  }

  // cancelLogin called by LoginDlg if user cancels/closes the dialog
  public cancelLoginOnLocalDevice(): void {
    this.disableDeviceSync();
  }

  // enableDeviceSync called when device sync should be enabled
  public async enableDeviceSync(): Promise<Result<void>> {
    console.log("enable");

    const enableResult = await this.enableSync();
    return enableResult;
  }

  // disableSync called when disabling device sync
  public disableDeviceSync(): void {
    const wasEnabled = this.isEnabled;
    this.setPersistentIsSyncEnabled(false);
    this.isEnabled = false;
    this.isError = false;
    this.setDatabaseSync(false);
    clearErrorMessages();
    if (wasEnabled) {
      this.authenticate.resetLogin();
      setInfoMessage(deviceSyncDisabledMsg);
    }

    showSyncState(SyncState.Disabled);
  }

  // enableSync called when device sync should be enabled
  private async enableSync(): Promise<Result<void>> {
    console.log("enable");
    try {
      this.showProgress();

      // Check connection and authentication with server
      const checkRsp = await this.authenticate.check();
      if (checkRsp instanceof AuthenticateError) {
        // Authentication is needed, showing the authentication dialog
        // return await withProgress(() => this.loginOnLocalDevice());
        if (
          this.getPersistentIsSyncEnabled() &&
          this.authenticate.isLocalLoginEnabled()
        ) {
          return this.loginOnLocalDevice();
        }
        showLoginDlg(new LoginProvider(this));
        return checkRsp;
      }
      if (isError(checkRsp)) {
        this.setError(checkRsp);
        return checkRsp;
      }

      // Authenticated, enable database sync and verify that sync does work
      this.setDatabaseSync(true);
      const syncResult = await this.store.triggerSync();
      if (isError(syncResult)) {
        // Database sync failed, it should not happen in production but might during development
        this.setError(syncResult);
        this.setDatabaseSync(false);
        this.authenticate.resetLogin();
        return syncResult;
      }

      // Device sync successfully enabled
      this.setSuccess();
    } finally {
      this.hideProgress();
    }
  }

  private setError(error: Error) {
    this.isError = true;
    setErrorMessage(this.toErrorMessage(error));
    showSyncState(SyncState.Error);
  }

  private setSuccess() {
    this.setPersistentIsSyncEnabled(true);
    this.isEnabled = true;
    this.isError = false;
    setSuccessMessage(deviseSyncOKMessage);
    showSyncState(SyncState.Enabled);
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
      if (error instanceof SessionError) {
        setWarnMessage(this.toErrorMessage(error));
        showSyncState(SyncState.Error);
        setTimeout(() => this.enableSync(), 0);
        return;
      }
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
    // console.log(`onActivity: ${isActive}`);

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
      if (this.getLoginAfterReloadEnabled()) {
        this.setTriggerLoginAfterReload(false);
        setTimeout(() => this.loginOnLocalDevice(), 0);
        return;
      }

      if (this.getPersistentIsSyncEnabled()) {
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

  // getPersistentIsSyncEnabled returns true if sync should be automatically enabled after browser start
  private getPersistentIsSyncEnabled() {
    return this.localStore.readOrDefault(persistentSyncKeyName, false);
  }

  // setPersistentIsSyncEnabled stores if  sync should be automatically enabled after browser start
  private setPersistentIsSyncEnabled(state: boolean) {
    this.localStore.write(persistentSyncKeyName, state);
  }

  // getLoginAfterReloadEnabled returns true if a login should be done once after a reload
  private getLoginAfterReloadEnabled() {
    return orDefault(this.localStore.tryRead(loginAfterReloadKeyName), false);
  }

  // setLoginAfterReloadEnabled stores if  login should be done once after a reload
  private setTriggerLoginAfterReload(state: boolean) {
    this.localStore.write(loginAfterReloadKeyName, state);
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

  private showReloadPageAlert() {
    showInfoAlert(
      "Reload Page",
      `Please manually reload this page to show the authentication dialog.

      This browser requires a recently manually loaded page before allowing access to authentication.`,
      { showOk: false }
    );
  }

  // toErrorMessage translate network and sync errors to ui messages
  private toErrorMessage(error?: Error): string {
    if (isError(error, LocalApiServerError)) {
      return "Local Azure functions api server is not started.";
    }
    if (isError(error, LocalEmulatorError)) {
      return "Local Azure storage emulator not started.";
    }
    if (isError(error, SessionError)) {
      return "Invalid session. Please retry to enable sync again";
    }
    if (isError(error, AuthenticateError)) {
      return "Authentication error. Please retry again.";
    }
    if (isError(error, NoContactError)) {
      return "No network contact with server. Please retry again in a while.";
    }

    return "Internal server error";
  }
}
