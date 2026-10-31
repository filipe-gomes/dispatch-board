"use client";

import { useCallback, useState } from "react";
import type { LoadId } from "../domain/types";

export type ActivityTone = "info" | "success" | "warning";

export interface ActivityEntry {
  id: string;
  at: number;
  tone: ActivityTone;
  message: string;
  loadId?: LoadId;
}

export type LogActivity = (entry: Omit<ActivityEntry, "id" | "at">) => void;

/** In-memory feed of what happened this session: dispatcher actions plus live driver updates. */
export function useActivityLog(limit = 40) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  const log = useCallback<LogActivity>(
    (entry) =>
      setEntries((current) => [{ ...entry, id: crypto.randomUUID(), at: Date.now() }, ...current].slice(0, limit)),
    [limit]
  );

  return { entries, log };
}
