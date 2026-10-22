'use strict';

// Servidor local do Asa: entrega a interface (HTTP) e conversa com ela por
// WebSocket. A janela do app no Mac usa este mesmo servidor, e os celulares
// dos musicos tambem (modo "meu retorno"), se o acesso pela rede estiver ligado.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { WebSocketServer } = require('ws');

const { Esquema } = require('./esquema');
const { ConexaoWing, procurar, interfacesIPv4 } = require('./wing');
const { lerSnap, escreverSnap } = require('./snap');

const PASTA_UI = path.join(__dirname, '..', 'ui-dist');

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

function ipsDaRede() {
  return interfacesIPv4().map((ni) => ({ nome: ni.nome, ip: ni.ip }));
}

function eLocal(endereco) {
  return /^(127\.|::1$|::ffff:127\.)/.test(endereco || '');
}

// Senha do tecnico e aparelhos autorizados. A senha fica so como hash; cada
// aparelho recebe uma chave longa e o servidor guarda so o hash dela.
const hashSenha = (senha, sal) => crypto.scryptSync(String(senha), sal, 32).toString('hex');
const hashChave = (chave) => crypto.createHash('sha256').update(String(chave)).digest('hex');

/**
 * @param {object} o
 * @param {string} o.pastaConfig  onde guardar a configuracao
 * @param {number} [o.porta]
 */
function iniciarServidor(o) {
  const eventos = new EventEmitter();
  const esquema = new Esquema();
  const wing = new ConexaoWing(esquema);
  const arqConfig = path.join(o.pastaConfig, 'asa-config.json');

  let config = { ultimaMesa: null, acessoRede: 'retorno', zoom: 1, camadas: [], presets: [], senha: null, aparelhos: [] };
  try { config = { ...config, ...JSON.parse(fs.readFileSync(arqConfig, 'utf8')) }; } catch { /* primeira vez */ }
  const salvarConfig = () => {
    try { fs.mkdirSync(o.pastaConfig, { recursive: true }); fs.writeFileSync(arqConfig, JSON.stringify(config, null, 2)); } catch { /* sem disco */ }
  };
  if (!Array.isArray(config.aparelhos)) config.aparelhos = [];

  function definirSenha(senha) {
    const sal = crypto.randomBytes(16).toString('hex');
    config.senha = { sal, hash: hashSenha(senha, sal) };
  }
  // Num servidor sem tela (Raspberry Pi) a primeira senha vem do ambiente.
  if (!config.senha && process.env.ASA_SENHA) { definirSenha(process.env.ASA_SENHA); salvarConfig(); }
  const senhaCerta = (senha) => !!config.senha && typeof senha === 'string'
    && crypto.timingSafeEqual(Buffer.from(hashSenha(senha, config.senha.sal), 'hex'), Buffer.from(config.senha.hash, 'hex'));
  const aparelhoDaChave = (chave) => (chave ? config.aparelhos.find((a) => a.hash === hashChave(chave)) : null);
  // Senha errada demais vinda do mesmo endereco: espera um pouco.
  const erros = new Map();

  let estado = { estado: 'desconectado', ip: null, info: null, progresso: 0 };
  let achadas = [];
  const clientes = new Set();

  // Ids que um celular em modo retorno pode mexer: os envios dos canais para o
  // bus dele e o proprio bus (volume geral e mute).
  const permitidosPorBus = new Map();
  function permitidosDoBus(n) {
    if (permitidosPorBus.has(n)) return permitidosPorBus.get(n);
    const ids = new Set();
    const add = (c) => { const d = esquema.def(c); if (d) ids.add(d.id); };
    for (let ch = 1; ch <= 40; ch++) { add(`/ch/${ch}/send/${n}/lvl`); add(`/ch/${ch}/send/${n}/on`); add(`/ch/${ch}/send/${n}/pan`); }
    for (let a = 1; a <= 8; a++) { add(`/aux/${a}/send/${n}/lvl`); add(`/aux/${a}/send/${n}/on`); }
    add(`/bus/${n}/fdr`); add(`/bus/${n}/mute`);
    permitidosPorBus.set(n, ids);
    return ids;
  }

  // --- HTTP ---------------------------------------------------------------
  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/esquema.json') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
        'Cache-Control': 'max-age=3600',
      });
      // Ja compactado na memoria (no Android o arquivo perde o .gz do nome).
      res.end(esquema.bruto);
      return;
    }
    let arquivo = path.normalize(path.join(PASTA_UI, decodeURIComponent(url.pathname)));
    if (!arquivo.startsWith(PASTA_UI)) { res.writeHead(403); res.end(); return; }
    if (url.pathname === '/' || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      arquivo = path.join(PASTA_UI, 'index.html');
    }
    fs.readFile(arquivo, (err, dados) => {
      if (err) { res.writeHead(404); res.end('Interface nao encontrada'); return; }
      res.writeHead(200, {
        'Content-Type': TIPOS_MIME[path.extname(arquivo)] || 'application/octet-stream',
        'Cache-Control': arquivo.endsWith('index.html') ? 'no-cache' : 'max-age=86400',
      });
      res.end(dados);
    });
  });

  // --- WebSocket ----------------------------------------------------------
  const wss = new WebSocketServer({ server: servidor });
  // O erro de porta ocupada ja e' tratado em ouvir(); sem isto o ws o repassa e derruba tudo.
  wss.on('error', () => {});

  function mandar(ws, msg) {
    if (ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  function todos(msg, filtro = () => true) {
    const s = JSON.stringify(msg);
    for (const c of clientes) if (filtro(c)) mandar(c.ws, s);
  }

  function infoGeral() {
    return {
      t: 'geral',
      estado,
      achadas,
      config: {
        acessoRede: config.acessoRede,
        temSenha: !!config.senha,
        aparelhos: config.aparelhos.map((a) => ({ id: a.id, nome: a.nome, criado: a.criado, visto: a.visto })),
        ultimaMesa: config.ultimaMesa,
        camadas: config.camadas,
        presets: config.presets,
        temBase: fs.existsSync(arqBase),
      },
      shows: listarShows(),
      rede: ipsDaRede(),
      porta: servidor.address()?.port,
    };
  }

  wss.on('connection', (ws, req) => {
    const local = eLocal(req.socket.remoteAddress);
    const url = new URL(req.url, 'http://x');
    const bus = parseInt(url.searchParams.get('retorno') || '', 10);
    // Aparelho do tecnico (entrou uma vez com a senha): controle completo de
    // qualquer lugar da rede, mesmo com o acesso pela rede em "so retornos".
    const aparelho = local ? null : aparelhoDaChave(url.searchParams.get('chave'));
    let papel = 'completo';
    if (!local && !aparelho) {
      if (config.acessoRede === 'desligado') { ws.close(4001, 'Acesso pela rede desligado'); return; }
      if (config.acessoRede === 'retorno' || bus) papel = 'retorno';
    } else if (bus) {
      papel = 'retorno';
    }
    if (aparelho) { aparelho.visto = Date.now(); salvarConfig(); }
    const cliente = { ws, papel, bus: bus >= 1 && bus <= 16 ? bus : null, local, aparelho: aparelho ? aparelho.id : null, ip: req.socket.remoteAddress };
    clientes.add(cliente);
    mandar(ws, { t: 'ola', papel, bus: cliente.bus, local, aparelho: cliente.aparelho });
    mandar(ws, infoGeral());
    if (wing.valores.size) mandar(ws, { t: 'tudo', l: [...wing.valores] });

    ws.on('message', (dados) => {
      let m;
      try { m = JSON.parse(dados); } catch { return; }
      receber(cliente, m);
    });
    ws.on('close', () => clientes.delete(cliente));
    ws.on('error', () => {});
  });

  function receber(cliente, m) {
    switch (m.t) {
      case 'set': {
        if (typeof m.id !== 'number') return;
        if (cliente.papel === 'retorno') {
          if (!cliente.bus || !permitidosDoBus(cliente.bus).has(m.id)) return;
        }
        if (wing.estado !== 'conectado' && wing.estado !== 'sincronizando') return;
        wing.definir(m.id, m.v, m.f);
        // A mesa nao devolve o valor a quem escreveu: avisamos os outros daqui.
        enfileirar(m.id, wing.valores.get(m.id), cliente);
        return;
      }
      case 'escolherRetorno': {
        if (cliente.papel !== 'retorno') return;
        const n = parseInt(m.bus, 10);
        cliente.bus = n >= 1 && n <= 16 ? n : null;
        return;
      }
      case 'entrar': {
        // Celular virando aparelho do tecnico: senha certa ganha uma chave.
        const agora = Date.now();
        const e = erros.get(cliente.ip) || { n: 0, ate: 0 };
        if (e.ate > agora) { mandar(cliente.ws, { t: 'entrar', ok: false, motivo: 'espere' }); return; }
        if (!config.senha) { mandar(cliente.ws, { t: 'entrar', ok: false, motivo: 'semSenha' }); return; }
        if (!senhaCerta(m.senha)) {
          e.n += 1;
          if (e.n >= 5) { e.n = 0; e.ate = agora + 60000; }
          erros.set(cliente.ip, e);
          mandar(cliente.ws, { t: 'entrar', ok: false, motivo: e.ate > agora ? 'espere' : 'errada' });
          return;
        }
        erros.delete(cliente.ip);
        const chave = crypto.randomBytes(24).toString('base64url');
        const nome = typeof m.nome === 'string' && m.nome.trim() ? m.nome.trim().slice(0, 32) : 'Aparelho';
        config.aparelhos.push({ id: crypto.randomBytes(6).toString('hex'), nome, hash: hashChave(chave), criado: agora, visto: agora });
        salvarConfig();
        mandar(cliente.ws, { t: 'entrar', ok: true, chave });
        todos(infoGeral());
        return;
      }
      default:
        break;
    }
    if (cliente.papel !== 'completo') return;
    switch (m.t) {
      case 'procurar':
        buscarMesas();
        return;
      case 'conectar':
        if (typeof m.ip !== 'string' || !m.ip.trim()) return;
        config.ultimaMesa = m.ip.trim();
        salvarConfig();
        wing.conectar(m.ip.trim(), achadas.find((a) => a.ip === m.ip) || null);
        return;
      case 'desconectar':
        config.ultimaMesa = null;
        salvarConfig();
        wing.desconectar();
        return;
      case 'config':
        if (['desligado', 'retorno', 'completo'].includes(m.acessoRede)) {
          config.acessoRede = m.acessoRede;
          // Quem ja estava conectado pela rede segue a regra nova.
          for (const c of clientes) {
            if (c.local || c.aparelho) continue;
            if (config.acessoRede === 'desligado') c.ws.close(4001, 'Acesso pela rede desligado');
            else if (config.acessoRede === 'retorno' && c.papel !== 'retorno') c.ws.close(4002, 'So retornos');
          }
        }
        salvarConfig();
        todos(infoGeral());
        return;
      case 'senhaTecnico': {
        const senha = typeof m.senha === 'string' ? m.senha.trim() : '';
        if (senha.length < 4 || senha.length > 32) return;
        definirSenha(senha);
        salvarConfig();
        todos(infoGeral());
        return;
      }
      case 'tirarAparelho': {
        const antes = config.aparelhos.length;
        config.aparelhos = config.aparelhos.filter((a) => a.id !== m.id);
        if (config.aparelhos.length === antes) return;
        salvarConfig();
        for (const c of clientes) if (c.aparelho === m.id) c.ws.close(4003, 'Acesso tirado');
        todos(infoGeral());
        return;
      }
      case 'camadas':
        if (!Array.isArray(m.lista)) return;
        config.camadas = m.lista
          .filter((c) => c && typeof c.nome === 'string' && Array.isArray(c.tiras))
          .map((c) => ({ nome: c.nome.slice(0, 24), tiras: c.tiras.filter((t) => typeof t === 'string' && /^\/(ch|aux|bus|main|mtx|dca)\/\d+$/.test(t)) }));
        salvarConfig();
        todos(infoGeral());
        return;
      case 'presets':
        if (!Array.isArray(m.lista)) return;
        config.presets = m.lista.filter((p) => p && typeof p.nome === 'string' && Array.isArray(p.valores));
        salvarConfig();
        todos(infoGeral());
        return;
      case 'escreverLote':
        // Varios valores de uma vez (aplicar preset, copiar mix): mesma regra do 'set'.
        if (!Array.isArray(m.l)) return;
        escreverAosPoucos(m.l.filter((x) => Array.isArray(x) && typeof x[0] === 'number').map(([id, v]) => ({ id, v, forma: esquema.formaDoId(id) })), cliente);
        return;
      case 'abrirSnap': {
        // Arquivo .snap do WING Edit (ou salvo pelo Asa), escolhido no Mac.
        let lido;
        try { lido = lerSnap(esquema, m.texto); } catch (err) { mandar(cliente.ws, { t: 'snapErro', erro: err.message }); return; }
        if (wing.estado !== 'conectado') { mandar(cliente.ws, { t: 'snapErro', erro: 'Conecte na mesa antes de abrir um show' }); return; }
        try { fs.mkdirSync(o.pastaConfig, { recursive: true }); fs.writeFileSync(arqBase, JSON.stringify(lido.snap)); } catch { /* segue sem base */ }
        // Camadas da snap entram; as do Asa com outro nome continuam.
        if (m.camadas && lido.camadas.length) {
          const nomes = new Set(lido.camadas.map((c) => c.nome));
          config.camadas = [...lido.camadas, ...(config.camadas || []).filter((c) => !nomes.has(c.nome))];
        }
        if (m.guardarComo) guardarShow(m.guardarComo, lido.snap);
        salvarConfig();
        escreverAosPoucos(lido.itens, null, (feito, total) => todos({ t: 'carregando', feito, total, nome: m.nome || 'show' }));
        todos(infoGeral());
        return;
      }
      case 'salvarSnap': {
        const snap = snapAtual();
        if (m.guardarComo) { guardarShow(m.guardarComo, snap); todos(infoGeral()); }
        if (m.baixar) mandar(cliente.ws, { t: 'arquivo', nome: `${m.guardarComo || m.nome || 'Show'}.snap`, texto: JSON.stringify(snap, null, 2) });
        return;
      }
      case 'abrirShow': {
        const arq = arquivoDoShow(m.nome);
        if (!arq || !fs.existsSync(arq)) return;
        receber(cliente, { t: 'abrirSnap', texto: fs.readFileSync(arq, 'utf8'), nome: m.nome, camadas: m.camadas });
        return;
      }
      case 'baixarShow': {
        const arq = arquivoDoShow(m.nome);
        if (!arq || !fs.existsSync(arq)) return;
        mandar(cliente.ws, { t: 'arquivo', nome: `${m.nome}.snap`, texto: fs.readFileSync(arq, 'utf8') });
        return;
      }
      case 'apagarShow': {
        const arq = arquivoDoShow(m.nome);
        if (arq) { try { fs.unlinkSync(arq); } catch { /* ja apagado */ } }
        todos(infoGeral());
        return;
      }
      default:
    }
  }

  // --- Shows (snapshots) guardados no Mac ---------------------------------
  const pastaShows = path.join(o.pastaConfig, 'shows');
  const arqBase = path.join(o.pastaConfig, 'ultima-snap.json');
  function arquivoDoShow(nome) {
    if (typeof nome !== 'string') return null;
    const limpo = nome.replace(/[\/\\:*?"<>|]/g, '').trim().slice(0, 60);
    return limpo ? path.join(pastaShows, `${limpo}.snap`) : null;
  }
  function listarShows() {
    try {
      return fs.readdirSync(pastaShows)
        .filter((f) => f.endsWith('.snap'))
        .map((f) => ({ nome: f.slice(0, -5), data: fs.statSync(path.join(pastaShows, f)).mtimeMs }))
        .sort((a, b) => b.data - a.data);
    } catch { return []; }
  }
  function guardarShow(nome, snap) {
    const arq = arquivoDoShow(nome);
    if (!arq) return;
    try { fs.mkdirSync(pastaShows, { recursive: true }); fs.writeFileSync(arq, JSON.stringify(snap, null, 2)); } catch { /* sem disco */ }
  }
  function snapAtual() {
    let base = null;
    try { base = JSON.parse(fs.readFileSync(arqBase, 'utf8')); } catch { /* sem base */ }
    return escreverSnap(esquema, wing.valores, base, wing.info || {});
  }

  // Escreve muitos valores sem afogar a mesa: lotes pequenos, um atras do
  // outro. Os outros clientes recebem cada valor (a mesa nao devolve).
  let filaEscrita = [];
  let escrevendo = null;
  function escreverAosPoucos(itens, origem, aoProgresso) {
    const total = itens.length;
    let feito = 0;
    filaEscrita.push(...itens.map((it) => ({ ...it, origem, aoProgresso, total, marca: () => ++feito })));
    if (escrevendo) return;
    const passo = () => {
      if (!filaEscrita.length || (wing.estado !== 'conectado' && wing.estado !== 'sincronizando')) {
        escrevendo = null;
        filaEscrita = [];
        return;
      }
      const lote = filaEscrita.splice(0, 120);
      let ultimo = null;
      for (const it of lote) {
        if (it.origem && it.origem.papel === 'retorno' && (!it.origem.bus || !permitidosDoBus(it.origem.bus).has(it.id))) continue;
        wing.definir(it.id, it.v, it.forma);
        enfileirar(it.id, wing.valores.get(it.id), it.origem);
        const n = it.marca();
        if (it.aoProgresso) ultimo = [it.aoProgresso, n, it.total];
      }
      if (ultimo) ultimo[0](ultimo[1], ultimo[2]);
      escrevendo = setTimeout(passo, 20);
    };
    escrevendo = setTimeout(passo, 0);
  }

  async function buscarMesas() {
    todos({ t: 'procurando' });
    const lista = await procurar({ tempoMs: 1500 });
    // A mesma mesa pode responder por mais de uma rede: uma por numero de serie.
    const porSerie = new Map();
    for (const m of lista) if (!porSerie.has(m.serie) || /^127\./.test(porSerie.get(m.serie).ip)) porSerie.set(m.serie, m);
    achadas = [...porSerie.values()];
    todos(infoGeral());
  }

  // --- Valores: junta o que muda e manda a cada 25 ms ----------------------
  let fila = new Map();
  let origemDe = new Map();
  function enfileirar(id, v, origem = null) {
    fila.set(id, v);
    if (origem) origemDe.set(id, origem); else origemDe.delete(id);
  }
  const relogioFila = setInterval(() => {
    if (!fila.size) return;
    const lista = [...fila];
    const origens = origemDe;
    fila = new Map();
    origemDe = new Map();
    for (const c of clientes) {
      const l = origens.size ? lista.filter(([id]) => origens.get(id) !== c) : lista;
      if (l.length) mandar(c.ws, { t: 'v', l });
    }
  }, 25);

  wing.on('valor', (id, v) => enfileirar(id, v));
  wing.on('estado', (e) => {
    estado = e;
    if (e.estado === 'conectado') {
      // Sincronizou: todo mundo recebe o estado inteiro de uma vez.
      todos({ t: 'tudo', l: [...wing.valores] });
    }
    if (e.estado === 'sincronizando') {
      todos({ t: 'progresso', progresso: e.progresso });
      return;
    }
    todos(infoGeral());
  });

  // --- Medidores: no maximo 25 por segundo --------------------------------
  let ultimosMedidores = null;
  wing.on('medidores', (v) => { ultimosMedidores = v; });
  const relogioMedidores = setInterval(() => {
    if (!ultimosMedidores) return;
    const v = ultimosMedidores;
    ultimosMedidores = null;
    const l = Array.from(v, (x) => Math.round(x * 2) / 2);
    todos({ t: 'm', l });
  }, 40);

  // --- Subir --------------------------------------------------------------
  function ouvir(porta, tentativas = 10) {
    const aoErro = (err) => {
      servidor.off('listening', aoOuvir);
      if (err.code === 'EADDRINUSE' && tentativas > 0) ouvir(porta + 1, tentativas - 1);
      else eventos.emit('falhou', err);
    };
    const aoOuvir = () => {
      servidor.off('error', aoErro);
      const p = servidor.address().port;
      eventos.emit('pronto', { porta: p, url: `http://127.0.0.1:${p}/` });
    };
    servidor.once('error', aoErro);
    servidor.once('listening', aoOuvir);
    servidor.listen(porta, '0.0.0.0');
  }
  ouvir(o.porta || 8730);

  buscarMesas().then(() => {
    if (config.ultimaMesa) wing.conectar(config.ultimaMesa, achadas.find((a) => a.ip === config.ultimaMesa) || null);
  });

  eventos.fechar = () => {
    clearInterval(relogioFila);
    clearInterval(relogioMedidores);
    wing.desconectar();
    for (const c of clientes) c.ws.terminate();
    wss.close();
    servidor.close();
  };
  eventos.wing = wing;
  return eventos;
}

module.exports = { iniciarServidor };

// Rodar sem o Electron (para testar no navegador): node app/main/servidor.js
if (require.main === module) {
  const s = iniciarServidor({ pastaConfig: process.env.ASA_CONFIG || path.join(os.tmpdir(), 'asa') });
  s.on('pronto', (i) => console.log(`Asa Edit no ar: ${i.url}`));
  s.on('falhou', (e) => { console.error(e.message); process.exit(1); });
  // No tablet o servidor e' o app inteiro: um erro solto vai para o log, mas
  // nao derruba a mesa no meio do culto.
  process.on('uncaughtException', (e) => console.error('Erro solto:', e && e.stack || e));
}
