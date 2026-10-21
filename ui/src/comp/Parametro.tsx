// Editor generico a partir da definicao do esquema: numero vira deslizante,
// 0/1 vira botao, lista vira seletor, texto vira campo. Serve para os modelos
// de EQ, gate, compressor e efeitos sem escrever uma tela para cada um.

import { useEffect, useRef, useState } from 'react';
import { def, definir, TIPO, useValor, type Def } from '../store';
import { limitar, textoValor } from '../util';
import { Fader } from './Fader';
import { ouvinteDeRoda } from './roda';

// Nomes em portugues para os parametros mais comuns (pelo fim do caminho).
const NOMES: Record<string, string> = {
  thr: 'Limiar', ratio: 'Taxa', att: 'Ataque', rel: 'Liberação', hld: 'Sustentação', knee: 'Joelho',
  range: 'Faixa', gain: 'Ganho', mix: 'Mix', det: 'Detector', env: 'Envelope', auto: 'Automático',
  acc: 'Acento', on: 'Ligado', mdl: 'Modelo', g: 'Ganho', f: 'Frequência', q: 'Q', type: 'Filtro',
  src: 'Fonte', tap: 'Ponto', fxmix: 'Mix do efeito', pdel: 'Pré-delay', dcy: 'Decaimento', size: 'Tamanho',
  lc: 'Lo cut', hc: 'Hi cut', damp: 'Amortecimento', diff: 'Difusão', sprd: 'Abertura', mult: 'Mult. graves',
  time: 'Tempo', fb: 'Realimentação', depth: 'Profundidade', speed: 'Velocidade', rate: 'Velocidade',
  wid: 'Largura', pan: 'Pan', trim: 'Trim', bal: 'Balanço', lvl: 'Nível', mode: 'Modo', pre: 'Pré',
};

// Textos das listas da mesa (vem em ingles e em caixa-alta).
const ITENS: Record<string, string> = {
  PARAMETRIC: 'Paramétrico', SHELVING: 'Prateleira', CUT: 'Corte', PEAK: 'Pico', RMS: 'RMS', LIN: 'Linear', LOG: 'Logarítmico',
  FLAT: 'Sem filtro', LOWPASS: 'Passa-baixa', HIGHPASS: 'Passa-alta', BANDPASS: 'Passa-faixa', SELF: 'O próprio canal',
  INPUT: 'Entrada', FILTER: 'Depois do filtro', 'PRE FDR': 'Antes do fader', 'POST FDR': 'Depois do fader', 'POST PROC': 'Depois do processamento',
  MONO: 'Mono', STEREO: 'Estéreo', 'MID/SIDE': 'Mid/side', METERS: 'Metros', FEET: 'Pés', MS: 'Milissegundos', SAMPLES: 'Amostras',
  TAP: 'Pré', POST: 'Pós', GROUP: 'Grupo', OFF: 'Desligado', ON: 'Ligado', COMP: 'Compressor', LIM: 'Limitador', NONE: 'Nenhum',
  'TILT EQ': 'Tilt EQ', MAXER: 'Maxer', 'AP 90': 'Passa-tudo 90°', 'AP 180': 'Passa-tudo 180°', BELL: 'Sino', SHELV: 'Prateleira',
  LOW: 'Baixo', HIGH: 'Alto', PH: 'Fones', SPK: 'Alto-falantes', 'PH+SPK': 'Fones e alto-falantes', 'IN-PLACE': 'No lugar (muda o PA!)',
  AUTO: 'Automático', PUSH: 'Segurar para falar', LATCH: 'Liga e desliga', LIVE: 'Ao vivo', STUDIO: 'Estúdio', 'TAP 3': 'Ponto 3', 'TAP 4': 'Ponto 4', 'TAP 5': 'Ponto 5',
};

export function textoItem(caminho: string, k: string | number, nome: string) {
  const t = nome || String(k);
  if (caminho.endsWith('/mdl')) return t;
  if (ITENS[t]) return ITENS[t];
  if (/^[A-Z][A-Z ]{3,}$/.test(t)) return t.charAt(0) + t.slice(1).toLowerCase();
  return t;
}

export function nomeDoParametro(d: Def) {
  const fim = d.caminho.split('/').pop() || '';
  if (NOMES[fim]) return NOMES[fim];
  const t = (d.longo || fim).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Posicao 0..1 de um valor num parametro linear ou logaritmico. */
function paraPos(d: Def, v: number) {
  const min = d.min ?? 0;
  const max = d.max ?? 1;
  if (d.tipo === TIPO.LOG && min > 0) return Math.log(v / min) / Math.log(max / min);
  return (v - min) / (max - min || 1);
}
function dePos(d: Def, p: number) {
  const min = d.min ?? 0;
  const max = d.max ?? 1;
  p = limitar(p, 0, 1);
  let v = d.tipo === TIPO.LOG && min > 0 ? min * Math.pow(max / min, p) : min + p * (max - min);
  // Respeita os passos do esquema (ex.: ganho de 0,5 em 0,5 dB).
  if (d.passos && d.passos > 1 && d.tipo === TIPO.LINEAR) {
    const passo = (max - min) / (d.passos - 1);
    v = min + Math.round((v - min) / passo) * passo;
  }
  if (d.tipo === TIPO.INTEIRO) v = Math.round(v);
  return limitar(v, min, max);
}

/** Valor "neutro" para o duplo clique: 0 quando esta na faixa (ganho, pan). */
function neutro(d: Def) {
  if (d.min !== null && d.max !== null && d.min < 0 && d.max > 0) return 0;
  return null;
}

export function Deslizante({ caminho, rotulo, compacto = false }: { caminho: string; rotulo?: string; compacto?: boolean }) {
  const d = def(caminho);
  const v = useValor(caminho);
  const ref = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x: number; p0: number; w: number } | null>(null);
  const [editando, setEditando] = useState(false);
  const num = typeof v === 'number' ? v : (d?.min ?? 0);
  const numRef = useRef(num);
  numRef.current = num;

  useEffect(() => {
    const el = ref.current;
    if (!el || !d) return;
    const roda = ouvinteDeRoda((dir) => {
      const passos = d.passos && d.passos > 1 ? d.passos - 1 : 100;
      definir(caminho, dePos(d, paraPos(d, numRef.current) + dir / Math.min(passos, 200)));
    }, 'horizontal');
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, [caminho, d]);

  if (!d) return null;
  const pos = limitar(paraPos(d, num), 0, 1);
  const centro = neutro(d);
  const pCentro = centro !== null ? paraPos(d, centro) : 0;

  function apertar(ev: React.PointerEvent) {
    if (ev.button !== 0) return;
    const r = ref.current!.getBoundingClientRect();
    const p = (ev.clientX - r.left) / r.width;
    if (!(ev.target as HTMLElement).classList.contains('desl-botao')) definir(caminho, dePos(d!, p));
    arrasto.current = { x: ev.clientX, p0: (ev.target as HTMLElement).classList.contains('desl-botao') ? pos : p, w: r.width };
    ref.current!.setPointerCapture(ev.pointerId);
    ref.current!.focus();
  }
  function mover(ev: React.PointerEvent) {
    const a = arrasto.current;
    if (!a) return;
    const fino = ev.altKey ? 0.2 : 1;
    definir(caminho, dePos(d!, a.p0 + ((ev.clientX - a.x) / a.w) * fino));
    if (ev.altKey) { a.x = ev.clientX; a.p0 = paraPos(d!, numRef.current); }
  }
  function soltar() { arrasto.current = null; }
  function tecla(ev: React.KeyboardEvent) {
    const passos = d!.passos && d!.passos > 1 ? d!.passos - 1 : 100;
    const k = ev.shiftKey ? 10 : 1;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') definir(caminho, dePos(d!, pos + k / passos));
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') definir(caminho, dePos(d!, pos - k / passos));
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  }

  const a = Math.min(pos, pCentro);
  const b = Math.max(pos, pCentro);
  return (
    <div className={`param desl ${compacto ? 'compacto' : ''}`}>
      <span className="param-nome">{rotulo ?? nomeDoParametro(d)}</span>
      <div
        ref={ref}
        className="desl-trilho"
        role="slider"
        tabIndex={0}
        aria-label={rotulo ?? nomeDoParametro(d)}
        aria-valuetext={textoValor(d, num)}
        onPointerDown={apertar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onDoubleClick={() => { if (centro !== null) definir(caminho, centro); }}
        onKeyDown={tecla}
      >
        <div className="desl-cheio" style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%` }} />
        <div className="desl-botao" style={{ left: `${pos * 100}%` }} />
      </div>
      {editando ? (
        <input
          className="param-valor"
          autoFocus
          defaultValue={String(Math.round(num * 100) / 100).replace('.', ',')}
          onBlur={() => setEditando(false)}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') setEditando(false);
            if (ev.key === 'Enter') {
              let t = (ev.target as HTMLInputElement).value.trim().toLowerCase().replace(',', '.').replace('−', '-');
              let mult = 1;
              if (t.endsWith('k')) { mult = 1000; t = t.slice(0, -1); }
              const n = parseFloat(t) * mult;
              if (!isNaN(n)) definir(caminho, limitar(n, d.min ?? n, d.max ?? n));
              setEditando(false);
            }
          }}
        />
      ) : (
        <button className="param-valor" onClick={() => setEditando(true)} title="Clique para digitar">
          {textoValor(d, num)}
        </button>
      )}
    </div>
  );
}

export function Botao({ caminho, rotulo, tipo = 'liga', title }: { caminho: string; rotulo: string; tipo?: 'liga' | 'mute' | 'solo' | 'alerta'; title?: string }) {
  const v = useValor(caminho);
  const ligado = !!v && v !== 'OFF';
  return (
    <button
      className={`botao-liga ${tipo} ${ligado ? 'ligado' : ''}`}
      aria-pressed={ligado}
      title={title}
      onClick={() => definir(caminho, ligado ? 0 : 1)}
    >
      {rotulo}
    </button>
  );
}

export function Lista({ caminho, rotulo, sem }: { caminho: string; rotulo?: string; sem?: boolean }) {
  const d = def(caminho);
  const v = useValor(caminho);
  if (!d || !d.itens) return null;
  const sel = (
    <select
      value={String(v ?? '')}
      aria-label={rotulo ?? nomeDoParametro(d)}
      onChange={(ev) => {
        const item = d.itens!.find((i) => String(i[0]) === ev.target.value);
        if (item) definir(caminho, d.tipo === TIPO.ENUM_FLOAT ? Number(item[0]) : String(item[0]));
      }}
    >
      {d.itens.map(([k, nome]) => (
        <option key={String(k)} value={String(k)}>{textoItem(caminho, k, nome)}</option>
      ))}
    </select>
  );
  if (sem) return sel;
  return (
    <label className="param lista">
      <span className="param-nome">{rotulo ?? nomeDoParametro(d)}</span>
      {sel}
    </label>
  );
}

export function CampoTexto({ caminho, rotulo, placeholder }: { caminho: string; rotulo?: string; placeholder?: string }) {
  const d = def(caminho);
  const v = useValor(caminho);
  const [t, setT] = useState(String(v ?? ''));
  const focado = useRef(false);
  useEffect(() => { if (!focado.current) setT(String(v ?? '')); }, [v]);
  if (!d) return null;
  const gravar = () => { if (t !== String(v ?? '')) definir(caminho, t.slice(0, d.max ?? 16)); };
  return (
    <label className="param texto">
      {rotulo !== '' && <span className="param-nome">{rotulo ?? nomeDoParametro(d)}</span>}
      <input
        value={t}
        maxLength={d.max ?? 16}
        placeholder={placeholder}
        onFocus={() => { focado.current = true; }}
        onBlur={() => { focado.current = false; gravar(); }}
        onChange={(ev) => setT(ev.target.value)}
        onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); if (ev.key === 'Escape') { setT(String(v ?? '')); } ev.stopPropagation(); }}
      />
    </label>
  );
}

/** Escolhe o editor certo pelo tipo do parametro. */
export function Parametro({ caminho, rotulo }: { caminho: string; rotulo?: string }) {
  const d = def(caminho);
  if (!d) return null;
  if (d.tipo === TIPO.ENUM || d.tipo === TIPO.ENUM_FLOAT) return <Lista caminho={caminho} rotulo={rotulo} />;
  if (d.tipo === TIPO.TEXTO) return <CampoTexto caminho={caminho} rotulo={rotulo} />;
  if (d.tipo === TIPO.INTEIRO && d.min === 0 && d.max === 1) {
    return (
      <div className="param botao">
        <span className="param-nome">{rotulo ?? nomeDoParametro(d)}</span>
        <Botao caminho={caminho} rotulo={rotulo ?? nomeDoParametro(d)} />
      </div>
    );
  }
  if (d.tipo === TIPO.FADER) {
    return (
      <div className="param desl">
        <span className="param-nome">{rotulo ?? nomeDoParametro(d)}</span>
        <Fader caminho={caminho} horizontal rotulo={rotulo ?? nomeDoParametro(d)} marcas={false} />
        <ValorFader caminho={caminho} />
      </div>
    );
  }
  return <Deslizante caminho={caminho} rotulo={rotulo} />;
}

export function ValorFader({ caminho }: { caminho: string }) {
  const v = useValor(caminho);
  return <span className="param-valor">{textoValor(def(caminho), v)}</span>;
}

/** Os parametros de um modelo (gate, comp, EQ, efeito), em grade. */
export function GradeDoModelo({ caminhos }: { caminhos: string[] }) {
  return <div className="grade-params">{caminhos.map((c) => <Parametro key={c} caminho={c} />)}</div>;
}
