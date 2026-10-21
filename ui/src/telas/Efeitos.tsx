// Tela Efeitos: os 16 FX da WING num rack. Cada FX mostra o modelo e onde
// esta inserido (ex.: "FX Rev Voz, insert 2"), que e' como a WING faz o
// retorno de efeito: o FX vai como insert num bus, e o bus volta para o PA.

import { useMemo, useRef, useState } from 'react';
import { def, definir, folhasDe, useTexto, useValor, useValores } from '../store';
import { mudarUi } from '../ui';
import { corWing, lista, limitar, nomeDaTira, numero } from '../util';
import { Deslizante, GradeDoModelo } from '../comp/Parametro';

const CATEGORIAS: { nome: string; modelos: string[] }[] = [
  { nome: 'Reverbs', modelos: ['HALL', 'ROOM', 'CHAMBER', 'PLATE', 'CONCERT', 'AMBI', 'V-ROOM', 'V-REV', 'V-PLATE', 'BPLATE', 'VSS3', 'SHIMMER', 'SPRING', 'GATED', 'REVERSE', 'DEL/REV'] },
  { nome: 'Delays', modelos: ['ST-DL', 'TAP-DL', 'TAPE-DL', 'OILCAN', 'BBD-DL'] },
  { nome: 'EQ e dinâmica', modelos: ['GEQ', 'PIA', 'LIMITER', 'DE-S2', 'DEQ3', 'C5-CMB', 'SOUL', 'E88', 'E84', 'F110', 'PULSAR', 'MACH4', '*EVEN*', '*SOUL*', '*VINTAGE*', '*BUS*', '*MASTER*'] },
  { nome: 'Modulação', modelos: ['CHORUS', 'FLANGER', 'PHASER', 'DIMCRS', 'ROTARY', 'PANNER', 'MOOD'] },
  { nome: 'Voz e afinação', modelos: ['DOUBLE', 'PCORR', 'PITCH', 'D-PITCH', 'SUB'] },
  { nome: 'Outros', modelos: ['ENHANCE', 'EXCITER', 'P-BASS', 'SUB-M', 'TAPE', 'V-IMG', 'SPKMAN', 'BODY', 'RACKAMP', 'UKROCK', 'ANGEL', 'JAZZC', 'DELUXE', 'EXT'] },
];

export function nomeDoModelo(mdl: string) {
  const it = def('/fx/1/mdl')?.itens?.find((i) => i[0] === mdl);
  if (!it || mdl === 'NONE') return 'Vazio';
  const t = it[1] || mdl;
  return t.charAt(0) + t.slice(1).toLowerCase();
}

const TIRAS_COM_INSERT = [...lista('ch'), ...lista('aux'), ...lista('bus'), ...lista('main'), ...lista('mtx')];
const CAMINHOS_INSERT = TIRAS_COM_INSERT.flatMap((t) => [`${t}/preins/ins`, `${t}/postins/ins`, `${t}/preins/on`, `${t}/postins/on`]);

/** Onde cada FX esta inserido: { 1: [{tira:'/bus/13', slot:'postins', on:1}] } */
function useUsos() {
  const vals = useValores(CAMINHOS_INSERT);
  return useMemo(() => {
    const usos: Record<number, { tira: string; slot: 'preins' | 'postins'; on: boolean }[]> = {};
    TIRAS_COM_INSERT.forEach((t, i) => {
      (['preins', 'postins'] as const).forEach((slot, k) => {
        const ins = vals[i * 4 + k];
        const m = /^FX(\d+)$/.exec(String(ins || ''));
        if (!m) return;
        const n = Number(m[1]);
        (usos[n] ||= []).push({ tira: t, slot, on: !!vals[i * 4 + 2 + k] });
      });
    });
    return usos;
  }, [vals]);
}

function CartaoFx({ n, sel, usos, aoClicar }: { n: number; sel: boolean; usos: { tira: string; slot: string; on: boolean }[]; aoClicar: () => void }) {
  const mdl = useTexto(`/fx/${n}/mdl`, 'NONE');
  const mix = useValor(`/fx/${n}/fxmix`);
  const primeiro = usos[0]?.tira;
  const cor = corWing(useValor(primeiro ? `${primeiro}/col` : null));
  return (
    <button className={`cartao-fx ${sel ? 'sel' : ''} ${mdl === 'NONE' ? 'vazio' : ''}`} onClick={aoClicar} style={{ '--cor': primeiro ? cor : 'var(--linha)' } as React.CSSProperties} aria-pressed={sel}>
      <span className="fx-num">FX {n}</span>
      <strong>{nomeDoModelo(mdl)}</strong>
      <span className="fx-onde">
        {usos.length ? usos.map((u) => `${nomeDaTira(u.tira)}${u.on ? '' : ' (desligado)'}`).join(', ') : mdl === 'NONE' ? '' : 'Não está em nenhum canal'}
      </span>
      {mdl !== 'NONE' && typeof mix === 'number' && <span className="fx-mix">mix {Math.round(mix)}%</span>}
    </button>
  );
}

/** EQ grafico (GEQ/PIA): uma barra vertical por banda. */
function EqGrafica({ caminhos }: { caminhos: string[] }) {
  const vals = useValores(caminhos);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const arrasto = (i: number, ev: React.PointerEvent) => {
    const el = refs.current[i]!;
    const d = def(caminhos[i])!;
    el.setPointerCapture(ev.pointerId);
    const mover = (y: number) => {
      const r = el.getBoundingClientRect();
      const p = 1 - limitar((y - r.top) / r.height, 0, 1);
      definir(caminhos[i], Math.round(((d.min ?? -15) + p * ((d.max ?? 15) - (d.min ?? -15))) * 2) / 2);
    };
    mover(ev.clientY);
    const mv = (e: PointerEvent) => mover(e.clientY);
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
  };
  return (
    <div className="geq" role="group" aria-label="EQ gráfico">
      {caminhos.map((c, i) => {
        const d = def(c)!;
        const v = typeof vals[i] === 'number' ? (vals[i] as number) : 0;
        const min = d.min ?? -15;
        const max = d.max ?? 15;
        const p = (v - min) / (max - min);
        const zero = (0 - min) / (max - min);
        const rot = c.split('/').pop()!;
        return (
          <div key={c} className="geq-banda">
            <div
              className="geq-trilho"
              ref={(el) => { refs.current[i] = el; }}
              onPointerDown={(e) => arrasto(i, e)}
              onDoubleClick={() => definir(c, 0)}
              role="slider"
              tabIndex={0}
              aria-label={`${rot} Hz`}
              aria-valuenow={v}
              onKeyDown={(e) => { if (e.key === 'ArrowUp') definir(c, Math.min(max, v + 0.5)); if (e.key === 'ArrowDown') definir(c, Math.max(min, v - 0.5)); }}
              title={`${rot}: ${numero(v)} dB`}
            >
              <div className="geq-barra" style={{ bottom: `${Math.min(p, zero) * 100}%`, height: `${Math.abs(p - zero) * 100}%` }} />
              <div className="geq-zero" style={{ bottom: `${zero * 100}%` }} />
            </div>
            <span>{rot}</span>
          </div>
        );
      })}
    </div>
  );
}

function DetalheFx({ n, usos }: { n: number; usos: { tira: string; slot: 'preins' | 'postins'; on: boolean }[] }) {
  const base = `/fx/${n}`;
  const mdl = useTexto(`${base}/mdl`, 'NONE');
  const [alvo, setAlvo] = useState('');
  const [slot, setSlot] = useState<'preins' | 'postins'>('postins');
  const params = mdl === 'NONE' ? [] : folhasDe(`${base}/${mdl}`).map((d) => d.caminho).filter((c) => !c.includes('/$'));
  const geq = mdl === 'GEQ' || mdl === 'PIA';
  const bandas = geq ? params.filter((c) => /\/\d+k?\d*$/.test(c)) : [];
  const resto = params.filter((c) => !bandas.includes(c));
  const todos = def(`${base}/mdl`)?.itens?.map((i) => String(i[0])) || [];
  const categorizados = new Set(CATEGORIAS.flatMap((c) => c.modelos));
  return (
    <section className="detalhe-fx">
      <header className="detalhe-cab">
        <h2>FX {n}</h2>
        <select
          aria-label="Modelo do efeito"
          value={mdl}
          onChange={(e) => {
            if (mdl !== 'NONE' && !confirm(`Trocar o FX ${n} para ${nomeDoModelo(e.target.value)}? Os ajustes atuais deste FX se perdem.`)) return;
            definir(`${base}/mdl`, e.target.value);
          }}
        >
          <option value="NONE">Vazio</option>
          {CATEGORIAS.map((c) => (
            <optgroup key={c.nome} label={c.nome}>
              {c.modelos.filter((m) => todos.includes(m)).map((m) => <option key={m} value={m}>{nomeDoModelo(m)}</option>)}
            </optgroup>
          ))}
          {todos.filter((m) => m !== 'NONE' && !categorizados.has(m)).map((m) => <option key={m} value={m}>{nomeDoModelo(m)}</option>)}
        </select>
        {mdl !== 'NONE' && def(`${base}/fxmix`) && <div className="mix-fx"><Deslizante caminho={`${base}/fxmix`} rotulo="Mix" /></div>}
      </header>
      <div className="onde-fx">
        <h3>Onde está</h3>
        {usos.length ? (
          <ul>
            {usos.map((u) => (
              <li key={u.tira + u.slot}>
                <button className="link" onClick={() => mudarUi({ tela: 'mixer', selecionado: u.tira, painelAberto: true, aba: 'inserts' })}>
                  {nomeDaTira(u.tira)}
                </button>
                <span className="dica"> · {u.slot === 'preins' ? 'insert 1' : 'insert 2'}{u.on ? '' : ' · desligado'}</span>
                <button className="link" onClick={() => definir(`${u.tira}/${u.slot}/ins`, 'NONE')}>Tirar</button>
              </li>
            ))}
          </ul>
        ) : <p className="dica">Este FX não está inserido em nenhum canal ou bus, então não soa.</p>}
        <div className="linha-info usar-em">
          <span>Usar em</span>
          <select aria-label="Tira" value={alvo} onChange={(e) => setAlvo(e.target.value)}>
            <option value="">escolha…</option>
            {(['bus', 'ch', 'aux', 'main', 'mtx'] as const).map((t) => (
              <optgroup key={t} label={{ ch: 'Canais', aux: 'Aux', bus: 'Buses', main: 'Mains', mtx: 'Matrizes' }[t]}>
                {lista(t).map((p) => <option key={p} value={p}>{nomeDaTira(p)}</option>)}
              </optgroup>
            ))}
          </select>
          <select aria-label="Posição" value={slot} onChange={(e) => setSlot(e.target.value as 'preins' | 'postins')}>
            <option value="preins">insert 1</option>
            <option value="postins">insert 2</option>
          </select>
          <button disabled={!alvo || mdl === 'NONE'} onClick={() => { definir(`${alvo}/${slot}/ins`, `FX${n}`); definir(`${alvo}/${slot}/on`, 1); setAlvo(''); }}>Inserir</button>
        </div>
        <p className="dica">Para um retorno de efeito: crie um bus (ex.: “FX Rev Voz”), ponha este FX como insert dele e mande os canais para o bus pelos envios.</p>
      </div>
      {geq && bandas.length > 0 && <EqGrafica caminhos={bandas} />}
      {mdl !== 'NONE' && <GradeDoModelo caminhos={resto} />}
    </section>
  );
}

export function Efeitos() {
  const [sel, setSel] = useState(1);
  const usos = useUsos();
  return (
    <div className="efeitos">
      <div className="rack" role="list">
        {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
          <CartaoFx key={n} n={n} sel={sel === n} usos={usos[n] || []} aoClicar={() => setSel(n)} />
        ))}
      </div>
      <DetalheFx n={sel} usos={usos[sel] || []} />
    </div>
  );
}


