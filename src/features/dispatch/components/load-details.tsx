"use client";

import {
  ClockIcon,
  CopyIcon,
  FuelIcon,
  LockIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  TruckIcon,
  WarehouseIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDuration, formatGallons, formatRelative, formatTime, formatWindow } from "../domain/format";
import { isLocked } from "../domain/rules";
import { getLoadState, resolveSupply } from "../domain/status";
import { type Driver, type Load, PRODUCTS, type Terminal, type TerminalId } from "../domain/types";
import { ProductSwatch, StatusBadge } from "./status-badge";

interface LoadDetailsProps {
  load: Load;
  driver?: Driver;
  terminals: ReadonlyMap<TerminalId, Terminal>;
  now: number;
  className?: string;
  onEdit: () => void;
  onDispatch: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function LoadDetails({
  load,
  driver,
  terminals,
  now,
  className,
  onEdit,
  onDispatch,
  onDuplicate,
  onDelete,
  onClose,
}: LoadDetailsProps) {
  const state = getLoadState(load, now);
  const locked = isLocked(load, now);
  const supply = resolveSupply(load, terminals);
  const backup = load.backupTerminalId ? terminals.get(load.backupTerminalId) : undefined;

  return (
    <section aria-label="Selected load" className={cn("rounded-2xl border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-start gap-2">
        <ProductSwatch product={load.product} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold">{load.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusBadge state={state} />
            {locked && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <LockIcon className="size-3" /> Read-only
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close details">
          <XIcon />
        </Button>
      </div>

      {state.status === "in-progress" && (
        <div className="mt-3">
          <Progress value={state.progress * 100} className="h-1.5" />
          <p className="mt-1.5 text-xs text-muted-foreground">Live from the driver app · ETA {formatTime(load.end)}</p>
        </div>
      )}

      <dl className="mt-3 grid gap-2.5 text-[13px]">
        <DetailRow icon={<TruckIcon />} label="Driver">
          {driver ? `${driver.name} · ${driver.truck}` : "Unassigned"}
        </DetailRow>
        <DetailRow icon={<ClockIcon />} label="Window">
          {formatWindow(load.start, load.end)}
          <span className="text-muted-foreground"> · {formatDuration(load.end - load.start)}</span>
        </DetailRow>
        <DetailRow icon={<FuelIcon />} label="Product">
          {PRODUCTS[load.product]} · {formatGallons(load.gallons)}
        </DetailRow>
        <DetailRow icon={<WarehouseIcon />} label="Supply">
          {supply.terminal ? (
            <>
              {supply.terminal.name}
              {supply.usingBackup && <span className="text-warning"> · backup (primary is out)</span>}
              {!supply.usingBackup && backup && <span className="text-muted-foreground"> · backup {backup.name}</span>}
            </>
          ) : (
            <span className="text-destructive">No terminal available</span>
          )}
        </DetailRow>
        <DetailRow icon={<SendIcon />} label="Dispatch">
          {load.dispatchedAt ? `Sent to driver ${formatRelative(load.dispatchedAt, now)}` : "Not sent to a driver yet"}
        </DetailRow>
      </dl>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <ActionButton label={locked ? "View" : "Edit"} shortcut="E" onClick={onEdit} variant="secondary">
          <PencilIcon /> {locked ? "View" : "Edit"}
        </ActionButton>
        {state.status === "draft" && (
          <ActionButton label="Dispatch to driver" shortcut="D" onClick={onDispatch} variant="default">
            <SendIcon /> Dispatch
          </ActionButton>
        )}
        <ActionButton label="Duplicate as a new load" onClick={onDuplicate} variant="ghost">
          <CopyIcon /> Duplicate
        </ActionButton>
        {!locked && (
          <ActionButton
            label="Delete"
            shortcut="Del"
            onClick={onDelete}
            variant="ghost"
            className="ml-auto text-destructive hover:text-destructive"
          >
            <Trash2Icon />
          </ActionButton>
        )}
      </div>
    </section>
  );
}

function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <dt className="mt-0.5 text-muted-foreground [&_svg]:size-3.5" aria-label={label}>
        {icon}
      </dt>
      <dd className="min-w-0 leading-snug">{children}</dd>
    </div>
  );
}

function ActionButton({
  label,
  shortcut,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string; shortcut?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" className={className} aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
