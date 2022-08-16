const isIpad =
  navigator.userAgent.toLowerCase().indexOf("macintosh") > -1 &&
  navigator.maxTouchPoints &&
  navigator.maxTouchPoints > 2;

export const isMobileDevice = /Android|iPhone/i.test(navigator.userAgent);

export const isMobileOrTabletDevice =
  isIpad || /Android|iPad|iPhone/i.test(navigator.userAgent);

export const isEdgeOnIos =
  isMobileOrTabletDevice && /Edg/i.test(navigator.userAgent);

export function isProduction(): boolean {
  return window.location.hostname === "dependitor.com";
}

export const isStandaloneApp = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // @ts-ignore
  window.navigator.standalone ||
  document.referrer.includes("android-app://");

// Returns if build is developer mode (running on local machine)
export const isDeveloperMode: boolean =
  !process.env.NODE_ENV || process.env.NODE_ENV === "development";

export const isLocal: boolean =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
