export type VehicleTipo = "Distribuicao" | "Transbordo";

export type StatusGps =
  | "Em rota"
  | "Parado"
  | "Em atencao"
  | "GPS desatualizado"
  | "Na base";

export type Situacao =
  | "No horario"
  | "Atraso leve"
  | "Atraso alto"
  | "Aguardando saida"
  | "Conferir horario"
  | "Concluido";

export type SaidaStatus =
  | "pendente"
  | "registrada"
  | "no_horario"
  | "atraso_leve"
  | "atraso_alto";

export interface Vehicle {
  id: string;
  placa: string;
  motorista: string;
  transportadora: string;
  tipo: VehicleTipo;
  destino: string;
  statusGps: StatusGps;
  saidaPrevista: string;
  saidaReal: string | null;
  chegadaTransbordo: string | null;
  velocidade: number;
  tempoParadoMin: number | null;
  ultimaPosicao: string;
  latitude: number | null;
  longitude: number | null;
  gpsAtualizadoEm: number | null;
  situacao: Situacao;
  // camada real
  saiu: boolean;
  chegouTransbordo: boolean;
  emAtencao: boolean;
  gpsDesatualizado: boolean;
  monitorSituacao: string | null;
  saidaStatus: SaidaStatus;
  saidaAtrasoMin: number | null;
  slaSaidaConfiavel: boolean;
  saidaRealIso: string | null;
  chegadaTransbordoIso: string | null;
  horarioSaidaDivergente: boolean;
  statusSaidaInconsistente: boolean;
  horarioChegadaDivergente: boolean;
  statusChegadaInconsistente: boolean;
}

export type KpiKey =
  | "programados"
  | "noHorario"
  | "emRota"
  | "parados"
  | "atencao"
  | "transbordos"
  | "naBase";

export const kpiPredicates: Record<KpiKey, (v: Vehicle) => boolean> = {
  programados: () => true,
  noHorario: (v) => v.saiu && v.slaSaidaConfiavel && v.saidaStatus === "no_horario",
  emRota: (v) => v.statusGps === "Em rota",
  parados: (v) => v.statusGps === "Parado",
  atencao: (v) => v.emAtencao,
  transbordos: (v) => v.tipo === "Transbordo",
  naBase: (v) => !v.saiu,
};

export const kpiLabels: Record<KpiKey, string> = {
  programados: "Programados",
  noHorario: "Saíram no horário",
  emRota: "Em rota",
  parados: "Parados",
  atencao: "Em atenção",
  transbordos: "Transbordos",
  naBase: "Na base",
};

export interface Filters {
  transportadora: string;
  tipo: string;
  status: string;
  destino: string;
}

export const emptyFilters: Filters = {
  transportadora: "todas",
  tipo: "todos",
  status: "todos",
  destino: "todos",
};

export function applyFilters(
  vehicles: Vehicle[],
  filters: Filters,
  kpi: KpiKey | null,
): Vehicle[] {
  return vehicles.filter((v) => {
    if (filters.transportadora !== "todas" && v.transportadora !== filters.transportadora)
      return false;
    if (filters.tipo !== "todos" && v.tipo !== filters.tipo) return false;
    if (filters.status !== "todos" && v.statusGps !== filters.status) return false;
    if (filters.destino !== "todos" && v.destino !== filters.destino) return false;
    if (kpi && !kpiPredicates[kpi](v)) return false;
    return true;
  });
}

export function transportadorasDe(vehicles: Vehicle[]): string[] {
  return Array.from(new Set(vehicles.map((v) => v.transportadora).filter(Boolean))).sort();
}

export function destinosDe(vehicles: Vehicle[]): string[] {
  return Array.from(new Set(vehicles.map((v) => v.destino).filter(Boolean))).sort();
}

export const statusOptions: StatusGps[] = [
  "Em rota",
  "Parado",
  "Em atencao",
  "GPS desatualizado",
  "Na base",
];

export interface AlertItem {
  id: string;
  categoria: "Critico" | "Atencao" | "Informativo";
  titulo: string;
  placa: string;
  detalhe: string;
}

export interface TimelineEvent {
  id: string;
  hora: string;
  placa: string;
  evento: string;
  tipo: "chegada" | "movimento" | "saida" | "parada";
}
