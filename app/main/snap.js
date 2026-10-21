'use strict';

// Snapshots do WING Edit (.snap): um JSON com a arvore da mesa em "ae_data",
// com os mesmos nomes do esquema. Duas diferencas:
//   - parametros de modelo vem direto no bloco: /ch/1/gate/thr (no esquema,
//     /ch/1/gate/GATE/thr, com o modelo no caminho);
//   - 0/1 vem como true/false.
// Ler: snap -> lista de [id, valor] na ordem do arquivo (o "mdl" vem antes dos
// parametros do modelo, e a mesa precisa dele primeiro). Escrever: o estado
// atual por cima da ultima snap aberta (para manter o que o Asa nao le, como
// as camadas da superficie) ou, sem base, so o "ae_data".

const { TIPO } = require('./esquema');

function eObjeto(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Folhas da snap na ordem do arquivo: [caminho, valor, objetoPai]. */
function folhas(raiz, base = '', saida = []) {
  for (const [k, v] of Object.entries(raiz)) {
    const c = `${base}/${k}`;
    if (eObjeto(v)) folhas(v, c, saida);
    else saida.push([c, v, raiz]);
  }
  return saida;
}

/** Caminho do esquema para um caminho da snap (com o modelo, se precisar). */
function caminhoNoEsquema(esquema, caminho, pai) {
  if (esquema.def(caminho)) return caminho;
  if (pai && typeof pai.mdl === 'string') {
    const i = caminho.lastIndexOf('/');
    const alt = `${caminho.slice(0, i)}/${pai.mdl}${caminho.slice(i)}`;
    if (esquema.def(alt)) return alt;
  }
  return null;
}

function paraValorDaMesa(def, v) {
  if (typeof v === 'boolean') v = v ? 1 : 0;
  switch (def.tipo) {
    case TIPO.TEXTO: return { v: String(v), forma: 's' };
    case TIPO.ENUM: return { v: String(v), forma: 's' };
    case TIPO.INTEIRO: return { v: Math.round(Number(v)), forma: 'i' };
    case TIPO.NO: return null;
    default: {
      const n = Number(v);
      return Number.isFinite(n) ? { v: n, forma: 'f' } : null;
    }
  }
}

/**
 * Le uma snap. Devolve { itens: [{id, v, forma, caminho}], ignorados, camadas }.
 * Pula o que e' so leitura ($...) e o que o esquema nao conhece.
 */
function lerSnap(esquema, texto) {
  const snap = typeof texto === 'string' ? JSON.parse(texto) : texto;
  if (!snap || !eObjeto(snap.ae_data)) throw new Error('Este arquivo não é uma snapshot da WING');
  const itens = [];
  let ignorados = 0;
  for (const [c, v, pai] of folhas(snap.ae_data)) {
    const caminho = caminhoNoEsquema(esquema, c, pai);
    const def = caminho && esquema.def(caminho);
    if (!def || caminho.includes('/$')) { ignorados++; continue; }
    const conv = paraValorDaMesa(def, v);
    if (!conv) { ignorados++; continue; }
    itens.push({ id: def.id, v: conv.v, forma: conv.forma, caminho });
  }
  return { snap, itens, ignorados, camadas: camadasDaSnap(snap) };
}

// Tiras nas camadas da superficie: CH1-40, CH41-48 = aux, BUS1-16, BUS17-20 =
// mains, BUS21-28 = matrizes, DCA1-16.
function tiraDaCamada(item) {
  if (!item || !item.type || item.type === 'OFF') return null;
  const i = Number(item.i);
  if (item.type === 'CH') return i <= 40 ? `/ch/${i}` : i <= 48 ? `/aux/${i - 40}` : null;
  if (item.type === 'BUS') return i <= 16 ? `/bus/${i}` : i <= 20 ? `/main/${i - 16}` : i <= 28 ? `/mtx/${i - 20}` : null;
  if (item.type === 'DCA') return i <= 16 ? `/dca/${i}` : null;
  return null;
}

/**
 * Camadas personalizadas da WING Compact (ce_data.layer.CMPCT), sem as que
 * repetem as fixas do Asa (canais, buses, DCA) e sem as vazias.
 */
function camadasDaSnap(snap) {
  const grupo = snap?.ce_data?.layer?.CMPCT;
  if (!eObjeto(grupo)) return [];
  const out = [];
  for (const [k, camada] of Object.entries(grupo)) {
    if (!/^\d+$/.test(k) || !eObjeto(camada)) continue;
    const tiras = Object.entries(camada)
      .filter(([n, v]) => /^\d+$/.test(n) && eObjeto(v))
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, v]) => tiraDaCamada(v))
      .filter(Boolean);
    if (!tiras.length) continue;
    const nome = String(camada.name || `Camada ${k}`);
    if (/^(DCA|MAIN\/MTX|MAIN\|MTX|BUSES|CHANNELS|AUX)$/i.test(nome)) continue;
    out.push({ nome: nome.charAt(0) + nome.slice(1).toLowerCase(), tiras });
  }
  return out;
}

/**
 * /ch/1/gate/GATE/thr -> ['ch','1','gate','thr'] quando GATE e' o modelo atual
 * do bloco; null quando e' de outro modelo (o mesmo id serve aos dois).
 */
function semModelo(esquema, caminho, blocosDeModelo) {
  const partes = caminho.split('/').slice(1);
  for (let i = 1; i < partes.length - 1; i++) {
    const bloco = '/' + partes.slice(0, i).join('/');
    const atual = blocosDeModelo.get(bloco);
    if (atual === undefined) continue;
    const seg = partes[i];
    if (!esquema.def(`${bloco}/mdl`)?.itens?.some((it) => String(it[0]) === seg)) continue;
    if (seg !== atual) return null;
    partes.splice(i, 1);
    return partes;
  }
  return partes;
}

function paraValorDaSnap(def, v, exemplo) {
  if (v === undefined) return exemplo;
  if (typeof exemplo === 'boolean') return !!v;
  if (def.tipo === TIPO.INTEIRO && def.min === 0 && def.max === 1 && exemplo === undefined) return !!v;
  if (def.tipo === TIPO.ENUM && typeof exemplo === 'number') {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  if (typeof v === 'number') return Number(v.toPrecision(10));
  return v;
}

/**
 * Monta uma snap com o estado atual. `valores`: Map id -> valor. `base`: a
 * ultima snap aberta (opcional), para manter o que o Asa nao le.
 */
function escreverSnap(esquema, valores, base = null, info = {}) {
  const agora = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const data = `${agora.getFullYear()}-${p2(agora.getMonth() + 1)}-${p2(agora.getDate())} ${p2(agora.getHours())}:${p2(agora.getMinutes())}:${p2(agora.getSeconds())}`;
  let snap;
  if (base && eObjeto(base.ae_data)) {
    snap = JSON.parse(JSON.stringify(base));
    // Primeiro os modelos (eles decidem onde cada parametro mora), depois o resto.
    const lista = folhas(snap.ae_data);
    for (const [c, , pai] of lista) {
      if (!c.endsWith('/mdl')) continue;
      const def = esquema.def(c);
      if (def && valores.has(def.id)) pai.mdl = valores.get(def.id);
    }
    for (const [c, v, pai] of lista) {
      if (c.endsWith('/mdl')) continue;
      const caminho = caminhoNoEsquema(esquema, c, pai);
      const def = caminho && esquema.def(caminho);
      if (!def || !valores.has(def.id)) continue;
      const k = c.slice(c.lastIndexOf('/') + 1);
      pai[k] = paraValorDaSnap(def, valores.get(def.id), v);
    }
  } else {
    snap = { ae_data: {} };
    const blocosDeModelo = new Map();   // '/ch/1/gate' -> modelo atual
    for (const def of esquema.porCaminho.values()) {
      if (def.caminho.endsWith('/mdl') && def.tipo === TIPO.ENUM && valores.has(def.id)) {
        blocosDeModelo.set(def.caminho.slice(0, -4), String(valores.get(def.id)));
      }
    }
    for (const def of esquema.porCaminho.values()) {
      if (def.tipo === TIPO.NO || def.caminho.includes('/$') || !valores.has(def.id)) continue;
      const partes = semModelo(esquema, def.caminho, blocosDeModelo);
      if (!partes) continue;
      let no = snap.ae_data;
      for (const p of partes.slice(0, -1)) { if (!eObjeto(no[p])) no[p] = {}; no = no[p]; }
      no[partes[partes.length - 1]] = paraValorDaSnap(def, valores.get(def.id), undefined);
    }
  }
  return {
    type: snap.type || 'snapshot.11',
    creator_fw: snap.creator_fw || info.firmware || 'VERSION_FULL',
    creator_sn: snap.creator_sn || 'NO_SERIAL',
    creator_model: snap.creator_model || 'WING-EDIT',
    creator_version: snap.creator_version || '3.3.3',
    creator_name: 'Asa',
    ...snap,
    created: data,
  };
}

module.exports = { lerSnap, escreverSnap, camadasDaSnap };
