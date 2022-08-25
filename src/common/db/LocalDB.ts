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

const removedKey = "removedKeys"; // Key to store removed entities that are not yet synced upp
const unsyncedKey = "unsyncedKeys"; // Key to store unsynced entities that are not yet synced upp
const defaultUserName = "";
const prefix = "db.";
const defaultName = prefix + defaultUserName; // key prefix for local db entities for default user
const metaPrefixX = "dbm.";
const defaultMetaName = metaPrefixX + defaultUserName; // key prefix for local db entities for default user

@singleton(ILocalDBKey)
export class LocalDB implements ILocalDB {
  private entitiesStore: LocalSubStore;
  private metaStore: LocalSubStore;

  constructor(
    readonly localStore = di(ILocalStoreKey),
    readonly keyVault = di(IKeyVaultKey)
  ) {
    this.entitiesStore = new LocalSubStore(defaultName, localStore);
    this.metaStore = new LocalSubStore(defaultMetaName, localStore);
  }

  setUsername(name: string): void {
    this.entitiesStore = new LocalSubStore(prefix + name, this.localStore);
    this.metaStore = new LocalSubStore(metaPrefixX + name, this.localStore);
  }

  public tryReadValue<T>(key: string): Result<T> {
    const entity = this.tryReadBatch([key])[0];
    if (isError(entity)) {
      return entity;
    }

    return entity.value;
  }

  public tryReadBatch(keys: string[]): Result<LocalEntity>[] {
    return this.entitiesStore.readBatch(keys);
  }

  public write(entity: LocalEntity): void {
    this.writeBatch([entity]);
  }

  public writeBatch(entities: LocalEntity[]): void {
    const localEntities = entities.map((entity) => ({
      key: entity.key,
      value: entity,
    }));
    this.entitiesStore.writeBatch(localEntities);

    this.updateUnsyncedKeys(entities);
  }

  // Called when removing local entities. Call confirmRemoved after sync
  public preRemoveBatch(keys: string[]): void {
    this.entitiesStore.removeBatch(keys);

    // Store removed keys until confirmRemoved is called (after syncing)
    const removedKeys = this.getRemovedKeys();
    const newRemovedKeys = keys.filter((key) => !removedKeys.includes(key));
    if (newRemovedKeys.length === 0) {
      return;
    }

    removedKeys.push(...newRemovedKeys);
    this.metaStore.write(removedKey, removedKeys);
  }

  // Called after sync when remote server also has removed the keys
  public confirmRemoved(keys: string[]): void {
    // remove confirmed keys from list of removed keys
    const removedKeys = this.getRemovedKeys().filter(
      (key) => !keys.includes(key)
    );
    this.metaStore.write(removedKey, removedKeys);
  }

  // Remove entities without supporting sync with remote by marking them as removed
  public forceRemoveBatch(keys: string[]): void {
    this.entitiesStore.removeBatch(keys);
  }

  public getUnsyncedKeys(): string[] {
    return this.metaStore.readOr<string[]>(unsyncedKey, []);
  }

  public getAllEntities(): LocalEntity[] {
    return this.entitiesStore.readBatch(this.entitiesStore.keys());
  }

  public getRemovedKeys(): string[] {
    return this.metaStore.readOr<string[]>(removedKey, []);
  }

  public clear(): void {
    this.entitiesStore.clear();
    this.metaStore.clear();
  }

  // updates the meta.unsynced keys list with unsynced entities
  private updateUnsyncedKeys(entities: LocalEntity[]): void {
    let unsyncedKeys = this.getUnsyncedKeys();

    entities.forEach((entity) => {
      const key = entity.key;

      if (this.isUnsynced(entity)) {
        // Entity unsynced, add to unsynced if needed
        if (!unsyncedKeys.includes(key)) {
          unsyncedKeys.push(key);
        }
      } else {
        // Entity synced, remove from unsynced if needed
        const index = unsyncedKeys.indexOf(key);
        if (index > -1) {
          unsyncedKeys.splice(index, 1);
        }
      }
    });

    this.metaStore.write(unsyncedKey, unsyncedKeys);
  }

  private isUnsynced(entity: LocalEntity): boolean {
    return entity.etag !== entity.syncedEtag;
  }
}
