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

O único momento em que um registro travado é apagado sozinho é a virada da
data operacional (a Programação passa a ter um dia novo). Para refazer a
detecção do dia atual de propósito, rode `reabrirRegistrosDoDia()`.

## Corrigindo um registro na mão

A operação tem a palavra final. O que você escreve na Programação vence a
detecção do GPS:

| Para… | Faça isto na Programação |
|---|---|
| Corrigir a hora de saída | escreva a hora certa em **Hora Saída** (`06:15`, ou `22:40 (24/08)` se foi na véspera) |
| Derrubar uma saída que não aconteceu | ponha **Saiu? = Não** |
| Corrigir a chegada no ponto de apoio | escreva em **Hora Chegada** |
| Derrubar uma chegada errada | ponha **Chegou? = Não** |

Na rodada seguinte o script reconhece a edição, ajusta a coluna-carimbo
correspondente e marca a linha como travada — a partir daí ele não mexe mais
naquele campo até virar o dia. O painel passa a mostrar o seu valor na
atualização seguinte, e o atraso é recalculado em cima da hora que você
escreveu.

A trava é **por campo**: corrigir a hora de saída de um transbordo não impede
o script de detectar a chegada no ponto de apoio depois.

Para devolver uma linha ao controle do GPS, apague a marca da coluna oculta
`Trava Manual` (ou rode `liberarTravas()` para soltar todas).

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

## O que conta como saída

Saída é a **transição de dentro para fora da cerca da base** dentro da janela
do dia, que não volta em até `MAX_MANOBRA_MIN` (manobra e balança não contam).

Quando não existe essa transição na janela, o veículo pode ter saído antes de
a janela abrir — ou pode estar apenas estacionado longe da base. Os dois casos
se parecem no GPS, então o segundo só é aceito como saída **com prova de
movimento**: velocidade acima do limiar e deslocamento real em relação ao
ponto onde a janela abriu.

Sem essa exigência, dois veículos que passaram a noite num posto a 10 km da
base, com o motor desligado e a mesma coordenada, tiveram o primeiro ponto de
GPS depois das 21h da véspera registrado como "saída às 21:00" — e, como 21h
vem antes do limite das 06h, ainda apareceram como "No prazo".

### Saiu, mas sem hora

O Eclipse devolve no máximo `GPS_MONITOR_LIMIT` pontos por placa. Num veículo
que registra posição de minuto em minuto enquanto roda, esse log pode não
alcançar mais o instante em que ele cruzou a cerca — a transição some do
histórico e a saída deixa de ser detectável.

O script separa os dois casos pelo alcance do log:

| O log começa… | Conclusão |
|---|---|
| antes da janela abrir | é confiável — parado fora da base significa que não saiu |
| depois da janela abrir | está truncado — se já aparece fora da base, saiu antes; existiu, mas a hora não dá para cravar |

No segundo caso a saída entra **sem horário**: o painel mostra "Conferir
horário", sem atraso e sem contar como "no horário". Aí a operação digita a
hora certa em **Hora Saída** e o registro fecha.

Isso importa quando a Programação é limpa no meio do dia: o registro travado
some, e para os veículos que já rodaram há horas o log pode não alcançar mais
a saída. Eles não desaparecem — entram como "saiu, conferir horário".

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
| `diagnosticarDeteccaoDoDia()` | **por que cada veículo foi ou não detectado** — rode quando o painel mostrar menos saídas do que a operação viu |

## Testes

A lógica pura (detecção, travamento, atraso, estados) roda fora do Google:

```sh
node apps-script/tests/logica.test.cjs    # detecção, travamento, atraso, estados
node apps-script/tests/escrita.test.cjs   # o que vai parar em cada célula
```

Os dois carregam o próprio `.gs`, com stubs mínimos do runtime do Apps Script.
O de escrita roda a `atualizarMonitoramentoGPS()` de verdade contra uma
planilha e um Eclipse simulados e confere célula por célula — é ele que pega
bug de "detectou mas não gravou". Se você mexer nas regras, rode os dois antes
de publicar.

## Colunas usadas na Programação

O script casa por nome de cabeçalho, sem depender da ordem:

`Data` · `Placa` · `Cidade/Rota` · `Transportadora` · `Saiu?` · `Hora Saída` ·
`Horário-Limite` · `Atraso` · `Chegou?` · `Hora Chegada` · `Status GPS` ·
`Última Posição` · `Data/Hora Saída` · `Data/Hora Chegada` · `Trava Manual`

`Data/Hora Saída` e `Data/Hora Chegada` já existiam e estavam vazias — são
elas que guardam o carimbo do travamento. `Trava Manual` fica oculta: quem
editar Saiu?/Hora Saída/Chegou?/Hora Chegada na mão marca a linha, e o script
para de detectar ali.
