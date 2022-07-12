export default function stopwatch() {
  return new Stopwatch();
}

class Stopwatch {
  start: number;
  constructor() {
    this.start = performance.now();
  }

  time() {
    return performance.now() - this.start;
  }
}
