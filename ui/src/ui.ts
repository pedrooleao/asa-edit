// Estado da interface que nao e' da mesa: tela aberta, tira selecionada,
// painel do canal, zoom. Fica neste navegador (cada janela tem o seu).

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { gravarLocal, lerLocal } from './util';

export type Tela = 'mixer' | 'retornos' | 'roteamento' | 'efeitos' | 'medidores' | 'monitor' | 'biblioteca' | 'config';
export type AbaPainel = 'canal' | 'eq' | 'gate' | 'comp' | 'envios' | 'inserts';

type Estado = {
  tela: Tela;
  selecionado: string;     // '/ch/1', '/bus/3'...
  painelAberto: boolean;
  painelAltura: number;    // em rem
  aba: AbaPainel;
  camada: string;          // 'ch', 'aux', 'bus', 'saidas', 'dca', 'u:0'...
  mainFixo: string;        // '/main/1'
  lateralAberta: boolean;
  zoom: number;
  retornoBus: number;      // bus escolhido na tela Retornos
  esconderVazios: boolean;
};

const guardado = lerLocal<Partial<Estado>>('ui', {});
let estado: Estado = {
  tela: 'mixer',
  selecionado: '/ch/1',
  painelAberto: true,
  painelAltura: 19,
  aba: 'canal',
  camada: 'ch',
  mainFixo: '/main/1',
  lateralAberta: true,
  zoom: 1,
  retornoBus: 1,
  esconderVazios: true,
  ...guardado,
};
const ouvintes = new Set<() => void>();

export function mudarUi(p: Partial<Estado>) {
  estado = { ...estado, ...p };
  gravarLocal('ui', estado);
  ouvintes.forEach((f) => f());
}

export function lerUi() {
  return estado;
}

export function useUi<K extends keyof Estado>(k: K): Estado[K] {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, () => estado[k]);
}

/** Seleciona uma tira (e abre o painel dela, se estiver fechado). */
export function selecionar(prefixo: string, abrir = false) {
  mudarUi({ selecionado: prefixo, ...(abrir ? { painelAberto: true } : {}) });
}

export function aplicarZoom(z: number) {
  const zoom = Math.round(Math.max(0.6, Math.min(2, z)) * 20) / 20;
  document.documentElement.style.fontSize = `${16 * zoom}px`;
  mudarUi({ zoom });
}
aplicarZoom(estado.zoom);

/** Fecha janelas com Esc (e deixa o foco no primeiro controle dela). */
export function useFecharComEsc(fechar: () => void) {
  const ref = useRef(fechar);
  ref.current = fechar;
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); ref.current(); } };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, []);
}
