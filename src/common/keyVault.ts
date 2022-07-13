import { User } from "./Api";
import { IDataCrypt, IDataCryptKey } from "./DataCrypt";
import { di, diKey, singleton } from "./di";

export const IKeyVaultKey = diKey<IKeyVault>();
export interface IKeyVault {
  hasDataEncryptionKey(): boolean;
  encryptString(value: string): Promise<string>;
  decryptString(encryptedValue: string): Promise<string>;
  getWrappedDataEncryptionKey(user: User): Promise<string>;
}

export const IKeyVaultConfigureKey = diKey<IKeyVaultConfigure>();
export interface IKeyVaultConfigure extends IKeyVault {
  setDataEncryptionKey(dek: CryptoKey): void;
  clearDataEncryptionKey(): void;
}

@singleton(IKeyVaultKey, IKeyVaultConfigureKey)
export class KeyVault implements IKeyVault, IKeyVaultConfigure {
  private dek: any;

  constructor(private dataCrypt: IDataCrypt = di(IDataCryptKey)) {}

  public hasDataEncryptionKey(): boolean {
    if (this.dek) {
      return true;
    }
    return false;
  }

  public async encryptString(value: string): Promise<string> {
    return await this.dataCrypt.encryptText(value, this.dek);
  }

  public async decryptString(encryptedValue: string): Promise<string> {
    return await this.dataCrypt.decryptText(encryptedValue, this.dek);
  }

  public async getWrappedDataEncryptionKey(user: User): Promise<string> {
    return await this.dataCrypt.wrapDataEncryptionKey(this.dek, user);
  }

  public setDataEncryptionKey(dek: CryptoKey): void {
    this.dek = dek;
  }

  public clearDataEncryptionKey(): void {
    this.dek = null;
  }
}
