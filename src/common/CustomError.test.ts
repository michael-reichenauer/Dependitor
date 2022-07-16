import { CustomError } from "./CustomError";
import Result, { orDefault } from "./Result";

export class SpecialError extends CustomError {}
export class OtherError extends CustomError {}

function getValue(key: string): Result<string> {
  const otherError = new OtherError("Some other error");
  if (key !== "ok") {
    return new SpecialError("Some special error", otherError);
  }
  return "ok";
}

describe("Test", () => {
  test("Test", () => {
    const value: string = orDefault(getValue("ok"), "some");
    expect(value).toEqual("ok");
  });
});
