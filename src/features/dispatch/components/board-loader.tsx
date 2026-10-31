"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The timeline measures the DOM and wires up pointer handling on mount, and
 * the board reads localStorage, so it renders only in the browser.
 */
export const BoardLoader = dynamic(() => import("./dispatch-board").then((module) => module.DispatchBoard), {
  ssr: false,
  loading: BoardSkeleton,
});

function BoardSkeleton() {
  return (
    <div className="min-h-dvh bg-background" aria-busy="true" aria-label="Loading the dispatch board">
      <div className="h-14 border-b bg-card" />
      <div className="mx-auto flex max-w-[1680px] gap-4 p-3 sm:p-4">
        <div className="flex-1 space-y-3 rounded-2xl border bg-card p-4">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-6 w-full max-w-xl" />
          {Array.from({ length: 8 }, (_, row) => (
            <Skeleton key={row} className="h-11 w-full" />
          ))}
        </div>
        <div className="hidden w-80 space-y-3 rounded-2xl border bg-card p-4 lg:block">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }, (_, card) => (
            <Skeleton key={card} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
