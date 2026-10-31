"use client";

import { type Dispatch, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { createSeedState } from "../data/seed";
import { formatGallons, formatWindow } from "../domain/format";
import { isLocked, type LoadErrors, primaryError, validateLoad } from "../domain/rules";
import { buildScheduleIndex, findConflict, suggestAssignment } from "../domain/schedule";
import { getLoadState, resolveSupply } from "../domain/status";
import { nextBookableStart } from "../domain/time";
import { type DriverId, type Load, type LoadId, type LoadInput, type TerminalId, toLoadInput } from "../domain/types";
import type { BoardAction, BoardState, SupplyDefaults } from "./board-reducer";
import type { LogActivity } from "./use-activity-log";

/** How long undo stays on offer after a change. */
const UNDO_WINDOW = 8_000;

export type CommandResult = { ok: true; load: Load } | { ok: false; errors: LoadErrors };

interface SaveOptions {
  original?: Load;
  /** Send the load to the driver's app as part of this save. */
  dispatchNow?: boolean;
}

/**
 * Every change to a load goes through here, whether it comes from the form,
 * a drag on the timeline, a resize, a drop from the queue or an alert. That
 * keeps the business rules in one place and the reducer free of them.
 */
export function useLoadCommands(state: BoardState, dispatch: Dispatch<BoardAction>, log: LogActivity) {
  const drivers = useMemo(() => new Map(state.drivers.map((driver) => [driver.id, driver])), [state.drivers]);
  const terminals = useMemo(
    () => new Map(state.terminals.map((terminal) => [terminal.id, terminal])),
    [state.terminals]
  );
  const loadsById = useMemo(() => new Map(state.loads.map((load) => [load.id, load])), [state.loads]);
  const schedules = useMemo(() => buildScheduleIndex(state.loads), [state.loads]);

  const driverName = useCallback(
    (id: DriverId | null) => (id === null ? "the unassigned queue" : (drivers.get(id)?.name ?? "Unknown driver")),
    [drivers]
  );

  const validate = useCallback(
    (input: LoadInput, original?: Load) => validateLoad(input, { now: Date.now(), drivers, schedules, original }),
    [drivers, schedules]
  );

  /** Puts a snapshot back (undo), as long as its slot is still free. */
  const restoreLoad = useCallback(
    (snapshot: Load) => {
      const conflict = snapshot.driverId && findConflict(schedules.get(snapshot.driverId), snapshot, snapshot.id);
      if (conflict) {
        toast.warning("Couldn't undo", {
          description: `${driverName(snapshot.driverId)} now has “${conflict.title}” at that time.`,
        });
        return;
      }
      dispatch({ type: "loadSaved", load: { ...snapshot, updatedAt: Date.now() } });
      log({ tone: "info", message: `Restored ${snapshot.title}`, loadId: snapshot.id });
    },
    [dispatch, driverName, log, schedules]
  );

  const saveLoad = useCallback(
    (input: LoadInput, { original, dispatchNow = false }: SaveOptions = {}): CommandResult => {
      const { valid, errors } = validate(input, original);
      if (dispatchNow && input.driverId === null) errors.driverId ??= "Assign a driver before dispatching.";
      if (!valid || errors.driverId) return { ok: false, errors };

      const now = Date.now();
      // A reassigned load has to be sent to its new driver, so it goes back to draft.
      const keepsDispatch = original?.dispatchedAt != null && original.driverId === input.driverId;
      const load: Load = {
        ...(original ?? { id: crypto.randomUUID(), createdAt: now }),
        ...input,
        title: input.title.trim(),
        dispatchedAt: keepsDispatch ? original.dispatchedAt : dispatchNow ? now : null,
        updatedAt: now,
      };
      dispatch({ type: "loadSaved", load });

      const sent = dispatchNow && !keepsDispatch ? " and dispatched it" : "";
      let message: string;
      if (!original) message = `Created ${load.title} for ${driverName(load.driverId)}${sent}`;
      else if (original.driverId === null && load.driverId !== null)
        message = `Assigned ${load.title} to ${driverName(load.driverId)}${sent}`;
      else if (original.driverId !== load.driverId)
        message = `Moved ${load.title} to ${driverName(load.driverId)}${sent}`;
      else if (original.start !== load.start || original.end !== load.end)
        message = `Rescheduled ${load.title} to ${formatWindow(load.start, load.end)}${sent}`;
      else message = sent ? `Dispatched ${load.title} to ${driverName(load.driverId)}` : `Updated ${load.title}`;
      log({ tone: "success", message, loadId: load.id });

      return { ok: true, load };
    },
    [dispatch, driverName, log, validate]
  );

  /** Applies a timeline gesture, explaining any rejection and offering undo on success. */
  const applyGesture = useCallback(
    (original: Load | undefined, changes: Partial<LoadInput>, verb: string) => {
      if (!original) return;
      const result = saveLoad({ ...toLoadInput(original), ...changes }, { original });
      if (!result.ok) {
        toast.warning(`Can't ${verb} ${original.title}`, { description: primaryError(result.errors) });
        return;
      }
      const { load } = result;
      toast.success(`${load.title} · ${driverName(load.driverId)}`, {
        description: formatWindow(load.start, load.end),
        duration: UNDO_WINDOW,
        action: { label: "Undo", onClick: () => restoreLoad(original) },
      });
    },
    [driverName, restoreLoad, saveLoad]
  );

  const moveLoad = useCallback(
    (id: LoadId, start: number, driverId: DriverId) => {
      const original = loadsById.get(id);
      if (!original) return;
      const verb = original.driverId === null ? "assign" : "move";
      applyGesture(original, { start, end: start + (original.end - original.start), driverId }, verb);
    },
    [applyGesture, loadsById]
  );

  const resizeLoad = useCallback(
    (id: LoadId, edge: "left" | "right", time: number) =>
      applyGesture(loadsById.get(id), edge === "left" ? { start: time } : { end: time }, "resize"),
    [applyGesture, loadsById]
  );

  const dispatchLoad = useCallback(
    (id: LoadId) => {
      const load = loadsById.get(id);
      if (!load) return;
      if (load.dispatchedAt !== null) {
        toast.info(`${load.title} is already on the driver's app`);
        return;
      }
      const result = saveLoad(toLoadInput(load), { original: load, dispatchNow: true });
      if (result.ok)
        toast.success(`Dispatched to ${driverName(load.driverId)}`, { description: `${load.title} is on their app.` });
      else toast.warning(`Can't dispatch ${load.title}`, { description: primaryError(result.errors) });
    },
    [driverName, loadsById, saveLoad]
  );

  const deleteLoad = useCallback(
    (id: LoadId) => {
      const load = loadsById.get(id);
      if (!load) return;
      if (isLocked(load, Date.now())) {
        toast.warning(`Can't delete ${load.title}`, { description: "Past and in-progress loads can't be changed." });
        return;
      }
      dispatch({ type: "loadRemoved", id });
      log({ tone: "warning", message: `Deleted ${load.title}`, loadId: id });
      toast(`Deleted ${load.title}`, {
        duration: UNDO_WINDOW,
        action: { label: "Undo", onClick: () => restoreLoad(load) },
      });
    },
    [dispatch, loadsById, log, restoreLoad]
  );

  /** One-click dispatching: give a queued load to whichever driver can take it soonest. */
  const autoAssign = useCallback(
    (id: LoadId) => {
      const load = loadsById.get(id);
      if (!load) return;
      const suggestion = suggestAssignment(state.drivers, schedules, load, nextBookableStart(Date.now()));
      if (!suggestion) {
        toast.warning(`No truck can carry ${formatGallons(load.gallons)}`, {
          description: "Split the load or lower the volume.",
        });
        return;
      }
      const duration = load.end - load.start;
      applyGesture(
        load,
        { driverId: suggestion.driver.id, start: suggestion.start, end: suggestion.start + duration },
        "assign"
      );
    },
    [applyGesture, loadsById, schedules, state.drivers]
  );

  const setTerminalAvailability = useCallback(
    (id: TerminalId, available: boolean) => {
      const terminal = terminals.get(id);
      if (!terminal) return;
      dispatch({ type: "terminalToggled", id, available });

      const next = new Map(terminals).set(id, { ...terminal, available });
      const now = Date.now();
      const affected = state.loads.filter((load) => {
        const { status } = getLoadState(load, now);
        return (
          (status === "draft" || status === "dispatched") &&
          (load.primaryTerminalId === id || load.backupTerminalId === id)
        );
      });
      const stranded = affected.filter((load) => !resolveSupply(load, next).terminal).length;
      const rerouted = affected.filter((load) => resolveSupply(load, next).usingBackup).length;

      if (available) {
        log({ tone: "success", message: `${terminal.name} is back online` });
        toast.success(`${terminal.name} is back online`);
      } else {
        const summary = [`${rerouted} load${rerouted === 1 ? "" : "s"} switched to backup terminals`];
        if (stranded > 0) summary.push(`${stranded} without supply`);
        log({ tone: "warning", message: `${terminal.name} marked out: ${summary.join(", ")}` });
        toast.warning(`${terminal.name} marked out`, { description: `${summary.join(", ")}.` });
      }
    },
    [dispatch, log, state.loads, terminals]
  );

  const setDefaults = useCallback(
    (defaults: SupplyDefaults) => dispatch({ type: "defaultsChanged", defaults }),
    [dispatch]
  );

  const resetBoard = useCallback(() => {
    dispatch({ type: "boardReplaced", state: createSeedState(Date.now()) });
    log({ tone: "info", message: "Reset the board to fresh demo data" });
    toast.success("Demo data reset");
  }, [dispatch, log]);

  return {
    drivers,
    terminals,
    loadsById,
    schedules,
    validate,
    saveLoad,
    moveLoad,
    resizeLoad,
    dispatchLoad,
    deleteLoad,
    autoAssign,
    setTerminalAvailability,
    setDefaults,
    resetBoard,
  };
}

export type LoadCommands = ReturnType<typeof useLoadCommands>;
