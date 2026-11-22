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
});
