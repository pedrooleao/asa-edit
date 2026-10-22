'use strict';

// Teste de fumaca do app pronto (ou do servidor rodando): a interface abre, o
// esquema vem, e pelo WebSocket o Asa conecta numa mesa, le tudo e manda
// medidores. Usado no GitHub Actions contra o emulador, com o .app aberto.
//
//   node scripts/teste-fumaca.js [ip-da-mesa] [porta-do-asa] [--sem-medidores]
// --sem-medidores: no emulador de Android o UDP dos medidores nao entra (NAT).

const http = require('http');
const WebSocket = require('ws');

const IP = process.argv[2] || '127.0.0.1';
const PORTA = Number(process.argv[3] || 8730);
const SEM_MEDIDORES = process.argv.includes('--sem-medidores');
const falhar = (m) => { console.error(`FALHOU: ${m}`); process.exit(1); };
const pegar = (caminho) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: PORTA, path: caminho }, (r) => {
    const partes = [];
    r.on('data', (d) => partes.push(d));
    r.on('end', () => resolve({ status: r.statusCode, cab: r.headers, corpo: Buffer.concat(partes) }));
  }).on('error', reject);
});

(async () => {
  // O app pode levar alguns segundos para subir.
  let pagina = null;
  for (let i = 0; i < 120 && !pagina; i++) {
    try { pagina = await pegar('/'); } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  if (!pagina) falhar(`o Asa nao respondeu na porta ${PORTA}`);
  if (!pagina.corpo.toString().includes('<div id="raiz">')) falhar('a pagina nao e a interface do Asa');
  console.log('ok  interface no ar');
  const esq = await pegar('/esquema.json');
  if (esq.status !== 200 || esq.corpo.length < 100000) falhar('esquema nao veio');
  console.log(`ok  esquema (${Math.round(esq.corpo.length / 1024)} KB)`);

  const ws = new WebSocket(`ws://127.0.0.1:${PORTA}/ws`);
  let valores = 0;
  let medidores = 0;
  let conectado = false;
  ws.on('message', (d) => {
    const m = JSON.parse(d);
    if (m.t === 'geral' && m.estado.estado === 'conectado') conectado = true;
    if (m.t === 'tudo') valores = Math.max(valores, m.l.length);
    if (m.t === 'm') medidores++;
  });
  await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  ws.send(JSON.stringify({ t: 'conectar', ip: IP }));
  for (let i = 0; i < 90 && !(conectado && valores > 20000 && (SEM_MEDIDORES || medidores > 5)); i++) await new Promise((r) => setTimeout(r, 500));
  if (!conectado) falhar(`nao conectou na mesa em ${IP}`);
  console.log(`ok  conectado em ${IP}`);
  if (valores < 20000) falhar(`leu so ${valores} valores`);
  console.log(`ok  ${valores} valores lidos`);
  if (!SEM_MEDIDORES) {
    if (medidores < 5) falhar('medidores nao chegaram');
    console.log(`ok  medidores chegando (${medidores} quadros)`);
  }
  ws.send(JSON.stringify({ t: 'desconectar' }));
  setTimeout(() => process.exit(0), 300);
})().catch((e) => falhar(e.message));
