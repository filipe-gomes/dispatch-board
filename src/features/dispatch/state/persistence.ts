import type { BoardState } from "./board-reducer";

const STORAGE_KEY = "dispatch-board:v1";

function parse(json: string | null): BoardState | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Partial<BoardState>;
    const valid =
      value.version === 1 &&
      Array.isArray(value.loads) &&
      Array.isArray(value.drivers) &&
      Array.isArray(value.terminals) &&
      typeof value.defaults === "object";
    return valid ? (value as BoardState) : null;
  } catch {
    return null;
  }
}

export function readBoardState(): BoardState | null {
  try {
    return parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can be unavailable (privacy modes, blocked cookies); fall back to fresh data.
    return null;
  }
}

export function writeBoardState(json: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Quota or privacy errors: the board keeps working in memory.
  }
}

/** Fires when another tab saves the board, which keeps every open tab in sync. */
export function subscribeToOtherTabs(onChange: (state: BoardState, json: string) => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || event.newValue === null) return;
    const next = parse(event.newValue);
    if (next) onChange(next, event.newValue);
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}
