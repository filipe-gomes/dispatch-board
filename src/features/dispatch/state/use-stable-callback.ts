"use client";

import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * A callback whose identity never changes but always runs the latest closure.
 * The timeline's items compare props deeply, so stable handlers keep a scroll
 * or tick from re-rendering every item.
 */
export function useStableCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const latest = useRef(callback);
  useInsertionEffect(() => {
    latest.current = callback;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
