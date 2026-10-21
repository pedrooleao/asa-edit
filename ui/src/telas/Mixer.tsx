// Tela Mixer: camadas em abas, tiras que esticam na largura, main fixo a
// direita, grupos (mute groups e DCAs) na lateral e o painel do canal embaixo.

import { useMemo, useRef, useState } from 'react';
import { definir, useGeral, useNumero, useValor } from '../store';
import { mudarUi, selecionar, useUi } from '../ui';
import { corWing, lista, nomeDaTira, type TipoTira } from '../util';
import { Tira } from '../comp/Tira';
import { Icone } from '../comp/Icones';
import { PainelCanal } from './PainelCanal';
import { EditorCamada } from './Camadas';

export type DefCamada = { id: string; nome: string; tiras: string[]; atalhos?: { nome: string; alvo: string }[] };

export function camadasFixas(): DefCamada[] {
  return [
    { id: 'ch', nome: 'Canais', tiras: lista('ch'), atalhos: [{ nome: '1–16', alvo: '/ch/1' }, { nome: '17–32', alvo: '/ch/17' }, { nome: '33–40', alvo: '/ch/33' }] },
    { id: 'aux', nome: 'Aux', tiras: lista('aux') },
    { id: 'bus', nome: 'Buses', tiras: lista('bus') },
    { id: 'saidas', nome: 'Mains e matrizes', tiras: [...lista('main'), ...lista('mtx')] },
    { id: 'dca', nome: 'DCA', tiras: lista('dca') },
  ];
}

export function useCamadas(): DefCamada[] {
  const { geral } = useGeral();
  const pessoais = geral?.config.camadas || [];
  return useMemo(() => [
    ...camadasFixas(),
    ...pessoais.map((c, i) => ({ id: `u:${i}`, nome: c.nome, tiras: c.tiras })),
  ], [pessoais]);
}

export function useCamadaAtual() {
  const camadas = useCamadas();
  const id = useUi('camada');
  return camadas.find((c) => c.id === id) || camadas[0];
}

function MainFixo() {
  const main = useUi('mainFixo');
  const nomes = [1, 2, 3, 4].map((m) => nomeDaTira(`/main/${m}`, useValor(`/main/${m}/name`)));
  return (
    <div className="main-fixo">
      <select aria-label="Main fixo" value={main} onChange={(ev) => mudarUi({ mainFixo: ev.target.value })}>
        {nomes.map((n, i) => <option key={i} value={`/main/${i + 1}`}>{n}</option>)}
      </select>
      <Tira prefixo={main} larga />
    </div>
  );
}

function BotaoGrupo({ prefixo, rotulo }: { prefixo: string; rotulo: string }) {
  const mute = useNumero(`${prefixo}/mute`);
  const nome = String(useValor(`${prefixo}/name`) || '');
  const col = useValor(prefixo.startsWith('/dca') ? `${prefixo}/col` : null);
  const cor = prefixo.startsWith('/dca') ? corWing(col) : undefined;
  const vazio = !nome || /^MGRP\.\d+$/.test(nome);
  return (
    <button
      className={`grupo-botao ${mute ? 'ligado' : ''} ${vazio ? 'vazio' : ''}`}
      aria-pressed={!!mute}
      onClick={() => definir(`${prefixo}/mute`, mute ? 0 : 1)}
      onDoubleClick={() => { if (prefixo.startsWith('/dca')) selecionar(prefixo, true); }}
      title={`${mute ? 'Desmutar' : 'Mutar'} ${vazio ? rotulo : nome}`}
      style={cor ? ({ '--cor': cor } as React.CSSProperties) : undefined}
    >
      <span className="grupo-num">{rotulo}</span>
      <span className="grupo-nome">{vazio ? '' : nome}</span>
    </button>
  );
}

function Lateral() {
  const aberta = useUi('lateralAberta');
  if (!aberta) return null;
  return (
    <aside className="lateral-grupos" aria-label="Mute groups e DCAs">
      <h3>Mute groups</h3>
      <div className="grupos">
        {Array.from({ length: 8 }, (_, i) => <BotaoGrupo key={i} prefixo={`/mgrp/${i + 1}`} rotulo={`${i + 1}`} />)}
      </div>
      <h3>DCAs</h3>
      <div className="grupos dcas">
        {Array.from({ length: 16 }, (_, i) => <BotaoGrupo key={i} prefixo={`/dca/${i + 1}`} rotulo={`D${i + 1}`} />)}
      </div>
    </aside>
  );
}

export function Mixer() {
  const camadas = useCamadas();
  const camada = useCamadaAtual();
  const painelAberto = useUi('painelAberto');
  const lateral = useUi('lateralAberta');
  const area = useRef<HTMLDivElement>(null);
  const { geral } = useGeral();
  const [editor, setEditor] = useState<{ i: number | null } | null>(null);
  const indicePessoal = camada.id.startsWith('u:') ? Number(camada.id.slice(2)) : null;

  function irPara(alvo: string) {
    const el = area.current?.querySelector(`[data-tira="${alvo}"]`) as HTMLElement | null;
    if (el && area.current) area.current.scrollTo({ left: el.offsetLeft - area.current.offsetLeft, behavior: 'smooth' });
  }

  return (
    <div className="mixer">
      <div className="camadas">
        <nav className="abas-camada" role="tablist" aria-label="Camadas">
          {camadas.map((c) => (
            <button key={c.id} role="tab" aria-selected={camada.id === c.id} className={camada.id === c.id ? 'ativa' : ''} onClick={() => { mudarUi({ camada: c.id }); area.current?.scrollTo({ left: 0 }); }}>
              {c.nome}
            </button>
          ))}
          <button className="icone-so" title="Nova camada" aria-label="Nova camada" onClick={() => setEditor({ i: null })}><Icone nome="mais" tamanho={1} /></button>
        </nav>
        <div className="atalhos">
          {camada.atalhos?.map((a) => <button key={a.alvo} onClick={() => irPara(a.alvo)}>{a.nome}</button>)}
          {indicePessoal !== null && <button className="com-icone" onClick={() => setEditor({ i: indicePessoal })}><Icone nome="editar" tamanho={1} />Editar camada</button>}
          <button className={`icone-so ${painelAberto ? 'ativo' : ''}`} title={painelAberto ? 'Esconder painel do canal' : 'Mostrar painel do canal'} aria-pressed={painelAberto} onClick={() => mudarUi({ painelAberto: !painelAberto })}><Icone nome="painel" /></button>
          <button className={`icone-so ${lateral ? 'ativo' : ''}`} title={lateral ? 'Esconder grupos' : 'Mostrar mute groups e DCAs'} aria-pressed={lateral} onClick={() => mudarUi({ lateralAberta: !lateral })}><Icone nome="lateral" /></button>
        </div>
      </div>
      <div className="mixer-meio">
        <div className="tiras" ref={area}>
          {camada.tiras.map((t) => <Tira key={t} prefixo={t} />)}
          {!camada.tiras.length && <p className="vazio-camada">Camada vazia. Monte em Biblioteca → Camadas.</p>}
        </div>
        <MainFixo />
        <Lateral />
      </div>
      {painelAberto && <PainelCanal />}
      {editor && (
        <EditorCamada
          inicial={editor.i === null ? { nome: '', tiras: [] } : (geral?.config.camadas || [])[editor.i] || { nome: '', tiras: [] }}
          indice={editor.i}
          fechar={() => setEditor(null)}
        />
      )}
    </div>
  );
}

export type { TipoTira };
