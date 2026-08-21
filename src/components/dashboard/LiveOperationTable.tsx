import { Inbox } from "lucide-react";
import type { Vehicle } from "@/data/vehicleModel";
import { cn } from "@/lib/utils";
import { StatusBadge, gpsLabel, gpsTone, situacaoLabel, situacaoTone } from "./ui-bits";

function fmtParado(min: number | null) {
  if (min === null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}` : `${m} min`;
}

const headers = [
  "Placa",
  "Motorista",
  "Transportadora",
  "Tipo",
  "Destino / Ponto",
  "Status GPS",
  "Saída prevista",
  "Saída real",
  "Chegada transbordo",
  "Velocidade",
  "Tempo parado",
  "Última posição",
  "Última atualização",
  "Situação",
];

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Inbox className="size-6 text-subtle" />
      <p className="text-sm text-muted-foreground">
        Nenhum veículo corresponde aos filtros aplicados
      </p>
    </div>
  );
}

export function LiveOperationTable({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: Vehicle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!vehicles.length) return <Empty />;

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden max-h-[560px] overflow-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="border-b border-border px-4 py-3 text-left text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-subtle uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr
                key={v.id}
                onClick={() => onSelect(v.id)}
                className={cn(
                  "cursor-pointer border-b border-border/70 transition-colors hover:bg-white/[0.03]",
                  selectedId === v.id && "bg-primary-soft",
                )}
              >
                <td className="tabular px-4 py-3 font-semibold whitespace-nowrap text-foreground">
                  {v.placa}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{v.motorista}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {v.transportadora}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {v.tipo === "Transbordo" ? (
                    <StatusBadge label="Transbordo" tone="transfer" dot={false} />
                  ) : (
                    <span className="text-muted-foreground">Distribuição</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-foreground">{v.destino}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge label={gpsLabel(v.statusGps)} tone={gpsTone(v.statusGps)} />
                </td>
                <td className="tabular px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {v.saidaPrevista}
                </td>
                <td className="tabular px-4 py-3 font-medium whitespace-nowrap text-foreground">
                  {v.saidaReal ?? "—"}
                </td>
                <td className="tabular px-4 py-3 whitespace-nowrap">
                  {v.tipo === "Transbordo" && v.chegadaTransbordo ? (
                    <span className="font-medium text-transfer">{v.chegadaTransbordo}</span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
                <td className="tabular px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {v.velocidade} km/h
                </td>
                <td className="tabular px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {fmtParado(v.tempoParadoMin)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {v.ultimaPosicao}
                </td>
                <td className="tabular px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {v.gpsAtualizadoEm === null ? "—" : `há ${v.gpsAtualizadoEm} min`}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge
                    label={situacaoLabel(v.situacao)}
                    tone={situacaoTone(v.situacao)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="flex max-h-[560px] flex-col gap-2 overflow-y-auto p-4 md:hidden">
        {vehicles.map((v) => (
          <li
            key={v.id}
            onClick={() => onSelect(v.id)}
            className={cn(
              "rounded-lg border border-border bg-card-elevated p-3",
              selectedId === v.id && "border-primary/50",
            )}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="tabular truncate font-semibold text-foreground">{v.placa}</span>
              <StatusBadge label={gpsLabel(v.statusGps)} tone={gpsTone(v.statusGps)} />
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {v.motorista} · {v.transportadora} · {v.destino}
            </p>
            <dl className="tabular mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-subtle">Saída prevista</dt>
                <dd className="text-foreground">{v.saidaPrevista}</dd>
              </div>
              <div>
                <dt className="text-subtle">Saída real</dt>
                <dd className="text-foreground">{v.saidaReal ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-subtle">Chegada transbordo</dt>
                <dd className="text-foreground">
                  {v.tipo === "Transbordo" ? (v.chegadaTransbordo ?? "—") : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Velocidade</dt>
                <dd className="text-foreground">{v.velocidade} km/h</dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">
                {v.ultimaPosicao}
                {v.gpsAtualizadoEm === null ? "" : ` · há ${v.gpsAtualizadoEm} min`}
              </span>
              <StatusBadge label={situacaoLabel(v.situacao)} tone={situacaoTone(v.situacao)} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
