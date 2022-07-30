import assert from "assert";
import Result, { isError, orDefault } from "./Result";

// Function, which returns a Result<T>, which is either ok result value (type string) or an Error type result
// Since return value is a Result<T, E=Error> type
function getValue(key: string): Result<string> {
  if (key !== "ok") {
    return new RangeError("invalid");
  }
  return "ok";
}

describe("Test Result<T> type using isError(value) type guard for narrowing", () => {
  test("ok return value", () => {
    const value = getValue("ok");
    expect(isError(value)).toEqual(false);

    if (isError(value)) {
      // Since value is ok, this path will not occur.
      // But isError() is type guard for narrowing and ensures value is a string type after if statement
      return;
    }

    // value is expected typ string, i.e. toUpperCase() works
    const stringValue: string = value;
    expect(stringValue.toUpperCase()).toEqual("OK");
  });

  test("error return value", () => {
    const value = getValue("error");
    expect(isError(value)).toEqual(true);

    if (!isError(value)) {
      // Since value is error, this path will not occur.
      // But isError() is type guard for narrowing and ensures value is a Error type after if statement
      return;
    }

    // Value is of Error type, thus value.message is accessible
    expect(value.message).toEqual("invalid");
  });
});

describe("Test orDefault(value) for Result<T> value", () => {
  test("using orDefault(value) for ok return value", () => {
    // Using orDefault to force value to be expected type or default value
    const value: string = orDefault(getValue("ok"), "some");
    expect(value).toEqual("ok");
  });

  test("using orDefault(value) for error return value", () => {
    // Using orDefault to force value to be expected type or default value
    const value: string = orDefault(getValue("error"), "some");
    expect(value).toBe("some");
  });
});

describe("Test Result<T> type using instanceof operator(value) for narrowing", () => {
  test("ok return value determined with instanceof operator", () => {
    const value = getValue("ok");
    expect(value instanceof Error).toEqual(false);
    expect(isError(value)).toEqual(false);

    if (isError(value)) {
      // Since value is ok, this path will not occur.
      // But isError() is type guard for narrowing and ensures value is a string type after if statement
      return;
    }

    // value is expected typ string, i.e. toUpperCase() works
    const stringValue: string = value;
    expect(stringValue.toUpperCase()).toEqual("OK");
  });

  test("error return value determined instanceof", () => {
    // Getting error return RangeError type
    const value = getValue("error");
    expect(value instanceof RangeError).toEqual(true);
    expect(value instanceof Error).toEqual(true);
    expect(isError(value)).toEqual(true);

    if (!isError(value)) {
      // Since value is error, this path will not occur.
      // But isError() is type guard for narrowing and ensures value is a Error type after if statement
      // Value is an Error type (i.e. message exists), verify and exit function
      return;
    }

    expect(value.message).toEqual("invalid");
  });
});

describe("Test isError() with specific error type for narrowing", () => {
  test("isError()", () => {
    const value = getValue("error");

    // Verify that value isError, Error and RangeError, but not a URIError
    expect(isError(value)).toEqual(true);
    expect(isError(value, Error)).toEqual(true);
    expect(isError(value, RangeError)).toEqual(true);
    expect(isError(value, URIError)).toEqual(false);
  });

  test("isError() with isError() for narrowing", () => {
    const value = getValue("error");
    expect(value instanceof RangeError).toEqual(true);

    if (isError(value, URIError)) {
      // This path will not occur, assert.fail() if it does
      if (value.message !== "invalid") {
        assert.fail();
      }
      assert.fail();
      return;
    }

    if (isError(value, RangeError)) {
      // This is the expected path, ensure that value now is of Error type
      if (value.message !== "invalid") {
        assert.fail();
      }
      return;
    }

    if (isError(value)) {
      // This path will not occur, assert.fail() if it does
      if (value.message !== "invalid") {
        assert.fail();
      }
      assert.fail();
      return;
    }

    if (value) {
      // This path will not occur, assert.fail() if it does
      assert.fail();
    }

    // This path will not occur, assert.fail() if it does,
    // but make sure the isError() narrowing works and value would be a string at this point
    const stringValue: string = value;
    expect(stringValue.toUpperCase()).toEqual("OK");
  });
});
