/* ============================================================
   TORRE DE CONTROLE GRF — MONITORAMENTO GPS ECLIPSE (V6.0)
   INDICADORES TRAVADOS + INDICADOR HISTÓRICO DE ATRASO
   ============================================================

   O QUE MUDOU NA V6.0 (em cima da V5.0)

   1) TRAVA DE SAÍDA (o ponto principal)
      Uma vez que a saída foi detectada, ela vira registro
      definitivo do dia: nunca é recalculada, nunca volta pra
      "Não", nunca muda de horário. Antes, a cada rodada o
      script varria a janela inteira de novo e podia trocar a
      hora de saída (era por isso que a Programação de 21/08
      aparecia com saída "03:33 (24/08)") ou zerar o "Sim"
      quando o Eclipse não respondia naquela consulta.
      A âncora do travamento são as colunas "Data/Hora Saída" e
      "Data/Hora Chegada" da Programação — que já existiam na
      planilha e estavam vazias. Agora elas guardam o instante
      real (data + hora), e é delas que sai todo o resto.

   2) TRAVA DE CHEGADA NO PONTO DE APOIO
      Mesma regra para transbordo: detectou a chegada no PA,
      congelou. Hora de saída, se saiu no horário e que horas
      chegou no PA passam a ser um registro fechado.

   3) ATRASO TAMBÉM CONGELA
      O atraso é calculado uma vez, contra o horário-limite da
      rota, no instante da saída — e para de correr. Para quem
      ainda não saiu, o contador corre só até o fim do dia
      operacional, então linha antiga não acumula mais "+79h".

   4) JANELA DE DETECÇÃO PRESA AO DIA OPERACIONAL
      Saída: da véspera 21:00 até o fim do dia operacional.
      Chegada: até o meio-dia seguinte (viagem que vira a noite).
      Sem isso, uma programação antiga capturava movimento de
      dias depois.

   5) ESTADO OPERACIONAL ÚNICO (os cards do painel)
      Cada veículo recebe UM estado, e os cards, o gráfico de
      Status da Frota e o de Cumprimento das Saídas leem esse
      mesmo estado:
        Na base    -> ainda não saiu
        Em rota    -> em movimento (ou parada curta, < 45 min)
        Parado     -> parado de 45 min a 1h
        Em atenção -> parado há mais de 1h
        Sem sinal  -> GPS sem leitura recente
        Concluído  -> transbordo que já chegou no ponto de apoio
      Transbordo que chegou no PA não conta mais como parado nem
      como atenção — ele terminou a viagem.

   6) INDICADOR HISTÓRICO
      doGet passa a devolver um bloco `historico` com o
      ranking de quem mais atrasa para sair, por transportadora
      e por veículo, calculado sobre a aba Histórico dos
      últimos HISTORICO_DIAS dias.

   7) HISTÓRICO NUNCA REGRIDE
      No upsert, uma linha que já registrou saída não é
      sobrescrita por uma leitura pior (sem GPS, por exemplo).

   SEGURANÇA
   - NUNCA coloque senha neste arquivo.
   - Senhas ficam em Configurações do projeto > Propriedades do script.
   ============================================================ */


/* ============================================================
   CONFIGURAÇÕES GERAIS
   ============================================================ */

var GPS_TZ = "America/Sao_Paulo";

var GPS_PROGRAMACAO_SHEET = "Programação";
var GPS_MONITOR_SHEET = "Monitoramento";
var GPS_HISTORICO_SHEET = "Histórico";

var GPS_MONITOR_LIMIT = 500;
var GPS_INTERVALO_MIN = 10;

// Idade máxima da leitura de GPS para ela ainda valer como "ao vivo".
var GPS_STALE_MIN = 15;

// Régua de parada — é ela que define os cards Parados e Em atenção.
var GPS_STOP_WARN_MIN = 20;   // parada curta (ainda conta como Em rota nos cards)
var GPS_STOP_CRIT_MIN = 45;   // card "Parados": parado a partir de 45 min
var GPS_ATENCAO_MIN = 60;     // card "Em atenção": parada prolongada acima de 1h
var GPS_STOP_SPEED_KMH = 3;
var GPS_STOP_RADIUS_M = 120;

// Acima disso a saída é classificada como atraso alto.
var GPS_ATRASO_ALTO_MIN = 60;

// Quantos dias da aba Histórico alimentam o indicador de atraso.
var HISTORICO_DIAS = 30;

// A partir de que hora da véspera uma saída conta pro dia seguinte.
var HORA_INICIO_VESPERA = 21;

// Até que hora do dia seguinte ainda aceitamos chegada no ponto de apoio.
var HORA_FIM_CHEGADA_DIA_SEGUINTE = 12;

// Retorno à base dentro desse tempo é manobra/balança, não fim de viagem.
var MAX_MANOBRA_MIN = 120;

// Cerca da base GRF. Geozone é o sinal principal (Eclipse já
// calcula); endereço e coordenada são reserva.
var TEXTO_BASE = "grf distribui";
var ZONA_BASE = "grf_distribuicao";
var BASE_GRF = { lat: -22.08021, lon: -43.21244, raio: 300 };

// Pontos de apoio / transbordo (chegada por coordenada).
var TRANSBORDOS = [
  { nome: "Penha RJ",        destino: ["rio de janeiro", "penha"],       lat: -22.82105, lon: -43.27655, raio: 600 },
  { nome: "Barra Mansa",     destino: ["barra mansa"],                   lat: -22.55510, lon: -44.13016, raio: 400 },
  { nome: "Lagos",           destino: ["lagos", "sao pedro", "cabo frio", "aldeia"], lat: -22.83871, lon: -42.14206, raio: 400 },
  { nome: "Campos",          destino: ["campos", "goytacaz"],            lat: -21.71256, lon: -41.30403, raio: 400 },
  { nome: "Duque de Caxias", destino: ["duque de caxias", "caxias"],     lat: -22.68069, lon: -43.29568, raio: 400 },
  { nome: "Angra",           destino: ["angra"],                         lat: -22.99707, lon: -44.23958, raio: 400 }
];

// Horário-limite de saída por destino — sempre a partir da GRF.
var HORARIO_LIMITE = [
  { match: ["sao pedro da aldeia", "cabo frio", "lagos"], limite: "00:00" },
  { match: ["campos", "goytacaz"],                        limite: "00:00" },
  { match: ["angra"],                                     limite: "01:00" },
  { match: ["barra mansa"],                               limite: "04:00" },
  { match: ["petropolis", "sapucaia"],                    limite: "06:00" },
  { match: ["tres rios", "paraiba do sul"],               limite: "07:00" },
  { match: ["rio de janeiro", "penha", "caxias", "duque de caxias"], limite: "03:00" }
];
var HORARIO_LIMITE_PADRAO = "05:00";

// Endpoints da interface Eclipse.
var ECLIPSE_LOGIN_URL_DEFAULT = "http://www2.gpseclipse.com:8080/login.php";
var ECLIPSE_UNITDATA_URL_DEFAULT = "http://www2.gpseclipse.com:8080/include/getUnitData.php";

// As senhas NÃO ficam aqui. Cada conta aponta para uma Script Property.
var GPS_CONTAS = [
  { key: "supervinhos_deivid",    nome: "Super Vinhos (deivid)",    account: "supervinhos", user: "deivid",    prop: "ECLIPSE_PASSWORD" },
  { key: "cotrim",                nome: "Cotrim",                   account: "cotrim",      user: "cotrim",    prop: "ECLIPSE_PWD_COTRIM" },
  { key: "supervinhos_francisco", nome: "Super Vinhos (francisco)", account: "supervinhos", user: "francisco", prop: "ECLIPSE_PWD_FRANCISCO" }
];

var GPS_MONITOR_HEADERS = [
  "Atualizado em", "Placa", "Destino", "Transportadora", "Status Eclipse",
  "Situação", "Velocidade", "GPS Data/Hora", "GPS Idade (min)", "Latitude",
  "Longitude", "Endereço", "Parado desde", "Parado (min)", "Hodômetro",
  "Zona GPS", "Chegou via GPS", "Chegada GPS Data/Hora"
];

var CAB_HISTORICO = [
  "Data Operacional", "Placa", "Transportadora", "Destino", "Tipo",
  "Horário-Limite", "Saiu?", "Hora Saída", "Atraso (min)", "Atraso",
  "Status", "Chegou?", "Hora Chegada", "Atualizado em"
];

var COL_TRAVA = "Trava Manual";

// Estados operacionais — mesma lista usada pelos cards do painel.
var ESTADO_NA_BASE = "Na base";
var ESTADO_EM_ROTA = "Em rota";
var ESTADO_PARADO = "Parado";
var ESTADO_ATENCAO = "Em atencao";
var ESTADO_SEM_SINAL = "Sem sinal";
var ESTADO_CONCLUIDO = "Concluido";


/* ============================================================
   1. CONFIGURAÇÃO / DIAGNÓSTICO
   ============================================================ */

function configurarProjeto() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (ss) {
    props.setProperty("SPREADSHEET_ID", ss.getId());
    try { ss.setSpreadsheetTimeZone(GPS_TZ); } catch (e) {
      Logger.log("Não foi possível ajustar o fuso da planilha: " + e.message);
    }
  }
  if (!props.getProperty("ECLIPSE_LOGIN_URL")) props.setProperty("ECLIPSE_LOGIN_URL", ECLIPSE_LOGIN_URL_DEFAULT);
  if (!props.getProperty("ECLIPSE_UNITDATA_URL")) props.setProperty("ECLIPSE_UNITDATA_URL", ECLIPSE_UNITDATA_URL_DEFAULT);

  var planilha = getPlanilha_();
  garantirAbaMonitoramento_(planilha);
  garantirAbaHistorico_(planilha);
  var prog = getProgramacaoSheet_(planilha);
  garantirColunaTrava_(prog);
  garantirColunasCarimbo_(prog);

  var ativos = getContasAtivas_();
  Logger.log("Projeto configurado. Planilha: " + planilha.getName());
  Logger.log("Contas Eclipse configuradas: " + ativos.length);
  if (!ativos.length) Logger.log("ATENÇÃO: configure ao menos uma senha nas Propriedades do script.");
}

function verificarConfiguracao() {
  var props = PropertiesService.getScriptProperties();
  var ss = getPlanilha_();
  var info = {
    planilha: ss.getName(),
    loginUrl: getLoginUrl_(),
    unitDataUrl: getUnitDataUrl_(),
    contasAtivas: getContasAtivas_().map(function(c) { return c.nome; }),
    abaHistoricoExiste: !!ss.getSheetByName(GPS_HISTORICO_SHEET),
    ultimaDataOperacionalMemorizada: props.getProperty("ULTIMA_DATA_OPERACIONAL") || null,
    reguaParados: GPS_STOP_CRIT_MIN + " min",
    reguaAtencao: GPS_ATENCAO_MIN + " min"
  };
  Logger.log(JSON.stringify(info, null, 2));
  return info;
}


/* ============================================================
   2. PLANILHA
   ============================================================ */

function getPlanilha_() {
  var props = PropertiesService.getScriptProperties();
  var id = String(props.getProperty("SPREADSHEET_ID") || "").trim();
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) { props.setProperty("SPREADSHEET_ID", ss.getId()); return ss; }
  throw new Error("Planilha não configurada. Execute configurarProjeto() com este Apps Script aberto a partir da planilha.");
}

function getProgramacaoSheet_(ss) {
  var sheet = ss.getSheetByName(GPS_PROGRAMACAO_SHEET);
  if (!sheet) throw new Error('A aba "' + GPS_PROGRAMACAO_SHEET + '" não foi encontrada.');
  return sheet;
}

function garantirAbaMonitoramento_(ss) {
  var sheet = ss.getSheetByName(GPS_MONITOR_SHEET);
  if (!sheet) sheet = ss.insertSheet(GPS_MONITOR_SHEET);
  if (sheet.getMaxColumns() < GPS_MONITOR_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), GPS_MONITOR_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, GPS_MONITOR_HEADERS.length).setValues([GPS_MONITOR_HEADERS]);
  sheet.setFrozenRows(1);
  return sheet;
}

function garantirAbaHistorico_(ss) {
  var hist = ss.getSheetByName(GPS_HISTORICO_SHEET);
  if (!hist) {
    hist = ss.insertSheet(GPS_HISTORICO_SHEET);
    hist.getRange(1, 1, 1, CAB_HISTORICO.length).setValues([CAB_HISTORICO]).setFontWeight("bold");
    hist.setFrozenRows(1);
  }
  return hist;
}

// Cria (se preciso) e mantém oculta a coluna técnica de trava manual.
function garantirColunaTrava_(sheet) {
  return garantirColuna_(sheet, COL_TRAVA, true);
}

/**
 * Colunas-carimbo do travamento. São elas que guardam o instante
 * real da saída e da chegada — o registro que não se mexe mais.
 * Já existem na planilha; a função só garante que continuam lá.
 */
function garantirColunasCarimbo_(sheet) {
  return {
    dataHoraSaida: garantirColuna_(sheet, "Data/Hora Saída", false),
    dataHoraChegada: garantirColuna_(sheet, "Data/Hora Chegada", false)
  };
}

function garantirColuna_(sheet, nome, ocultar) {
  var nCols = Math.max(sheet.getLastColumn(), 1);
  var cab = sheet.getRange(1, 1, 1, nCols).getDisplayValues()[0];
  for (var i = 0; i < cab.length; i++) {
    if (semAcento_(cab[i]) === semAcento_(nome)) {
      if (ocultar) sheet.hideColumns(i + 1);
      return i + 1;
    }
  }
  var nova = nCols + 1;
  sheet.getRange(1, nova).setValue(nome);
  if (ocultar) sheet.hideColumns(nova);
  return nova;
}


/* ============================================================
   3. PROPRIEDADES / CONTAS ECLIPSE
   ============================================================ */

function getLoginUrl_() {
  return String(PropertiesService.getScriptProperties().getProperty("ECLIPSE_LOGIN_URL") || ECLIPSE_LOGIN_URL_DEFAULT).trim();
}
function getUnitDataUrl_() {
  return String(PropertiesService.getScriptProperties().getProperty("ECLIPSE_UNITDATA_URL") || ECLIPSE_UNITDATA_URL_DEFAULT).trim().replace(/\?+$/, "");
}
function getSenhaConta_(conta) {
  return String(PropertiesService.getScriptProperties().getProperty(conta.prop) || "");
}
function getContasAtivas_() {
  return GPS_CONTAS.filter(function(c) { return !!getSenhaConta_(c); });
}
function getContaPorKey_(key) {
  for (var i = 0; i < GPS_CONTAS.length; i++) if (GPS_CONTAS[i].key === key) return GPS_CONTAS[i];
  return null;
}
function getMapaContaPlaca_() {
  var texto = PropertiesService.getScriptProperties().getProperty("ECLIPSE_PLATE_ACCOUNT_MAP");
  if (!texto) return {};
  try { return JSON.parse(texto) || {}; } catch (e) { return {}; }
}
function salvarMapaContaPlaca_(mapa) {
  PropertiesService.getScriptProperties().setProperty("ECLIPSE_PLATE_ACCOUNT_MAP", JSON.stringify(mapa || {}));
}
function ordenarContasParaPlaca_(placa, transportadora, mapa) {
  var ordem = [], usados = {};
  function add(c) { if (!c || usados[c.key] || !getSenhaConta_(c)) return; usados[c.key] = true; ordem.push(c); }
  if (mapa[placa]) add(getContaPorKey_(mapa[placa]));
  if (semAcento_(transportadora).indexOf("cotrim") !== -1) add(getContaPorKey_("cotrim"));
  getContasAtivas_().forEach(add);
  return ordem;
}


/* ============================================================
   4. UTILITÁRIOS DE TEXTO / DATA
   ============================================================ */

function semAcento_(v) {
  return String(v == null ? "" : v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function normalizarPlaca_(v) {
  var t = String(v == null ? "" : v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  var m = t.match(/([A-Z]{3}[0-9][A-Z0-9][0-9]{2})$/);
  return m ? m[1] : t;
}
function placaValida_(placa) { return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(normalizarPlaca_(placa)); }
function ehSim_(v) { var s = semAcento_(v); return s === "sim" || s === "s" || s === "x" || s === "ok" || s === "true" || s === "1"; }
function numeroSeguro_(v) {
  if (v === null || v === undefined || v === "") return null;
  var n = parseFloat(String(v).replace(",", ".").replace(/[^\d.\-]/g, ""));
  return isNaN(n) ? null : n;
}
function isoOuNull_(v) { return dataValida_(v) ? v.toISOString() : null; }
function dataValida_(v) { return Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime()); }

// A data da Programação É o dia operacional — sem somar dia nenhum.
function dataOperacionalDeTexto_(textoData) {
  if (!textoData) return null;
  if (dataValida_(textoData)) {
    return new Date(textoData.getFullYear(), textoData.getMonth(), textoData.getDate(), 12, 0, 0);
  }
  var p = String(textoData).trim().split("/");
  if (p.length !== 3) return null;
  var dia = parseInt(p[0], 10), mes = parseInt(p[1], 10) - 1, ano = parseInt(p[2], 10);
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
  return new Date(ano, mes, dia, 12, 0, 0);
}
function dataKey_(dataOperacional) {
  return dataValida_(dataOperacional) ? Utilities.formatDate(dataOperacional, GPS_TZ, "yyyy-MM-dd") : "";
}
function combinarDataHora_(dataBase, hh, mm) {
  if (!dataValida_(dataBase)) return null;
  return new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate(), hh, mm, 0, 0);
}

/**
 * Janela do dia operacional. Fora dela nada é detectado — é o que
 * impede uma programação antiga de capturar movimento de dias depois.
 */
function janelaSaida_(dataOper) {
  if (!dataValida_(dataOper)) return null;
  var ini = new Date(dataOper.getFullYear(), dataOper.getMonth(), dataOper.getDate() - 1, HORA_INICIO_VESPERA, 0, 0);
  var fim = new Date(dataOper.getFullYear(), dataOper.getMonth(), dataOper.getDate(), 23, 59, 59);
  return { ini: ini.getTime(), fim: Math.min(fim.getTime(), Date.now()) };
}
function janelaChegada_(dataOper) {
  if (!dataValida_(dataOper)) return null;
  var ini = new Date(dataOper.getFullYear(), dataOper.getMonth(), dataOper.getDate() - 1, HORA_INICIO_VESPERA, 0, 0);
  var fim = new Date(dataOper.getFullYear(), dataOper.getMonth(), dataOper.getDate() + 1, HORA_FIM_CHEGADA_DIA_SEGUINTE, 0, 0);
  return { ini: ini.getTime(), fim: Math.min(fim.getTime(), Date.now()) };
}
// Fim do dia operacional: até aqui o contador de atraso de quem não saiu corre.
function fimDoDiaOperacional_(dataOper) {
  if (!dataValida_(dataOper)) return Date.now();
  return new Date(dataOper.getFullYear(), dataOper.getMonth(), dataOper.getDate(), 23, 59, 59).getTime();
}

// Mesmo dia -> "06:49" | Véspera -> "22:40 (14/08)"
function formatarHoraComDia_(dataHora, dataOper) {
  if (!dataValida_(dataHora) || !dataValida_(dataOper)) return "";
  var hora = Utilities.formatDate(dataHora, GPS_TZ, "HH:mm");
  var mesmoDia = dataHora.getFullYear() === dataOper.getFullYear() && dataHora.getMonth() === dataOper.getMonth() && dataHora.getDate() === dataOper.getDate();
  return mesmoDia ? hora : hora + " (" + Utilities.formatDate(dataHora, GPS_TZ, "dd/MM") + ")";
}
function parseHoraComDia_(texto, dataOper) {
  if (!texto || !dataValida_(dataOper)) return null;
  var t = String(texto).trim().replace(/^'/, "");
  var mh = t.match(/^(\d{1,2}):(\d{2})/);
  if (!mh) return null;
  var hh = parseInt(mh[1], 10), mm = parseInt(mh[2], 10);
  if (hh > 23 || mm > 59) return null;
  var md = t.match(/\((\d{1,2})\/(\d{1,2})\)/);
  if (md) {
    var d = new Date(dataOper.getFullYear(), parseInt(md[2], 10) - 1, parseInt(md[1], 10), hh, mm, 0, 0);
    if (d.getTime() - dataOper.getTime() > 300 * 24 * 3600 * 1000) d.setFullYear(dataOper.getFullYear() - 1);
    return d;
  }
  return combinarDataHora_(dataOper, hh, mm);
}
function dataHoraLimite_(dataOper, horarioLimite) {
  var p = String(horarioLimite || HORARIO_LIMITE_PADRAO).split(":");
  return combinarDataHora_(dataOper, parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0);
}
function calcularAtrasoMin_(limiteDataHora, referencia) {
  if (!dataValida_(limiteDataHora) || !dataValida_(referencia)) return 0;
  return Math.round((referencia.getTime() - limiteDataHora.getTime()) / 60000);
}
function formatarAtraso_(min) {
  if (min === null || min === undefined || min === "") return "";
  if (min <= 0) return "No prazo";
  var h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return "+" + m + "min";
  if (m === 0) return "+" + h + "h";
  return "+" + h + "h" + (m < 10 ? "0" + m : m);
}
function statusPrazo_(saiu, atrasoMin, diaFechado) {
  if (!saiu) return diaFechado ? "Não saiu" : "Aguardando saída";
  return (Number(atrasoMin) || 0) > 0 ? "Atrasado" : "No prazo";
}
// Classificação travada da saída, sempre derivada do atraso congelado.
function saidaStatusDe_(saiu, atrasoMin) {
  if (!saiu) return "pendente";
  if (atrasoMin === null || atrasoMin === undefined) return "registrada";
  if (atrasoMin <= 0) return "no_horario";
  return atrasoMin >= GPS_ATRASO_ALTO_MIN ? "atraso_alto" : "atraso_leve";
}
function distanciaMetros_(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  function rad(g) { return g * Math.PI / 180; }
  var a = Math.sin(rad(lat2 - lat1) / 2) * Math.sin(rad(lat2 - lat1) / 2) +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) * Math.sin(rad(lon2 - lon1) / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


/* ============================================================
   5. PONTOS DE APOIO / HORÁRIO-LIMITE
   ============================================================ */

function getTransbordo_(destino) {
  var alvo = semAcento_(destino);
  for (var i = 0; i < TRANSBORDOS.length; i++) {
    for (var j = 0; j < TRANSBORDOS[i].destino.length; j++) {
      if (alvo.indexOf(semAcento_(TRANSBORDOS[i].destino[j])) !== -1) return TRANSBORDOS[i];
    }
  }
  return null;
}
function getHorarioLimite_(destino) {
  var alvo = semAcento_(destino);
  for (var i = 0; i < HORARIO_LIMITE.length; i++) {
    for (var j = 0; j < HORARIO_LIMITE[i].match.length; j++) {
      if (alvo.indexOf(semAcento_(HORARIO_LIMITE[i].match[j])) !== -1) return HORARIO_LIMITE[i].limite;
    }
  }
  return HORARIO_LIMITE_PADRAO;
}


/* ============================================================
   6. LEITURA / ESCRITA DA PROGRAMAÇÃO
   ============================================================ */

function mapearCabecalhos_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return {};
  var cab = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  var mapa = {};
  cab.forEach(function(nome, i) { mapa[semAcento_(nome)] = i + 1; });
  return mapa;
}
function acharColuna_(mapa, nomes) {
  for (var i = 0; i < nomes.length; i++) { var c = mapa[semAcento_(nomes[i])]; if (c) return c; }
  return 0;
}

function mapearColunasProgramacao_(sheet) {
  var mapa = mapearCabecalhos_(sheet);
  return {
    data: acharColuna_(mapa, ["Data", "Data Operacional"]),
    placa: acharColuna_(mapa, ["Placa", "Veículo", "Veiculo"]),
    destino: acharColuna_(mapa, ["Cidade/Rota", "Destino", "Ponto de Apoio", "Rota"]),
    transportadora: acharColuna_(mapa, ["Transportadora", "Transportador"]),
    tipo: acharColuna_(mapa, ["Tipo", "Operação", "Operacao"]),
    saiu: acharColuna_(mapa, ["Saiu?", "Saiu"]),
    horaSaida: acharColuna_(mapa, ["Hora Saída", "Hora Saida"]),
    horarioLimite: acharColuna_(mapa, ["Horário-Limite", "Horario-Limite", "Horario Limite"]),
    atraso: acharColuna_(mapa, ["Atraso"]),
    chegou: acharColuna_(mapa, ["Chegou?", "Chegou"]),
    horaChegada: acharColuna_(mapa, ["Hora Chegada"]),
    statusGPS: acharColuna_(mapa, ["Status GPS", "Status"]),
    ultimaPosicao: acharColuna_(mapa, ["Última Posição", "Ultima Posicao", "Posição", "Posicao"]),
    dataHoraSaida: acharColuna_(mapa, ["Data/Hora Saída", "Data/Hora Saida"]),
    dataHoraChegada: acharColuna_(mapa, ["Data/Hora Chegada"])
  };
}

/**
 * Quando a data operacional muda, zera tudo que é do dia:
 * detecção, carimbos de saída/chegada e travas manuais.
 * É o único momento em que um registro travado é apagado.
 */
function resetarSeProgramacaoNova_(sheet, col, colTrava) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2 || !col.data) return false;

  var datas = sheet.getRange(2, col.data, lastRow - 1, 1).getDisplayValues();
  var maior = "";
  for (var i = 0; i < datas.length; i++) {
    var d = dataOperacionalDeTexto_(datas[i][0]);
    if (!d) continue;
    var k = dataKey_(d);
    if (k > maior) maior = k;
  }
  if (!maior) return false;

  var props = PropertiesService.getScriptProperties();
  var anterior = props.getProperty("ULTIMA_DATA_OPERACIONAL");
  if (!anterior) { props.setProperty("ULTIMA_DATA_OPERACIONAL", maior); return false; }
  if (anterior === maior) return false;

  var n = lastRow - 1;
  [col.saiu, col.horaSaida, col.chegou, col.horaChegada, col.atraso,
   col.dataHoraSaida, col.dataHoraChegada, colTrava].forEach(function(c) {
    if (c) sheet.getRange(2, c, n, 1).clearContent();
  });
  props.setProperty("ULTIMA_DATA_OPERACIONAL", maior);
  Logger.log("Programação nova (" + maior + "). Registros do dia anterior zerados.");
  return true;
}

/**
 * Lê a Programação inteira da data operacional mais recente.
 * Para cada linha traz também o REGISTRO JÁ TRAVADO (carimbo de
 * saída/chegada), que tem prioridade sobre qualquer nova detecção.
 */
function coletarProgramacao_(sheet, col, colTrava) {
  if (sheet.getLastRow() < 2 || !col.placa) return { dataAlvo: "", dataOperacional: null, itens: [] };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var raw = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var txt = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();

  var dataAlvo = "";
  var dataOperacional = null;
  if (col.data) {
    for (var i = 0; i < raw.length; i++) {
      var d = dataOperacionalDeTexto_(dataValida_(raw[i][col.data - 1]) ? raw[i][col.data - 1] : txt[i][col.data - 1]);
      if (!d) continue;
      var k = dataKey_(d);
      if (k > dataAlvo) { dataAlvo = k; dataOperacional = d; }
    }
  }

  var vistos = {};
  var itens = [];

  for (var r = 0; r < raw.length; r++) {
    if (col.data) {
      var linhaData = dataOperacionalDeTexto_(dataValida_(raw[r][col.data - 1]) ? raw[r][col.data - 1] : txt[r][col.data - 1]);
      if (!linhaData || dataKey_(linhaData) !== dataAlvo) continue;
    }

    var placaTexto = String(txt[r][col.placa - 1] || "").split(/[\s\[]/)[0];
    var placa = normalizarPlaca_(placaTexto);
    if (!placaValida_(placa)) continue;
    if (vistos[placa]) continue;
    vistos[placa] = true;

    var destino = col.destino ? String(txt[r][col.destino - 1] || "") : "";
    var transbordoCfg = getTransbordo_(destino);
    var tipoPlanilha = col.tipo ? String(txt[r][col.tipo - 1] || "") : "";
    var tipo = tipoPlanilha || (transbordoCfg ? "Transbordo" : "Entrega");
    var horaSaidaTexto = col.horaSaida ? String(txt[r][col.horaSaida - 1] || "") : "";
    var horaChegadaTexto = col.horaChegada ? String(txt[r][col.horaChegada - 1] || "") : "";
    var horarioLimiteTexto = col.horarioLimite ? String(txt[r][col.horarioLimite - 1] || "").replace(/^'/, "") : "";

    // Carimbo travado: primeiro a coluna Data/Hora, depois o texto da Hora.
    var carimboSaida = col.dataHoraSaida && dataValida_(raw[r][col.dataHoraSaida - 1]) ? raw[r][col.dataHoraSaida - 1] : null;
    if (!carimboSaida) carimboSaida = parseHoraComDia_(horaSaidaTexto, dataOperacional);
    var carimboChegada = col.dataHoraChegada && dataValida_(raw[r][col.dataHoraChegada - 1]) ? raw[r][col.dataHoraChegada - 1] : null;
    if (!carimboChegada) carimboChegada = parseHoraComDia_(horaChegadaTexto, dataOperacional);

    itens.push({
      linhaPlanilha: r + 2,
      dataOperacional: dataOperacional,
      placa: placa,
      placaOriginal: placaTexto,
      destino: destino,
      transportadora: col.transportadora ? String(txt[r][col.transportadora - 1] || "") : "",
      tipo: tipo,
      transbordoCfg: transbordoCfg,
      horarioLimite: horarioLimiteTexto || getHorarioLimite_(destino),
      horarioLimitePlanilha: horarioLimiteTexto,
      travaManual: colTrava ? ehSim_(txt[r][colTrava - 1]) : false,
      saiuPlanilha: col.saiu ? ehSim_(txt[r][col.saiu - 1]) : false,
      horaSaidaPlanilha: horaSaidaTexto,
      chegouPlanilha: col.chegou ? ehSim_(txt[r][col.chegou - 1]) : false,
      horaChegadaPlanilha: horaChegadaTexto,
      atrasoPlanilha: col.atraso ? String(txt[r][col.atraso - 1] || "") : "",
      statusGpsPlanilha: col.statusGPS ? String(txt[r][col.statusGPS - 1] || "") : "",
      ultimaPosicaoPlanilha: col.ultimaPosicao ? String(txt[r][col.ultimaPosicao - 1] || "") : "",
      // registro travado
      saidaTravada: carimboSaida,
      chegadaTravada: carimboChegada
    });
  }

  return { dataAlvo: dataAlvo, dataOperacional: dataOperacional, itens: itens };
}


/* ============================================================
   7. AUTENTICAÇÃO E CONSULTA ECLIPSE
   ============================================================ */

function extrairCookies_(resp) {
  if (!resp) return "";
  var headers = resp.getAllHeaders();
  var bruto = headers["Set-Cookie"] || headers["set-cookie"];
  if (!bruto) return "";
  return (Array.isArray(bruto) ? bruto : [bruto]).map(function(c) { return String(c).split(";")[0]; }).join("; ");
}
function loginEclipse_(conta) {
  var senha = getSenhaConta_(conta);
  if (!senha) return "";
  var resp;
  try {
    resp = UrlFetchApp.fetch(getLoginUrl_(), {
      method: "post",
      payload: { account: conta.account, user: conta.user, password: senha, pass: senha, submit: "Login" },
      followRedirects: false, muteHttpExceptions: true
    });
  } catch (e) { Logger.log("Falha de login Eclipse em " + conta.nome + ": " + e.message); return ""; }
  return extrairCookies_(resp);
}
function montarUnitDataUrl_(conta, placa) {
  var senha = getSenhaConta_(conta);
  var base = getUnitDataUrl_();
  var sep = base.indexOf("?") === -1 ? "?" : "&";
  return base + sep + "account=" + encodeURIComponent(conta.account) + "&user=" + encodeURIComponent(conta.user)
    + "&pass=" + encodeURIComponent(senha) + "&unitID=" + encodeURIComponent(normalizarPlaca_(placa).toLowerCase())
    + "&limit=" + encodeURIComponent(GPS_MONITOR_LIMIT);
}
function buscarUnitDataHttp_(conta, placa, cookie) {
  var opcoes = { method: "post", muteHttpExceptions: true, followRedirects: true };
  if (cookie) opcoes.headers = { Cookie: cookie };
  try {
    var resp = UrlFetchApp.fetch(montarUnitDataUrl_(conta, placa), opcoes);
    return { okHttp: resp.getResponseCode() >= 200 && resp.getResponseCode() < 300, code: resp.getResponseCode(), texto: resp.getContentText() };
  } catch (e) { return { okHttp: false, code: 0, texto: "", erro: e.message }; }
}

function parseDataHoraEvento_(ev) {
  if (!ev) return null;
  var data = ev.Timestamp_date || ev.Date || ev.date || "";
  var hora = ev.Timestamp_time || ev.Time || ev.time || "";
  if (!data || !hora) return null;
  var texto = String(data).trim() + " " + String(hora).trim();
  var formatos = ["yyyy/MM/dd HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "dd/MM/yyyy HH:mm:ss"];
  for (var i = 0; i < formatos.length; i++) { try { return Utilities.parseDate(texto, GPS_TZ, formatos[i]); } catch (e) {} }
  return null;
}
function eventosDoJson_(obj) {
  if (!obj) return [];
  var lista = null;
  if (Array.isArray(obj.DeviceList) && obj.DeviceList.length) lista = obj.DeviceList[0].EventData;
  if (!lista && Array.isArray(obj.EventData)) lista = obj.EventData;
  if (!Array.isArray(lista)) return [];
  return lista.filter(function(ev) { return !!parseDataHoraEvento_(ev); })
    .sort(function(a, b) { return parseDataHoraEvento_(a).getTime() - parseDataHoraEvento_(b).getTime(); });
}

/**
 * Busca os eventos crus de uma placa no Eclipse (tenta direto,
 * depois com sessão/cookie, alternando entre as contas ativas).
 */
function buscarEventosPlaca_(placa, transportadora, contexto) {
  contexto = contexto || {};
  contexto.cookies = contexto.cookies || {};
  contexto.mapaConta = contexto.mapaConta || getMapaContaPlaca_();

  var contas = ordenarContasParaPlaca_(placa, transportadora, contexto.mapaConta);
  if (!contas.length) return { ok: false, eventos: [], erro: "Nenhuma conta Eclipse configurada" };

  var ultimoErro = "Sem resposta";

  for (var i = 0; i < contas.length; i++) {
    var conta = contas[i];

    var direto = buscarUnitDataHttp_(conta, placa, "");
    if (direto.okHttp) {
      var obj = null;
      try { obj = JSON.parse(String(direto.texto || "").trim()); } catch (e) {}
      var eventos = eventosDoJson_(obj);
      if (eventos.length) {
        contexto.mapaConta[placa] = conta.key;
        return { ok: true, eventos: eventos, contaKey: conta.key, contaNome: conta.nome };
      }
      ultimoErro = "Sem eventos para esta conta/placa";
    } else {
      ultimoErro = direto.erro || ("HTTP " + direto.code);
    }

    if (!contexto.cookies[conta.key]) contexto.cookies[conta.key] = loginEclipse_(conta);
    var cookie = contexto.cookies[conta.key];
    if (cookie) {
      var comSessao = buscarUnitDataHttp_(conta, placa, cookie);
      if (comSessao.okHttp) {
        var obj2 = null;
        try { obj2 = JSON.parse(String(comSessao.texto || "").trim()); } catch (e) {}
        var eventos2 = eventosDoJson_(obj2);
        if (eventos2.length) {
          contexto.mapaConta[placa] = conta.key;
          return { ok: true, eventos: eventos2, contaKey: conta.key, contaNome: conta.nome };
        }
        ultimoErro = "Sem eventos para esta conta/placa";
      } else {
        ultimoErro = comSessao.erro || ("HTTP " + comSessao.code);
      }
    }
  }

  return { ok: false, eventos: [], erro: ultimoErro };
}


/* ============================================================
   8. CERCA ELETRÔNICA / DETECÇÃO DE SAÍDA E CHEGADA
   ============================================================ */

// Está dentro da cerca da base? Geozone (sinal principal do
// Eclipse) -> texto do endereço -> coordenada+raio (reserva).
function estaNaBase_(ev) {
  var zona = semAcento_(ev.Geozone || "");
  if (zona && zona.indexOf(ZONA_BASE) !== -1) return true;
  var endereco = semAcento_(ev.Address || ev.Endereco || "");
  if (endereco.indexOf(TEXTO_BASE) !== -1) return true;
  var lat = numeroSeguro_(ev.GPSPoint_lat != null ? ev.GPSPoint_lat : ev.Latitude);
  var lon = numeroSeguro_(ev.GPSPoint_lon != null ? ev.GPSPoint_lon : ev.Longitude);
  if (lat === null || lon === null) return false;
  return distanciaMetros_(lat, lon, BASE_GRF.lat, BASE_GRF.lon) <= BASE_GRF.raio;
}

/**
 * Saída = transição "estava na base -> saiu da base" que NÃO
 * volta dentro da janela de manobra/balança, procurada apenas
 * DENTRO da janela do dia operacional (véspera 21h -> fim do dia).
 * Fora dessa janela nada é considerado: é o que impede uma
 * programação antiga de "achar" uma saída de dias depois.
 */
function detectarSaidaBase_(eventos, dataOperacional) {
  var janela = janelaSaida_(dataOperacional);
  if (!eventos.length || !janela || janela.fim <= janela.ini) return null;

  var dentro = eventos.filter(function(ev) {
    var t = parseDataHoraEvento_(ev);
    return t && t.getTime() >= janela.ini && t.getTime() <= janela.fim;
  });
  if (!dentro.length) return null;

  var manobraMs = MAX_MANOBRA_MIN * 60000;
  var posicoes = dentro.map(function(ev) { return { dataHora: parseDataHoraEvento_(ev), naBase: estaNaBase_(ev) }; });

  for (var i = 1; i < posicoes.length; i++) {
    if (!(posicoes[i - 1].naBase && !posicoes[i].naBase)) continue;

    var t = posicoes[i].dataHora.getTime();
    var voltou = false;
    for (var j = i + 1; j < posicoes.length; j++) {
      if (posicoes[j].dataHora.getTime() - t > manobraMs) break;
      if (posicoes[j].naBase) { voltou = true; break; }
    }
    if (voltou) continue; // manobra / balança, não é saída de verdade

    return posicoes[i].dataHora;
  }

  // Já estava fora da base no começo da janela — trata como já saído.
  if (!posicoes[0].naBase) return posicoes[0].dataHora;
  return null;
}

/**
 * Chegada em ponto de transbordo: permanência sustentada dentro
 * do raio do ponto de apoio (parado, ou 2+ leituras seguidas),
 * dentro da janela do dia operacional + manhã seguinte.
 */
function detectarChegadaTransbordo_(eventos, transbordoCfg, dataOperacional, dataHoraSaida) {
  var janela = janelaChegada_(dataOperacional);
  if (!eventos.length || !transbordoCfg || !janela || janela.fim <= janela.ini) return null;

  // Chegada nunca é anterior à saída travada.
  var pisoMs = dataValida_(dataHoraSaida) ? Math.max(janela.ini, dataHoraSaida.getTime()) : janela.ini;
  var dentroDesde = null, dentroConsec = 0;

  for (var i = 0; i < eventos.length; i++) {
    var ev = eventos[i];
    var t = parseDataHoraEvento_(ev);
    if (!t) continue;
    var ms = t.getTime();
    if (ms < pisoMs) continue;
    if (ms > janela.fim) break;

    var lat = numeroSeguro_(ev.GPSPoint_lat != null ? ev.GPSPoint_lat : ev.Latitude);
    var lon = numeroSeguro_(ev.GPSPoint_lon != null ? ev.GPSPoint_lon : ev.Longitude);
    if (lat === null || lon === null) continue;

    var dist = distanciaMetros_(lat, lon, transbordoCfg.lat, transbordoCfg.lon);
    if (dist > (transbordoCfg.raio || 400)) { dentroDesde = null; dentroConsec = 0; continue; }

    dentroConsec++;
    if (!dentroDesde) dentroDesde = t;
    var vel = numeroSeguro_(ev.Speed);
    var parado = vel !== null && vel <= GPS_STOP_SPEED_KMH;
    var permanenciaMin = Math.round((ms - dentroDesde.getTime()) / 60000);

    if (parado || (dentroConsec >= 2 && permanenciaMin >= 2)) return t;
  }
  return null;
}

// Zona atual do Eclipse, para exibição ao vivo no Monitoramento.
function cercaEletronicaAoVivo_(eventos) {
  var ultimo = eventos[eventos.length - 1];
  var zona = String((ultimo && ultimo.Geozone) || "").trim();
  return { zonaGps: zona, chegouViaGps: !!zona, chegouGpsDataHora: zona ? parseDataHoraEvento_(ultimo) : null };
}


/* ============================================================
   9. SITUAÇÃO AO VIVO E ESTADO OPERACIONAL
   ============================================================ */

function calcularParadaAtual_(eventos, agora) {
  if (!eventos.length) return { paradoMin: 0, paradoDesde: null };
  var ultimo = eventos[eventos.length - 1];
  var velUlt = numeroSeguro_(ultimo.Speed);
  var statusUlt = semAcento_(ultimo.StatusCode_desc || ultimo.Status || "");
  if ((velUlt !== null && velUlt > GPS_STOP_SPEED_KMH) || statusUlt.indexOf("em movimento") !== -1) return { paradoMin: 0, paradoDesde: null };

  var latRef = numeroSeguro_(ultimo.GPSPoint_lat != null ? ultimo.GPSPoint_lat : ultimo.Latitude);
  var lonRef = numeroSeguro_(ultimo.GPSPoint_lon != null ? ultimo.GPSPoint_lon : ultimo.Longitude);
  var inicio = parseDataHoraEvento_(ultimo);

  for (var i = eventos.length - 2; i >= 0; i--) {
    var ev = eventos[i];
    var instante = parseDataHoraEvento_(ev);
    if (!instante) continue;
    var vel = numeroSeguro_(ev.Speed);
    var status = semAcento_(ev.StatusCode_desc || ev.Status || "");
    if ((vel !== null && vel > GPS_STOP_SPEED_KMH) || status.indexOf("em movimento") !== -1) break;
    var lat = numeroSeguro_(ev.GPSPoint_lat != null ? ev.GPSPoint_lat : ev.Latitude);
    var lon = numeroSeguro_(ev.GPSPoint_lon != null ? ev.GPSPoint_lon : ev.Longitude);
    if (latRef !== null && lonRef !== null && lat !== null && lon !== null && distanciaMetros_(lat, lon, latRef, lonRef) > GPS_STOP_RADIUS_M) break;
    inicio = instante;
  }
  if (!inicio) return { paradoMin: 0, paradoDesde: null };
  var fim = agora || new Date();
  return { paradoMin: Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 60000)), paradoDesde: inicio };
}

function resumirSituacaoAoVivo_(eventos) {
  if (!eventos.length) return { ok: false, erro: "Sem eventos" };

  var agora = new Date();
  var ultimo = eventos[eventos.length - 1];
  var gpsDataHora = parseDataHoraEvento_(ultimo);
  var gpsIdadeMin = gpsDataHora ? Math.max(0, Math.round((agora.getTime() - gpsDataHora.getTime()) / 60000)) : null;
  var velocidade = numeroSeguro_(ultimo.Speed);
  if (velocidade === null) velocidade = 0;
  var statusEclipse = String(ultimo.StatusCode_desc || ultimo.Status || "").trim();
  var statusNorm = semAcento_(statusEclipse);
  var parada = calcularParadaAtual_(eventos, agora);
  var gpsDesatualizado = gpsIdadeMin === null || gpsIdadeMin > GPS_STALE_MIN;

  // Situação exibida no Monitoramento — a mesma régua dos cards.
  var situacao;
  if (gpsDesatualizado) situacao = "GPS DESATUALIZADO";
  else if (velocidade > GPS_STOP_SPEED_KMH || statusNorm.indexOf("em movimento") !== -1) situacao = "EM MOVIMENTO";
  else if (parada.paradoMin >= GPS_ATENCAO_MIN) situacao = "PARADA PROLONGADA";
  else if (parada.paradoMin >= GPS_STOP_CRIT_MIN) situacao = "PARADO";
  else situacao = "EM ROTA";

  var latitude = numeroSeguro_(ultimo.GPSPoint_lat != null ? ultimo.GPSPoint_lat : ultimo.Latitude);
  var longitude = numeroSeguro_(ultimo.GPSPoint_lon != null ? ultimo.GPSPoint_lon : ultimo.Longitude);
  var endereco = String(ultimo.Address || ultimo.Endereco || ultimo.Location || "").trim();
  if (!endereco && latitude !== null && longitude !== null) endereco = latitude.toFixed(5) + ", " + longitude.toFixed(5);

  var cerca = cercaEletronicaAoVivo_(eventos);

  return {
    ok: true, statusEclipse: statusEclipse, situacao: situacao, velocidade: velocidade,
    gpsDataHora: gpsDataHora, gpsIdadeMin: gpsIdadeMin, latitude: latitude, longitude: longitude,
    endereco: endereco, paradoDesde: parada.paradoDesde, paradoMin: parada.paradoMin,
    hodometro: numeroSeguro_(ultimo.Odometer != null ? ultimo.Odometer : ultimo.Odometer_km),
    zonaGps: cerca.zonaGps, chegouViaGps: cerca.chegouViaGps, chegouGpsDataHora: cerca.chegouGpsDataHora
  };
}

/**
 * ESTADO OPERACIONAL — um estado por veículo, e é dele que saem
 * os cards, o Status da Frota e o Cumprimento das Saídas.
 *
 *   Na base    não saiu
 *   Concluído  transbordo que já chegou no ponto de apoio
 *   Sem sinal  sem leitura de GPS recente
 *   Em atenção parado há mais de GPS_ATENCAO_MIN (1h)
 *   Parado     parado há GPS_STOP_CRIT_MIN (45 min) ou mais
 *   Em rota    em movimento ou parada curta
 */
function estadoOperacional_(saiu, chegou, gpsIdadeMin, paradoMin) {
  if (!saiu) return ESTADO_NA_BASE;
  if (chegou) return ESTADO_CONCLUIDO;
  if (gpsIdadeMin === null || gpsIdadeMin === undefined || gpsIdadeMin > GPS_STALE_MIN) return ESTADO_SEM_SINAL;
  var parado = Number(paradoMin) || 0;
  if (parado >= GPS_ATENCAO_MIN) return ESTADO_ATENCAO;
  if (parado >= GPS_STOP_CRIT_MIN) return ESTADO_PARADO;
  return ESTADO_EM_ROTA;
}


/* ============================================================
   9.1 O TRAVAMENTO EM SI
   ============================================================ */

/**
 * Decide o registro do dia para uma linha da Programação.
 *
 * A regra é uma só: o que já está carimbado manda. Só se procura
 * saída quando ainda não existe carimbo de saída; só se procura
 * chegada quando já existe saída e ainda não existe carimbo de
 * chegada. Consulta de GPS que falhou não apaga nada — sem
 * eventos, o registro simplesmente continua como estava.
 *
 * Devolve também o atraso, que é calculado contra o horário-limite
 * no instante da saída e portanto congela junto com ela.
 */
function resolverRegistroDoDia_(item, eventos, agoraMs) {
  var limiteDataHora = dataHoraLimite_(item.dataOperacional, item.horarioLimite);
  var fimDoDia = fimDoDiaOperacional_(item.dataOperacional);
  var diaFechado = agoraMs > fimDoDia;

  var dtSaida = dataValida_(item.saidaTravada) ? item.saidaTravada : null;
  var dtChegada = dataValida_(item.chegadaTravada) ? item.chegadaTravada : null;
  var novos = 0;

  if (!item.travaManual && !dtSaida) {
    var det = detectarSaidaBase_(eventos || [], item.dataOperacional);
    if (det && det.getTime() <= agoraMs) { dtSaida = det; novos++; }
  }
  if (!item.travaManual && item.transbordoCfg && dtSaida && !dtChegada) {
    var detCheg = detectarChegadaTransbordo_(eventos || [], item.transbordoCfg, item.dataOperacional, dtSaida);
    if (detCheg && detCheg.getTime() <= agoraMs) { dtChegada = detCheg; novos++; }
  }

  var saiu = !!dtSaida || item.saiuPlanilha;
  var chegou = !!dtChegada || (item.transbordoCfg ? item.chegouPlanilha : false);

  var atrasoMin;
  if (dtSaida) atrasoMin = calcularAtrasoMin_(limiteDataHora, dtSaida);
  else if (saiu) atrasoMin = null; // marcada como saída sem hora: não dá para medir
  else atrasoMin = Math.max(0, calcularAtrasoMin_(limiteDataHora, new Date(Math.min(agoraMs, fimDoDia))));

  return {
    dtSaida: dtSaida,
    dtChegada: dtChegada,
    saiu: saiu,
    chegou: chegou,
    horaSaidaTexto: dtSaida ? formatarHoraComDia_(dtSaida, item.dataOperacional) : item.horaSaidaPlanilha,
    horaChegadaTexto: dtChegada ? formatarHoraComDia_(dtChegada, item.dataOperacional) : item.horaChegadaPlanilha,
    atrasoMin: atrasoMin,
    saidaStatus: saidaStatusDe_(saiu, dtSaida ? atrasoMin : null),
    status: statusPrazo_(saiu, atrasoMin, diaFechado),
    novosRegistros: novos
  };
}


/* ============================================================
   10. MONITORAMENTO PRINCIPAL (detecta, TRAVA e escreve)
   ============================================================ */

// Só escreve quando o valor mudou de verdade — linha travada
// não é reescrita a cada rodada.
function escreverSeMudou_(sheet, linha, coluna, valor, atual) {
  if (!coluna) return;
  var novo = valor === null || valor === undefined ? "" : String(valor);
  // o apóstrofo à frente força texto na célula, mas não aparece no valor exibido
  var comparavel = novo.replace(/^'/, "");
  if (String(atual == null ? "" : atual).replace(/^'/, "") === comparavel) return;
  sheet.getRange(linha, coluna).setValue(novo);
}

function linhaMonitoramento_(item, resumo) {
  var agora = new Date();
  if (!resumo || !resumo.ok) {
    return [agora, item.placa, item.destino, item.transportadora, resumo && resumo.erro ? resumo.erro : "Sem resposta", "GPS DESATUALIZADO", 0, "", "", "", "", "", "", 0, "", "", false, ""];
  }
  return [
    agora, item.placa, item.destino, item.transportadora, resumo.statusEclipse, resumo.situacao,
    resumo.velocidade, resumo.gpsDataHora || "", resumo.gpsIdadeMin, resumo.latitude, resumo.longitude,
    resumo.endereco, resumo.paradoDesde || "", resumo.paradoMin, resumo.hodometro,
    resumo.zonaGps || "", !!resumo.chegouViaGps, resumo.chegouGpsDataHora || ""
  ];
}

function gravarMonitoramento_(linhas) {
  var ss = getPlanilha_();
  var sheet = garantirAbaMonitoramento_(ss);
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, GPS_MONITOR_HEADERS.length).clearContent();
  sheet.getRange(1, 1, 1, GPS_MONITOR_HEADERS.length).setValues([GPS_MONITOR_HEADERS]).setFontWeight("bold");
  if (linhas.length) sheet.getRange(2, 1, linhas.length, GPS_MONITOR_HEADERS.length).setValues(linhas);
  sheet.setFrozenRows(1);
  sheet.getRange("A:A").setNumberFormat("dd/MM/yyyy HH:mm:ss");
  sheet.getRange("H:H").setNumberFormat("dd/MM/yyyy HH:mm:ss");
  sheet.getRange("M:M").setNumberFormat("dd/MM/yyyy HH:mm:ss");
  sheet.getRange("R:R").setNumberFormat("dd/MM/yyyy HH:mm:ss");
  sheet.getRange("G:G").setNumberFormat("0.0");
}

function chaveHistorico_(dataOperacional, placa) {
  return dataValida_(dataOperacional) ? Utilities.formatDate(dataOperacional, GPS_TZ, "dd/MM/yyyy") + "|" + normalizarPlaca_(placa) : "";
}

/**
 * Upsert na Histórico por Data Operacional + Placa.
 * Regra de trava: linha que já registrou saída (ou chegada) nunca
 * é rebaixada por uma leitura pior — só melhora, nunca regride.
 */
function sincronizarHistorico_(ss, registros) {
  var hist = garantirAbaHistorico_(ss);
  var lastRow = hist.getLastRow();
  var existentes = lastRow > 1 ? hist.getRange(2, 1, lastRow - 1, CAB_HISTORICO.length).getValues() : [];
  var mapa = {};
  for (var i = 0; i < existentes.length; i++) {
    var k = chaveHistorico_(dataValida_(existentes[i][0]) ? existentes[i][0] : dataOperacionalDeTexto_(existentes[i][0]), existentes[i][1]);
    if (k) mapa[k] = i;
  }

  var novas = [];
  var agora = new Date();
  registros.forEach(function(l) {
    if (!l.dataOperacional) return;
    var k = chaveHistorico_(l.dataOperacional, l.placa);
    var idx = mapa[k];
    var saiu = l.saiu, horaSaida = l.horaSaida, atrasoMin = l.atrasoMin;
    var chegou = l.chegou, horaChegada = l.horaChegada;

    if (idx !== undefined) {
      var antiga = existentes[idx];
      // nunca apaga um registro de saída/chegada que já existia
      if (semAcento_(antiga[6]) === "sim" && String(antiga[7] || "") && saiu !== "Sim") {
        saiu = "Sim";
        horaSaida = antiga[7];
        atrasoMin = numeroSeguro_(antiga[8]);
      }
      if (semAcento_(antiga[11]) === "sim" && String(antiga[12] || "") && chegou !== "Sim") {
        chegou = "Sim";
        horaChegada = antiga[12];
      }
    }

    var vals = [
      l.dataOperacional, l.placa, l.transportadora, l.destino, l.tipo, l.horarioLimite,
      saiu, horaSaida, atrasoMin === null || atrasoMin === undefined ? "" : atrasoMin,
      formatarAtraso_(atrasoMin), l.status, chegou, horaChegada, agora
    ];
    if (idx !== undefined) existentes[idx] = vals; else novas.push(vals);
  });

  if (existentes.length) hist.getRange(2, 1, existentes.length, CAB_HISTORICO.length).setValues(existentes);
  if (novas.length) hist.getRange(existentes.length + 2, 1, novas.length, CAB_HISTORICO.length).setValues(novas);

  var n = Math.max(hist.getLastRow() - 1, 1);
  hist.getRange(2, 1, n, 1).setNumberFormat("dd/MM/yyyy");
  hist.getRange(2, 14, n, 1).setNumberFormat("dd/MM/yyyy HH:mm");
}

/**
 * FUNÇÃO PRINCIPAL. Fica no gatilho (GPS_INTERVALO_MIN em min).
 *
 * Para cada veículo do dia:
 *   1. lê o registro já travado (carimbo de saída/chegada);
 *   2. consulta o Eclipse para a posição ao vivo;
 *   3. SÓ detecta o que ainda não está travado — saída travada
 *      não é reavaliada, chegada travada não é reavaliada;
 *   4. carimba o que detectou agora e nunca mais mexe;
 *   5. escreve Programação, Monitoramento e Histórico.
 */
function atualizarMonitoramentoGPS() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) { Logger.log("Outra atualização já está em execução."); return; }

  try {
    var ss = getPlanilha_();
    var progSheet = getProgramacaoSheet_(ss);
    garantirColunasCarimbo_(progSheet);
    var col = mapearColunasProgramacao_(progSheet);
    var colTrava = garantirColunaTrava_(progSheet);

    resetarSeProgramacaoNova_(progSheet, col, colTrava);
    col = mapearColunasProgramacao_(progSheet);

    var prog = coletarProgramacao_(progSheet, col, colTrava);
    if (!prog.itens.length) {
      gravarMonitoramento_([]);
      Logger.log("Nenhum veículo encontrado na Programação de hoje.");
      return;
    }

    var contexto = { cookies: {}, mapaConta: getMapaContaPlaca_() };
    var linhasMonitor = [];
    var registrosHistorico = [];
    var agoraMs = Date.now();
    var novosRegistros = 0;

    prog.itens.forEach(function(item) {
      var busca = buscarEventosPlaca_(item.placa, item.transportadora, contexto);
      var eventos = busca.ok ? busca.eventos : [];
      var resumo = busca.ok ? resumirSituacaoAoVivo_(eventos) : null;

      var reg = resolverRegistroDoDia_(item, eventos, agoraMs);
      novosRegistros += reg.novosRegistros;

      var dtSaida = reg.dtSaida;
      var dtChegada = reg.dtChegada;
      var saiu = reg.saiu;
      var chegou = reg.chegou;
      var horaSaidaTexto = reg.horaSaidaTexto;
      var horaChegadaTexto = reg.horaChegadaTexto;
      var atrasoMin = reg.atrasoMin;
      var status = reg.status;

      // --- escrita na Programação (só o que mudou) ---
      escreverSeMudou_(progSheet, item.linhaPlanilha, col.saiu, saiu ? "Sim" : "Não", item.saiuPlanilha ? "Sim" : "Não");
      escreverSeMudou_(progSheet, item.linhaPlanilha, col.horaSaida, horaSaidaTexto ? "'" + horaSaidaTexto : "", item.horaSaidaPlanilha ? "'" + item.horaSaidaPlanilha : "");
      escreverSeMudou_(progSheet, item.linhaPlanilha, col.horarioLimite, "'" + item.horarioLimite, item.horarioLimitePlanilha);
      if (col.dataHoraSaida && dtSaida && !dataValida_(item.saidaTravada)) {
        progSheet.getRange(item.linhaPlanilha, col.dataHoraSaida).setValue(dtSaida).setNumberFormat("dd/MM/yyyy HH:mm");
      }
      if (item.transbordoCfg) {
        escreverSeMudou_(progSheet, item.linhaPlanilha, col.chegou, chegou ? "Sim" : "Não", item.chegouPlanilha ? "Sim" : "Não");
        escreverSeMudou_(progSheet, item.linhaPlanilha, col.horaChegada, horaChegadaTexto ? "'" + horaChegadaTexto : "", item.horaChegadaPlanilha ? "'" + item.horaChegadaPlanilha : "");
        if (col.dataHoraChegada && dtChegada && !dataValida_(item.chegadaTravada)) {
          progSheet.getRange(item.linhaPlanilha, col.dataHoraChegada).setValue(dtChegada).setNumberFormat("dd/MM/yyyy HH:mm");
        }
      }
      var atrasoTexto = saiu || status !== "Não saiu" ? formatarAtraso_(atrasoMin) : "Não saiu";
      escreverSeMudou_(progSheet, item.linhaPlanilha, col.atraso, atrasoTexto, item.atrasoPlanilha);
      if (resumo && resumo.ok) {
        escreverSeMudou_(progSheet, item.linhaPlanilha, col.statusGPS, resumo.statusEclipse, item.statusGpsPlanilha);
        escreverSeMudou_(progSheet, item.linhaPlanilha, col.ultimaPosicao, resumo.endereco, item.ultimaPosicaoPlanilha);
      }

      linhasMonitor.push(linhaMonitoramento_(item, resumo));
      registrosHistorico.push({
        dataOperacional: item.dataOperacional, placa: item.placa, transportadora: item.transportadora,
        destino: item.destino, tipo: item.tipo, horarioLimite: item.horarioLimite,
        saiu: saiu ? "Sim" : "Não", horaSaida: horaSaidaTexto, atrasoMin: atrasoMin, status: status,
        chegou: item.transbordoCfg ? (chegou ? "Sim" : "Não") : "", horaChegada: horaChegadaTexto
      });
    });

    salvarMapaContaPlaca_(contexto.mapaConta);
    gravarMonitoramento_(linhasMonitor);
    sincronizarHistorico_(ss, registrosHistorico);
    SpreadsheetApp.flush();

    Logger.log("Monitoramento atualizado: " + linhasMonitor.length + " veículos, " + novosRegistros + " registro(s) novo(s) travado(s).");
  } finally {
    lock.releaseLock();
  }
}


/* ============================================================
   11. GATILHO DE EDIÇÃO MANUAL (trava automática)
   ============================================================ */

/**
 * Instalável como gatilho onEdit. Se um humano editar Saiu?/Hora
 * Saída/Chegou?/Hora Chegada na Programação, marca a linha como
 * travada — o script para de tentar detectar/sobrescrever ali.
 * Escrita feita pelo próprio script não aciona onEdit (só edição
 * humana real), então não tem risco de loop.
 */
function aoEditarProgramacao(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== GPS_PROGRAMACAO_SHEET) return;
  var linha = e.range.getRow();
  if (linha < 2) return;

  var col = mapearColunasProgramacao_(sheet);
  var alvo = [col.saiu, col.horaSaida, col.chegou, col.horaChegada];
  var ini = e.range.getColumn(), fim = ini + e.range.getNumColumns() - 1;
  var tocou = false;
  for (var c = ini; c <= fim; c++) if (alvo.indexOf(c) !== -1) tocou = true;
  if (!tocou) return;

  var colTrava = garantirColunaTrava_(sheet);
  var nLinhas = e.range.getNumRows();
  var marcas = [];
  for (var i = 0; i < nLinhas; i++) marcas.push(["S"]);
  sheet.getRange(linha, colTrava, nLinhas, 1).setValues(marcas);
}

// Libera todas as travas manuais (o reset de dia novo já faz isso).
function liberarTravas() {
  var ss = getPlanilha_();
  var sheet = getProgramacaoSheet_(ss);
  var colTrava = garantirColunaTrava_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, colTrava, lastRow - 1, 1).clearContent();
  Logger.log("Travas liberadas.");
}

/**
 * Destrava os carimbos do dia atual e força nova detecção.
 * Use só quando a detecção errou e a operação quer refazer —
 * é a única forma de reabrir um registro travado sem trocar o dia.
 */
function reabrirRegistrosDoDia() {
  var ss = getPlanilha_();
  var sheet = getProgramacaoSheet_(ss);
  garantirColunasCarimbo_(sheet);
  var col = mapearColunasProgramacao_(sheet);
  var colTrava = garantirColunaTrava_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var n = lastRow - 1;
  [col.saiu, col.horaSaida, col.chegou, col.horaChegada, col.atraso,
   col.dataHoraSaida, col.dataHoraChegada, colTrava].forEach(function(c) {
    if (c) sheet.getRange(2, c, n, 1).clearContent();
  });
  Logger.log("Registros do dia reabertos. A próxima rodada detecta tudo de novo.");
}


/* ============================================================
   12. API JSON PARA O PAINEL
   ============================================================ */

function lerMonitoramento_() {
  var ss = getPlanilha_();
  var sheet = ss.getSheetByName(GPS_MONITOR_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var qtd = sheet.getLastRow() - 1;
  var raw = sheet.getRange(2, 1, qtd, GPS_MONITOR_HEADERS.length).getValues();
  var txt = sheet.getRange(2, 1, qtd, GPS_MONITOR_HEADERS.length).getDisplayValues();
  return raw.map(function(r, i) {
    return {
      atualizadoEm: isoOuNull_(r[0]), placa: txt[i][1] || "", destino: txt[i][2] || "", transportadora: txt[i][3] || "",
      statusEclipse: txt[i][4] || "", situacao: txt[i][5] || "", velocidade: numeroSeguro_(r[6]) || 0,
      gpsDataHora: isoOuNull_(r[7]), gpsIdadeMin: r[8] === "" ? null : numeroSeguro_(r[8]),
      latitude: r[9] === "" ? null : numeroSeguro_(r[9]), longitude: r[10] === "" ? null : numeroSeguro_(r[10]),
      endereco: txt[i][11] || "", paradoDesde: isoOuNull_(r[12]), paradoMin: r[13] === "" ? 0 : numeroSeguro_(r[13]),
      hodometro: r[14] === "" ? null : numeroSeguro_(r[14]), zonaGps: txt[i][15] || "",
      chegouViaGps: r[16] === true, chegouGpsDataHora: isoOuNull_(r[17])
    };
  });
}

/**
 * Monta `operacao` direto da Programação — que agora é a fonte
 * travada da verdade (Data/Hora Saída e Data/Hora Chegada).
 * Cruza com o Monitoramento só para o estado ao vivo.
 */
function montarOperacaoDaProgramacao_(prog, monitoramento) {
  var porPlaca = {};
  (monitoramento || []).forEach(function(m) {
    var p = normalizarPlaca_(m.placa);
    if (p && !porPlaca[p]) porPlaca[p] = m;
  });

  var agoraMs = Date.now();
  var diaFechado = agoraMs > fimDoDiaOperacional_(prog.dataOperacional);

  return prog.itens.map(function(item, i) {
    var limiteDataHora = dataHoraLimite_(item.dataOperacional, item.horarioLimite);
    // Sem eventos: aqui nada é detectado, só se lê o que já está travado.
    var reg = resolverRegistroDoDia_(item, [], agoraMs);
    var dtSaida = reg.dtSaida;
    var dtChegada = reg.dtChegada;
    var saiu = reg.saiu;
    var chegou = reg.chegou;
    var atrasoMin = reg.atrasoMin;

    var m = porPlaca[item.placa];
    var gpsIdadeMin = m ? m.gpsIdadeMin : null;
    var paradoMin = m ? m.paradoMin : null;
    var estado = estadoOperacional_(saiu, chegou, gpsIdadeMin, paradoMin);

    return {
      linha: i + 1,
      dataOperacional: prog.dataAlvo,
      placa: item.placa,
      placaOriginal: item.placaOriginal || item.placa,
      motorista: null,
      transportadora: item.transportadora || (m ? m.transportadora : "") || "",
      destino: item.destino || (m ? m.destino : "") || "",
      tipo: item.transbordoCfg ? "Transbordo" : (item.tipo || "Entrega"),
      pontoApoio: item.transbordoCfg ? item.transbordoCfg.nome : null,
      horarioLimite: item.horarioLimite,
      dataHoraPrevistaSaida: isoOuNull_(limiteDataHora),
      saiu: saiu,
      horaSaida: reg.horaSaidaTexto || null,
      dataHoraSaida: isoOuNull_(dtSaida),
      fonteHoraSaida: item.travaManual ? "manual" : (dtSaida ? "gps" : "planilha"),
      horarioSaidaDivergente: false,
      statusSaidaInconsistente: saiu && !dtSaida,
      slaSaidaConfiavel: !!dtSaida,
      saidaAtrasoMin: atrasoMin,
      saidaStatus: reg.saidaStatus,
      atrasoTexto: saiu ? formatarAtraso_(atrasoMin) : (diaFechado ? "Não saiu" : formatarAtraso_(atrasoMin)),
      statusPrazo: reg.status,
      chegou: chegou,
      horaChegada: reg.horaChegadaTexto || null,
      dataHoraChegada: isoOuNull_(dtChegada),
      fonteHoraChegada: item.travaManual ? "manual" : (dtChegada ? "gps" : "planilha"),
      horarioChegadaDivergente: false,
      statusChegadaInconsistente: !!item.transbordoCfg && chegou && !dtChegada,
      tempoViagemMin: dtSaida && dtChegada ? Math.round((dtChegada.getTime() - dtSaida.getTime()) / 60000) : null,
      travaManual: !!item.travaManual,
      registroTravado: !!dtSaida,
      estado: estado,
      paradoMin: paradoMin,
      gpsIdadeMin: gpsIdadeMin,
      zonaGps: m ? m.zonaGps : null
    };
  });
}

/**
 * INDICADOR HISTÓRICO — quem mais atrasa para sair.
 * Lê a aba Histórico dos últimos HISTORICO_DIAS dias e devolve o
 * ranking por transportadora e por veículo. Adiantamento conta
 * como zero: o que se mede é atraso, não crédito por sair cedo.
 */
function montarHistoricoIndicador_(dias) {
  var janelaDias = dias || HISTORICO_DIAS;
  var ss = getPlanilha_();
  var hist = ss.getSheetByName(GPS_HISTORICO_SHEET);
  var vazio = { dias: janelaDias, de: null, ate: null, totalProgramados: 0, totalSaidas: 0, transportadoras: [], veiculos: [] };
  if (!hist || hist.getLastRow() < 2) return vazio;

  var lastRow = hist.getLastRow();
  var raw = hist.getRange(2, 1, lastRow - 1, CAB_HISTORICO.length).getValues();
  var txt = hist.getRange(2, 1, lastRow - 1, CAB_HISTORICO.length).getDisplayValues();

  var hoje = new Date();
  var corte = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - janelaDias, 0, 0, 0).getTime();

  var porTransp = {}, porVeiculo = {};
  var de = null, ate = null, totalProgramados = 0, totalSaidas = 0;

  function bucket(mapa, chave, extras) {
    if (!mapa[chave]) {
      mapa[chave] = { chave: chave, programados: 0, saidas: 0, noHorario: 0, atrasadas: 0, somaAtraso: 0, atrasoMaxMin: 0, dias: {} };
      for (var k in extras) mapa[chave][k] = extras[k];
    }
    return mapa[chave];
  }

  for (var r = 0; r < raw.length; r++) {
    var dataOper = dataValida_(raw[r][0]) ? raw[r][0] : dataOperacionalDeTexto_(txt[r][0]);
    if (!dataOper || dataOper.getTime() < corte) continue;

    var placa = normalizarPlaca_(txt[r][1]);
    if (!placaValida_(placa)) continue;

    var transportadora = String(txt[r][2] || "").trim() || "Sem transportadora";
    var destino = String(txt[r][3] || "").trim();
    var saiu = semAcento_(txt[r][6]) === "sim";
    var horaSaida = String(txt[r][7] || "").trim();
    var atraso = numeroSeguro_(raw[r][8]);
    var diaKey = dataKey_(dataOper);

    if (!de || diaKey < de) de = diaKey;
    if (!ate || diaKey > ate) ate = diaKey;
    totalProgramados++;

    var bt = bucket(porTransp, transportadora, { nome: transportadora });
    var bv = bucket(porVeiculo, placa, { placa: placa, transportadora: transportadora, destino: destino });
    bv.transportadora = transportadora;

    bt.programados++; bv.programados++;
    bt.dias[diaKey] = true; bv.dias[diaKey] = true;

    // Só entra na conta de atraso quem realmente saiu e tem hora medida.
    if (!saiu || !horaSaida || atraso === null) continue;
    totalSaidas++;
    var atrasoPositivo = Math.max(0, atraso);
    [bt, bv].forEach(function(b) {
      b.saidas++;
      b.somaAtraso += atrasoPositivo;
      if (atrasoPositivo > b.atrasoMaxMin) b.atrasoMaxMin = atrasoPositivo;
      if (atraso > 0) b.atrasadas++; else b.noHorario++;
    });
  }

  function finalizar(mapa) {
    return Object.keys(mapa).map(function(k) {
      var b = mapa[k];
      var atrasoMedioMin = b.saidas ? Math.round(b.somaAtraso / b.saidas) : 0;
      return {
        nome: b.nome || null,
        placa: b.placa || null,
        transportadora: b.transportadora || null,
        destino: b.destino || null,
        programados: b.programados,
        saidas: b.saidas,
        noHorario: b.noHorario,
        atrasadas: b.atrasadas,
        atrasoMedioMin: atrasoMedioMin,
        atrasoMaxMin: b.atrasoMaxMin,
        pctNoHorario: b.saidas ? Math.round((b.noHorario / b.saidas) * 100) : 0,
        diasComRegistro: Object.keys(b.dias).length
      };
    }).sort(function(a, b) {
      if (b.atrasoMedioMin !== a.atrasoMedioMin) return b.atrasoMedioMin - a.atrasoMedioMin;
      return b.atrasadas - a.atrasadas;
    });
  }

  return {
    dias: janelaDias,
    de: de,
    ate: ate,
    totalProgramados: totalProgramados,
    totalSaidas: totalSaidas,
    transportadoras: finalizar(porTransp),
    veiculos: finalizar(porVeiculo)
  };
}

/**
 * Web App consumido pelo painel. Devolve `monitoramento` (GPS ao
 * vivo), `operacao` (grade travada do dia) e `historico`
 * (ranking de atraso na saída).
 */
function doGet(e) {
  var payload;
  try {
    var progSheet = getProgramacaoSheet_(getPlanilha_());
    var col = mapearColunasProgramacao_(progSheet);
    var prog = coletarProgramacao_(progSheet, col, garantirColunaTrava_(progSheet));
    var monitoramento = lerMonitoramento_();
    var dias = e && e.parameter && e.parameter.dias ? (parseInt(e.parameter.dias, 10) || HISTORICO_DIAS) : HISTORICO_DIAS;

    payload = {
      ok: true,
      servidor: new Date().toISOString(),
      timezone: GPS_TZ,
      staleMin: GPS_STALE_MIN,
      stopWarnMin: GPS_STOP_WARN_MIN,
      stopCritMin: GPS_STOP_CRIT_MIN,
      stopAttentionMin: GPS_ATENCAO_MIN,
      atrasoAltoMin: GPS_ATRASO_ALTO_MIN,
      dataOperacional: prog.dataAlvo,
      monitoramento: monitoramento,
      operacao: montarOperacaoDaProgramacao_(prog, monitoramento),
      historico: montarHistoricoIndicador_(dias)
    };
  } catch (err) {
    payload = { ok: false, servidor: new Date().toISOString(), erro: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}


/* ============================================================
   13. TESTES / DIAGNÓSTICO
   ============================================================ */

function testarEclipsePZN2626() {
  var contexto = { cookies: {}, mapaConta: getMapaContaPlaca_() };
  var busca = buscarEventosPlaca_("PZN2626", "", contexto);
  salvarMapaContaPlaca_(contexto.mapaConta);
  var resumo = busca.ok ? resumirSituacaoAoVivo_(busca.eventos) : { ok: false, erro: busca.erro };
  Logger.log(JSON.stringify({ ok: busca.ok, conta: busca.contaNome || null, qtdEventos: busca.eventos.length, resumo: resumo }, null, 2));
  return resumo;
}

function testarProgramacao() {
  var ss = getPlanilha_();
  var sheet = getProgramacaoSheet_(ss);
  var col = mapearColunasProgramacao_(sheet);
  var prog = coletarProgramacao_(sheet, col, garantirColunaTrava_(sheet));
  Logger.log(JSON.stringify(prog, null, 2));
  return prog;
}

function testarOperacao() {
  var prog = testarProgramacao();
  var operacao = montarOperacaoDaProgramacao_(prog, lerMonitoramento_());
  Logger.log(JSON.stringify(operacao, null, 2));
  return operacao;
}

function testarHistorico() {
  var h = montarHistoricoIndicador_(HISTORICO_DIAS);
  Logger.log("Período: " + h.de + " a " + h.ate + " | saídas medidas: " + h.totalSaidas);
  Logger.log("TRANSPORTADORAS (pior primeiro):");
  h.transportadoras.slice(0, 10).forEach(function(t) {
    Logger.log("  " + t.nome + " -> média +" + t.atrasoMedioMin + "min | pior +" + t.atrasoMaxMin + "min | " + t.pctNoHorario + "% no prazo (" + t.saidas + " saídas)");
  });
  Logger.log("VEÍCULOS (pior primeiro):");
  h.veiculos.slice(0, 10).forEach(function(v) {
    Logger.log("  " + v.placa + " (" + v.transportadora + ") -> média +" + v.atrasoMedioMin + "min | pior +" + v.atrasoMaxMin + "min (" + v.saidas + " saídas)");
  });
  return h;
}

function verCabecalhosProgramacao() {
  var sheet = getProgramacaoSheet_(getPlanilha_());
  var cab = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0];
  cab.forEach(function(n, i) { Logger.log((i + 1) + " -> " + (n || "[vazia]")); });
  Logger.log("MAPA: " + JSON.stringify(mapearColunasProgramacao_(sheet)));
}

function diagnosticarPlaca() {
  var PLACA = "PZN2626";
  var ss = getPlanilha_();
  var sheet = getProgramacaoSheet_(ss);
  var col = mapearColunasProgramacao_(sheet);
  var prog = coletarProgramacao_(sheet, col, garantirColunaTrava_(sheet));
  var item = null;
  for (var i = 0; i < prog.itens.length; i++) if (prog.itens[i].placa === normalizarPlaca_(PLACA)) { item = prog.itens[i]; break; }
  if (!item) { Logger.log("Placa não está na Programação de hoje."); return; }

  Logger.log("Placa: " + item.placa + " | destino: " + item.destino + " | tipo: " + item.tipo);
  Logger.log("Horário-limite: " + item.horarioLimite + " | trava manual: " + item.travaManual);
  Logger.log("Saída travada: " + (dataValida_(item.saidaTravada) ? Utilities.formatDate(item.saidaTravada, GPS_TZ, "dd/MM HH:mm") : "nenhuma"));
  Logger.log("Chegada travada: " + (dataValida_(item.chegadaTravada) ? Utilities.formatDate(item.chegadaTravada, GPS_TZ, "dd/MM HH:mm") : "nenhuma"));

  var contexto = { cookies: {}, mapaConta: getMapaContaPlaca_() };
  var busca = buscarEventosPlaca_(item.placa, item.transportadora, contexto);
  salvarMapaContaPlaca_(contexto.mapaConta);
  if (!busca.ok) { Logger.log("GPS não respondeu: " + busca.erro); return; }
  Logger.log("Conta: " + busca.contaNome + " | eventos recebidos: " + busca.eventos.length);

  var dtSaida = detectarSaidaBase_(busca.eventos, item.dataOperacional);
  Logger.log("Saída que seria detectada agora: " + (dtSaida ? Utilities.formatDate(dtSaida, GPS_TZ, "dd/MM HH:mm") : "NENHUMA"));

  if (item.transbordoCfg) {
    var dtChegada = detectarChegadaTransbordo_(busca.eventos, item.transbordoCfg, item.dataOperacional, item.saidaTravada || dtSaida);
    Logger.log("Ponto de apoio: " + item.transbordoCfg.nome);
    Logger.log("Chegada que seria detectada agora: " + (dtChegada ? Utilities.formatDate(dtChegada, GPS_TZ, "dd/MM HH:mm") : "NENHUMA"));
  }
}


/* ============================================================
   14. GATILHOS
   ============================================================ */

function instalarGatilhos() {
  var ss = getPlanilha_();
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === "atualizarMonitoramentoGPS" || fn === "aoEditarProgramacao") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("atualizarMonitoramentoGPS").timeBased().everyMinutes(GPS_INTERVALO_MIN).create();
  ScriptApp.newTrigger("aoEditarProgramacao").forSpreadsheet(ss).onEdit().create();
  Logger.log("Gatilhos instalados: atualização a cada " + GPS_INTERVALO_MIN + " min + trava de edição manual.");
}

function removerGatilhos() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === "atualizarMonitoramentoGPS" || fn === "aoEditarProgramacao") ScriptApp.deleteTrigger(t);
  });
  Logger.log("Gatilhos removidos.");
}
