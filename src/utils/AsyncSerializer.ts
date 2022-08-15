export class AsyncSerializer {
  private queue: any = Promise.resolve();

  public serialize<T>(fn: () => Promise<T>): Promise<T> {
    this.queue = this.queue.then(() => fn());
    return this.queue;
  }
}
