"use client";

import {
  ArrowRightIcon,
  CopyIcon,
  LockIcon,
  SendIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDay, formatDuration, formatGallons, formatTime, formatWindow, isSameDay } from "../domain/format";
import { isLocked, type LoadErrorKey, TITLE_MAX_LENGTH, type ValidationResult } from "../domain/rules";
import { findAvailableDrivers, findConflict, findNextOpenStart, type ScheduleIndex } from "../domain/schedule";
import { HOUR, nextBookableStart } from "../domain/time";
import {
  type Driver,
  type Load,
  type LoadInput,
  PRODUCT_CODES,
  PRODUCTS,
  type ProductCode,
  type Terminal,
} from "../domain/types";
import type { CommandResult } from "../state/use-load-commands";
import { DateTimeField } from "./date-time-field";
import { ProductSwatch } from "./status-badge";

const UNASSIGNED = "__unassigned__";
const NO_BACKUP = "__none__";
const DURATION_PRESETS = [1, 2, 3, 4, 6, 8, 12, 24];

/** Form fields in the order they appear, used to focus the first invalid one. */
const FIELD_IDS: Partial<Record<LoadErrorKey, string>> = {
  title: "load-title",
  driverId: "load-driver",
  start: "load-start",
  end: "load-end",
  gallons: "load-gallons",
  backupTerminalId: "load-backup",
};

interface FormValues {
  title: string;
  driverId: string;
  start: number;
  end: number;
  product: ProductCode;
  gallons: string;
  primaryTerminalId: string;
  backupTerminalId: string;
}

const toFormValues = (input: LoadInput): FormValues => ({
  ...input,
  driverId: input.driverId ?? UNASSIGNED,
  gallons: String(input.gallons),
  backupTerminalId: input.backupTerminalId ?? NO_BACKUP,
});

const toInput = (values: FormValues): LoadInput => ({
  ...values,
  driverId: values.driverId === UNASSIGNED ? null : values.driverId,
  gallons: values.gallons.trim() === "" ? Number.NaN : Number(values.gallons),
  backupTerminalId: values.backupTerminalId === NO_BACKUP ? null : values.backupTerminalId,
});

export interface LoadFormProps {
  initial: LoadInput;
  /** Present when editing an existing load. */
  original?: Load;
  now: number;
  drivers: readonly Driver[];
  terminals: readonly Terminal[];
  schedules: ScheduleIndex;
  validate: (input: LoadInput, original?: Load) => ValidationResult;
  onSubmit: (input: LoadInput, options: { dispatchNow: boolean }) => CommandResult;
  onCancel: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export function LoadForm({
  initial,
  original,
  now,
  drivers,
  terminals,
  schedules,
  validate,
  onSubmit,
  onCancel,
  onDelete,
  onDuplicate,
}: LoadFormProps) {
  const [values, setValues] = useState(() => toFormValues(initial));
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);

  const input = toInput(values);
  // Cheap enough to run every render, which also keeps it current as `now` ticks forward.
  const validation = validate(input, original);
  const readOnly = original !== undefined && isLocked(original, now);
  const hasSlot = Number.isFinite(input.start) && Number.isFinite(input.end) && input.end > input.start;
  const duration = hasSlot ? input.end - input.start : 2 * HOUR;

  const update = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));
  };

  const setSlot = (start: number, end: number) => {
    setValues((current) => ({ ...current, start, end }));
    setTouched((current) => new Set(current).add("start").add("end"));
  };

  const errorFor = (key: LoadErrorKey) =>
    submitted || touched.has(key === "conflict" ? "start" : key) ? validation.errors[key] : undefined;

  const submit = (dispatchNow: boolean) => {
    setSubmitted(true);
    const result = onSubmit(input, { dispatchNow });
    if (result.ok) return;
    const firstInvalid = (Object.keys(FIELD_IDS) as LoadErrorKey[]).find((key) => result.errors[key]);
    if (firstInvalid) document.getElementById(FIELD_IDS[firstInvalid]!)?.focus();
  };

  const isUnassigned = values.driverId === UNASSIGNED;
  const alreadyDispatched = original?.dispatchedAt != null && original.driverId === input.driverId;
  const canDispatch = !isUnassigned && !alreadyDispatched;
  // Creating an assigned load dispatches it by default: the "dispatch in seconds" path.
  const primaryDispatches = !original && canDispatch;
  const primaryLabel = original ? "Save changes" : isUnassigned ? "Add to queue" : "Create & dispatch";
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!readOnly) submit(primaryDispatches);
  };

  // Helpers that turn an overlap into a one-click fix.
  const conflict = hasSlot ? validation.conflict : undefined;
  const nextOpening =
    conflict && input.driverId
      ? findNextOpenStart(
          schedules.get(input.driverId),
          duration,
          Math.max(input.start, nextBookableStart(now)),
          original?.id
        )
      : null;
  const freeDrivers = conflict
    ? findAvailableDrivers(
        drivers,
        schedules,
        input,
        Number.isFinite(input.gallons) ? input.gallons : 0,
        original?.id
      ).slice(0, 3)
    : [];

  const titleLength = values.title.trim().length;
  const crossesMidnight = hasSlot && !isSameDay(input.start, input.end - 1);

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {readOnly && (
        <Alert>
          <LockIcon />
          <AlertTitle>This load is read-only</AlertTitle>
          <AlertDescription>
            It started at {formatTime(original.start)} on {formatDay(original.start)}. Past and in-progress loads
            can&apos;t be edited, but you can duplicate it to schedule a repeat delivery.
          </AlertDescription>
        </Alert>
      )}

      <fieldset disabled={readOnly} className="contents">
        <FieldGroup className="gap-4">
          <Field data-invalid={!!errorFor("title")}>
            <div className="flex items-baseline justify-between">
              <FieldLabel htmlFor="load-title">Title</FieldLabel>
              <span
                className={cn(
                  "text-xs text-muted-foreground tabular-nums",
                  (titleLength > TITLE_MAX_LENGTH || (touched.has("title") && titleLength < 5)) && "text-destructive"
                )}
              >
                {titleLength}/{TITLE_MAX_LENGTH}
              </span>
            </div>
            <Input
              id="load-title"
              autoComplete="off"
              placeholder="Delivery site, e.g. QuickStop #31"
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              aria-invalid={!!errorFor("title") || undefined}
              aria-describedby="load-title-error"
              className="h-9"
            />
            <FieldError id="load-title-error">{errorFor("title")}</FieldError>
          </Field>

          <Field data-invalid={!!errorFor("driverId")}>
            <FieldLabel htmlFor="load-driver">Driver or carrier</FieldLabel>
            <Select value={values.driverId} onValueChange={(value) => update("driverId", value)}>
              <SelectTrigger id="load-driver" className="h-9 w-full" aria-invalid={!!errorFor("driverId") || undefined}>
                <SelectValue placeholder="Choose who delivers this load" />
              </SelectTrigger>
              <SelectContent>
                {(["company", "carrier"] as const).map((kind) => (
                  <SelectGroup key={kind}>
                    <SelectLabel>{kind === "company" ? "Company fleet" : "Common carriers"}</SelectLabel>
                    {drivers
                      .filter((driver) => driver.kind === kind)
                      .map((driver) => {
                        const busy = hasSlot && !!findConflict(schedules.get(driver.id), input, original?.id);
                        const tooSmall = Number.isFinite(input.gallons) && input.gallons > driver.capacityGallons;
                        return (
                          <SelectItem key={driver.id} value={driver.id}>
                            <span className="flex w-full items-center gap-2">
                              {driver.name}
                              {!readOnly && (
                                <span className={cn("text-xs", busy || tooSmall ? "text-destructive" : "text-success")}>
                                  {busy
                                    ? "Busy"
                                    : tooSmall
                                      ? `Max ${formatGallons(driver.capacityGallons)}`
                                      : "Available"}
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                  </SelectGroup>
                ))}
                <SelectSeparator />
                <SelectItem value={UNASSIGNED}>Leave unassigned (add to queue)</SelectItem>
              </SelectContent>
            </Select>
            <FieldError>{errorFor("driverId")}</FieldError>
          </Field>

          {/* One row each: a date plus a time doesn't fit in half of the dialog. */}
          <div className="grid grid-cols-1 gap-4">
            <Field data-invalid={!!errorFor("start")}>
              <FieldLabel htmlFor="load-start">Start</FieldLabel>
              <DateTimeField
                id="load-start"
                value={values.start}
                // Keep the duration when moving the start, so the end follows along.
                onChange={(start) => setSlot(start, start + duration)}
                invalid={!!errorFor("start")}
                disabled={readOnly}
              />
              <FieldError>{errorFor("start")}</FieldError>
            </Field>
            <Field data-invalid={!!errorFor("end")}>
              <FieldLabel htmlFor="load-end">End</FieldLabel>
              <DateTimeField
                id="load-end"
                value={values.end}
                onChange={(end) => update("end", end)}
                invalid={!!errorFor("end")}
                disabled={readOnly}
              />
              <FieldError>{errorFor("end")}</FieldError>
            </Field>
          </div>

          <div className={cn("-mt-1 flex flex-wrap items-center gap-1.5", readOnly && "hidden")}>
            <span className="mr-1 text-xs text-muted-foreground">
              {hasSlot
                ? `Duration ${formatDuration(input.end - input.start)}${crossesMidnight ? " · ends the next day" : ""}`
                : "Set a start and end"}
            </span>
            {DURATION_PRESETS.map((hours) => (
              <Button
                key={hours}
                type="button"
                size="xs"
                variant={hasSlot && input.end - input.start === hours * HOUR ? "secondary" : "ghost"}
                className="rounded-full"
                onClick={() => setSlot(values.start, values.start + hours * HOUR)}
              >
                {hours}h
              </Button>
            ))}
          </div>

          {conflict && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <TriangleAlertIcon />
              <AlertTitle>Schedule conflict</AlertTitle>
              <AlertDescription className="gap-2">
                <p>{validation.errors.conflict}</p>
                <div className="flex flex-wrap gap-1.5">
                  {nextOpening !== null && (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => setSlot(nextOpening, nextOpening + duration)}
                    >
                      <ArrowRightIcon /> Next opening: {formatWindow(nextOpening, nextOpening + duration)}
                    </Button>
                  )}
                  {freeDrivers.map((driver) => (
                    <Button
                      key={driver.id}
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => update("driverId", driver.id)}
                    >
                      <UserRoundCheckIcon /> {driver.name} is free
                    </Button>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <Field>
              <FieldLabel htmlFor="load-product">Product</FieldLabel>
              <Select value={values.product} onValueChange={(value) => update("product", value as ProductCode)}>
                <SelectTrigger id="load-product" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      <ProductSwatch product={code} /> {PRODUCTS[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field data-invalid={!!errorFor("gallons")}>
              <FieldLabel htmlFor="load-gallons">Gallons</FieldLabel>
              <Input
                id="load-gallons"
                type="number"
                inputMode="numeric"
                min={100}
                step={100}
                value={values.gallons}
                onChange={(event) => update("gallons", event.target.value)}
                aria-invalid={!!errorFor("gallons") || undefined}
                className="h-9 tabular-nums"
              />
              <FieldError>{errorFor("gallons")}</FieldError>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="load-primary">Primary terminal</FieldLabel>
              <TerminalSelect
                id="load-primary"
                terminals={terminals}
                value={values.primaryTerminalId}
                onChange={(value) => update("primaryTerminalId", value)}
              />
            </Field>
            <Field data-invalid={!!errorFor("backupTerminalId")}>
              <FieldLabel htmlFor="load-backup">Backup terminal</FieldLabel>
              <TerminalSelect
                id="load-backup"
                terminals={terminals}
                value={values.backupTerminalId}
                onChange={(value) => update("backupTerminalId", value)}
                allowNone
              />
              <FieldError>{errorFor("backupTerminalId")}</FieldError>
            </Field>
          </div>
          <FieldDescription className="-mt-2 text-xs">
            If the primary terminal runs out, the driver is routed to the backup automatically.
          </FieldDescription>
        </FieldGroup>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center">
        {readOnly
          ? onDuplicate && (
              <Button type="button" variant="outline" onClick={onDuplicate}>
                <CopyIcon /> Duplicate
              </Button>
            )
          : onDelete && (
              <Button type="button" variant="destructive" onClick={onDelete}>
                <Trash2Icon /> Delete
              </Button>
            )}
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && canDispatch && (
            <Button type="button" variant="outline" onClick={() => submit(!!original)}>
              {original ? (
                <>
                  <SendIcon /> Save &amp; dispatch
                </>
              ) : (
                "Save draft"
              )}
            </Button>
          )}
          {!readOnly && (
            <Button type="submit">
              {primaryDispatches && <SendIcon />}
              {primaryLabel}
            </Button>
          )}
        </div>
      </div>
      {alreadyDispatched && !readOnly && (
        <p className="-mt-3 text-right text-xs text-muted-foreground">
          Changes are sent to the driver&apos;s app automatically.
        </p>
      )}
    </form>
  );
}

function TerminalSelect({
  id,
  terminals,
  value,
  onChange,
  allowNone = false,
}: {
  id: string;
  terminals: readonly Terminal[];
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-9 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NO_BACKUP}>No backup</SelectItem>}
        {terminals.map((terminal) => (
          <SelectItem key={terminal.id} value={terminal.id}>
            {terminal.name}
            {!terminal.available && <span className="text-xs text-destructive">Out</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
