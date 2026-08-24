export type VehicleTipo = "Distribuicao" | "Transbordo";

/**
 * Estado operacional do veículo — régua única do painel.
 * Os cards, o gráfico de Status da Frota e o filtro de status
 * leem daqui, então os números batem em todo lugar.
 *
 *   Na base    ainda não saiu da GRF
 *   Em rota    em movimento (parada curta ainda conta como em rota)
 *   Parado     parado de 45 min a 1h
 *   Em atencao parada prolongada, acima de 1h
 *   Sem sinal  sem leitura de GPS recente
 *   Concluido  transbordo que já chegou no ponto de apoio
 */
export type EstadoFrota =
  "Na base" | "Em rota" | "Parado" | "Em atencao" | "Sem sinal" | "Concluido";

/** Situação da SAÍDA — congela no instante em que o veículo sai. */
export type Situacao =
  | "No horario"
  | "Atraso leve"
  | "Atraso alto"
  | "Aguardando saida"
  | "Nao saiu"
  | "Conferir horario";

export type SaidaStatus = "pendente" | "registrada" | "no_horario" | "atraso_leve" | "atraso_alto";

export interface Vehicle {
  id: string;
  placa: string;
  motorista: string;
  transportadora: string;
  tipo: VehicleTipo;
  destino: string;
  /** Ponto de apoio da rota de transbordo (Penha, Barra Mansa, ...). */
  pontoApoio: string | null;
  estado: EstadoFrota;
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
  saiu: boolean;
  chegouTransbordo: boolean;
  emAtencao: boolean;
  gpsDesatualizado: boolean;
  monitorSituacao: string | null;
  saidaStatus: SaidaStatus;
  /** Atraso da saída em minutos, congelado no momento da saída. */
  saidaAtrasoMin: number | null;
  atrasoTexto: string | null;
  /** true quando a saída tem carimbo de GPS — o registro não muda mais hoje. */
  registroTravado: boolean;
  slaSaidaConfiavel: boolean;
  saidaRealIso: string | null;
  chegadaTransbordoIso: string | null;
  tempoViagemMin: number | null;
  travaManual: boolean;
}

export type KpiKey =
  "programados" | "noHorario" | "emRota" | "parados" | "atencao" | "transbordos" | "naBase";

/**
 * Regras dos cards. São as mesmas do script:
 * saída travada uma vez detectada, parado a partir de 45 min,
 * atenção acima de 1h.
 */
export const kpiPredicates: Record<KpiKey, (v: Vehicle) => boolean> = {
  programados: () => true,
  noHorario: (v) => v.saiu && v.saidaStatus === "no_horario",
  emRota: (v) => v.estado === "Em rota",
  parados: (v) => v.estado === "Parado",
  atencao: (v) => v.estado === "Em atencao",
  transbordos: (v) => v.tipo === "Transbordo",
  naBase: (v) => v.estado === "Na base",
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

/** Ordem e rótulo dos estados no gráfico de Status da Frota. */
export const estadoOrdem: EstadoFrota[] = [
  "Em rota",
  "Parado",
  "Em atencao",
  "Sem sinal",
  "Concluido",
  "Na base",
];

export const estadoLabels: Record<EstadoFrota, string> = {
  "Em rota": "Em rota",
  Parado: "Parados",
  "Em atencao": "Em atenção",
  "Sem sinal": "Sem sinal GPS",
  Concluido: "Concluídos",
  "Na base": "Na base",
};

export const estadoCores: Record<EstadoFrota, string> = {
  "Em rota": "var(--ok)",
  Parado: "var(--warn)",
  "Em atencao": "var(--crit)",
  "Sem sinal": "var(--grf-cyan)",
  Concluido: "var(--transfer)",
  "Na base": "var(--subtle)",
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

export function applyFilters(vehicles: Vehicle[], filters: Filters, kpi: KpiKey | null): Vehicle[] {
  return vehicles.filter((v) => {
    if (filters.transportadora !== "todas" && v.transportadora !== filters.transportadora)
      return false;
    if (filters.tipo !== "todos" && v.tipo !== filters.tipo) return false;
    if (filters.status !== "todos" && v.estado !== filters.status) return false;
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

export const statusOptions: EstadoFrota[] = estadoOrdem;

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

/** Uma linha do ranking histórico de atraso na saída (aba Histórico). */
export interface RankingAtraso {
  id: string;
  rotulo: string;
  detalhe: string;
  saidas: number;
  atrasadas: number;
  noHorario: number;
  atrasoMedioMin: number;
  atrasoMaxMin: number;
  pctNoHorario: number;
}

export interface HistoricoIndicador {
  dias: number;
  de: string | null;
  ate: string | null;
  totalSaidas: number;
  transportadoras: RankingAtraso[];
  veiculos: RankingAtraso[];
}
