// Escolha de fonte (entrada de canal ou o que toca numa saida): grupo + numero,
// com o nome que a fonte tem na mesa.

import { def, definir, useValor, valor } from '../store';
import { contarGrupo, GRUPOS_FONTE, nomeDaFonteInterna, nomeDaTira, caminhoFonte } from '../util';

function nomeDaEntrada(grp: string, n: number) {
  const interna = nomeDaFonteInterna(grp, n);
  if (interna) return valor(`${interna}/busmono`) ? (n % 2 ? nomeDaTira(interna) : `${nomeDaTira(interna)} D (sem uso)`) : `${nomeDaTira(interna)} ${n % 2 ? 'E' : 'D'}`;
  const c = caminhoFonte(grp, n);
  const nome = c ? String(valor(`${c}/name`) || '') : '';
  return nome;
}

export function SeletorFonte({ base, rotulo, compacto = false }: { base: string; rotulo?: string; compacto?: boolean }) {
  // base: '/ch/5/in/conn' (usa grp/in) ou '/io/out/A/3' (usa grp/in tambem)
  const cg = `${base}/grp`;
  const cn = `${base}/in`;
  const grp = String(useValor(cg) ?? 'OFF');
  const n = Number(useValor(cn) ?? 1);
  const d = def(cg);
  const qtd = grp === 'OFF' ? 0 : contarGrupo('in', grp);
  const numeros = Array.from({ length: qtd }, (_, i) => i + 1);
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
            return <option key={k} value={k}>{['BUS', 'MAIN', 'MTX', 'SEND', 'MON'].includes(grp) ? (nome || `${Math.ceil(k / 2)} ${k % 2 ? 'E' : 'D'}`) : `${k}${nome ? ` · ${nome}` : ''}`}</option>;
          })}
        </select>
      )}
    </div>
  );
}
