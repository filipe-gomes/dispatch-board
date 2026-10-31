"use client";

import { AlertTriangleIcon, CheckIcon, LockIcon, RouteIcon } from "lucide-react";
import { createContext, type CSSProperties, useContext } from "react";
import type { ReactCalendarTimelineProps } from "react-calendar-timeline";
import { cn } from "@/lib/utils";
import { formatGallons, formatTimeRange } from "../domain/format";
import type { DriverId, LoadId } from "../domain/types";
import type { BoardGroup, LoadItem as LoadItemData } from "./timeline-model";

export type LoadItemRendererProps = Parameters<
  NonNullable<ReactCalendarTimelineProps<LoadItemData, BoardGroup>["itemRenderer"]>
>[0];

export interface SlotCandidate {
  id: LoadId;
  driverId: DriverId;
  start: number;
  end: number;
}

/** Explains why a slot would be rejected, or returns null when it is bookable. */
export type CheckSlot = (candidate: SlotCandidate) => string | null;

export const CheckSlotContext = createContext<CheckSlot>(() => null);

/**
 * The library applies its own inline colours and borders; clearing them lets
 * the stylesheet own the look while the library keeps positioning.
 */
const RESET_LIBRARY_STYLES: CSSProperties = {
  background: undefined,
  color: undefined,
  fontSize: undefined,
  borderStyle: undefined,
  borderColor: undefined,
  borderTopWidth: undefined,
  borderBottomWidth: undefined,
  borderLeftWidth: undefined,
  borderRightWidth: undefined,
};

/** Where the load would land if the in-flight drag or resize ended now. */
function previewSlot({ item, itemContext }: LoadItemRendererProps) {
  const duration = item.end_time - item.start_time;
  if (itemContext.dragging && itemContext.dragTime !== null) {
    const target = itemContext.dimensions.order.group as BoardGroup;
    return {
      start: itemContext.dragTime,
      end: itemContext.dragTime + duration,
      driverId: target.kind === "driver" ? target.id : null,
    };
  }
  if (itemContext.resizing && itemContext.resizeTime !== null && itemContext.resizeEdge) {
    return itemContext.resizeEdge === "left"
      ? { start: itemContext.resizeTime, end: item.end_time, driverId: item.group }
      : { start: item.start_time, end: itemContext.resizeTime, driverId: item.group };
  }
  return null;
}

export function LoadItem(props: LoadItemRendererProps) {
  const { item, itemContext, getItemProps } = props;
  const checkSlot = useContext(CheckSlotContext);
  const { load, state, supply, locked, dimmed } = item;

  const preview = previewSlot(props);
  const problem = preview
    ? preview.driverId === null
      ? "Drop on a driver's row"
      : checkSlot({ id: load.id, ...preview, driverId: preview.driverId })
    : null;
  const shown = preview ?? { start: load.start, end: load.end };
  const width = itemContext.dimensions.width;

  const { key, ref, ...rootProps } = getItemProps({
    className: cn(
      "load-item",
      `product-${load.product}`,
      `is-${state.status}`,
      locked && "is-locked",
      itemContext.selected && "is-selected",
      dimmed && !itemContext.selected && "is-dimmed",
      problem && "has-problem",
      width < 56 ? "is-compact" : width < 110 && "is-narrow"
    ),
    style: RESET_LIBRARY_STYLES,
  });

  return (
    <div key={key} ref={ref} {...rootProps} aria-label={`${load.title}, ${state.label}`}>
      {state.status === "in-progress" && (
        <div className="load-item__progress" style={{ width: `${state.progress * 100}%` }} />
      )}
      <div className="load-item__content">
        <div className="load-item__title">
          {state.status === "in-progress" && <span className="live-dot" aria-hidden />}
          {state.status === "delivered" && <CheckIcon className="size-3.5 shrink-0" aria-hidden />}
          {(state.status === "missed" || problem) && <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden />}
          {locked && state.status !== "delivered" && <LockIcon className="size-3 shrink-0 opacity-70" aria-hidden />}
          {supply.usingBackup && !locked && (
            <RouteIcon className="size-3.5 shrink-0" aria-label="Using backup terminal" />
          )}
          <span className="truncate">{load.title}</span>
        </div>
        <div className="load-item__meta">
          {problem ??
            `${formatTimeRange(shown.start, shown.end)} · ${state.status === "in-progress" ? state.label : formatGallons(load.gallons)}`}
        </div>
      </div>
    </div>
  );
}

/** Stable module-level renderer, so the timeline never sees a new function identity. */
export const renderLoadItem = (props: LoadItemRendererProps) => <LoadItem {...props} />;
