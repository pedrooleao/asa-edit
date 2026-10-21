'use strict';

// Snapshots do WING Edit: parametros de modelo sem o nome do modelo no
// caminho, true/false para 0/1, e ida e volta sem perder nada.

const test = require('node:test');
const assert = require('node:assert');
const { Esquema } = require('../app/main/esquema');
const { lerSnap, escreverSnap } = require('../app/main/snap');

const esquema = new Esquema();
const SNAP = {
  type: 'snapshot.11',
  ae_data: {
    ch: {
      1: {
        name: 'Voz', col: 5, mute: false, fdr: -4.5, tags: '#D1,#M2',
        flt: { lc: true, lcf: 100, lcs: '24' },
        gate: { on: false, mdl: 'GATE', thr: -40, ratio: '1:3' },
        dyn: { on: true, mdl: 'COMP', thr: -12, ratio: 2.5 },
        eq: { on: true, mdl: 'STD', '1g': -2.5, '1f': 400, leq: 'SHV' },
      },
    },
    fx: { 1: { mdl: 'HALL', fxmix: 100, dcy: 1.8 } },
  },
  ce_data: { layer: { CMPCT: { 1: { name: 'VOZES', 1: { type: 'CH', i: 1 }, 2: { type: 'BUS', i: 13 }, 3: { type: 'CH', i: 41 }, 4: { type: 'BUS', i: 17 }, 5: { type: 'OFF', i: 0 } } } } },
};

test('le valores, modelos e booleanos', () => {
  const r = lerSnap(esquema, JSON.stringify(SNAP));
  const por = new Map(r.itens.map((i) => [i.caminho, i.v]));
  assert.strictEqual(por.get('/ch/1/name'), 'Voz');
  assert.strictEqual(por.get('/ch/1/mute'), 0);
  assert.strictEqual(por.get('/ch/1/flt/lc'), 1);
  assert.strictEqual(por.get('/ch/1/flt/lcs'), '24');
  assert.strictEqual(por.get('/ch/1/gate/GATE/thr'), -40);
  assert.strictEqual(por.get('/ch/1/dyn/COMP/ratio'), 2.5);
  assert.strictEqual(por.get('/ch/1/eq/STD/1g'), -2.5);
  assert.strictEqual(por.get('/fx/1/HALL/dcy'), 1.8);
  // O modelo vem antes dos parametros dele.
  const ordem = r.itens.map((i) => i.caminho);
  assert.ok(ordem.indexOf('/ch/1/gate/mdl') < ordem.indexOf('/ch/1/gate/GATE/thr'));
});

test('traz as camadas da Compact', () => {
  const r = lerSnap(esquema, SNAP);
  assert.deepStrictEqual(r.camadas, [{ nome: 'Vozes', tiras: ['/ch/1', '/bus/13', '/aux/1', '/main/1'] }]);
});

test('ida e volta, com e sem a snap de base', () => {
  const r = lerSnap(esquema, SNAP);
  const valores = new Map(r.itens.map((i) => [i.id, i.v]));
  for (const base of [r.snap, null]) {
    const volta = lerSnap(esquema, escreverSnap(esquema, valores, base));
    const por = new Map(volta.itens.map((i) => [i.id, i.v]));
    for (const [id, v] of valores) assert.strictEqual(por.get(id), v, `id ${id}`);
  }
});

test('recusa arquivo que nao e snapshot', () => {
  assert.throws(() => lerSnap(esquema, '{"x":1}'), /snapshot/);
});
