import { ArrowLeftRight, MapPin } from "lucide-react";
import type { Vehicle } from "@/data/vehicleModel";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./ui-bits";

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
        <p className="text-sm text-muted-foreground">
          Nenhum transbordo no recorte atual
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pontos.map((ponto) => {
        const grupo = transbordos.filter((v) => v.destino === ponto);
        const sairam = grupo.filter((v) => v.saiu).length;
        const chegaram = grupo.filter((v) => v.chegouTransbordo);
        const aCaminho = Math.max(0, sairam - chegaram.length);
        const aguardandoSaida = Math.max(0, grupo.length - sairam);
        const ultimaChegada = chegaram
          .filter((v) => !!v.chegadaTransbordoIso)
          .slice()
          .sort((a, b) => {
            const ta = a.chegadaTransbordoIso
              ? new Date(a.chegadaTransbordoIso).getTime()
              : 0;
            const tb = b.chegadaTransbordoIso
              ? new Date(b.chegadaTransbordoIso).getTime()
              : 0;
            return ta - tb;
          })
          .map((v) => v.chegadaTransbordo)
          .filter((h): h is string => !!h)
          .at(-1);
        const active = activeDestino === ponto;

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
                <span className="truncate text-sm font-semibold tracking-[0.06em] text-foreground uppercase">
                  {ponto}
                </span>
              </span>
              {chegaram.length === grupo.length && grupo.length > 0 ? (
                <StatusBadge label="Concluído" tone="ok" />
              ) : aCaminho > 0 ? (
                <StatusBadge label={`${aCaminho} a caminho`} tone="transfer" />
              ) : aguardandoSaida > 0 ? (
                <StatusBadge label={`${aguardandoSaida} aguardando`} tone="transfer" />
              ) : (
                <StatusBadge label="Concluído" tone="ok" />
              )}
            </div>
            <dl className="tabular mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "Programados", v: grupo.length },
                { k: "Saíram", v: sairam },
                { k: "Chegaram", v: chegaram.length },
              ].map((i) => (
                <div key={i.k} className="rounded-lg bg-card px-2 py-2.5">
                  <dd className="text-xl font-semibold text-foreground">{i.v}</dd>
                  <dt className="mt-0.5 text-[10px] tracking-[0.06em] text-subtle uppercase">
                    {i.k}
                  </dt>
                </div>
              ))}
            </dl>
            <p className="tabular mt-3 text-xs text-muted-foreground">
              Última chegada:{" "}
              <span className="font-medium text-foreground">{ultimaChegada ?? "—"}</span>
            </p>
          </button>
        );
      })}
    </div>
  );
}
