export interface TimerHandle {
  cancel(): void;
}

export interface Clock {
  now(): Date;
  setTimeout(callback: () => void, delayMilliseconds: number): TimerHandle;
}

export const systemClock: Clock = {
  now: () => new Date(),
  setTimeout(callback, delayMilliseconds) {
    const timer = setTimeout(callback, delayMilliseconds);
    return { cancel: () => clearTimeout(timer) };
  },
};

export function delay(clock: Clock, milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    clock.setTimeout(resolve, milliseconds);
  });
}
