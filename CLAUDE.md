# Asa Edit: controle da Behringer WING para Mac

App de Mac (Electron) para controlar a WING Compact da igreja, porque o WING Edit
no Mac escala mal e tem fluxo confuso, e o Mixing Station não cobre tudo.
Prioridades do Pedro, nesta ordem:
1. Mixer completo e estável (faders, mute, solo, ganho, EQ, gate, comp, envios, medidores)
2. Retornos in-ear dos ~9 músicos (cada um ajusta a própria mix pelo celular)
3. Roteamento visual (fontes dos canais e saídas: local, SD16 em AES50 A/B, USB, Dante)
4. Interface fácil e intuitiva, que escala bem em qualquer tela

Leia `docs/PLANO.md` antes de começar uma fase. Protocolo em `docs/PROTOCOLO.md`,
visual em `docs/DESIGN.md`.

## Como rodar

```bash
npm install
# terminal 1: emulador da WING (a "Mesa de Playback" do Pedro, código dele)
cd emulador && npm install --omit=dev && node server.js   # WING em 127.0.0.1:2222
# terminal 2: servidor do Asa (HTTP + WebSocket na 8730)
npm run servidor
# terminal 3: interface com recarga ao vivo
npm run ui                                        # abre em http://localhost:5173
# app completo no Electron
npm run app
# testes do protocolo e das snapshots
npm test
# carregar um show no emulador (nomes do PLANO, ou uma .snap do WING Edit)
node scripts/carregar-show-teste.js [arquivo.snap --subir]
# emulador com sinal de teste nos medidores (sem o player tocando)
cd emulador && MESA_SINAL_TESTE=1 node server.js
# gerar o .app e o .dmg (só no macOS); o GitHub Actions faz isso a cada push na main
npm run mac
# Android: o GitHub Actions monta o .apk (scripts/preparar-android.sh + gradle -p android)
# teste rápido do protocolo contra o emulador ou uma mesa real
npm run testar:conexao              # ou: node scripts/testar-conexao.js 192.168.1.62
```

## Arquitetura

```
WING ──TCP 2222 (protocolo nativo)──┐
     ──UDP (medidores)──────────────┤
                                    ▼
app/main/wing.js       ConexaoWing: descoberta, sincronização, escrita, medidores, reconexão
app/main/esquema.js    árvore de parâmetros (52 mil caminhos → id/tipo/faixa), de esquema.json.gz
app/main/servidor.js   HTTP (serve ui-dist + /esquema.json) e WebSocket para a interface
app/main/main.js       Electron: sobe o servidor e abre a janela em http://127.0.0.1:8730
app/main/snap.js       ler/escrever .snap do WING Edit (modelos sem o nome no caminho, true/false)
ui/src/store.ts        estado da interface: esquema, valores por id, medidores, envio
ui/src/ui.ts           estado só da tela (tela aberta, tira selecionada, painel, zoom)
ui/src/util.ts         curva do fader, textos (dB, Hz), cores da WING, tags #D/#M, fontes
ui/src/App.tsx         estrutura: barra lateral, barra de cima, atalhos, aviso de reconexão
ui/src/comp/           Fader, Medidor (canvas), Parametro (editor pelo esquema), Tira,
                       EqGrafico (biquads RBJ), Fonte, Icones
ui/src/telas/          Mixer, PainelCanal, Inserts, Retornos, Celular, Roteamento, Camadas,
                       Efeitos, Medidores, Monitor, Biblioteca, Configuracoes, Conexao
scripts/montar-mac.sh  .app + .dmg (assinatura ad-hoc); fazer-icone.py gera os ícones
android/               app Android: WebView + o mesmo servidor rodando no nodejs-mobile
.github/workflows/     instaladores.yml: testes, .dmg e .apk, teste de cada um, release
```

- A interface **sempre** fala com o servidor por WebSocket, nunca com a mesa. Assim
  a janela do Mac e os celulares dos músicos usam o mesmo código.
- Valores trafegam por **id** (inteiro de 32 bits do esquema). A interface resolve
  caminho → id com `def(caminho)` e lê com `useValor(caminho)`.
- Escrita: `definir(caminho, valor)` aplica na hora na tela e manda em lotes de 25 ms.
  A mesa não devolve o valor para quem escreveu; o servidor repassa aos outros clientes.
- Medidores: vetor de 672 números (dB) a ~25 por segundo. Os componentes leem
  `medidores` dentro de `aCadaQuadro()` e mexem direto no DOM/canvas, **sem
  re-renderizar React**. Layout do vetor em `MEDIDOR`/`indiceMedidor()` no store.
- Celulares: o servidor marca quem não é 127.0.0.1 como papel `retorno` (configurável)
  e só deixa escrever envios para o bus escolhido e o próprio bus (`permitidosDoBus`).

## Convenções

- Tudo em português: nomes de variáveis, funções, comentários e textos da interface,
  no estilo do código da Mesa de Playback (comentários sem acento, frases curtas que
  explicam o porquê).
- Interface: React 18 + TypeScript, sem biblioteca de componentes. CSS puro com os
  tokens de `ui/src/estilo.css`. Fonte IBM Plex Sans Condensed embutida (o app precisa
  funcionar sem internet na igreja).
- Processo principal: CommonJS puro, sem build. Só `ws` como dependência.
- Textos da interface: verbos simples, sem jargão desnecessário ("Abrir no celular",
  não "Gerar QR de acesso remoto").

## Cuidados

- Parâmetros de **modelo** (EQ, gate, comp): `/ch/1/gate/GATE/thr` e `/ch/1/gate/WAVE/att`
  têm o **mesmo id**. Leia `/ch/N/gate/mdl` e use os caminhos daquele modelo.
- Fader: tipo 3, faixa -144 (−∞) a +10 dB. Use a curva de `faderParaPosicao` (ver
  docs/DESIGN.md) para a posição na tela.
- Ganho do pré fica na **fonte** (`/io/in/LCL/5/g`), não no canal. O canal aponta a fonte por
  `/ch/N/in/conn/grp` + `/ch/N/in/conn/in`.
- O emulador não reproduz tudo de uma mesa real (medidores de bus/matriz vêm em silêncio,
  curvas são aproximadas). Antes de dizer que algo funciona, teste no emulador; o que
  depende de comportamento real fica marcado como "confirmar na mesa" no PLANO.
- Testes visuais: Playwright com Chromium contra `npm run servidor` + emulador.
- Parâmetros com `$` no caminho são em geral só leitura (ex.: `/cfg/mon/1/$lvl`, o botão
  de volume dos fones); a snap não os traz e o Asa Edit não os escreve ao abrir um show.
- DCA e mute group de uma tira ficam em `/…/tags` como `#D1,#M2` (`lerTags`/`montarTags`).
- Saídas de bus/main/matriz: `/io/out/A/n/grp = BUS`, `in` = 2·bus−1 (E) e 2·bus (D).
- O repositório é público: não commitar a snap da igreja nem nada pessoal.
- Estéreo de canal fica na **fonte**: `/io/in/A/1/mode = ST` nas duas entradas do par e o
  canal aponta a primeira. Estéreo de bus é do bus (`busmono`).
- Android: o servidor roda no Node 18 do nodejs-mobile (nada de API do Node 20+), e no
  Android 11+ `os.networkInterfaces()` falha: use `interfacesIPv4()` (lê `ASA_REDE`).
