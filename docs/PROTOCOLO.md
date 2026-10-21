# Protocolo nativo da WING (o que o Asa usa)

Fontes: "WING Remote Protocols" V3.0.5 (Patrick-Gilles Maillot, com dados da Behringer)
e o libwing (Rust, Apache-2.0, testado numa WING Compact fw 3.0.5). PDF:
https://cdn.mediavalet.com/aunsw/musictribe/M7u1XZvRGkWxJAVwCKE5BA/7qQ-l43rn0SEnqyb5ZcETg/Original/WING%20Remote%20Protocols_V3.0.6-30.pdf
O esquema saiu de `vendor/propmap.jsonl` do libwing (`npm run esquema`).

## Portas

| Porta | Uso |
|---|---|
| UDP 2222 | descoberta: mande `WING?`, resposta `WING,ip,nome,modelo,serie,firmware` |
| TCP 2222 | dados (até 16 clientes); cai após 10 s sem receber nada |
| UDP (nossa) | a mesa manda os medidores para a porta que informamos |
| UDP 2223 | OSC (não usamos: só 1 assinatura por vez e sem medidores) |

## Fluxo TCP

Byte `0xDF` é escape: `DF D0..DD` troca o canal, `DF DE` é um 0xDF literal.
Canal 1 (`DF D1`) = dados da mesa. Canal 3 (`DF D3`) = pedidos de medidor.

Tokens do canal de dados (big-endian):

| Token | Dado | Significado |
|---|---|---|
| 00..3F | | inteiro 0..63 |
| 80..BF | n bytes | texto de 1..64 bytes |
| D0 | | texto vazio |
| D1 | 1 byte + texto | texto até 256 |
| D3 | 2 bytes | int16 |
| D4 | 4 bytes | int32 |
| D5 | 4 bytes | float32 (valor real, ex. dB) |
| D6 | 4 bytes | float32 cru 0..1 |
| D7 | 4 bytes | seleciona o nó por id (hash) |
| D8 / D9 | — / int8 | clique (alterna) / passo ±n |
| DC | | pede dados do nó atual |
| DD | | pede definição |
| DE | | fim da resposta |

- Ler: `D7 <id> DC` → a mesa responde `D7 <id> <valor>` e `DE`.
- Escrever: `D7 <id> <valor>` (float com D5, inteiro pequeno direto, texto 80+n).
- A mesa **empurra** toda mudança (da superfície ou de outro app) para todos os clientes
  conectados; não devolve ao próprio autor.
- Manter viva: o Asa pede `/$syscfg/$firmware` a cada 3 s; sem resposta em 10 s, reconecta.

## Medidores (canal 3)

```
DF D3  D3 <porta udp 16b>  D4 <id do pedido 32b>  DC  A0 00  A0 01 ... DE  DF D1
```
Renovar a cada ~2,5 s com `D3 <porta> D4 <id>` (vale 5 s). Pacote UDP:
`<id 4 bytes><int16 BE ...>` em 1/256 dB, na ordem pedida.

| Código | Bloco | Palavras por item |
|---|---|---|
| A0 | canal 1..40 | 8: entrada E/D, saída E/D, chave gate, ganho gate, chave comp, ganho comp |
| A1 | aux 1..8 | 8 |
| A2 | bus 1..16 | 8 |
| A3 | main 1..4 | 8 |
| A4 | matriz 1..8 | 8 |
| A5 | DCA 1..16 | 4: pré-fader E/D, pós-fader E/D |
| A6 | fx 1..16 | 10 |
| A7 / A8 | fonte / saída (grupo) | 1 por pedido (8 níveis) — confirmar na mesa |
| A9 | monitor | 6 |
| AB..AF | versões V2 (+ LED gate, estado comp, automix) | 11 |

Índice do item = número − 1. O Asa pede A0..A5 (672 palavras).

## Caminhos que o app usa

| O quê | Caminho |
|---|---|
| Nome / cor (1..12) / ícone | `/ch/N/name`, `/ch/N/col`, `/ch/N/icon` |
| Fader / mute / pan / solo | `/ch/N/fdr`, `/ch/N/mute`, `/ch/N/pan`, `/ch/N/$solo` |
| Fonte do canal | `/ch/N/in/conn/grp` (OFF, LCL, AUX, A, B, C, SC, USB, CRD, MOD, PLAY, AES, USR, OSC, BUS, MAIN, MTX, SEND, MON) + `/ch/N/in/conn/in` |
| Ganho / 48V / fase da fonte | `/io/in/<grp>/<n>/g`, `/vph`, `/pol`, nome em `/name` |
| Trim, delay, inverter | `/ch/N/in/set/trim`, `/dly`, `/dlyon`, `/inv` |
| Filtros | `/ch/N/flt/lc`, `lcf`, `hc`, `hcf` |
| EQ | `/ch/N/eq/on`, `/mdl` (STD, SOUL, E88...), STD: `lg lf lq leq`, `1g..4g`, `1f..4f`, `1q..4q`, `hg hf hq heq` |
| Gate / comp | `/ch/N/gate/on`, `/mdl`, `/<MODELO>/...`; `/ch/N/dyn/on`, `/mdl`, `/gain`, `/mix`, `/<MODELO>/...` |
| Envios a bus | `/ch/N/send/B/on`, `/lvl` (fader), `/mode` (PRE, POST, GRP), `/pan` |
| Mains | `/ch/N/main/M/on`, `/lvl` |
| Aux / bus / main / matriz / DCA | `/aux/N/...`, `/bus/N/...`, `/main/N/...`, `/mtx/N/...`, `/dca/N/...` (mesma ideia) |
| Saídas | `/io/out/<grupo>/<n>/grp` + `/in` (grupos: LCL 8, A 48, B 48, USB 48, CRD 64, MOD 64...) |
| Mesa | `/$syscfg/consolename`, `/$firmware`, `/$cnsmdl` |

Na WING Compact: 40 canais, 8 aux, 16 bus, 4 main, 8 matrizes, 16 DCA, 24 entradas
locais, 8 saídas locais. Os SD16 aparecem como AES50 A e B.

## Confirmar na mesa real

- Se `D7 <id> DC` em um **nó** devolve todas as folhas (o emulador faz isso; o Asa pede
  folha por folha para não depender disso).
- Se a mesa responde `DE` a cada pedido de folha.
- Significado exato das palavras de ganho do gate/comp (o PDF diz 256 = 20 dB de redução
  na maioria dos modelos).
- Medidores de fonte/saída (A7/A8): quantas palavras vêm por pedido.
