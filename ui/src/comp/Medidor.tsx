// Medidores em canvas. Leem o vetor `medidores` a cada quadro, sem passar
// pelo React: com 40 tiras na tela, re-renderizar 25 vezes por segundo pesaria.

import { useEffect, useRef } from 'react';
import { aCadaQuadro, medidores } from '../store';

const PISO = -60;

export function dbParaMedidor(db: number) {
  if (!(db > PISO)) return 0;
  return Math.min(1, (db - PISO) / -PISO);
}

function cores() {
  const s = getComputedStyle(document.documentElement);
  return {
    sinal: s.getPropertyValue('--sinal').trim() || '#58cf7a',
    quente: s.getPropertyValue('--quente').trim() || '#f0d24a',
    clip: s.getPropertyValue('--clip').trim() || '#ff5a4f',
    fundo: s.getPropertyValue('--trilho').trim() || '#14161a',
    reducao: s.getPropertyValue('--reducao').trim() || '#e58a2e',
  };
}

/** Ajusta o tamanho do canvas ao elemento (e a densidade da tela). */
function useCanvas(desenhar: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const desenharRef = useRef(desenhar);
  desenharRef.current = desenhar;
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let w = 0;
    let h = 0;
    const medir = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = Math.max(1, Math.round(r.width * dpr));
      h = Math.max(1, Math.round(r.height * dpr));
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      desenharRef.current(ctx, w, h);
    };
    const ro = new ResizeObserver(medir);
    ro.observe(c);
    medir();
    const parar = aCadaQuadro(() => { if (w && h) desenharRef.current(ctx, w, h); });
    return () => { ro.disconnect(); parar(); };
  }, []);
  return ref;
}

type Props = {
  indices: number[];          // posicoes no vetor de medidores (1 = mono, 2 = estereo)
  horizontal?: boolean;
  className?: string;
};

/** Medidor de nivel: verde ate −12, amarelo ate −3, vermelho acima. Pico segura 1 s. */
export function Medidor({ indices, horizontal = false, className }: Props) {
  const picos = useRef<{ v: number; t: number }[]>([]);
  const paleta = useRef<ReturnType<typeof cores> | null>(null);
  const ref = useCanvas((ctx, w, h) => {
    const p = (paleta.current ||= cores());
    ctx.clearRect(0, 0, w, h);
    const n = indices.length || 1;
    const vao = Math.max(1, Math.round((horizontal ? h : w) * 0.12));
    const largura = ((horizontal ? h : w) - vao * (n - 1)) / n;
    const agora = performance.now();
    const comprimento = horizontal ? w : h;
    indices.forEach((idx, k) => {
      const db = idx >= 0 ? medidores[idx] ?? -144 : -144;
      const pos = dbParaMedidor(db);
      const pico = (picos.current[k] ||= { v: 0, t: 0 });
      if (pos >= pico.v || agora - pico.t > 1000) { pico.v = pos; pico.t = agora; }
      const x0 = k * (largura + vao);
      // trilho
      ctx.fillStyle = p.fundo;
      if (horizontal) ctx.fillRect(0, x0, w, largura); else ctx.fillRect(x0, 0, largura, h);
      // tres faixas de cor
      const faixas: [number, number, string][] = [
        [0, dbParaMedidor(-12), p.sinal],
        [dbParaMedidor(-12), dbParaMedidor(-3), p.quente],
        [dbParaMedidor(-3), 1, p.clip],
      ];
      for (const [a, b, cor] of faixas) {
        const ate = Math.min(pos, b);
        if (ate <= a) continue;
        ctx.fillStyle = cor;
        const ini = a * comprimento;
        const tam = (ate - a) * comprimento;
        if (horizontal) ctx.fillRect(ini, x0, tam, largura); else ctx.fillRect(x0, h - ini - tam, largura, tam);
      }
      // pico
      if (pico.v > 0.01) {
        ctx.fillStyle = pico.v > dbParaMedidor(-3) ? p.clip : pico.v > dbParaMedidor(-12) ? p.quente : p.sinal;
        const at = pico.v * comprimento;
        const esp = Math.max(1, Math.round(comprimento * 0.008));
        if (horizontal) ctx.fillRect(at - esp, x0, esp, largura); else ctx.fillRect(x0, h - at, largura, esp);
      }
    });
  });
  return <canvas ref={ref} className={`medidor ${horizontal ? 'h' : 'v'} ${className || ''}`} aria-hidden="true" />;
}

/** Reducao de ganho (gate ou compressor): cresce de cima para baixo, 0 a −24 dB. */
export function MedidorReducao({ indice, horizontal = false, className }: { indice: number; horizontal?: boolean; className?: string }) {
  const paleta = useRef<ReturnType<typeof cores> | null>(null);
  const ref = useCanvas((ctx, w, h) => {
    const p = (paleta.current ||= cores());
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = p.fundo;
    ctx.fillRect(0, 0, w, h);
    const v = indice >= 0 ? medidores[indice] ?? 0 : 0;
    const reducao = Math.max(0, Math.min(24, -v));
    const fr = reducao / 24;
    ctx.fillStyle = p.reducao;
    if (horizontal) ctx.fillRect(w - fr * w, 0, fr * w, h); else ctx.fillRect(0, 0, w, fr * h);
  });
  return <canvas ref={ref} className={`medidor reducao ${horizontal ? 'h' : 'v'} ${className || ''}`} aria-hidden="true" />;
}
