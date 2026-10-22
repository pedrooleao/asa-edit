'use strict';

// Quem controla o que: celular pela rede so ve a propria mix; com a senha do
// tecnico o aparelho ganha uma chave e passa a controlar tudo, ate tirarem o
// acesso. Precisa de um IP da maquina que nao seja o 127.0.0.1 (o servidor
// trata o 127.0.0.1 como o proprio Mac).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { iniciarServidor } = require('../app/main/servidor');

const ipDaRede = Object.values(os.networkInterfaces()).flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;

const abertos = [];
function abrir(porta, ip, query = '') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${ip}:${porta}/ws${query}`);
    abertos.push(ws);
    const msgs = [];
    const esperando = [];
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      msgs.push(m);
      const e = esperando.find((x) => x.t === m.t);
      if (e) { esperando.splice(esperando.indexOf(e), 1); m.usada = true; e.resolve(m); }
    });
    ws.esperar = (t) => {
      const ja = msgs.find((m) => m.t === t && !m.usada);
      if (ja) { ja.usada = true; return Promise.resolve(ja); }
      return new Promise((r) => esperando.push({ t, resolve: r }));
    };
    ws.fechou = new Promise((r) => ws.on('close', (codigo) => r(codigo)));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

test('senha do tecnico, chave do aparelho e tirar acesso', { skip: !ipDaRede && 'sem IP de rede' }, async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'asa-acesso-'));
  const s = iniciarServidor({ pastaConfig: pasta, porta: 18730 + Math.floor(Math.random() * 500) });
  const { porta } = await new Promise((r) => s.on('pronto', r));
  try {
    // O proprio Mac (127.0.0.1) controla tudo e define a senha.
    const mac = await abrir(porta, '127.0.0.1');
    assert.strictEqual((await mac.esperar('ola')).papel, 'completo');
    mac.send(JSON.stringify({ t: 'senhaTecnico', senha: '2580' }));
    let g;
    do g = await mac.esperar('geral'); while (!g.config.temSenha);

    // Celular pela rede: so retorno. Senha errada nao entra.
    const cel = await abrir(porta, ipDaRede);
    assert.strictEqual((await cel.esperar('ola')).papel, 'retorno');
    cel.send(JSON.stringify({ t: 'entrar', senha: '0000' }));
    const errada = await cel.esperar('entrar');
    assert.ok(!errada.ok && errada.motivo === 'errada' && !errada.chave);

    // Senha certa: recebe a chave; com ela, entra com controle completo.
    cel.send(JSON.stringify({ t: 'entrar', senha: '2580', nome: 'iPad' }));
    const r = await cel.esperar('entrar');
    assert.ok(r.ok && r.chave.length > 20);
    const ipad = await abrir(porta, ipDaRede, `?chave=${r.chave}`);
    const ola = await ipad.esperar('ola');
    assert.strictEqual(ola.papel, 'completo');
    assert.ok(ola.aparelho);

    // A chave nao vai para os outros e a senha so fica como hash no disco.
    const cfg = fs.readFileSync(path.join(pasta, 'asa-config.json'), 'utf8');
    assert.ok(!cfg.includes(r.chave) && !cfg.includes('2580'));
    do g = await mac.esperar('geral'); while (!g.config.aparelhos.length);
    assert.deepStrictEqual(Object.keys(g.config.aparelhos[0]).sort(), ['criado', 'id', 'nome', 'visto']);

    // Chave inventada: volta a ser celular.
    const falso = await abrir(porta, ipDaRede, '?chave=inventada');
    assert.strictEqual((await falso.esperar('ola')).papel, 'retorno');

    // Tirar o acesso derruba o aparelho; a mesma chave vira celular.
    mac.send(JSON.stringify({ t: 'tirarAparelho', id: ola.aparelho }));
    assert.strictEqual(await ipad.fechou, 4003);
    const depois = await abrir(porta, ipDaRede, `?chave=${r.chave}`);
    assert.strictEqual((await depois.esperar('ola')).papel, 'retorno');

    // Cinco erros seguidos: espera um minuto.
    for (let i = 0; i < 5; i++) {
      depois.send(JSON.stringify({ t: 'entrar', senha: 'x' + i }));
      await depois.esperar('entrar');
    }
    depois.send(JSON.stringify({ t: 'entrar', senha: '2580' }));
    assert.strictEqual((await depois.esperar('entrar')).motivo, 'espere');

  } finally {
    for (const w of abertos) w.terminate();
    s.fechar();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
