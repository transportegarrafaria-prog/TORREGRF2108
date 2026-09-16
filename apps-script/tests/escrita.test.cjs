/* ============================================================
   TESTE PONTA A PONTA DA ESCRITA — TorreControleGRF.gs
   node apps-script/tests/escrita.test.cjs

   Roda a atualizarMonitoramentoGPS() de verdade contra uma
   planilha e um Eclipse simulados, e confere o que foi parar em
   cada célula da Programação. É o teste que pega bug de escrita:
   detectou mas não gravou, gravou no lugar errado, deixou célula
   vazia, sobrescreveu edição da operação.
   ============================================================ */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/* ---------- planilha falsa ---------- */

const custo = { lidas: 0, escritas: 0 };
function zerarCusto() { custo.lidas = 0; custo.escritas = 0; }

function criarSheet(nome, matriz) {
  const m = matriz;
  const alvo = (r, c, nr, nc) => ({
    getValues: () => (custo.lidas += nr * nc, m.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc))),
    getDisplayValues: () =>
      (custo.lidas += nr * nc,
      m.slice(r - 1, r - 1 + nr)).map((row) =>
        row.slice(c - 1, c - 1 + nc).map((v) => {
          if (v instanceof Date) {
            const p = (n) => String(n).padStart(2, "0");
            return `${p(v.getDate())}/${p(v.getMonth() + 1)}/${v.getFullYear()} ${p(v.getHours())}:${p(v.getMinutes())}`;
          }
          return String(v == null ? "" : v).replace(/^'/, "");
        }),
      ),
    setValues: (vals) => {
      custo.escritas += nr * nc;
      vals.forEach((row, i) =>
        row.forEach((v, j) => {
          while (m.length <= r - 1 + i) m.push(new Array(m[0].length).fill(""));
          m[r - 1 + i][c - 1 + j] = v;
        }),
      );
      return alvo(r, c, nr, nc);
    },
    setValue: (v) => {
      custo.escritas += 1;
      while (m.length <= r - 1) m.push(new Array(m[0].length).fill(""));
      m[r - 1][c - 1] = v;
      return alvo(r, c, nr, nc);
    },
    clearContent: () => {
      for (let i = 0; i < nr; i++)
        for (let j = 0; j < nc; j++) if (m[r - 1 + i]) m[r - 1 + i][c - 1 + j] = "";
      return alvo(r, c, nr, nc);
    },
    setNumberFormat: () => alvo(r, c, nr, nc),
    setFontWeight: () => alvo(r, c, nr, nc),
  });

  return {
    nome,
    matriz: m,
    getName: () => nome,
    getLastRow: () => m.length,
    getLastColumn: () => m[0].length,
    getMaxColumns: () => m[0].length,
    setFrozenRows: () => {},
    hideColumns: () => {},
    insertColumnsAfter: (depois, quantas) => {
      for (const row of m) for (let i = 0; i < quantas; i++) row.push("");
    },
    getRange: (a, c, nr, nc) => {
      if (typeof a === "string") return alvo(1, 1, 1, 1); // getRange("A:A") só recebe formatação
      return alvo(a, c, nr === undefined ? 1 : nr, nc === undefined ? 1 : nc);
    },
  };
}

/* ---------- eventos simulados do Eclipse ---------- */

const BASE = { lat: -22.08021, lon: -43.21244 };
const ESTRADA = { lat: -22.35, lon: -43.55 };
const p2 = (n) => String(n).padStart(2, "0");

function ponto(d, hh, mm, lugar, extra) {
  return Object.assign(
    {
      Timestamp_date: `2026/${p2(d.getMonth() + 1)}/${p2(d.getDate())}`,
      Timestamp_time: `${p2(hh)}:${p2(mm)}:00`,
      GPSPoint_lat: lugar.lat,
      GPSPoint_lon: lugar.lon,
      Speed: 0,
      StatusCode_desc: "Desligado",
      Geozone: lugar === BASE ? "grf_distribuicao" : "",
      Address: lugar === BASE ? "GRF Distribuicao" : "BR-040",
      Odometer: 1000,
    },
    extra || {},
  );
}

const D25 = new Date(2026, 7, 25);
const D26 = new Date(2026, 7, 26);

// KAA1A11: na base a noite toda, sai às 05:30 e segue viagem
const SAIU = [];
for (let h = 21; h <= 23; h++) SAIU.push(ponto(D25, h, 0, BASE));
for (let h = 0; h <= 5; h++) SAIU.push(ponto(D26, h, 0, BASE));
SAIU.push(ponto(D26, 5, 30, ESTRADA, { Speed: 62, StatusCode_desc: "Em Movimento" }));
SAIU.push(ponto(D26, 6, 0, { lat: -22.5, lon: -43.7 }, { Speed: 68, StatusCode_desc: "Em Movimento" }));

// KBB2B22: na base o tempo todo, não saiu
const FICOU = [];
for (let h = 21; h <= 23; h++) FICOU.push(ponto(D25, h, 0, BASE));
for (let h = 0; h <= 6; h++) FICOU.push(ponto(D26, h, 0, BASE));

const LOGS = { KAA1A11: SAIU, KBB2B22: FICOU };

/* ---------- stubs do runtime ---------- */

const props = new Map([["SPREADSHEET_ID", "fake"], ["ECLIPSE_PASSWORD", "x"]]);
let progSheet, monSheet, histSheet, ss;

global.Logger = { log: () => {} };
global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => (props.has(k) ? props.get(k) : null),
    setProperty: (k, v) => props.set(k, v),
  }),
};
global.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
global.SpreadsheetApp = {
  openById: () => ss,
  getActiveSpreadsheet: () => ss,
  flush: () => {},
};
global.Utilities = {
  formatDate: (d, tz, fmt) =>
    fmt
      .replace("yyyy", d.getFullYear())
      .replace("MM", p2(d.getMonth() + 1))
      .replace("dd", p2(d.getDate()))
      .replace("HH", p2(d.getHours()))
      .replace("mm", p2(d.getMinutes()))
      .replace("ss", p2(d.getSeconds())),
  parseDate: (txt, tz, fmt) => {
    if (fmt !== "yyyy/MM/dd HH:mm:ss") throw new Error("formato");
    const m = txt.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) throw new Error("no match");
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  },
};
global.UrlFetchApp = {
  fetch: (url) => {
    const placa = (url.match(/unitID=([a-z0-9]+)/i) || [])[1] || "";
    const evs = LOGS[placa.toUpperCase()] || [];
    return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({ DeviceList: [{ EventData: evs }] }),
      getAllHeaders: () => ({}),
    };
  },
};
global.ScriptApp = { getProjectTriggers: () => [] };
global.ContentService = { createTextOutput: (t) => ({ setMimeType: () => t }), MimeType: { JSON: "json" } };

vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "TorreControleGRF.gs"), "utf8"));

/* ---------- montagem ---------- */

const CAB = ["Data", "Placa", "Cidade/Rota", "Transportadora", "Saiu?", "Hora Saída",
  "Horário-Limite", "Atraso", "Chegou?", "Hora Chegada", "Status GPS", "Última Posição",
  "ID Viagem", "Data/Hora Saída", "Data/Hora Chegada", "Trava Manual"];
const C = {}; CAB.forEach((n, i) => (C[n] = i));

function montarPlanilha(linhas) {
  progSheet = criarSheet("Programação", [CAB.slice()].concat(linhas));
  monSheet = criarSheet("Monitoramento", [GPS_MONITOR_HEADERS.slice()]);
  histSheet = criarSheet("Histórico", [CAB_HISTORICO.slice()]);
  ss = {
    getName: () => "fake",
    getId: () => "fake",
    getSheetByName: (n) =>
      n === "Programação" ? progSheet : n === "Monitoramento" ? monSheet : n === "Histórico" ? histSheet : null,
    insertSheet: (n) => (n === "Monitoramento" ? monSheet : histSheet),
    setSpreadsheetTimeZone: () => {},
  };
}
const linhaVazia = (placa, destino) =>
  ["26/08/2026", placa, destino, "TRANS SUL", "", "", "", "", "", "", "", "", "", "", "", ""];

const cel = (linha, nome) => {
  const v = progSheet.matriz[linha - 1][C[nome]];
  return v instanceof Date ? v : String(v == null ? "" : v).replace(/^'/, "");
};

/* ---------- testes ---------- */

let falhas = 0;
const ok = (nome, cond, extra) => {
  if (cond) console.log("  ok   " + nome);
  else { falhas++; console.log("  FALHA " + nome + (extra !== undefined ? "  -> " + extra : "")); }
};

console.log("\n1) Programação em branco: o script preenche tudo");
{
  props.set("ULTIMA_DATA_OPERACIONAL", "2026-08-26"); // sem reset no meio do teste
  montarPlanilha([linhaVazia("KAA1A11", "PETROPOLIS"), linhaVazia("KBB2B22", "PETROPOLIS")]);
  atualizarMonitoramentoGPS();

  ok('quem saiu recebe "Sim"', cel(2, "Saiu?") === "Sim", cel(2, "Saiu?"));
  ok("com a hora da saída", cel(2, "Hora Saída") === "05:30", cel(2, "Hora Saída"));
  ok("carimbo gravado", cel(2, "Data/Hora Saída") instanceof Date, cel(2, "Data/Hora Saída"));
  ok("horário-limite preenchido", cel(2, "Horário-Limite") === "06:00", cel(2, "Horário-Limite"));
  ok("atraso calculado", cel(2, "Atraso") === "No prazo", cel(2, "Atraso"));
  ok("status do GPS preenchido", cel(2, "Status GPS") === "Em Movimento", cel(2, "Status GPS"));

  ok('quem ficou recebe "Não"', cel(3, "Saiu?") === "Não", cel(3, "Saiu?"));
  ok("sem hora inventada", cel(3, "Hora Saída") === "", cel(3, "Hora Saída"));
  ok("sem carimbo", !(cel(3, "Data/Hora Saída") instanceof Date), cel(3, "Data/Hora Saída"));
}

console.log("\n2) Segunda rodada: registro travado não muda");
{
  const antes = { saiu: cel(2, "Saiu?"), hora: cel(2, "Hora Saída") };
  atualizarMonitoramentoGPS();
  ok("Saiu? continua Sim", cel(2, "Saiu?") === antes.saiu);
  ok("hora não muda", cel(2, "Hora Saída") === antes.hora, cel(2, "Hora Saída"));
}

console.log("\n3) Coluna Saiu? apagada à mão volta a ser preenchida");
{
  progSheet.matriz[2][C["Saiu?"]] = ""; // linha do KBB2B22
  atualizarMonitoramentoGPS();
  ok('célula vazia volta com "Não"', cel(3, "Saiu?") === "Não", `"${cel(3, "Saiu?")}"`);
}

console.log("\n4) Operação corrige a hora: a planilha aceita e não reverte");
{
  progSheet.matriz[1][C["Hora Saída"]] = "05:05";
  atualizarMonitoramentoGPS();
  ok("hora digitada permanece", cel(2, "Hora Saída") === "05:05", cel(2, "Hora Saída"));
  ok("carimbo acompanha a correção", cel(2, "Data/Hora Saída") instanceof Date
    && cel(2, "Data/Hora Saída").getHours() === 5 && cel(2, "Data/Hora Saída").getMinutes() === 5,
    String(cel(2, "Data/Hora Saída")));
  ok("linha fica travada", cel(2, "Trava Manual") === "S", cel(2, "Trava Manual"));

  atualizarMonitoramentoGPS();
  ok("continua 05:05 na rodada seguinte", cel(2, "Hora Saída") === "05:05", cel(2, "Hora Saída"));
}

console.log("\n5) Operação derruba a saída com Saiu? = Não");
{
  montarPlanilha([linhaVazia("KAA1A11", "PETROPOLIS")]);
  atualizarMonitoramentoGPS();
  ok("detectou primeiro", cel(2, "Saiu?") === "Sim", cel(2, "Saiu?"));

  progSheet.matriz[1][C["Saiu?"]] = "Não";
  atualizarMonitoramentoGPS();
  ok("saída desfeita", cel(2, "Saiu?") === "Não", cel(2, "Saiu?"));
  ok("carimbo limpo", !(cel(2, "Data/Hora Saída") instanceof Date), String(cel(2, "Data/Hora Saída")));
  ok("hora limpa", cel(2, "Hora Saída") === "", `"${cel(2, "Hora Saída")}"`);

  atualizarMonitoramentoGPS();
  ok("não ressuscita na rodada seguinte", cel(2, "Saiu?") === "Não", cel(2, "Saiu?"));
}

console.log("\n6) A API entrega o mesmo que está na planilha");
{
  montarPlanilha([linhaVazia("KAA1A11", "PETROPOLIS"), linhaVazia("KBB2B22", "PETROPOLIS")]);
  atualizarMonitoramentoGPS();
  const col = mapearColunasProgramacao_(progSheet);
  const prog = coletarProgramacao_(progSheet, col, garantirColunaTrava_(progSheet));
  const op = montarOperacaoDaProgramacao_(prog, lerMonitoramento_());
  ok("2 veículos na operação", op.length === 2, op.length);
  ok("o que saiu vem saiu=true", op[0].saiu === true, JSON.stringify(op[0].saiu));
  ok("com a mesma hora da planilha", op[0].horaSaida === cel(2, "Hora Saída"), op[0].horaSaida);
  ok("o que ficou vem saiu=false", op[1].saiu === false);
  ok("estado do que ficou é Na base", op[1].estado === "Na base", op[1].estado);
}

console.log("\n7) Horário-limite errado na planilha é corrigido pela tabela do script");
{
  // Caso real: a célula tinha 04:00 para ANGRA e 03:00 para CAMPOS, enquanto a
  // tabela do script diz 01:00 e 00:00. Como o script reescrevia o que lia, o
  // valor errado se perpetuava e precisava ser corrigido à mão todo dia.
  const comLimiteErrado = (placa, destino, limiteErrado) => {
    const l = linhaVazia(placa, destino);
    l[C["Horário-Limite"]] = limiteErrado;
    return l;
  };
  montarPlanilha([
    comLimiteErrado("KAA1A11", "ANGRA", "04:00"),
    comLimiteErrado("KBB2B22", "CAMPOS", "03:00"),
  ]);

  ok("a tabela do script diz 01:00 para ANGRA", getHorarioLimite_("ANGRA") === "01:00");
  ok("a tabela do script diz 00:00 para CAMPOS", getHorarioLimite_("CAMPOS") === "00:00");

  atualizarMonitoramentoGPS();
  ok("célula de ANGRA corrigida para 01:00", cel(2, "Horário-Limite") === "01:00", cel(2, "Horário-Limite"));
  ok("célula de CAMPOS corrigida para 00:00", cel(3, "Horário-Limite") === "00:00", cel(3, "Horário-Limite"));

  const col = mapearColunasProgramacao_(progSheet);
  const prog = coletarProgramacao_(progSheet, col, garantirColunaTrava_(progSheet));
  const op = montarOperacaoDaProgramacao_(prog, lerMonitoramento_());
  ok("o painel recebe 01:00 para ANGRA", op[0].horarioLimite === "01:00", op[0].horarioLimite);
  ok("o painel recebe 00:00 para CAMPOS", op[1].horarioLimite === "00:00", op[1].horarioLimite);

  // e continua corrigido na rodada seguinte, sem oscilar
  atualizarMonitoramentoGPS();
  ok("não volta ao valor errado", cel(2, "Horário-Limite") === "01:00", cel(2, "Horário-Limite"));

  // mudar a tabela passa a valer imediatamente, que é o pedido central
  const original = HORARIO_LIMITE.find((h) => h.match.includes("angra")).limite;
  HORARIO_LIMITE.find((h) => h.match.includes("angra")).limite = "02:30";
  atualizarMonitoramentoGPS();
  ok("mudou a tabela -> a planilha acompanha", cel(2, "Horário-Limite") === "02:30", cel(2, "Horário-Limite"));
  HORARIO_LIMITE.find((h) => h.match.includes("angra")).limite = original;
}

console.log("\n8) Histórico grande: linhas antigas intocadas e custo limitado à janela");
{
  // 90 dias de histórico, 6 veículos por dia = 540 linhas.
  const DIAS = 90, PLACAS = ["KAA1A11", "KBB2B22", "KCC3C33", "KDD4D44", "KEE5E55", "KFF6F66"];
  const antigas = [];
  const hoje = new Date(2026, 7, 26);
  for (let d = DIAS; d >= 1; d--) {
    const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - d);
    for (const placa of PLACAS) {
      antigas.push([dia, placa, "TRANS SUL", "PETROPOLIS", "Entrega", "06:00",
        "Sim", "05:30", -30, "No prazo", "No prazo", "", "", dia]);
    }
  }
  montarPlanilha([linhaVazia("KAA1A11", "PETROPOLIS"), linhaVazia("KBB2B22", "PETROPOLIS")]);
  histSheet.matriz.push(...antigas.map((r) => r.slice()));
  const totalAntes = histSheet.matriz.length - 1;
  const copia = JSON.stringify(histSheet.matriz.slice(1));
  ok(`histórico com ${totalAntes} linhas antigas`, totalAntes === DIAS * PLACAS.length, totalAntes);

  zerarCusto();
  atualizarMonitoramentoGPS();
  const escritasHist = custo.escritas;

  // as linhas antigas continuam exatamente como estavam
  const depois = histSheet.matriz.slice(1, 1 + totalAntes);
  ok("nenhuma linha antiga foi alterada", JSON.stringify(depois) === copia);
  ok("as 2 linhas do dia foram acrescentadas",
    histSheet.matriz.length - 1 === totalAntes + 2, histSheet.matriz.length - 1);

  // o custo não pode escalar com o tamanho da aba
  const teto = totalAntes * 14;
  ok(`escreveu bem menos que a aba inteira (${escritasHist} << ${teto})`, escritasHist < teto / 5,
    `${escritasHist} vs ${teto}`);

  // segunda rodada: agora as linhas do dia JÁ existem e são atualizadas
  zerarCusto();
  atualizarMonitoramentoGPS();
  ok("2ª rodada também não mexe nas antigas",
    JSON.stringify(histSheet.matriz.slice(1, 1 + totalAntes)) === copia);
  ok(`2ª rodada continua barata (${custo.escritas} células)`, custo.escritas < teto / 5, custo.escritas);
}

console.log("\n9) O ranking enxerga só a janela, e o resultado não mudou");
{
  const h = montarHistoricoIndicador_(30);
  ok("período começa dentro da janela de 30 dias", h.de >= "2026-07-27", h.de);
  ok("período termina hoje", h.ate === "2026-08-26", h.ate);

  // 90 dias na aba, mas só 30 podem entrar
  const maxLinhas = 30 * 6 + 2;
  ok(`conta no máximo a janela (${h.totalProgramados} <= ${maxLinhas})`,
    h.totalProgramados <= maxLinhas, h.totalProgramados);

  // as linhas antigas tinham atraso -30 (no prazo): se vazassem, a média cairia
  const sul = h.transportadoras.find((t) => t.nome === "TRANS SUL");
  ok("transportadora das linhas antigas aparece", !!sul, JSON.stringify(h.transportadoras.map((t) => t.nome)));
  ok("todas as saídas contadas são da janela", sul.saidas <= 30 * 6, sul.saidas);

  // janela menor devolve menos, provando que o corte é por data e não por posição
  const h7 = montarHistoricoIndicador_(7);
  ok("janela de 7 dias devolve menos que a de 30",
    h7.totalProgramados < h.totalProgramados, `${h7.totalProgramados} vs ${h.totalProgramados}`);
}

console.log("\n10) Valores fixos do ranking (trava contra mudança silenciosa)");
{
  // Dataset pequeno e conferível à mão: 2 transportadoras, 3 dias.
  // Se alguma mudança futura mexer na conta, estes números quebram.
  const hoje = new Date(2026, 7, 26);
  const dia = (n) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n);
  const linha = (d, placa, transp, atraso) =>
    [dia(d), placa, transp, "PETROPOLIS", "Entrega", "06:00", "Sim", "05:30",
     atraso, "", atraso > 0 ? "Atrasado" : "No prazo", "", "", dia(d)];

  montarPlanilha([linhaVazia("ZZZ9Z99", "PETROPOLIS")]);
  histSheet.matriz.push(
    linha(1, "AAA1A11", "ALFA",  60),    // ALFA:  60, 120, -40 -> soma 180, média 60
    linha(2, "AAA1A11", "ALFA", 120),
    linha(3, "BBB2B22", "ALFA", -40),    // adiantamento conta como zero
    linha(1, "CCC3C33", "BETA",  30),    // BETA:  30, 0 -> média 15
    linha(2, "CCC3C33", "BETA",   0),
  );

  const h = montarHistoricoIndicador_(30);
  const alfa = h.transportadoras.find((t) => t.nome === "ALFA");
  const beta = h.transportadoras.find((t) => t.nome === "BETA");

  ok("ALFA: 3 saídas medidas", alfa.saidas === 3, alfa.saidas);
  ok("ALFA: média 60 min (adiantamento vira zero)", alfa.atrasoMedioMin === 60, alfa.atrasoMedioMin);
  ok("ALFA: pior 120 min", alfa.atrasoMaxMin === 120, alfa.atrasoMaxMin);
  ok("ALFA: 2 atrasadas, 1 no prazo", alfa.atrasadas === 2 && alfa.noHorario === 1,
    `${alfa.atrasadas}/${alfa.noHorario}`);
  ok("ALFA: 33% no prazo", alfa.pctNoHorario === 33, alfa.pctNoHorario);

  ok("BETA: média 15 min", beta.atrasoMedioMin === 15, beta.atrasoMedioMin);
  ok("BETA: atraso zero conta como no prazo", beta.noHorario === 1 && beta.atrasadas === 1,
    `${beta.noHorario}/${beta.atrasadas}`);
  ok("ALFA na frente de BETA", h.transportadoras[0].nome === "ALFA", h.transportadoras[0].nome);

  const aaa = h.veiculos.find((v) => v.placa === "AAA1A11");
  ok("veículo AAA1A11: média 90 min", aaa.atrasoMedioMin === 90, aaa.atrasoMedioMin);
  ok("veículo AAA1A11: n=2", aaa.saidas === 2, aaa.saidas);
}

console.log(falhas ? `\n${falhas} FALHA(S)\n` : "\nTodos os testes de escrita passaram\n");
process.exit(falhas ? 1 : 0);
