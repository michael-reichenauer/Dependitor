import Result, { orDefault } from "./Result";
import { diKey, singleton } from "./di";

export interface KeyValue {
  key: string;
  value: any;
}

export const ILocalStoreKey = diKey<ILocalStore>();
export interface ILocalStore {
  tryRead<T>(key: string): Result<T>;
  readOrDefault<T>(key: string, defaultValue: T): T;
  tryReadBatch(keys: string[]): Result<any>[];
  write(key: string, value: any): void;
  writeBatch(keyValues: KeyValue[]): void;
  remove(key: string): void;
  removeBatch(keys: string[]): void;
  keys(): string[];
  count(): number;
  clear(): void;
}

const noValueError = new RangeError("No value for specified key");

@singleton(ILocalStoreKey)
export default class LocalStore implements ILocalStore {
  public tryRead<T>(key: string): Result<T> {
    return this.tryReadBatch([key])[0] as T;
  }

  public readOrDefault<T>(key: string, defaultValue: T): T {
    return orDefault(this.tryRead(key), defaultValue);
  }

  public tryReadBatch(keys: string[]): Result<any>[] {
    return keys.map((key: string) => {
      let valueText = localStorage.getItem(key);
      if (valueText == null) {
        return noValueError;
      }
      // console.log(`Read key: ${key}, ${text.length} bytes`);
      try {
        return JSON.parse(valueText);
      } catch {
        return {};
      }
    });
  }

  public write(key: string, value: any): void {
    this.writeBatch([{ key: key, value: value }]);
  }

  public writeBatch(keyValues: KeyValue[]): void {
    keyValues.forEach((keyValue) => {
      const key = keyValue.key;
      const valueText = JSON.stringify(keyValue.value);
      localStorage.setItem(key, valueText);
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
