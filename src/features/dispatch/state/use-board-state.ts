"use client";

import { useEffect, useReducer, useRef } from "react";
import { createSeedState } from "../data/seed";
import { boardReducer } from "./board-reducer";
import { readBoardState, subscribeToOtherTabs, writeBoardState } from "./persistence";

/** Board state persisted to localStorage and kept in sync across open tabs. */
export function useBoardState() {
  const [state, dispatch] = useReducer(boardReducer, undefined, () => readBoardState() ?? createSeedState(Date.now()));
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    const json = JSON.stringify(state);
    if (json === lastWritten.current) return;
    lastWritten.current = json;
    writeBoardState(json);
  }, [state]);

  useEffect(
    () =>
      subscribeToOtherTabs((next, json) => {
        // Remember the incoming snapshot so we don't echo it straight back to storage.
        lastWritten.current = json;
        dispatch({ type: "boardReplaced", state: next });
      }),
    []
  );

  return [state, dispatch] as const;
}
