import axios from "axios";
import timing from "./timing";

import Result, { isError } from "./Result";
import { diKey, singleton } from "./di";
import { CustomError } from "./CustomError";
import {
  AuthenticationCredentialJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationCredentialJSON,
} from "@simplewebauthn/typescript-types";
import { withProgress } from "./Progress";
import { commonApiKey } from "../config";
import { Time } from "../utils/time";
import { jsonStringify } from "../utils/text";

export const IApiKey = diKey<IApi>();
export interface IApi {
  check(): Promise<Result<void>>;

  loginDeviceSet(authData: LoginDeviceSetReq): Promise<Result<void>>;
  loginDevice(req: LoginDeviceReq): Promise<Result<string>>;
  logoff(): Promise<Result<void>>;

  tryReadBatch(queries: Query[]): Promise<Result<ApiEntity[]>>;
  writeBatch(entities: ApiEntity[]): Promise<Result<ApiEntityRsp[]>>;
  removeBatch(keys: string[]): Promise<Result<void>>;

  getWebAuthnRegistrationOptions(
    username: string
  ): Promise<Result<GetWebAuthnRegistrationOptionsRsp>>;
  verifyWebAuthnRegistration(
    username: string,
    registration: RegistrationCredentialJSON
  ): Promise<Result<boolean>>;
  getWebAuthnAuthenticationOptions(
    username: string
  ): Promise<Result<PublicKeyCredentialRequestOptionsJSON>>;
  verifyWebAuthnAuthentication(
    username: string,
    authentication: AuthenticationCredentialJSON
  ): Promise<Result<boolean>>;
}

export interface GetWebAuthnRegistrationOptionsRsp {
  options: PublicKeyCredentialCreationOptionsJSON;
  username: string;
}

export interface LoginDeviceSetReq {
  channelId: string;
  isAccept: boolean;
  authData: string;
}

export interface LoginDeviceReq {
  channelId: string;
}

export interface User {
  username: string;
  password: string;
}

export interface CreateUserReq {
  user: User;
  wDek: string;
}

export interface LoginRsp {
  token: string;
  wDek: string;
}

export interface RegistrationOptionsRsp {
  options: PublicKeyCredentialCreationOptionsJSON;
}

export interface AuthenticationOptionsRsp {
  options: PublicKeyCredentialRequestOptionsJSON;
}

export type ApiEntityStatus = "value" | "noValue" | "notModified" | "error";

export interface ApiEntity {
  key: string;
  etag?: string;
  // stamp: string;
  status?: ApiEntityStatus;
  value?: any;
}

export interface ApiEntityRsp {
  key: string;
  status?: string;
  etag?: string;
}

export interface Query {
  key: string;
  IfNoneMatch?: string;
}

export class NetworkError extends CustomError {}
export class ServerError extends NetworkError {}
export class AuthenticateError extends NetworkError {}
export class CredentialError extends AuthenticateError {}
export class SessionError extends AuthenticateError {}
export class NoContactError extends NetworkError {}
export class ContactTimeoutError extends NoContactError {}
export class RequestError extends NetworkError {}
export class LocalApiServerError extends NoContactError {}
export class LocalEmulatorError extends NoContactError {}

const requestTimeout = 20 * Time.second;

@singleton(IApiKey)
export class Api implements IApi {
  private apiKey = commonApiKey; // Must be same as in server side api

  private requestCount = 0;

  public async loginDeviceSet(req: LoginDeviceSetReq): Promise<Result<void>> {
    return await this.post("/api/LoginDeviceSet", req);
  }

  public async loginDevice(req: LoginDeviceReq): Promise<Result<string>> {
    return await this.post("/api/LoginDevice", req);
  }

  public async getWebAuthnRegistrationOptions(
    username: string
  ): Promise<Result<GetWebAuthnRegistrationOptionsRsp>> {
    const rsp = await this.post("/api/GetWebAuthnRegistrationOptions", {
      username: username,
    });
    if (isError(rsp)) {
      return rsp;
    }
    return rsp;
  }

  public async verifyWebAuthnRegistration(
    username: string,
    registration: RegistrationCredentialJSON
  ): Promise<Result<boolean>> {
    const rsp = await this.post("/api/VerifyWebAuthnRegistration", {
      username: username,
      registration: registration,
    });
    if (isError(rsp)) {
      return rsp;
    }
    return (rsp as any).verified;
  }

  public async getWebAuthnAuthenticationOptions(
    username: string
  ): Promise<Result<PublicKeyCredentialRequestOptionsJSON>> {
    const rsp = await this.post("/api/GetWebAuthnAuthenticationOptions", {
      username: username,
    });
    if (isError(rsp)) {
      return rsp;
    }
    return (rsp as any).options;
  }

  public async verifyWebAuthnAuthentication(
    username: string,
    authentication: AuthenticationCredentialJSON
  ): Promise<Result<boolean>> {
    const rsp = await this.post("/api/VerifyWebAuthnAuthentication", {
      username: username,
      authentication: authentication,
    });
    if (isError(rsp)) {
      return rsp;
    }
    return (rsp as any).verified;
  }

  public async login(user: User): Promise<Result<LoginRsp>> {
    const rsp = await this.post("/api/Login", user);
    if (isError(rsp)) {
      return rsp;
    }
    return rsp as LoginRsp;
  }

  public async logoff(): Promise<Result<void>> {
    const rsp = await this.post("/api/Logoff", null);
    if (isError(rsp)) {
      return rsp;
    }
  }

  public async createAccount(createUser: CreateUserReq): Promise<Result<void>> {
    return await this.post("/api/CreateUser", createUser);
  }

  public async check(): Promise<Result<void>> {
    return await this.get("/api/Check");
  }

  public async tryReadBatch(queries: Query[]): Promise<Result<ApiEntity[]>> {
    const rsp = await this.post("/api/tryReadBatch", queries);
    if (isError(rsp)) {
      return rsp;
    }
    return rsp as ApiEntity[];
  }

  public async writeBatch(
    entities: ApiEntity[]
  ): Promise<Result<ApiEntityRsp[]>> {
    return await this.post("/api/writeBatch", entities);
  }

  public async removeBatch(keys: string[]): Promise<Result<void>> {
    return await this.post("/api/removeBatch", keys);
  }

  // api helper functions ---------------------------------
  private async get(uri: string): Promise<Result<any>> {
    this.requestCount++;
    // console.log(`Request #${this.requestCount}: GET ${uri} ...`);
    const t = timing();
    try {
      const rsp = await withProgress(() =>
        axios.get(uri, {
          headers: { "x-api-key": this.apiKey },
          timeout: requestTimeout,
        })
      );

      const rspData = rsp.data;
      const rspBytes = ("" + rsp.request?.responseText).length;
      const text = `Request #${
        this.requestCount
      }: GET ${uri}: OK: (0->${rspBytes} bytes) ${t()}`;
      console.groupCollapsed(text);
      console.log(text);
      console.log("Response", rspData);
      console.log("#rsp", rsp);
      console.groupEnd();
      return rspData;
    } catch (e) {
      const error = this.toError(e);
      const text = `%cRequest #${this.requestCount}: GET ${uri}: ERROR: ${
        error.name
      }: ${error.message} ${t()}`;
      console.groupCollapsed(text, "color: #CD5C5C");
      console.log(text, "color: #CD5C5C");
      console.log("%cError:", "color: #CD5C5C", error);
      console.groupEnd();
      return error;
    }
  }

  async post(uri: string, requestData: any): Promise<Result<any>> {
    this.requestCount++;
    // console.log(`Request #${this.requestCount}: POST ${uri} ...`);

    const t = timing();
    try {
      const rsp = await withProgress(() =>
        axios.post(uri, requestData, {
          headers: { "x-api-key": this.apiKey },
          timeout: requestTimeout,
        })
      );
      const rspData = rsp.data;
      const reqBytes = ("" + rsp.config.data).length;
      const rspBytes = ("" + rsp.request?.responseText).length;
      const text = `Request #${
        this.requestCount
      }: POST ${uri}: OK: (${reqBytes}->${rspBytes} bytes) ${t()}`;
      console.groupCollapsed(text);
      console.log(text);
      console.log("Request:", requestData);
      console.log("Response:", rspData);
      console.groupEnd();
      return rspData;
    } catch (e) {
      const error = this.toError(e);
      const reqBytes = jsonStringify(requestData).length;
      const text = `%cRequest #${
        this.requestCount
      }: POST ${uri} (${reqBytes}->? bytes): ERROR: ${error.name}: ${
        error.message
      } ${t()}`;
      console.groupCollapsed(text, "color: #CD5C5C");
      console.log(text, "color: #CD5C5C");
      console.log("Request:", requestData);
      console.log("%cError:", "color: #CD5C5C", error);
      console.groupEnd();
      return error;
    }
  }

  private toError(rspError: any) {
    if (rspError.response) {
      // Request made and server responded
      //console.log("Failed:", rspError.response);
      const rsp = rspError.response;
      const serverError = new ServerError(
        `ServerError: Status: ${rsp.status} '${rsp.statusText}': ${rsp.data}`
      );

      if (rsp.status === 500 && rsp.data?.includes("(ECONNREFUSED)")) {
        return new LocalApiServerError(
          "LocalApiServerError: Local api server not started, Start local Azure functions server",
          serverError
        );
      } else if (rsp.status === 400) {
        if (rsp.data?.includes("ECONNREFUSED 127.0.0.1:10002")) {
          return new LocalEmulatorError(
            "LocalEmulatorError: Local storage emulator not started. Call 'AzureStorageEmulator.exe start'",
            serverError
          );
        }
        if (rsp.data?.includes("SessionError")) {
          console.log("Session error");
          return new SessionError("SessionError:", serverError);
        }
        if (
          rsp.data?.includes("The table specified does not exist") ||
          rsp.data?.includes("Invalid token") ||
          rsp.data?.includes("Invalid user") ||
          rsp.data?.includes("AuthenticateError")
        ) {
          return new AuthenticateError("AuthenticateError:", serverError);
        }
      }

      return new RequestError(
        "RequestError: Invalid or unsupported request",
        serverError
      );
    } else if (rspError.request) {
      // The request was made but no response was received
      if (rspError.code === "ECONNABORTED") {
        return new ContactTimeoutError("ContactTimeoutError:", rspError);
      }
      return new NoContactError("NoContactError:", rspError);
    }

    // Something happened in setting up the request that triggered an Error
    return new NetworkError(
      "NetworkError: Failed to send request. Request setup error",
      rspError
    );
  }
}
