import { diKey, singleton } from "../common/di";
import Result, { isError } from "../common/Result";
import {
  base64ToString,
  jsonParse,
  jsonStringify,
  stringToBase64,
} from "../common/utils";

// isAuthenticatorApp returns true if the current url path specifies a authenticator app
export function isAuthenticatorApp(): boolean {
  return window.location.pathname.startsWith(authenticatorUrlPath);
}

// IAuthenticatorProtocol defines the protocol between the authenticator server and client
export const IAuthenticatorProtocolKey = diKey<IAuthenticatorProtocol>();
export interface IAuthenticatorProtocol {
  getAuthenticatorUrl(): string;
  getAuthenticateUrl(request: AuthenticateReq): string;
  hasAuthenticateCode(): boolean;

  stringifyAuthenticateReq(request: AuthenticateReq): string;
  parseAuthenticateReq(): Result<AuthenticateReq>;
}

// AuthenticateReq is request info that a device encodes in a QR code to the authenticator
export interface AuthenticateReq {
  n: string; // Unique client device name for this client/browser instance
  d: string; // Client description, like .e.g Edge, IPad
  k: string; // The password key to encrypt response from authenticator to this device
  c: string; // The channel id where this device is polling for authenticator response
}

// AuthenticatorRsp is the response to the device for an AuthenticateReq request
export interface AuthenticatorRsp {
  wDek: string;
  username: string;
  isAccepted: boolean;
}

const authenticatorUrlPath = "/a/"; // The base path which determines if authenticator is requested

@singleton(IAuthenticatorProtocolKey)
export class AuthenticatorProtocol implements IAuthenticatorProtocol {
  public hasAuthenticateCode(): boolean {
    return !!this.getAuthenticateCode();
  }
  public getAuthenticatorUrl(): string {
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    return `${baseUrl}${authenticatorUrlPath}`;
  }

  public getAuthenticateUrl(request: AuthenticateReq): string {
    const code = this.stringifyAuthenticateReq(request);

    return `${this.getAuthenticatorUrl()}${code}`;
  }

  public stringifyAuthenticateReq(request: AuthenticateReq): string {
    const requestJson = jsonStringify(request);
    const code = stringToBase64(requestJson);
    return code;
  }

  public parseAuthenticateReq(): Result<AuthenticateReq> {
    const authenticateCode = this.getAuthenticateCode();

    const infoJson = base64ToString(authenticateCode);
    if (isError(infoJson)) {
      return infoJson;
    }
    return jsonParse<AuthenticateReq>(infoJson);
  }

  public getAuthenticateCode(): string {
    return window.location.pathname.substring(authenticatorUrlPath.length);
  }
}
