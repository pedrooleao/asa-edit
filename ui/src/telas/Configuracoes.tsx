// Ajustes: acesso pela rede (celulares), a mesa conectada e preferencias.

import { useState } from 'react';
import { enviar, sairComoTecnico, useGeral, useTexto } from '../store';
import { aplicarZoom, mudarUi, useUi } from '../ui';
import { CampoTexto } from '../comp/Parametro';
import { confirmar } from '../comp/Confirmar';

const ACESSOS = [
  { id: 'retorno', nome: 'Só retornos', txt: 'Celulares na rede abrem só a mix escolhida. Aparelhos do técnico controlam tudo (recomendado no culto).' },
  { id: 'completo', nome: 'Completo', txt: 'Qualquer aparelho na rede controla a mesa inteira, sem senha. Use só em rede confiável.' },
  { id: 'desligado', nome: 'Desligado', txt: 'Celulares não entram. Só este aparelho e os do técnico controlam a mesa.' },
] as const;

const quando = (t: number) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Senha do tecnico e os aparelhos que entraram com ela. */
function AparelhosDoTecnico() {
  const { geral, papel } = useGeral();
  const temSenha = !!geral?.config.temSenha;
  const aparelhos = geral?.config.aparelhos || [];
  const [trocando, setTrocando] = useState(false);
  const [senha, setSenha] = useState('');
  const [salva, setSalva] = useState(false);
  const mostrarCampo = !temSenha || trocando;
  return (
    <section className="secao">
      <h2>Aparelhos do técnico</h2>
      <p className="dica">Um iPad ou celular com a senha do técnico controla a mesa toda pela rede, enquanto os músicos continuam só com a mix deles. No aparelho, abra o endereço do Asa e toque em “Sou o técnico”.</p>
      {papel?.aparelho && (
        <div className="linha-info aviso-aparelho">
          <span>Este aparelho é do técnico.</span>
          <button onClick={async () => { if (await confirmar('Este aparelho volta a abrir só os retornos. Para voltar, entre de novo com a senha.', { sim: 'Sair' })) sairComoTecnico(); }}>Sair deste aparelho</button>
        </div>
      )}
      {mostrarCampo ? (
        <form
          className="linha-info form-senha"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (senha.trim().length < 4) return;
            enviar({ t: 'senhaTecnico', senha: senha.trim() });
            setSenha(''); setTrocando(false); setSalva(true);
          }}
        >
          <label className="param texto">
            <span className="param-nome">{temSenha ? 'Senha nova' : 'Senha do técnico'}</span>
            <input type="password" autoComplete="new-password" value={senha} minLength={4} maxLength={32} onChange={(ev) => setSenha(ev.target.value)} onKeyDown={(ev) => ev.stopPropagation()} />
          </label>
          <button type="submit" className="primario" disabled={senha.trim().length < 4}>Salvar senha</button>
          {trocando && <button type="button" onClick={() => { setTrocando(false); setSenha(''); }}>Cancelar</button>}
          <span className="dica">Pelo menos 4 caracteres.</span>
        </form>
      ) : (
        <div className="linha-info">
          <span>{salva ? 'Senha salva.' : 'Senha definida.'}</span>
          <button onClick={() => { setTrocando(true); setSalva(false); }}>Trocar senha</button>
          <span className="dica">Trocar a senha não tira o acesso de quem já entrou.</span>
        </div>
      )}
      {aparelhos.length > 0 && (
        <ul className="lista-aparelhos">
          {aparelhos.map((a) => (
            <li key={a.id}>
              <strong>{a.nome}{a.id === papel?.aparelho ? ' (este)' : ''}</strong>
              <span className="dica">autorizado em {quando(a.criado)} · último acesso {quando(a.visto)}</span>
              <button onClick={async () => { if (await confirmar(`Tirar o acesso do ${a.nome}? Ele volta a abrir só os retornos.`, { sim: 'Tirar acesso', perigo: true })) enviar({ t: 'tirarAparelho', id: a.id }); }}>Tirar acesso</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

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
        <p className="dica">Endereço do Asa na rede: {(geral?.rede || []).map((r) => `${r.ip}:${geral?.porta}`).join(' · ') || 'sem rede'}. Para o QR de cada músico, use “Abrir no celular” na tela Retornos.</p>
      </section>
      <AparelhosDoTecnico />
      <section className="secao">
        <h2>Mesa</h2>
        <div className="linha-info">
          <strong>{e.info?.nome || 'WING'}</strong>
          <span className="dica">{modelo.replace('wing-', 'WING ').replace('compact', 'Compact')} · {e.ip} · firmware {firmware.split('-')[0]}</span>
          <button onClick={async () => { if (await confirmar('Desconectar da mesa? O Asa Edit volta para a tela de conexão.', { sim: 'Desconectar' })) enviar({ t: 'desconectar' }); }}>Trocar de mesa</button>
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
        <p className="dica">Asa Edit, controle da Behringer WING para Mac, Android e navegador. Funciona sem internet. Esquema de parâmetros do libwing (Apache-2.0).</p>
      </section>
    </div>
  );
}
