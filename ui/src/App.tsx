// Estrutura do app: barra lateral com as telas, barra de cima com a mesa, o
// canal selecionado, "Limpar solos" e zoom. Se a conexao cair no meio do culto,
// a tela continua aberta (em cinza) com o aviso "Reconectando…".

import { useEffect, useMemo, useState } from 'react';
import { definir, enviar, useEsquemaPronto, useGeral, useValor, useValores, valor } from './store';
import { aplicarZoom, lerUi, mudarUi, selecionar, useUi, type Tela } from './ui';
import { corWing, lista, nomeDaTira, NOME_TIPO, partesDaTira } from './util';
import { Icone } from './comp/Icones';
import { Mixer, useCamadaAtual } from './telas/Mixer';
import { Retornos } from './telas/Retornos';
import { Celular } from './telas/Celular';
import { Roteamento } from './telas/Roteamento';
import { Efeitos } from './telas/Efeitos';
import { Medidores } from './telas/Medidores';
import { Monitor } from './telas/Monitor';
import { Biblioteca } from './telas/Biblioteca';
import { Configuracoes } from './telas/Configuracoes';
import { Conexao } from './telas/Conexao';

const TELAS: { id: Tela; nome: string; icone: string }[] = [
  { id: 'mixer', nome: 'Mixer', icone: 'mixer' },
  { id: 'retornos', nome: 'Retornos', icone: 'retornos' },
  { id: 'roteamento', nome: 'Roteamento', icone: 'roteamento' },
  { id: 'efeitos', nome: 'Efeitos', icone: 'efeitos' },
  { id: 'medidores', nome: 'Medidores', icone: 'medidores' },
  { id: 'monitor', nome: 'Monitor', icone: 'monitor' },
  { id: 'biblioteca', nome: 'Biblioteca', icone: 'biblioteca' },
  { id: 'config', nome: 'Ajustes', icone: 'config' },
];

export function App() {
  const { geral, papel, progresso, ligadoAoApp } = useGeral();
  const esquema = useEsquemaPronto();
  const [jaConectou, setJaConectou] = useState(false);
  const estado = geral?.estado.estado;
  useEffect(() => { if (estado === 'conectado') setJaConectou(true); }, [estado]);

  if (!esquema || (!geral && ligadoAoApp)) return <div className="vazio">Abrindo o Asa…</div>;
  if (!geral) return <div className="vazio">Procurando o Asa no Mac…</div>;
  if (papel?.papel === 'retorno') return <Celular />;
  // Antes da primeira conexao: tela de conexao. Depois, se cair, a mesma tela
  // de trabalho continua, com o aviso por cima (ver Principal).
  if (estado !== 'conectado' && !jaConectou) return <Conexao progresso={progresso} />;
  if (estado === 'desconectado' && !geral.config.ultimaMesa) return <Conexao progresso={progresso} />;
  return <Principal />;
}

function Principal() {
  const tela = useUi('tela');
  const { geral, progresso, ligadoAoApp } = useGeral();
  const e = geral!.estado;
  const offline = !ligadoAoApp || e.estado !== 'conectado';
  useAtalhos();
  return (
    <div className={`app ${offline ? 'offline' : ''}`}>
      <BarraLateral />
      <div className="app-direita">
        <BarraTopo />
        {offline && (
          <div className="aviso-conexao" role="status">
            <span className="girando" aria-hidden="true" />
            {!ligadoAoApp ? 'O Asa parou de responder. Tentando de novo…'
              : e.estado === 'sincronizando' ? `Reconectado. Lendo a mesa… ${Math.round(progresso * 100)}%`
              : `Reconectando à mesa${e.ip ? ` (${e.ip})` : ''}… Os controles voltam sozinhos.`}
            <button onClick={() => enviar({ t: 'desconectar' })}>Escolher outra mesa</button>
          </div>
        )}
        <main className="conteudo" {...((offline ? { inert: "" } : {}) as any)}>
          {tela === 'mixer' && <Mixer />}
          {tela === 'retornos' && <Retornos />}
          {tela === 'roteamento' && <Roteamento />}
          {tela === 'efeitos' && <Efeitos />}
          {tela === 'medidores' && <Medidores />}
          {tela === 'monitor' && <Monitor />}
          {tela === 'biblioteca' && <Biblioteca />}
          {tela === 'config' && <Configuracoes />}
        </main>
      </div>
    </div>
  );
}

function BarraLateral() {
  const tela = useUi('tela');
  return (
    <nav className="barra-lateral" aria-label="Telas">
      <div className="logo" aria-hidden="true">Asa</div>
      {TELAS.map((t, i) => (
        <button
          key={t.id}
          className={tela === t.id ? 'ativa' : ''}
          aria-current={tela === t.id ? 'page' : undefined}
          onClick={() => mudarUi({ tela: t.id })}
          title={`${t.nome} (⌘${i + 1})`}
        >
          <Icone nome={t.icone} />
          <span>{t.nome}</span>
        </button>
      ))}
    </nav>
  );
}

const TODOS_SOLOS = [...lista('ch'), ...lista('aux'), ...lista('bus'), ...lista('main'), ...lista('mtx'), ...lista('dca')].map((p) => `${p}/$solo`);

function BarraTopo() {
  const { geral } = useGeral();
  const e = geral!.estado;
  const sel = useUi('selecionado');
  const zoom = useUi('zoom');
  const nomeSel = nomeDaTira(sel, useValor(`${sel}/name`));
  const corSel = corWing(useValor(`${sel}/col`));
  const solos = useValores(TODOS_SOLOS);
  const qtdSolos = useMemo(() => solos.filter((v) => !!v).length, [solos]);
  const { tipo, n } = partesDaTira(sel);
  const nomeMesa = e.info?.nome || 'WING';
  const cor = e.estado === 'conectado' ? 'ok' : e.estado === 'sincronizando' ? 'meio' : 'ruim';
  return (
    <header className="barra-topo">
      <div className={`mesa ${cor}`} title={e.estado === 'conectado' ? `Conectado a ${e.ip}` : 'Sem conexão com a mesa'}>
        <span className="ponto" aria-hidden="true" />
        <span className="mesa-nome">{nomeMesa}</span>
        <span className="mesa-ip">{e.ip}</span>
      </div>
      <button className="canal-sel" style={{ '--cor': corSel } as React.CSSProperties} onClick={() => mudarUi({ tela: 'mixer', painelAberto: true })} title="Canal selecionado (abre o painel)">
        <span className="canal-cor" />
        <span className="canal-num">{NOME_TIPO[tipo]} {n}</span>
        <strong>{nomeSel}</strong>
      </button>
      <div className="topo-acoes">
        <button
          className={`limpar-solos ${qtdSolos ? 'ativo' : ''}`}
          disabled={!qtdSolos}
          onClick={() => TODOS_SOLOS.forEach((c) => { if (valor(c)) definir(c, 0); })}
          title="Tira o solo de todas as tiras"
        >
          {qtdSolos ? `Limpar solos (${qtdSolos})` : 'Sem solo'}
        </button>
        <div className="zoom" role="group" aria-label="Tamanho da tela">
          <button className="icone-so" onClick={() => aplicarZoom(zoom - 0.1)} aria-label="Diminuir"><Icone nome="menos" tamanho={1} /></button>
          <button className="zoom-valor" onClick={() => aplicarZoom(1)} title="Voltar ao tamanho normal">{Math.round(zoom * 100)}%</button>
          <button className="icone-so" onClick={() => aplicarZoom(zoom + 0.1)} aria-label="Aumentar"><Icone nome="mais" tamanho={1} /></button>
        </div>
      </div>
    </header>
  );
}

// Atalhos: M mute, S solo, ←/→ tira anterior/proxima, ⌘1..8 telas, ⌘+/⌘− zoom.
function useAtalhos() {
  const camada = useCamadaAtual();
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'SELECT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)) return;
      const cmd = ev.metaKey || ev.ctrlKey;
      if (cmd && /^[1-8]$/.test(ev.key)) {
        mudarUi({ tela: TELAS[Number(ev.key) - 1].id });
        ev.preventDefault();
        return;
      }
      if (cmd && (ev.key === '=' || ev.key === '+')) { aplicarZoom(lerUi().zoom + 0.1); ev.preventDefault(); return; }
      if (cmd && ev.key === '-') { aplicarZoom(lerUi().zoom - 0.1); ev.preventDefault(); return; }
      if (cmd && ev.key === '0') { aplicarZoom(1); ev.preventDefault(); return; }
      if (cmd || ev.altKey) return;
      const sel = lerUi().selecionado;
      if (ev.key === 'm' || ev.key === 'M') { definir(`${sel}/mute`, valor(`${sel}/mute`) ? 0 : 1); ev.preventDefault(); }
      else if (ev.key === 's' || ev.key === 'S') { definir(`${sel}/$solo`, valor(`${sel}/$solo`) ? 0 : 1); ev.preventDefault(); }
      else if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && lerUi().tela === 'mixer') {
        const l = camada.tiras;
        const i = l.indexOf(sel);
        const prox = l[Math.max(0, Math.min(l.length - 1, (i < 0 ? 0 : i) + (ev.key === 'ArrowRight' ? 1 : -1)))];
        if (prox) {
          selecionar(prox);
          document.querySelector(`[data-tira="${prox}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
        ev.preventDefault();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [camada]);
}
