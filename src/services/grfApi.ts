export const GRF_API_URL =
  "https://script.google.com/macros/s/AKfycbwrFVjEI82_IDG5FNZ58S5_mYTsFtIFA1eX17W__2lbulB3mKxGTh_iPwuPq-gLhSmhtQ/exec";

export interface GrfMonitoramento {
  atualizadoEm?: string | null;
  placa?: string | null;
  destino?: string | null;
  transportadora?: string | null;
  statusEclipse?: string | null;
  situacao?: string | null;
  velocidade?: number | null;
  gpsDataHora?: string | null;
  gpsIdadeMin?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  endereco?: string | null;
  paradoDesde?: string | null;
  paradoMin?: number | null;
  hodometro?: number | null;
  zonaGps?: string | null;
  chegouViaGps?: boolean | null;
  chegouGpsDataHora?: string | null;
}

export interface GrfOperacao {
  linha?: number | string | null;
  dataOperacional?: string | null;
  placa?: string | null;
  placaOriginal?: string | null;
  motorista?: string | null;
  transportadora?: string | null;
  destino?: string | null;
  tipo?: string | null;
  /** Nome do ponto de apoio quando a rota é de transbordo. */
  pontoApoio?: string | null;
  horarioLimite?: string | null;
  dataHoraPrevistaSaida?: string | null;
  saiu?: boolean | null;
  horaSaida?: string | null;
  dataHoraSaida?: string | null;
  fonteHoraSaida?: string | null;
  horarioSaidaDivergente?: boolean | null;
  statusSaidaInconsistente?: boolean | null;
  slaSaidaConfiavel?: boolean | null;
  saidaAtrasoMin?: number | null;
  saidaStatus?: string | null;
  atrasoTexto?: string | null;
  statusPrazo?: string | null;
  chegou?: boolean | null;
  horaChegada?: string | null;
  dataHoraChegada?: string | null;
  fonteHoraChegada?: string | null;
  horarioChegadaDivergente?: boolean | null;
  statusChegadaInconsistente?: boolean | null;
  tempoViagemMin?: number | null;
  travaManual?: boolean | null;
  /** Registro de saída já carimbado: não muda mais no restante do dia. */
  registroTravado?: boolean | null;
  /** Estado operacional calculado pelo script — a mesma régua dos cards. */
  estado?: string | null;
  paradoMin?: number | null;
  gpsIdadeMin?: number | null;
  zonaGps?: string | null;
}

/** Uma linha do ranking histórico de atraso na saída. */
export interface GrfHistoricoRanking {
  nome?: string | null;
  placa?: string | null;
  transportadora?: string | null;
  destino?: string | null;
  programados?: number | null;
  saidas?: number | null;
  noHorario?: number | null;
  atrasadas?: number | null;
  atrasoMedioMin?: number | null;
  atrasoMaxMin?: number | null;
  pctNoHorario?: number | null;
  diasComRegistro?: number | null;
}

export interface GrfHistorico {
  dias?: number | null;
  de?: string | null;
  ate?: string | null;
  totalProgramados?: number | null;
  totalSaidas?: number | null;
  transportadoras?: GrfHistoricoRanking[] | null;
  veiculos?: GrfHistoricoRanking[] | null;
}

export interface GrfPayload {
  ok?: boolean;
  servidor?: string | null;
  timezone?: string | null;
  staleMin?: number | null;
  stopWarnMin?: number | null;
  /** Minutos parado a partir dos quais o veículo entra no card "Parados". */
  stopCritMin?: number | null;
  /** Minutos parado a partir dos quais o veículo entra no card "Em atenção". */
  stopAttentionMin?: number | null;
  atrasoAltoMin?: number | null;
  dataOperacional?: string | null;
  monitoramento?: GrfMonitoramento[] | null;
  operacao?: GrfOperacao[] | null;
  historico?: GrfHistorico | null;
}

export async function fetchGrfPayload(signal?: AbortSignal): Promise<GrfPayload> {
  const res = await fetch(GRF_API_URL, { cache: "no-store", signal: signal ?? null });
  if (!res.ok) throw new Error(`Falha na API (${res.status})`);
  const data = (await res.json()) as GrfPayload;
  if (data?.ok === false) throw new Error("API retornou erro");
  return data;
}
