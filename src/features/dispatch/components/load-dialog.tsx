"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatWindow } from "../domain/format";
import { isLocked, type ValidationResult } from "../domain/rules";
import type { ScheduleIndex } from "../domain/schedule";
import {
  type Driver,
  type DriverId,
  type Load,
  type LoadId,
  type LoadInput,
  type Terminal,
  toLoadInput,
} from "../domain/types";
import type { CommandResult } from "../state/use-load-commands";
import { LoadForm } from "./load-form";

export type EditorState =
  { mode: "create"; key: string; initial: LoadInput } | { mode: "edit"; key: string; loadId: LoadId };

interface LoadDialogProps {
  editor: EditorState | null;
  now: number;
  drivers: readonly Driver[];
  driversById: ReadonlyMap<DriverId, Driver>;
  terminals: readonly Terminal[];
  loadsById: ReadonlyMap<LoadId, Load>;
  schedules: ScheduleIndex;
  validate: (input: LoadInput, original?: Load) => ValidationResult;
  onSubmit: (input: LoadInput, options: { dispatchNow: boolean; original?: Load }) => CommandResult;
  onDelete: (id: LoadId) => void;
  onDuplicate: (load: Load) => void;
  onClose: () => void;
}

export function LoadDialog({
  editor,
  now,
  drivers,
  driversById,
  terminals,
  loadsById,
  schedules,
  validate,
  onSubmit,
  onDelete,
  onDuplicate,
  onClose,
}: LoadDialogProps) {
  const original = editor?.mode === "edit" ? loadsById.get(editor.loadId) : undefined;
  // An edited load can vanish underneath us (deleted in another tab); close instead of showing a blank form.
  const open = editor !== null && (editor.mode === "create" || original !== undefined);
  const readOnly = original !== undefined && isLocked(original, now);

  let title = "New load";
  let description = "Schedule a delivery and send it to a driver or carrier in one step.";
  if (original) {
    title = readOnly ? "Load details" : "Edit load";
    const driver = original.driverId ? driversById.get(original.driverId)?.name : "Unassigned";
    description = `${driver} · ${formatWindow(original.start, original.end)}`;
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl data-closed:animate-none">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {editor && open && (
          <LoadForm
            key={editor.key}
            initial={editor.mode === "create" ? editor.initial : toLoadInput(original!)}
            original={original}
            now={now}
            drivers={drivers}
            terminals={terminals}
            schedules={schedules}
            validate={validate}
            onSubmit={(input, options) => onSubmit(input, { ...options, original })}
            onCancel={onClose}
            onDelete={original ? () => onDelete(original.id) : undefined}
            onDuplicate={original ? () => onDuplicate(original) : undefined}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
