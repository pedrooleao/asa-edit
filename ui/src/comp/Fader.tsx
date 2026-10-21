// Fader com a curva da mesa. Arrastar (⌥ = fino), duplo clique = 0 dB,
// rolagem = ±0,5 dB, setas do teclado com ele focado.

import { useEffect, useRef } from 'react';
import { definir, useNumero } from '../store';
import { faderParaPosicao, FADER_MIN, posicaoParaFader, textoDb } from '../util';

type Props = {
  caminho: string;
  horizontal?: boolean;
  rotulo: string;
  desligado?: boolean;     // envio desligado: fader apagado mas mexivel
  className?: string;
  marcas?: boolean;
};

const MARCAS = [10, 5, 0, -10, -20, -40, -60];

export function Fader({ caminho, horizontal = false, rotulo, desligado = false, className, marcas = true }: Props) {
  const db = useNumero(caminho, FADER_MIN);
  const ref = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ ini: number; pos0: number; tam: number } | null>(null);
  const dbRef = useRef(db);
  dbRef.current = db;
  const pos = faderParaPosicao(db);

  function mudarPos(p: number) {
    definir(caminho, posicaoParaFader(Math.max(0, Math.min(1, p))));
  }
  function passo(delta: number) {
    const atual = dbRef.current <= -89.5 ? -90 : dbRef.current;
    let novo = Math.round((atual + delta) * 2) / 2;
    if (novo <= -90) novo = FADER_MIN;
    definir(caminho, Math.min(10, novo));
  }

  // Rolagem precisa de ouvinte nao-passivo para nao rolar a pagina junto.
  useEffect(() => {
    const el = ref.current!;
    const roda = (ev: WheelEvent) => {
      ev.preventDefault();
      const d = Math.abs(ev.deltaY) > Math.abs(ev.deltaX) ? -ev.deltaY : ev.deltaX;
      if (d) passo(d > 0 ? 0.5 : -0.5);
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, [caminho]);

  function apertar(ev: React.PointerEvent) {
    if (ev.button !== 0) return;
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const tam = horizontal ? r.width : r.height;
    const coord = horizontal ? ev.clientX : ev.clientY;
    const alvo = ev.target as HTMLElement;
    // Clique fora do botao: o fader pula para la (como no WING Edit).
    if (!alvo.classList.contains('fader-botao')) {
      const p = horizontal ? (coord - r.left) / tam : 1 - (coord - r.top) / tam;
      mudarPos(p);
    }
    arrasto.current = { ini: coord, pos0: faderParaPosicao(dbRef.current), tam };
    el.setPointerCapture(ev.pointerId);
    el.focus();
  }
  function mover(ev: React.PointerEvent) {
    const a = arrasto.current;
    if (!a) return;
    const coord = horizontal ? ev.clientX : ev.clientY;
    const fino = ev.altKey ? 0.2 : 1;
    const delta = ((horizontal ? coord - a.ini : a.ini - coord) / a.tam) * fino;
    mudarPos(a.pos0 + delta);
    if (ev.altKey) { a.ini = coord; a.pos0 = faderParaPosicao(dbRef.current); }
  }
  function soltar(ev: React.PointerEvent) {
    arrasto.current = null;
    try { ref.current!.releasePointerCapture(ev.pointerId); } catch { /* ja solto */ }
  }
  function tecla(ev: React.KeyboardEvent) {
    const mais = horizontal ? 'ArrowRight' : 'ArrowUp';
    const menos = horizontal ? 'ArrowLeft' : 'ArrowDown';
    const grande = ev.shiftKey ? 3 : 0.5;
    if (ev.key === mais) passo(grande);
    else if (ev.key === menos) passo(-grande);
    else if (ev.key === 'Home') definir(caminho, 0);
    else if (ev.key === 'End') definir(caminho, FADER_MIN);
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  }

  return (
    <div
      ref={ref}
      className={`fader ${horizontal ? 'h' : 'v'} ${desligado ? 'desligado' : ''} ${className || ''}`}
      role="slider"
      tabIndex={0}
      aria-label={rotulo}
      aria-valuemin={-144}
      aria-valuemax={10}
      aria-valuenow={Math.round(db * 10) / 10}
      aria-valuetext={`${textoDb(db)} dB`}
      onPointerDown={apertar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onDoubleClick={() => definir(caminho, 0)}
      onKeyDown={tecla}
    >
      <div className="fader-trilho">
        <div className="fader-cheio" style={horizontal ? { width: `${pos * 100}%` } : { height: `${pos * 100}%` }} />
      </div>
      {marcas && !horizontal && (
        <div className="fader-marcas" aria-hidden="true">
          {MARCAS.map((m) => (
            <span key={m} className={m === 0 ? 'zero' : ''} style={{ bottom: `${faderParaPosicao(m) * 100}%` }}>
              {m > 0 ? `+${m}` : m === 0 ? '0' : `${m}`.replace('-', '−')}
            </span>
          ))}
        </div>
      )}
      <div className="fader-botao" style={{ '--p': pos } as React.CSSProperties} />
    </div>
  );
}
