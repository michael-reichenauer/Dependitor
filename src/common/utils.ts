// Some handy utility functions
import { isError } from "./Result";

const humanizeDuration = require("humanize-duration");

export const seconds = 1000;
export const minutes = 60 * seconds;
export const hours = 60 * minutes;

// Returns a duration as a nice human readable string
export const durationString = (duration: number): string => {
  return humanizeDuration(duration);
};

// Returns a random number between min and max
export const random = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max) + 1;
  return Math.floor(Math.random() * (max - min) + min);
};

export const randomString = (count: number): string => {
  let randomText = "";
  const randomBytes = crypto.getRandomValues(new Uint8Array(count));
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvxyz0123456789";

  for (var i = 0; i < count; i++) {
    randomText += characters.charAt(randomBytes[i] % characters.length);
  }
  return randomText;
};

// Returns the distance between 2 points
export const distance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
};

// Async sleep/delay
export async function delay(time: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(res, time);
  });
}

// Returns the sha 256 hash of the string
export async function sha256Hash(text: string): Promise<string> {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(text);

  // hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // convert bytes to hex string
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

// Returns if build is developer mode (running on local machine)
export const isDeveloperMode: boolean =
  !process.env.NODE_ENV || process.env.NODE_ENV === "development";

export const isLocal: boolean =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const fetchFiles = (
  paths: string[],
  result: (files: string[]) => void
): void => {
  Promise.all(paths.map((path) => fetch(path)))
    .then((responses) => {
      // Get the file for each response
      return Promise.all(
        responses.map((response) => {
          return response.text();
        })
      );
    })
    .then((files) => {
      result(files);
    })
    .catch((error) => {
      // if there's an error, log it
      result([]);
      console.log(error);
    });
};

export const svgToSvgDataUrl = (svg: string): string => {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};

export const publishAsDownload = (dataUrl: string, name: string) => {
  var link = document.createElement("a");
  link.download = name;
  link.style.opacity = "0";
  document.body.append(link);
  link.href = dataUrl;
  link.click();
  link.remove();
};

export const imgDataUrlToPngDataUrl = (
  imgDataUrl: string,
  width: number,
  height: number,
  result: (url: string) => void
) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context?.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngDataUrl = canvas.toDataURL(); // default png

    result(pngDataUrl);
  };

  image.src = imgDataUrl;
};

export const lx = (obj: any): any => {
  if (isError(obj)) {
    const msg = obj.message ? `:${obj.message}` : "";
    return `${obj.name}${msg}`;
  }
  return obj;
};

export function stringToBase64(text: string): string {
  const enc = new TextEncoder();
  return bufferToBase64(enc.encode(text));
}

export function base64ToString(text: string): string {
  var enc = new TextDecoder("utf-8");
  return enc.decode(base64ToBuffer(text));
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes: any = new Uint8Array(buffer);
  let str = "";

  for (const charCode of bytes) {
    str += String.fromCharCode(charCode);
  }

  const base64String = btoa(str);

  return base64String.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function base64ToBuffer(base64URLString: string): ArrayBuffer {
  // Convert from Base64URL to Base64
  const base64 = base64URLString.replace(/-/g, "+").replace(/_/g, "/");
  /**
   * Pad with '=' until it's a multiple of four
   * (4 - (85 % 4 = 1) = 3) % 4 = 3 padding
   * (4 - (86 % 4 = 2) = 2) % 4 = 2 padding
   * (4 - (87 % 4 = 3) = 1) % 4 = 1 padding
   * (4 - (88 % 4 = 0) = 4) % 4 = 0 padding
   */
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64.padEnd(base64.length + padLength, "=");

  // Convert to a binary string
  const binary = atob(padded);

  // Convert binary string to buffer
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return buffer;
}
