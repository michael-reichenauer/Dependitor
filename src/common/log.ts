export function logName() {
  const lines = stackLines();
  const line = lines[3].trim().split(" ");

  console.log("Function:", line[1]);
}

function stackLines(): string[] {
  const error = new Error();
  if (!error.stack) {
    return [];
  }

  return error.stack.split("\n");
}
