import { ArrowLeftRight, MapPin } from "lucide-react";
import type { Vehicle } from "@/data/vehicleModel";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./ui-bits";

function tsDe(iso: string | null) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Transbordo com a mesma leitura dos cards: quantos saíram, quantos
 * saíram no horário e que horas chegaram no ponto de apoio — tudo
 * vindo do registro travado, não recalculado a cada atualização.
 */
export function TransshipmentPanel({
  vehicles,
  activeDestino,
  onSelectDestino,
}: {
  vehicles: Vehicle[];
  activeDestino: string;
  onSelectDestino: (destino: string) => void;
}) {
  const transbordos = vehicles.filter((v) => v.tipo === "Transbordo");
  const pontos = Array.from(new Set(transbordos.map((v) => v.destino)));

  if (!pontos.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <ArrowLeftRight className="size-6 text-subtle" />
        <p className="text-sm text-muted-foreground">Nenhum transbordo no recorte atual</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pontos.map((ponto) => {
        const grupo = transbordos.filter((v) => v.destino === ponto);
        const sairam = grupo.filter((v) => v.saiu);
        const noHorario = sairam.filter((v) => v.saidaStatus === "no_horario").length;
        const chegaram = grupo.filter((v) => v.chegouTransbordo);
        const aCaminho = sairam.length - chegaram.length;
        const aguardando = grupo.length - sairam.length;
        const active = activeDestino === ponto;
        const pontoApoio = grupo.find((v) => v.pontoApoio)?.pontoApoio ?? null;

        const linhas = grupo
          .slice()
          .sort((a, b) => tsDe(a.saidaRealIso) - tsDe(b.saidaRealIso))
          .slice(0, 4);

        return (
          <button
            key={ponto}
            type="button"
            onClick={() => onSelectDestino(active ? "todos" : ponto)}
            className={cn(
              "rounded-xl border border-border bg-card-elevated p-4 text-left transition-colors hover:border-border-strong",
              active && "border-[color-mix(in_oklab,var(--transfer)_45%,transparent)]",
            )}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <MapPin className="size-4 shrink-0 text-transfer" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold tracking-[0.06em] text-foreground uppercase">
                    {ponto}
                  </span>
                  {pontoApoio && pontoApoio.toUpperCase() !== ponto.toUpperCase() && (
                    <span className="block truncate text-[11px] text-subtle">
                      Ponto de apoio: {pontoApoio}
                    </span>
                  )}
                </span>
              </span>
              {grupo.length > 0 && chegaram.length === grupo.length ? (
                <StatusBadge label="Concluído" tone="ok" />
              ) : aCaminho > 0 ? (
                <StatusBadge label={`${aCaminho} a caminho`} tone="transfer" />
              ) : aguardando > 0 ? (
                <StatusBadge label={`${aguardando} aguardando`} tone="transfer" />
              ) : (
                <StatusBadge label="Concluído" tone="ok" />
              )}
            </div>

            <dl className="tabular mt-4 grid grid-cols-4 gap-2 text-center">
              {[
                { k: "Program.", v: grupo.length, cor: "text-foreground" },
                { k: "Saíram", v: sairam.length, cor: "text-foreground" },
                { k: "No horário", v: noHorario, cor: "text-ok" },
                { k: "Chegaram", v: chegaram.length, cor: "text-transfer" },
              ].map((i) => (
                <div key={i.k} className="rounded-lg bg-card px-1.5 py-2.5">
                  <dd className={cn("text-xl font-semibold", i.cor)}>{i.v}</dd>
                  <dt className="mt-0.5 text-[10px] tracking-[0.04em] text-subtle uppercase">
                    {i.k}
                  </dt>
                </div>
              ))}
            </dl>

            <ul className="tabular mt-3 flex flex-col gap-1 text-xs">
              {linhas.map((v) => (
                <li
                  key={v.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2"
                >
                  <span className="truncate font-medium text-foreground">{v.placa}</span>
                  <span
                    className={cn(
                      "whitespace-nowrap",
                      v.saidaStatus === "no_horario"
                        ? "text-ok"
                        : v.saidaStatus === "atraso_alto"
                          ? "text-crit"
                          : v.saiu
                            ? "text-warn"
                            : "text-subtle",
                    )}
                    title="Saída"
                  >
                    saiu {v.saidaReal ?? "—"}
                  </span>
                  <span className="w-[92px] text-right whitespace-nowrap text-muted-foreground">
                    PA {v.chegadaTransbordo ?? "—"}
                  </span>
                </li>
              ))}
              {grupo.length > linhas.length && (
                <li className="text-[11px] text-subtle">
                  +{grupo.length - linhas.length} veículo(s) neste ponto
                </li>
              )}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
