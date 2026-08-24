import type { GrfHistoricoRanking, GrfMonitoramento, GrfOperacao, GrfPayload } from "./grfApi";
import type {
  AlertItem,
  EstadoFrota,
  HistoricoIndicador,
  RankingAtraso,
  SaidaStatus,
  Situacao,
  TimelineEvent,
  Vehicle,
  VehicleTipo,
} from "@/data/vehicleModel";

const TZ = "America/Sao_Paulo";

/** Réguas padrão — o script manda as dele no payload e elas mandam. */
const PADRAO_STALE_MIN = 15;
const PADRAO_PARADO_MIN = 45;
const PADRAO_ATENCAO_MIN = 60;

export function normPlaca(p: unknown): string {
  return String(p ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function horaDeIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function isoTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function bool(v: unknown): boolean {
  return v === true;
}

function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const transbordoFallbackTerms = [
  "rio de janeiro",
  "penha",
  "barra mansa",
  "lagos",
  "sao pedro da aldeia",
  "cabo frio",
  "aldeia",
  "campos",
  "goytacaz",
  "duque de caxias",
  "caxias",
  "angra",
];

function tipoDe(tipo: unknown, destino: unknown): VehicleTipo {
  if (normalizeTerm(txt(tipo)).startsWith("transbordo")) return "Transbordo";
  if (txt(tipo)) return "Distribuicao";
  const d = normalizeTerm(txt(destino));
  return transbordoFallbackTerms.some((t) => d.includes(t)) ? "Transbordo" : "Distribuicao";
}

/** Data operacional já encerrada: quem não saiu não sai mais. */
function diaEncerrado(dataOperacional: string | null | undefined): boolean {
  const dia = txt(dataOperacional);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return dia < hoje;
}

interface Reguas {
  staleMin: number;
  paradoMin: number;
  atencaoMin: number;
}

function reguasDe(payload: GrfPayload): Reguas {
  return {
    staleMin: num(payload.staleMin) ?? PADRAO_STALE_MIN,
    paradoMin: num(payload.stopCritMin) ?? PADRAO_PARADO_MIN,
    atencaoMin: num(payload.stopAttentionMin) ?? PADRAO_ATENCAO_MIN,
  };
}

const estadosValidos: EstadoFrota[] = [
  "Na base",
  "Em rota",
  "Parado",
  "Em atencao",
  "Sem sinal",
  "Concluido",
];

/**
 * A MESMA regra do Apps Script (estadoOperacional_), repetida aqui
 * para o painel continuar correto mesmo com uma versão antiga do
 * script publicada. Quando o script manda `estado`, ele tem a palavra.
 */
export function estadoDe(
  saiu: boolean,
  chegou: boolean,
  gpsIdadeMin: number | null,
  paradoMin: number | null,
  r: Reguas,
): EstadoFrota {
  if (!saiu) return "Na base";
  if (chegou) return "Concluido";
  if (gpsIdadeMin === null || gpsIdadeMin > r.staleMin) return "Sem sinal";
  const parado = paradoMin ?? 0;
  if (parado >= r.atencaoMin) return "Em atencao";
  if (parado >= r.paradoMin) return "Parado";
  return "Em rota";
}

function saidaStatusDe(v: unknown): SaidaStatus | null {
  const s = txt(v).toLowerCase();
  if (
    s === "pendente" ||
    s === "registrada" ||
    s === "no_horario" ||
    s === "atraso_leve" ||
    s === "atraso_alto"
  )
    return s;
  return null;
}

function situacaoDe(saiu: boolean, status: SaidaStatus, encerrado: boolean): Situacao {
  if (!saiu) return encerrado ? "Nao saiu" : "Aguardando saida";
  switch (status) {
    case "no_horario":
      return "No horario";
    case "atraso_leve":
      return "Atraso leve";
    case "atraso_alto":
      return "Atraso alto";
    default:
      return "Conferir horario";
  }
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

function fromOperacao(
  op: GrfOperacao,
  m: GrfMonitoramento | undefined,
  r: Reguas,
  encerrado: boolean,
  index: number,
): Vehicle {
  const placa = normPlaca(op.placa ?? op.placaOriginal);
  const saiu = bool(op.saiu);
  const tipo = tipoDe(op.tipo, op.destino ?? m?.destino);
  const chegou = tipo === "Transbordo" && bool(op.chegou);

  const paradoMin = num(op.paradoMin) ?? num(m?.paradoMin);
  const gpsIdadeMin = num(op.gpsIdadeMin) ?? num(m?.gpsIdadeMin);

  const estadoApi = txt(op.estado) as EstadoFrota;
  const estado: EstadoFrota =
    saiu && estadosValidos.includes(estadoApi)
      ? estadoApi
      : estadoDe(saiu, chegou, gpsIdadeMin, paradoMin, r);

  const statusApi = saidaStatusDe(op.saidaStatus);
  const saidaStatus: SaidaStatus = saiu ? (statusApi ?? "registrada") : "pendente";
  // Saída medida por GPS: o horário e o atraso já estão congelados.
  const registroTravado = bool(op.registroTravado) || !!txt(op.dataHoraSaida);
  const slaConfiavel = op.slaSaidaConfiavel === true || registroTravado;

  const horaSaida = txt(op.horaSaida) || horaDeIso(op.dataHoraSaida);
  const horaChegada = txt(op.horaChegada) || horaDeIso(op.dataHoraChegada);

  return {
    id: `${placa}-${op.linha ?? index}`,
    placa: placa || txt(op.placaOriginal) || "—",
    motorista: txt(op.motorista) || "—",
    transportadora: txt(op.transportadora) || txt(m?.transportadora) || "—",
    tipo,
    destino: txt(op.destino) || txt(m?.destino) || "—",
    pontoApoio: txt(op.pontoApoio) || null,
    estado,
    saidaPrevista: txt(op.horarioLimite) || horaDeIso(op.dataHoraPrevistaSaida) || "—",
    saidaReal: horaSaida ?? null,
    chegadaTransbordo: tipo === "Transbordo" ? (horaChegada ?? null) : null,
    velocidade: saiu ? (num(m?.velocidade) ?? 0) : 0,
    tempoParadoMin: saiu ? paradoMin : null,
    ultimaPosicao: saiu ? txt(m?.endereco) || "—" : "—",
    latitude: saiu ? num(m?.latitude) : null,
    longitude: saiu ? num(m?.longitude) : null,
    gpsAtualizadoEm: saiu ? gpsIdadeMin : null,
    situacao: situacaoDe(saiu, saidaStatus, encerrado),
    saiu,
    chegouTransbordo: chegou,
    emAtencao: estado === "Em atencao" || estado === "Sem sinal" || saidaStatus === "atraso_alto",
    gpsDesatualizado: estado === "Sem sinal",
    monitorSituacao: txt(m?.situacao).toUpperCase() || null,
    saidaStatus,
    saidaAtrasoMin: num(op.saidaAtrasoMin),
    atrasoTexto: txt(op.atrasoTexto) || null,
    registroTravado,
    slaSaidaConfiavel: slaConfiavel,
    saidaRealIso: txt(op.dataHoraSaida) || null,
    chegadaTransbordoIso: tipo === "Transbordo" ? txt(op.dataHoraChegada) || null : null,
    tempoViagemMin: num(op.tempoViagemMin),
    travaManual: bool(op.travaManual),
  };
}

/** Transição: sem `operacao`, monta a frota só com o monitoramento ao vivo. */
function fromMonitoramento(m: GrfMonitoramento, r: Reguas, index: number): Vehicle {
  const placa = normPlaca(m.placa);
  const situacaoTxt = txt(m.situacao).toUpperCase();
  const naBase = situacaoTxt.includes("NA BASE");
  const saiu = !naBase;
  const paradoMin = num(m.paradoMin);
  const gpsIdadeMin = num(m.gpsIdadeMin);
  const estado = estadoDe(saiu, false, gpsIdadeMin, paradoMin, r);

  return {
    id: `${placa}-m${index}`,
    placa: placa || "—",
    motorista: "—",
    transportadora: txt(m.transportadora) || "—",
    tipo: tipoDe(null, m.destino),
    destino: txt(m.destino) || "—",
    pontoApoio: null,
    estado,
    saidaPrevista: "—",
    saidaReal: null,
    chegadaTransbordo: null,
    velocidade: num(m.velocidade) ?? 0,
    tempoParadoMin: paradoMin,
    ultimaPosicao: txt(m.endereco) || "—",
    latitude: num(m.latitude),
    longitude: num(m.longitude),
    gpsAtualizadoEm: gpsIdadeMin,
    situacao: saiu ? "Conferir horario" : "Aguardando saida",
    saiu,
    chegouTransbordo: false,
    emAtencao: estado === "Em atencao" || estado === "Sem sinal",
    gpsDesatualizado: estado === "Sem sinal",
    monitorSituacao: situacaoTxt || null,
    saidaStatus: saiu ? "registrada" : "pendente",
    saidaAtrasoMin: null,
    atrasoTexto: null,
    registroTravado: false,
    slaSaidaConfiavel: false,
    saidaRealIso: null,
    chegadaTransbordoIso: null,
    tempoViagemMin: null,
    travaManual: false,
  };
}

export function buildVehicles(payload: GrfPayload): Vehicle[] {
  const monitor = new Map<string, GrfMonitoramento>();
  (payload.monitoramento ?? []).forEach((m) => {
    const p = normPlaca(m.placa);
    if (p && !monitor.has(p)) monitor.set(p, m);
  });

  const operacao = payload.operacao ?? [];
  const r = reguasDe(payload);
  const encerrado = diaEncerrado(payload.dataOperacional);

  if (operacao.length) {
    return operacao.map((op, i) =>
      fromOperacao(op, monitor.get(normPlaca(op.placa ?? op.placaOriginal)), r, encerrado, i),
    );
  }
  return (payload.monitoramento ?? []).map((m, i) => fromMonitoramento(m, r, i));
}

export function buildAlerts(vehicles: Vehicle[], payload: GrfPayload): AlertItem[] {
  const r = reguasDe(payload);
  const alerts: AlertItem[] = [];

  for (const v of vehicles) {
    if (v.estado === "Sem sinal") {
      alerts.push({
        id: `${v.placa}-gps`,
        categoria: "Critico",
        titulo: "GPS desatualizado",
        placa: v.placa,
        detalhe:
          v.gpsAtualizadoEm !== null
            ? `Último sinal há ${fmtDur(v.gpsAtualizadoEm)}`
            : "Sem posição recente",
      });
    }
    if (v.estado === "Em atencao") {
      alerts.push({
        id: `${v.placa}-parada`,
        categoria: "Critico",
        titulo: "Parada prolongada",
        placa: v.placa,
        detalhe: `Parado há ${fmtDur(v.tempoParadoMin ?? r.atencaoMin)}${
          v.ultimaPosicao !== "—" ? ` · ${v.ultimaPosicao}` : ""
        }`,
      });
    }
    if (v.estado === "Parado") {
      alerts.push({
        id: `${v.placa}-parado`,
        categoria: "Atencao",
        titulo: "Veículo parado",
        placa: v.placa,
        detalhe: `Parado há ${fmtDur(v.tempoParadoMin ?? r.paradoMin)}${
          v.ultimaPosicao !== "—" ? ` · ${v.ultimaPosicao}` : ""
        }`,
      });
    }
    if (v.saidaStatus === "atraso_alto") {
      alerts.push({
        id: `${v.placa}-atraso`,
        categoria: "Atencao",
        titulo: "Saída atrasada",
        placa: v.placa,
        detalhe: `Limite ${v.saidaPrevista} · saiu ${v.saidaReal ?? "—"}${
          v.atrasoTexto ? ` (${v.atrasoTexto})` : ""
        }`,
      });
    }
    if (v.saiu && !v.slaSaidaConfiavel) {
      alerts.push({
        id: `${v.placa}-saida-div`,
        categoria: "Informativo",
        titulo: "Horário a conferir",
        placa: v.placa,
        detalhe: "Saída marcada sem horário medido pelo GPS",
      });
    }
  }

  const order = { Critico: 0, Atencao: 1, Informativo: 2 } as const;
  return alerts.sort((a, b) => order[a.categoria] - order[b.categoria]);
}

export function buildTimeline(vehicles: Vehicle[], payload: GrfPayload): TimelineEvent[] {
  const r = reguasDe(payload);
  const items: (TimelineEvent & { ts: number })[] = [];

  for (const v of vehicles) {
    const saidaTs = isoTime(v.saidaRealIso);
    if (v.saiu && saidaTs !== null) {
      items.push({
        ts: saidaTs,
        id: `${v.id}-saida`,
        hora: horaDeIso(v.saidaRealIso) ?? "",
        placa: v.placa,
        evento: `Saída registrada · ${v.destino}`,
        tipo: "saida",
      });
    }
    const chegadaTs = isoTime(v.chegadaTransbordoIso);
    if (v.chegouTransbordo && chegadaTs !== null) {
      items.push({
        ts: chegadaTs,
        id: `${v.id}-chegada`,
        hora: horaDeIso(v.chegadaTransbordoIso) ?? "",
        placa: v.placa,
        evento: `Chegada no ponto de apoio · ${v.pontoApoio ?? v.destino}`,
        tipo: "chegada",
      });
    }
  }

  for (const m of payload.monitoramento ?? []) {
    const paradoMin = num(m.paradoMin) ?? 0;
    const desde = isoTime(m.paradoDesde);
    if (paradoMin >= r.atencaoMin && desde !== null) {
      const placa = normPlaca(m.placa);
      const v = vehicles.find((x) => x.placa === placa);
      if (!v || v.estado !== "Em atencao") continue;
      items.push({
        ts: desde,
        id: `${placa}-parada`,
        hora: horaDeIso(m.paradoDesde) ?? "",
        placa,
        evento: `Parado há ${fmtDur(paradoMin)}${txt(m.endereco) ? ` (${txt(m.endereco)})` : ""}`,
        tipo: "parada",
      });
    }
  }

  return items
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 12)
    .map(({ ts: _ts, ...e }) => e);
}

function rankingDe(
  linhas: GrfHistoricoRanking[] | null | undefined,
  chave: "nome" | "placa",
): RankingAtraso[] {
  return (linhas ?? [])
    .map((l) => {
      const rotulo = txt(chave === "placa" ? l.placa : l.nome);
      const saidas = num(l.saidas) ?? 0;
      const atrasadas = num(l.atrasadas) ?? 0;
      const noHorario = num(l.noHorario) ?? 0;
      const detalhe =
        chave === "placa"
          ? txt(l.transportadora) || "—"
          : `${saidas} saída${saidas === 1 ? "" : "s"} medida${saidas === 1 ? "" : "s"}`;
      return {
        id: rotulo || `${chave}-${Math.random()}`,
        rotulo: rotulo || "—",
        detalhe,
        saidas,
        atrasadas,
        noHorario,
        atrasoMedioMin: num(l.atrasoMedioMin) ?? 0,
        atrasoMaxMin: num(l.atrasoMaxMin) ?? 0,
        pctNoHorario: num(l.pctNoHorario) ?? 0,
      };
    })
    .filter((l) => l.rotulo !== "—" && l.saidas > 0)
    .sort((a, b) => b.atrasoMedioMin - a.atrasoMedioMin || b.atrasadas - a.atrasadas);
}

/** Indicador da aba Histórico: quem mais atrasa para sair. */
export function buildHistorico(payload: GrfPayload): HistoricoIndicador | null {
  const h = payload.historico;
  if (!h) return null;
  const transportadoras = rankingDe(h.transportadoras, "nome");
  const veiculos = rankingDe(h.veiculos, "placa");
  if (!transportadoras.length && !veiculos.length) return null;
  return {
    dias: num(h.dias) ?? 30,
    de: txt(h.de) || null,
    ate: txt(h.ate) || null,
    totalSaidas: num(h.totalSaidas) ?? 0,
    transportadoras,
    veiculos,
  };
}
