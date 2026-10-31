"use client";

import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, InboxIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatViewLabel, matchPreset, RANGE_PRESETS, type RangePreset, type TimelineView } from "../domain/view";

export type BoardFilter = "all" | "attention" | "drafts";

const FILTERS: { value: BoardFilter; label: string }[] = [
  { value: "all", label: "All loads" },
  { value: "attention", label: "Needs attention" },
  { value: "drafts", label: "Drafts" },
];

interface BoardToolbarProps {
  view: TimelineView;
  /** Phone layout: shorter labels and scrollable chip rows. */
  compact: boolean;
  filter: BoardFilter;
  attentionCount: number;
  queueCount: number;
  showQueueButton: boolean;
  onToday: () => void;
  onStep: (direction: 1 | -1) => void;
  onPreset: (preset: RangePreset) => void;
  onJumpTo: (date: Date) => void;
  onFilterChange: (filter: BoardFilter) => void;
  onOpenQueue: () => void;
  onNewLoad: () => void;
}

export function BoardToolbar({
  view,
  compact,
  filter,
  attentionCount,
  queueCount,
  showQueueButton,
  onToday,
  onStep,
  onPreset,
  onJumpTo,
  onFilterChange,
  onOpenQueue,
  onNewLoad,
}: BoardToolbarProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const preset = matchPreset(view);

  return (
    <div className="flex flex-col gap-3 border-b p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
        <ButtonGroup>
          <Button variant="outline" size="icon-sm" onClick={() => onStep(-1)} aria-label="Previous period">
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => onStep(1)} aria-label="Next period">
            <ChevronRightIcon />
          </Button>
        </ButtonGroup>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-2 text-base font-semibold text-brand-navy">
              {formatViewLabel(view, compact)}
              <CalendarDaysIcon className="text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={new Date(view.start)}
              defaultMonth={new Date(view.start)}
              onSelect={(date) => {
                if (!date) return;
                onJumpTo(date);
                setCalendarOpen(false);
              }}
              autoFocus
            />
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          {showQueueButton && (
            <Button variant="outline" size="sm" onClick={onOpenQueue}>
              <InboxIcon /> Queue
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
                {queueCount}
              </Badge>
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="rounded-full px-3.5 shadow-sm" onClick={onNewLoad}>
                <PlusIcon /> New load
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Create a load <Kbd>N</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="-mx-3 flex [scrollbar-width:none] items-center gap-x-4 gap-y-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          spacing={1}
          value={filter}
          onValueChange={(value) => value && onFilterChange(value as BoardFilter)}
          aria-label="Filter loads"
          className="shrink-0"
        >
          {FILTERS.map(({ value, label }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="rounded-full px-3 data-[state=on]:border-brand-sky/50 data-[state=on]:bg-accent data-[state=on]:text-brand-navy"
            >
              {label}
              {value === "attention" && attentionCount > 0 && (
                <span className="rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white tabular-nums">
                  {attentionCount}
                </span>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ToggleGroup
          type="single"
          size="sm"
          spacing={0}
          value={preset ?? ""}
          onValueChange={(value) => value && onPreset(value as RangePreset)}
          aria-label="Planning horizon"
          className="ml-auto shrink-0 rounded-full bg-muted p-0.5"
        >
          {(Object.keys(RANGE_PRESETS) as RangePreset[]).map((key) => (
            <ToggleGroupItem
              key={key}
              value={key}
              className="rounded-full px-3 data-[state=on]:bg-card data-[state=on]:shadow-sm"
            >
              {RANGE_PRESETS[key].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
