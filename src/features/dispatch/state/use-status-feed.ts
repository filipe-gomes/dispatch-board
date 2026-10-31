"use client";

import { useEffect, useRef } from "react";
import { getLoadState } from "../domain/status";
import type { Driver, Load, LoadId } from "../domain/types";
import type { LogActivity } from "./use-activity-log";

/**
 * Turns time-driven status changes into activity entries, standing in for the
 * updates drivers would send from the in-cab app.
 */
export function useStatusFeed(loads: readonly Load[], drivers: readonly Driver[], now: number, log: LogActivity) {
  const previous = useRef<Map<LoadId, string> | null>(null);

  useEffect(() => {
    const names = new Map(drivers.map((driver) => [driver.id, driver.name]));
    const current = new Map<LoadId, string>();

    for (const load of loads) {
      const state = getLoadState(load, now);
      current.set(load.id, state.label);
      const before = previous.current?.get(load.id);
      if (!previous.current || before === undefined || before === state.label) continue;

      const driver = load.driverId ? names.get(load.driverId) : undefined;
      if (state.status === "in-progress")
        log({ tone: "info", message: `${driver}: ${state.label.toLowerCase()} for ${load.title}`, loadId: load.id });
      else if (state.status === "delivered")
        log({ tone: "success", message: `Delivered to ${load.title}. Customer notified.`, loadId: load.id });
      else if (state.status === "missed")
        log({ tone: "warning", message: `${load.title} started without being dispatched`, loadId: load.id });
      else if (state.status === "overdue")
        log({ tone: "warning", message: `${load.title} is overdue and still needs a driver`, loadId: load.id });
    }

    previous.current = current;
  }, [loads, drivers, now, log]);
}
