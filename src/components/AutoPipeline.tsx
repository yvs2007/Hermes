"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Invisible component that drives the auto-pipeline timer.
 * Mounted once in the root layout. Polls /api/auto-pipeline settings on mount,
 * then fires POST /api/auto-pipeline at the configured interval.
 *
 * Also runs one cycle immediately on mount if enabled (to catch up after
 * the app was closed).
 */
export function AutoPipeline() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const runCycle = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      await fetch("/api/auto-pipeline", { method: "POST" });
    } catch {
      // Network error — will retry on next interval
    }
  }, []);

  // Fetch config and start timer
  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function init() {
      try {
        const res = await fetch("/api/auto-pipeline");
        const data = await res.json();
        if (!mountedRef.current) return;

        const enabled = data.enabled ?? false;
        const intervalMinutes = data.intervalMinutes ?? 5;

        if (!enabled) return;

        // Run immediately on mount to catch up
        runCycle();

        // Then set interval
        timer = setInterval(runCycle, intervalMinutes * 60 * 1000);
        timerRef.current = timer;
      } catch {
        // Settings not available yet — no-op
      }
    }

    init();

    return () => {
      mountedRef.current = false;
      if (timer) clearInterval(timer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [runCycle]);

  // This component renders nothing visible — it's purely a side-effect driver.
  // The settings page controls enable/disable and shows status.
  return null;
}
