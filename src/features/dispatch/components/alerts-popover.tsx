"use client";

import { BellIcon, CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { type DispatchAlert, isActionable } from "../domain/alerts";
import { formatRelative } from "../domain/format";
import type { LoadId } from "../domain/types";
import type { ActivityEntry } from "../state/use-activity-log";

interface AlertsPopoverProps {
  alerts: readonly DispatchAlert[];
  activity: readonly ActivityEntry[];
  now: number;
  onDispatch: (id: LoadId) => void;
  onAutoAssign: (id: LoadId) => void;
  onShow: (id: LoadId) => void;
}

const SEVERITY_ICONS = {
  critical: <CircleAlertIcon className="size-4 text-destructive" />,
  warning: <TriangleAlertIcon className="size-4 text-warning" />,
  info: <InfoIcon className="size-4 text-brand-sky" />,
};

export function AlertsPopover({ alerts, activity, now, onDispatch, onAutoAssign, onShow }: AlertsPopoverProps) {
  const actionable = alerts.filter(isActionable).length;
  const critical = alerts.some((alert) => alert.severity === "critical");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications, ${actionable} need attention`}
        >
          <BellIcon />
          {actionable > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white tabular-nums",
                critical ? "bg-destructive" : "bg-warning"
              )}
            >
              {actionable}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,24rem)] p-0">
        <Tabs defaultValue="alerts" className="gap-0">
          <div className="border-b px-3 pt-3 pb-2">
            <TabsList className="w-full">
              <TabsTrigger value="alerts">
                Alerts
                {actionable > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
                    {actionable}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="activity">Live activity</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="alerts">
            {alerts.length === 0 ? (
              <EmptyState title="All clear" description="No forgotten loads or supply problems." />
            ) : (
              <div className="max-h-[min(26rem,60dvh)] overflow-y-auto overscroll-contain">
                <ul className="divide-y">
                  {alerts.map((alert) => (
                    <li key={alert.id} className="flex gap-3 px-3 py-3">
                      <span className="mt-0.5">{SEVERITY_ICONS[alert.severity]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug font-medium">{alert.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{alert.description}</p>
                        <div className="mt-2 flex gap-1.5">
                          {alert.action === "dispatch" && (
                            <Button size="xs" onClick={() => onDispatch(alert.loadId)}>
                              Dispatch now
                            </Button>
                          )}
                          {alert.action === "assign" && (
                            <Button size="xs" onClick={() => onAutoAssign(alert.loadId)}>
                              Auto-assign
                            </Button>
                          )}
                          <Button size="xs" variant="outline" onClick={() => onShow(alert.loadId)}>
                            Show
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity">
            {activity.length === 0 ? (
              <EmptyState
                title="Nothing yet"
                description="Driver status updates and your changes appear here as they happen."
              />
            ) : (
              <div className="max-h-[min(26rem,60dvh)] overflow-y-auto overscroll-contain">
                <ul className="divide-y">
                  {activity.map((entry) => (
                    <li key={entry.id} className="flex gap-3 px-3 py-2.5">
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          entry.tone === "success" && "bg-success",
                          entry.tone === "warning" && "bg-warning",
                          entry.tone === "info" && "bg-brand-sky"
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-snug">{entry.message}</p>
                        <p className="text-[11px] text-muted-foreground">{formatRelative(entry.at, now)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="p-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleCheckIcon />
        </EmptyMedia>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription className="text-xs">{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
