import { useEffect } from 'react';

// Rolagem (mouse ou trackpad) nos controles.
//
// O trackpad do Mac manda muitos eventos pequenos, quase sempre um pouco na
// diagonal; o mouse manda poucos e grandes. Por isso:
//   - so o eixo do controle conta: num fader de pe', um gesto mais de lado que
//     de pe' nao mexe no volume e segue para a tela (que rola as tiras);
//   - o deslocamento do trackpad e' somado e vira um passo a cada ~30 px, em vez
//     de um passo por evento (que fazia o volume disparar);
//   - um "dente" de mouse (|delta| grande, de uma vez) vale um passo.

type Eixo = 'vertical' | 'horizontal';

const PX_POR_PASSO = 30;
// Fim de um gesto: sem evento por este tempo (a inercia do trackpad manda
// eventos seguidos por ate ~1 s depois de soltar os dedos).
const FIM_DO_GESTO_MS = 200;

// Quando um gesto comecou rolando a fileira de tiras, ele continua rolando a
// fileira ate acabar, mesmo que um fader passe por baixo do cursor no caminho
// (senao a inercia mexia no volume de quem estava passando).
let ultimoEventoDaFileira = 0;
const DENTE_DO_MOUSE = 50;

/**
 * Cria o ouvinte de 'wheel'. `passo(+1 | -1)` e' chamado para cada passo
 * (+1 = subir / para a direita). Use com { passive: false }.
 * Num controle horizontal, o mouse comum (so vertical, em dentes) tambem vale.
 */
export function ouvinteDeRoda(passo: (dir: 1 | -1) => void, eixo: Eixo = 'vertical') {
  let acumulado = 0;
  let ultimo = 0;
  return (ev: WheelEvent) => {
    if (performance.now() - ultimoEventoDaFileira < FIM_DO_GESTO_MS) return;
    const escala = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
    const dx = ev.deltaX * escala;
    const dy = ev.deltaY * escala;
    const denteDeMouse = dx === 0 && Math.abs(dy) >= DENTE_DO_MOUSE;
    let d: number;
    if (eixo === 'vertical') {
      // Mais de lado que de pe': nao e' para este controle.
      if (Math.abs(dx) * 1.5 >= Math.abs(dy)) return;
      d = -dy;
    } else if (Math.abs(dx) > Math.abs(dy) * 1.5) {
      d = dx;
    } else if (denteDeMouse) {
      d = -dy;
    } else {
      // Trackpad de pe' em cima de um deslizante deitado: deixa a tela rolar.
      return;
    }
    ev.preventDefault();
    const agora = performance.now();
    if (agora - ultimo > 250) acumulado = 0;
    ultimo = agora;
    if (Math.abs(d) >= DENTE_DO_MOUSE) {
      acumulado = 0;
      passo(d > 0 ? 1 : -1);
      return;
    }
    acumulado += d;
    while (Math.abs(acumulado) >= PX_POR_PASSO) {
      const s = acumulado > 0 ? 1 : -1;
      passo(s);
      acumulado -= s * PX_POR_PASSO;
    }
  };
}

/**
 * Numa fileira de tiras: rolar de pe' (mouse ou trackpad) fora de um fader
 * anda para o lado. Em cima de um fader, o fader ja tratou o gesto e
 * marcou o evento (defaultPrevented), entao aqui nao faz nada.
 */
export function useRolarDeLado(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const roda = (ev: WheelEvent) => {
      if (ev.defaultPrevented || ev.ctrlKey) return;
      ultimoEventoDaFileira = performance.now();
      if (Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return; // de lado: o navegador ja rola
      if (el.scrollWidth <= el.clientWidth) return;
      ev.preventDefault();
      el.scrollLeft += ev.deltaY * (ev.deltaMode === 1 ? 16 : 1);
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, [ref]);
}
