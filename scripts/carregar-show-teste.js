'use strict';

// Escreve no emulador (ou numa mesa) um show parecido com o da igreja, para as
// capturas de tela parecerem o uso real.
//
//   node scripts/carregar-show-teste.js                 # nomes e cores do PLANO
//   node scripts/carregar-show-teste.js show.snap       # uma snapshot do WING Edit
//   node scripts/carregar-show-teste.js show.snap 192.168.1.62

const fs = require('fs');
const path = require('path');
const { Esquema } = require('../app/main/esquema');
const { ConexaoWing } = require('../app/main/wing');
const { lerSnap } = require('../app/main/snap');

const args = process.argv.slice(2);
const arqSnap = args.find((a) => a.endsWith('.snap') || a.endsWith('.json'));
const ip = args.find((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a)) || '127.0.0.1';

const CANAIS = [
  ['Bateria L', 9], ['Bateria R', 9], ['Baixo', 8], ['Violão', 6], ['Guitarra L', 7], ['Guitarra R', 7],
  ['Piano L', 4], ['Piano R', 4], ['Mic 1', 5], ['Mic 2', 5], ['Mic 3', 5], ['Mic 4', 5], ['Mic 5', 5],
  ['Mic 6', 5], ['Mic Avisos', 11], ['Mic Pastor', 11],
];
const BUSES = [
  ['IEM Bateria', 9], ['IEM Guitarra', 7], ['IEM Baixo', 8], ['IEM Violão', 6], ['IEM Teclado', 4],
  ['Mon Mic 1', 5], ['Mon Mic 2', 5], ['Mon Mic 3', 5], ['Mon Mic 4', 5], ['Mon Mic 5', 5], ['Mon Mic 6', 5],
  ['Mon Pastor', 11], ['FX Rev Voz', 10], ['FX Rev Inst', 10], ['FX Delay Voz', 10], ['FX Rev Live', 10],
];

function showDoPlano(e) {
  const l = [];
  const add = (c, v) => { const d = e.def(c); if (d) l.push({ id: d.id, v, forma: e.formaDoId(d.id), caminho: c }); };
  CANAIS.forEach(([nome, cor], i) => {
    const n = i + 1;
    add(`/ch/${n}/name`, nome);
    add(`/ch/${n}/col`, cor);
    add(`/ch/${n}/in/conn/grp`, 'A');
    add(`/ch/${n}/in/conn/in`, n);
    add(`/io/in/A/${n}/name`, nome);
    add(`/io/in/A/${n}/g`, 20 + (n % 5) * 4);
    add(`/ch/${n}/fdr`, -5 + (n % 4) * 2);
    add(`/ch/${n}/tags`, n <= 8 ? '#D1,#M2' : n <= 14 ? '#D2,#M3' : '');
    add(`/ch/${n}/eq/on`, 1);
    add(`/ch/${n}/dyn/on`, n > 8 ? 1 : 0);
    // Envios: cada musico ouve o proprio instrumento mais alto.
    for (let b = 1; b <= 12; b++) {
      add(`/ch/${n}/send/${b}/on`, 1);
      add(`/ch/${n}/send/${b}/lvl`, b === Math.min(5, Math.ceil(n / 3)) ? 0 : -12 - ((n + b) % 4) * 3);
    }
    add(`/ch/${n}/send/13/on`, n > 8 ? 1 : 0);
    add(`/ch/${n}/send/13/lvl`, -15);
  });
  BUSES.forEach(([nome, cor], i) => {
    add(`/bus/${i + 1}/name`, nome);
    add(`/bus/${i + 1}/col`, cor);
    add(`/bus/${i + 1}/fdr`, 0);
  });
  ['PA', 'LIVE', 'M3', 'M4'].forEach((nome, i) => add(`/main/${i + 1}/name`, nome));
  for (let m = 1; m <= 8; m++) add(`/mtx/${m}/name`, `MX${m}`);
  add('/dca/1/name', 'Instrumentos'); add('/dca/1/col', 3);
  add('/dca/2/name', 'Back vocal'); add('/dca/2/col', 3);
  add('/mgrp/1/name', 'PA'); add('/mgrp/2/name', 'Instrumentos'); add('/mgrp/3/name', 'Mics 1-6');
  add('/main/1/fdr', -2);
  return l;
}

(async () => {
  const e = new Esquema();
  let itens;
  if (arqSnap) {
    const r = lerSnap(e, fs.readFileSync(path.resolve(arqSnap), 'utf8'));
    itens = r.itens;
    console.log(`${path.basename(arqSnap)}: ${itens.length} valores (${r.ignorados} que o Asa nao conhece)`);
  } else {
    itens = showDoPlano(e);
  }
  const w = new ConexaoWing(e);
  await new Promise((resolve, reject) => {
    w.on('estado', (s) => { if (s.estado === 'conectado') resolve(); });
    setTimeout(() => reject(new Error(`Sem resposta de ${ip}`)), 15000);
    w.conectar(ip);
  });
  for (let i = 0; i < itens.length; i += 200) {
    for (const it of itens.slice(i, i + 200)) w.definir(it.id, it.v, it.forma);
    await new Promise((r) => setTimeout(r, 20));
  }
  // A snap do WING Edit costuma vir com os faders embaixo: sobe os canais com nome.
  if (arqSnap && args.includes('--subir')) {
    for (let n = 1; n <= 40; n++) {
      const nome = w.valores.get(e.def(`/ch/${n}/name`).id);
      if (nome) w.definir(e.def(`/ch/${n}/fdr`).id, -4 - (n % 4) * 2, 'f');
    }
    for (let b = 1; b <= 16; b++) w.definir(e.def(`/bus/${b}/fdr`).id, 0, 'f');
    w.definir(e.def('/main/1/fdr').id, -2, 'f');
  }
  await new Promise((r) => setTimeout(r, 500));
  console.log(`Show escrito em ${ip}.`);
  w.desconectar();
  process.exit(0);
})().catch((err) => { console.error(err.message); process.exit(1); });
