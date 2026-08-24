import type { Vehicle } from "@/data/vehicleModel";

/**
 * Cumprimento das saídas — lê o mesmo registro travado dos cards.
 * "No horário" aqui é exatamente o card "Saíram no horário": uma
 * vez que o veículo saiu, a classificação não muda mais.
 */
export function DepartureSlaChart({ vehicles }: { vehicles: Vehicle[] }) {
  const saidos = vehicles.filter((v) => v.saiu);
  const noHorario = saidos.filter((v) => v.saidaStatus === "no_horario").length;
  const leve = saidos.filter((v) => v.saidaStatus === "atraso_leve").length;
  const alto = saidos.filter((v) => v.saidaStatus === "atraso_alto").length;
  const conferir = saidos.filter((v) => v.saidaStatus === "registrada").length;
  const naoSaiu = vehicles.filter((v) => !v.saiu && v.situacao === "Nao saiu").length;
  const aguardando = vehicles.filter((v) => !v.saiu && v.situacao !== "Nao saiu").length;

  const rows = [
    { label: "No horário", value: noHorario, color: "var(--ok)" },
    { label: "Atraso até 60 min", value: leve, color: "var(--warn)" },
    { label: "Atraso acima de 60 min", value: alto, color: "var(--crit)" },
    { label: "Conferir horário", value: conferir, color: "var(--transfer)" },
    { label: "Aguardando saída", value: aguardando, color: "var(--subtle)" },
    { label: "Não saiu", value: naoSaiu, color: "var(--muted-foreground)" },
  ].filter((r) => r.value > 0 || r.label !== "Não saiu");

  const total = vehicles.length || 1;
  const classificados = noHorario + leve + alto;
  const pct = classificados ? Math.round((noHorario / classificados) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="tabular text-[32px] leading-none font-semibold tracking-tight text-foreground">
          {pct}%
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {classificados
            ? `${noHorario} de ${classificados} saídas medidas dentro do horário-limite`
            : "nenhuma saída medida ainda"}
        </p>
      </div>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-muted-foreground">{r.label}</span>
              <span className="tabular text-sm font-medium text-foreground">{r.value}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(r.value / total) * 100}%`,
                  backgroundColor: r.color,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
