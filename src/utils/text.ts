import Result from "../common/Result";

export function jsonStringify<T>(obj: T): string {
  return JSON.stringify(obj);
}

export function jsonParse<T>(jsonText: string): Result<T> {
  try {
    const obj = JSON.parse(jsonText);
    return obj as T;
  } catch (error) {
    return error as Error;
  }
}

export function stringToBase64(text: string): string {
  const enc = new TextEncoder();
  return bufferToBase64(enc.encode(text));
}

export function base64ToString(text: string): Result<string> {
  try {
    var enc = new TextDecoder("utf-8");
    return enc.decode(base64ToBuffer(text));
  } catch (error) {
    return error as Error;
  }
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
