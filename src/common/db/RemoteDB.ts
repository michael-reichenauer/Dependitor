import { di, diKey, singleton } from "../di";
import Result, { isError } from "../Result";
import { CustomError, NotFoundError } from "../CustomError";
import { ApiEntity, IApi, IApiKey, Query } from "../Api";
import { IKeyVault, IKeyVaultKey } from "../keyVault";
import { withNoProgress } from "../Progress";

// IRemoteDB supports reading and writing to the remote server db
// Data is encrypted before sending and decrypted on receive
export const IRemoteDBKey = diKey<IRemoteDB>();
export interface IRemoteDB {
  tryReadBatch(queries: Query[]): Promise<Result<Result<RemoteEntity>[]>>;
  writeBatch(entities: RemoteEntity[]): Promise<Result<RemoteEntityRsp[]>>;
  removeBatch(keys: string[]): Promise<Result<void>>;
}

export interface RemoteEntity {
  key: string;
  etag: string;
  localEtag: string;

  value: any;
  version: number;
}

export interface RemoteEntityRsp {
  key: string;
  status?: string;
  etag?: string;
}

export class NotModifiedError extends CustomError {}

// const noValueError = new RangeError("No value for key");
const notModifiedError = new NotModifiedError("NotModifiedError:");

@singleton(IRemoteDBKey)
export class RemoteDB implements IRemoteDB {
  constructor(
    private api: IApi = di(IApiKey),
    private keyVault: IKeyVault = di(IKeyVaultKey)
  ) {}

  public async tryReadBatch(
    queries: Query[]
  ): Promise<Result<Result<RemoteEntity>[]>> {
    const apiEntities = await withNoProgress(() =>
      this.api.tryReadBatch(queries)
    );
    if (isError(apiEntities)) {
      return apiEntities;
    }

    return this.toDownloadedRemoteEntities(queries, apiEntities);
  }

  public async writeBatch(
    entities: RemoteEntity[]
  ): Promise<Result<RemoteEntityRsp[]>> {
    const apiEntities = await this.toUploadingApiEntities(entities);

    return await withNoProgress(() => this.api.writeBatch(apiEntities));
  }

  public async removeBatch(keys: string[]): Promise<Result<void>> {
    return await this.api.removeBatch(keys);
  }

  private async toDownloadedRemoteEntities(
    queries: Query[],
    apiEntities: ApiEntity[]
  ): Promise<Result<RemoteEntity>[]> {
    return Promise.all(
      queries.map(async (query) => {
        const entity = apiEntities.find((e) => e.key === query.key);
        // console.log("api entity from server", entity);
        if (!entity) {
          // The entity was never returned from remote server
          return new NotFoundError(entity);
        }
        if (!entity.key || !entity.etag) {
          // The entity did not have expected properties
          return new NotFoundError();
        }
        if (entity.status === "noValue") {
          return new NotFoundError();
        }
        if (entity.status === "notModified") {
          return notModifiedError;
        }

        // Decrypt downloaded value
        const decryptedValue = await this.decryptValue(entity.value);
        if (isError(decryptedValue)) {
          return decryptedValue;
        }

        const value = decryptedValue as any;
        return {
          key: entity.key,
          etag: entity.etag ?? "",
          localEtag: "",
          value: value.value,
          version: value.version ?? 0,
        };
      })
    );
  }

  private async toUploadingApiEntities(
    remoteEntities: RemoteEntity[]
  ): Promise<ApiEntity[]> {
    return Promise.all(
      remoteEntities.map(async (entity) => {
        // Encrypt value before uploading
        const value = { value: entity.value, version: entity.version };
        const encryptedValue = await this.encryptValue(value);

        return {
          key: entity.key,
          etag: entity.etag,
          value: encryptedValue,
        };
      })
    );
  }

  private async encryptValue(value: any): Promise<any> {
    try {
      const valueText = JSON.stringify(value);
      const encryptedValue = await this.keyVault.encryptString(valueText);
      return encryptedValue;
    } catch (error) {
      console.log("error", error);
      throw error;
    }
  }

  private async decryptValue(encryptedValue: any): Promise<Result<any>> {
    try {
      const valueText = await this.keyVault.decryptString(encryptedValue);
      if (isError(valueText)) {
        return valueText;
      }
      const value = JSON.parse(valueText);
      return value;
    } catch (error) {
      console.log("error", error);
      throw error;
    }
  }
}
