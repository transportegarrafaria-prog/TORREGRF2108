# Apps Script da Torre de Controle (V6.0)

`TorreControleGRF.gs` é o script que roda **dentro da planilha** e alimenta o
painel. O arquivo aqui é a fonte oficial: o que está publicado no Google deve
ser cópia dele.

## O que a V6.0 resolve

O painel oscilava porque o script recalculava tudo a cada rodada. Uma linha da
Programação de 21/08 chegou a mostrar saída "03:33 (24/08)", e um veículo já
marcado como saído voltava para "Não" quando o Eclipse não respondia naquela
consulta. Agora o registro do dia é **travado**:

| Indicador | Regra |
|---|---|
| Saída | detectada uma vez, carimbada em `Data/Hora Saída` e nunca mais recalculada |
| Chegada no ponto de apoio | idem, em `Data/Hora Chegada` |
| Atraso | calculado contra o horário-limite da rota no instante da saída — congela junto |
| Saiu no horário | derivado do atraso congelado, então também não muda |

O único momento em que um registro travado é apagado é a virada da data
operacional (a Programação passa a ter um dia novo). Para refazer a detecção
do dia atual de propósito, rode `reabrirRegistrosDoDia()`.

## Estados operacionais (a régua dos cards)

`estadoOperacional_()` classifica cada veículo em um estado só, e é dele que
saem os cards, o gráfico de Status da Frota e o Cumprimento das Saídas:

| Estado | Quando |
|---|---|
| Na base | ainda não saiu |
| Em rota | em movimento, ou parada curta (< 45 min) |
| Parado | parado há 45 min ou mais |
| Em atenção | parada prolongada, acima de 1h |
| Sem sinal | sem leitura de GPS há mais de 15 min |
| Concluído | transbordo que já chegou no ponto de apoio |

Transbordo que chegou no PA sai de "parado"/"em atenção" — ele terminou a
viagem, não está com problema. As réguas ficam em `GPS_STOP_CRIT_MIN` (45) e
`GPS_ATENCAO_MIN` (60) e vão no payload para o painel usar as mesmas.

## Como publicar

1. Abra a planilha → Extensões → Apps Script.
2. Substitua o conteúdo do arquivo pelo de `TorreControleGRF.gs`.
3. Confirme as senhas em Configurações do projeto → Propriedades do script
   (`ECLIPSE_PASSWORD`, `ECLIPSE_PWD_COTRIM`, `ECLIPSE_PWD_FRANCISCO`).
   **Senha nunca vai no arquivo.**
4. Rode `configurarProjeto()` uma vez.
5. Rode `instalarGatilhos()` (atualização a cada 10 min + trava de edição manual).
6. Implantar → Nova implantação → App da Web → acesso "qualquer pessoa".
   A URL gerada é a que fica em `src/services/grfApi.ts` (`GRF_API_URL`).

Se mantiver a implantação existente, use "Gerenciar implantações → editar →
nova versão" para a URL não mudar.

## Conferindo depois de publicar

| Função | Para quê |
|---|---|
| `verificarConfiguracao()` | contas ativas, URLs e as réguas em vigor |
| `testarProgramacao()` | o que o script está lendo da Programação, com os carimbos |
| `testarOperacao()` | o JSON de `operacao` exatamente como o painel recebe |
| `testarHistorico()` | o ranking de atraso, do pior para o melhor |
| `diagnosticarPlaca()` | passo a passo de uma placa (edite a constante `PLACA`) |

## Testes

A lógica pura (detecção, travamento, atraso, estados) roda fora do Google:

```sh
node apps-script/tests/logica.test.cjs
```

O teste carrega o próprio `.gs`, com stubs mínimos do runtime do Apps Script.
Se você mexer nas regras, rode isso antes de publicar.

## Colunas usadas na Programação

O script casa por nome de cabeçalho, sem depender da ordem:

`Data` · `Placa` · `Cidade/Rota` · `Transportadora` · `Saiu?` · `Hora Saída` ·
`Horário-Limite` · `Atraso` · `Chegou?` · `Hora Chegada` · `Status GPS` ·
`Última Posição` · `Data/Hora Saída` · `Data/Hora Chegada` · `Trava Manual`

`Data/Hora Saída` e `Data/Hora Chegada` já existiam e estavam vazias — são
elas que guardam o carimbo do travamento. `Trava Manual` fica oculta: quem
editar Saiu?/Hora Saída/Chegou?/Hora Chegada na mão marca a linha, e o script
para de detectar ali.
