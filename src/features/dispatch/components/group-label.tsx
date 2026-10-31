"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatGallons, formatTime, initials } from "../domain/format";
import type { BoardGroup } from "./timeline-model";

export function GroupLabel({ group }: { group: BoardGroup }) {
  if (group.kind === "section") {
    return (
      <div className="flex h-full items-center gap-2 bg-[oklch(0.935_0.012_265)] px-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {group.title}
        <span className="rounded-full bg-card px-1.5 py-px text-[10px] text-foreground tabular-nums">
          {group.count}
        </span>
      </div>
    );
  }

  const { driver, current } = group;
  return (
    <div className="flex h-full min-w-0 items-center gap-2.5 px-3">
      <Avatar className="size-8 shrink-0 max-sm:hidden">
        <AvatarFallback
          className={cn(
            "text-[11px] font-semibold",
            driver.kind === "carrier" ? "bg-brand-navy text-white" : "bg-accent text-brand-navy"
          )}
        >
          {initials(driver.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-medium">{driver.name}</div>
        <div className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
          <span className={cn("size-1.5 shrink-0 rounded-full", current ? "bg-brand-sky" : "bg-success")} aria-hidden />
          <span className="truncate">
            {current
              ? `On a load until ${formatTime(current.end)}`
              : `${driver.truck} · ${formatGallons(driver.capacityGallons)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
