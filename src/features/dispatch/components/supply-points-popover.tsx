"use client";

import { WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Terminal, TerminalId } from "../domain/types";
import type { SupplyDefaults } from "../state/board-reducer";

const NO_BACKUP = "__none__";

interface SupplyPointsPopoverProps {
  terminals: readonly Terminal[];
  /** Upcoming loads that name each terminal as primary or backup. */
  usage: ReadonlyMap<TerminalId, number>;
  defaults: SupplyDefaults;
  onToggle: (id: TerminalId, available: boolean) => void;
  onDefaultsChange: (defaults: SupplyDefaults) => void;
}

export function SupplyPointsPopover({
  terminals,
  usage,
  defaults,
  onToggle,
  onDefaultsChange,
}: SupplyPointsPopoverProps) {
  const outCount = terminals.filter((terminal) => !terminal.available).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="relative gap-2" aria-label="Supply points">
          <WarehouseIcon />
          <span className="hidden md:inline">Supply points</span>
          {outCount > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive" aria-hidden />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,22rem)]">
        <PopoverHeader>
          <PopoverTitle>Supply points</PopoverTitle>
          <PopoverDescription>
            Mark a terminal as out and its loads switch to their backup terminal automatically.
          </PopoverDescription>
        </PopoverHeader>

        <ul className="mt-3 flex flex-col gap-1">
          {terminals.map((terminal) => {
            const id = `terminal-${terminal.id}`;
            return (
              <li key={terminal.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
                <span
                  className={cn("size-2 shrink-0 rounded-full", terminal.available ? "bg-success" : "bg-destructive")}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <Label htmlFor={id} className="text-[13px] font-medium">
                    {terminal.name}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {terminal.available ? "Available" : "Out of product"} · {usage.get(terminal.id) ?? 0} upcoming loads
                  </p>
                </div>
                <Switch
                  id={id}
                  checked={terminal.available}
                  onCheckedChange={(checked) => onToggle(terminal.id, checked)}
                />
              </li>
            );
          })}
        </ul>

        <Separator className="my-3" />

        <p className="mb-2 text-xs font-medium text-muted-foreground">Defaults for new loads</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="default-primary" className="text-xs">
              Primary
            </Label>
            <Select
              value={defaults.primaryTerminalId}
              onValueChange={(primaryTerminalId) =>
                onDefaultsChange({
                  primaryTerminalId,
                  backupTerminalId: defaults.backupTerminalId === primaryTerminalId ? null : defaults.backupTerminalId,
                })
              }
            >
              <SelectTrigger id="default-primary" size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {terminals.map((terminal) => (
                  <SelectItem key={terminal.id} value={terminal.id}>
                    {terminal.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="default-backup" className="text-xs">
              Backup
            </Label>
            <Select
              value={defaults.backupTerminalId ?? NO_BACKUP}
              onValueChange={(value) =>
                onDefaultsChange({ ...defaults, backupTerminalId: value === NO_BACKUP ? null : value })
              }
            >
              <SelectTrigger id="default-backup" size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BACKUP}>No backup</SelectItem>
                {terminals
                  .filter((terminal) => terminal.id !== defaults.primaryTerminalId)
                  .map((terminal) => (
                    <SelectItem key={terminal.id} value={terminal.id}>
                      {terminal.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
