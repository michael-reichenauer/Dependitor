import { ICryptKey } from "../common/crypt";
import { di, diKey, singleton } from "../common/di";
import Result from "../common/Result";
import { arrayToString } from "../common/utils";

// isAuthenticatorApp returns true if the current url path specifies a authenticator app
export function isAuthenticatorApp(): boolean {
  return window.location.pathname.startsWith(authenticatorUrlPath);
}

// IAuthenticatorProtocol defines the protocol between the authenticator server and client
export const IAuthenticatorProtocolKey = diKey<IAuthenticatorProtocol>();
export interface IAuthenticatorProtocol {
  getRequestAuthenticateCode(): string;
  generateAuthenticateCode(): string;
  getAuthenticatorUrl(): string;
  getAuthenticateUrl(authenticateCode: AuthenticateCode): string;
  hasAuthenticateCode(): boolean;

  parseAuthenticateReq(
    authenticateCode: AuthenticateCode
  ): Promise<Result<AuthenticateReq>>;
}

export type AuthenticateCode = string;

// AuthenticateReq is request info that a device encodes in a QR code to the authenticator
export interface AuthenticateReq {
  clientName: string; // Unique client device name for this client/browser instance
  //d: string; // Client description, like .e.g Edge, IPad
  passkey: string; // The password key to encrypt response from authenticator to this device
  channelId: string; // The channel id where this device is polling for authenticator response
}

// AuthenticatorRsp is the response to the device for an AuthenticateReq request
export interface AuthenticatorRsp {
  wDek: string;
  username: string;
  isAccepted: boolean;
}

const authenticatorUrlPath = "/a/"; // The base path which determines if authenticator is requested
const codeCharacters = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"; // No O, I chars
const codeLength = 8; // The length of the authenticator code (code in the QR code url)
const codePartsLength = 15; // The length of each of the expanded parts

@singleton(IAuthenticatorProtocolKey)
export class AuthenticatorProtocol implements IAuthenticatorProtocol {
  constructor(private crypt = di(ICryptKey)) {}

  public generateAuthenticateCode(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(codeLength));

    return arrayToString(randomBytes, codeCharacters);
  }

  public hasAuthenticateCode(): boolean {
    return !!this.getRequestAuthenticateCode();
  }
  public getAuthenticatorUrl(): string {
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    return `${baseUrl}${authenticatorUrlPath}`;
  }

  public getAuthenticateUrl(authenticateCode: AuthenticateCode): string {
    return `${this.getAuthenticatorUrl()}${authenticateCode}`;
  }

  public async parseAuthenticateReq(
    authenticateCode: AuthenticateCode
  ): Promise<Result<AuthenticateReq>> {
    const expandedCode = await this.expandCode(authenticateCode);

    return {
      clientName: expandedCode.substring(0, codePartsLength),
      passkey: expandedCode.substring(codePartsLength, 2 * codePartsLength),
      channelId: expandedCode.substring(
        2 * codePartsLength,
        3 * codePartsLength
      ),
    };
  }

  public getRequestAuthenticateCode(): AuthenticateCode {
    return window.location.pathname.substring(authenticatorUrlPath.length);
  }

  private async expandCode(code: AuthenticateCode): Promise<string> {
    const salt = await this.crypt.sha256(code);
    const bits = await this.crypt.deriveBits(
      code,
      salt,
      8 * 3 * codePartsLength
    );
    const array = new Uint8Array(bits);
    return arrayToString(array, codeCharacters);
  }
}
