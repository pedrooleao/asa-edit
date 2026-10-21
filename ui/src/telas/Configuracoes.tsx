// Ajustes: acesso pela rede (celulares), a mesa conectada e preferencias.

import { enviar, useGeral, useTexto } from '../store';
import { aplicarZoom, mudarUi, useUi } from '../ui';
import { CampoTexto } from '../comp/Parametro';

const ACESSOS = [
  { id: 'retorno', nome: 'Só retornos', txt: 'Celulares na rede abrem só a mix escolhida (recomendado no culto).' },
  { id: 'completo', nome: 'Completo', txt: 'Qualquer aparelho na rede controla a mesa inteira. Use só em rede confiável.' },
  { id: 'desligado', nome: 'Desligado', txt: 'Só este Mac controla a mesa.' },
] as const;

export function Configuracoes() {
  const { geral } = useGeral();
  const acesso = geral?.config.acessoRede;
  const e = geral!.estado;
  const zoom = useUi('zoom');
  const esconder = useUi('esconderVazios');
  const firmware = useTexto('/$syscfg/$firmware');
  const modelo = useTexto('/$syscfg/$cnsmdl');
  return (
    <div className="tela-form">
      <h1>Ajustes</h1>
      <section className="secao">
        <h2>Acesso pela rede</h2>
        <div className="opcoes" role="radiogroup" aria-label="Acesso pela rede">
          {ACESSOS.map((a) => (
            <label key={a.id} className={`opcao ${acesso === a.id ? 'sel' : ''}`}>
              <input type="radio" name="acesso" checked={acesso === a.id} onChange={() => enviar({ t: 'config', acessoRede: a.id })} />
              <strong>{a.nome}</strong>
              <span>{a.txt}</span>
            </label>
          ))}
        </div>
        <p className="dica">Endereço deste Mac na rede: {(geral?.rede || []).map((r) => `${r.ip}:${geral?.porta}`).join(' · ') || 'sem rede'}. Para o QR de cada músico, use “Abrir no celular” na tela Retornos.</p>
      </section>
      <section className="secao">
        <h2>Mesa</h2>
        <div className="linha-info">
          <strong>{e.info?.nome || 'WING'}</strong>
          <span className="dica">{modelo.replace('wing-', 'WING ').replace('compact', 'Compact')} · {e.ip} · firmware {firmware.split('-')[0]}</span>
          <button onClick={() => { if (confirm('Desconectar da mesa? O Asa volta para a tela de conexão.')) enviar({ t: 'desconectar' }); }}>Trocar de mesa</button>
        </div>
        <div style={{ maxWidth: '24rem', marginTop: '0.75rem' }}>
          <CampoTexto caminho="/$syscfg/consolename" rotulo="Nome da mesa" />
        </div>
      </section>
      <section className="secao">
        <h2>Tela</h2>
        <div className="linha-info">
          <span>Tamanho</span>
          <button onClick={() => aplicarZoom(zoom - 0.1)}>Menor</button>
          <strong>{Math.round(zoom * 100)}%</strong>
          <button onClick={() => aplicarZoom(zoom + 0.1)}>Maior</button>
          <button className="link" onClick={() => aplicarZoom(1)}>Voltar a 100%</button>
        </div>
        <p className="dica">Atalhos: ⌘+ e ⌘− mudam o tamanho; ⌘1 a ⌘8 trocam de tela; M e S fazem mute e solo no canal selecionado; ← e → mudam de canal.</p>
        <label className="caixa"><input type="checkbox" checked={esconder} onChange={(ev) => mudarUi({ esconderVazios: ev.target.checked })} /> Esconder canais vazios nos retornos e no roteamento</label>
      </section>
      <section className="secao">
        <h2>Sobre</h2>
        <p className="dica">Asa, controle da Behringer WING para Mac. Funciona sem internet. Esquema de parâmetros do libwing (Apache-2.0).</p>
      </section>
    </div>
  );
}
