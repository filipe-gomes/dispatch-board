"use client";

import { FuelIcon, KeyboardIcon, MoreHorizontalIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";

export const HEADER_HEIGHT = 56;
export const SEARCH_INPUT_ID = "board-search";

interface AppHeaderProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** Supply points and notifications controls. */
  actions: ReactNode;
  onShowShortcuts: () => void;
  onReset: () => void;
}

export function AppHeader({ query, onQueryChange, actions, onShowShortcuts, onReset }: AppHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 border-b bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70"
      style={{ height: HEADER_HEIGHT }}
    >
      <div className="mx-auto flex h-full max-w-[1680px] items-center gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-navy text-brand-sky shadow-sm">
            <FuelIcon className="size-4.5" />
          </span>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-semibold text-brand-navy">Dispatch</p>
            <p className="text-[11px] text-muted-foreground">Fuel load board</p>
          </div>
        </div>

        <InputGroup className="mx-auto h-9 max-w-md flex-1 rounded-full bg-muted/60 sm:ml-6">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            id={SEARCH_INPUT_ID}
            type="search"
            placeholder="Search loads, sites, drivers…"
            aria-label="Search loads"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <InputGroupAddon align="inline-end" className="hidden sm:flex">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        </InputGroup>

        <div className="flex items-center gap-1">
          {actions}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More options">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Board</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onShowShortcuts}>
                <KeyboardIcon /> Keyboard shortcuts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onReset}>
                <RotateCcwIcon /> Reset demo data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Avatar className="ml-1 hidden size-8 sm:flex">
            <AvatarFallback className="bg-accent text-xs font-semibold text-brand-navy">DS</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
