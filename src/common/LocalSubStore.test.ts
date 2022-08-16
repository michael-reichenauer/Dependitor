import LocalStore, { ILocalStore } from "./LocalStore";
import LocalSubStore from "./LocalSubStore";

describe("Test local store", () => {
  test("local store api", () => {
    const local: ILocalStore = new LocalStore();
    const sub: ILocalStore = new LocalSubStore("test");

    // Both empty at start
    expect(sub.count()).toEqual(0);
    expect(local.count()).toEqual(0);

    // Write only to local,
    local.write("a", "a-local");
    expect(sub.count()).toEqual(0);
    expect(local.count()).toEqual(1);

    // Write to sub, should be one in sub,
    sub.write("a", "a-sub");
    expect(sub.count()).toEqual(1);
    expect(sub.keys()).toEqual(["a"]);
    expect(sub.readBatch(sub.keys()).sort()).toEqual(["a-sub"].sort());

    // but two in local (total)
    expect(local.count()).toEqual(2);
    expect(local.keys().sort()).toEqual(["a", "test.a"].sort());
    expect(local.readBatch(local.keys()).sort()).toEqual(
      ["a-local", "a-sub"].sort()
    );

    // Remove sub value, local value remains
    sub.remove("a");
    expect(sub.count()).toEqual(0);
    expect(local.count()).toEqual(1);
    expect(local.readBatch(local.keys()).sort()).toEqual(["a-local"].sort());

    // Write and then clear sub, local value remains
    sub.write("a", "a-sub");
    sub.clear();
    expect(sub.count()).toEqual(0);
    expect(local.count()).toEqual(1);
    expect(local.readBatch(local.keys()).sort()).toEqual(["a-local"].sort());
  });
});
