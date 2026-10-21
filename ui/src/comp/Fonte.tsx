// Escolha de fonte (entrada de canal ou o que toca numa saida): grupo + numero,
// com o nome que a fonte tem na mesa.

import { useMemo } from 'react';
import { def, definir, useValor, useValores, valor } from '../store';
import { contarGrupo, GRUPOS_FONTE, inicioDoPar, nomeDaFonteInterna, nomeDaTira, caminhoFonte } from '../util';

function nomeDaEntrada(grp: string, n: number) {
  const interna = nomeDaFonteInterna(grp, n);
  if (interna) return valor(`${interna}/busmono`) ? (n % 2 ? nomeDaTira(interna) : `${nomeDaTira(interna)} D (sem uso)`) : `${nomeDaTira(interna)} ${n % 2 ? 'E' : 'D'}`;
  const c = caminhoFonte(grp, n);
  const nome = c ? String(valor(`${c}/name`) || '') : '';
  return nome;
}

const INTERNOS = ['BUS', 'MAIN', 'MTX', 'SEND', 'MON'];

/** Modos (M, ST, M/S) de todas as entradas de um grupo, para montar a lista. */
function useModosDoGrupo(grp: string, qtd: number) {
  const caminhos = useMemo(
    () => (INTERNOS.includes(grp) ? [] : Array.from({ length: qtd }, (_, i) => `/io/in/${grp}/${i + 1}/mode`)),
    [grp, qtd],
  );
  const v = useValores(caminhos);
  return (k: number) => String(v[k - 1] ?? 'M');
}

export function SeletorFonte({ base, rotulo, compacto = false }: { base: string; rotulo?: string; compacto?: boolean }) {
  // base: '/ch/5/in/conn' (usa grp/in) ou '/io/out/A/3' (usa grp/in tambem)
  const cg = `${base}/grp`;
  const cn = `${base}/in`;
  const grp = String(useValor(cg) ?? 'OFF');
  const n = Number(useValor(cn) ?? 1);
  const d = def(cg);
  const qtd = grp === 'OFF' ? 0 : contarGrupo('in', grp);
  // Num canal, um par estereo e' uma opcao so ("1–2"); numa saida cada
  // entrada continua separada (a saida toca um lado so).
  const deCanal = base.includes('/in/conn');
  const modo = useModosDoGrupo(grp, deCanal ? qtd : 0);
  const numeros = Array.from({ length: qtd }, (_, i) => i + 1).filter((k) => !(deCanal && k % 2 === 0 && modo(k - 1) !== 'M' && k !== n));
  return (
    <div className={`seletor-fonte ${compacto ? 'compacto' : ''}`}>
      {rotulo && <span className="param-nome">{rotulo}</span>}
      <select
        aria-label="Grupo da fonte"
        value={grp}
        onChange={(ev) => {
          definir(cg, ev.target.value);
          if (n > contarGrupo('in', ev.target.value)) definir(cn, 1);
        }}
      >
        {(d?.itens || []).map(([k]) => (
          <option key={String(k)} value={String(k)}>{GRUPOS_FONTE[String(k)]?.nome || String(k)}</option>
        ))}
      </select>
      {qtd > 0 && (
        <select aria-label="Número da fonte" value={n} onChange={(ev) => definir(cn, Number(ev.target.value))}>
          {numeros.map((k) => {
            const nome = nomeDaEntrada(grp, k);
            if (INTERNOS.includes(grp)) return <option key={k} value={k}>{nome || `${Math.ceil(k / 2)} ${k % 2 ? 'E' : 'D'}`}</option>;
            const par = deCanal && k % 2 === 1 && modo(k) !== 'M';
            return <option key={k} value={k}>{par ? `${k}–${k + 1}` : k}{nome ? ` · ${nome}` : ''}{par ? ' (estéreo)' : ''}</option>;
          })}
        </select>
      )}
    </div>
  );
}

const MODOS = [
  { id: 'M', nome: 'Mono' },
  { id: 'ST', nome: 'Estéreo (2 entradas)' },
  { id: 'M/S', nome: 'Mid/side' },
];

/**
 * Mono ou estereo da fonte de um canal. Na WING o estereo fica na fonte: as
 * duas entradas do par (1-2, 3-4...) ficam em ST e o canal aponta a primeira.
 */
export function SeletorModo({ base, compacto = false }: { base: string; compacto?: boolean }) {
  const grp = String(useValor(`${base}/grp`) ?? 'OFF');
  const n = Number(useValor(`${base}/in`) ?? 1);
  const a = inicioDoPar(n);
  const qtd = grp === 'OFF' ? 0 : contarGrupo('in', grp);
  const modo = String(useValor(!INTERNOS.includes(grp) && grp !== 'OFF' ? `/io/in/${grp}/${a}/mode` : null) ?? 'M');
  const possivel = grp !== 'OFF' && !INTERNOS.includes(grp) && a + 1 <= qtd && !!def(`/io/in/${grp}/${a}/mode`);
  if (!possivel) return compacto ? <span className="dica">–</span> : null;
  const sel = (
    <select
      aria-label="Mono ou estéreo"
      value={modo}
      onChange={(ev) => {
        const novo = ev.target.value;
        definir(`/io/in/${grp}/${a}/mode`, novo);
        definir(`/io/in/${grp}/${a + 1}/mode`, novo);
        if (novo !== 'M' && n !== a) definir(`${base}/in`, a);
      }}
    >
      {MODOS.map((m) => <option key={m.id} value={m.id}>{m.id === 'ST' ? `Estéreo (${a} e ${a + 1})` : m.nome}</option>)}
    </select>
  );
  if (compacto) return sel;
  return (
    <label className="param lista">
      <span className="param-nome">Canais</span>
      {sel}
    </label>
  );
}
