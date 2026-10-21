// Grafico do EQ padrao da WING (modelo STD): a curva e' a soma das bandas
// (biquads RBJ) e dos filtros de lo cut / hi cut. Os pontos sao arrastaveis:
// x = frequencia (20 Hz a 20 kHz, log), y = ganho (±15 dB), rolagem = Q.

import { useEffect, useMemo, useRef, useState } from 'react';
import { def, definir, valor, useValores } from '../store';
import { limitar, textoHz } from '../util';

const FS = 48000;
const F_MIN = 20;
const F_MAX = 20000;
const G_MAX = 15;

export type Banda = { k: string; nome: string; cor: string };

const CORES_BANDA = ['#e5776b', '#e58a2e', '#e3c832', '#58cf7a', '#2bb3b3', '#6cc6e0', '#9466c9', '#d65aa0'];

/** Bandas que o EQ STD deste caminho tem (canal: L,1-4,H; bus: L,1-6,H). */
export function bandasDoEq(eq: string): Banda[] {
  const ks = ['l', '1', '2', '3', '4', '5', '6', 'h'].filter((k) => def(`${eq}/STD/${k}g`));
  return ks.map((k, i) => ({ k, nome: k === 'l' ? 'Grave' : k === 'h' ? 'Agudo' : `Banda ${k}`, cor: CORES_BANDA[i % CORES_BANDA.length] }));
}

type Coef = [number, number, number, number, number, number];

function pico(f: number, g: number, q: number): Coef {
  const A = Math.pow(10, g / 40);
  const w = (2 * Math.PI * f) / FS;
  const al = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  return [1 + al * A, -2 * c, 1 - al * A, 1 + al / A, -2 * c, 1 - al / A];
}
function prateleira(f: number, g: number, q: number, alta: boolean): Coef {
  const A = Math.pow(10, g / 40);
  const w = (2 * Math.PI * f) / FS;
  const c = Math.cos(w);
  const al = Math.sin(w) / (2 * q);
  const r = 2 * Math.sqrt(A) * al;
  if (!alta) {
    return [A * (A + 1 - (A - 1) * c + r), 2 * A * (A - 1 - (A + 1) * c), A * (A + 1 - (A - 1) * c - r), A + 1 + (A - 1) * c + r, -2 * (A - 1 + (A + 1) * c), A + 1 + (A - 1) * c - r];
  }
  return [A * (A + 1 + (A - 1) * c + r), -2 * A * (A - 1 + (A + 1) * c), A * (A + 1 + (A - 1) * c - r), A + 1 - (A - 1) * c + r, 2 * (A - 1 - (A + 1) * c), A + 1 - (A - 1) * c - r];
}
function magnitudeDb(co: Coef, f: number) {
  const w = (2 * Math.PI * f) / FS;
  const c1 = Math.cos(w);
  const c2 = Math.cos(2 * w);
  const [b0, b1, b2, a0, a1, a2] = co;
  const num = b0 * b0 + b1 * b1 + b2 * b2 + 2 * (b0 * b1 + b1 * b2) * c1 + 2 * b0 * b2 * c2;
  const den = a0 * a0 + a1 * a1 + a2 * a2 + 2 * (a0 * a1 + a1 * a2) * c1 + 2 * a0 * a2 * c2;
  return 10 * Math.log10(num / den);
}
/** Filtro Butterworth de ordem n (passa-alta ou passa-baixa), so a magnitude. */
function corteDb(f: number, fc: number, ordem: number, alta: boolean) {
  const r = alta ? fc / f : f / fc;
  return -10 * Math.log10(1 + Math.pow(r, 2 * ordem));
}

function ordemDoTipo(t: string) {
  const m = /(\d+)/.exec(t);
  if (t === 'CUT') return 2;
  return m ? Math.max(1, Math.round(parseInt(m[1], 10) / 6)) : 2;
}

type Props = { prefixo: string; mini?: boolean; aoClicar?: () => void; selecionada?: string; aoSelecionar?: (k: string) => void };

export function EqGrafico({ prefixo, mini = false, aoClicar, selecionada, aoSelecionar }: Props) {
  const eq = `${prefixo}/eq`;
  const bandas = useMemo(() => bandasDoEq(eq), [eq]);
  const temFiltro = !!def(`${prefixo}/flt/lc`);
  const caminhos = useMemo(() => {
    const l = [`${eq}/on`, `${eq}/mdl`];
    for (const b of bandas) l.push(`${eq}/STD/${b.k}g`, `${eq}/STD/${b.k}f`, `${eq}/STD/${b.k}q`, `${eq}/STD/${b.k}eq`);
    if (temFiltro) l.push(`${prefixo}/flt/lc`, `${prefixo}/flt/lcf`, `${prefixo}/flt/lcs`, `${prefixo}/flt/hc`, `${prefixo}/flt/hcf`, `${prefixo}/flt/hcs`);
    return l;
  }, [eq, bandas, prefixo, temFiltro]);
  const vals = useValores(caminhos);
  const ref = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 300, h: 120 });
  const arrasto = useRef<{ k: string } | null>(null);

  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setTam({ w: el.clientWidth || 300, h: el.clientHeight || 120 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ligado = !!vals[0];
  const ehStd = vals[1] === 'STD' || vals[1] === undefined;
  const ler = (c: string, p = 0) => { const v = vals[caminhos.indexOf(c)]; return typeof v === 'number' ? v : p; };
  const lerT = (c: string) => String(vals[caminhos.indexOf(c)] ?? '');

  const { w, h } = tam;
  const xDe = (f: number) => (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * w;
  const fDe = (x: number) => F_MIN * Math.pow(F_MAX / F_MIN, limitar(x / w, 0, 1));
  const yDe = (g: number) => h / 2 - (g / G_MAX) * (h / 2 - 6);
  const gDe = (y: number) => limitar(((h / 2 - y) / (h / 2 - 6)) * G_MAX, -G_MAX, G_MAX);

  // Curva: soma em dB de cada banda e dos filtros, em ~1 ponto a cada 3 px.
  const curva = useMemo(() => {
    const filtros: ((f: number) => number)[] = [];
    const cortes: ((f: number) => number)[] = [];
    if (ehStd) {
      for (const b of bandas) {
        const g = ler(`${eq}/STD/${b.k}g`);
        const f = ler(`${eq}/STD/${b.k}f`, 1000);
        const q = ler(`${eq}/STD/${b.k}q`, 1);
        const tipo = lerT(`${eq}/STD/${b.k}eq`) || 'PEQ';
        const ponta = b.k === 'l' || b.k === 'h';
        if (ponta && tipo !== 'PEQ' && tipo !== 'SHV') {
          const n = ordemDoTipo(tipo);
          filtros.push((x) => corteDb(x, f, n, b.k === 'l'));
        } else if (ponta && tipo === 'SHV') {
          const co = prateleira(f, g, q, b.k === 'h');
          filtros.push((x) => magnitudeDb(co, x));
        } else if (g !== 0) {
          const co = pico(f, g, q);
          filtros.push((x) => magnitudeDb(co, x));
        }
      }
    }
    if (temFiltro && ler(`${prefixo}/flt/lc`)) {
      const n = ordemDoTipo(lerT(`${prefixo}/flt/lcs`) || '12');
      const fc = ler(`${prefixo}/flt/lcf`, 80);
      cortes.push((x) => corteDb(x, fc, n, true));
    }
    if (temFiltro && ler(`${prefixo}/flt/hc`)) {
      const n = ordemDoTipo(lerT(`${prefixo}/flt/hcs`) || '12');
      const fc = ler(`${prefixo}/flt/hcf`, 10000);
      cortes.push((x) => corteDb(x, fc, n, false));
    }
    const pts: string[] = [];
    const passo = Math.max(2, Math.round(w / 200));
    for (let x = 0; x <= w; x += passo) {
      const f = fDe(x);
      let g = 0;
      if (ligado) for (const fn of filtros) g += fn(f);
      for (const fn of cortes) g += fn(f);
      pts.push(`${x.toFixed(1)},${yDe(limitar(g, -G_MAX - 3, G_MAX + 3)).toFixed(1)}`);
    }
    return pts.join(' ');
  }, [vals, w, h, ehStd]);

  function pontoMaisPerto(x: number, y: number) {
    let melhor: string | null = null;
    let dist = Infinity;
    for (const b of bandas) {
      const px = xDe(ler(`${eq}/STD/${b.k}f`, 1000));
      const py = yDe(ler(`${eq}/STD/${b.k}g`));
      const d = Math.hypot(px - x, py - y);
      if (d < dist) { dist = d; melhor = b.k; }
    }
    return dist < 28 ? melhor : null;
  }

  function apertar(ev: React.PointerEvent) {
    if (mini) { aoClicar?.(); return; }
    if (!ehStd) return;
    const r = ref.current!.getBoundingClientRect();
    const k = pontoMaisPerto(ev.clientX - r.left, ev.clientY - r.top);
    if (!k) return;
    aoSelecionar?.(k);
    arrasto.current = { k };
    ref.current!.setPointerCapture(ev.pointerId);
  }
  function mover(ev: React.PointerEvent) {
    const a = arrasto.current;
    if (!a) return;
    const r = ref.current!.getBoundingClientRect();
    const f = fDe(ev.clientX - r.left);
    definir(`${eq}/STD/${a.k}f`, Math.round(f * 10) / 10);
    const tipo = lerT(`${eq}/STD/${a.k}eq`);
    if (!((a.k === 'l' || a.k === 'h') && tipo && tipo !== 'PEQ' && tipo !== 'SHV')) {
      definir(`${eq}/STD/${a.k}g`, Math.round(gDe(ev.clientY - r.top) * 2) / 2);
    }
    if (!ligado) definir(`${eq}/on`, 1);
  }

  useEffect(() => {
    const el = ref.current!;
    if (mini) return;
    const roda = (ev: WheelEvent) => {
      if (!ehStd) return;
      const r = el.getBoundingClientRect();
      const k = pontoMaisPerto(ev.clientX - r.left, ev.clientY - r.top) || selecionada;
      if (!k) return;
      ev.preventDefault();
      const c = `${eq}/STD/${k}q`;
      const q = Number(valor(c) ?? 1);
      definir(c, limitar(q * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), 0.44, 10));
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  });

  const linhasF = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  return (
    <div
      ref={ref}
      className={`eq-grafico ${mini ? 'mini' : ''} ${ligado ? '' : 'desligado'}`}
      onPointerDown={apertar}
      onPointerMove={mover}
      onPointerUp={() => { arrasto.current = null; }}
      role={mini ? 'button' : undefined}
      aria-label={mini ? 'Abrir o EQ' : 'Gráfico do EQ'}
      tabIndex={mini ? 0 : undefined}
      onKeyDown={(ev) => { if (mini && (ev.key === 'Enter' || ev.key === ' ')) aoClicar?.(); }}
    >
      <svg width={w} height={h}>
        {linhasF.map((f) => (
          <g key={f}>
            <line x1={xDe(f)} x2={xDe(f)} y1={0} y2={h} className="eq-grade" />
            {!mini && <text x={xDe(f) + 3} y={h - 4} className="eq-rotulo">{textoHz(f).replace(' Hz', '').replace(' kHz', 'k')}</text>}
          </g>
        ))}
        {[-12, -6, 0, 6, 12].map((g) => (
          <g key={g}>
            <line x1={0} x2={w} y1={yDe(g)} y2={yDe(g)} className={g === 0 ? 'eq-zero' : 'eq-grade'} />
            {!mini && g !== 0 && <text x={3} y={yDe(g) - 3} className="eq-rotulo">{g > 0 ? `+${g}` : `−${-g}`}</text>}
          </g>
        ))}
        <polyline points={curva} className="eq-curva" />
        {ehStd && bandas.map((b) => {
          const x = xDe(ler(`${eq}/STD/${b.k}f`, 1000));
          const tipo = lerT(`${eq}/STD/${b.k}eq`);
          const corte = (b.k === 'l' || b.k === 'h') && tipo && tipo !== 'PEQ' && tipo !== 'SHV';
          const y = corte ? yDe(0) : yDe(ler(`${eq}/STD/${b.k}g`));
          return (
            <circle
              key={b.k}
              cx={x}
              cy={y}
              r={mini ? 3 : selecionada === b.k ? 9 : 7}
              className={`eq-ponto ${selecionada === b.k ? 'sel' : ''}`}
              style={{ fill: b.cor }}
            />
          );
        })}
      </svg>
      {!ehStd && !mini && <div className="eq-aviso">Modelo {String(vals[1])}: ajuste pelos controles ao lado.</div>}
    </div>
  );
}
