import Result from "./Result";
import { diKey, singleton } from "./di";

export interface LocalEntity<T> {
  key: string;
  timestamp: number;
  version: number;
  synced: number;

  value: T;
}

export const ILocalDBKey = diKey<ILocalDB>();
export interface ILocalDB {
  tryRead<T>(key: string): Result<LocalEntity<T>>;
  tryReadBatch<T>(keys: string[]): Result<LocalEntity<T>>[];
  write<T>(entity: LocalEntity<T>): void;
  writeBatch<T>(entities: LocalEntity<T>[]): void;
  remove(key: string): void;
  removeBatch(keys: string[]): void;
  keys(): string[];
  count(): number;
  clear(): void;
}

@singleton(ILocalDBKey)
export default class LocalDB implements ILocalDB {
  public tryRead<T>(key: string): Result<LocalEntity<T>> {
    return this.tryReadBatch<T>([key])[0];
  }

  public tryReadBatch<T>(keys: string[]): Result<LocalEntity<T>>[] {
    return keys.map((key: string) => {
      let entityText = localStorage.getItem(key);
      if (entityText == null) {
        return new RangeError(`No data for id: ${key}`);
      }
      // console.log(`Read key: ${key}, ${text.length} bytes`);
      const entity: any = JSON.parse(entityText);
      return entity as LocalEntity<T>;
    });
  }

  public write<T>(entity: LocalEntity<T>): void {
    this.writeBatch([entity]);
  }

  public writeBatch<T>(entities: LocalEntity<T>[]): void {
    entities.forEach((entity) => {
      const key = entity.key;
      const entityText = JSON.stringify(entity);
      localStorage.setItem(key, entityText);
      // console.log(`Wrote key: ${key}, ${text.length} bytes`);
    });
  }

  public remove(key: string): void {
    this.removeBatch([key]);
  }

  public removeBatch(keys: string[]): void {
    keys.forEach((id: string) => {
      localStorage.removeItem(id);
    });
  }

  public keys(): string[] {
    const keys: string[] = [];
    for (var i = 0, len = localStorage.length; i < len; i++) {
      const key: string = localStorage.key(i) as string;
      keys.push(key);
    }
    return keys;
  }

  public count(): number {
    return localStorage.length;
  }

  public clear(): void {
    localStorage.clear();
  }
}
