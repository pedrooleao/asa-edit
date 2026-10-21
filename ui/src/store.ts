// Estado do app: esquema da mesa, valores atuais (por id), conexao e medidores.
// Tudo chega pelo WebSocket do servidor local.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export const TIPO = { NO: 0, LINEAR: 1, LOG: 2, FADER: 3, INTEIRO: 4, ENUM: 5, ENUM_FLOAT: 6, TEXTO: 7 } as const;
export const UNIDADE = ['', 'dB', '%', 'ms', 'Hz', 'm', 's', 'oct'];

export type Def = {
  caminho: string;
  id: number;
  tipo: number;
  unidade: number;
  min: number | null;
  max: number | null;
  passos: number | null;
  itens: [string | number, string][] | null;
  longo: string;
};

export type Valor = number | string;

/** Camada personalizada: lista de tiras ('/ch/5', '/bus/2', '/dca/1'...). */
export type Camada = { nome: string; tiras: string[] };
/** Preset de canal: valores relativos ao prefixo ('/eq/on' -> 1). */
export type Preset = { nome: string; tipo: string; valores: [string, Valor][] };

export type Mesa = { ip: string; nome: string; modelo: string; serie: string; firmware: string };

export type Geral = {
  estado: { estado: 'desconectado' | 'conectando' | 'sincronizando' | 'conectado'; ip: string | null; info: any; progresso: number; erro?: string | null };
  achadas: Mesa[];
  config: {
    acessoRede: 'desligado' | 'retorno' | 'completo';
    ultimaMesa: string | null;
    camadas?: Camada[];
    presets?: Preset[];
    temBase?: boolean;
  };
  shows?: { nome: string; data: number }[];
  rede: { nome: string; ip: string }[];
  porta: number;
};

// ---------------------------------------------------------------------------
// Esquema
// ---------------------------------------------------------------------------
const porCaminho = new Map<string, Def>();
let esquemaPronto = false;
const aoEsquema = new Set<() => void>();

export async function carregarEsquema() {
  const r = await fetch('/esquema.json');
  const lista: any[] = await r.json();
  for (const e of lista) {
    porCaminho.set(e[0], { caminho: e[0], id: e[1], tipo: e[2], unidade: e[3], min: e[4], max: e[5], passos: e[6], itens: e[7], longo: e[8] });
  }
  esquemaPronto = true;
  aoEsquema.forEach((f) => f());
}

export function useEsquemaPronto() {
  return useSyncExternalStore((f) => { aoEsquema.add(f); return () => aoEsquema.delete(f); }, () => esquemaPronto);
}

export function def(caminho: string): Def | undefined {
  return porCaminho.get(caminho);
}

/** Filhos diretos de um no' (pelo caminho), na ordem do esquema. */
const cacheFilhos = new Map<string, Def[]>();
export function filhos(caminho: string): Def[] {
  const pref = caminho.endsWith('/') ? caminho : caminho + '/';
  const guardado = cacheFilhos.get(pref);
  if (guardado) return guardado;
  const out: Def[] = [];
  for (const [c, d] of porCaminho) {
    if (c.startsWith(pref) && !c.slice(pref.length).includes('/')) out.push(d);
  }
  if (esquemaPronto) cacheFilhos.set(pref, out);
  return out;
}

/** Todas as folhas (nao nos) abaixo de um caminho, na ordem do esquema. */
export function folhasDe(caminho: string): Def[] {
  const pref = caminho.endsWith('/') ? caminho : caminho + '/';
  const out: Def[] = [];
  for (const [c, d] of porCaminho) if (c.startsWith(pref) && d.tipo !== TIPO.NO) out.push(d);
  return out;
}

/** Maior numero N para o qual existe `${base}/N`. */
export function contar(base: string): number {
  let n = 0;
  while (porCaminho.has(`${base}/${n + 1}`)) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------
const valores = new Map<number, Valor>();
const ouvintes = new Map<number, Set<() => void>>();
const ouvintesGerais = new Set<() => void>();
let versao = 0;

function avisar(id: number) {
  ouvintes.get(id)?.forEach((f) => f());
}

function receberValores(lista: [number, Valor][]) {
  for (const [id, v] of lista) {
    valores.set(id, v);
    avisar(id);
  }
  versao++;
  ouvintesGerais.forEach((f) => f());
}

export function valorDoId(id: number) {
  return valores.get(id);
}

export function valor(caminho: string): Valor | undefined {
  const d = porCaminho.get(caminho);
  return d ? valores.get(d.id) : undefined;
}

export function useValor(caminho: string | null | undefined): Valor | undefined {
  const d = caminho ? porCaminho.get(caminho) : undefined;
  const id = d?.id;
  return useSyncExternalStore(
    (f) => {
      if (id === undefined) return () => {};
      if (!ouvintes.has(id)) ouvintes.set(id, new Set());
      ouvintes.get(id)!.add(f);
      return () => ouvintes.get(id)?.delete(f);
    },
    () => (id === undefined ? undefined : valores.get(id)),
  );
}

/** Numero de um caminho, com valor padrao enquanto a mesa nao respondeu. */
export function useNumero(caminho: string | null | undefined, padrao = 0): number {
  const v = useValor(caminho);
  return typeof v === 'number' ? v : padrao;
}

export function useTexto(caminho: string | null | undefined, padrao = ''): string {
  const v = useValor(caminho);
  return v === undefined || v === null ? padrao : String(v);
}

/**
 * Varios caminhos de uma vez (ex.: todos os solos). Re-renderiza so quando um
 * deles muda. A lista de caminhos deve ser estavel (useMemo).
 */
export function useValores(caminhos: string[]): (Valor | undefined)[] {
  const ids = caminhos.map((c) => porCaminho.get(c)?.id);
  const chave = useRef<{ ids: (number | undefined)[]; lista: (Valor | undefined)[] } | null>(null);
  const ler = () => {
    const lista = ids.map((id) => (id === undefined ? undefined : valores.get(id)));
    const ant = chave.current;
    if (ant && ant.ids.length === ids.length && ant.ids.every((x, i) => x === ids[i]) && ant.lista.every((x, i) => x === lista[i])) return ant.lista;
    chave.current = { ids, lista };
    return lista;
  };
  return useSyncExternalStore(
    (f) => {
      for (const id of ids) {
        if (id === undefined) continue;
        if (!ouvintes.has(id)) ouvintes.set(id, new Set());
        ouvintes.get(id)!.add(f);
      }
      return () => { for (const id of ids) if (id !== undefined) ouvintes.get(id)?.delete(f); };
    },
    ler,
  );
}

/** Re-renderiza quando qualquer valor mudar (use com moderacao). */
export function useVersao() {
  return useSyncExternalStore((f) => { ouvintesGerais.add(f); return () => ouvintesGerais.delete(f); }, () => versao);
}

// Escrita: aplica na hora (a interface nao espera a rede) e manda no maximo
// ~40 vezes por segundo por parametro, sempre com o valor mais novo.
const pendentes = new Map<number, { v: Valor; f: string }>();
let relogioEnvio: number | null = null;

function formaDe(d: Def, v: Valor) {
  if (d.tipo === TIPO.TEXTO || d.tipo === TIPO.ENUM) return 's';
  if (d.tipo === TIPO.INTEIRO) return 'i';
  return typeof v === 'string' ? 's' : 'f';
}

// Fonte em par estereo (/io/in/A/1/mode = ST nas duas entradas): o canal usa
// as duas, entao ganho, 48V, fase e mute vao para as duas juntas.
const AJUSTE_DE_FONTE = /^\/io\/in\/([^/$][^/]*)\/(\d+)\/(g|vph|pol|mute)$/;

export function definir(caminho: string, v: Valor, espelhar = true) {
  if (espelhar) {
    const m = AJUSTE_DE_FONTE.exec(caminho);
    if (m) {
      const n = Number(m[2]);
      const par = n % 2 ? n + 1 : n - 1;
      const modo = valor(`/io/in/${m[1]}/${n}/mode`);
      if (modo === 'ST' || modo === 'M/S') definir(`/io/in/${m[1]}/${par}/${m[3]}`, v, false);
    }
  }
  const d = porCaminho.get(caminho);
  if (!d || d.tipo === TIPO.NO) return;
  if (typeof v === 'number' && d.min !== null && d.max !== null && d.tipo !== TIPO.ENUM_FLOAT) {
    v = Math.max(d.min, Math.min(d.max, v));
    if (d.tipo === TIPO.INTEIRO) v = Math.round(v);
  }
  valores.set(d.id, v);
  avisar(d.id);
  versao++;
  ouvintesGerais.forEach((f) => f());
  pendentes.set(d.id, { v, f: formaDe(d, v) });
  if (relogioEnvio === null) {
    relogioEnvio = window.setTimeout(() => {
      relogioEnvio = null;
      for (const [id, p] of pendentes) enviar({ t: 'set', id, v: p.v, f: p.f });
      pendentes.clear();
    }, 25);
  }
}

// ---------------------------------------------------------------------------
// Medidores: um vetor por quadro, lido direto pelos componentes (sem React)
// ---------------------------------------------------------------------------
export const MEDIDOR = { ch: 0, aux: 320, bus: 384, main: 512, mtx: 544, dca: 608 } as const;
export const PALAVRAS: Record<string, number> = { ch: 8, aux: 8, bus: 8, main: 8, mtx: 8, dca: 4 };
export let medidores: number[] = [];

/** Posicao no vetor de medidores. palavra: 0 entrada E, 2 saida E, 5 ganho gate, 7 ganho comp. */
export function indiceMedidor(tipo: string, n: number, palavra: number) {
  const base = (MEDIDOR as any)[tipo];
  if (base === undefined) return -1;
  return base + (n - 1) * PALAVRAS[tipo] + palavra;
}

const quadros = new Set<() => void>();
export function aCadaQuadro(f: () => void) {
  quadros.add(f);
  return () => quadros.delete(f);
}
let medidorNovo = false;
function laco() {
  if (medidorNovo) {
    medidorNovo = false;
    quadros.forEach((f) => f());
  }
  requestAnimationFrame(laco);
}
requestAnimationFrame(laco);

// ---------------------------------------------------------------------------
// Conexao com o servidor local
// ---------------------------------------------------------------------------
let ws: WebSocket | null = null;
let geral: Geral | null = null;
let papel: { papel: 'completo' | 'retorno'; bus: number | null; local: boolean } | null = null;
let progresso = 0;
let ligadoAoApp = false;
const aoGeral = new Set<() => void>();
function avisarGeral() { aoGeral.forEach((f) => f()); }

// Mensagens que as telas querem ouvir (carregando show, arquivo pronto...).
const aoMensagem = new Map<string, Set<(m: any) => void>>();
export function useMensagem(tipo: string, f: (m: any) => void) {
  const ref = useRef(f);
  ref.current = f;
  useEffect(() => {
    const g = (m: any) => ref.current(m);
    if (!aoMensagem.has(tipo)) aoMensagem.set(tipo, new Set());
    aoMensagem.get(tipo)!.add(g);
    return () => { aoMensagem.get(tipo)?.delete(g); };
  }, [tipo]);
}

export function enviar(m: any) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
}

export function conectarServidor() {
  const params = new URLSearchParams(location.search);
  const retorno = params.get('retorno');
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws${retorno ? `?retorno=${retorno}` : ''}`;
  ws = new WebSocket(url);
  ws.onopen = () => { ligadoAoApp = true; avisarGeral(); };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    switch (m.t) {
      case 'ola': papel = { papel: m.papel, bus: m.bus, local: m.local }; avisarGeral(); break;
      case 'geral': geral = m; avisarGeral(); break;
      case 'progresso': progresso = m.progresso; avisarGeral(); break;
      case 'tudo': receberValores(m.l); break;
      case 'v': receberValores(m.l); break;
      case 'm': medidores = m.l; medidorNovo = true; break;
      default: break;
    }
    aoMensagem.get(m.t)?.forEach((f) => f(m));
  };
  ws.onclose = () => {
    ligadoAoApp = false;
    avisarGeral();
    setTimeout(conectarServidor, 1000);
  };
}

export function useGeral() {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((x) => x + 1);
    aoGeral.add(f);
    return () => { aoGeral.delete(f); };
  }, []);
  return { geral, papel, progresso, ligadoAoApp };
}
