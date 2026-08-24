import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  estadoCores,
  estadoLabels,
  estadoOrdem,
  type EstadoFrota,
  type Vehicle,
} from "@/data/vehicleModel";
import { cn } from "@/lib/utils";

interface Fatia {
  estado: EstadoFrota;
  name: string;
  value: number;
  color: string;
  pct: number;
}

function Dica({ active, payload }: { active?: boolean; payload?: { payload: Fatia }[] }) {
  const d = active ? payload?.[0]?.payload : null;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-card px-3 py-2 shadow-lg">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
        {d.name}
      </p>
      <p className="tabular mt-0.5 text-xs text-muted-foreground">
        {d.value} {d.value === 1 ? "veículo" : "veículos"} · {d.pct}%
      </p>
    </div>
  );
}

/**
 * Segue exatamente os cards: cada veículo entra em um único estado, então
 * a soma das fatias é sempre o total de programados. Clicar numa fatia — ou
 * na linha da legenda, que é o alvo grande no toque — filtra o painel
 * inteiro por aquele estado, do mesmo jeito que os cards fazem.
 */
export function FleetStatusChart({
  vehicles,
  selected = null,
  onSelect,
}: {
  vehicles: Vehicle[];
  selected?: EstadoFrota | null;
  onSelect?: (estado: EstadoFrota) => void;
}) {
  const total = vehicles.length;
  const contagem = new Map<EstadoFrota, number>();
  for (const v of vehicles) contagem.set(v.estado, (contagem.get(v.estado) ?? 0) + 1);

  const data: Fatia[] = estadoOrdem.map((estado) => {
    const value = contagem.get(estado) ?? 0;
    return {
      estado,
      name: estadoLabels[estado],
      value,
      color: estadoCores[estado],
      pct: total ? Math.round((value / total) * 100) : 0,
    };
  });
  const chartData = data.filter((d) => d.value > 0);
  const selecionado = selected && contagem.has(selected) ? selected : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="relative min-h-[180px] flex-1">
        {total === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Sem veículos no filtro
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <Tooltip content={<Dica />} />
                <Pie
                  data={chartData}
                  dataKey="value"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                  onClick={(d: unknown) => {
                    const fatia = d as Fatia | undefined;
                    if (fatia?.estado) onSelect?.(fatia.estado);
                  }}
                  className={onSelect ? "cursor-pointer outline-none" : ""}
                >
                  {chartData.map((d) => (
                    <Cell
                      key={d.estado}
                      fill={d.color}
                      opacity={selecionado && selecionado !== d.estado ? 0.3 : 1}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="tabular text-3xl font-semibold text-foreground">
                {selecionado ? (contagem.get(selecionado) ?? 0) : total}
              </span>
              <span className="max-w-[60%] text-center text-[11px] leading-tight tracking-[0.08em] text-subtle uppercase">
                {selecionado ? estadoLabels[selecionado] : "veículos"}
              </span>
            </div>
          </>
        )}
      </div>

      <ul className="flex flex-col">
        {data.map((d) => {
          const ativo = selecionado === d.estado;
          return (
            <li key={d.estado}>
              <button
                type="button"
                onClick={() => onSelect?.(d.estado)}
                disabled={!onSelect || d.value === 0}
                aria-pressed={ativo}
                className={cn(
                  "grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
                  "enabled:hover:bg-white/[0.04] disabled:cursor-default disabled:opacity-55",
                  ativo && "bg-white/[0.06]",
                )}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span
                  className={cn(
                    "truncate text-sm",
                    ativo ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {d.name}
                </span>
                <span className="tabular text-sm font-medium text-foreground">{d.value}</span>
                <span className="tabular w-11 text-right text-xs text-subtle">{d.pct}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
