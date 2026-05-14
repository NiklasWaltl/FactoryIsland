import { useEffect, useState } from "react";

/**
 * Returns a periodically refreshed `Date.now()` snapshot stored in state.
 *
 * Why: React Compiler requires render purity — components must not call
 * `Date.now()` inside the render body. This hook reads the current time
 * once in a `useState` initializer (which runs at mount, outside the
 * render evaluation) and then updates the state via `setInterval`, so
 * the visible component output depends only on state, not on a live
 * impure clock read.
 *
 * @param intervalMs Tick interval for refreshing the snapshot.
 * @param enabled    When false, the interval is not registered and the
 *                   value stays at its last snapshot.
 */
export function useNowMs(intervalMs: number, enabled: boolean = true): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);

  return now;
}
