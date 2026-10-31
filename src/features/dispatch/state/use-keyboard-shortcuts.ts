"use client";

import { useEffect } from "react";
import { useStableCallback } from "./use-stable-callback";

export type ShortcutMap = Partial<Record<string, () => void>>;

/** Leave keys alone while typing, inside popovers and menus, and where arrows move focus. */
function shouldIgnore(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  const target = event.target;
  if (!(target instanceof HTMLElement) || target === document.body) return false;
  if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;
  if (target.closest('[role="dialog"], [role="menu"], [role="listbox"]')) return true;
  return (
    event.key.startsWith("Arrow") && target.closest('[role="group"], [role="radiogroup"], [role="tablist"]') !== null
  );
}

/** Single-key shortcuts for the board, active while `enabled`. */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled: boolean) {
  const handleKeyDown = useStableCallback((event: KeyboardEvent) => {
    if (!enabled || shouldIgnore(event)) return;
    const action = shortcuts[event.key] ?? shortcuts[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    action();
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
