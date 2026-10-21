// Tira de canal generica: serve para canal, aux, bus, main, matriz e DCA.
// De cima para baixo: cor e nome, fonte e ganho, pan, mute/solo, fader com
// medidor, valor em dB, numero e os pontinhos de DCA/mute group.

import { memo, useState } from 'react';
import { definir, indiceMedidor, useNumero, useTexto, useValor } from '../store';
import { selecionar, useUi } from '../ui';
import { caminhoFonte, corWing, FADER_MIN, lerTags, nomeDaTira, numeroCurto, partesDaTira, textoDb, textoFonte } from '../util';
import { Fader } from './Fader';
import { Medidor, MedidorReducao } from './Medidor';

export function indicesMedidor(prefixo: string, estereo: boolean) {
  const { tipo, n } = partesDaTira(prefixo);
  if (tipo === 'dca') return [indiceMedidor('dca', n, 2), indiceMedidor('dca', n, 3)];
  // Canais e aux: entrada (mostra sinal mesmo com o fader embaixo, bom para o
  // ganho). Buses, mains e matrizes: saida, depois do fader.
  const palavra = tipo === 'ch' || tipo === 'aux' ? 0 : 2;
  const e = indiceMedidor(tipo, n, palavra);
  return estereo ? [e, e + 1] : [e];
}

export function NomeEditavel({ prefixo, className }: { prefixo: string; className?: string }) {
  const nome = useTexto(`${prefixo}/name`);
  const [editando, setEditando] = useState(false);
  if (editando) {
    return (
      <input
        className={`tira-nome-campo ${className || ''}`}
        autoFocus
        defaultValue={nome}
        maxLength={16}
        onBlur={(ev) => { definir(`${prefixo}/name`, ev.target.value.slice(0, 16)); setEditando(false); }}
        onKeyDown={(ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
          if (ev.key === 'Escape') setEditando(false);
        }}
        onClick={(ev) => ev.stopPropagation()}
      />
    );
  }
  return (
    <span className={`tira-nome ${nome ? '' : 'vazio'} ${className || ''}`} onDoubleClick={() => setEditando(true)} title="Duplo clique para renomear">
      {nomeDaTira(prefixo, nome)}
    </span>
  );
}

function Fonte({ prefixo }: { prefixo: string }) {
  const grp = useValor(`${prefixo}/in/conn/grp`);
  const n = useValor(`${prefixo}/in/conn/in`);
  const fonte = caminhoFonte(grp, n);
  const ganho = useValor(fonte ? `${fonte}/g` : null);
  const ph = useValor(fonte ? `${fonte}/vph` : null);
  return (
    <button className="tira-fonte" onClick={() => selecionar(prefixo, true)} title="Fonte e ganho (abre o painel do canal)">
      <span>{textoFonte(grp, n)}</span>
      {typeof ganho === 'number' && <span className="ganho">{ganho > 0 ? '+' : ''}{Math.round(ganho * 2) / 2} dB</span>}
      {!!ph && <span className="ph" title="48V ligado">48V</span>}
    </button>
  );
}

function PanMini({ prefixo }: { prefixo: string }) {
  const pan = useNumero(`${prefixo}/pan`, 0);
  // Arrastar na horizontal; duplo clique centraliza.
  return (
    <div
      className="pan-mini"
      role="slider"
      tabIndex={-1}
      aria-label="Pan"
      aria-valuenow={pan}
      title={pan === 0 ? 'Pan no centro' : `Pan ${pan < 0 ? 'E' : 'D'} ${Math.abs(Math.round(pan))}`}
      onPointerDown={(ev) => {
        const el = ev.currentTarget;
        el.setPointerCapture(ev.pointerId);
        const r = el.getBoundingClientRect();
        const x0 = ev.clientX;
        const p0 = pan;
        const mover = (e: PointerEvent) => definir(`${prefixo}/pan`, Math.round(Math.max(-100, Math.min(100, p0 + ((e.clientX - x0) / r.width) * 200))));
        const soltar = () => { el.removeEventListener('pointermove', mover); el.removeEventListener('pointerup', soltar); };
        el.addEventListener('pointermove', mover);
        el.addEventListener('pointerup', soltar);
      }}
      onDoubleClick={() => definir(`${prefixo}/pan`, 0)}
    >
      <div className="pan-centro" />
      <div className="pan-marca" style={{ left: `${(pan + 100) / 2}%` }} />
    </div>
  );
}

function Pontinhos({ prefixo }: { prefixo: string }) {
  const tags = useValor(`${prefixo}/tags`);
  const { dcas, mgrps } = lerTags(tags);
  if (!dcas.length && !mgrps.length) return <div className="pontinhos" />;
  return (
    <div className="pontinhos" title={[dcas.length ? `DCA ${dcas.join(', ')}` : '', mgrps.length ? `Mute group ${mgrps.join(', ')}` : ''].filter(Boolean).join(' · ')}>
      {dcas.map((d) => <span key={`d${d}`} className="pt dca">D{d}</span>)}
      {mgrps.map((m) => <span key={`m${m}`} className="pt mg">M{m}</span>)}
    </div>
  );
}

function ValorDb({ caminho }: { caminho: string }) {
  const db = useNumero(caminho, FADER_MIN);
  return <span className="tira-db">{textoDb(db)}</span>;
}

type Props = { prefixo: string; larga?: boolean };

export const Tira = memo(function Tira({ prefixo, larga = false }: Props) {
  const { tipo, n } = partesDaTira(prefixo);
  const sel = useUi('selecionado') === prefixo;
  const cor = corWing(useValor(`${prefixo}/col`));
  const mute = useNumero(`${prefixo}/mute`);
  const muteEf = useNumero(`${prefixo}/$mute`);
  const solo = useNumero(`${prefixo}/$solo`);
  const modo = useValor(tipo === 'ch' || tipo === 'aux' ? `${prefixo}/in/set/$mode` : null);
  const mono = useValor(tipo === 'bus' || tipo === 'main' || tipo === 'mtx' ? `${prefixo}/busmono` : null);
  const estereo = tipo === 'ch' || tipo === 'aux' ? modo === 'ST' || modo === 'M/S' : tipo !== 'dca' && !mono;
  const temFonte = tipo === 'ch' || tipo === 'aux';
  const temPan = tipo !== 'dca';
  const nome = nomeDaTira(prefixo, useValor(`${prefixo}/name`));
  const mutadoPorGrupo = !mute && muteEf > 0;

  return (
    <div
      className={`tira tipo-${tipo} ${sel ? 'sel' : ''} ${mute ? 'mutada' : ''} ${larga ? 'larga' : ''}`}
      style={{ '--cor': cor } as React.CSSProperties}
      onPointerDown={() => { if (!sel) selecionar(prefixo); }}
      data-tira={prefixo}
    >
      <div className="tira-cor" />
      <div className="tira-topo">
        <NomeEditavel prefixo={prefixo} />
      </div>
      {temFonte ? <Fonte prefixo={prefixo} /> : <div className="tira-fonte vazia" />}
      {temPan ? <PanMini prefixo={prefixo} /> : <div className="pan-mini vazio" />}
      <div className="tira-botoes">
        <button
          className={`botao-liga mute ${mute ? 'ligado' : ''} ${mutadoPorGrupo ? 'grupo' : ''}`}
          aria-pressed={!!mute}
          aria-label={`Mute ${nome}`}
          title={mutadoPorGrupo ? 'Mutado por DCA ou mute group' : 'Mute (M)'}
          onClick={() => definir(`${prefixo}/mute`, mute ? 0 : 1)}
        >M</button>
        <button
          className={`botao-liga solo ${solo ? 'ligado' : ''}`}
          aria-pressed={!!solo}
          aria-label={`Solo ${nome}`}
          title="Solo (S)"
          onClick={() => definir(`${prefixo}/$solo`, solo ? 0 : 1)}
        >S</button>
      </div>
      <div className="tira-meio">
        <Fader caminho={`${prefixo}/fdr`} rotulo={`Fader ${nome}`} />
        <Medidor indices={indicesMedidor(prefixo, estereo)} />
        {tipo === 'ch' && <MedidorReducao indice={indiceMedidor('ch', n, 7)} className="gr" />}
      </div>
      <ValorDb caminho={`${prefixo}/fdr`} />
      <div className="tira-pe">
        <span className="tira-num">{numeroCurto(prefixo)}</span>
        {(tipo === 'ch' || tipo === 'aux') && <Pontinhos prefixo={prefixo} />}
      </div>
    </div>
  );
});
