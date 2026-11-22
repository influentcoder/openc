import type { Clock, TimerHandle } from "../platform/clock.ts";

interface ScheduledTimer {
  dueAt: number;
  order: number;
  callback: () => void;
  cancelled: boolean;
}

export class FakeClock implements Clock {
  private currentTime: number;
  private timers: ScheduledTimer[] = [];
  private scheduledCount = 0;

  constructor(start = new Date("2026-01-01T00:00:00.000Z")) {
    this.currentTime = start.getTime();
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  setTimeout(callback: () => void, delayMilliseconds: number): TimerHandle {
    const timer: ScheduledTimer = {
      dueAt: this.currentTime + delayMilliseconds,
      order: this.scheduledCount++,
      callback,
      cancelled: false,
    };
    this.timers.push(timer);
    return {
      cancel: () => {
        timer.cancelled = true;
      },
    };
  }

  get pendingTimerCount(): number {
    return this.timers.filter((timer) => !timer.cancelled).length;
  }

  async advanceBy(milliseconds: number): Promise<void> {
    const target = this.currentTime + milliseconds;
    for (let timer = this.nextDueTimer(target); timer; timer = this.nextDueTimer(target)) {
      this.currentTime = timer.dueAt;
      this.timers = this.timers.filter((candidate) => candidate !== timer);
      timer.callback();
      await settle();
    }
    this.currentTime = target;
  }

  private nextDueTimer(target: number): ScheduledTimer | undefined {
    return this.timers
      .filter((timer) => !timer.cancelled && timer.dueAt <= target)
      .sort((first, second) => first.dueAt - second.dueAt || first.order - second.order)[0];
  }
}

export async function settle(rounds = 20): Promise<void> {
  for (let round = 0; round < rounds; round++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

export async function settleUntil(condition: () => boolean, maximumRounds = 2000): Promise<void> {
  for (let round = 0; round < maximumRounds; round++) {
    if (condition()) {
      return;
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error("Condition was not met before settling finished");
}
