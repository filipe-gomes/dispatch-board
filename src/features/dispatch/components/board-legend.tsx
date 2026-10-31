import { Kbd } from "@/components/ui/kbd";
import { PRODUCT_CODES, PRODUCTS } from "../domain/types";
import { ProductSwatch } from "./status-badge";

export function BoardLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-3 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {PRODUCT_CODES.map((code) => (
          <span key={code} className="inline-flex items-center gap-1.5">
            <ProductSwatch product={code} /> {PRODUCTS[code]}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded border border-dashed border-brand-navy/40" aria-hidden /> Draft
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-brand-sky/40" aria-hidden /> Dispatched
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-muted-foreground/25" aria-hidden /> Delivered
        </span>
      </div>
      <p className="hidden lg:ml-auto lg:block">
        Double-click an empty slot to add a load · drag to reschedule · <Kbd>N</Kbd> new <Kbd>E</Kbd> edit{" "}
        <Kbd>Del</Kbd> delete
      </p>
    </div>
  );
}
