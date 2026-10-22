'use strict';

// Esquema da arvore de parametros da WING (gerado do libwing, Apache-2.0).
// Cada entrada: [caminho, id, tipo, unidade, min, max, passos, itens, nomeLongo]

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TIPO = { NO: 0, LINEAR: 1, LOG: 2, FADER: 3, INTEIRO: 4, ENUM: 5, ENUM_FLOAT: 6, TEXTO: 7 };

const ARQUIVO = path.join(__dirname, 'esquema.json.gz');

// O empacotador do Android pode tirar o .gz do nome (e ate descompactar):
// aceita os dois jeitos.
function lerArquivo(arquivo) {
  const nomes = [arquivo, arquivo.replace(/\.gz$/, '')];
  const achado = nomes.find((n) => fs.existsSync(n));
  if (!achado) throw new Error(`esquema nao encontrado: ${arquivo}`);
  const dados = fs.readFileSync(achado);
  return dados[0] === 0x1f && dados[1] === 0x8b ? dados : zlib.gzipSync(dados);
}

class Esquema {
  constructor(arquivo = ARQUIVO) {
    this.bruto = lerArquivo(arquivo);
    const lista = JSON.parse(zlib.gunzipSync(this.bruto).toString('utf8'));
    this.porCaminho = new Map();
    this.porId = new Map();
    for (const e of lista) {
      const def = {
        caminho: e[0], id: e[1], tipo: e[2], unidade: e[3],
        min: e[4], max: e[5], passos: e[6], itens: e[7], longo: e[8],
      };
      this.porCaminho.set(def.caminho, def);
      if (!this.porId.has(def.id)) this.porId.set(def.id, []);
      this.porId.get(def.id).push(def);
    }
  }

  def(caminho) {
    return this.porCaminho.get(caminho);
  }

  /** Ids unicos das folhas (nao nos) cujos caminhos comecam por algum prefixo. */
  idsDeFolhas(prefixos) {
    const ids = new Set();
    for (const def of this.porCaminho.values()) {
      if (def.tipo === TIPO.NO) continue;
      if (prefixos.some((p) => def.caminho.startsWith(p))) ids.add(def.id);
    }
    return [...ids];
  }

  /** Tipo de valor esperado para um id: 'f' float, 'i' inteiro, 's' texto. */
  formaDoId(id) {
    const defs = this.porId.get(id);
    if (!defs) return null;
    const t = defs[0].tipo;
    if (t === TIPO.TEXTO || t === TIPO.ENUM) return 's';
    if (t === TIPO.INTEIRO) return 'i';
    if (t === TIPO.NO) return null;
    return 'f';
  }
}

module.exports = { Esquema, TIPO, ARQUIVO };
