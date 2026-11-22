export class AsyncQueue<Item> implements AsyncIterable<Item> {
  private readonly buffered: Item[] = [];
  private readonly waiting: {
    resolve: (result: IteratorResult<Item>) => void;
    reject: (error: Error) => void;
  }[] = [];
  private closed = false;
  private failure: Error | null = null;

  push(item: Item): void {
    if (this.closed) {
      throw new Error("Cannot push to a closed queue");
    }
    const waiter = this.waiting.shift();
    if (waiter) {
      waiter.resolve({ value: item, done: false });
      return;
    }
    this.buffered.push(item);
  }

  close(): void {
    this.closed = true;
    for (const waiter of this.waiting.splice(0)) {
      waiter.resolve({ value: undefined, done: true });
    }
  }

  fail(error: Error): void {
    this.closed = true;
    this.failure = error;
    for (const waiter of this.waiting.splice(0)) {
      waiter.reject(error);
    }
  }

  get isClosed(): boolean {
    return this.closed;
  }

  [Symbol.asyncIterator](): AsyncIterator<Item> {
    return { next: () => this.nextResult() };
  }

  private nextResult(): Promise<IteratorResult<Item>> {
    const item = this.buffered.shift();
    if (item !== undefined) {
      return Promise.resolve({ value: item, done: false });
    }
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    if (this.closed) {
      return Promise.resolve({ value: undefined, done: true });
    }
    return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }));
  }
}
