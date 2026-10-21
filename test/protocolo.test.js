'use strict';

// Testes do protocolo nativo da WING, sem mesa: codificacao, escape do 0xDF,
// pedacos cortados no meio de um token e leitura dos medidores.

const test = require('node:test');
const assert = require('node:assert');
const { Leitor, tokenValor, escapar, deCru, ConexaoWing } = require('../app/main/wing');
const { Esquema } = require('../app/main/esquema');

function lerTudo(pedacos) {
  const tokens = [];
  const l = new Leitor((t) => tokens.push(t));
  for (const p of pedacos) l.receber(Buffer.from(p));
  return tokens;
}

test('escapa o 0xDF como DF DE', () => {
  const out = [];
  escapar([0x01, 0xdf, 0x02], out);
  assert.deepStrictEqual(out, [0x01, 0xdf, 0xde, 0x02]);
});

test('codifica inteiros, floats e textos', () => {
  assert.deepStrictEqual(tokenValor(5, 'i'), [5]);
  assert.deepStrictEqual(tokenValor(100, 'i'), [0xd3, 0x00, 0x64]);
  assert.deepStrictEqual(tokenValor(-1, 'i'), [0xd3, 0xff, 0xff]);
  assert.deepStrictEqual(tokenValor('', 's'), [0xd0]);
  assert.deepStrictEqual(tokenValor('ab', 's'), [0x81, 0x61, 0x62]);
  const f = tokenValor(-12.5, 'f');
  assert.strictEqual(f[0], 0xd5);
  assert.strictEqual(Buffer.from(f.slice(1)).readFloatBE(0), -12.5);
  const longo = tokenValor('x'.repeat(100), 's');
  assert.strictEqual(longo[0], 0xd1);
  assert.strictEqual(longo[1], 99);
});

test('le id e valor do canal de dados', () => {
  const b = Buffer.alloc(4); b.writeInt32BE(-961719155, 0);
  const t = lerTudo([[0xdf, 0xd1, 0xd7, ...b, 0x83, 0x61, 0x62, 0x63, 0x64, 0xde]]);
  assert.deepStrictEqual(t.map((x) => x.tipo), ['id', 'valor', 'fim']);
  assert.strictEqual(t[0].v, -961719155);
  assert.strictEqual(t[1].v, 'abcd');
});

test('junta um token cortado em dois pedacos', () => {
  const f = Buffer.alloc(4); f.writeFloatBE(3.5, 0);
  const t = lerTudo([[0xdf, 0xd1, 0xd5, f[0], f[1]], [f[2], f[3], 0x07]]);
  assert.deepStrictEqual(t.map((x) => x.v), [3.5, 7]);
});

test('0xDF literal no meio de um float (DF DE) vira um byte so', () => {
  // Um float cujo primeiro byte e' 0xDF.
  const f = Buffer.from([0xdf, 0x00, 0x00, 0x00]);
  const v = f.readFloatBE(0);
  const t = lerTudo([[0xdf, 0xd1, 0xd5, 0xdf, 0xde, 0x00, 0x00, 0x00]]);
  assert.strictEqual(t[0].v, v);
});

test('escape cortado entre dois pedacos', () => {
  const t = lerTudo([[0xdf, 0xd1, 0x05, 0xdf], [0xd3, 0x01, 0xdf, 0xd1, 0x06]]);
  // 0x05 no canal 1; 0x01 no canal 3 (ignorado); 0x06 de novo no canal 1.
  assert.deepStrictEqual(t.map((x) => x.v), [5, 6]);
});

test('valor cru (0..1) vira valor real pela definicao', () => {
  assert.strictEqual(deCru({ tipo: 1, min: -10, max: 10 }, 0.5), 0);
  assert.ok(Math.abs(deCru({ tipo: 2, min: 20, max: 20000 }, 0.5) - 632.455) < 0.01);
  assert.strictEqual(deCru({ tipo: 3 }, 0.75), 0);
  assert.strictEqual(deCru({ tipo: 3 }, 0), -144);
});

test('pacote de medidores vira dB, com silencio em -144', () => {
  const c = new ConexaoWing(new Esquema());
  let recebido = null;
  c.on('medidores', (v) => { recebido = v; });
  const pac = Buffer.alloc(4 + 3 * 2);
  pac.writeUInt32BE(1, 0);
  pac.writeInt16BE(-12 * 256, 4);
  pac.writeInt16BE(-32768, 6);
  pac.writeInt16BE(3 * 256, 8);
  c.pacoteMedidor(pac);
  assert.strictEqual(recebido[0], -12);
  assert.strictEqual(recebido[1], -144);
  assert.strictEqual(recebido[2], 3);
  assert.strictEqual(recebido[3], -144);
});
