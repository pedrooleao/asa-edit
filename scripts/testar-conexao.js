const { Esquema } = require(__dirname + '/../app/main/esquema');
const { ConexaoWing, procurar } = require(__dirname + '/../app/main/wing');
(async () => {
  console.log('procura:', await procurar({ tempoMs: 800, extras: ['127.0.0.1'] }));
  const e = new Esquema();
  const a = new ConexaoWing(e), b = new ConexaoWing(e);
  let t0 = Date.now(), metros = 0;
  a.on('medidores', () => metros++);
  a.on('estado', s => { if (s.estado !== 'sincronizando') console.log('A', s.estado, s.info, Date.now() - t0, 'ms', a.valores.size, 'valores'); });
  b.on('valor', (id, v) => { if (id === e.def('/ch/1/fdr').id || id === e.def('/ch/1/name').id) console.log('B recebeu', id, v); });
  const ip = process.argv[2] || '127.0.0.1'; a.conectar(ip); b.conectar(ip);
  await new Promise(r => setTimeout(r, 6000));
  console.log('fdr ch1 =', a.valores.get(e.def('/ch/1/fdr').id), 'grp=', a.valores.get(e.def('/ch/1/in/conn/grp').id), 'metros', metros);
  a.definir(e.def('/ch/1/fdr').id, -12.5, 'f');
  a.definir(e.def('/ch/1/name').id, 'Baixo', 's');
  await new Promise(r => setTimeout(r, 500));
  a.desconectar(); b.desconectar(); process.exit(0);
})();
