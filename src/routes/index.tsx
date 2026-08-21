import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  ClipboardCheck,
  TruckIcon,
  Navigation,
  PauseCircle,
  TriangleAlert,
  ArrowLeftRight,
  Warehouse,
  Map as MapIcon,
  Bell,
  Activity,
  ChartNoAxesCombined,
  Route as RouteIcon,
  PieChart,
  History,
  X,
} from "lucide-react";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { LiveMap } from "@/components/dashboard/LiveMap";
import { OperationalAlerts } from "@/components/dashboard/OperationalAlerts";
import { FleetStatusChart } from "@/components/dashboard/FleetStatusChart";
import { DepartureSlaChart } from "@/components/dashboard/DepartureSlaChart";
import { LiveOperationTable } from "@/components/dashboard/LiveOperationTable";
import { TransshipmentPanel } from "@/components/dashboard/TransshipmentPanel";
import { RouteDepartureChart } from "@/components/dashboard/RouteDepartureChart";
import { OperationalTimeline } from "@/components/dashboard/OperationalTimeline";
import { Panel } from "@/components/dashboard/ui-bits";
import {
  applyFilters,
  destinosDe,
  emptyFilters,
  kpiLabels,
  kpiPredicates,
  transportadorasDe,
  type Filters,
  type KpiKey,
} from "@/data/vehicleModel";
import { useGrfLiveData } from "@/hooks/useGrfLiveData";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Torre de Controle — Monitoramento GPS" },
      {
        name: "description",
        content:
          "Torre de Controle GRF: monitoramento GPS em tempo real da operação de distribuição e transbordo, com mapa ao vivo, alertas e cumprimento de saídas.",
      },
      { property: "og:title", content: "Torre de Controle — Monitoramento GPS" },
      {
        property: "og:description",
        content:
          "Gestão à vista da frota GRF: veículos em rota, parados, em atenção, transbordos e horários reais de saída.",
      },
    ],
  }),
  component: TorreDeControle,
});

function TorreDeControle() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [kpi, setKpi] = useState<KpiKey | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readAlerts, setReadAlerts] = useState<string[]>([]);

  const live = useGrfLiveData();
  const allVehicles = live.vehicles;

  const baseFiltered = useMemo(
    () => applyFilters(allVehicles, filters, null),
    [allVehicles, filters],
  );
  const vehicles = useMemo(
    () => applyFilters(allVehicles, filters, kpi),
    [allVehicles, filters, kpi],
  );

  const count = (key: KpiKey) => baseFiltered.filter(kpiPredicates[key]).length;
  const saidos = baseFiltered.filter((v) => v.saiu).length;
  const pctNoHorario = saidos ? Math.round((count("noHorario") / saidos) * 100) : 0;

  const placas = new Set(vehicles.map((v) => v.placa));
  const alerts = live.alerts.filter(
    (a) => placas.has(a.placa) && !readAlerts.includes(a.id),
  );
  const timeline = live.timeline.filter((e) => placas.has(e.placa));

  const toggleKpi = (key: KpiKey) =>
    setKpi((c) => (key === "programados" ? null : c === key ? null : key));

  const cards = [
    {
      key: "programados" as const,
      label: "Programados",
      value: count("programados"),
      hint: "veículos na operação",
      icon: ClipboardCheck,
      tone: "brand" as const,
    },
    {
      key: "noHorario" as const,
      label: "Saíram no horário",
      value: count("noHorario"),
      hint: "dentro da janela prevista",
      extra: `${pctNoHorario}%`,
      icon: TruckIcon,
      tone: "ok" as const,
    },
    {
      key: "emRota" as const,
      label: "Em rota",
      value: count("emRota"),
      hint: "veículos em deslocamento",
      icon: Navigation,
      tone: "cyan" as const,
    },
    {
      key: "parados" as const,
      label: "Parados",
      value: count("parados"),
      hint: "veículos sem movimento",
      icon: PauseCircle,
      tone: "warn" as const,
    },
    {
      key: "atencao" as const,
      label: "Em atenção",
      value: count("atencao"),
      hint: "necessitam acompanhamento",
      icon: TriangleAlert,
      tone: "crit" as const,
    },
    {
      key: "transbordos" as const,
      label: "Transbordos",
      value: count("transbordos"),
      hint: "operação de apoio",
      icon: ArrowLeftRight,
      tone: "transfer" as const,
    },
    {
      key: "naBase" as const,
      label: "Na base",
      value: count("naBase"),
      hint: "aguardando saída",
      icon: Warehouse,
      tone: "brand" as const,
    },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          atualizadoEm={live.atualizadoEm}
          loading={live.loading}
          onRefresh={live.refresh}
        />

        <main className="flex min-w-0 flex-col gap-4 p-3 sm:p-4 md:p-6">
          {live.error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[color-mix(in_oklab,var(--warn)_30%,transparent)] bg-[color-mix(in_oklab,var(--warn)_10%,transparent)] px-4 py-2.5 text-sm text-foreground">
              <AlertTriangle className="size-4 shrink-0 text-warn" />
              <span className="min-w-0 truncate">
                Falha ao atualizar os dados ({live.error}). Exibindo a última leitura de{" "}
                {live.atualizadoEm}.
              </span>
            </div>
          )}

          <FilterBar
            transportadoras={transportadorasDe(allVehicles)}
            destinos={destinosDe(allVehicles)}
            filters={filters}
            onChange={setFilters}
            onClear={() => {
              setFilters(emptyFilters);
              setKpi(null);
            }}
          />

          {kpi && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-primary-soft px-4 py-2.5">
              <Activity className="size-4 text-primary" />
              <span className="text-sm text-foreground">
                Filtro ativo:{" "}
                <span className="font-semibold">{kpiLabels[kpi]}</span> ·{" "}
                <span className="tabular">{vehicles.length}</span> veículos
              </span>
              <button
                type="button"
                onClick={() => setKpi(null)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground"
              >
                <X className="size-3.5" />
                Limpar filtro
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {cards.map((c) => (
              <KpiCard
                key={c.key}
                label={c.label}
                value={c.value}
                hint={c.hint}
                extra={"extra" in c ? c.extra : undefined}
                icon={c.icon}
                tone={c.tone}
                active={kpi === c.key || (c.key === "programados" && kpi === null)}
                onClick={() => toggleKpi(c.key)}
              />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
            <Panel
              title="Mapa ao vivo"
              subtitle={`${vehicles.length} veículos monitorados`}
              icon={<MapIcon className="size-4" />}
              className="h-[460px] md:h-[600px] xl:h-[760px]"
              bodyClassName="p-0"
            >
              <LiveMap
                vehicles={vehicles}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </Panel>

            <Panel
              title="Alertas operacionais"
              subtitle={`${alerts.length} ocorrências pendentes`}
              icon={<Bell className="size-4" />}
              bodyClassName="p-3"
            >
              <OperationalAlerts
                alerts={alerts}
                onRead={(id) => setReadAlerts((r) => [...r, id])}
              />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Panel
              title="Status da frota"
              icon={<PieChart className="size-4" />}
              className="xl:col-span-1"
            >
              <FleetStatusChart vehicles={vehicles} />
            </Panel>
            <Panel title="Cumprimento das saídas" icon={<ChartNoAxesCombined className="size-4" />}>
              <DepartureSlaChart vehicles={vehicles} />
            </Panel>
            <Panel
              title="Últimos eventos"
              icon={<History className="size-4" />}
              className="lg:col-span-2 xl:col-span-1"
            >
              <OperationalTimeline events={timeline} />
            </Panel>
          </div>

          <Panel
            title="Operação ao vivo"
            subtitle={`${vehicles.length} veículos`}
            icon={<TruckIcon className="size-4" />}
            bodyClassName=""
          >
            <LiveOperationTable
              vehicles={vehicles}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </Panel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Panel title="Transbordo" icon={<ArrowLeftRight className="size-4" />}>
              <TransshipmentPanel
                vehicles={vehicles}
                activeDestino={filters.destino}
                onSelectDestino={(d) => setFilters({ ...filters, destino: d })}
              />
            </Panel>
            <Panel title="Saídas por rota" icon={<RouteIcon className="size-4" />}>
              <RouteDepartureChart vehicles={vehicles} />
            </Panel>
          </div>
        </main>
      </div>
    </div>
  );
}
