import Result, { isError } from "./Result";
import { diKey, singleton } from "./di";

// ILocalStore is a convenience wrapper for the localStorage api
export const ILocalStoreKey = diKey<ILocalStore>();
export interface ILocalStore {
  read<T>(key: string): Result<T>;
  readOr<T>(key: string, defaultValue: T): T;
  readBatch(keys: string[]): Result<any>[];
  write(key: string, value: any): void;
  writeBatch(keyValues: KeyValue[]): void;
  remove(key: string): void;
  removeBatch(keys: string[]): void;
  keys(): string[];
  count(): number;
  clear(): void;
}

// KeyValue is used when writing batch of values
export interface KeyValue {
  key: string;
  value: any;
}

const noValueError = new RangeError("No value for specified key");

@singleton(ILocalStoreKey)
export default class LocalStore implements ILocalStore {
  public read<T>(key: string): Result<T> {
    return this.readBatch([key])[0] as T;
  }

  public readOr<T>(key: string, defaultValue: T): T {
    const value = this.read<T>(key);
    if (isError(value)) {
      return defaultValue;
    }

    return value;
  }

  public readBatch(keys: string[]): Result<any>[] {
    return keys.map((key: string) => {
      let valueText = localStorage.getItem(key);
      if (valueText === null) {
        return noValueError;
      }

      try {
        return JSON.parse(valueText);
      } catch {
        return noValueError;
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
