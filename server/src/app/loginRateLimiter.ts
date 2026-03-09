import type { Request } from "express";

interface LoginRateLimitState {
  count: number;
  windowStartAtMs: number;
}

const DEFAULT_MAX_TRACKED_KEYS = 10000;

export class LoginRateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly maxTrackedKeys: number;
  private readonly state = new Map<string, LoginRateLimitState>();

  constructor({
    maxAttempts,
    windowMs,
    maxTrackedKeys = DEFAULT_MAX_TRACKED_KEYS
  }: {
    maxAttempts: number;
    windowMs: number;
    maxTrackedKeys?: number;
  }) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.maxTrackedKeys = maxTrackedKeys;
  }

  getKey(req: Request): string {
    return req.ip || req.socket.remoteAddress || "unknown";
  }

  isLimited(key: string, nowMs: number): boolean {
    this.clearExpired(key, nowMs);
    const existing = this.state.get(key);
    if (!existing) {
      return false;
    }

    return existing.count >= this.maxAttempts;
  }

  registerFailure(key: string, nowMs: number): void {
    this.clearExpired(key, nowMs);
    const existing = this.state.get(key);

    if (!existing) {
      this.state.set(key, {
        count: 1,
        windowStartAtMs: nowMs
      });
      this.evictIfOverLimit(nowMs);
      return;
    }

    this.state.set(key, {
      count: existing.count + 1,
      windowStartAtMs: existing.windowStartAtMs
    });

    this.evictIfOverLimit(nowMs);
  }

  clear(key: string): void {
    this.state.delete(key);
  }

  private clearExpired(key: string, nowMs: number): void {
    const existing = this.state.get(key);
    if (!existing) {
      return;
    }

    if (nowMs - existing.windowStartAtMs >= this.windowMs) {
      this.state.delete(key);
    }
  }

  private evictIfOverLimit(nowMs: number): void {
    if (this.state.size <= this.maxTrackedKeys) {
      return;
    }

    // First pass: remove expired buckets across the map.
    for (const [key, bucket] of this.state.entries()) {
      if (nowMs - bucket.windowStartAtMs >= this.windowMs) {
        this.state.delete(key);
      }
    }

    if (this.state.size <= this.maxTrackedKeys) {
      return;
    }

    // Second pass: evict oldest buckets if still over capacity.
    const overflow = this.state.size - this.maxTrackedKeys;
    const oldestFirst = [...this.state.entries()].sort(
      (a, b) => a[1].windowStartAtMs - b[1].windowStartAtMs
    );

    for (let index = 0; index < overflow; index += 1) {
      const item = oldestFirst[index];
      if (item) {
        this.state.delete(item[0]);
      }
    }
  }
}
