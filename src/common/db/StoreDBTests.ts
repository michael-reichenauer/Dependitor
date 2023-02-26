
import assert from "assert";
import { di } from "../di";
import { expectValue } from "../Result";
import { ILocalDBKey } from "./LocalDB";


export class StoreDBTests {
  constructor(private localDB = di(ILocalDBKey)) { }

  public Test(): void {

    // Write one entity '0' and verify that it can be read with correct key
    this.localDB.write({
      key: "0",
      etag: "1",
      syncedEtag: "",
      remoteEtag: "",
      value: "aadd",
      version: 0,
    });

    assert(expectValue(this.localDB.tryReadValue<string>("0")) === "aa");
  }

  public async TestAsync(): Promise<void> {

    // Write one entity '0' and verify that it can be read with correct key
    this.localDB.write({
      key: "0",
      etag: "1",
      syncedEtag: "",
      remoteEtag: "",
      value: "aadd",
      version: 0,
    });

    assert(expectValue(this.localDB.tryReadValue<string>("0")) === "aa");
  }
}
