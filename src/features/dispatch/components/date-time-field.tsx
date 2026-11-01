"use client";

import dayjs from "dayjs";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimeFieldProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

/** Date (calendar popover) plus a quarter-hour time input, combined into one epoch value. */
export function DateTimeField({ id, value, onChange, disabled, invalid, describedBy }: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const current = dayjs(value);
  const valid = current.isValid();

  const setDate = (date: Date | undefined) => {
    if (!date) return;
    const base = valid ? current : dayjs().startOf("hour");
    onChange(base.year(date.getFullYear()).month(date.getMonth()).date(date.getDate()).valueOf());
    setOpen(false);
  };

  const setTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
    const base = valid ? current : dayjs();
    onChange(base.hour(hours).minute(minutes).second(0).millisecond(0).valueOf());
  };

  return (
    // Equal halves, spaced like the load form's terminal pickers so the columns line up; stacked on phones.
    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn("h-9 w-full justify-start font-normal", !valid && "text-muted-foreground")}
          >
            <CalendarIcon className="text-muted-foreground" />
            <span className="truncate">{valid ? current.format("ddd, MMM D, YYYY") : "Pick a date"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={valid ? current.toDate() : undefined} onSelect={setDate} autoFocus />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        step={900}
        aria-label="Time"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="h-9 tabular-nums"
        value={valid ? current.format("HH:mm") : ""}
        onChange={(event) => setTime(event.target.value)}
      />
    </div>
  );
}
