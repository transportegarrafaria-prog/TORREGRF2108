import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Clock3 } from "lucide-react";
import type { HistoricoIndicador, RankingAtraso } from "@/data/vehicleModel";

const LIMITE_BARRAS = 6;
/** Série única: o comprimento da barra já codifica a magnitude, a cor não repete isso. */
const COR_BARRA = "var(--primary)";

function fmtMin(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function fmtDia(iso: string | null) {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-");
  return ano && mes && dia ? `${dia}/${mes}` : null;
}

interface Ponto extends RankingAtraso {
  curto: string;
}

function DicaAtraso({ active, payload }: { active?: boolean; payload?: { payload: Ponto }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-border-strong bg-card px-3 py-2.5 shadow-lg">
      <p className="text-sm font-semibold text-foreground">{d.rotulo}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{d.detalhe}</p>
      <dl className="tabular mt-2 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-xs">
        <dt className="text-subtle">Atraso médio</dt>
        <dd className="text-right font-medium text-foreground">{fmtMin(d.atrasoMedioMin)}</dd>
        <dt className="text-subtle">Pior atraso</dt>
        <dd className="text-right font-medium text-foreground">{fmtMin(d.atrasoMaxMin)}</dd>
        <dt className="text-subtle">Saídas medidas</dt>
        <dd className="text-right font-medium text-foreground">{d.saidas}</dd>
        <dt className="text-subtle">Saíram atrasadas</dt>
        <dd className="text-right font-medium text-foreground">{d.atrasadas}</dd>
        <dt className="text-subtle">No prazo</dt>
        <dd className="text-right font-medium text-foreground">{d.pctNoHorario}%</dd>
      </dl>
    </div>
  );
}

function RotuloBarra(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  dados?: Ponto[];
}) {
  const { x = 0, y = 0, width = 0, height = 0, index = 0, dados = [] } = props;
  const d = dados[index];
  if (!d) return null;
  return (
    <text x={x + width + 8} y={y + height / 2} dominantBaseline="middle" fontSize={12}>
      <tspan fill="var(--foreground)" fontWeight={600}>
        {fmtMin(d.atrasoMedioMin)}
      </tspan>
      <tspan fill="var(--subtle)" dx={6} fontWeight={400}>
        n={d.saidas}
      </tspan>
    </text>
  );
}

function Ranking({
  titulo,
  entidade,
  linhas,
  larguraRotulo,
}: {
  titulo: string;
  entidade: string;
  linhas: RankingAtraso[];
  larguraRotulo: number;
}) {
  const dados: Ponto[] = linhas.slice(0, LIMITE_BARRAS).map((l) => ({
    ...l,
    curto: l.rotulo.length > 20 ? `${l.rotulo.slice(0, 19)}…` : l.rotulo,
  }));

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-[11px] font-semibold tracking-[0.08em] text-subtle uppercase">
        {titulo}
      </h3>
      {!dados.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma saída medida no período
        </p>
      ) : (
        <>
          <div style={{ height: dados.length * 36 + 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dados}
                layout="vertical"
                margin={{ top: 4, right: 56, bottom: 4, left: 0 }}
                barCategoryGap={10}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="curto"
                  width={larguraRotulo}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  content={<DicaAtraso />}
                  cursor={{ fill: "color-mix(in oklab, var(--foreground) 6%, transparent)" }}
                />
                <Bar
                  dataKey="atrasoMedioMin"
                  fill={COR_BARRA}
                  barSize={16}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                >
                  {/*
                    A média vem junto com o tamanho da amostra. Sem isso,
                    "+108min" apoiado numa única saída parece tão firme
                    quanto um apoiado em vinte.
                  */}
                  <LabelList
                    dataKey="atrasoMedioMin"
                    position="right"
                    offset={8}
                    content={<RotuloBarra dados={dados} />}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mesma informação em texto, para leitores de tela e para conferência. */}
          <table className="sr-only">
            <caption>Atraso médio na saída por {entidade}</caption>
            <thead>
              <tr>
                <th>{entidade}</th>
                <th>Atraso médio</th>
                <th>Pior atraso</th>
                <th>Saídas medidas</th>
                <th>No prazo</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.id}>
                  <td>{d.rotulo}</td>
                  <td>{fmtMin(d.atrasoMedioMin)}</td>
                  <td>{fmtMin(d.atrasoMaxMin)}</td>
                  <td>{d.saidas}</td>
                  <td>{d.pctNoHorario}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/**
 * Quem mais atrasa para sair — ranking da aba Histórico.
 * Uma série só (atraso médio na saída), do pior para o melhor;
 * adiantamento conta como zero, então o que aparece é atraso real.
 */
export function DepartureDelayRanking({
  historico,
  transportadoraFiltro,
}: {
  historico: HistoricoIndicador | null;
  transportadoraFiltro?: string;
}) {
  if (!historico) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Clock3 className="size-6 text-subtle" />
        <p className="text-sm text-muted-foreground">
          Sem histórico disponível para o ranking de atrasos
        </p>
        <p className="max-w-sm text-xs text-subtle">
          O indicador é alimentado pela aba Histórico da planilha — publique a versão atual do Apps
          Script para o painel receber esses dados.
        </p>
      </div>
    );
  }

  const filtrar = (linhas: RankingAtraso[], porTransportadora: boolean) =>
    transportadoraFiltro && transportadoraFiltro !== "todas"
      ? linhas.filter((l) =>
          porTransportadora
            ? l.rotulo === transportadoraFiltro
            : l.detalhe === transportadoraFiltro,
        )
      : linhas;

  const periodo = [fmtDia(historico.de), fmtDia(historico.ate)].filter(Boolean).join(" a ");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <Ranking
          titulo="Por transportador"
          entidade="Transportador"
          linhas={filtrar(historico.transportadoras, true)}
          larguraRotulo={150}
        />
        <Ranking
          titulo="Por veículo"
          entidade="Veículo"
          linhas={filtrar(historico.veiculos, false)}
          larguraRotulo={86}
        />
      </div>
      <p className="text-xs text-subtle">
        Atraso médio na saída · aba Histórico
        {periodo ? `, ${periodo}` : `, últimos ${historico.dias} dias`} ·{" "}
        <span className="tabular">{historico.totalSaidas}</span> saídas medidas · adiantamento conta
        como zero · <span className="tabular">n</span> = saídas que sustentam cada média
      </p>
    </div>
  );
}
