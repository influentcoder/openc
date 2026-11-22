import { describe, expect, it } from "vitest";
import { AsyncQueue } from "./async-queue.ts";

async function drain<Item>(queue: AsyncQueue<Item>): Promise<Item[]> {
  const items: Item[] = [];
  for await (const item of queue) {
    items.push(item);
  }
  return items;
}

describe("AsyncQueue", () => {
  it("delivers buffered and later items in order, then ends when closed", async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    const drained = drain(queue);
    queue.push(2);
    queue.close();
    expect(await drained).toEqual([1, 2]);
  });

  it("rejects pushes after close", () => {
    const queue = new AsyncQueue<number>();
    queue.close();
    expect(() => queue.push(1)).toThrow("closed queue");
  });

  it("delivers buffered items, then rejects with the failure", async () => {
    const queue = new AsyncQueue<number>();
    queue.push(1);
    queue.fail(new Error("process crashed"));
    const iterator = queue[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: 1, done: false });
    await expect(iterator.next()).rejects.toThrow("process crashed");
  });

  it("rejects a consumer that is already waiting when the queue fails", async () => {
    const queue = new AsyncQueue<number>();
    const pending = queue[Symbol.asyncIterator]().next();
    queue.fail(new Error("process crashed"));
    await expect(pending).rejects.toThrow("process crashed");
  });
});
