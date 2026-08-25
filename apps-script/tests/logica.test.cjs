/* ============================================================
   TESTES DA LÓGICA TRAVADA — TorreControleGRF.gs
   Roda fora do Google: `node apps-script/tests/logica.test.cjs`
   Carrega o .gs de verdade e exercita as funções puras
   (detecção de saída/chegada, atraso congelado, estado dos cards).
   ============================================================ */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Stubs mínimos do runtime Apps Script para testar a lógica pura fora do Google.
global.Logger = { log: () => {} };
global.Utilities = {
  formatDate: (d, tz, fmt) => {
    const p = (n, l = 2) => String(n).padStart(l, "0");
    return fmt
      .replace("yyyy", d.getFullYear())
      .replace("MM", p(d.getMonth() + 1))
      .replace("dd", p(d.getDate()))
      .replace("HH", p(d.getHours()))
      .replace("mm", p(d.getMinutes()))
      .replace("ss", p(d.getSeconds()));
  },
  parseDate: (txt, tz, fmt) => {
    if (fmt === "yyyy/MM/dd HH:mm:ss") {
      const m = txt.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
      if (!m) throw new Error("no match");
      return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    }
    throw new Error("no match");
  },
};
global.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) };
global.SpreadsheetApp = { getActiveSpreadsheet: () => null };
global.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
global.ContentService = { createTextOutput: (t) => ({ setMimeType: () => t }), MimeType: { JSON: "json" } };
global.UrlFetchApp = { fetch: () => { throw new Error("sem rede no teste"); } };
global.ScriptApp = { getProjectTriggers: () => [] };

const fonte = fs.readFileSync(path.join(__dirname, "..", "TorreControleGRF.gs"), "utf8");
vm.runInThisContext(fonte, { filename: "TorreControleGRF.gs" });

/* ================= TESTES ================= */
let falhas = 0;
function ok(nome, cond, extra) {
  if (cond) console.log("  ok   " + nome);
  else { falhas++; console.log("  FALHA " + nome + (extra ? "  -> " + extra : "")); }
}

const DIA = new Date(2026, 7, 21, 12, 0, 0); // 21/08/2026 dia operacional

function ev(y, mo, d, h, mi, opts = {}) {
  const p = (n) => String(n).padStart(2, "0");
  return Object.assign({
    Timestamp_date: `${y}/${p(mo)}/${p(d)}`,
    Timestamp_time: `${p(h)}:${p(mi)}:00`,
    Speed: 0,
    GPSPoint_lat: BASE_GRF.lat,
    GPSPoint_lon: BASE_GRF.lon,
    Geozone: "grf_distribuicao",
  }, opts);
}
const FORA = { GPSPoint_lat: -22.3, GPSPoint_lon: -43.5, Geozone: "", Address: "Estrada", Speed: 60 };

console.log("\n1) Detecção de saída dentro da janela do dia operacional");
{
  const eventos = [
    ev(2026, 8, 21, 2, 0),                 // na base
    ev(2026, 8, 21, 3, 10, FORA),          // saiu 03:10
    ev(2026, 8, 21, 5, 0, FORA),
  ];
  const dt = detectarSaidaBase_(eventos, DIA);
  ok("acha a saída de 03:10", dt && dt.getHours() === 3 && dt.getMinutes() === 10, dt);
}

console.log("\n2) Movimento de DIAS DEPOIS não vira saída do dia 21 (bug da V5)");
{
  const eventos = [
    ev(2026, 8, 21, 2, 0),
    ev(2026, 8, 24, 3, 33, FORA),          // saída real só no dia 24
  ];
  const dt = detectarSaidaBase_(eventos, DIA);
  ok("ignora evento fora da janela", dt === null, dt);
}

console.log("\n3) Manobra/balança não conta como saída");
{
  const eventos = [
    ev(2026, 8, 21, 1, 0),
    ev(2026, 8, 21, 1, 10, FORA),          // saiu
    ev(2026, 8, 21, 1, 40),                // voltou em 30 min -> manobra
    ev(2026, 8, 21, 4, 0, FORA),           // saída de verdade
  ];
  const dt = detectarSaidaBase_(eventos, DIA);
  ok("descarta manobra e pega 04:00", dt && dt.getHours() === 4, dt);
}

console.log("\n4) Atraso congela no instante da saída");
{
  const limite = dataHoraLimite_(DIA, "03:00");
  const saida = new Date(2026, 7, 21, 4, 30);
  ok("atraso = 90 min", calcularAtrasoMin_(limite, saida) === 90, calcularAtrasoMin_(limite, saida));
  ok("mesmo cálculo horas depois", calcularAtrasoMin_(limite, saida) === 90);
  ok("texto do atraso", formatarAtraso_(90) === "+1h30", formatarAtraso_(90));
  ok("status travado = atraso_alto", saidaStatusDe_(true, 90) === "atraso_alto");
  ok("saiu adiantado = no_horario", saidaStatusDe_(true, -28) === "no_horario");
  ok("atraso de 20 min = atraso_leve", saidaStatusDe_(true, 20) === "atraso_leve");
  ok("não saiu = pendente", saidaStatusDe_(false, 500) === "pendente");
}

console.log("\n5) Contador de quem não saiu para no fim do dia operacional");
{
  const limite = dataHoraLimite_(DIA, "03:00");
  const fim = fimDoDiaOperacional_(DIA);
  const ref = new Date(Math.min(Date.now(), fim));
  const atraso = Math.max(0, calcularAtrasoMin_(limite, ref));
  ok("atraso máximo <= 21h (não explode em +79h)", atraso <= 21 * 60, atraso + " min");
}

console.log("\n6) Estado operacional = régua dos cards");
{
  ok("não saiu -> Na base",        estadoOperacional_(false, false, 2, 0) === ESTADO_NA_BASE);
  ok("em movimento -> Em rota",    estadoOperacional_(true, false, 2, 0) === ESTADO_EM_ROTA);
  ok("parado 30 min -> Em rota",   estadoOperacional_(true, false, 2, 30) === ESTADO_EM_ROTA);
  ok("parado 45 min -> Parado",    estadoOperacional_(true, false, 2, 45) === ESTADO_PARADO);
  ok("parado 59 min -> Parado",    estadoOperacional_(true, false, 2, 59) === ESTADO_PARADO);
  ok("parado 60 min -> Em atenção", estadoOperacional_(true, false, 2, 60) === ESTADO_ATENCAO);
  ok("parado 3h -> Em atenção",    estadoOperacional_(true, false, 2, 180) === ESTADO_ATENCAO);
  ok("GPS velho -> Sem sinal",     estadoOperacional_(true, false, 90, 10) === ESTADO_SEM_SINAL);
  ok("sem leitura -> Sem sinal",   estadoOperacional_(true, false, null, 0) === ESTADO_SEM_SINAL);
  ok("chegou no PA -> Concluído",  estadoOperacional_(true, true, 2, 500) === ESTADO_CONCLUIDO);
}

console.log("\n7) Chegada no transbordo nunca é anterior à saída");
{
  const penha = TRANSBORDOS[0];
  const dentroPA = { GPSPoint_lat: penha.lat, GPSPoint_lon: penha.lon, Geozone: "", Speed: 0 };
  const eventos = [
    ev(2026, 8, 21, 1, 0, dentroPA),       // ainda no PA da viagem anterior
    ev(2026, 8, 21, 3, 0, FORA),
    ev(2026, 8, 21, 7, 40, dentroPA),      // chegada de verdade
  ];
  const saida = new Date(2026, 7, 21, 3, 0);
  const dt = detectarChegadaTransbordo_(eventos, penha, DIA, saida);
  ok("pega 07:40 e não 01:00", dt && dt.getHours() === 7 && dt.getMinutes() === 40, dt);
}

console.log("\n7.1) TRAVAMENTO — o registro do dia não volta atrás");
{
  const agora = new Date(2026, 7, 21, 20, 0, 0).getTime();
  const base = {
    dataOperacional: DIA,
    horarioLimite: "03:00",
    transbordoCfg: null,
    travaManual: false,
    saiuPlanilha: false,
    horaSaidaPlanilha: "",
    chegouPlanilha: false,
    horaChegadaPlanilha: "",
    saidaTravada: null,
    chegadaTravada: null,
  };
  const eventosSaida = [
    ev(2026, 8, 21, 2, 0),
    ev(2026, 8, 21, 4, 30, FORA),
    ev(2026, 8, 21, 8, 0, FORA),
  ];

  // primeira rodada: detecta e carimba
  const r1 = resolverRegistroDoDia_(Object.assign({}, base), eventosSaida, agora);
  ok("detecta a saída de 04:30", r1.horaSaidaTexto === "04:30", r1.horaSaidaTexto);
  ok("atraso congelado em 90 min", r1.atrasoMin === 90, r1.atrasoMin);
  ok("classificada como atraso_alto", r1.saidaStatus === "atraso_alto");
  ok("1 registro novo", r1.novosRegistros === 1);

  // rodadas seguintes: já carimbado, o GPS não muda mais nada
  const travado = Object.assign({}, base, { saidaTravada: r1.dtSaida, saiuPlanilha: true, horaSaidaPlanilha: "04:30" });
  const eventosDepois = [
    ev(2026, 8, 21, 9, 0),                  // voltou pra base
    ev(2026, 8, 21, 11, 0, FORA),           // saiu de novo
    ev(2026, 8, 21, 15, 0, FORA),
  ];
  const r2 = resolverRegistroDoDia_(travado, eventosDepois, agora);
  ok("horário de saída NÃO muda", r2.horaSaidaTexto === "04:30", r2.horaSaidaTexto);
  ok("atraso NÃO muda", r2.atrasoMin === 90, r2.atrasoMin);
  ok("status NÃO muda", r2.saidaStatus === "atraso_alto", r2.saidaStatus);
  ok("nenhum registro novo", r2.novosRegistros === 0);

  // Eclipse fora do ar: sem eventos, o registro continua de pé
  const r3 = resolverRegistroDoDia_(travado, [], agora);
  ok("GPS sem resposta não apaga a saída", r3.saiu === true && r3.horaSaidaTexto === "04:30");
  ok("GPS sem resposta não apaga o atraso", r3.atrasoMin === 90);

  // linha travada à mão nunca é detectada por cima
  const manual = Object.assign({}, base, { travaManual: true, saiuPlanilha: true, horaSaidaPlanilha: "05:15" });
  const r4 = resolverRegistroDoDia_(manual, eventosSaida, agora);
  ok("trava manual mantém o horário digitado", r4.horaSaidaTexto === "05:15", r4.horaSaidaTexto);
  ok("trava manual não gera registro novo", r4.novosRegistros === 0);

  // quem não saiu: contador corre, mas não vira "saiu"
  const parado = resolverRegistroDoDia_(Object.assign({}, base), [ev(2026, 8, 21, 2, 0), ev(2026, 8, 21, 6, 0)], agora);
  ok("sem transição -> continua na base", parado.saiu === false);
  ok("status = Aguardando saída", parado.status === "Aguardando saída", parado.status);
  ok("atraso em aberto é positivo", parado.atrasoMin > 0);

  // dia seguinte: linha antiga fecha como "Não saiu" e o atraso para de correr
  const depois = new Date(2026, 7, 25, 10, 0, 0).getTime();
  const fechada = resolverRegistroDoDia_(Object.assign({}, base), [], depois);
  ok("dia fechado -> Não saiu", fechada.status === "Não saiu", fechada.status);
  ok("atraso para no fim do dia (<= 21h)", fechada.atrasoMin <= 21 * 60, fechada.atrasoMin);
}

console.log("\n7.2) TRAVAMENTO — chegada no ponto de apoio");
{
  const agora = new Date(2026, 7, 21, 23, 0, 0).getTime();
  const penha = TRANSBORDOS[0];
  const dentroPA = { GPSPoint_lat: penha.lat, GPSPoint_lon: penha.lon, Geozone: "", Speed: 0 };
  const item = {
    dataOperacional: DIA,
    horarioLimite: "03:00",
    transbordoCfg: penha,
    travaManual: false,
    saiuPlanilha: true,
    horaSaidaPlanilha: "02:40",
    chegouPlanilha: false,
    horaChegadaPlanilha: "",
    saidaTravada: new Date(2026, 7, 21, 2, 40),
    chegadaTravada: null,
  };
  const eventos = [ev(2026, 8, 21, 3, 0, FORA), ev(2026, 8, 21, 6, 25, dentroPA)];

  const r1 = resolverRegistroDoDia_(item, eventos, agora);
  ok("detecta chegada no PA às 06:25", r1.horaChegadaTexto === "06:25", r1.horaChegadaTexto);
  ok("saiu no prazo (02:40 < 03:00)", r1.saidaStatus === "no_horario");

  const comChegada = Object.assign({}, item, { chegadaTravada: r1.dtChegada, chegouPlanilha: true, horaChegadaPlanilha: "06:25" });
  const r2 = resolverRegistroDoDia_(comChegada, eventos.concat([ev(2026, 8, 21, 14, 0, dentroPA)]), agora);
  ok("chegada NÃO muda depois de travada", r2.horaChegadaTexto === "06:25", r2.horaChegadaTexto);
  ok("chegou continua verdadeiro", r2.chegou === true);
  ok("veículo que chegou fica Concluído", estadoOperacional_(r2.saiu, r2.chegou, 3, 600) === ESTADO_CONCLUIDO);
}

console.log("\n7.3) SAÍDA FALSA — veículo parado fora da base não saiu");
{
  // Caso real: HJL5J40 e LSB2J94 passaram a noite no Posto Limoeiro, a 10 km
  // da base, motor desligado, mesma coordenada. O primeiro ponto de GPS depois
  // das 21h da véspera virava "saída", e como 21h < 06h do limite, ainda
  // aparecia como "No prazo".
  const LIMOEIRO = { GPSPoint_lat: -22.14359, GPSPoint_lon: -43.2848, Geozone: "posto_limoeiro", Address: "Posto Limoeiro" };
  const parado = [];
  for (let m = 5; m <= 125; m += 6) {
    const t = new Date(2026, 7, 24, 20, m, 32);
    parado.push(ev(2026, 8, 24, t.getHours(), t.getMinutes(), Object.assign({ Speed: 0, StatusCode_desc: "Desligado" }, LIMOEIRO)));
  }
  const DIA25 = new Date(2026, 7, 25, 12, 0, 0);

  ok("nenhum evento está dentro da cerca da base", !parado.some((e) => estaNaBase_(e)));
  const dt = detectarSaidaBase_(parado, DIA25);
  ok("parado fora da base NÃO gera saída", dt === null, dt);

  // mas um veículo que já estava viajando quando a janela abriu ainda é pego
  const viajando = [
    ev(2026, 8, 24, 21, 10, { GPSPoint_lat: -22.3, GPSPoint_lon: -43.5, Geozone: "", Speed: 70, StatusCode_desc: "Em Movimento" }),
    ev(2026, 8, 24, 21, 40, { GPSPoint_lat: -22.4, GPSPoint_lon: -43.6, Geozone: "", Speed: 68, StatusCode_desc: "Em Movimento" }),
    ev(2026, 8, 25, 1, 0, { GPSPoint_lat: -22.6, GPSPoint_lon: -43.8, Geozone: "", Speed: 65, StatusCode_desc: "Em Movimento" }),
  ];
  const dtViagem = detectarSaidaBase_(viajando, DIA25);
  ok("veículo em movimento fora da base continua sendo pego", dtViagem !== null, dtViagem);

  // e a transição normal a partir da base segue funcionando
  const normal = [
    ev(2026, 8, 25, 2, 0),
    ev(2026, 8, 25, 5, 30, Object.assign({}, FORA)),
    ev(2026, 8, 25, 6, 30, Object.assign({}, FORA)),
  ];
  const dtNormal = detectarSaidaBase_(normal, DIA25);
  ok("transição base -> fora continua detectando", dtNormal && dtNormal.getHours() === 5 && dtNormal.getMinutes() === 30, dtNormal);
}

console.log("\n7.4) EDIÇÃO MANUAL — a planilha aceita o que a operação escreve");
{
  // Planilha de mentira com as mesmas colunas da Programação real.
  const CAB = ["Data", "Placa", "Cidade/Rota", "Transportadora", "Saiu?", "Hora Saída",
    "Horário-Limite", "Atraso", "Chegou?", "Hora Chegada", "Status GPS", "Última Posição",
    "ID Viagem", "Data/Hora Saída", "Data/Hora Chegada", "Trava Manual"];
  const carimbo = new Date(2026, 7, 24, 21, 0, 32);

  function linha(placa, saiu, horaSaida, dataHoraSaida) {
    return ["25/08/2026", placa, "PETROPOLIS", "115592 TRANS SUL", saiu, horaSaida,
      "06:00", "", "", "", "", "", "", dataHoraSaida, "", ""];
  }
  const linhas = [
    linha("HJL5J40", "Sim", "21:00 (24/08)", carimbo),   // como o script deixou
    linha("LSB2J94", "Sim", "06:15", carimbo),           // operação corrigiu a HORA
    linha("KYG9099", "Não", "", carimbo),                // operação DESFEZ a saída
  ];

  const mat = [CAB].concat(linhas);
  const mostrar = (v) => (v instanceof Date ? "25/08/2026 21:00" : String(v == null ? "" : v));
  const sheet = {
    getLastRow: () => mat.length,
    getLastColumn: () => CAB.length,
    getRange: (r, c, nr, nc) => ({
      getValues: () => mat.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
      getDisplayValues: () => mat.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc).map(mostrar)),
    }),
  };

  const col = mapearColunasProgramacao_(sheet);
  ok("achou a coluna Data/Hora Saída", col.dataHoraSaida === 14, col.dataHoraSaida);
  const prog = coletarProgramacao_(sheet, col, 16);
  ok("leu as 3 linhas de 25/08", prog.itens.length === 3, prog.itens.length);

  const [intacta, corrigida, desfeita] = prog.itens;
  const agora = new Date(2026, 7, 25, 12, 0, 0).getTime();

  // eventos que FARIAM o script detectar uma saída, para provar que ele não sobrescreve
  const tentaria = [ev(2026, 8, 25, 3, 0), ev(2026, 8, 25, 4, 0, FORA), ev(2026, 8, 25, 8, 0, FORA)];

  ok("linha intacta não é vista como editada", intacta.edicaoManual === false);
  const r1 = resolverRegistroDoDia_(intacta, tentaria, agora);
  ok("linha intacta mantém o carimbo do script", r1.horaSaidaTexto === "21:00 (24/08)", r1.horaSaidaTexto);

  ok("hora corrigida é vista como edição manual", corrigida.edicaoManual === true);
  const r2 = resolverRegistroDoDia_(corrigida, tentaria, agora);
  ok("vale a hora digitada (06:15), não o carimbo", r2.horaSaidaTexto === "06:15", r2.horaSaidaTexto);
  ok("detecção NÃO sobrescreve a edição", r2.novosRegistros === 0);
  ok("atraso recalculado sobre a hora digitada", r2.atrasoMin === 15, r2.atrasoMin);
  ok("classificada como atraso leve", r2.saidaStatus === "atraso_leve", r2.saidaStatus);

  ok('"Saiu? = Não" é visto como edição manual', desfeita.edicaoManual === true);
  const r3 = resolverRegistroDoDia_(desfeita, tentaria, agora);
  ok("saída desfeita: volta a não ter saído", r3.saiu === false && r3.dtSaida === null);
  ok("detecção NÃO ressuscita a saída desfeita", r3.novosRegistros === 0);
  ok("carimbo será limpo na escrita", desfeita.saidaCarimboColuna !== null && r3.dtSaida === null);
}

console.log("\n7.5) A trava é por campo, não pela linha inteira");
{
  // Corrigir a hora de SAÍDA à mão não pode cegar a detecção da CHEGADA
  // no ponto de apoio, que ainda está por acontecer.
  const penha = TRANSBORDOS[0];
  const dentroPA = { GPSPoint_lat: penha.lat, GPSPoint_lon: penha.lon, Geozone: "", Speed: 0 };
  const item = {
    dataOperacional: DIA,
    horarioLimite: "03:00",
    transbordoCfg: penha,
    travaManual: false,
    saidaEditada: true,   // operação corrigiu a hora de saída
    chegadaEditada: false,
    edicaoManual: true,
    saiuPlanilha: true,
    horaSaidaPlanilha: "02:45",
    chegouPlanilha: false,
    horaChegadaPlanilha: "",
    saidaTravada: new Date(2026, 7, 21, 2, 45),
    chegadaTravada: null,
  };
  const eventos = [ev(2026, 8, 21, 3, 0, FORA), ev(2026, 8, 21, 7, 10, dentroPA)];
  const r = resolverRegistroDoDia_(item, eventos, new Date(2026, 7, 21, 23, 0, 0).getTime());
  ok("hora de saída editada é preservada", r.horaSaidaTexto === "02:45", r.horaSaidaTexto);
  ok("chegada no PA continua sendo detectada", r.horaChegadaTexto === "07:10", r.horaChegadaTexto);
  ok("saiu no prazo pela hora digitada", r.saidaStatus === "no_horario");
}

console.log("\n8) Horário-limite por rota");
{
  ok("LAGOS -> 00:00", getHorarioLimite_("LAGOS") === "00:00");
  ok("RIO DE JANEIRO (RUA DO ARROZ) -> 03:00", getHorarioLimite_("RIO DE JANEIRO (RUA DO ARROZ)") === "03:00");
  ok("CAXIAS -> 03:00", getHorarioLimite_("RIO DE JANEIRO (RUA DO ALHO/CAXIAS)") === "03:00");
  ok("BARRA MANSA -> 04:00", getHorarioLimite_("BARRA MANSA") === "04:00");
  ok("VASSOURAS -> padrão 05:00", getHorarioLimite_("VASSOURAS") === "05:00");
  ok("PETROPOLIS -> 06:00", getHorarioLimite_("PETROPOLIS") === "06:00");
  ok("PARAIBA DO SUL -> 07:00", getHorarioLimite_("PARAIBA DO SUL") === "07:00");
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTodos os testes passaram\n");
process.exit(falhas ? 1 : 0);
