// Ponto de partida: tela de conexao funcionando. As telas Mixer, Retornos e
// Roteamento entram aqui seguindo docs/PLANO.md (fases 2 a 5).
import { useState } from 'react';
import { enviar, useEsquemaPronto, useGeral, useValor } from './store';

export function App() {
  const { geral, papel, progresso, ligadoAoApp } = useGeral();
  const esquema = useEsquemaPronto();
  if (!ligadoAoApp || !geral || !esquema) return <div className="vazio">Abrindo o Asa…</div>;
  if (papel?.papel === 'retorno') return <div className="vazio">Modo retorno: tela do celular (fase 4).</div>;
  const e = geral.estado;
  if (e.estado !== 'conectado') return <Conexao progresso={progresso} />;
  return <Conectado />;
}

function Conexao({ progresso }: { progresso: number }) {
  const { geral } = useGeral();
  const [ip, setIp] = useState('');
  const e = geral!.estado;
  return (
    <main className="conexao">
      <h1>Conectar à WING</h1>
      {e.estado === 'conectando' && <p>Conectando em {e.ip}…</p>}
      {e.estado === 'sincronizando' && <p>Lendo a mesa… {Math.round(progresso * 100)}%</p>}
      {e.estado === 'desconectado' && e.erro && <p className="erro">{e.erro}. Confira se o Mac está na mesma rede da mesa.</p>}
      <ul className="mesas">
        {geral!.achadas.map((m) => (
          <li key={m.serie}>
            <button onClick={() => enviar({ t: 'conectar', ip: m.ip })}>
              <strong>{m.nome}</strong> <span>{m.modelo} · {m.ip} · firmware {m.firmware.split('-')[0]}</span>
            </button>
          </li>
        ))}
        {!geral!.achadas.length && <li className="dica">Nenhuma mesa encontrada na rede.</li>}
      </ul>
      <div className="linha">
        <button onClick={() => enviar({ t: 'procurar' })}>Procurar de novo</button>
        <form onSubmit={(ev) => { ev.preventDefault(); enviar({ t: 'conectar', ip }); }}>
          <input placeholder="IP da mesa (ex.: 192.168.1.62)" value={ip} onChange={(ev) => setIp(ev.target.value)} />
          <button type="submit">Conectar</button>
        </form>
      </div>
    </main>
  );
}

function Conectado() {
  const { geral } = useGeral();
  const nome = useValor('/ch/1/name');
  const fdr = useValor('/ch/1/fdr');
  return (
    <main className="conexao">
      <h1>{geral!.estado.info?.nome} conectada</h1>
      <p>Canal 1: {String(nome || 'Ch 1')} em {typeof fdr === 'number' ? fdr.toFixed(1) : '?'} dB</p>
      <button onClick={() => enviar({ t: 'desconectar' })}>Desconectar</button>
    </main>
  );
}
