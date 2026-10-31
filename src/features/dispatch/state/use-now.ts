"use client";

import { useEffect, useState } from "react";

/** The current time, refreshed on an interval and whenever the tab becomes visible again. */
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);

  return now;
}
