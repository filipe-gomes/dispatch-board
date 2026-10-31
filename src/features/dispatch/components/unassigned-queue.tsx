"use client";

import { CalendarPlusIcon, CheckCircle2Icon, GripVerticalIcon, InboxIcon, WandSparklesIcon } from "lucide-react";
import type { DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDuration, formatGallons, formatRelative, formatWindow } from "../domain/format";
import { getLoadState } from "../domain/status";
import { type Load, type LoadId, PRODUCTS } from "../domain/types";
import { ProductSwatch } from "./status-badge";

export const QUEUE_DRAG_TYPE = "application/x-dispatch-load";

interface UnassignedQueueProps {
  loads: readonly Load[];
  /** True while a search or filter hides some of the queue. */
  filtered: boolean;
  now: number;
  /** Native drag only works with a mouse; touch users get the buttons. */
  draggable: boolean;
  onAutoAssign: (id: LoadId) => void;
  onSchedule: (id: LoadId) => void;
  onDragStart: (load: Load) => void;
  onDragEnd: () => void;
}

export function UnassignedQueue({
  loads,
  filtered,
  now,
  draggable,
  onAutoAssign,
  onSchedule,
  onDragStart,
  onDragEnd,
}: UnassignedQueueProps) {
  const handleDragStart = (load: Load) => (event: DragEvent) => {
    event.dataTransfer.setData(QUEUE_DRAG_TYPE, load.id);
    event.dataTransfer.effectAllowed = "move";
    onDragStart(load);
  };

  return (
    <section aria-labelledby="queue-heading" className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <InboxIcon className="size-4 text-muted-foreground" />
        <h2 id="queue-heading" className="text-sm font-semibold">
          Unassigned loads
        </h2>
        <Badge variant="secondary" className="tabular-nums">
          {loads.length}
        </Badge>
      </div>
      {loads.length > 0 && (
        <p className="-mt-1 text-xs text-muted-foreground">
          {draggable
            ? "Drag a load onto a driver's row, or let auto-assign pick the soonest free truck."
            : "Auto-assign picks the soonest free truck."}
        </p>
      )}

      {loads.length === 0 ? (
        <Empty className="rounded-xl border border-dashed p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle2Icon />
            </EmptyMedia>
            <EmptyTitle className="text-sm">{filtered ? "No matching loads" : "Every load has a driver"}</EmptyTitle>
            <EmptyDescription className="text-xs">
              {filtered
                ? "Clear the search or filter to see the whole queue."
                : "Loads saved without a driver will wait here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {loads.map((load) => {
            const overdue = getLoadState(load, now).status === "overdue";
            return (
              <li
                key={load.id}
                draggable={draggable}
                onDragStart={handleDragStart(load)}
                onDragEnd={onDragEnd}
                className={cn(
                  "group rounded-xl border border-[oklch(0.88_0.04_250)] bg-[oklch(0.95_0.03_250)] p-3 transition-shadow",
                  draggable && "cursor-grab hover:shadow-md active:cursor-grabbing",
                  overdue && "border-destructive/40 bg-destructive/5"
                )}
              >
                <div className="flex items-start gap-2">
                  {draggable && (
                    <GripVerticalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold">{load.title}</span>
                      {overdue && (
                        <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">
                          Overdue
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ProductSwatch product={load.product} className="size-2" />
                      {PRODUCTS[load.product]} · {formatGallons(load.gallons)}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {formatWindow(load.start, load.end)} · {formatDuration(load.end - load.start)}
                    </div>
                    <div className={cn("mt-0.5 text-xs", overdue ? "text-destructive" : "text-brand-navy/70")}>
                      Requested {formatRelative(load.start, now)}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="xs" className="rounded-full" onClick={() => onAutoAssign(load.id)}>
                        <WandSparklesIcon /> Auto-assign
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Assign to the driver who can take it soonest</TooltipContent>
                  </Tooltip>
                  <Button
                    size="xs"
                    variant="outline"
                    className="rounded-full bg-card"
                    onClick={() => onSchedule(load.id)}
                  >
                    <CalendarPlusIcon /> Schedule
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
