// Pergunta de confirmacao do app ("Zerar a mix?"), no lugar do confirm() do
// navegador: aquele vem com os botoes em ingles no Electron e foge do visual.
// Uso: if (await confirmar('Apagar o show?', { sim: 'Apagar', perigo: true })) ...

import { useEffect, useRef, useSyncExternalStore } from 'react';

type Pedido = { texto: string; sim: string; perigo: boolean; responder: (ok: boolean) => void };

let atual: Pedido | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export function confirmar(texto: string, o: { sim?: string; perigo?: boolean } = {}): Promise<boolean> {
  return new Promise((responder) => {
    atual?.responder(false);
    atual = { texto, sim: o.sim || 'Confirmar', perigo: !!o.perigo, responder };
    avisar();
  });
}

function responder(ok: boolean) {
  const p = atual;
  atual = null;
  avisar();
  p?.responder(ok);
}

/** Fica montado uma vez, na raiz do app. */
export function Confirmacao() {
  const pedido = useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, () => atual);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pedido) return;
    // Foco no "sim" so quando nao e' perigoso; senao no "cancelar".
    const alvo = pedido.perigo ? document.querySelector<HTMLButtonElement>('.confirmar .cancelar') : botao.current;
    alvo?.focus();
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); responder(false); }
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [pedido]);
  if (!pedido) return null;
  return (
    <div className="fundo-modal confirmar" onClick={() => responder(false)}>
      <div className="modal pequeno" role="alertdialog" aria-modal="true" aria-label={pedido.texto} onClick={(e) => e.stopPropagation()}>
        <p className="pergunta">{pedido.texto}</p>
        <footer className="modal-pe">
          <button className="cancelar" onClick={() => responder(false)}>Cancelar</button>
          <button ref={botao} className={pedido.perigo ? 'perigo' : 'primario'} onClick={() => responder(true)}>{pedido.sim}</button>
        </footer>
      </div>
    </div>
  );
}
