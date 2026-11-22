import type { IdGenerator } from "../platform/id-generator.ts";

export function sequentialIds(prefix = "id"): IdGenerator {
  let counter = 0;
  return {
    next: () => {
      counter += 1;
      return `${prefix}-${counter}`;
    },
  };
}
