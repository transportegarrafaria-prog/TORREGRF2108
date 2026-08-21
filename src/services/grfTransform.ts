import type {
  GrfMonitoramento,
  GrfOperacao,
  GrfPayload,
} from "./grfApi";
import type {
  AlertItem,
  SaidaStatus,
  Situacao,
  StatusGps,
  TimelineEvent,
  Vehicle,
  VehicleTipo,
} from "@/data/vehicleModel";

const TZ = "America/Sao_Paulo";

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

function tipoDe(v: unknown): VehicleTipo {
  return txt(v).toLowerCase().startsWith("transbordo") ? "Transbordo" : "Distribuicao";
}

function normalizeTerm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function tipoPorDestinoFallback(destino: unknown): VehicleTipo {
  const d = normalizeTerm(txt(destino));
  return transbordoFallbackTerms.some((t) => d.includes(t)) ? "Transbordo" : "Distribuicao";
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

function situacaoDe(saiu: boolean, status: SaidaStatus, slaConfiavel = true): Situacao {
  if (!saiu) return "Aguardando saida";
  if (!slaConfiavel) return "Conferir horario";
  switch (status) {
    case "no_horario":
      return "No horario";
    case "atraso_leve":
      return "Atraso leve";
    case "atraso_alto":
      return "Atraso alto";
    case "registrada":
      return "Conferir horario";
    default:
      return "Aguardando saida";
  }
}

interface GpsInfo {
  statusGps: StatusGps;
  gpsDesatualizado: boolean;
  paradaProlongada: boolean;
  monitorSituacao: string | null;
}

function gpsInfo(m: GrfMonitoramento | undefined): GpsInfo {
  const s = txt(m?.situacao).toUpperCase();
  if (!m || !s || s.includes("DESATUALIZAD"))
    return {
      statusGps: "GPS desatualizado",
      gpsDesatualizado: true,
      paradaProlongada: false,
      monitorSituacao: s || null,
    };
  if (s.includes("PARADA PROLONGADA"))
    return {
      statusGps: "Parado",
      gpsDesatualizado: false,
      paradaProlongada: true,
      monitorSituacao: s,
    };
  if (s.includes("MOVIMENTO") || s.includes("ROTA"))
    return {
      statusGps: "Em rota",
      gpsDesatualizado: false,
      paradaProlongada: false,
      monitorSituacao: s,
    };
  if (s.includes("PARADO"))
    return {
      statusGps: "Parado",
      gpsDesatualizado: false,
      paradaProlongada: false,
      monitorSituacao: s,
    };
  return {
    statusGps: "Em atencao",
    gpsDesatualizado: false,
    paradaProlongada: false,
    monitorSituacao: s,
  };
}

function fromOperacao(
  op: GrfOperacao,
  m: GrfMonitoramento | undefined,
  stopCritMin: number,
  index: number,
): Vehicle {
  const placa = normPlaca(op.placa ?? op.placaOriginal);
  const saiu = bool(op.saiu);
  const chegou = bool(op.chegou);
  const tipo = tipoDe(op.tipo);
  const statusApi = saidaStatusDe(op.saidaStatus);
  const saidaStatus: SaidaStatus = saiu ? (statusApi ?? "registrada") : "pendente";
  const slaConfiavel = op.slaSaidaConfiavel === true;

  const gps = saiu ? gpsInfo(m) : null;
  const statusGps: StatusGps = saiu ? gps!.statusGps : "Na base";

  const paradoMin = num(m?.paradoMin);
  const divergencia =
    bool(op.horarioSaidaDivergente) ||
    bool(op.statusSaidaInconsistente) ||
    (tipo === "Transbordo" &&
      (bool(op.horarioChegadaDivergente) || bool(op.statusChegadaInconsistente)));

  const emAtencao =
    (saiu && (gps!.gpsDesatualizado || gps!.paradaProlongada)) ||
    saidaStatus === "atraso_alto" ||
    divergencia ||
    (saiu && !slaConfiavel);

  const horaSaida = txt(op.horaSaida) || horaDeIso(op.dataHoraSaida);
  const horaChegada = txt(op.horaChegada) || horaDeIso(op.dataHoraChegada);

  return {
    id: `${placa}-${op.linha ?? index}`,
    placa: placa || txt(op.placaOriginal) || "—",
    motorista: txt(op.motorista) || "—",
    transportadora: txt(op.transportadora) || txt(m?.transportadora) || "—",
    tipo,
    destino: txt(op.destino) || txt(m?.destino) || "—",
    statusGps,
    saidaPrevista: txt(op.horarioLimite) || horaDeIso(op.dataHoraPrevistaSaida) || "—",
    saidaReal: saiu ? (horaSaida ?? null) : (horaSaida ?? null),
    chegadaTransbordo: tipo === "Transbordo" ? (horaChegada ?? null) : null,
    velocidade: saiu ? (num(m?.velocidade) ?? 0) : 0,
    tempoParadoMin: saiu ? paradoMin : null,
    ultimaPosicao: saiu ? txt(m?.endereco) || "—" : "—",
    latitude: saiu ? num(m?.latitude) : null,
    longitude: saiu ? num(m?.longitude) : null,
    gpsAtualizadoEm: saiu ? num(m?.gpsIdadeMin) : null,
    situacao: situacaoDe(saiu, saidaStatus, slaConfiavel),
    saiu,
    chegouTransbordo: tipo === "Transbordo" && chegou,
    emAtencao,
    gpsDesatualizado: saiu ? gps!.gpsDesatualizado : false,
    monitorSituacao: saiu ? gps!.monitorSituacao : null,
    saidaStatus,
    saidaAtrasoMin: num(op.saidaAtrasoMin),
    slaSaidaConfiavel: slaConfiavel,
    saidaRealIso: txt(op.dataHoraSaida) || null,
    chegadaTransbordoIso: tipo === "Transbordo" ? txt(op.dataHoraChegada) || null : null,
    horarioSaidaDivergente: bool(op.horarioSaidaDivergente),
    statusSaidaInconsistente: bool(op.statusSaidaInconsistente),
    horarioChegadaDivergente: bool(op.horarioChegadaDivergente),
    statusChegadaInconsistente: bool(op.statusChegadaInconsistente),
    ...(stopCritMin && paradoMin !== null && paradoMin >= stopCritMin ? { emAtencao: true } : {}),
  };
}

/** Transição: enquanto o backend não expõe `operacao`, monta a frota a partir do monitoramento real. */
function fromMonitoramento(m: GrfMonitoramento, index: number): Vehicle {
  const placa = normPlaca(m.placa);
  const naBase = txt(m.situacao).toUpperCase().includes("NA BASE");
  const gps: GpsInfo = naBase
    ? {
        statusGps: "Na base",
        gpsDesatualizado: false,
        paradaProlongada: false,
        monitorSituacao: txt(m.situacao).toUpperCase() || null,
      }
    : gpsInfo(m);
  const saiu = !naBase;
  return {
    id: `${placa}-m${index}`,
    placa: placa || "—",
    motorista: "—",
    transportadora: txt(m.transportadora) || "—",
    tipo: tipoPorDestinoFallback(m.destino),
    destino: txt(m.destino) || "—",

    statusGps: gps.statusGps,
    saidaPrevista: "—",
    saidaReal: null,
    chegadaTransbordo: null,
    velocidade: num(m.velocidade) ?? 0,
    tempoParadoMin: num(m.paradoMin),
    ultimaPosicao: txt(m.endereco) || "—",
    latitude: num(m.latitude),
    longitude: num(m.longitude),
    gpsAtualizadoEm: num(m.gpsIdadeMin),
    situacao: saiu ? "Conferir horario" : "Aguardando saida",
    saiu,
    chegouTransbordo: false,
    emAtencao: saiu && (gps.gpsDesatualizado || gps.paradaProlongada),
    gpsDesatualizado: saiu && gps.gpsDesatualizado,
    monitorSituacao: gps.monitorSituacao,
    saidaStatus: saiu ? "registrada" : "pendente",
    saidaAtrasoMin: null,
    slaSaidaConfiavel: false,
    saidaRealIso: null,
    chegadaTransbordoIso: null,
    horarioSaidaDivergente: false,
    statusSaidaInconsistente: false,
    horarioChegadaDivergente: false,
    statusChegadaInconsistente: false,
  };
}

export function buildVehicles(payload: GrfPayload): Vehicle[] {
  const monitor = new Map<string, GrfMonitoramento>();
  (payload.monitoramento ?? []).forEach((m) => {
    const p = normPlaca(m.placa);
    if (p && !monitor.has(p)) monitor.set(p, m);
  });

  const operacao = payload.operacao ?? [];
  const stopCrit = num(payload.stopCritMin) ?? 45;

  if (operacao.length) {
    return operacao.map((op, i) =>
      fromOperacao(op, monitor.get(normPlaca(op.placa ?? op.placaOriginal)), stopCrit, i),
    );
  }
  return (payload.monitoramento ?? []).map((m, i) => fromMonitoramento(m, i));
}

export function buildAlerts(vehicles: Vehicle[], payload: GrfPayload): AlertItem[] {
  const stopCrit = num(payload.stopCritMin) ?? 45;
  const alerts: AlertItem[] = [];

  for (const v of vehicles) {
    if (v.saiu && v.gpsDesatualizado) {
      alerts.push({
        id: `${v.placa}-gps`,
        categoria: "Critico",
        titulo: "GPS desatualizado",
        placa: v.placa,
        detalhe:
          v.gpsAtualizadoEm !== null
            ? `Último sinal há ${v.gpsAtualizadoEm} min`
            : "Sem posição recente",
      });
    }
    if (v.tempoParadoMin !== null && v.tempoParadoMin >= stopCrit) {
      alerts.push({
        id: `${v.placa}-parada`,
        categoria: "Atencao",
        titulo: "Parada prolongada",
        placa: v.placa,
        detalhe: `Parado há ${fmtDur(v.tempoParadoMin)}${v.ultimaPosicao !== "—" ? ` · ${v.ultimaPosicao}` : ""}`,
      });
    }
    if (v.slaSaidaConfiavel && v.saidaStatus === "atraso_alto") {
      alerts.push({
        id: `${v.placa}-atraso`,
        categoria: "Atencao",
        titulo: "Saída atrasada",
        placa: v.placa,
        detalhe: `Previsto ${v.saidaPrevista} · saiu ${v.saidaReal ?? "—"}`,
      });
    }
    if (v.horarioSaidaDivergente || v.statusSaidaInconsistente) {
      alerts.push({
        id: `${v.placa}-saida-div`,
        categoria: "Informativo",
        titulo: "Horário divergente",
        placa: v.placa,
        detalhe: "Conferir registro de saída",
      });
    }
    if (
      v.tipo === "Transbordo" &&
      (v.horarioChegadaDivergente ||
        v.statusChegadaInconsistente ||
        (v.chegadaTransbordo !== null && !v.chegouTransbordo))
    ) {
      alerts.push({
        id: `${v.placa}-chegada-div`,
        categoria: "Informativo",
        titulo: "Conferir chegada",
        placa: v.placa,
        detalhe: "Chegada de transbordo não confirmada",
      });
    }
  }

  const order = { Critico: 0, Atencao: 1, Informativo: 2 } as const;
  return alerts.sort((a, b) => order[a.categoria] - order[b.categoria]);
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

export function buildTimeline(vehicles: Vehicle[], payload: GrfPayload): TimelineEvent[] {
  const stopCrit = num(payload.stopCritMin) ?? 45;
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
    if (v.tipo === "Transbordo" && v.chegouTransbordo && chegadaTs !== null) {
      items.push({
        ts: chegadaTs,
        id: `${v.id}-chegada`,
        hora: horaDeIso(v.chegadaTransbordoIso) ?? "",
        placa: v.placa,
        evento: `Chegada ao transbordo · ${v.destino}`,
        tipo: "chegada",
      });
    }
  }

  for (const m of payload.monitoramento ?? []) {
    const paradoMin = num(m.paradoMin) ?? 0;
    const desde = isoTime(m.paradoDesde);
    if (paradoMin >= Math.max(stopCrit, 60) && desde !== null) {
      const placa = normPlaca(m.placa);
      if (!vehicles.some((v) => v.placa === placa)) continue;
      items.push({
        ts: desde,
        id: `${placa}-parada`,
        hora: horaDeIso(m.paradoDesde) ?? "",
        placa,
        evento: `Parado há mais de 1h${txt(m.endereco) ? ` (${txt(m.endereco)})` : ""}`,
        tipo: "parada",
      });
    }
  }

  return items
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 12)
    .map(({ ts: _ts, ...e }) => e);
}
