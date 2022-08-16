import { di } from "./di";
import { ILocalStore, ILocalStoreKey, KeyValue } from "./LocalStore";
import Result from "./Result";

export default class LocalSubStore implements ILocalStore {
  constructor(private name: string, private localStore = di(ILocalStoreKey)) {}

  public read<T>(key: string): Result<T> {
    return this.localStore.read(this.subName(key));
  }

  public readOr<T>(key: string, defaultValue: T): T {
    return this.localStore.readOr(this.subName(key), defaultValue);
  }

  public readBatch(keys: string[]): any[] {
    return this.localStore.readBatch(this.subNames(keys));
  }

  public write(key: string, value: any): void {
    this.localStore.write(this.subName(key), value);
  }

  public writeBatch(keyValues: KeyValue[]): void {
    const values = keyValues.map((value) => ({
      key: this.subName(value.key),
      value: value.value,
    }));

    this.localStore.writeBatch(values);
  }

  public remove(key: string): void {
    this.localStore.remove(this.subName(key));
  }

  public removeBatch(keys: string[]): void {
    this.localStore.removeBatch(this.subNames(keys));
  }

  public keys(): string[] {
    return this.subKeys().map((key) => key.substring(this.name.length + 1));
  }

  public count(): number {
    return this.subKeys().length;
  }

  public clear(): void {
    this.localStore.removeBatch(this.subKeys());
  }

  private subName(key: string): string {
    return `${this.name}.${key}`;
  }

  private subNames(keys: string[]): string[] {
    return keys.map((key) => this.subName(key));
  }

  private subKeys(): string[] {
    return this.localStore
      .keys()
      .filter((key) => key.startsWith(`${this.name}.`));
  }
}
