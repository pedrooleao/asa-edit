# Design do Asa

Quem usa: o operador de som da igreja, numa salinha escura, durante o culto, num Mac
(às vezes num monitor grande). E os músicos, no celular, com o ponto no ouvido.
Trabalho principal: ver o estado da mesa num relance e mexer sem erro.

## Princípios

1. **A mesa física é a referência.** Tiras com a cor da WING no topo (scribble strip),
   mute vermelho, solo âmbar, medidor verde ao lado do fader. Quem sabe usar a mesa
   sabe usar o Asa.
2. **Um lugar ousado: as tiras de cor e os medidores.** O resto é quieto: grafite,
   sem sombras, sem gradientes decorativos.
3. **Escala é função, não detalhe.** Tudo em `rem`, zoom com ⌘+ e ⌘−, lembrado entre
   sessões. As tiras esticam para ocupar a largura: 12 tiras numa tela de 13", 24 num
   monitor grande. Alvos de toque com no mínimo 32 px.
4. **Nada escondido no meio do culto.** Mute e fader sempre visíveis; detalhes do
   canal abrem num painel embaixo, sem cobrir os faders.
5. **Palavras simples.** "Retornos", "Roteamento", "Abrir no celular". Números com
   unidade (−12,5 dB, 120 Hz). Sem caixa-alta em rótulos.

## Tokens

| Nome | Hex | Uso |
|---|---|---|
| fundo | #17191d | fundo do app |
| painel | #202329 | tiras, painéis |
| elevado | #2a2e35 | botões, campos |
| linha | #353a43 | divisões |
| texto | #e9e6df | texto principal |
| apagado | #8e939b | texto secundário |
| mute | #e5484d | mute ligado |
| solo | #f2b33d | solo ligado |
| selecao | #6cc6e0 | canal selecionado, foco |
| sinal / quente / clip | #58cf7a / #f0d24a / #ff5a4f | medidor: até −12, até −3, acima |

Cores da WING (`/ch/N/col` = 1..12), confirmar contra a tela da mesa:
1 #7c8ea3 cinza-azul, 2 #3f7fd9 azul, 3 #3d4fb8 azul escuro, 4 #2bb3b3 turquesa,
5 #3fae4f verde, 6 #8a9a3b oliva, 7 #e3c832 amarelo, 8 #e58a2e laranja,
9 #d9443b vermelho, 10 #e5776b coral, 11 #d65aa0 rosa, 12 #9466c9 lilás.

Tipografia: IBM Plex Sans Condensed (400, 500, 600), embutida via @fontsource,
números tabulares em tudo. Escala: 12 / 13 / 15 / 18 / 24 / 28 px.

## O que muda em relação ao WING Edit

Referência: `docs/referencia-wing-edit.png`. O Pedro quer as mesmas funções, mais simples.
- Texto legível: nada abaixo de 12 px; o WING Edit usa rótulos de 8–9 px.
- Tiras limpas: tirar as grades de DCA (1–16) e mute group (1–8) de cada tira; virar
  pontinhos discretos, com a edição no painel do canal.
- Uma tarefa por tela: Mixer, Retornos, Roteamento, Efeitos... em vez de tudo no HOME.
- Navegação com ícone + texto na barra esquerda (o WING Edit mistura navegação,
  camadas e botões de superfície na mesma coluna).
- Sem caixa-alta: "Lo cut", "Ganho", "Envios".
- O painel do canal no Asa reúne o HOME numa aba "Canal" com hierarquia clara:
  entrada → filtros → EQ → dinâmica → saídas.

## Telas

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ● WING Compact (Igreja)   Mixer   Retornos   Roteamento        − 100% +  │
├──────────────────────────────────────────────────────────────────────────┤
│ Canais 1–40 │ Aux │ Buses │ Matrizes │ DCA          [1–8][9–16]...       │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────────────────┬────────┤
│▆Voz 1│▆Voz 2│▆Viol │▆Baixo│▆Bumbo│ ...  rolagem horizontal     │ MAIN   │
│ +32dB│ +28dB│ USB 3│ A 5  │      │                              │        │
│ pan ─┼─     │      │      │      │                              │        │
│ [M][S]      │      │      │      │                              │ [M]    │
│ ║▮ fader+medidor                                              │ ║▮     │
│ −4,5 │ 0,0  │      │      │      │                              │ −2,0   │
│  1   │  2   │  3   │  4   │  5   │                              │        │
├──────┴──────┴──────┴──────┴──────┴──────────────────────────────┴────────┤
│ Voz 1 · Entrada | EQ | Gate | Comp | Envios                     [fechar] │
│  (painel do canal selecionado; altura ajustável)                          │
└──────────────────────────────────────────────────────────────────────────┘
```

Retornos (no Mac):
```
┌────────────────┬─────────────────────────────────────────────────────────┐
│ Bus 1 Baterista│  Mix do Baterista            [Abrir no celular ▣ QR]    │
│ Bus 2 Baixista │  ║ ║ ║ ║ ║ ║ ║ ║ ║ ║ ...  um fader por canal = envio    │
│ Bus 3 Teclado  │  Voz1 Voz2 Viol Baixo ...       │ volume geral do bus   │
│ ...            │  [ligado/desligado] [pré/pós]   │ [mute]                │
└────────────────┴─────────────────────────────────────────────────────────┘
```

Celular do músico (`http://<ip-do-mac>:8730/?retorno=3`): lista vertical, um controle
deslizante horizontal grande por canal (nome + cor), volume geral no topo, botão
"eu" para fixar os canais mais usados em cima. Só mexe na própria mix.

Roteamento: duas abas. "Entradas" = tabela dos 40 canais: fonte (grupo + número),
nome da fonte, ganho, 48V, fase. "Saídas" = um grupo por aparelho (Local, SD16 A,
SD16 B, USB, Cartão, Dante): cada saída mostra o que toca nela, com a cor e o nome
do bus/canal. Mudar = escolher numa lista agrupada.

## Interação dos controles

- Fader: arrastar vertical; ⌥ arrasta fino; duplo clique = 0 dB; rolagem do mouse =
  ±0,5 dB; setas do teclado com o fader focado.
- Posição do fader (dB → 0..1), mesma curva da X32 com 0 dB em 3/4:
  `db<=-90:0 | <-60:(db+90)/480 | <-30:(db+70)/160 | <-10:(db+50)/80 | senão (db+30)/40`.
- Botões giratórios não: use deslizantes horizontais (mais fáceis no trackpad).
- EQ: gráfico com pontos arrastáveis (x = frequência log 20 Hz–20 kHz, y = ganho
  ±15 dB, rolagem = Q), curva calculada com biquads (RBJ) somando as bandas e filtros.
