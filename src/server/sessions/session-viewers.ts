import type { SessionId } from "../../shared/ids.ts";

export class SessionViewers {
  private readonly viewerCounts = new Map<SessionId, number>();

  add(sessionId: SessionId): void {
    this.viewerCounts.set(sessionId, (this.viewerCounts.get(sessionId) ?? 0) + 1);
  }

  remove(sessionId: SessionId): void {
    const remaining = (this.viewerCounts.get(sessionId) ?? 0) - 1;
    if (remaining > 0) {
      this.viewerCounts.set(sessionId, remaining);
    } else {
      this.viewerCounts.delete(sessionId);
    }
  }

  isViewed(sessionId: SessionId): boolean {
    return this.viewerCounts.has(sessionId);
  }
}
