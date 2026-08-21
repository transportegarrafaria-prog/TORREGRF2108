import type { Vehicle } from "@/data/vehicleModel";

export function RouteDepartureChart({ vehicles }: { vehicles: Vehicle[] }) {
  const map = new Map<string, number>();
  vehicles
    .filter((v) => v.saiu)
    .forEach((v) => map.set(v.destino, (map.get(v.destino) ?? 0) + 1));
  const rows = Array.from(map, ([destino, total]) => ({ destino, total })).sort(
    (a, b) => b.total - a.total,
  );
  const max = Math.max(1, ...rows.map((r) => r.total));

  if (!rows.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sem saídas para o recorte atual
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.destino} className="grid grid-cols-[128px_minmax(0,1fr)_36px] items-center gap-3">
          <span className="truncate text-sm text-muted-foreground">{r.destino}</span>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(r.total / max) * 100}%`,
                backgroundColor: i === 0 ? "var(--primary)" : "var(--chart-4)",
                opacity: i === 0 ? 1 : 0.85 - Math.min(i, 4) * 0.12,
              }}
            />
          </div>
          <span className="tabular text-right text-sm font-medium text-foreground">
            {r.total}
          </span>
        </li>
      ))}
    </ul>
  );
}
