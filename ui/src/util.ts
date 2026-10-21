// Contas e textos usados por toda a interface: curva do fader, formato dos
// numeros, cores da WING, nomes das tiras e das fontes.

import { def, TIPO, UNIDADE, valor, type Def, type Valor } from './store';

// ---------------------------------------------------------------------------
// Fader: a mesma curva da X32/WING, com 0 dB em 3/4 do curso
// ---------------------------------------------------------------------------
export const FADER_MIN = -144;

export function faderParaPosicao(db: number) {
  if (db <= -90) return 0;
  if (db < -60) return (db + 90) / 480;
  if (db < -30) return (db + 70) / 160;
  if (db < -10) return (db + 50) / 80;
  return Math.min(1, (db + 30) / 40);
}

export function posicaoParaFader(p: number) {
  if (p <= 0) return FADER_MIN;
  if (p < 0.0625) return p * 480 - 90;
  if (p < 0.25) return p * 160 - 70;
  if (p < 0.5) return p * 80 - 50;
  return Math.min(10, p * 40 - 30);
}

// ---------------------------------------------------------------------------
// Numeros: virgula decimal, sinal de menos de verdade, unidade junto
// ---------------------------------------------------------------------------
const MENOS = '−';

export function numero(v: number, casas = 1) {
  const t = Math.abs(v).toFixed(casas).replace('.', ',');
  return (v < 0 && Number(t.replace(',', '.')) !== 0 ? MENOS : '') + t;
}

/** dB do fader: −∞ embaixo, uma casa, sinal de + acima de zero. */
export function textoDb(db: number) {
  if (db <= -89.5) return `${MENOS}∞`;
  const t = numero(db, Math.abs(db) >= 100 ? 0 : 1);
  return db > 0.04 ? `+${t}` : t;
}

export function textoHz(f: number) {
  if (f >= 1000) return `${numero(f / 1000, f >= 10000 ? 1 : 2).replace(/,?0+$/, '')} kHz`;
  return `${Math.round(f)} Hz`;
}

/** Valor de um parametro pronto para mostrar, com unidade. */
export function textoValor(d: Def | undefined, v: Valor | undefined): string {
  if (!d || v === undefined) return '–';
  if (d.tipo === TIPO.ENUM || d.tipo === TIPO.ENUM_FLOAT) {
    const item = d.itens?.find((i) => i[0] === v || Number(i[0]) === v);
    if (item) return item[1] || String(item[0]);
    return String(v);
  }
  if (typeof v !== 'number') return String(v);
  if (d.tipo === TIPO.FADER) return `${textoDb(v)} dB`;
  const u = UNIDADE[d.unidade] || '';
  if (u === 'Hz') return textoHz(v);
  // Faixa invertida (dim, 40 a 0): e' quanto abaixa, sem sinal.
  if (u === 'dB' && d.min !== null && d.max !== null && d.min > d.max) return `${numero(v, 0)} dB`;
  if (u === 'dB') return `${v > 0.04 ? '+' : ''}${numero(v, 1)} dB`;
  if (u === 'ms') return `${numero(v, v >= 100 ? 0 : 1)} ms`;
  if (u === '%') return `${Math.round(v)}%`;
  if (u === 's') return `${numero(v, 2)} s`;
  if (u === 'm') return `${numero(v, 2)} m`;
  if (u === 'oct') return `${numero(v, 2)} oct`;
  if (d.tipo === TIPO.INTEIRO) return String(Math.round(v));
  const casas = d.max !== null && d.min !== null && d.max - d.min > 50 ? 0 : 1;
  return numero(v, casas);
}

// ---------------------------------------------------------------------------
// Cores da WING (/ch/N/col = 1..12). Confirmar contra a tela da mesa.
// ---------------------------------------------------------------------------
export const CORES_WING: Record<number, string> = {
  1: '#7c8ea3', 2: '#3f7fd9', 3: '#3d4fb8', 4: '#2bb3b3', 5: '#3fae4f', 6: '#8a9a3b',
  7: '#e3c832', 8: '#e58a2e', 9: '#d9443b', 10: '#e5776b', 11: '#d65aa0', 12: '#9466c9',
};
export const NOMES_CORES: Record<number, string> = {
  1: 'Cinza-azul', 2: 'Azul', 3: 'Azul escuro', 4: 'Turquesa', 5: 'Verde', 6: 'Oliva',
  7: 'Amarelo', 8: 'Laranja', 9: 'Vermelho', 10: 'Coral', 11: 'Rosa', 12: 'Lilás',
};
export function corWing(n: unknown) {
  return CORES_WING[Number(n)] || CORES_WING[1];
}

// ---------------------------------------------------------------------------
// Tiras: '/ch/5', '/aux/2', '/bus/3', '/main/1', '/mtx/4', '/dca/2'
// ---------------------------------------------------------------------------
export type TipoTira = 'ch' | 'aux' | 'bus' | 'main' | 'mtx' | 'dca';

export function partesDaTira(prefixo: string): { tipo: TipoTira; n: number } {
  const [, tipo, n] = prefixo.split('/');
  return { tipo: tipo as TipoTira, n: parseInt(n, 10) };
}

const ROTULO_TIPO: Record<TipoTira, string> = { ch: 'Ch', aux: 'Aux', bus: 'Bus', main: 'Main', mtx: 'Mtx', dca: 'DCA' };
export const NOME_TIPO: Record<TipoTira, string> = { ch: 'Canal', aux: 'Aux', bus: 'Bus', main: 'Main', mtx: 'Matriz', dca: 'DCA' };

export function rotuloPadrao(prefixo: string) {
  const { tipo, n } = partesDaTira(prefixo);
  return `${ROTULO_TIPO[tipo] || tipo} ${n}`;
}

/** Nome na mesa ou, se vazio, "Ch 5". */
export function nomeDaTira(prefixo: string, nome?: Valor) {
  const t = String(nome ?? valor(`${prefixo}/name`) ?? '').trim();
  return t || rotuloPadrao(prefixo);
}

/** Numero curto que aparece no pe da tira: "5", "A2", "B3", "M1", "X4", "D2". */
export function numeroCurto(prefixo: string) {
  const { tipo, n } = partesDaTira(prefixo);
  return ({ ch: '', aux: 'A', bus: 'B', main: 'M', mtx: 'X', dca: 'D' } as Record<string, string>)[tipo] + n;
}

export const QTD: Record<TipoTira, number> = { ch: 40, aux: 8, bus: 16, main: 4, mtx: 8, dca: 16 };

export function lista(tipo: TipoTira, de = 1, ate = QTD[tipo]) {
  const out: string[] = [];
  for (let n = de; n <= ate; n++) out.push(`/${tipo}/${n}`);
  return out;
}

// ---------------------------------------------------------------------------
// Etiquetas: a WING guarda DCA e mute group nas tags do canal ("#D1,#M2")
// ---------------------------------------------------------------------------
export function lerTags(tags: Valor | undefined) {
  const partes = String(tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  const dcas: number[] = [];
  const mgrps: number[] = [];
  const outras: string[] = [];
  for (const p of partes) {
    const m = /^#([DM])(\d+)$/.exec(p);
    if (m && m[1] === 'D') dcas.push(parseInt(m[2], 10));
    else if (m && m[1] === 'M') mgrps.push(parseInt(m[2], 10));
    else outras.push(p);
  }
  return { dcas, mgrps, outras };
}

export function montarTags(dcas: number[], mgrps: number[], outras: string[]) {
  return [
    ...[...dcas].sort((a, b) => a - b).map((n) => `#D${n}`),
    ...[...mgrps].sort((a, b) => a - b).map((n) => `#M${n}`),
    ...outras,
  ].join(',');
}

// ---------------------------------------------------------------------------
// Fontes (entradas) e grupos de E/S
// ---------------------------------------------------------------------------
export const GRUPOS_FONTE: Record<string, { nome: string; curto: string }> = {
  OFF: { nome: 'Nenhuma', curto: '–' },
  LCL: { nome: 'Local', curto: 'L' },
  AUX: { nome: 'Aux in', curto: 'Aux' },
  A: { nome: 'AES50 A (SD16)', curto: 'A' },
  B: { nome: 'AES50 B (SD16)', curto: 'B' },
  C: { nome: 'AES50 C', curto: 'C' },
  SC: { nome: 'StageConnect', curto: 'SC' },
  USB: { nome: 'USB', curto: 'USB' },
  CRD: { nome: 'Cartão', curto: 'Cartão' },
  MOD: { nome: 'Módulo (Dante)', curto: 'Mód' },
  PLAY: { nome: 'Player USB', curto: 'Play' },
  AES: { nome: 'AES/EBU', curto: 'AES' },
  USR: { nome: 'Sinal do usuário', curto: 'Usr' },
  OSC: { nome: 'Oscilador', curto: 'Osc' },
  BUS: { nome: 'Bus', curto: 'Bus' },
  MAIN: { nome: 'Main', curto: 'Main' },
  MTX: { nome: 'Matriz', curto: 'Mtx' },
  SEND: { nome: 'Envio de FX', curto: 'FX' },
  MON: { nome: 'Monitor', curto: 'Mon' },
};

/** Quantas entradas (ou saidas) cada grupo tem, pelo esquema. */
export function contarGrupo(lado: 'in' | 'out', grp: string) {
  const base = `/io/${lado}/${['BUS', 'MAIN', 'MTX', 'SEND', 'MON'].includes(grp) && lado === 'in' ? '$' + grp : grp}`;
  let n = 0;
  while (def(`${base}/${n + 1}`)) n++;
  return n;
}

/** Caminho da fonte de entrada (para ganho, 48V, nome). null se nao tiver. */
export function caminhoFonte(grp: Valor | undefined, n: Valor | undefined) {
  if (!grp || grp === 'OFF' || typeof n !== 'number') return null;
  const g = String(grp);
  const base = ['BUS', 'MAIN', 'MTX', 'SEND', 'MON'].includes(g) ? `/io/in/$${g}/${n}` : `/io/in/${g}/${n}`;
  return def(`${base}/name`) ? base : null;
}

/** "A 5", "L 3", "USB 12". Para os grupos estereo internos, "Bus 3 E". */
export function textoFonte(grp: Valor | undefined, n: Valor | undefined, longo = false) {
  const g = String(grp || 'OFF');
  if (g === 'OFF') return longo ? 'Nenhuma' : '–';
  const info = GRUPOS_FONTE[g] || { nome: g, curto: g };
  const num = Number(n) || 1;
  if (['BUS', 'MAIN', 'MTX', 'SEND', 'MON'].includes(g)) {
    // Estes vem em pares (esquerdo e direito): 1 = Bus 1 E, 2 = Bus 1 D.
    const k = Math.ceil(num / 2);
    const lado = num % 2 ? 'E' : 'D';
    return `${longo ? info.nome : info.curto} ${k} ${lado}`;
  }
  return `${longo ? info.nome : info.curto} ${num}`;
}

/** Nome que a pessoa deu a uma tira estereo interna (o que toca numa saida). */
export function nomeDaFonteInterna(grp: string, n: number) {
  const k = Math.ceil(n / 2);
  const mapa: Record<string, string> = { BUS: '/bus', MAIN: '/main', MTX: '/mtx' };
  if (!mapa[grp]) return null;
  return `${mapa[grp]}/${k}`;
}

export function limitar(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

// ---------------------------------------------------------------------------
// Preferencias guardadas neste navegador (zoom, painel, favoritos do celular)
// ---------------------------------------------------------------------------
export function lerLocal<T>(chave: string, padrao: T): T {
  try {
    const t = localStorage.getItem(`asa.${chave}`);
    return t === null ? padrao : (JSON.parse(t) as T);
  } catch {
    return padrao;
  }
}

export function gravarLocal(chave: string, v: unknown) {
  try { localStorage.setItem(`asa.${chave}`, JSON.stringify(v)); } catch { /* sem espaco */ }
}
