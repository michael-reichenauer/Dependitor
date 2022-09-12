import {
  base64ToString,
  jsonParse,
  jsonStringify,
  stringFormat,
  stringToBase64,
} from "./text";

describe("Test text utilities functions", () => {
  test("json", () => {
    const obj = { name: "name", count: 7, isOk: true };

    expect(jsonStringify(obj)).toEqual(JSON.stringify(obj));

    const objJson = jsonStringify(obj);
    const obj2 = jsonParse(objJson);

    expect(jsonStringify(obj2)).toEqual(JSON.stringify(obj));
  });

  test("base64", () => {
    const obj = { name: "name", count: 7, isOk: true };
    const base64 = stringToBase64(jsonStringify(obj));
    expect(base64).not.toEqual(JSON.stringify(obj));

    expect(base64ToString(base64)).toEqual(JSON.stringify(obj));
  });

  test("StringFormat", () => {
    expect(stringFormat("hej {0} and {1}", "name", 8)).toEqual(
      "hej name and 8"
    );
  });
});
