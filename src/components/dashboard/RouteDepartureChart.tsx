import type { Vehicle } from "@/data/vehicleModel";

/**
 * Saídas por rota — quantos veículos já saíram para cada destino.
 * Série única: o comprimento da barra é a única codificação da
 * magnitude, então todas as barras usam a mesma cor.
 */
export function RouteDepartureChart({ vehicles }: { vehicles: Vehicle[] }) {
  const map = new Map<string, { saidas: number; programados: number }>();
  vehicles.forEach((v) => {
    const atual = map.get(v.destino) ?? { saidas: 0, programados: 0 };
    atual.programados += 1;
    if (v.saiu) atual.saidas += 1;
    map.set(v.destino, atual);
  });

  const rows = Array.from(map, ([destino, n]) => ({ destino, ...n }))
    .filter((r) => r.saidas > 0)
    .sort((a, b) => b.saidas - a.saidas);
  const max = Math.max(1, ...rows.map((r) => r.saidas));

  if (!rows.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sem saídas para o recorte atual
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li
          key={r.destino}
          className="grid grid-cols-[128px_minmax(0,1fr)_52px] items-center gap-3"
          title={`${r.saidas} de ${r.programados} programados`}
        >
          <span className="truncate text-sm text-muted-foreground">{r.destino}</span>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(r.saidas / max) * 100}%`,
                backgroundColor: "var(--primary)",
              }}
            />
          </div>
          <span className="tabular text-right text-sm font-medium text-foreground">
            {r.saidas}
            <span className="text-subtle">/{r.programados}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
