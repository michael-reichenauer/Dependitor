import { User } from "./Api";
import { IDataCrypt } from "./DataCrypt";
import assert from "assert";
import Result from "./Result";

const prefix = "encrypted:";

// Mocking DataCrypt with simple encryption since jest testing does not support crypt functions yet
export class DataCryptMock implements IDataCrypt {
  generateRandomString(length: number): string {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    for (var i = 0; i < length; i++)
      text += possible.charAt(Math.floor(i * possible.length));

    return text;
  }

  public async expandPassword(user: User): Promise<string> {
    return user.username + user.password;
  }

  public async generateWrappedDataEncryptionKey(user: User): Promise<string> {
    return prefix + user.username + user.password;
  }

  public async unwrapDataEncryptionKey(
    wrappedDek: string,
    user: User
  ): Promise<Result<CryptoKey>> {
    assert(
      wrappedDek.length > 0 &&
        wrappedDek === prefix + user.username + user.password
    );
    return (prefix + user.username + user.password) as any;
  }

  public async encryptText(text: string, dek: CryptoKey): Promise<string> {
    const dekText = dek as any as string;
    assert(dekText.length > 0);
    return dekText + this.reverseString(text);
  }

  public async decryptText(
    encryptedText: string,
    dek: CryptoKey
  ): Promise<string> {
    const dekText = dek as any as string;
    assert(dekText.length > 0);
    return this.reverseString(encryptedText.substring(dekText.length));
  }

  private reverseString(text: string) {
    return text.split("").reverse().join("");
  }
}
