import VConsole from "vconsole";
import { ILocalStoreKey } from "../common/LocalStore";
import { di } from "./di";
import { isMobileOrTabletDevice } from "./utils";

const vConsoleKey = "vConsole.enable";
let vConsole: any = null;
const removeKeys = [vConsoleKey, "vConsole_switch_x", "vConsole_switch_y"];

export const isVirtualConsoleSupported = isMobileOrTabletDevice;

export function isVirtualConsoleEnabled() {
  return !!vConsole;
}

export function enableVirtualConsole(flag: boolean): void {
  if (flag) {
    vConsole = new VConsole({ theme: "dark", log: { showTimestamps: true } });
    vConsole.show();
  } else {
    vConsole?.destroy();
    vConsole = undefined;
  }

  if (flag) {
    di(ILocalStoreKey).write(vConsoleKey, flag);
  } else {
    di(ILocalStoreKey).removeBatch(removeKeys);
  }
}

export function restoreVirtualConsoleState(): void {
  enableVirtualConsole(di(ILocalStoreKey).readOrDefault(vConsoleKey, false));
}
