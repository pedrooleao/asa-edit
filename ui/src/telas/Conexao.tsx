// Tela de conexao: lista as mesas achadas na rede, IP manual e progresso da leitura.

import { useState } from 'react';
import { enviar, useGeral, useMensagem } from '../store';

export function Conexao({ progresso }: { progresso: number }) {
  const { geral } = useGeral();
  const [ip, setIp] = useState('');
  const [procurando, setProcurando] = useState(false);
  useMensagem('procurando', () => setProcurando(true));
  useMensagem('geral', () => setProcurando(false));
  const e = geral!.estado;
  const ocupado = e.estado === 'conectando' || e.estado === 'sincronizando';
  return (
    <main className="conexao">
      <div className="conexao-marca">Asa</div>
      <h1>Conectar à WING</h1>
      <p className="dica">O Mac precisa estar na mesma rede da mesa (cabo ou Wi-Fi).</p>
      {e.estado === 'conectando' && <p className="estado">Conectando em {e.ip}…</p>}
      {e.estado === 'sincronizando' && (
        <div className="estado">
          <p>Lendo a mesa… {Math.round(progresso * 100)}%</p>
          <div className="barra-progresso"><div style={{ width: `${progresso * 100}%` }} /></div>
        </div>
      )}
      {e.estado === 'desconectado' && e.erro && <p className="erro">{e.erro}. Confira se o Mac está na mesma rede da mesa.</p>}
      <h2>Mesas na rede</h2>
      <ul className="mesas">
        {geral!.achadas.map((m) => (
          <li key={m.serie + m.ip}>
            <button disabled={ocupado} onClick={() => enviar({ t: 'conectar', ip: m.ip })}>
              <strong>{m.nome}</strong>
              <span>{m.modelo.replace('wing-', 'WING ').replace('compact', 'Compact')} · {m.ip} · firmware {m.firmware.split('-')[0]}</span>
            </button>
          </li>
        ))}
        {!geral!.achadas.length && <li className="dica">{procurando ? 'Procurando…' : 'Nenhuma mesa encontrada na rede.'}</li>}
      </ul>
      <div className="linha">
        <button onClick={() => enviar({ t: 'procurar' })} disabled={procurando}>{procurando ? 'Procurando…' : 'Procurar de novo'}</button>
        <form onSubmit={(ev) => { ev.preventDefault(); if (ip.trim()) enviar({ t: 'conectar', ip: ip.trim() }); }}>
          <input aria-label="IP da mesa" placeholder="IP da mesa (ex.: 192.168.1.62)" value={ip} onChange={(ev) => setIp(ev.target.value)} />
          <button type="submit" className="primario" disabled={!ip.trim() || ocupado}>Conectar</button>
        </form>
      </div>
    </main>
  );
}
