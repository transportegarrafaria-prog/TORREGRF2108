import { ArrowLeftRight, Navigation, Truck, PauseCircle } from "lucide-react";
import type { TimelineEvent } from "@/data/vehicleModel";
import { cn } from "@/lib/utils";

const styles = {
  chegada: { icon: ArrowLeftRight, color: "text-transfer", bg: "bg-[color-mix(in_oklab,var(--transfer)_14%,transparent)]" },
  movimento: { icon: Navigation, color: "text-ok", bg: "bg-[color-mix(in_oklab,var(--ok)_14%,transparent)]" },
  saida: { icon: Truck, color: "text-primary", bg: "bg-primary-soft" },
  parada: { icon: PauseCircle, color: "text-warn", bg: "bg-[color-mix(in_oklab,var(--warn)_14%,transparent)]" },
} as const;

export function OperationalTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhum evento recente para este filtro
      </p>
    );
  }
  return (
    <ol className="relative flex flex-col gap-3 pl-1">
      <span className="absolute top-2 bottom-2 left-[19px] w-px bg-border" />
      {events.map((e) => {
        const s = styles[e.tipo];
        return (
          <li key={e.id} className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <span
              className={cn(
                "z-10 grid size-9 shrink-0 place-items-center rounded-full border border-border",
                s.bg,
                s.color,
              )}
            >
              <s.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{e.evento}</p>
              <p className="tabular truncate text-xs text-muted-foreground">{e.placa}</p>
            </div>
            <span className="tabular text-xs font-medium text-subtle">{e.hora}</span>
          </li>
        );
      })}
    </ol>
  );
}
