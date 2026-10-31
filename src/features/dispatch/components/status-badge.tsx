import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LoadState, LoadStatus } from "../domain/status";
import type { ProductCode } from "../domain/types";

const STATUS_STYLES: Record<LoadStatus, string> = {
  unassigned: "bg-accent text-brand-navy",
  overdue: "bg-destructive/10 text-destructive",
  draft: "border-dashed border-brand-sky/60 bg-transparent text-brand-navy",
  dispatched: "bg-brand-sky/20 text-brand-navy",
  "in-progress": "bg-success/15 text-success",
  delivered: "bg-muted text-muted-foreground",
  missed: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ state, className }: { state: LoadState; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_STYLES[state.status], className)}>
      {state.status === "in-progress" && (
        <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      )}
      {state.label}
    </Badge>
  );
}

export function ProductSwatch({ product, className }: { product: ProductCode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(`product-${product}`, "inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ background: "var(--load-accent)" }}
    />
  );
}
