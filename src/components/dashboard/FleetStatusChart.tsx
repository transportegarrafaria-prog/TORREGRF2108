import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  estadoCores,
  estadoLabels,
  estadoOrdem,
  type EstadoFrota,
  type Vehicle,
} from "@/data/vehicleModel";

/**
 * Segue exatamente os cards: cada veículo entra em um único estado,
 * então a soma das fatias é sempre o total de programados.
 */
export function FleetStatusChart({ vehicles }: { vehicles: Vehicle[] }) {
  const contagem = new Map<EstadoFrota, number>();
  for (const v of vehicles) contagem.set(v.estado, (contagem.get(v.estado) ?? 0) + 1);

  const data = estadoOrdem.map((estado) => ({
    name: estadoLabels[estado],
    value: contagem.get(estado) ?? 0,
    color: estadoCores[estado],
  }));
  const total = vehicles.length;
  const chartData = data.filter((d) => d.value > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-[140px]">
        {total === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Sem veículos no filtro
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  innerRadius={54}
                  outerRadius={78}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="tabular text-2xl font-semibold text-foreground">{total}</span>
              <span className="text-[11px] tracking-[0.08em] text-subtle uppercase">veículos</span>
            </div>
          </>
        )}
      </div>
      <ul className="flex flex-col gap-1.5">
        {data.map((d) => (
          <li
            key={d.name}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3"
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="truncate text-sm text-muted-foreground">{d.name}</span>
            <span className="tabular text-sm font-medium text-foreground">{d.value}</span>
            <span className="tabular w-11 text-right text-xs text-subtle">
              {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
