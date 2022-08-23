import Result, { isError } from "../Result";
import { di, diKey, singleton } from "../di";
import LocalSubStore from "../LocalSubStore";
import { ILocalStoreKey } from "../LocalStore";
import { IKeyVaultKey } from "../keyVault";

// The local db interface, which is used by StoreDB to sync between local and remote
export const ILocalDBKey = diKey<ILocalDB>();
export interface ILocalDB {
  setUsername(name: string): void;
  tryReadValue<T>(key: string): Result<T>;
  tryReadBatch(keys: string[]): Result<LocalEntity>[];
  write(entity: LocalEntity): void;
  writeBatch(entities: LocalEntity[]): void;
  preRemoveBatch(keys: string[]): void; // Called when local entity removed, call confirmRemoved after sync
  confirmRemoved(keys: string[]): void; // Called after sync of removed entities
  forceRemoveBatch(keys: string[]): void; // Called when local items just should be removed.
  getUnsyncedKeys(): string[]; // Get all entity keys that need sync (etag!=syncedEtag)
  getAllEntities(): LocalEntity[];
  getRemovedKeys(): string[]; // Get all removed entity keys, which have not yet been confirmed
  clear(): void;
}

// LocalEntity is the entity stored in the local device store and corresponds
// to the RemoteEntity, which is stored in a remote cloud server and synced
export interface LocalEntity {
  key: string; // Entity key (same local as remote)
  etag: string; // local etag set when updating local entity
  syncedEtag: string; // local entity when last sync was done, sync is needed if not same as etag
  remoteEtag: string; // remote server etag when last sync was done.

  value: any;
  version: number;
}

const metaPrefix = "__"; // Prefix for meta keys like e.g. removed keys
const removedKey = metaPrefix + "removedKeys"; // Key to store removed entities that are not yet synced upp
const defaultUserName = "";
const prefix = "db.";
const defaultName = prefix + defaultUserName; // key prefix for local db entities for default user

@singleton(ILocalDBKey)
export class LocalDB implements ILocalDB {
  private subStore: LocalSubStore;

  constructor(
    readonly localStore = di(ILocalStoreKey),
    readonly keyVault = di(IKeyVaultKey)
  ) {
    this.subStore = new LocalSubStore(defaultName, localStore);
  }

  setUsername(name: string): void {
    this.subStore = new LocalSubStore(prefix + name, this.localStore);
  }

  public tryReadValue<T>(key: string): Result<T> {
    const entity = this.tryReadBatch([key])[0];
    if (isError(entity)) {
      return entity;
    }

    return entity.value;
  }

  public tryReadBatch(keys: string[]): Result<LocalEntity>[] {
    return this.subStore.readBatch(keys);
  }

  public write(entity: LocalEntity): void {
    this.writeBatch([entity]);
  }

  public writeBatch(entities: LocalEntity[]): void {
    const localEntities = entities.map((entity) => ({
      key: entity.key,
      value: entity,
    }));
    this.subStore.writeBatch(localEntities);

    // Ensure possible previously removed keys are no longer considered removed
    const keys = entities.map((entity) => entity.key);
    this.confirmRemoved(keys);
  }

  // Called when removing local entities. Call confirmRemoved after sync
  public preRemoveBatch(keys: string[]): void {
    this.subStore.removeBatch(keys);

    // Store removed keys until confirmRemoved is called (after syncing)
    const removedKeys = this.getRemovedKeys();
    const newRemovedKeys = keys.filter((key) => !removedKeys.includes(key));
    if (newRemovedKeys.length === 0) {
      return;
    }
    removedKeys.push(...newRemovedKeys);
    this.subStore.write(removedKey, removedKeys);
  }

  // Called after sync when remote server also has removed the keys
  public confirmRemoved(keys: string[]): void {
    let removedKeys = this.getRemovedKeys();
    removedKeys = removedKeys.filter((key) => !keys.includes(key));
    this.subStore.write(removedKey, removedKeys);
  }

  public forceRemoveBatch(keys: string[]): void {
    this.subStore.removeBatch(keys);
  }

  public getUnsyncedKeys(): string[] {
    const unSyncedKeys = this.getAllEntities()
      .filter((entity) => entity.etag !== entity.syncedEtag)
      .map((entity: LocalEntity) => entity.key);
    return unSyncedKeys;
  }

  public getAllEntities(): LocalEntity[] {
    return this.subStore.readBatch(this.entityKeys());
  }

  public getRemovedKeys(): string[] {
    return this.subStore.readOr<string[]>(removedKey, []);
  }

  public clear(): void {
    this.subStore.clear();
  }

  private entityKeys(): string[] {
    return this.subStore.keys().filter((key) => !key.startsWith(metaPrefix));
  }
}
