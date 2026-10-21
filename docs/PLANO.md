# Plano do Asa Edit

Meta do Pedro: **quase tudo o que o WING Edit faz, em dark mode, bem mais simples de
usar**, e funcionando bem no Mac. Referência visual do que existe hoje:
`docs/referencia-wing-edit.png` (print do WING Edit com o show real da igreja).

Cada fase termina com algo usável e testado no emulador (`emulador/`), com capturas
de tela via Playwright. O que depende da mesa real fica em "Confirmar na mesa".

## O setup real (do print), para dados de teste

- Canais: 1 Bateria L, 2 Bateria R, 3 Baixo, 4 Violão, 5 Guitarra L, 6 Guitarra R,
  7 Piano L, 8 Piano R, 9–14 Mic 1–6, 15 Mic Avisos, 16 Mic Pastor
- Mains: PA, LIVE, M3, M4. Matrizes: MX1–MX8
- Buses: IEM Bateria, IEM Guitarra, IEM Baixo, IEM Violão, IEM Teclado, Mon Mic 1–6,
  Mon Pastor, FX Rev Voz, FX Rev Inst, FX Delay Voz, FX Rev Live
- Tags em uso (ex.: "Instrumento"), DCAs 1–16 e mute groups 1–8 atribuídos por canal

Crie `scripts/carregar-show-teste.js` que escreve esses nomes/cores no emulador, para
as capturas de tela parecerem o uso real.

## Inventário do WING Edit → onde entra no Asa

| WING Edit | No Asa | Fase |
|---|---|---|
| Faixa de canais com camadas (CH 1–16, 17–32, 33–A8, 1–40, AUX, BUSES, MAIN/MTX, DCA, ALL) | Mixer: camadas em abas + rolagem livre; tiras esticam na largura | 1 |
| Solo, mute, fader, valor em dB, nome/cor, Clear Solo | Tira + botão "Limpar solos" na barra de cima | 1 |
| Grades de DCA (1–16) e mute group (1–8) em **cada** tira | Só um indicador pequeno na tira; atribuição no painel do canal | 1 |
| User layers (USER 1/2), Edit/Move | Camadas personalizadas: arrastar canais para montar a sua | 3 |
| HOME do canal: Input (ganho, trim, 48V, mute da fonte), Filter (lo cut, hi cut, tilt), EQ com gráfico, Main (1–4), Solo bus, Name/Icon/Color, Tags | Painel do canal, aba "Canal" (resumo numa tela só, como o HOME) | 1 |
| Cadeia de processamento (gate, EQ, comp, inserts, ordem) | Abas Gate / EQ / Comp / Inserts no painel; ordem por arrastar (`/ch/N/proc`) | 1 e 4 |
| Bus sends (PA, LIVE, M3, M4, MX1–8, IEM...) e envios por canal | Aba "Envios" do canal + tela Retornos | 1 e 2 |
| Mute groups 1–8 (painel direito) | Barra lateral direita: mute groups e DCAs sempre à vista | 1 |
| Main fader + CC/Monitor, phones/speaker | Tira do main fixa à direita; monitor/fones em "Monitor" | 1 e 5 |
| MIXVIEW (visão geral do canal) | Painel do canal, aba "Canal" | 1 |
| ROUTING | Tela Roteamento | 3 |
| EFFECTS (16 FX, inserts) | Tela Efeitos | 4 |
| METERS | Tela Medidores (todos os canais, buses, entradas/saídas) | 5 |
| SETUP, MONITOR, LIBRARY (presets/snapshots), LOAD/SAVE, ASSIGN, CC EDIT | Configurações, Monitor, Biblioteca | 5 (ASSIGN/CC EDIT: depois) |

Simplificar = mostrar menos ao mesmo tempo, não cortar função: cada tela tem uma
tarefa, as opções raras ficam a um clique, e nada usa letras minúsculas de 9 px.

## Fase 0: base (pronta)

- [x] Esquema da WING (52 mil parâmetros) gerado do libwing → `app/main/esquema.json.gz`
- [x] `ConexaoWing`: descoberta, conexão TCP, sincronização (~23 mil valores em ~3 s no
      emulador), escrita, mudanças empurradas pela mesa, medidores UDP, pulso e reconexão
- [x] Servidor local (HTTP + WebSocket), papéis "completo" e "retorno", lotes de 25 ms
- [x] Electron: janela, menu com zoom, lembra tamanho e zoom
- [x] Interface mínima: tela de conexão (procura, lista de mesas, IP manual, progresso)
- [x] Testado: emulador → servidor → navegador; mudança num cliente aparece no outro

## Fase 1: mixer e canal (pronta)

Feito como descrito abaixo, mais: camadas da Compact importadas da snap, botão
"Limpar solos" com contagem, aviso de reconexão sem perder a tela. Testado com
Playwright (mute, fader, duplo clique, M/S, renomear, DCA) e 56 quadros/s com 40 tiras.


1. Estrutura: barra lateral esquerda estreita com ícones + texto (Mixer, Retornos,
   Roteamento, Efeitos, Medidores, Monitor, Biblioteca, Configurações); barra de cima
   com o canal selecionado (número, nome, cor), conexão, "Limpar solos", zoom.
2. Componentes base: `Fader` (curva no DESIGN.md, arrastar fino com ⌥, duplo clique
   0 dB, teclado, rolagem), `Medidor` (canvas, lê `medidores` em `aCadaQuadro`, pico
   segura 1 s), `Parametro` (editor genérico a partir da `Def`: float → deslizante com
   valor e unidade; inteiro 0..1 → botão; enum → lista; texto → campo).
3. `Tira` genérica por prefixo (`/ch/5`, `/bus/3`, `/main/1`, `/dca/2`): cor + nome
   (duplo clique renomeia), fonte e ganho (canais), pan, solo, mute, fader + medidor,
   dB, indicador de redução do comp, pontinhos de DCA/mute group. Clique seleciona.
4. Camadas: Canais 1–40 (atalhos 1–16, 17–32, 33–40), Aux, Buses, Mains+Matrizes, DCA.
   Main selecionado fixo à direita. Barra lateral direita recolhível: mute groups 1–8
   e DCAs 1–16 com mute.
5. Painel do canal (embaixo, altura ajustável), abas:
   - **Canal** (equivale ao HOME): entrada (fonte, ganho, 48V, trim, fase, mute da
     fonte), filtros (LC/HC/tilt), mini EQ clicável, mains 1–4, nome/cor/ícone, tags,
     DCAs e mute groups (botões 1–16 e 1–8).
   - **EQ**: liga/desliga, modelo; STD com gráfico arrastável; outros modelos com
     `Parametro`.
   - **Gate** e **Comp**: liga/desliga, modelo, parâmetros do modelo atual, sidechain,
     medidor de redução, mix.
   - **Envios**: 16 buses (nome/cor, ligado, nível, pré/pós), mains, matrizes (para buses).
6. Atalhos: M mute, S solo, ←/→ canal anterior/próximo, ⌘1..8 telas.

Pronto quando: os 40 canais respondem com fluidez no emulador, medidores sem travar
(CPU razoável com 40 tiras), tudo escala de 1280×800 a 2560×1440, e o print de
referência tem equivalente para cada controle do HOME.

## Fase 2: retornos in-ear (pronta)

Feito, mais "Ouvir nos fones" (põe a mix do músico nos fones da mesa). Testado: o
celular (390×844 e 375×667) não consegue mexer fora da própria mix.


1. Tela Retornos: lista dos 16 buses (IEM Bateria, IEM Baixo...), mix selecionada
   como "envios nos faders" de todos os canais, volume geral e mute do bus,
   liga/desliga e pré/pós por envio. Esconder canais vazios (sem nome e sem sinal).
2. Copiar mix de um músico para outro; zerar mix; ligar todos os envios.
3. "Abrir no celular": QR code com `http://<ip-do-mac>:8730/?retorno=N`
   (`qrcode-generator`), escolhendo o IP certo da lista `rede` do `geral`.
4. Tela do celular (papel `retorno`): escolher o próprio bus, deslizantes grandes,
   favoritos em cima (guardados no navegador), medidor do bus. O servidor já limita o
   que o celular pode mudar (`permitidosDoBus`).
5. Configuração "Acesso pela rede": desligado / só retornos / completo (servidor pronto,
   falta a tela).

Pronto quando: Mac + "celular" (390×844) mexem na mesma mix e um vê o outro mudar; o
celular não consegue mexer fora da própria mix.

## Fase 3: roteamento e camadas personalizadas (pronta)

Camadas ficam no servidor (valem para todas as janelas). Saídas internas vêm em
pares E/D (confirmado pela snap do culto: A1/A2 = IEM Bateria, A11 = Mon Mic 1).


1. Entradas: tabela dos 40 canais com fonte (lista agrupada: Local 1–24, SD16 A 1–48,
   SD16 B 1–48, USB, Cartão, Dante/MOD, interno), nome da fonte (editável), ganho,
   48V, fase, medidor.
2. Saídas: blocos por aparelho, cada saída com o que toca nela (cor e nome) e lista
   para trocar. Contagens do esquema (`contar('/io/out/A')`).
3. "Saídas dos retornos": liga em um passo IEM 1→saída X, IEM 2→saída Y...
4. Camadas personalizadas (como USER 1/2): montar arrastando, guardadas no Mac.

## Fase 4: efeitos e inserts (pronta)

Rack com "onde está" (o retorno de FX é o FX como insert num bus), EQ gráfico
em barras, inserir/tirar FX de qualquer tira, ordem da cadeia por arrastar.


1. Rack dos 16 FX (`/fx/N/mdl` + parâmetros do modelo via `Parametro`), com os mais
   usados primeiro: reverbs, delays, GEQ, limiter, de-esser.
2. Retornos de FX (buses FX Rev Voz etc.) ligados ao FX certo, visível numa tela.
3. Inserts nos canais/buses (`preins`, `postins`) e ordem da cadeia (`/ch/N/proc`).

## Fase 5: medidores, monitor, biblioteca, configurações, estabilidade (pronta)

Biblioteca abre e salva **.snap do WING Edit** (`app/main/snap.js`). `npm test` cobre
protocolo e snapshots. O .dmg sai do GitHub Actions (`.github/workflows/mac.yml`),
que abre o app empacotado num Mac contra o emulador antes de publicar a release.


1. Medidores: tela cheia com todos os canais, buses, mains e matrizes.
2. Monitor: fones/alto-falante, solo bus, talkback (`/cfg/mon`, `/cfg/solo`, `/cfg/talk`).
3. Biblioteca: salvar/abrir o estado da mesa num arquivo do Mac (o Asa lê tudo e
   escreve de volta), e presets de canal. Snapshots internos da mesa: confirmar como
   acionar pelo protocolo antes de prometer.
4. Configurações: acesso pela rede, nome da mesa, preferências.
5. Estabilidade: indicador de conexão sempre visível; se cair no culto, controles em
   cinza e "Reconectando…" sem perder a tela. Testes `node --test` do protocolo
   (escape de 0xDF, pedaços cortados, medidores).
6. `npm run mac` com ícone; sem assinatura, abrir com clique direito → Abrir na
   primeira vez. Teste na mesa real com a lista abaixo.

## Depois

Cenas e roteiro do culto, nomes/cores em lote de uma planilha, backup automático,
modo voluntário (tela travada), modo aula para o curso de sonoplastia, ASSIGN/CC EDIT
(botões da superfície).

## Confirmar na mesa

Já confirmado pela snap do culto (`Culto - Wing.snap`, não vai para o repositório,
que é público): DCA e mute group ficam nas tags (`#D1,#M2`); saídas de bus, main e
matriz em pares E/D.

Falta confirmar na WING de verdade:
- Escrever `$solo`, `/cfg/solo/$dim|$mono|$flip` e `/cfg/talk/A/$on` (o `$` costuma
  ser só leitura; o emulador aceita).
- `/$syscfg/consolename` pode ser escrito pela rede?
- Abrir um show inteiro (20 mil valores em lotes de 120 a cada 20 ms) sem a mesa engasgar.
- A .snap salva pelo Asa Edit abre no WING Edit (com a snap de base, deve abrir).
- `$stat` dos inserts ("N/A" quando o FX não serve ali).

- Pedido de dados em nó vs folha; `DE` por pedido.
- Escala das palavras de gate/comp nos medidores.
- Cores exatas da WING 1..12.
- Firewall do macOS na primeira execução (medidores chegam por UDP).
- Como carregar/salvar snapshots da mesa pelo protocolo.
