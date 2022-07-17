import VConsole from "vconsole";
import { ILocalStoreKey } from "../common/LocalStore";
import { di } from "./di";

const vConsoleKey = "vConsole.enable";
let vConsole: any = null;

export function isVirtualConsoleEnabled() {
  return !!vConsole;
}

export function enableVirtualConsole(flag: boolean): void {
  if (flag) {
    vConsole = new VConsole({ theme: "dark", log: { showTimestamps: true } });
  } else {
    vConsole?.destroy();
    vConsole = undefined;
  }

  di(ILocalStoreKey).write(vConsoleKey, flag);
}

export function restoreVirtualConsoleState(): void {
  enableVirtualConsole(di(ILocalStoreKey).readOrDefault(vConsoleKey, false));
}
