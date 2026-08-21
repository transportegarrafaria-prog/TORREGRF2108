import { TriangleAlert, PauseCircle, Clock, Info, BellOff, Check } from "lucide-react";
import type { AlertItem } from "@/data/vehicleModel";
import { cn } from "@/lib/utils";

const toneMap = {
  Critico: { color: "text-crit", ring: "border-[color-mix(in_oklab,var(--crit)_28%,transparent)]", bg: "bg-[color-mix(in_oklab,var(--crit)_10%,transparent)]" },
  Atencao: { color: "text-warn", ring: "border-[color-mix(in_oklab,var(--warn)_26%,transparent)]", bg: "bg-[color-mix(in_oklab,var(--warn)_9%,transparent)]" },
  Informativo: { color: "text-cyan", ring: "border-border", bg: "bg-secondary/50" },
} as const;

function iconFor(titulo: string) {
  if (titulo.includes("GPS")) return TriangleAlert;
  if (titulo.includes("Parada")) return PauseCircle;
  if (titulo.includes("atrasada")) return Clock;
  return Info;
}

export function OperationalAlerts({
  alerts,
  onRead,
}: {
  alerts: AlertItem[];
  onRead: (id: string) => void;
}) {
  if (!alerts.length) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-center">
        <BellOff className="size-6 text-subtle" />
        <p className="text-sm text-muted-foreground">
          Nenhum alerta pendente — aguardando novos alertas
        </p>
      </div>
    );
  }

  return (
    <ul className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
      {alerts.map((a) => {
        const t = toneMap[a.categoria];
        const Icon = iconFor(a.titulo);
        return (
          <li
            key={a.id}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-white/[0.03]",
              t.ring,
              t.bg,
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", t.color)} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{a.titulo}</p>
              <p className="truncate text-xs text-muted-foreground">{a.detalhe}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="tabular rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground">
                {a.placa}
              </span>
              <button
                type="button"
                onClick={() => onRead(a.id)}
                aria-label={`Marcar alerta ${a.placa} como lido`}
                title="Marcar como lido"
                className="grid size-7 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-[color-mix(in_oklab,var(--ok)_45%,transparent)] hover:text-ok"
              >
                <Check className="size-3.5" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
