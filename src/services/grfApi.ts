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
  chegou?: boolean | null;
  horaChegada?: string | null;
  dataHoraChegada?: string | null;
  fonteHoraChegada?: string | null;
  horarioChegadaDivergente?: boolean | null;
  statusChegadaInconsistente?: boolean | null;
  travaManual?: boolean | null;
}

export interface GrfPayload {
  ok?: boolean;
  servidor?: string | null;
  timezone?: string | null;
  staleMin?: number | null;
  stopWarnMin?: number | null;
  stopCritMin?: number | null;
  dataOperacional?: string | null;
  monitoramento?: GrfMonitoramento[] | null;
  operacao?: GrfOperacao[] | null;
}

export async function fetchGrfPayload(signal?: AbortSignal): Promise<GrfPayload> {
  const res = await fetch(GRF_API_URL, { cache: "no-store", signal: signal ?? null });
  if (!res.ok) throw new Error(`Falha na API (${res.status})`);
  const data = (await res.json()) as GrfPayload;
  if (data?.ok === false) throw new Error("API retornou erro");
  return data;
}
