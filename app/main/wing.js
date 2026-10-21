'use strict';

// Cliente do protocolo nativo da Behringer WING (o mesmo que o WING Edit usa).
//
//   UDP 2222  descoberta: manda "WING?", a mesa responde "WING,ip,nome,modelo,serie,firmware"
//   TCP 2222  dados: fluxo binario com canais. DF D1 = dados da mesa, DF D3 = medidores
//   UDP (porta nossa)  a mesa manda os medidores para ca, 1/256 dB em int16
//
// Fontes: "WING Remote Protocols" (P.-G. Maillot / Behringer) e o libwing
// (Apache-2.0), que foi testado numa WING Compact de verdade.

const net = require('net');
const dgram = require('dgram');
const os = require('os');
const { EventEmitter } = require('events');

const PORTA = 2222;
const ESC = 0xdf;

// A mesa derruba a conexao depois de 10 s sem receber nada. Mandamos um pedido
// pequeno a cada 3 s: ele mantem a conexao viva e prova que ela responde.
const PULSO_MS = 3000;
const SEM_RESPOSTA_MS = 10000;
// A inscricao dos medidores vale 5 s; renovamos antes disso.
const RENOVA_MEDIDOR_MS = 2500;

// ---------------------------------------------------------------------------
// Descoberta
// ---------------------------------------------------------------------------

function enderecosDeBroadcast() {
  const lista = new Set(['255.255.255.255']);
  for (const ifs of Object.values(os.networkInterfaces())) {
    for (const ni of ifs || []) {
      if (ni.family !== 'IPv4' || ni.internal || !ni.netmask) continue;
      const a = ni.address.split('.').map(Number);
      const m = ni.netmask.split('.').map(Number);
      lista.add(a.map((x, i) => (x | (~m[i] & 255)) & 255).join('.'));
    }
  }
  return [...lista];
}

/** Procura mesas na rede. Resolve com [{ip, nome, modelo, serie, firmware}]. */
function procurar({ tempoMs = 1500, extras = [] } = {}) {
  return new Promise((resolve) => {
    const achadas = new Map();
    const sock = dgram.createSocket('udp4');
    const fim = () => {
      try { sock.close(); } catch { /* ja fechado */ }
      resolve([...achadas.values()]);
    };
    sock.on('error', fim);
    sock.on('message', (msg) => {
      const p = msg.toString('latin1').split(',');
      if (p.length >= 6 && p[0] === 'WING') {
        achadas.set(p[1], { ip: p[1], nome: p[2], modelo: p[3], serie: p[4], firmware: p[5] });
      }
    });
    sock.bind(0, () => {
      try { sock.setBroadcast(true); } catch { /* segue */ }
      const msg = Buffer.from('WING?');
      const alvos = [...enderecosDeBroadcast(), ...extras];
      let n = 0;
      const mandar = () => {
        for (const a of alvos) sock.send(msg, PORTA, a, () => {});
        if (++n < 3) setTimeout(mandar, 300);
      };
      mandar();
      setTimeout(fim, tempoMs);
    });
  });
}

// ---------------------------------------------------------------------------
// Codificacao
// ---------------------------------------------------------------------------

/** Escapa um 0xDF de dado como DF DE, que vale sempre como byte literal. */
function escapar(bytes, saida) {
  for (const b of bytes) {
    saida.push(b);
    if (b === ESC) saida.push(0xde);
  }
}

function i32(v) {
  const b = Buffer.alloc(4);
  b.writeInt32BE(v | 0, 0);
  return [...b];
}

function tokenValor(v, forma) {
  if (forma === 's') {
    let b = Buffer.from(String(v), 'utf8');
    if (b.length > 256) b = b.subarray(0, 256);
    if (b.length === 0) return [0xd0];
    if (b.length <= 64) return [0x80 + b.length - 1, ...b];
    return [0xd1, b.length - 1, ...b];
  }
  if (forma === 'i') {
    const n = Math.round(Number(v));
    if (n >= 0 && n <= 0x3f) return [n];
    if (n >= -32768 && n <= 32767) {
      const b = Buffer.alloc(2);
      b.writeInt16BE(n, 0);
      return [0xd3, ...b];
    }
    return [0xd4, ...i32(n)];
  }
  const b = Buffer.alloc(4);
  b.writeFloatBE(Number(v), 0);
  return [0xd5, ...b];
}

// ---------------------------------------------------------------------------
// Decodificacao do fluxo que vem da mesa
// ---------------------------------------------------------------------------

class Leitor {
  constructor(aoToken) {
    this.aoToken = aoToken;
    this.esc = false;
    this.canal = 1;
    this.pendente = [];   // bytes do canal de dados ainda sem token completo
  }

  receber(pedaco) {
    const dados = [];
    for (const b of pedaco) {
      if (!this.esc) {
        if (b === ESC) this.esc = true;
        else if (this.canal === 1) dados.push(b);
        continue;
      }
      this.esc = false;
      if (b === 0xde || b === ESC) {
        if (this.canal === 1) dados.push(ESC);
      } else if (b >= 0xd0 && b <= 0xdd) {
        this.processar(dados);
        dados.length = 0;
        this.canal = b - 0xd0;
      } else if (this.canal === 1) {
        dados.push(ESC, b);
      }
    }
    this.processar(dados);
  }

  processar(bytes) {
    if (!bytes.length) return;
    const buf = this.pendente.length ? this.pendente.concat(bytes) : bytes;
    let i = 0;
    while (i < buf.length) {
      const n = tamanho(buf, i);
      if (n < 0 || i + n > buf.length) break;
      this.aoToken(ler(buf, i, n));
      i += n;
    }
    this.pendente = buf.slice(i);
  }
}

function tamanho(buf, i) {
  const c = buf[i];
  if (c <= 0x7f) return 1;
  if (c <= 0xbf) return 1 + (c - 0x80 + 1);
  if (c <= 0xcf) return 1 + (c - 0xc0 + 1);
  switch (c) {
    case 0xd1: return i + 1 < buf.length ? 2 + buf[i + 1] + 1 : -1;
    case 0xd2: case 0xd3: return 3;
    case 0xd4: case 0xd5: case 0xd6: case 0xd7: return 5;
    case 0xd9: return 2;
    case 0xdf: {
      // Definicao de no': DF, tamanho (16 bits; se 0, vem 32 bits), bytes.
      if (i + 2 >= buf.length) return -1;
      const t = (buf[i + 1] << 8) | buf[i + 2];
      if (t > 0) return 3 + t;
      if (i + 6 >= buf.length) return -1;
      const t2 = ((buf[i + 3] << 24) | (buf[i + 4] << 16) | (buf[i + 5] << 8) | buf[i + 6]) >>> 0;
      return 7 + t2;
    }
    default: return 1;
  }
}

function ler(buf, i, n) {
  const c = buf[i];
  const b = Buffer.from(buf.slice(i + 1, i + n));
  if (c <= 0x3f) return { tipo: 'valor', v: c };
  if (c <= 0x7f) return { tipo: 'outro' };
  if (c <= 0xbf) return { tipo: 'valor', v: b.toString('utf8') };
  if (c <= 0xcf) return { tipo: 'outro' };
  switch (c) {
    case 0xd0: return { tipo: 'valor', v: '' };
    case 0xd1: return { tipo: 'valor', v: b.subarray(1).toString('utf8') };
    case 0xd3: return { tipo: 'valor', v: b.readInt16BE(0) };
    case 0xd4: return { tipo: 'valor', v: b.readInt32BE(0) };
    case 0xd5: return { tipo: 'valor', v: b.readFloatBE(0) };
    case 0xd6: return { tipo: 'cru', v: b.readFloatBE(0) };
    case 0xd7: return { tipo: 'id', v: b.readInt32BE(0) };
    case 0xde: return { tipo: 'fim' };
    default: return { tipo: 'outro' };
  }
}

// ---------------------------------------------------------------------------
// Medidores: o que pedir e como ler
// ---------------------------------------------------------------------------

// Cada bloco: codigo do pedido, quantos, palavras por item.
const BLOCOS_MEDIDOR = [
  { nome: 'ch', codigo: 0xa0, qtd: 40, palavras: 8 },
  { nome: 'aux', codigo: 0xa1, qtd: 8, palavras: 8 },
  { nome: 'bus', codigo: 0xa2, qtd: 16, palavras: 8 },
  { nome: 'main', codigo: 0xa3, qtd: 4, palavras: 8 },
  { nome: 'mtx', codigo: 0xa4, qtd: 8, palavras: 8 },
  { nome: 'dca', codigo: 0xa5, qtd: 16, palavras: 4 },
];
const PALAVRAS_TOTAL = BLOCOS_MEDIDOR.reduce((s, b) => s + b.qtd * b.palavras, 0);

// ---------------------------------------------------------------------------
// Conexao
// ---------------------------------------------------------------------------

class ConexaoWing extends EventEmitter {
  /**
   * @param {import('./esquema').Esquema} esquema
   */
  constructor(esquema) {
    super();
    this.esquema = esquema;
    this.valores = new Map();     // id -> valor
    this.sock = null;
    this.ip = null;
    this.info = null;
    this.estado = 'desconectado'; // desconectado | conectando | sincronizando | conectado
    this.progresso = 0;
    this.ultimaResposta = 0;
    this.idAtual = null;
    this.relogios = [];
    this.reconectar = true;
    this.tentativa = null;
    this.udp = null;
    this.portaUdp = 0;
    this.idMedidor = 1;
    this.ultimoMedidor = 0;
  }

  mudarEstado(e, extra = {}) {
    this.estado = e;
    this.emit('estado', { estado: e, ip: this.ip, info: this.info, progresso: this.progresso, ...extra });
  }

  /** Conecta e mantem conectado (reconecta sozinho se a rede cair). */
  conectar(ip, info = null) {
    this.desconectar();
    this.reconectar = true;
    this.ip = ip;
    this.info = info;
    this.abrir();
  }

  abrir() {
    clearTimeout(this.tentativa);
    this.mudarEstado('conectando');
    const sock = net.createConnection({ host: this.ip, port: PORTA });
    this.sock = sock;
    this.leitor = new Leitor((t) => this.token(t));
    sock.setNoDelay(true);
    sock.setTimeout(6000);
    sock.once('connect', () => {
      sock.setTimeout(0);
      this.ultimaResposta = Date.now();
      this.escrever([ESC, 0xd1]);
      this.iniciarMedidores();
      this.relogios.push(setInterval(() => this.pulso(), PULSO_MS));
      this.sincronizar();
    });
    sock.on('data', (d) => {
      this.ultimaResposta = Date.now();
      this.leitor.receber(d);
    });
    sock.on('timeout', () => sock.destroy(new Error('A mesa nao respondeu')));
    sock.on('error', (err) => { this.ultimoErro = err.message; });
    sock.on('close', () => {
      if (this.sock !== sock) return;
      this.limpar();
      this.mudarEstado('desconectado', { erro: this.ultimoErro || null });
      if (this.reconectar) this.tentativa = setTimeout(() => this.abrir(), 2000);
    });
  }

  limpar() {
    for (const r of this.relogios) clearInterval(r);
    this.relogios = [];
    if (this.udp) {
      try { this.udp.close(); } catch { /* ja fechado */ }
      this.udp = null;
    }
    this.sock = null;
  }

  desconectar() {
    this.reconectar = false;
    clearTimeout(this.tentativa);
    const s = this.sock;
    this.limpar();
    if (s) s.destroy();
    if (this.estado !== 'desconectado') this.mudarEstado('desconectado');
  }

  escrever(bytes) {
    if (this.sock && !this.sock.destroyed) this.sock.write(Buffer.from(bytes));
  }

  /** Pede ao canal de dados (1) a lista de ids, em lotes. */
  pedirDados(ids) {
    const out = [ESC, 0xd1];
    for (const id of ids) {
      out.push(0xd7);
      escapar(i32(id), out);
      out.push(0xdc);
    }
    this.escrever(out);
  }

  pulso() {
    if (Date.now() - this.ultimaResposta > SEM_RESPOSTA_MS) {
      this.ultimoErro = 'A mesa parou de responder';
      if (this.sock) this.sock.destroy();
      return;
    }
    const def = this.esquema.def('/$syscfg/$firmware') || this.esquema.def('/$syscfg/consolename');
    if (def) this.pedirDados([def.id]);
    else this.escrever([ESC, 0xd1]);
  }

  token(t) {
    if (t.tipo === 'id') {
      this.idAtual = t.v;
      return;
    }
    if ((t.tipo === 'valor' || t.tipo === 'cru') && this.idAtual !== null) {
      let v = t.v;
      if (t.tipo === 'cru') v = deCru(this.esquema.porId.get(this.idAtual)?.[0], v);
      if (v === undefined) return;
      const antes = this.valores.get(this.idAtual);
      this.valores.set(this.idAtual, v);
      this.recebidos++;
      if (antes !== v) this.emit('valor', this.idAtual, v);
    }
  }

  /**
   * Le o estado inteiro da mesa (so as partes que o app usa). Manda os pedidos
   * aos poucos para nao afogar a mesa; a WING atende todos na ordem.
   */
  sincronizar() {
    const ids = this.esquema.idsDeFolhas([
      '/ch/', '/aux/', '/bus/', '/main/', '/mtx/', '/dca/', '/mgrp/', '/io/', '/$syscfg/', '/cfg/', '/fx/',
    ]);
    this.recebidos = 0;
    this.progresso = 0;
    this.mudarEstado('sincronizando');
    const LOTE = 300;
    let i = 0;
    const sock = this.sock;
    const passo = () => {
      if (this.sock !== sock) return;
      if (i < ids.length) {
        this.pedirDados(ids.slice(i, i + LOTE));
        i += LOTE;
        this.progresso = Math.min(0.99, this.recebidos / ids.length);
        this.emit('estado', { estado: 'sincronizando', ip: this.ip, info: this.info, progresso: this.progresso });
        setTimeout(passo, 25);
        return;
      }
      // Espera as respostas pararem de chegar.
      let ultimo = -1;
      const espera = setInterval(() => {
        if (this.sock !== sock) { clearInterval(espera); return; }
        if (this.recebidos === ultimo || this.recebidos >= ids.length) {
          clearInterval(espera);
          this.progresso = 1;
          this.lerInfo();
          this.mudarEstado('conectado');
        }
        ultimo = this.recebidos;
      }, 400);
    };
    passo();
  }

  lerInfo() {
    const ler = (c) => {
      const d = this.esquema.def(c);
      return d ? this.valores.get(d.id) : undefined;
    };
    this.info = {
      ...(this.info || {}),
      nome: ler('/$syscfg/consolename') || this.info?.nome || 'WING',
      firmware: ler('/$syscfg/$firmware') || this.info?.firmware || '',
      modelo: ler('/$syscfg/$cnsmdl') || this.info?.modelo || '',
    };
  }

  /** Escreve um valor. forma: 'f' float, 'i' inteiro, 's' texto. */
  definir(id, v, forma) {
    forma = forma || this.esquema.formaDoId(id) || 'f';
    const out = [ESC, 0xd1, 0xd7];
    escapar(i32(id), out);
    escapar(tokenValor(v, forma), out);
    this.escrever(out);
    if (forma === 'i') v = Math.round(Number(v));
    else if (forma === 'f') v = Number(v);
    this.valores.set(id, v);
  }

  // -------------------------------------------------------------------------
  // Medidores
  // -------------------------------------------------------------------------
  iniciarMedidores() {
    const udp = dgram.createSocket('udp4');
    this.udp = udp;
    udp.on('error', () => {});
    udp.on('message', (msg) => this.pacoteMedidor(msg));
    udp.bind(0, () => {
      if (this.udp !== udp) return;
      this.portaUdp = udp.address().port;
      this.pedirMedidores();
      this.relogios.push(setInterval(() => this.renovarMedidores(), RENOVA_MEDIDOR_MS));
    });
  }

  pedirMedidores() {
    const out = [ESC, 0xd3];
    const corpo = [0xd3, (this.portaUdp >> 8) & 0xff, this.portaUdp & 0xff, 0xd4, ...i32(this.idMedidor), 0xdc];
    // Um codigo antes de cada indice: vale pela documentacao e e' o que todo
    // receptor entende.
    for (const b of BLOCOS_MEDIDOR) {
      for (let k = 0; k < b.qtd; k++) corpo.push(b.codigo, k);
    }
    corpo.push(0xde);
    escapar(corpo, out);
    out.push(ESC, 0xd1);
    this.escrever(out);
  }

  renovarMedidores() {
    // Sem pacote ha um tempo: pede a lista inteira de novo (a mesa pode ter
    // esquecido a inscricao); senao so renova.
    if (Date.now() - this.ultimoMedidor > 4000) {
      this.pedirMedidores();
      return;
    }
    const out = [ESC, 0xd3];
    escapar([0xd3, (this.portaUdp >> 8) & 0xff, this.portaUdp & 0xff, 0xd4, ...i32(this.idMedidor)], out);
    out.push(ESC, 0xd1);
    this.escrever(out);
  }

  pacoteMedidor(msg) {
    if (msg.length < 4 + 2) return;
    this.ultimoMedidor = Date.now();
    const n = Math.min(PALAVRAS_TOTAL, (msg.length - 4) >> 1);
    const valores = new Float32Array(PALAVRAS_TOTAL).fill(-144);
    for (let k = 0; k < n; k++) {
      const w = msg.readInt16BE(4 + k * 2);
      valores[k] = w <= -32768 ? -144 : w / 256;
    }
    this.emit('medidores', valores);
  }
}

// Valor cru (0..1) para valor real; a WING quase sempre manda o valor real,
// mas o token existe.
function deCru(def, x) {
  if (!def) return undefined;
  x = Math.max(0, Math.min(1, x));
  switch (def.tipo) {
    case 1: return def.min + x * (def.max - def.min);
    case 2: return def.min * Math.pow(def.max / def.min, x);
    case 3: return faderDeCru(x);
    case 4: return Math.round(def.min + x * (def.max - def.min));
    default: return undefined;
  }
}

function faderDeCru(f) {
  if (f <= 0) return -144;
  if (f < 0.0625) return f * 480 - 90;
  if (f < 0.25) return f * 160 - 70;
  if (f < 0.5) return f * 80 - 50;
  return Math.min(10, f * 40 - 30);
}

module.exports = { ConexaoWing, procurar, BLOCOS_MEDIDOR, PALAVRAS_TOTAL };
